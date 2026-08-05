'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../../_components/pagination-controls';

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface AuditResponse {
  data: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

interface Operator {
  id: string;
  email: string;
  role: string;
}

const ACTION_COLORS: Record<string, string> = {
  BAN_USER: 'destructive',
  UNBAN_USER: 'warning',
  DELETE_USER: 'destructive',
  UPDATE_USER_ROLE: 'default',
  CREATE_CALIBRATION: 'success',
  UPDATE_CALIBRATION: 'default',
  DELETE_CALIBRATION: 'destructive',
  UPDATE_REPORT_STATUS: 'default',
  DELETE_REPORT: 'destructive',
};

export function ActivityTab() {
  const t = useTranslations('admin');
  const fmt = useFormatter();

  const [memberFilter, setMemberFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: operators } = useQuery({
    queryKey: ['adminOperators'],
    queryFn: () => apiClient.get<Operator[]>(adminRoutes.operators()),
  });
  const operatorList = Array.isArray(operators) ? operators : [];

  const { data: logsData, isLoading } = useQuery({
    // Keeps the rows on screen while the next page/filter loads.
    placeholderData: keepPreviousData,
    queryKey: ['adminTeamActivity', memberFilter, actionFilter, page],
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
      };
      if (memberFilter !== 'ALL') params.adminId = memberFilter;
      if (actionFilter !== 'ALL') params.action = actionFilter;
      return apiClient.get<AuditResponse>(adminRoutes.auditLogs(), { params });
    },
  });

  const actions = [
    'BAN_USER',
    'UNBAN_USER',
    'DELETE_USER',
    'UPDATE_USER_ROLE',
    'CREATE_CALIBRATION',
    'UPDATE_CALIBRATION',
    'DELETE_CALIBRATION',
    'UPDATE_REPORT_STATUS',
    'DELETE_REPORT',
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select
          value={memberFilter}
          onValueChange={(v) => {
            setMemberFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('team.activity.allMembers')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('team.activity.allMembers')}</SelectItem>
            {operatorList.map((op) => (
              <SelectItem key={op.id} value={op.id}>
                {op.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={actionFilter}
          onValueChange={(v) => {
            setActionFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('team.activity.allActions')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('team.activity.allActions')}</SelectItem>
            {actions.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : !logsData?.data?.length ? (
        <EmptyState
          type="no-data"
          title={t('team.activity.empty')}
          description={t('team.activity.emptyDesc')}
        />
      ) : (
        <>
          <Card>
            <ScrollArea className="h-[450px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('team.activity.time')}</TableHead>
                    <TableHead>{t('team.activity.action')}</TableHead>
                    <TableHead>{t('team.activity.resource')}</TableHead>
                    <TableHead>{t('team.activity.resourceId')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData.data.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {fmt.dateTime(new Date(log.createdAt), 'medium')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (ACTION_COLORS[log.action] as
                              'destructive' | 'warning' | 'success' | 'default') || 'outline'
                          }
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.resource}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {log.resourceId?.slice(0, 12)}...
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
          <PaginationControls
            page={page}
            totalPages={logsData.totalPages}
            total={logsData.total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

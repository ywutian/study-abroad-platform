'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { ScrollText, Info } from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  UPDATE_USER_ROLE: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  DELETE_USER: 'bg-red-500/10 text-red-600 border-red-500/20',
  UPDATE_REPORT_STATUS: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  DELETE_REPORT: 'bg-red-500/10 text-red-600 border-red-500/20',
  VERIFY_USER: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  BAN_USER: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export default function AdminAuditLogsPage() {
  const t = useTranslations('admin');
  const fmt = useFormatter();

  const [actionFilter, setActionFilter] = useState('ALL');
  const [resourceFilter, setResourceFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['adminAuditLogs', actionFilter, resourceFilter, page],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
      if (actionFilter !== 'ALL') params.action = actionFilter;
      if (resourceFilter !== 'ALL') params.resource = resourceFilter;
      return apiClient.get<{ data: AuditLog[]; total: number; totalPages: number }>(
        '/admin/audit-logs',
        { params }
      );
    },
  });

  const getActionLabel = (action: string) => {
    const key = `auditLogs.actions.${action}` as any;
    return t.has(key) ? t(key) : action;
  };

  return (
    <>
      <PageHeader
        title={t('auditLogs.title')}
        description={t('auditLogs.description')}
        icon={ScrollText}
        color="slate"
      />

      <div className="mt-6">
        <div className="mb-4 flex items-center gap-4">
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('auditLogs.filterAction')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('auditLogs.allActions')}</SelectItem>
              <SelectItem value="UPDATE_USER_ROLE">
                {t('auditLogs.actions.UPDATE_USER_ROLE')}
              </SelectItem>
              <SelectItem value="DELETE_USER">{t('auditLogs.actions.DELETE_USER')}</SelectItem>
              <SelectItem value="UPDATE_REPORT_STATUS">
                {t('auditLogs.actions.UPDATE_REPORT_STATUS')}
              </SelectItem>
              <SelectItem value="DELETE_REPORT">{t('auditLogs.actions.DELETE_REPORT')}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={resourceFilter}
            onValueChange={(v) => {
              setResourceFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('auditLogs.filterResource')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('auditLogs.allResources')}</SelectItem>
              <SelectItem value="user">{t('targetTypes.user')}</SelectItem>
              <SelectItem value="report">{t('auditLogs.resourceReport')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <ListSkeleton count={5} />
        ) : data?.data && data.data.length > 0 ? (
          <>
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('auditLogs.timestamp')}</TableHead>
                      <TableHead>{t('auditLogs.action')}</TableHead>
                      <TableHead>{t('auditLogs.resource')}</TableHead>
                      <TableHead>{t('auditLogs.resourceId')}</TableHead>
                      <TableHead>{t('auditLogs.adminId')}</TableHead>
                      <TableHead className="w-[60px]">{t('auditLogs.details')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {fmt.dateTime(new Date(log.createdAt), 'medium')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ACTION_COLORS[log.action] || ''}>
                            {getActionLabel(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{log.resource}</TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[120px]">
                          {log.resourceId || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[120px]">
                          {log.userId || '-'}
                        </TableCell>
                        <TableCell>
                          {log.metadata && Object.keys(log.metadata).length > 0 ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <Info className="h-3.5 w-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80">
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium">{t('auditLogs.metadata')}</h4>
                                  <div className="space-y-1">
                                    {Object.entries(log.metadata).map(([key, value]) => (
                                      <div key={key} className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{key}</span>
                                        <span className="font-mono text-xs">{String(value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
            <PaginationControls
              page={page}
              totalPages={data.totalPages ?? 1}
              total={data.total ?? 0}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon={<ScrollText className="h-12 w-12" />}
            title={t('auditLogs.empty')}
            description={t('auditLogs.emptyDesc')}
          />
        )}
      </div>
    </>
  );
}

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
import { Input } from '@/components/ui/input';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { MessageCircle, Info } from 'lucide-react';

interface AgentAuditLog {
  id: string;
  userId: string | null;
  sessionId: string | null;
  traceId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  operation: string;
  status: string;
  details: Record<string, unknown> | null;
  duration: number | null;
  createdAt: string;
}

const AGENT_STATUS_COLORS: Record<string, string> = {
  SUCCESS: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  FAILURE: 'bg-red-500/10 text-red-600 border-red-500/20',
  DENIED: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

const PAGE_SIZE = 50;

export function AgentAuditTab() {
  const t = useTranslations('admin');
  const fmt = useFormatter();

  const [agentPage, setAgentPage] = useState(1);
  const [agentActionFilter, setAgentActionFilter] = useState('ALL');
  const [agentStatusFilter, setAgentStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: agentData, isLoading: agentLoading } = useQuery({
    queryKey: [
      'agentAuditLogs',
      agentPage,
      agentActionFilter,
      agentStatusFilter,
      startDate,
      endDate,
    ],
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(agentPage),
        pageSize: String(PAGE_SIZE),
      };
      if (agentActionFilter !== 'ALL') params.action = agentActionFilter;
      if (agentStatusFilter !== 'ALL') params.status = agentStatusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      return apiClient.get<{
        data: AgentAuditLog[];
        total: number;
        page: number;
        pageSize: number;
      }>('/admin/ai-agent/audit-logs', { params });
    },
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={agentActionFilter}
          onValueChange={(v) => {
            setAgentActionFilter(v);
            setAgentPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('auditLogs.filterAction')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('auditLogs.allActions')}</SelectItem>
            <SelectItem value="CHAT_MESSAGE">{t('auditLogs.agentActions.CHAT_MESSAGE')}</SelectItem>
            <SelectItem value="AGENT_DELEGATE">
              {t('auditLogs.agentActions.AGENT_DELEGATE')}
            </SelectItem>
            <SelectItem value="TOOL_CALL">{t('auditLogs.agentActions.TOOL_CALL')}</SelectItem>
            <SelectItem value="MEMORY_ACCESS">
              {t('auditLogs.agentActions.MEMORY_ACCESS')}
            </SelectItem>
            <SelectItem value="SECURITY_THREAT">
              {t('auditLogs.agentActions.SECURITY_THREAT')}
            </SelectItem>
            <SelectItem value="CONFIG_UPDATE">
              {t('auditLogs.agentActions.CONFIG_UPDATE')}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={agentStatusFilter}
          onValueChange={(v) => {
            setAgentStatusFilter(v);
            setAgentPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('auditLogs.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('auditLogs.allStatus')}</SelectItem>
            <SelectItem value="SUCCESS">{t('auditLogs.agentStatuses.SUCCESS')}</SelectItem>
            <SelectItem value="FAILURE">{t('auditLogs.agentStatuses.FAILURE')}</SelectItem>
            <SelectItem value="DENIED">{t('auditLogs.agentStatuses.DENIED')}</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setAgentPage(1);
          }}
          className="w-[160px]"
          placeholder={t('auditLogs.startDate')}
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setAgentPage(1);
          }}
          className="w-[160px]"
          placeholder={t('auditLogs.endDate')}
        />
      </div>

      {agentLoading ? (
        <ListSkeleton count={5} />
      ) : agentData?.data && agentData.data.length > 0 ? (
        <>
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('auditLogs.timestamp')}</TableHead>
                    <TableHead>{t('auditLogs.action')}</TableHead>
                    <TableHead>{t('auditLogs.agentOperation')}</TableHead>
                    <TableHead>{t('auditLogs.status')}</TableHead>
                    <TableHead>{t('auditLogs.agentDuration')}</TableHead>
                    <TableHead className="w-[60px]">{t('auditLogs.details')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentData.data.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {fmt.dateTime(new Date(log.createdAt), 'medium')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.operation}
                        {log.resource && (
                          <span className="text-muted-foreground ml-1">({log.resource})</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={AGENT_STATUS_COLORS[log.status] || ''}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.duration ? `${log.duration}ms` : '-'}
                      </TableCell>
                      <TableCell>
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Info className="h-3.5 w-3.5" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium">{t('auditLogs.metadata')}</h4>
                                <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-[200px]">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
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
            page={agentPage}
            totalPages={Math.ceil((agentData.total || 0) / PAGE_SIZE)}
            total={agentData.total ?? 0}
            pageSize={PAGE_SIZE}
            onPageChange={setAgentPage}
          />
        </>
      ) : (
        <EmptyState
          icon={<MessageCircle className="h-12 w-12" />}
          title={t('auditLogs.agentEmpty')}
          description={t('auditLogs.agentEmptyDesc')}
        />
      )}
    </>
  );
}

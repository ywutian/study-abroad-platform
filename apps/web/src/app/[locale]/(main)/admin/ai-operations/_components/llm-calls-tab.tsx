/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Fragment, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { apiClient } from '@/lib/api';
import { adminAiAgentRoutes } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { Terminal, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

interface LlmCallRecord {
  id: string;
  userId: string;
  model: string;
  agentType: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  metadata: Record<string, any> | null;
  createdAt: string;
}

interface LlmCallsResponse {
  data: LlmCallRecord[];
  total: number;
  page: number;
  pageSize: number;
}

const AGENT_TYPES = ['orchestrator', 'essay', 'school', 'profile', 'timeline', 'resume'];
const MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'deepseek-chat'];

export function LlmCallsTab() {
  const t = useTranslations('admin.aiOps');
  const [page, setPage] = useState(1);
  const [agentType, setAgentType] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [userId, setUserId] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    // Keeps the rows on screen while the next page/filter loads.
    placeholderData: keepPreviousData,
    queryKey: ['llmCalls', page, agentType, model, userId],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), pageSize: '20' };
      if (agentType) params.agentType = agentType;
      if (model) params.model = model;
      if (userId.trim()) params.userId = userId.trim();
      return apiClient.get<LlmCallsResponse>(adminAiAgentRoutes.llmCalls(), { params });
    },
  });

  const rows = Array.isArray(data?.data) ? data.data : [];
  const total = typeof data?.total === 'number' ? data.total : rows.length;
  const pageSize = typeof data?.pageSize === 'number' && data.pageSize > 0 ? data.pageSize : 20;
  const currentPage = typeof data?.page === 'number' ? data.page : page;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5" />
          <CardTitle className="text-body">{t('llmCalls.title')}</CardTitle>
          {data && (
            <Badge variant="secondary" className="ml-auto">
              {total} {t('llmCalls.total')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <Select
            value={agentType}
            onValueChange={(v) => {
              setAgentType(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('llmCalls.filterAgent')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('llmCalls.allAgents')}</SelectItem>
              {AGENT_TYPES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={model}
            onValueChange={(v) => {
              setModel(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('llmCalls.filterModel')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('llmCalls.allModels')}</SelectItem>
              {MODELS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder={t('llmCalls.filterUser')}
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
            className="w-[200px]"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t('llmCalls.loading')}</p>
        ) : rows.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{t('llmCalls.time')}</TableHead>
                  <TableHead>{t('llmCalls.agent')}</TableHead>
                  <TableHead>{t('llmCalls.model')}</TableHead>
                  <TableHead className="text-right">{t('llmCalls.tokens')}</TableHead>
                  <TableHead className="text-right">{t('llmCalls.cost')}</TableHead>
                  <TableHead className="text-right">{t('llmCalls.latency')}</TableHead>
                  <TableHead>{t('llmCalls.finish')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const meta = row.metadata || {};
                  const isExpanded = expandedRow === row.id;
                  return (
                    <Fragment key={row.id}>
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.agentType || '-'}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.model}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.totalTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          ${row.cost?.toFixed(4) || '0'}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {meta.latencyMs ? `${meta.latencyMs}ms` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              meta.finishReason === 'stop'
                                ? 'success'
                                : meta.finishReason === 'length'
                                  ? 'warning'
                                  : 'secondary'
                            }
                          >
                            {meta.finishReason || '-'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${row.id}-detail`}>
                          <TableCell colSpan={8} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  {t('llmCalls.input')} ({meta.messageCount || 0} messages)
                                </p>
                                <pre className="text-xs bg-background rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-40">
                                  {meta.inputPreview || t('llmCalls.noData')}
                                </pre>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  {t('llmCalls.output')}
                                </p>
                                <pre className="text-xs bg-background rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-40">
                                  {meta.outputPreview || t('llmCalls.noData')}
                                </pre>
                              </div>
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>User: {row.userId.slice(0, 8)}...</span>
                                <span>Prompt: {row.promptTokens.toLocaleString()} tokens</span>
                                <span>
                                  Completion: {row.completionTokens.toLocaleString()} tokens
                                </span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {t('llmCalls.showing', {
                  from: (currentPage - 1) * pageSize + 1,
                  to: Math.min(currentPage * pageSize, total),
                  total,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">{t('llmCalls.empty')}</p>
        )}
      </CardContent>
    </Card>
  );
}

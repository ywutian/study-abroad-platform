'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout';
import { PaginationControls } from '../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Brain,
  Database,
  Search,
  MessageSquare,
  Network,
  Clock,
  Loader2,
  Trash2,
  Eye,
  RefreshCw,
  Play,
  Users,
} from 'lucide-react';

// ==================== Types ====================

interface GlobalMemoryStats {
  totalMemories: number;
  totalConversations: number;
  totalMessages: number;
  totalEntities: number;
  memoryByType: Record<string, number>;
  entityByType: Record<string, number>;
  recentActivity: {
    memoriesLast7Days: number;
    conversationsLast7Days: number;
    messagesLast7Days: number;
  };
  compaction: {
    totalCompactions: number;
    averageCompressionRatio: number;
  };
}

interface EnhancedMemoryStats {
  totalMemories: number;
  totalConversations: number;
  totalMessages: number;
  totalEntities: number;
  memoryByType: Record<string, number>;
  recentActivity: {
    conversationsLast7Days: number;
    messagesLast7Days: number;
  };
  decay?: {
    totalMemories: number;
    byTier: Record<string, number>;
    averageImportance: number;
    averageFreshness: number;
    scheduledForArchive: number;
    scheduledForDelete: number;
  };
  scoring?: {
    averageScore: number;
    tierDistribution: Record<string, number>;
  };
}

interface MemoryItem {
  id: string;
  userId: string;
  type: string;
  category: string | null;
  content: string;
  importance: number;
  accessCount: number;
  lastAccessedAt: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

interface ConversationItem {
  id: string;
  userId: string;
  title: string | null;
  summary: string | null;
  agentType: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface MessageItem {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  agentType?: string;
  tokensUsed?: number;
  latencyMs?: number;
  createdAt: string;
}

interface EntityItem {
  id: string;
  userId: string;
  type: string;
  name: string;
  description: string | null;
  attributes: Record<string, any> | null;
  relations: any[] | null;
  createdAt: string;
}

interface DecayConfig {
  enabled: boolean;
  decayRate: number;
  minImportance: number;
  accessBoost: number;
  maxAccessBoost: number;
  archiveThreshold: number;
  archiveAfterDays: number;
  deleteAfterDays: number;
  batchSize: number;
}

interface DecayStats {
  totalMemories: number;
  byTier: Record<string, number>;
  averageImportance: number;
  averageFreshness: number;
  scheduledForArchive: number;
  scheduledForDelete: number;
}

interface DecayResult {
  success: boolean;
  result?: {
    processed: number;
    decayed: number;
    archived: number;
    deleted: number;
    errors: number;
    durationMs: number;
  };
}

// ==================== Constants ====================

const MEMORY_TYPES = ['FACT', 'PREFERENCE', 'DECISION', 'SUMMARY', 'FEEDBACK'] as const;
const ENTITY_TYPES = ['SCHOOL', 'PERSON', 'EVENT', 'TOPIC'] as const;

const memoryTypeBadge: Record<string, string> = {
  FACT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PREFERENCE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  DECISION: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  SUMMARY: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  FEEDBACK: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const entityTypeBadge: Record<string, string> = {
  SCHOOL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PERSON: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  EVENT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  TOPIC: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

// ==================== Page ====================

export default function AdminMemoryPage() {
  const t = useTranslations('admin.memory');
  const queryClient = useQueryClient();

  // ---- Section 1: Global Stats ----
  const { data: globalStats } = useQuery({
    queryKey: ['memoryGlobalStats'],
    queryFn: () => apiClient.get<GlobalMemoryStats>('/admin/ai-agent/memory/stats'),
    refetchInterval: 30000,
  });

  // ---- Section 2: User Query ----
  const [userIdInput, setUserIdInput] = useState('');
  const [queryUserId, setQueryUserId] = useState('');
  const { data: userStats, isFetching: userStatsFetching } = useQuery({
    queryKey: ['memoryUserStats', queryUserId],
    queryFn: () =>
      apiClient.get<EnhancedMemoryStats>(`/admin/ai-agent/memory/users/${queryUserId}/stats`),
    enabled: !!queryUserId,
  });

  // ---- Section 3: Memory Browser ----
  const [memFilters, setMemFilters] = useState({
    userId: '',
    type: '',
    category: '',
    minImportance: 0,
  });
  const [memPage, setMemPage] = useState(1);
  const memPageSize = 20;
  const { data: memData } = useQuery({
    queryKey: ['memoryBrowse', memFilters, memPage],
    queryFn: () =>
      apiClient.get<{ data: MemoryItem[]; total: number }>('/admin/ai-agent/memory/browse', {
        params: {
          ...(memFilters.userId && { userId: memFilters.userId }),
          ...(memFilters.type && { type: memFilters.type }),
          ...(memFilters.category && { category: memFilters.category }),
          ...(memFilters.minImportance > 0 && { minImportance: String(memFilters.minImportance) }),
          page: String(memPage),
          pageSize: String(memPageSize),
        },
      }),
  });

  const [viewMemory, setViewMemory] = useState<MemoryItem | null>(null);
  const [deleteMemoryId, setDeleteMemoryId] = useState<string | null>(null);

  const deleteMemoryMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/ai-agent/memory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memoryBrowse'] });
      queryClient.invalidateQueries({ queryKey: ['memoryGlobalStats'] });
      toast.success(t('deleteMemory'));
      setDeleteMemoryId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // ---- Section 4: Conversations ----
  const [convUserId, setConvUserId] = useState('');
  const [convPage, setConvPage] = useState(1);
  const convPageSize = 20;
  const { data: convData } = useQuery({
    queryKey: ['memoryConversations', convUserId, convPage],
    queryFn: () =>
      apiClient.get<{ data: ConversationItem[]; total: number }>(
        '/admin/ai-agent/memory/conversations',
        {
          params: {
            ...(convUserId && { userId: convUserId }),
            page: String(convPage),
            pageSize: String(convPageSize),
          },
        }
      ),
  });

  const [viewConvId, setViewConvId] = useState<string | null>(null);
  const { data: convMessages } = useQuery({
    queryKey: ['memoryConvMessages', viewConvId],
    queryFn: () =>
      apiClient.get<MessageItem[]>(`/admin/ai-agent/memory/conversations/${viewConvId}/messages`),
    enabled: !!viewConvId,
  });

  // ---- Section 5: Entities ----
  const [entityFilters, setEntityFilters] = useState({ userId: '', type: '' });
  const [entityPage, setEntityPage] = useState(1);
  const entityPageSize = 20;
  const { data: entityData } = useQuery({
    queryKey: ['memoryEntities', entityFilters, entityPage],
    queryFn: () =>
      apiClient.get<{ data: EntityItem[]; total: number }>('/admin/ai-agent/memory/entities', {
        params: {
          ...(entityFilters.userId && { userId: entityFilters.userId }),
          ...(entityFilters.type && { type: entityFilters.type }),
          page: String(entityPage),
          pageSize: String(entityPageSize),
        },
      }),
  });

  const [viewEntity, setViewEntity] = useState<EntityItem | null>(null);

  // ---- Section 6: Decay ----
  const { data: decayConfig } = useQuery({
    queryKey: ['memoryDecayConfig'],
    queryFn: () => apiClient.get<DecayConfig>('/admin/ai-agent/memory/decay/config'),
  });

  const { data: decayStats } = useQuery({
    queryKey: ['memoryDecayStats'],
    queryFn: () => apiClient.get<DecayStats>('/admin/ai-agent/memory/decay/stats'),
  });

  const [decayForm, setDecayForm] = useState<Partial<DecayConfig>>({});
  const [showTriggerConfirm, setShowTriggerConfirm] = useState(false);
  const [decayResultData, setDecayResultData] = useState<DecayResult['result'] | null>(null);

  const updateDecayMutation = useMutation({
    mutationFn: (data: Partial<DecayConfig>) =>
      apiClient.put('/admin/ai-agent/memory/decay/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memoryDecayConfig'] });
      toast.success(t('configSaved'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const triggerDecayMutation = useMutation({
    mutationFn: () => apiClient.post<DecayResult>('/admin/ai-agent/memory/decay/trigger'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['memoryDecayStats'] });
      queryClient.invalidateQueries({ queryKey: ['memoryGlobalStats'] });
      setDecayResultData(data.result || null);
      setShowTriggerConfirm(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // ---- Helpers ----
  const formatDate = (d: string) => new Date(d).toLocaleString();
  const truncate = (s: string, len: number) => (s.length > len ? s.slice(0, len) + '...' : s);

  return (
    <>
      <PageHeader title={t('title')} description={t('desc')} icon={Brain} color="violet" />

      <div className="mt-6 space-y-6">
        {/* Section 1: Global Stats */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5" />
              <CardTitle className="text-base">{t('globalStats')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {globalStats ? (
              <div className="space-y-4">
                {/* Stat cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('totalMemories')}</p>
                    <p className="text-lg font-bold mt-1">
                      {globalStats.totalMemories.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('totalConversations')}</p>
                    <p className="text-lg font-bold mt-1">
                      {globalStats.totalConversations.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('totalMessages')}</p>
                    <p className="text-lg font-bold mt-1">
                      {globalStats.totalMessages.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('totalEntities')}</p>
                    <p className="text-lg font-bold mt-1">
                      {globalStats.totalEntities.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Type distributions */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-2">{t('typeDistribution')}</p>
                    <div className="flex flex-wrap gap-2">
                      {MEMORY_TYPES.map((type) => (
                        <Badge key={type} className={cn('text-xs', memoryTypeBadge[type])}>
                          {t(`type${type.charAt(0)}${type.slice(1).toLowerCase()}`)} (
                          {globalStats.memoryByType[type] || 0})
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-2">{t('entityDistribution')}</p>
                    <div className="flex flex-wrap gap-2">
                      {ENTITY_TYPES.map((type) => (
                        <Badge key={type} className={cn('text-xs', entityTypeBadge[type])}>
                          {t(`entity${type.charAt(0)}${type.slice(1).toLowerCase()}`)} (
                          {globalStats.entityByType[type] || 0})
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent activity */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('newMemories7d')}</p>
                    <p className="text-lg font-bold mt-1">
                      {globalStats.recentActivity.memoriesLast7Days}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('newConversations7d')}</p>
                    <p className="text-lg font-bold mt-1">
                      {globalStats.recentActivity.conversationsLast7Days}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('newMessages7d')}</p>
                    <p className="text-lg font-bold mt-1">
                      {globalStats.recentActivity.messagesLast7Days}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Section 2: User Query */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5" />
              <div>
                <CardTitle className="text-base">{t('userQuery')}</CardTitle>
                <CardDescription className="mt-1">{t('userStats')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder={t('userIdPlaceholder')}
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && userIdInput && setQueryUserId(userIdInput)}
              />
              <Button
                onClick={() => userIdInput && setQueryUserId(userIdInput)}
                disabled={!userIdInput || userStatsFetching}
              >
                {userStatsFetching && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {t('queryBtn')}
              </Button>
            </div>

            {userStats && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('totalMemories')}</p>
                    <p className="text-lg font-bold mt-1">{userStats.totalMemories}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('totalConversations')}</p>
                    <p className="text-lg font-bold mt-1">{userStats.totalConversations}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('totalMessages')}</p>
                    <p className="text-lg font-bold mt-1">{userStats.totalMessages}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('totalEntities')}</p>
                    <p className="text-lg font-bold mt-1">{userStats.totalEntities}</p>
                  </div>
                </div>

                {/* Memory by type */}
                {userStats.memoryByType && Object.keys(userStats.memoryByType).length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-2">{t('typeDistribution')}</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(userStats.memoryByType).map(([type, count]) => (
                        <Badge key={type} className={cn('text-xs', memoryTypeBadge[type])}>
                          {type} ({count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decay stats */}
                {userStats.decay && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-2">{t('tierDist')}</p>
                    <div className="space-y-2">
                      {(['SHORT', 'LONG', 'ARCHIVE'] as const).map((tier) => {
                        const count = userStats.decay?.byTier[tier] || 0;
                        const total = userStats.decay?.totalMemories || 1;
                        return (
                          <div key={tier} className="flex items-center gap-2">
                            <span className="text-xs w-16">
                              {t(`tier${tier.charAt(0)}${tier.slice(1).toLowerCase()}`)}
                            </span>
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary rounded-full h-2"
                                style={{ width: `${Math.min((count / total) * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                      <span>
                        {t('avgImportance')}: {(userStats.decay.averageImportance * 100).toFixed(0)}
                        %
                      </span>
                      <span>
                        {t('avgFreshness')}: {(userStats.decay.averageFreshness * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Scoring stats */}
                {userStats.scoring && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('avgImportance')}: {(userStats.scoring.averageScore * 100).toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Memory Browser */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5" />
              <div>
                <CardTitle className="text-base">{t('browse')}</CardTitle>
                <CardDescription className="mt-1">{t('browseDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <Input
                placeholder={t('userIdPlaceholder')}
                value={memFilters.userId}
                onChange={(e) => {
                  setMemFilters({ ...memFilters, userId: e.target.value });
                  setMemPage(1);
                }}
              />
              <Select
                value={memFilters.type}
                onValueChange={(v) => {
                  setMemFilters({ ...memFilters, type: v === 'all' ? '' : v });
                  setMemPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('typeDistribution')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {MEMORY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={t('category')}
                value={memFilters.category}
                onChange={(e) => {
                  setMemFilters({ ...memFilters, category: e.target.value });
                  setMemPage(1);
                }}
              />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t('minImportance')}</Label>
                  <span className="text-xs text-muted-foreground">
                    {(memFilters.minImportance * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[memFilters.minImportance]}
                  onValueChange={([v]) => {
                    setMemFilters({ ...memFilters, minImportance: v });
                    setMemPage(1);
                  }}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>
            </div>

            {/* Table */}
            {memData?.data && memData.data.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Type</TableHead>
                      <TableHead className="w-[80px]">{t('category')}</TableHead>
                      <TableHead>{t('content')}</TableHead>
                      <TableHead className="w-[100px]">{t('importance')}</TableHead>
                      <TableHead className="w-[60px]">{t('accessCount')}</TableHead>
                      <TableHead className="w-[140px]">Created</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memData.data.map((mem) => (
                      <TableRow key={mem.id}>
                        <TableCell>
                          <Badge className={cn('text-[10px]', memoryTypeBadge[mem.type])}>
                            {mem.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{mem.category || '-'}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {truncate(mem.content, 50)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <div className="w-12 bg-muted rounded-full h-1.5">
                              <div
                                className="bg-primary rounded-full h-1.5"
                                style={{ width: `${mem.importance * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px]">
                              {(mem.importance * 100).toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-center">{mem.accessCount}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(mem.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setViewMemory(mem)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteMemoryId(mem.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={memPage}
                  totalPages={Math.ceil((memData.total || 0) / memPageSize)}
                  total={memData.total || 0}
                  pageSize={memPageSize}
                  onPageChange={setMemPage}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No memories found</p>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Conversations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5" />
              <div>
                <CardTitle className="text-base">{t('conversations')}</CardTitle>
                <CardDescription className="mt-1">{t('conversationsDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder={t('userIdPlaceholder')}
                value={convUserId}
                onChange={(e) => {
                  setConvUserId(e.target.value);
                  setConvPage(1);
                }}
              />
            </div>

            {convData?.data && convData.data.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">ID</TableHead>
                      <TableHead className="w-[100px]">User</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead className="w-[80px]">Agent</TableHead>
                      <TableHead className="w-[60px]">Msgs</TableHead>
                      <TableHead className="w-[140px]">Created</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convData.data.map((conv) => (
                      <TableRow key={conv.id}>
                        <TableCell className="font-mono text-[10px] truncate max-w-[100px]">
                          {conv.id}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] truncate max-w-[100px]">
                          {conv.userId}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[150px]">
                          {conv.title || '-'}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[150px]">
                          {conv.summary ? truncate(conv.summary, 40) : '-'}
                        </TableCell>
                        <TableCell>
                          {conv.agentType ? (
                            <Badge variant="outline" className="text-[10px]">
                              {conv.agentType}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-center">{conv.messageCount}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(conv.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewConvId(conv.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={convPage}
                  totalPages={Math.ceil((convData.total || 0) / convPageSize)}
                  total={convData.total || 0}
                  pageSize={convPageSize}
                  onPageChange={setConvPage}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No conversations found
              </p>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Entities */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Network className="h-5 w-5" />
              <div>
                <CardTitle className="text-base">{t('entities')}</CardTitle>
                <CardDescription className="mt-1">{t('entitiesDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <Input
                placeholder={t('userIdPlaceholder')}
                value={entityFilters.userId}
                onChange={(e) => {
                  setEntityFilters({ ...entityFilters, userId: e.target.value });
                  setEntityPage(1);
                }}
              />
              <Select
                value={entityFilters.type}
                onValueChange={(v) => {
                  setEntityFilters({ ...entityFilters, type: v === 'all' ? '' : v });
                  setEntityPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('entityDistribution')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {entityData?.data && entityData.data.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Type</TableHead>
                      <TableHead>{t('entityName')}</TableHead>
                      <TableHead>{t('entityDesc')}</TableHead>
                      <TableHead className="w-[80px]">{t('entityRelations')}</TableHead>
                      <TableHead className="w-[140px]">Created</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entityData.data.map((entity) => (
                      <TableRow key={entity.id}>
                        <TableCell>
                          <Badge className={cn('text-[10px]', entityTypeBadge[entity.type])}>
                            {entity.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{entity.name}</TableCell>
                        <TableCell className="text-xs truncate max-w-[200px]">
                          {entity.description || '-'}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {entity.relations ? (entity.relations as any[]).length : 0}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(entity.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewEntity(entity)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={entityPage}
                  totalPages={Math.ceil((entityData.total || 0) / entityPageSize)}
                  total={entityData.total || 0}
                  pageSize={entityPageSize}
                  onPageChange={setEntityPage}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No entities found</p>
            )}
          </CardContent>
        </Card>

        {/* Section 6: Decay Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5" />
              <div>
                <CardTitle className="text-base">{t('decay')}</CardTitle>
                <CardDescription className="mt-1">{t('decayDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Decay config form */}
              {decayConfig && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{t('decayEnabled')}</Label>
                    <Switch
                      checked={decayForm.enabled ?? decayConfig.enabled}
                      onCheckedChange={(v) => setDecayForm({ ...decayForm, enabled: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t('decayRate')}</Label>
                      <span className="text-xs text-muted-foreground">
                        {((decayForm.decayRate ?? decayConfig.decayRate) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Slider
                      value={[decayForm.decayRate ?? decayConfig.decayRate]}
                      onValueChange={([v]) => setDecayForm({ ...decayForm, decayRate: v })}
                      min={0}
                      max={0.1}
                      step={0.001}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t('minImportanceThreshold')}</Label>
                      <span className="text-xs text-muted-foreground">
                        {((decayForm.minImportance ?? decayConfig.minImportance) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={[decayForm.minImportance ?? decayConfig.minImportance]}
                      onValueChange={([v]) => setDecayForm({ ...decayForm, minImportance: v })}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t('accessBoostRate')}</Label>
                      <span className="text-xs text-muted-foreground">
                        {((decayForm.accessBoost ?? decayConfig.accessBoost) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={[decayForm.accessBoost ?? decayConfig.accessBoost]}
                      onValueChange={([v]) => setDecayForm({ ...decayForm, accessBoost: v })}
                      min={0}
                      max={0.5}
                      step={0.01}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t('archiveThreshold')}</Label>
                      <span className="text-xs text-muted-foreground">
                        {(
                          (decayForm.archiveThreshold ?? decayConfig.archiveThreshold) * 100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                    <Slider
                      value={[decayForm.archiveThreshold ?? decayConfig.archiveThreshold]}
                      onValueChange={([v]) => setDecayForm({ ...decayForm, archiveThreshold: v })}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('archiveAfterDays')}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={decayForm.archiveAfterDays ?? decayConfig.archiveAfterDays}
                        onChange={(e) =>
                          setDecayForm({ ...decayForm, archiveAfterDays: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('deleteAfterDays')}</Label>
                      <Input
                        type="number"
                        min={30}
                        max={3650}
                        value={decayForm.deleteAfterDays ?? decayConfig.deleteAfterDays}
                        onChange={(e) =>
                          setDecayForm({ ...decayForm, deleteAfterDays: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      const data: any = {};
                      for (const [key, val] of Object.entries(decayForm)) {
                        if (val !== undefined && val !== (decayConfig as any)[key]) data[key] = val;
                      }
                      if (Object.keys(data).length > 0) updateDecayMutation.mutate(data);
                    }}
                    disabled={updateDecayMutation.isPending}
                    size="sm"
                  >
                    {updateDecayMutation.isPending && (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    )}
                    {t('saveConfig')}
                  </Button>
                </div>
              )}

              {/* Decay stats + trigger */}
              <div className="space-y-4">
                {decayStats && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <p className="text-sm font-medium">{t('decayStats')}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('totalMemories')}</p>
                        <p className="text-lg font-bold">{decayStats.totalMemories}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('scheduledArchive')}</p>
                        <p className="text-lg font-bold">{decayStats.scheduledForArchive}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('avgImportance')}</p>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2"
                          style={{ width: `${decayStats.averageImportance * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {(decayStats.averageImportance * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('avgFreshness')}</p>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-emerald-500 rounded-full h-2"
                          style={{ width: `${decayStats.averageFreshness * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {(decayStats.averageFreshness * 100).toFixed(0)}%
                      </span>
                    </div>
                    {/* Tier distribution */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('tierDist')}</p>
                      {(['SHORT', 'LONG', 'ARCHIVE'] as const).map((tier) => {
                        const count = decayStats.byTier[tier] || 0;
                        const total = decayStats.totalMemories || 1;
                        return (
                          <div key={tier} className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] w-14">
                              {t(`tier${tier.charAt(0)}${tier.slice(1).toLowerCase()}`)}
                            </span>
                            <div className="flex-1 bg-muted rounded-full h-1.5">
                              <div
                                className="bg-primary rounded-full h-1.5"
                                style={{ width: `${(count / total) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] w-6 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Trigger decay */}
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium mb-2">{t('triggerDecay')}</p>
                  <Button
                    variant="outline"
                    onClick={() => setShowTriggerConfirm(true)}
                    disabled={triggerDecayMutation.isPending}
                  >
                    {triggerDecayMutation.isPending ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-3 w-3" />
                    )}
                    {t('triggerDecay')}
                  </Button>

                  {decayResultData && (
                    <div className="mt-3 rounded-lg bg-muted p-3 text-xs space-y-1">
                      <p className="font-medium">{t('decayResult')}</p>
                      <p>
                        {t('decayProcessed')}: {decayResultData.processed}
                      </p>
                      <p>
                        {t('decayDecayed')}: {decayResultData.decayed}
                      </p>
                      <p>
                        {t('decayArchived')}: {decayResultData.archived}
                      </p>
                      <p>
                        {t('decayDeleted')}: {decayResultData.deleted}
                      </p>
                      <p>
                        {t('decayErrors')}: {decayResultData.errors}
                      </p>
                      <p>
                        {t('decayDuration')}: {decayResultData.durationMs}ms
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ==================== Dialogs ==================== */}

      {/* Memory Detail Dialog */}
      <Dialog open={!!viewMemory} onOpenChange={(open) => !open && setViewMemory(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('viewDetail')}</DialogTitle>
            <DialogDescription>
              {viewMemory?.type} | {viewMemory?.category || '-'}
            </DialogDescription>
          </DialogHeader>
          {viewMemory && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">ID</Label>
                <p className="text-xs font-mono break-all">{viewMemory.id}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">User ID</Label>
                <p className="text-xs font-mono break-all">{viewMemory.userId}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t('content')}</Label>
                <p className="text-sm whitespace-pre-wrap">{viewMemory.content}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">{t('importance')}</Label>
                  <p className="text-sm">{(viewMemory.importance * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('accessCount')}</Label>
                  <p className="text-sm">{viewMemory.accessCount}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p className="text-sm">{formatDate(viewMemory.createdAt)}</p>
                </div>
              </div>
              {viewMemory.metadata && Object.keys(viewMemory.metadata).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Metadata</Label>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(viewMemory.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conversation Messages Dialog */}
      <Dialog open={!!viewConvId} onOpenChange={(open) => !open && setViewConvId(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('viewMessages')}</DialogTitle>
            <DialogDescription>{viewConvId}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {convMessages && Array.isArray(convMessages) ? (
              convMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'rounded-lg p-3 text-sm',
                    msg.role === 'user' && 'bg-blue-50 dark:bg-blue-900/20 ml-8',
                    msg.role === 'assistant' && 'bg-muted mr-8',
                    msg.role === 'tool' &&
                      'bg-amber-50 dark:bg-amber-900/20 mr-8 border-l-2 border-amber-400',
                    msg.role === 'system' && 'bg-slate-50 dark:bg-slate-900/20 text-xs italic'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {msg.role}
                    </Badge>
                    {msg.agentType && (
                      <Badge variant="secondary" className="text-[10px]">
                        {msg.agentType}
                      </Badge>
                    )}
                    {msg.tokensUsed && (
                      <span className="text-[10px] text-muted-foreground">
                        {msg.tokensUsed} tokens
                      </span>
                    )}
                    {msg.latencyMs && (
                      <span className="text-[10px] text-muted-foreground">{msg.latencyMs}ms</span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-xs">{truncate(msg.content, 500)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDate(msg.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Entity Detail Dialog */}
      <Dialog open={!!viewEntity} onOpenChange={(open) => !open && setViewEntity(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewEntity?.name}</DialogTitle>
            <DialogDescription>{viewEntity?.type}</DialogDescription>
          </DialogHeader>
          {viewEntity && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">{t('entityDesc')}</Label>
                <p className="text-sm">{viewEntity.description || '-'}</p>
              </div>
              {viewEntity.attributes && Object.keys(viewEntity.attributes).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t('entityAttrs')}</Label>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(viewEntity.attributes, null, 2)}
                  </pre>
                </div>
              )}
              {viewEntity.relations && (viewEntity.relations as any[]).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t('entityRelations')}</Label>
                  <div className="space-y-1 mt-1">
                    {(viewEntity.relations as any[]).map((rel, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {rel.type}
                        </Badge>
                        <span>{rel.targetName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Memory Confirm */}
      <AlertDialog
        open={!!deleteMemoryId}
        onOpenChange={(open) => !open && setDeleteMemoryId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteMemory')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMemoryId && deleteMemoryMutation.mutate(deleteMemoryId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMemoryMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trigger Decay Confirm */}
      <AlertDialog open={showTriggerConfirm} onOpenChange={setShowTriggerConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('triggerDecay')}</AlertDialogTitle>
            <AlertDialogDescription>{t('triggerDecayConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => triggerDecayMutation.mutate()}>
              {triggerDecayMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

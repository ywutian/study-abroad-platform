'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Locale } from 'date-fns';
import { enUS, zhCN } from 'date-fns/locale';
import {
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CircleAlert,
  Clock3,
  Compass,
  FileText,
  MessageSquarePlus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRoundCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AgentType } from '@study-abroad/shared';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { AgentChat } from './agent-chat';
import type { AgentActionPayload, ConversationSummary } from './types';
import { AGENT_INFO } from './types';
import { useConversationList, useDeleteConversation } from './use-chat-history';
import { useAgentStatus } from './use-agent-status';

interface AgentWorkspaceProps {
  className?: string;
}

const WORKSPACE_ACTIONS = [
  {
    id: 'analysisFollowup',
    icon: BarChart3,
    agentHint: AgentType.PROFILE,
    href: '/uncommon-app',
  },
  {
    id: 'schoolShortlist',
    icon: Compass,
    agentHint: AgentType.SCHOOL,
    href: '/schools',
  },
  {
    id: 'essayReview',
    icon: FileText,
    agentHint: AgentType.ESSAY,
    href: '/essays',
  },
  {
    id: 'deadlinePlan',
    icon: CalendarClock,
    agentHint: AgentType.TIMELINE,
    href: '/timeline',
  },
  {
    id: 'resumeReview',
    icon: BookOpenCheck,
    agentHint: AgentType.RESUME,
    href: '/resume',
  },
] as const;

const HEALTHY_STATUS = new Set(['healthy', 'ok', 'ready']);

export function AgentWorkspace({ className }: AgentWorkspaceProps) {
  const t = useTranslations('agentChat');
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [resetSignal, setResetSignal] = useState(0);
  const [pendingAction, setPendingAction] = useState<AgentActionPayload | null>(null);

  const startNewConversation = () => {
    setSelectedConversationId(undefined);
    setPendingAction(null);
    setResetSignal((value) => value + 1);
  };

  const sendWorkspaceAction = (action: (typeof WORKSPACE_ACTIONS)[number]) => {
    setPendingAction({
      message: t(`workspace.actions.${action.id}.message`),
      agentHint: action.agentHint,
    });
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
      <section className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-[var(--theme-radius-badge)]">
              {t('workspace.kicker')}
            </Badge>
            <span className="text-xs text-muted-foreground">{t('workspace.boundary')}</span>
          </div>
          <h1 className="text-title tracking-tight">{t('workspace.title')}</h1>
          <p className="mt-2 max-w-3xl text-body-sm leading-6 text-muted-foreground">
            {t('workspace.description')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/uncommon-app">
              <UserRoundCheck className="h-4 w-4" />
              {t('workspace.openAnalysisCenter')}
            </Link>
          </Button>
          <Button size="sm" className="gap-2" onClick={startNewConversation}>
            <MessageSquarePlus className="h-4 w-4" />
            {t('newConversation')}
          </Button>
        </div>
      </section>

      <section className="grid min-w-0 min-h-0 flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <ConversationRail
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          onNewConversation={startNewConversation}
        />

        <Card className="min-h-[640px] gap-0 overflow-hidden py-0 xl:min-h-0">
          <AgentChat
            conversationId={selectedConversationId}
            resetSignal={resetSignal}
            layoutMode="workspace"
            showHeader={true}
            showQuickActions={true}
            pendingAction={pendingAction}
            onPendingActionConsumed={() => setPendingAction(null)}
            onConversationChange={setSelectedConversationId}
            className="h-[min(760px,calc(100dvh-14rem))] min-h-[640px] xl:h-full xl:min-h-0"
          />
        </Card>

        <div className="grid min-h-0 gap-4 md:grid-cols-2 xl:grid-cols-1">
          <TaskPanel onRunAction={sendWorkspaceAction} />
          <AgentStatusPanel />
        </div>
      </section>
    </div>
  );
}

function ConversationRail({
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
}: {
  selectedConversationId?: string;
  onSelectConversation: (conversationId: string | undefined) => void;
  onNewConversation: () => void;
}) {
  const t = useTranslations('agentChat');
  const locale = useLocale();
  const dateLocale = locale === 'zh' ? zhCN : enUS;
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
  const { data: conversations, isLoading } = useConversationList();
  const deleteConversation = useDeleteConversation();

  const filteredConversations = useMemo(() => {
    const items = conversations ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) =>
      `${item.title ?? ''} ${item.summary ?? ''}`.toLowerCase().includes(normalizedQuery)
    );
  }, [conversations, query]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteConversation.mutateAsync(deleteTarget.id);
    if (selectedConversationId === deleteTarget.id) {
      onNewConversation();
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <Card className="min-h-[300px] gap-0 py-0 xl:min-h-0">
        <CardHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">{t('workspace.conversations.title')}</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNewConversation}>
              <MessageSquarePlus className="h-4 w-4" />
              <span className="sr-only">{t('newConversation')}</span>
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchConversations')}
              className="h-9 pl-8 text-sm"
            />
          </div>
        </CardHeader>
        <ScrollArea className="h-[320px] xl:h-full">
          <div className="space-y-1 p-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-md bg-muted/50" />
              ))
            ) : filteredConversations.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                {query.trim() ? t('noSearchResults') : t('noConversationsDesc')}
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <ConversationRailItem
                  key={conversation.id}
                  conversation={conversation}
                  selected={selectedConversationId === conversation.id}
                  dateLocale={dateLocale}
                  onSelect={() => onSelectConversation(conversation.id)}
                  onDelete={() => setDeleteTarget(conversation)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConversation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ConversationRailItem({
  conversation,
  selected,
  dateLocale,
  onSelect,
  onDelete,
}: {
  conversation: ConversationSummary;
  selected: boolean;
  dateLocale: Locale;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('agentChat');
  const locale = useLocale();
  const agentInfo = conversation.agentType ? AGENT_INFO[conversation.agentType] : null;
  const AgentIcon = agentInfo?.icon ?? Sparkles;
  const title =
    conversation.title ||
    conversation.summary?.slice(0, 52) ||
    `${t('newConversation')} #${conversation.id.slice(-6)}`;
  const updatedAt = safeRelativeTime(conversation.updatedAt, dateLocale);
  const agentName = agentInfo
    ? locale === 'zh'
      ? agentInfo.nameZh
      : agentInfo.name
    : t('assistant');

  return (
    <div
      className={cn(
        'group grid min-w-0 grid-cols-[1fr_auto] gap-2 rounded-md border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-primary/35 bg-primary/10'
          : 'border-transparent hover:border-border hover:bg-muted/40'
      )}
    >
      <button type="button" className="min-w-0 text-left" onClick={onSelect}>
        <div className="flex min-w-0 items-center gap-2">
          <AgentIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{agentName}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{updatedAt}</span>
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-100 text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">{t('deleteConversation')}</span>
      </Button>
    </div>
  );
}

function TaskPanel({
  onRunAction,
}: {
  onRunAction: (action: (typeof WORKSPACE_ACTIONS)[number]) => void;
}) {
  const t = useTranslations('agentChat');

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="text-sm">{t('workspace.tasks.title')}</CardTitle>
        <p className="text-xs leading-5 text-muted-foreground">{t('workspace.tasks.desc')}</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {WORKSPACE_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <div key={action.id} className="rounded-[var(--theme-radius-card)] border p-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--theme-radius-button)] bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">
                    {t(`workspace.actions.${action.id}.title`)}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t(`workspace.actions.${action.id}.desc`)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" className="h-8 gap-2" onClick={() => onRunAction(action)}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('workspace.actions.askAI')}
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link href={action.href}>{t('workspace.actions.openTool')}</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AgentStatusPanel() {
  const t = useTranslations('agentChat');
  const { health, usage, rateLimit, refreshContext } = useAgentStatus();
  const status = health.data?.status ?? (health.isError ? 'degraded' : undefined);
  const isHealthy = status ? HEALTHY_STATUS.has(status) || health.data?.llm?.isHealthy : false;
  const todayTokens = usage.data?.today?.tokens ?? 0;
  const dailyQuota = usage.data?.quota?.dailyTokens ?? 0;
  const dailyRemaining = usage.data?.remaining?.dailyTokens ?? 0;
  const tokenPercent =
    dailyQuota > 0 ? Math.min(100, Math.round((todayTokens / dailyQuota) * 100)) : 0;
  const conversationLimit = rateLimit.data?.conversation;
  const requestLimit = conversationLimit?.limit ?? conversationLimit?.maxRequests ?? 0;
  const requestRemaining = conversationLimit?.remaining ?? 0;
  const requestPercent =
    requestLimit > 0
      ? Math.max(0, Math.min(100, Math.round((requestRemaining / requestLimit) * 100)))
      : 0;

  const handleRefreshContext = async () => {
    try {
      await refreshContext.mutateAsync();
      toast.success(t('workspace.status.contextRefreshSuccess'));
    } catch {
      toast.error(t('workspace.status.contextRefreshError'));
    }
  };

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm">{t('workspace.status.title')}</CardTitle>
          <Badge
            variant={isHealthy ? 'secondary' : 'destructive'}
            className="rounded-[var(--theme-radius-badge)]"
          >
            {isHealthy ? t('workspace.status.ready') : t('workspace.status.degraded')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          <StatusMetric
            icon={ShieldCheck}
            label={t('workspace.status.model')}
            value={health.data?.llm?.model ?? t('workspace.status.unknown')}
          />
          <StatusMetric
            icon={Clock3}
            label={t('workspace.status.rateLimit')}
            value={
              requestLimit ? `${requestRemaining}/${requestLimit}` : t('workspace.status.unknown')
            }
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{t('workspace.status.dailyTokens')}</span>
            <span className="font-medium tabular-nums">
              {dailyQuota
                ? `${dailyRemaining.toLocaleString()} / ${dailyQuota.toLocaleString()}`
                : t('workspace.status.unknown')}
            </span>
          </div>
          <Progress value={tokenPercent} className="h-1.5" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">
              {t('workspace.status.conversationWindow')}
            </span>
            <span className="font-medium tabular-nums">
              {requestLimit ? `${requestPercent}%` : t('workspace.status.unknown')}
            </span>
          </div>
          <Progress value={requestPercent} className="h-1.5" />
        </div>

        <Separator />

        <div className="rounded-[var(--theme-radius-card)] border border-warning/25 bg-warning/10 p-3">
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs leading-5 text-muted-foreground">
              {t('workspace.status.boundary')}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => {
            void handleRefreshContext();
          }}
          disabled={refreshContext.isPending}
        >
          {refreshContext.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t('workspace.status.refreshContext')}
        </Button>
      </CardContent>
    </Card>
  );
}

function StatusMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function safeRelativeTime(value: string, locale: Locale) {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale });
  } catch {
    return '';
  }
}

'use client';

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { tierConfig } from './constants';
import type { TFunction } from './types';
import type {
  ApplicationWorkspaceModel,
  HealthCheck,
  ReadinessSignal,
  SchoolApplicationRow,
  WorkspaceAction,
} from './application-workspace-model';
import {
  actionFromNextStep,
  badgeVariant,
  deadlineLabel,
  deadlineShortLabel,
  healthDescription,
  StatusChip,
  statusBg,
  statusBorder,
  statusText,
  WorkspaceActionButton,
} from './workspace-shared';

export function ApplicationNextActionBar({
  t,
  workspace,
  isLoading,
  isBusy,
  onAction,
}: {
  t: TFunction;
  workspace: ApplicationWorkspaceModel;
  isLoading: boolean;
  isBusy: boolean;
  onAction: (action: WorkspaceAction) => void;
}) {
  if (isLoading) {
    return <Skeleton className="h-24 rounded-[var(--theme-radius-card)]" />;
  }

  return (
    <Card className="border-primary/25 bg-[color:var(--theme-card-bg)]">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--theme-radius-button)] border bg-muted">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {t(`workspace.nextAction.${workspace.nextAction.id}.title`)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t(`workspace.nextAction.${workspace.nextAction.id}.description`, {
                profileScore: workspace.profileScore,
                schoolCount: workspace.schoolCount,
                safetyCount: workspace.tierCounts.safety,
                missingTimelineCount: workspace.missingTimelineCount,
                missingEssayCount: workspace.missingEssayCount,
                dueSoonCount: workspace.dueSoonCount,
                overdueCount: workspace.overdueCount,
              })}
            </p>
          </div>
        </div>
        <WorkspaceActionButton
          t={t}
          action={workspace.nextAction}
          onAction={onAction}
          isBusy={isBusy}
          size="sm"
        />
      </CardContent>
    </Card>
  );
}

export function ApplicationReadinessStrip({
  t,
  signals,
  isLoading,
}: {
  t: TFunction;
  signals: ReadinessSignal[];
  isLoading: boolean;
}) {
  const icons = {
    profile: UserRound,
    schools: GraduationCap,
    essays: FileText,
    deadlines: CalendarClock,
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {signals.map((signal) => {
        const Icon = icons[signal.id];
        return (
          <Card key={signal.id} className={cn(statusBorder(signal.status))}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--theme-radius-button)] bg-muted">
                  <Icon className={cn('h-4 w-4', statusText(signal.status))} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {t(`workspace.readiness.${signal.id}`)}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {t(`workspace.readinessHint.${signal.id}`)}
                  </p>
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <span className="text-xl font-semibold">{signal.value}</span>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function ApplicationSchoolBoard({
  t,
  workspace,
  isLoading,
  isSyncing,
  onAction,
  onDelete,
}: {
  t: TFunction;
  workspace: ApplicationWorkspaceModel;
  isLoading: boolean;
  isSyncing: boolean;
  onAction: (action: WorkspaceAction) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card role="region" aria-label={t('workspace.schoolBoard.title')}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              {t('workspace.schoolBoard.title')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t('workspace.schoolBoard.description')}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/schools">
              <Plus className="h-4 w-4" />
              {t('addSchool')}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-28 rounded-[var(--theme-radius-card)]" />
            ))}
          </div>
        ) : workspace.schoolApplications.length === 0 ? (
          <ApplicationEmptyState t={t} />
        ) : (
          <div className="space-y-3">
            {workspace.schoolApplications.map((row) => (
              <ApplicationSchoolRow
                key={row.id}
                t={t}
                row={row}
                isSyncing={isSyncing}
                onAction={onAction}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationSchoolRow({
  t,
  row,
  isSyncing,
  onAction,
  onDelete,
}: {
  t: TFunction;
  row: SchoolApplicationRow;
  isSyncing: boolean;
  onAction: (action: WorkspaceAction) => void;
  onDelete: (id: string) => void;
}) {
  const tier = tierConfig[row.tier];
  const TierIcon = tier.icon;
  const action = actionFromNextStep(row.nextStep);

  return (
    <div className="rounded-[var(--theme-radius-card)] border bg-background p-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold">{row.schoolName}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className={cn('gap-1', tier.badgeClass)}>
                  <TierIcon className="h-3 w-3" />
                  {t(`tier.${row.tier.toLowerCase()}`)}
                </Badge>
                {row.tierIsOverridden && row.predictedTier && (
                  <Badge variant="outline" className="gap-1 text-2xs">
                    {t('workspace.schoolBoard.predictedHint', {
                      tier: t(`tier.${row.predictedTier.toLowerCase()}`),
                    })}
                  </Badge>
                )}
                <span>{row.round}</span>
                <span>{deadlineLabel(t, row)}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(row.id)}
              aria-label={t('workspace.schoolBoard.removeSchool', { school: row.schoolName })}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <StatusChip
              icon={ClipboardCheck}
              label={t('workspace.schoolBoard.materials')}
              value={
                row.hasTimeline
                  ? t('workspace.schoolBoard.tasksRemaining', { count: row.tasksRemaining })
                  : t('workspace.schoolBoard.needTimeline')
              }
              status={row.hasTimeline ? 'good' : 'warning'}
            />
            <StatusChip
              icon={FileText}
              label={t('workspace.schoolBoard.essays')}
              value={
                row.essayPromptCount > 0
                  ? t('workspace.schoolBoard.essayCount', { count: row.essayPromptCount })
                  : t('workspace.schoolBoard.noEssayData')
              }
              status={row.essayPromptCount > 0 ? 'good' : 'warning'}
            />
            <StatusChip
              icon={BarChart3}
              label={t('workspace.schoolBoard.estimate')}
              value={
                row.predictionProbability === null
                  ? t('workspace.schoolBoard.noEstimate')
                  : t(`tier.${row.tier.toLowerCase()}`)
              }
              status={row.predictionProbability === null ? 'warning' : 'good'}
            />
            <StatusChip
              icon={CalendarClock}
              label={t('workspace.schoolBoard.deadline')}
              value={deadlineShortLabel(t, row)}
              status={
                row.urgency === 'overdue' ? 'risk' : row.urgency === 'due7' ? 'warning' : 'good'
              }
            />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-[var(--theme-radius-card)] border bg-muted/20 p-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {t('workspace.schoolBoard.nextStepLabel')}
            </p>
            <p className="mt-1 text-sm font-medium">
              {t(`workspace.schoolBoard.nextStep.${row.nextStep}`)}
            </p>
          </div>
          <WorkspaceActionButton
            t={t}
            action={action}
            onAction={onAction}
            isBusy={isSyncing && action.intent === 'sync'}
            size="sm"
            className="w-full"
            labelKey={`workspace.schoolBoard.nextStepAction.${row.nextStep}`}
          />
        </div>
      </div>
    </div>
  );
}

function ApplicationEmptyState({ t }: { t: TFunction }) {
  const steps = [
    {
      id: 'add-schools',
      action: { id: 'add-schools', href: '/schools', intent: 'navigate' } satisfies WorkspaceAction,
    },
    {
      id: 'complete-profile',
      action: {
        id: 'complete-profile',
        href: '/profile',
        intent: 'navigate',
      } satisfies WorkspaceAction,
    },
  ];

  return (
    <div className="rounded-[var(--theme-radius-card)] border border-dashed p-6">
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map(({ id, action }) => (
          <div key={id} className="rounded-[var(--theme-radius-card)] border bg-muted/20 p-4">
            <p className="text-sm font-semibold">{t(`workspace.empty.${id}.title`)}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t(`workspace.empty.${id}.description`)}
            </p>
            <WorkspaceActionButton
              t={t}
              action={action}
              onAction={() => undefined}
              isBusy={false}
              size="sm"
              className="mt-4"
            />
          </div>
        ))}
        <div className="rounded-[var(--theme-radius-card)] border bg-muted/20 p-4">
          <p className="text-sm font-semibold">{t('workspace.empty.sync-requirements.title')}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t('workspace.empty.sync-requirements.description')}
          </p>
          <Button className="mt-4" size="sm" variant="outline" disabled>
            <ArrowRight className="h-4 w-4" />
            {t('workspace.actions.sync-requirements')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ApplicationHealthPanel({
  t,
  checks,
  isLoading,
  isSyncing,
  onAction,
}: {
  t: TFunction;
  checks: HealthCheck[];
  isLoading: boolean;
  isSyncing: boolean;
  onAction: (action: WorkspaceAction) => void;
}) {
  return (
    <Card
      role="region"
      aria-label={t('workspace.health.title')}
      className="h-fit xl:sticky xl:top-24"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {t('workspace.health.title')}
        </CardTitle>
        <CardDescription>{t('workspace.health.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading
          ? [0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-24 rounded-[var(--theme-radius-card)]" />
            ))
          : checks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  'rounded-[var(--theme-radius-card)] border p-3',
                  statusBg(check.status)
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {t(`workspace.health.${check.id}.title`)}
                    </p>
                    <Badge className="mt-2" variant={badgeVariant(check.status)}>
                      {t(`workspace.healthStatus.${check.status}`)}
                    </Badge>
                  </div>
                  {check.status === 'good' ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className={cn('mt-0.5 h-5 w-5', statusText(check.status))} />
                  )}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {healthDescription(t, check)}
                </p>
                {check.status !== 'good' ? (
                  <WorkspaceActionButton
                    t={t}
                    action={check.action}
                    onAction={onAction}
                    isBusy={isSyncing && check.action.intent === 'sync'}
                    size="sm"
                    variant="outline"
                    className="mt-3"
                  />
                ) : null}
              </div>
            ))}
      </CardContent>
    </Card>
  );
}

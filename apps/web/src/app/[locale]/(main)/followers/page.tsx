'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PaginatedResponse,
  RecommendedSocialUser,
  SocialBulkAction,
  SocialBulkResponse,
  SocialOverview,
  SocialRelationItem,
  SocialRelationSort,
  SocialRelationType,
  SocialRelationshipFilter,
  SocialRoleFilter,
  SocialUser,
} from '@study-abroad/shared';
import { chatRoutes } from '@study-abroad/shared';
import {
  AlertTriangle,
  ArrowUpDown,
  BadgeCheck,
  Ban,
  Eye,
  Heart,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
  Star,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { useDebounce } from '@/hooks/useDebounce';
import { UI_TIMERS } from '@/lib/constants';
import { qk, cachePolicy } from '@/lib/query';
import { useAuthReady } from '@/hooks/use-auth-gated-query';
import { useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/layout';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UserProfilePreview } from '@/components/features';
import {
  canStartConversation,
  getAvailableBulkActions,
  getSocialAvatarInitial,
  getSocialDisplayName,
  SOCIAL_RELATION_PAGE_SIZE,
  toggleSelectedId,
} from './_components/social-workbench-model';

type PendingAction = {
  action: SocialBulkAction;
  userIds: string[];
  title: string;
  description: string;
  destructive?: boolean;
};

const TAB_ICONS = {
  followers: Users,
  following: Heart,
  blocked: Shield,
} satisfies Record<SocialRelationType, typeof Users>;

export default function FollowersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const authReady = useAuthReady();
  const [activeTab, setActiveTab] = useState<SocialRelationType>('followers');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SocialRelationSort>('recent');
  const [relationship, setRelationship] = useState<SocialRelationshipFilter>('all');
  const [role, setRole] = useState<SocialRoleFilter>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewUser, setPreviewUser] = useState<
    (SocialUser & { isFollowing?: boolean; isFollowedBy?: boolean }) | null
  >(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [activeTab, searchQuery, sort, relationship, role]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page]);

  useEffect(() => {
    if (activeTab === 'blocked' && relationship !== 'all') {
      setRelationship('all');
    }
  }, [activeTab, relationship]);

  // Debounce search so typing fires one request after a pause, not per keystroke.
  // The page-reset effect above still keys off raw `searchQuery` (resetting to page 1
  // as you type is correct), but the network query uses the debounced value.
  const debouncedSearch = useDebounce(searchQuery, UI_TIMERS.SEARCH_DEBOUNCE);

  const overviewQuery = useQuery({
    queryKey: qk.social.overview(),
    queryFn: () => apiClient.get<SocialOverview>(chatRoutes.socialOverview()),
    enabled: authReady,
  });

  const relationsQuery = useQuery({
    queryKey: qk.social.relations({
      type: activeTab,
      page,
      search: debouncedSearch || undefined,
      sort,
      relationship: activeTab === 'blocked' ? 'all' : relationship,
      role,
    }),
    queryFn: () =>
      apiClient.get<PaginatedResponse<SocialRelationItem>>(chatRoutes.socialRelations(), {
        params: {
          type: activeTab,
          page,
          pageSize: SOCIAL_RELATION_PAGE_SIZE,
          search: debouncedSearch || undefined,
          sort,
          relationship: activeTab === 'blocked' ? 'all' : relationship,
          role,
        },
      }),
    enabled: authReady,
    placeholderData: keepPreviousData,
    ...cachePolicy.standard,
  });

  const bulkMutation = useMutation({
    mutationFn: (input: { action: SocialBulkAction; userIds: string[] }) =>
      apiClient.post<SocialBulkResponse>(chatRoutes.socialBulk(), input),
    onSuccess: (result) => {
      const successCount = result.results.filter((item) => item.success).length;
      const failedCount = result.results.length - successCount;
      if (failedCount > 0) {
        toast.warning(t('followers.bulk.partial', { success: successCount, failed: failedCount }));
      } else {
        toast.success(t(`followers.bulk.toast.${result.action}`));
      }
      setSelectedIds([]);
      setPendingAction(null);
      // @cache-invalidation-allowed: invalidateSocialQueries() helper invalidates the social overview/relations/followers/following/blocked queries
      invalidateSocialQueries(queryClient);
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof ApiError ? error.displayMessage : t('followers.toast.actionError')
      );
    },
  });

  const counts = overviewQuery.data?.counts ?? {
    followers: 0,
    following: 0,
    mutual: 0,
    blocked: 0,
  };
  const relations = useMemo(() => relationsQuery.data?.items ?? [], [relationsQuery.data?.items]);
  const totalPages = relationsQuery.data?.totalPages ?? 0;
  const selectedCount = selectedIds.length;
  const selectedRelations = useMemo(
    () => relations.filter((item) => selectedIds.includes(item.user.id)),
    [relations, selectedIds]
  );
  const selectedNames = selectedRelations.map(getSocialDisplayName).slice(0, 3).join(', ');

  const startConversation = async (targetUserId: string) => {
    try {
      const conversation = await apiClient.post<{ id: string }>(chatRoutes.conversations(), {
        userId: targetUserId,
      });
      router.push(`/chat?conversation=${conversation.id}`);
    } catch (error: unknown) {
      toast.error(
        error instanceof ApiError ? error.displayMessage : t('followers.toast.messageError')
      );
    }
  };

  const requestAction = (action: SocialBulkAction, userIds: string[], userName?: string) => {
    if (action === 'follow') {
      bulkMutation.mutate({ action, userIds });
      return;
    }
    const subject = userName || selectedNames || t('followers.bulk.selectedUsers');
    setPendingAction({
      action,
      userIds,
      title: t(`followers.confirm.${action}.title`),
      description: t(`followers.confirm.${action}.description`, {
        count: userIds.length,
        name: subject,
      }),
      destructive: action === 'unfollow' || action === 'block',
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? relations.map((item) => item.user.id) : []);
  };

  const allSelected = relations.length > 0 && selectedIds.length === relations.length;
  const pageSummary = t('followers.pagination.summary', {
    page,
    totalPages: Math.max(totalPages, 1),
    total: relationsQuery.data?.total ?? 0,
  });

  const openPreview = (userId: string) => {
    const relation = relations.find((item) => item.user.id === userId);
    const recommendation = overviewQuery.data?.recommendations.find((item) => item.id === userId);
    const user = relation?.user ?? recommendation;
    if (!user) return;
    setPreviewUser({
      ...user,
      isFollowing: relation?.relationType === 'following' || relation?.relationship === 'mutual',
      isFollowedBy: relation?.relationType === 'followers' || relation?.relationship === 'mutual',
    });
  };

  return (
    <PageContainer maxWidth="7xl">
      <PageHeader
        title={t('followers.title')}
        description={t('followers.description')}
        icon={Users}
        color="slate"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              overviewQuery.refetch();
              relationsQuery.refetch();
            }}
            disabled={overviewQuery.isRefetching || relationsQuery.isRefetching}
          >
            <RefreshCw
              className={cn(
                'mr-2 h-4 w-4',
                (overviewQuery.isRefetching || relationsQuery.isRefetching) && 'animate-spin'
              )}
            />
            {t('common.refresh')}
          </Button>
        }
        stats={[
          { label: t('followers.tabs.followers'), value: counts.followers, icon: Users },
          { label: t('followers.tabs.following'), value: counts.following, icon: Heart },
          { label: t('followers.mutualFollow'), value: counts.mutual, icon: UserCheck },
          { label: t('followers.tabs.blocked'), value: counts.blocked, icon: Shield },
        ]}
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-4">
          <section className="space-y-4 rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] p-4 shadow-[var(--theme-card-shadow)] sm:p-5">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as SocialRelationType)}
              className="space-y-4"
            >
              <SocialToolbar
                t={t}
                activeTab={activeTab}
                counts={counts}
                searchQuery={searchQuery}
                sort={sort}
                relationship={relationship}
                role={role}
                onTabChange={setActiveTab}
                onSearchChange={setSearchQuery}
                onSortChange={setSort}
                onRelationshipChange={setRelationship}
                onRoleChange={setRole}
                onClearSearch={() => setSearchQuery('')}
              />

              {selectedCount > 0 && (
                <BulkActionBar
                  t={t}
                  tab={activeTab}
                  selectedCount={selectedCount}
                  isPending={bulkMutation.isPending}
                  onClear={() => setSelectedIds([])}
                  onAction={(action) => requestAction(action, selectedIds)}
                />
              )}

              <div className="flex items-center justify-between gap-3 border-y border-border py-3">
                <label className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                  <Checkbox
                    className="w-10 min-w-10 max-w-10 sm:w-8 sm:min-w-8 sm:max-w-8"
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleAll(Boolean(checked))}
                    aria-label={t('followers.bulk.selectPage')}
                    disabled={relations.length === 0 || relationsQuery.isLoading}
                  />
                  <span className="whitespace-nowrap">{t('followers.bulk.selectPage')}</span>
                </label>
                <p className="shrink-0 text-xs text-muted-foreground">{pageSummary}</p>
              </div>

              {(['followers', 'following', 'blocked'] as const).map((tab) => (
                <TabsContent key={tab} value={tab} className="mt-0">
                  <RelationList
                    t={t}
                    locale={locale}
                    tab={tab}
                    items={relations}
                    isLoading={relationsQuery.isLoading}
                    selectedIds={selectedIds}
                    pending={bulkMutation.isPending}
                    onToggleSelected={(userId, checked) =>
                      setSelectedIds((current) => toggleSelectedId(current, userId, checked))
                    }
                    onPreview={openPreview}
                    onMessage={startConversation}
                    onAction={requestAction}
                  />
                </TabsContent>
              ))}

              {totalPages > 1 && (
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">{pageSummary}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(current - 1, 1))}
                      disabled={page <= 1 || relationsQuery.isFetching}
                    >
                      {t('common.previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                      disabled={page >= totalPages || relationsQuery.isFetching}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              )}
            </Tabs>
          </section>
        </main>

        <aside className="space-y-4">
          <RecommendationPanel
            t={t}
            users={overviewQuery.data?.recommendations ?? []}
            loading={overviewQuery.isLoading}
            pending={bulkMutation.isPending}
            onPreview={openPreview}
            onFollow={(userId) => requestAction('follow', [userId])}
          />
          <SafetyPanel
            t={t}
            blockedCount={counts.blocked}
            onOpenBlocked={() => setActiveTab('blocked')}
          />
        </aside>
      </div>

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pendingAction &&
                bulkMutation.mutate({
                  action: pendingAction.action,
                  userIds: pendingAction.userIds,
                })
              }
              className={cn(
                pendingAction?.destructive &&
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              )}
            >
              {bulkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('followers.confirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserProfilePreview
        user={previewUser}
        open={!!previewUser}
        onOpenChange={(open) => !open && setPreviewUser(null)}
      />
    </PageContainer>
  );
}

function SocialToolbar({
  t,
  activeTab,
  counts,
  searchQuery,
  sort,
  relationship,
  role,
  onTabChange,
  onSearchChange,
  onSortChange,
  onRelationshipChange,
  onRoleChange,
  onClearSearch,
}: {
  t: ReturnType<typeof useTranslations>;
  activeTab: SocialRelationType;
  counts: SocialOverview['counts'];
  searchQuery: string;
  sort: SocialRelationSort;
  relationship: SocialRelationshipFilter;
  role: SocialRoleFilter;
  onTabChange: (tab: SocialRelationType) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SocialRelationSort) => void;
  onRelationshipChange: (value: SocialRelationshipFilter) => void;
  onRoleChange: (value: SocialRoleFilter) => void;
  onClearSearch: () => void;
}) {
  return (
    <div className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 lg:w-fit">
        {(['followers', 'following', 'blocked'] as const).map((tab) => {
          const Icon = TAB_ICONS[tab];
          const value =
            tab === 'followers'
              ? counts.followers
              : tab === 'following'
                ? counts.following
                : counts.blocked;
          return (
            <TabsTrigger
              key={tab}
              value={tab}
              onClick={() => onTabChange(tab)}
              className="gap-1 px-1 sm:gap-2 sm:px-3"
            >
              <Icon className="h-4 w-4" />
              <span>{t(`followers.tabs.${tab}`)}</span>
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-2xs">
                {value}
              </Badge>
            </TabsTrigger>
          );
        })}
      </TabsList>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(240px,1fr)_auto_auto_auto]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('followers.search')}
            className="h-10 pl-10 pr-10"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label={t('followers.clearSearch')}
              onClick={onClearSearch}
              className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <FilterSelect
          icon={<SlidersHorizontal className="h-4 w-4" />}
          value={sort}
          onValueChange={(value) => onSortChange(value as SocialRelationSort)}
          options={[
            ['recent', t('followers.sort.recent')],
            ['name', t('followers.sort.name')],
            ['major', t('followers.sort.major')],
          ]}
        />
        <FilterSelect
          icon={<ArrowUpDown className="h-4 w-4" />}
          value={relationship}
          onValueChange={(value) => onRelationshipChange(value as SocialRelationshipFilter)}
          disabled={activeTab === 'blocked'}
          options={[
            ['all', t('followers.relationship.all')],
            ['mutual', t('followers.relationship.mutual')],
            ['oneWay', t('followers.relationship.oneWay')],
          ]}
        />
        <FilterSelect
          icon={<BadgeCheck className="h-4 w-4" />}
          value={role}
          onValueChange={(value) => onRoleChange(value as SocialRoleFilter)}
          options={[
            ['all', t('followers.role.all')],
            ['verified', t('followers.role.verified')],
            ['staff', t('followers.role.staff')],
          ]}
        />
      </div>
    </div>
  );
}

function FilterSelect({
  icon,
  value,
  options,
  disabled,
  onValueChange,
}: {
  icon: ReactNode;
  value: string;
  options: Array<[string, string]>;
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="h-10 w-full min-w-[150px] xl:w-[170px]">
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, label]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BulkActionBar({
  t,
  tab,
  selectedCount,
  isPending,
  onClear,
  onAction,
}: {
  t: ReturnType<typeof useTranslations>;
  tab: SocialRelationType;
  selectedCount: number;
  isPending: boolean;
  onClear: () => void;
  onAction: (action: SocialBulkAction) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-foreground">
        {t('followers.bulk.selected', { count: selectedCount })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {getAvailableBulkActions(tab).map((action) => (
          <Button
            key={action}
            size="sm"
            variant={action === 'block' || action === 'unfollow' ? 'outline' : 'default'}
            onClick={() => onAction(action)}
            disabled={isPending}
            className={cn(action === 'block' && 'text-destructive hover:text-destructive')}
          >
            {getActionIcon(action)}
            {t(`followers.actions.${action}`)}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={onClear} disabled={isPending}>
          <X className="mr-2 h-4 w-4" />
          {t('common.clear')}
        </Button>
      </div>
    </div>
  );
}

function RelationList({
  t,
  locale,
  tab,
  items,
  isLoading,
  selectedIds,
  pending,
  onToggleSelected,
  onPreview,
  onMessage,
  onAction,
}: {
  t: ReturnType<typeof useTranslations>;
  locale: string;
  tab: SocialRelationType;
  items: SocialRelationItem[];
  isLoading: boolean;
  selectedIds: string[];
  pending: boolean;
  onToggleSelected: (userId: string, checked: boolean) => void;
  onPreview: (userId: string) => void;
  onMessage: (userId: string) => void;
  onAction: (action: SocialBulkAction, userIds: string[], userName?: string) => void;
}) {
  if (isLoading) {
    return <LoadingState variant="card" count={6} />;
  }

  if (items.length === 0) {
    const EmptyIcon = TAB_ICONS[tab];
    return (
      <EmptyState
        icon={<EmptyIcon className="h-12 w-12" />}
        title={t(`followers.empty.${tab}`)}
        description={t(`followers.empty.${tab}Desc`)}
      />
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <RelationRow
          key={item.relationId}
          t={t}
          locale={locale}
          item={item}
          selected={selectedIds.includes(item.user.id)}
          pending={pending}
          onToggleSelected={onToggleSelected}
          onPreview={onPreview}
          onMessage={onMessage}
          onAction={onAction}
        />
      ))}
    </div>
  );
}

function RelationRow({
  t,
  locale,
  item,
  selected,
  pending,
  onToggleSelected,
  onPreview,
  onMessage,
  onAction,
}: {
  t: ReturnType<typeof useTranslations>;
  locale: string;
  item: SocialRelationItem;
  selected: boolean;
  pending: boolean;
  onToggleSelected: (userId: string, checked: boolean) => void;
  onPreview: (userId: string) => void;
  onMessage: (userId: string) => void;
  onAction: (action: SocialBulkAction, userIds: string[], userName?: string) => void;
}) {
  const displayName = getSocialDisplayName(item);
  const avatarInitial = getSocialAvatarInitial(item);
  const isBlocked = item.relationType === 'blocked';
  const relationDate = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(item.createdAt));

  return (
    <article
      className={cn(
        'grid min-w-0 gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:border-primary/25 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-4',
        selected && 'border-primary/40 bg-primary/5',
        isBlocked && 'opacity-80'
      )}
    >
      <div className="flex items-center gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onToggleSelected(item.user.id, Boolean(checked))}
          aria-label={t('followers.bulk.selectUser', { name: displayName })}
          disabled={pending}
        />
        <button
          type="button"
          onClick={() => onPreview(item.user.id)}
          className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`${t('followers.userProfile')}: ${displayName}`}
        >
          <Avatar className={cn('h-12 w-12 border', isBlocked && 'grayscale')}>
            <AvatarImage src={item.user.profile?.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-muted text-sm font-semibold">
              {avatarInitial}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onPreview(item.user.id)}
            className="min-w-0 truncate text-left text-base font-semibold text-foreground hover:underline max-sm:flex max-sm:min-h-10 max-sm:items-center"
          >
            {displayName}
          </button>
          <RelationBadge t={t} item={item} />
          {item.user.role === 'VERIFIED' && (
            <Badge variant="success" className="gap-1">
              <BadgeCheck className="h-3 w-3" />
              {t('followers.verified')}
            </Badge>
          )}
        </div>
        <div className="grid min-w-0 gap-2 text-sm text-muted-foreground md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <p className="truncate">
            {item.user.profile?.targetMajor || item.user.profile?.bio || item.user.email}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span>{t('followers.row.followers', { count: item.user.stats.followers })}</span>
            <span>{t('followers.row.cases', { count: item.user.stats.cases })}</span>
            <span>{t('followers.row.since', { date: relationDate })}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {item.relationType === 'followers' && item.relationship !== 'mutual' && (
          <Button size="sm" onClick={() => onAction('follow', [item.user.id])} disabled={pending}>
            <UserPlus className="mr-2 h-4 w-4" />
            {t('followers.actions.follow')}
          </Button>
        )}
        {canStartConversation(item) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => onMessage(item.user.id)}
                  aria-label={t('followers.actions.sendMessage')}
                  disabled={pending}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('followers.actions.sendMessage')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onPreview(item.user.id)}
                aria-label={`${t('followers.userProfile')}: ${displayName}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('followers.userProfile')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <RowMoreActions
          t={t}
          item={item}
          displayName={displayName}
          pending={pending}
          onAction={onAction}
        />
      </div>
    </article>
  );
}

function RelationBadge({
  t,
  item,
}: {
  t: ReturnType<typeof useTranslations>;
  item: SocialRelationItem;
}) {
  if (item.relationship === 'blocked') {
    return (
      <Badge variant="destructive" className="gap-1">
        <Shield className="h-3 w-3" />
        {t('followers.blocked')}
      </Badge>
    );
  }
  if (item.relationship === 'mutual') {
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      >
        <ArrowUpDown className="h-3 w-3" />
        {t('followers.mutualFollow')}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <UserPlus className="h-3 w-3" />
      {t('followers.relationship.oneWay')}
    </Badge>
  );
}

function RowMoreActions({
  t,
  item,
  displayName,
  pending,
  onAction,
}: {
  t: ReturnType<typeof useTranslations>;
  item: SocialRelationItem;
  displayName: string;
  pending: boolean;
  onAction: (action: SocialBulkAction, userIds: string[], userName?: string) => void;
}) {
  const actions =
    item.relationType === 'blocked'
      ? (['unblock'] as SocialBulkAction[])
      : item.relationType === 'following'
        ? (['unfollow', 'block'] as SocialBulkAction[])
        : (['block'] as SocialBulkAction[]);

  return (
    <div className="flex items-center gap-2">
      {actions.map((action) => (
        <TooltipProvider key={action}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                disabled={pending}
                onClick={() => onAction(action, [item.user.id], displayName)}
                aria-label={t(`followers.actions.${action}`)}
                className={cn(
                  (action === 'block' || action === 'unfollow') &&
                    'text-muted-foreground hover:text-destructive'
                )}
              >
                {action === 'block' ? (
                  <Ban className="h-4 w-4" />
                ) : action === 'unfollow' ? (
                  <UserMinus className="h-4 w-4" />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t(`followers.actions.${action}`)}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
      <MoreHorizontal
        className="hidden h-4 w-4 text-muted-foreground sm:block"
        aria-hidden="true"
      />
    </div>
  );
}

function RecommendationPanel({
  t,
  users,
  loading,
  pending,
  onPreview,
  onFollow,
}: {
  t: ReturnType<typeof useTranslations>;
  users: RecommendedSocialUser[];
  loading: boolean;
  pending: boolean;
  onPreview: (userId: string) => void;
  onFollow: (userId: string) => void;
}) {
  return (
    <section className="rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] p-4 shadow-[var(--theme-card-shadow)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Star className="h-4 w-4 text-primary" />
            {t('followers.recommended.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('followers.recommended.description')}
          </p>
        </div>
      </div>
      {loading ? (
        <div className="space-y-3">
          <LoadingState variant="card" count={3} />
        </div>
      ) : users.length > 0 ? (
        <div className="space-y-3">
          {users.map((user) => {
            const item = { user };
            const displayName = getSocialDisplayName(item);
            return (
              <div key={user.id} className="rounded-md border border-border bg-background p-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onPreview(user.id)}
                    className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Avatar className="h-10 w-10 border">
                      <AvatarImage src={user.profile?.avatarUrl ?? undefined} />
                      <AvatarFallback>{displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onPreview(user.id)}
                      className="truncate text-sm font-semibold hover:underline max-sm:flex max-sm:min-h-10 max-sm:items-center"
                    >
                      {displayName}
                    </button>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {user.profile?.targetMajor || user.email}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {user.reasons.map((reason) => (
                        <Badge key={reason} variant="secondary" className="text-2xs">
                          {t(`followers.recommended.reasons.${reason}`)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => onFollow(user.id)}
                  disabled={pending}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t('followers.actions.follow')}
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t('followers.recommended.empty')}
        </p>
      )}
    </section>
  );
}

function SafetyPanel({
  t,
  blockedCount,
  onOpenBlocked,
}: {
  t: ReturnType<typeof useTranslations>;
  blockedCount: number;
  onOpenBlocked: () => void;
}) {
  return (
    <Alert variant={blockedCount > 0 ? 'warning' : 'default'}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{t('followers.safety.title')}</AlertTitle>
      <AlertDescription>
        <div className="space-y-3">
          <p>{t('followers.safety.description', { count: blockedCount })}</p>
          <Button variant="outline" size="sm" onClick={onOpenBlocked}>
            <Shield className="mr-2 h-4 w-4" />
            {t('followers.safety.reviewBlocked')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function getActionIcon(action: SocialBulkAction) {
  if (action === 'follow') return <UserPlus className="mr-2 h-4 w-4" />;
  if (action === 'unfollow') return <UserMinus className="mr-2 h-4 w-4" />;
  if (action === 'block') return <Ban className="mr-2 h-4 w-4" />;
  return <UserCheck className="mr-2 h-4 w-4" />;
}

function invalidateSocialQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: qk.social.overview() });
  queryClient.invalidateQueries({ queryKey: qk.social.relationsAll });
  queryClient.invalidateQueries({ queryKey: qk.social.recommended() });
  queryClient.invalidateQueries({ queryKey: qk.social.followers() });
  queryClient.invalidateQueries({ queryKey: qk.social.following() });
  queryClient.invalidateQueries({ queryKey: qk.social.blocked() });
}

'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, GraduationCap, X } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useLocale } from 'next-intl';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { TeamCard, type TeamCardData } from '@/components/features';
import { toast } from 'sonner';
import { useSchoolSearch } from '@/hooks/use-school-search';
import { getSchoolName } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState, useMemo } from 'react';

type TabValue = 'my' | 'discover';

type DiscoverParams = {
  page: number;
  pageSize: number;
  schoolId?: string;
  joinPolicy?: string;
  sort?: 'newest' | 'members';
};

export function TeamsPageClient() {
  const t = useTranslations('teams');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tab = (searchParams.get('tab') as TabValue) || 'discover';
  const isLoggedIn = useAuthStore((s) => !!s.accessToken);

  const joinMutation = useMutation({
    mutationFn: (teamId: string) => apiClient.post(`/teams/${teamId}/join`),
    onSuccess: (_, teamId) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Joined');
      router.push(`/teams/${teamId}`);
    },
    onError: (e: unknown, _teamId) => {
      const err = e as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const code = err.response?.data?.error?.code;
      if (code === 'CONFLICT') toast.error(t('errors.full'));
      else toast.error(err.response?.data?.error?.message ?? 'Failed to join');
    },
  });

  const handleJoinClick = (teamId: string) => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/teams?tab=discover`)}`);
      return;
    }
    joinMutation.mutate(teamId);
  };

  const setTab = (value: TabValue) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', value);
    router.replace(`/teams?${next.toString()}`);
  };

  const discoverParams: DiscoverParams = useMemo(() => {
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10) || 20)
    );
    const schoolId = searchParams.get('schoolId') ?? undefined;
    const joinPolicy = searchParams.get('joinPolicy') ?? undefined;
    const sort = (searchParams.get('sort') as 'newest' | 'members') ?? 'newest';
    return { page, pageSize, schoolId, joinPolicy, sort };
  }, [searchParams]);

  const setDiscoverFilters = (updates: Partial<DiscoverParams>) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', 'discover');
    const merged = { ...discoverParams, ...updates };
    next.set('page', String(merged.page));
    next.set('pageSize', String(merged.pageSize));
    if (merged.schoolId) next.set('schoolId', merged.schoolId);
    else next.delete('schoolId');
    if (merged.joinPolicy) next.set('joinPolicy', merged.joinPolicy);
    else next.delete('joinPolicy');
    next.set('sort', merged.sort ?? 'newest');
    router.replace(`/teams?${next.toString()}`);
  };

  const {
    data: discoverData,
    isLoading: discoverLoading,
    isError: discoverError,
    refetch: refetchDiscover,
  } = useQuery({
    queryKey: ['teams', 'discover', discoverParams],
    queryFn: () =>
      apiClient.get<{ items: TeamCardData[]; total: number }>('/teams', {
        params: {
          page: discoverParams.page,
          pageSize: discoverParams.pageSize,
          schoolId: discoverParams.schoolId,
          joinPolicy: discoverParams.joinPolicy,
          sort: discoverParams.sort,
        },
      }),
  });

  const {
    data: myData,
    isLoading: myLoading,
    isError: myError,
    refetch: refetchMy,
  } = useQuery({
    queryKey: ['teams', 'my'],
    queryFn: () => apiClient.get<TeamCardData[]>('/teams/my'),
    enabled: isLoggedIn,
  });

  const discoverItems = discoverData?.items ?? [];
  const myItems = Array.isArray(myData) ? myData : [];

  return (
    <PageContainer maxWidth="7xl">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={Users}
        color="amber"
        actions={
          isLoggedIn ? (
            <Link href="/teams/create">
              <Button>{t('create')}</Button>
            </Link>
          ) : (
            <Link href={`/login?callbackUrl=${encodeURIComponent('/teams/create')}`}>
              <Button>{t('create')}</Button>
            </Link>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="mt-6">
        <TabsList>
          <TabsTrigger value="my">{t('myTeams')}</TabsTrigger>
          <TabsTrigger value="discover">{t('discover')}</TabsTrigger>
        </TabsList>
        <TabsContent value="my" className="mt-6">
          {!isLoggedIn ? (
            <EmptyState
              type="teams"
              title={t('empty.my')}
              action={{
                label: t('loginToJoin'),
                onClick: () =>
                  router.push(`/login?callbackUrl=${encodeURIComponent('/teams?tab=my')}`),
              }}
            />
          ) : myLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : myError ? (
            <EmptyState
              type="teams"
              title={t('loadErrorMy')}
              action={{ label: t('retry'), onClick: () => refetchMy() }}
            />
          ) : myItems.length === 0 ? (
            <EmptyState
              type="teams"
              title={t('empty.my')}
              action={{
                label: t('goDiscover'),
                onClick: () => setTab('discover'),
              }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myItems.map((team) => (
                <TeamCard key={team.id} team={team} locale={locale} isMember />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="discover" className="mt-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Select
              value={discoverParams.joinPolicy ?? 'all'}
              onValueChange={(v) => setDiscoverFilters({ joinPolicy: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('filters.joinPolicy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.joinPolicyAll')}</SelectItem>
                <SelectItem value="OPEN">{t('joinPolicy.open')}</SelectItem>
                <SelectItem value="INVITE_ONLY">{t('joinPolicy.inviteOnly')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={discoverParams.sort ?? 'newest'}
              onValueChange={(v: 'newest' | 'members') => setDiscoverFilters({ sort: v })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('filters.sortNewest')}</SelectItem>
                <SelectItem value="members">{t('filters.sortMembers')}</SelectItem>
              </SelectContent>
            </Select>
            <DiscoverSchoolFilter
              schoolId={discoverParams.schoolId}
              locale={locale}
              onSelect={(id) => setDiscoverFilters({ schoolId: id || undefined })}
            />
          </div>
          {discoverLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : discoverError ? (
            <EmptyState
              type="teams"
              title={t('loadErrorDiscover')}
              action={{ label: t('retry'), onClick: () => refetchDiscover() }}
            />
          ) : discoverItems.length === 0 ? (
            <EmptyState
              type="teams"
              title={
                discoverParams.schoolId || discoverParams.joinPolicy
                  ? t('empty.noResults')
                  : t('empty.discover')
              }
              action={
                isLoggedIn
                  ? { label: t('create'), onClick: () => router.push('/teams/create') }
                  : {
                      label: t('loginToJoin'),
                      onClick: () =>
                        router.push(`/login?callbackUrl=${encodeURIComponent('/teams')}`),
                    }
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {discoverItems.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  locale={locale}
                  showJoin
                  onJoinClick={() => handleJoinClick(team.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function DiscoverSchoolFilter({
  schoolId,
  locale,
  onSelect,
}: {
  schoolId?: string;
  locale: string;
  onSelect: (id: string | null) => void;
}) {
  const t = useTranslations('teams');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: searchData, isLoading } = useSchoolSearch(search, open);
  const items = searchData?.items ?? [];
  const selectedSchool = items.find((s) => s.id === schoolId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
          <GraduationCap className="mr-2 h-4 w-4 shrink-0" />
          {schoolId ? (
            <span className="truncate">
              {selectedSchool ? getSchoolName(selectedSchool, locale) : t('filters.schoolSelected')}
            </span>
          ) : (
            <span className="text-muted-foreground">{t('filters.schoolPlaceholder')}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Input
          placeholder={t('filters.schoolSearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-b-none border-0 border-b"
        />
        <div className="max-h-[240px] overflow-auto">
          {schoolId && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
            >
              <X className="h-4 w-4" />
              {t('filters.schoolClear')}
            </button>
          )}
          {isLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {t('filters.schoolLoading')}
            </div>
          ) : items.length === 0 && search.trim() ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {t('filters.schoolNoResults')}
            </div>
          ) : (
            items.slice(0, 10).map((school) => (
              <button
                key={school.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onSelect(school.id);
                  setOpen(false);
                  setSearch('');
                }}
              >
                {getSchoolName(school, locale)}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

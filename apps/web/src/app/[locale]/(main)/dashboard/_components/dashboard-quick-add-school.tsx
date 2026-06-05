'use client';

import { schoolRoutes } from '@study-abroad/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiClient } from '@/lib/api';
import { qk } from '@/lib/query';
import { DASHBOARD_EVENTS, trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { getSchoolName } from '@/lib/utils';

interface SchoolHit {
  id: string;
  name: string;
  nameZh?: string | null;
  country?: string;
  state?: string | null;
  usNewsRank?: number | null;
}

interface SchoolListResponse {
  items: SchoolHit[];
  total: number;
}

/**
 * Quick Add School — compact popover-based typeahead so users can search
 * and add a school to their list without leaving the dashboard. Replaces
 * the previous 5-click flow (open /schools → search → school detail →
 * "Add to list" → choose round → confirm) with 2 clicks (open popover →
 * click school).
 *
 * 2026-05: Built in response to "都要点击很多地方才能用" — Quick Add School
 * is the largest remaining click-cost gap on the dashboard, since school
 * list management is iterative throughout the application cycle.
 *
 * Adds the school as a TARGET tier with no round; users can refine round
 * and tier later in /schools or /timeline.
 */
export function DashboardQuickAddSchool() {
  const t = useTranslations('dashboard.quickAddSchool');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search to avoid one query per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  // Auto-focus input when popover opens.
  useEffect(() => {
    if (open) {
      // Small delay to let Radix Portal mount.
      const handle = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(handle);
    }
  }, [open]);

  // Reset search when popover closes so next open is fresh.
  useEffect(() => {
    if (!open) {
      setSearch('');
      setDebouncedSearch('');
    }
  }, [open]);

  const { data: results, isFetching } = useQuery({
    queryKey: ['quick-add-school', debouncedSearch],
    queryFn: () =>
      apiClient.get<SchoolListResponse>(schoolRoutes.list(), {
        params: { search: debouncedSearch, pageSize: '8' },
      }),
    enabled: open && debouncedSearch.length >= 2,
    staleTime: 60_000,
  });

  // Surface user's already-added schools to disable duplicate adds.
  const { data: existingList } = useQuery({
    queryKey: qk.schoolList.mine,
    queryFn: () => apiClient.get<Array<{ schoolId: string }>>('/school-lists'),
    enabled: open,
  });
  const alreadyAddedIds = new Set((existingList ?? []).map((item) => item.schoolId));

  // 2026-05 Phase 5 #40: optimistic-update pattern via React Query.
  // The newly-added school is written into the ['school-lists', 'mine']
  // query cache IMMEDIATELY on click — `alreadyAddedIds` (derived from
  // that cache) sees it the same render, so the button instantly flips
  // to its "已添加" state with zero network-round-trip delay.
  //
  // If the network call fails, onError restores the snapshot so the
  // button reverts and the user can retry. onSettled invalidates so the
  // real server state replaces the optimistic guess as soon as it's known.
  //
  // (We use React Query's optimistic-update API rather than React 19's
  // useOptimistic so the optimistic state participates in the same cache
  // that powers the deduplication check above — single source of truth.)
  const SCHOOL_LIST_KEY = qk.schoolList.mine;
  type SchoolListSnapshot = Array<{ schoolId: string }>;

  const addSchool = useMutation({
    mutationFn: (schoolId: string) => apiClient.post('/school-lists', { schoolId, tier: 'TARGET' }),
    onMutate: async (schoolId: string) => {
      // Cancel any in-flight refetch so it doesn't clobber our optimistic write.
      await queryClient.cancelQueries({ queryKey: SCHOOL_LIST_KEY });
      const previous = queryClient.getQueryData<SchoolListSnapshot>(SCHOOL_LIST_KEY) ?? [];
      // Idempotent: if the schoolId is somehow already in the snapshot,
      // don't double-add (defensive — alreadyAddedIds disables the button).
      if (!previous.some((row) => row.schoolId === schoolId)) {
        queryClient.setQueryData<SchoolListSnapshot>(SCHOOL_LIST_KEY, [...previous, { schoolId }]);
      }
      return { previous };
    },
    onSuccess: (_data, schoolId) => {
      // 2026-05 Phase 4: track successful adds for the dashboard-add
      // → /school-lists-page funnel. Log schoolId (already user-owned)
      // and result-count context, not the search query text.
      trackEvent(DASHBOARD_EVENTS.quickAddSchoolAdded, {
        schoolId,
        resultsAtSelectTime: items.length,
      });
      toast.success(t('added'));
      setOpen(false);
    },
    onError: (error: unknown, _schoolId, context) => {
      // Rollback the optimistic write so the button can be clicked again.
      if (context?.previous) {
        queryClient.setQueryData<SchoolListSnapshot>(SCHOOL_LIST_KEY, context.previous);
      }
      const message = error instanceof Error && error.message ? error.message : t('addFailed');
      toast.error(message);
    },
    onSettled: () => {
      // Replace optimistic state with the real server truth, regardless
      // of success / failure outcome.
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: qk.schoolList.all });
    },
  });

  const items = results?.items ?? [];
  const showEmpty = open && debouncedSearch.length >= 2 && !isFetching && items.length === 0;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // 2026-05 Phase 4: track popover opens to measure
        // open → add conversion (Phase 4 funnel)
        if (next && !open) {
          trackEvent(DASHBOARD_EVENTS.quickAddSchoolOpened);
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t('triggerAriaLabel')}
          // 2026-05 Phase 1 design piggyback #13: mobile h-9 ensures
          // WCAG 2.1 SC 2.5.5 (target size ≥ 44px); h-7 = 28px which
          // fails on touch devices.
          className="h-9 gap-1 px-2 text-xs sm:h-7"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('trigger')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[320px] p-0"
        // Prevent autofocus shifting around when the input mounts.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('clear')}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-[280px] overflow-y-auto p-1">
          {debouncedSearch.length < 2 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">{t('hint')}</p>
          )}
          {isFetching && debouncedSearch.length >= 2 && (
            <div className="flex items-center justify-center px-3 py-4 text-xs text-muted-foreground">
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              {t('searching')}
            </div>
          )}
          {showEmpty && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {t('noResults', { search: debouncedSearch })}
            </p>
          )}
          {items.map((school) => {
            const alreadyAdded = alreadyAddedIds.has(school.id);
            const isAdding = addSchool.isPending && addSchool.variables === school.id;
            return (
              <button
                key={school.id}
                type="button"
                disabled={alreadyAdded || isAdding}
                onClick={() => addSchool.mutate(school.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-[var(--theme-radius-control,0.5rem)]',
                  'px-2.5 py-1.5 text-left transition-colors',
                  alreadyAdded
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:bg-[color:var(--theme-control-hover-bg)]'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{getSchoolName(school, locale)}</p>
                  <p className="truncate text-2xs text-muted-foreground">
                    {[school.country, school.state].filter(Boolean).join(' · ')}
                    {school.usNewsRank ? ` · #${school.usNewsRank}` : ''}
                  </p>
                </div>
                {alreadyAdded ? (
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {t('alreadyAdded')}
                  </span>
                ) : isAdding ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

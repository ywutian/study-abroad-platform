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
    queryKey: ['school-lists', 'mine'],
    queryFn: () => apiClient.get<Array<{ schoolId: string }>>('/school-lists'),
    enabled: open,
  });
  const alreadyAddedIds = new Set((existingList ?? []).map((item) => item.schoolId));

  const addSchool = useMutation({
    mutationFn: (schoolId: string) => apiClient.post('/school-lists', { schoolId, tier: 'TARGET' }),
    onSuccess: () => {
      toast.success(t('added'));
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
      setOpen(false);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error && error.message ? error.message : t('addFailed');
      toast.error(message);
    },
  });

  const items = results?.items ?? [];
  const showEmpty = open && debouncedSearch.length >= 2 && !isFetching && items.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
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

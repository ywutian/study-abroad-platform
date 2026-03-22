'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { apiClient } from '@/lib/api';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { SchoolEditDialog, type HighSchool } from './school-edit-dialog';
import { toast } from 'sonner';

/** Extended type for tier overview — includes fields not in SchoolEditDialog's HighSchool */
interface HighSchoolWithQuality extends HighSchool {
  description?: string | null;
  state?: string | null;
  qualityScore?: number | null;
  qualityGrade?: string | null;
}

const COUNTRIES = ['US', 'CN', 'UK', 'CA', 'AU', 'SG', 'HK', 'KR', 'JP'];
const TYPES = [
  'PUBLIC_US',
  'PRIVATE_US',
  'BOARDING_US',
  'INTL_CN',
  'PUBLIC_CN',
  'PRIVATE_CN',
  'INTL_OTHER',
  'PUBLIC_OTHER',
  'PRIVATE_OTHER',
];

const TIER_STYLES: Record<number, { border: string; bg: string; stars: string }> = {
  5: {
    border: 'border-l-4 border-l-emerald-500 dark:border-l-emerald-400',
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    stars: '\u2605\u2605\u2605\u2605\u2605',
  },
  4: {
    border: 'border-l-4 border-l-blue-500 dark:border-l-blue-400',
    bg: 'bg-blue-50/50 dark:bg-blue-950/20',
    stars: '\u2605\u2605\u2605\u2605',
  },
  3: {
    border: 'border-l-4 border-l-slate-500 dark:border-l-slate-400',
    bg: 'bg-slate-50/50 dark:bg-slate-900/30',
    stars: '\u2605\u2605\u2605',
  },
  2: {
    border: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
    bg: 'bg-amber-50/50 dark:bg-amber-950/20',
    stars: '\u2605\u2605',
  },
  1: {
    border: 'border-l-4 border-l-red-500 dark:border-l-red-400',
    bg: 'bg-red-50/50 dark:bg-red-950/20',
    stars: '\u2605',
  },
};

const GRADE_VARIANT: Record<
  string,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  A: 'success',
  B: 'default',
  C: 'warning',
  D: 'destructive',
};

const CURRICULA = ['IB', 'AP', 'A-Level', 'BC', 'PGA', 'VCE', 'DSE'];

function extractCurricula(description?: string | null): string[] {
  if (!description) return [];
  return CURRICULA.filter((c) => description.includes(c));
}

// States commonly used for each country
const STATE_OPTIONS: Record<string, string[]> = {
  CN: ['上海', '北京', '广东', '江苏', '浙江', '四川', '重庆', '天津', '湖北', '辽宁', '山东'],
  US: ['MA', 'CT', 'NY', 'NJ', 'CA', 'PA', 'NH', 'VA', 'MD'],
};

export function TierOverviewTab() {
  const t = useTranslations('admin.highSchools');
  const queryClient = useQueryClient();
  const [country, setCountry] = useState('CN');
  const [state, setState] = useState('上海');
  const [type, setType] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<HighSchool | null>(null);

  const stateOptions = country ? (STATE_OPTIONS[country] ?? []) : [];

  const { data, isLoading } = useQuery({
    queryKey: ['adminHighSchools', 'tierOverview', country, state, type],
    queryFn: () =>
      apiClient.get<{ data: HighSchoolWithQuality[]; total: number }>('/admin/high-schools', {
        params: {
          country: country || undefined,
          state: state || undefined,
          type: type || undefined,
          limit: '200',
        },
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(`/admin/high-schools/${id}`, d),
    onSuccess: () => {
      toast.success(t('messages.schoolUpdated'));
      queryClient.invalidateQueries({ queryKey: ['adminHighSchools'] });
      setEditOpen(false);
    },
  });

  const grouped = useMemo(() => {
    const groups: Record<number, HighSchoolWithQuality[]> = { 5: [], 4: [], 3: [], 2: [], 1: [] };
    const schools = data?.data ?? [];
    schools.forEach((s) => {
      const t = Number(s.tier) || 3;
      if (groups[t]) groups[t].push(s);
    });
    return groups;
  }, [data]);

  const total = data?.total ?? 0;
  const showing = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={country || 'all'}
          onValueChange={(v) => {
            setCountry(v === 'all' ? '' : v);
            setState('');
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('filters.country')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allCountries')}</SelectItem>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`countries.${c}` as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {stateOptions.length > 0 && (
          <Select value={state || 'all'} onValueChange={(v) => setState(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t('filters.state')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allStates')}</SelectItem>
              {stateOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={type || 'all'} onValueChange={(v) => setType(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('filters.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allTypes')}</SelectItem>
            {TYPES.map((tp) => (
              <SelectItem key={tp} value={tp}>
                {t(`schoolTypes.${tp}` as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Truncation warning */}
      {total > 200 && (
        <p className="text-sm text-muted-foreground">{t('messages.showingTruncated', { total })}</p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          {t('messages.loadingSchools')}
        </div>
      ) : showing === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          {t('messages.noSchoolsFiltered')}
        </div>
      ) : (
        /* Tier sections */
        <div className="space-y-4">
          {[5, 4, 3, 2, 1].map((tier) => {
            const schools = grouped[tier];
            const style = TIER_STYLES[tier];
            const tierLabel = t(`tierLabels.${tier}` as any);
            const evaluated = schools.filter((s) => s.evaluatedAt).length;
            const defaultOpen = schools.length <= 12;

            return (
              <TierSection
                key={tier}
                tier={tier}
                style={style}
                tierLabel={tierLabel}
                schools={schools}
                evaluated={evaluated}
                defaultOpen={defaultOpen}
                onEdit={(school) => {
                  setEditingSchool(school);
                  setEditOpen(true);
                }}
              />
            );
          })}
        </div>
      )}

      <SchoolEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        school={editingSchool}
        onSave={(id, d) => updateMutation.mutate({ id, data: d })}
        isSaving={updateMutation.isPending}
      />
    </div>
  );
}

function TierSection({
  tier,
  style,
  tierLabel,
  schools,
  evaluated,
  defaultOpen,
  onEdit,
}: {
  tier: number;
  style: (typeof TIER_STYLES)[number];
  tierLabel: string;
  schools: HighSchoolWithQuality[];
  evaluated: number;
  defaultOpen: boolean;
  onEdit: (school: HighSchoolWithQuality) => void;
}) {
  const t = useTranslations('admin.highSchools');
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-lg ${style.border} ${style.bg} p-4`}>
        <CollapsibleTrigger asChild>
          <button
            className="flex w-full items-center justify-between text-left"
            aria-label={t('tierOverview.tierAriaLabel', {
              tier,
              label: tierLabel,
              count: schools.length,
            })}
          >
            <h3 className="text-base font-semibold">
              {t('tierOverview.tierLabel', { tier, label: tierLabel, stars: style.stars })}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {t('messages.schoolsCount', { count: schools.length, evaluated })}
              </span>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {schools.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t('messages.noSchoolsInTier')}</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {schools.map((school) => (
                <SchoolCard key={school.id} school={school} onEdit={onEdit} />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function SchoolCard({
  school,
  onEdit,
}: {
  school: HighSchoolWithQuality;
  onEdit: (school: HighSchoolWithQuality) => void;
}) {
  const t = useTranslations('admin.highSchools');
  const curricula = extractCurricula(school.description);
  const grade = school.qualityGrade ?? 'D';
  const isUnevaluated = !school.evaluatedAt;

  return (
    <Card
      className="group relative cursor-pointer transition-shadow hover:shadow-md hover:border-primary/50"
      role="button"
      tabIndex={0}
      aria-label={t('tierOverview.schoolAriaLabel', { tier: school.tier ?? 0, name: school.name })}
      onClick={() => onEdit(school)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(school);
        }
      }}
    >
      <CardContent className="p-3">
        {/* Status badges */}
        <div className="mb-2 flex items-center justify-between">
          <Badge variant={GRADE_VARIANT[grade] ?? 'secondary'} className="text-xs">
            {grade}
          </Badge>
          {isUnevaluated && (
            <Badge variant="destructive" className="text-xs">
              {t('messages.unevaluated')}
            </Badge>
          )}
        </div>

        {/* School name */}
        <div className="mb-2">
          {school.nameZh && <p className="text-sm font-medium leading-tight">{school.nameZh}</p>}
          <p className="text-xs text-muted-foreground leading-tight">{school.name}</p>
        </div>

        {/* Curriculum tags */}
        {curricula.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {curricula.map((c) => (
              <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">
                {c}
              </Badge>
            ))}
          </div>
        )}

        {/* Edit button — visible on hover */}
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-1 top-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(school);
          }}
          aria-label={t('tierOverview.editAriaLabel', { name: school.name })}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}

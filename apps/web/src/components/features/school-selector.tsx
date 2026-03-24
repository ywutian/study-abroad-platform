'use client';

import { useState, useMemo } from 'react';
import { isSafeUrl } from '@/lib/utils/url';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiClient } from '@/lib/api';
import { Search, GraduationCap, X, Loader2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { getSchoolName, getSchoolSubName, formatAcceptanceRate } from '@/lib/utils';

interface SchoolRanking {
  source: string;
  list: string;
  rank: number;
  year: number;
}

interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
  website?: string;
  rankings?: SchoolRanking[];
}

/** Ranking list label map — keys match backend SchoolRanking.list values */
const RANKING_LIST_KEYS: Record<string, string> = {
  NATIONAL_UNIVERSITY: 'nationalUniversity',
  LIBERAL_ARTS: 'liberalArts',
  ART_DESIGN: 'artDesign',
  ENGINEERING_NO_PHD: 'engineering',
  CS: 'cs',
  BUSINESS: 'business',
};

/** Get the best (lowest rank) ranking per list for display */
function getDisplayRankings(rankings?: SchoolRanking[]): SchoolRanking[] {
  if (!rankings?.length) return [];
  // Group by list, keep best rank per list
  const bestByList = new Map<string, SchoolRanking>();
  for (const r of rankings) {
    const existing = bestByList.get(r.list);
    if (!existing || r.rank < existing.rank) {
      bestByList.set(r.list, r);
    }
  }
  return Array.from(bestByList.values()).sort((a, b) => a.rank - b.rank);
}

interface SchoolSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSchools: School[];
  onSelect: (schools: School[]) => Promise<void> | void;
  maxSelection?: number;
  title?: string;
}

export function SchoolSelector({
  open,
  onOpenChange,
  selectedSchools,
  onSelect,
  maxSelection = 20,
  title,
}: SchoolSelectorProps) {
  const t = useTranslations('schoolSelector');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const finalTitle = title ?? t('title');
  const [tempSelected, setTempSelected] = useState<School[]>(selectedSchools);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch schools
  const { data: schoolsResponse, isLoading } = useQuery({
    queryKey: ['schools', search],
    queryFn: () =>
      apiClient.get<{ items: School[]; total: number }>('/schools', {
        params: { search, pageSize: '100' },
      }),
    enabled: open,
  });

  const schools = useMemo(() => schoolsResponse?.items || [], [schoolsResponse?.items]);

  // Filter and sort schools
  const filteredSchools = useMemo(() => {
    let result = schools;

    // Sort by US News rank
    result = [...result].sort((a, b) => {
      if (!a.usNewsRank) return 1;
      if (!b.usNewsRank) return -1;
      return a.usNewsRank - b.usNewsRank;
    });

    return result;
  }, [schools]);

  const isSelected = (school: School) => tempSelected.some((s) => s.id === school.id);

  const toggleSchool = (school: School) => {
    if (isSelected(school)) {
      setTempSelected(tempSelected.filter((s) => s.id !== school.id));
    } else if (tempSelected.length < maxSelection) {
      setTempSelected([...tempSelected, school]);
    } else {
      toast.warning(t('maxSelectionReached', { max: maxSelection }));
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onSelect(tempSelected);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTempSelected(selectedSchools);
    onOpenChange(false);
  };

  // Reset temp selection when dialog opens; prevent close during submission
  const handleOpenChange = (newOpen: boolean) => {
    if (isSubmitting) return;
    if (newOpen) {
      setTempSelected(selectedSchools);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            {finalTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selected schools */}
        {tempSelected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tempSelected.map((school) => (
              <Badge key={school.id} variant="secondary" className="gap-1 pr-1">
                {getSchoolName(school, locale)}
                <button
                  onClick={() => toggleSchool(school)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* School list */}
        <TooltipProvider delayDuration={300}>
          <ScrollArea className="h-[400px] rounded-md border">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSchools.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <GraduationCap className="mb-2 h-12 w-12 opacity-50" />
                <p>{t('noResults')}</p>
                <p className="text-sm">{t('noResultsHint')}</p>
              </div>
            ) : (
              <div className="p-2">
                {filteredSchools.map((school) => (
                  <div
                    key={school.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50 ${
                      isSelected(school) ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => toggleSchool(school)}
                    onKeyDown={(e) => e.key === 'Enter' && toggleSchool(school)}
                    role="button"
                    tabIndex={0}
                  >
                    <Checkbox
                      checked={isSelected(school)}
                      disabled={!isSelected(school) && tempSelected.length >= maxSelection}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{getSchoolName(school, locale)}</p>
                        {getDisplayRankings(school.rankings).length > 0 ? (
                          getDisplayRankings(school.rankings)
                            .slice(0, 2)
                            .map((r) => (
                              <Tooltip key={`${r.source}-${r.list}`}>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {t(
                                      `rankingList.${RANKING_LIST_KEYS[r.list] || 'nationalUniversity'}`
                                    )}{' '}
                                    #{r.rank}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{t('rankingTooltip', { source: r.source, year: r.year })}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))
                        ) : school.usNewsRank ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs shrink-0">
                                #{school.usNewsRank}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('rankingTooltipOverall')}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                        {isSafeUrl(school.website) && (
                          <a
                            href={school.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t('visitWebsite', {
                              school: getSchoolName(school, locale),
                            })}
                            title={t('visitWebsite', { school: getSchoolName(school, locale) })}
                            className="text-muted-foreground hover:text-primary shrink-0 p-1 -m-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <Globe className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {getSchoolSubName(school, locale) || school.name}
                        {school.state && ` · ${school.state}`}
                      </p>
                    </div>
                    {school.acceptanceRate != null && Number(school.acceptanceRate) > 0 && (
                      <div className="text-right text-sm text-muted-foreground shrink-0">
                        <p>{t('acceptanceRate')}</p>
                        <p className="font-medium">{formatAcceptanceRate(school.acceptanceRate)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TooltipProvider>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {t('selectedCount', { count: tempSelected.length, max: maxSelection })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('confirmSelection')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

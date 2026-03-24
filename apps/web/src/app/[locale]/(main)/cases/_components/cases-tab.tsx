/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient, STALE_TIME } from '@/lib/api';
import { CaseCard, SubmitCaseDialog } from '@/components/features';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, CheckCircle, XCircle, Clock, Sparkles, X, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTour } from '@/components/features/onboarding/tour-provider';
import { TOURS, casesTourSteps } from '@/components/features/onboarding/tour-provider';

const GUIDE_VISIT_KEY = 'case-library-visit-count';

function useGuideBanner() {
  const [visible, setVisible] = useState(false); // default hidden to avoid flash
  const [canDismiss, setCanDismiss] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const count = parseInt(localStorage.getItem(GUIDE_VISIT_KEY) || '0', 10);
      localStorage.setItem(GUIDE_VISIT_KEY, String(count + 1));
      if (count >= 5) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      setCanDismiss(count >= 2); // allow dismiss after 3rd visit (count starts at 0)
    } catch {
      setVisible(true);
      setCanDismiss(true);
    }
  }, []);
  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(GUIDE_VISIT_KEY, '999');
    } catch {
      // ignore
    }
  };
  return { visible, canDismiss, dismiss };
}

export function CasesTab() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { registerTour, startTour, hasCompletedTour } = useTour();
  const { visible: guideVisible, canDismiss, dismiss } = useGuideBanner();

  const [filters, setFilters] = useState({
    year: '',
    result: '',
    round: '',
    nationality: '',
    search: '',
  });
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  // Register cases tour
  useEffect(() => {
    registerTour({ id: TOURS.CASES, steps: casesTourSteps });
  }, [registerTour]);

  const {
    data: cases,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['cases', filters],
    queryFn: () => apiClient.get<any>('/cases', { params: filters as any }),
    retry: 2,
    staleTime: STALE_TIME.DYNAMIC,
    refetchOnWindowFocus: false,
  });

  const caseItems = cases?.items || [];
  const hasFilters =
    filters.year || filters.result || filters.round || filters.nationality || filters.search;

  // Auto-start tour on first visit when there are cases to show
  useEffect(() => {
    if (caseItems.length > 0 && !hasCompletedTour(TOURS.CASES) && !isLoading) {
      const timer = setTimeout(() => startTour(TOURS.CASES), 800);
      return () => clearTimeout(timer);
    }
  }, [caseItems.length, hasCompletedTour, startTour, isLoading]);

  return (
    <>
      <SubmitCaseDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        onSuccess={() => refetch()}
      />

      {/* Guidance banner */}
      <AnimatePresence>
        {guideVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <Card className="border-success/20 bg-success/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">{t('cases.guide.title')}</p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-start gap-1.5">
                        <span className="mt-0.5 text-success">•</span>
                        {t('cases.guide.bullet1')}
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-0.5 text-success">•</span>
                        {t('cases.guide.bullet2')}
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-0.5 text-success">•</span>
                        {t('cases.guide.bullet3')}
                      </li>
                      <li className="flex items-start gap-1.5 text-muted-foreground/70 italic">
                        <span className="mt-0.5">ℹ</span>
                        {t('cases.guide.bullet4')}
                      </li>
                    </ul>
                  </div>
                  {canDismiss && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-8 text-xs"
                      onClick={dismiss}
                    >
                      {t('cases.guide.dismiss')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end mb-4">
        <Button
          data-tour="cases-share"
          onClick={() => setSubmitDialogOpen(true)}
          className="gap-2 bg-success text-success-foreground hover:bg-success/90"
        >
          <Plus className="h-4 w-4" />
          {t('cases.shareCase')}
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6 overflow-hidden" data-tour="cases-filters">
        <div className="h-1 bg-success" />
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('cases.searchPlaceholder')}
                value={filters.search}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                className="pl-9 h-11"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={filters.year || 'all'}
                onValueChange={(v) => setFilters((p) => ({ ...p, year: v === 'all' ? '' : v }))}
              >
                <SelectTrigger className="w-full sm:w-[130px] h-11">
                  <SelectValue placeholder={t('cases.filters.year')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('cases.filters.allYears')}</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.result || 'all'}
                onValueChange={(v) => setFilters((p) => ({ ...p, result: v === 'all' ? '' : v }))}
              >
                <SelectTrigger className="w-full sm:w-[130px] h-11">
                  <SelectValue placeholder={t('cases.filters.result')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('cases.filters.allResults')}</SelectItem>
                  <SelectItem value="ADMITTED">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                      {t('cases.result.admitted')}
                    </span>
                  </SelectItem>
                  <SelectItem value="REJECTED">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                      {t('cases.result.rejected')}
                    </span>
                  </SelectItem>
                  <SelectItem value="WAITLISTED">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                      {t('cases.result.waitlisted')}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.round || 'all'}
                onValueChange={(v) => setFilters((p) => ({ ...p, round: v === 'all' ? '' : v }))}
              >
                <SelectTrigger className="w-full sm:w-[130px] h-11">
                  <SelectValue placeholder={t('cases.filters.round')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('cases.filters.allRounds')}</SelectItem>
                  <SelectItem value="ED">ED</SelectItem>
                  <SelectItem value="ED2">ED2</SelectItem>
                  <SelectItem value="EA">EA</SelectItem>
                  <SelectItem value="REA">REA</SelectItem>
                  <SelectItem value="RD">RD</SelectItem>
                  <SelectItem value="UC">UC</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder={t('cases.filters.nationality')}
                value={filters.nationality}
                onChange={(e) => setFilters((p) => ({ ...p, nationality: e.target.value }))}
                className="w-full sm:w-[130px] h-11"
              />
            </div>
          </div>

          {(filters.year ||
            filters.result ||
            filters.round ||
            filters.nationality ||
            filters.search) && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{t('cases.activeFilters')}:</span>
              {filters.year && (
                <Badge variant="secondary" className="gap-1">
                  {filters.year}
                  <button
                    onClick={() => setFilters((p) => ({ ...p, year: '' }))}
                    className="ml-1 hover:text-destructive"
                    aria-label={t('common.clearAll')}
                  >
                    ×
                  </button>
                </Badge>
              )}
              {filters.result && (
                <Badge variant="secondary" className="gap-1">
                  {t(`cases.result.${filters.result.toLowerCase()}`)}
                  <button
                    onClick={() => setFilters((p) => ({ ...p, result: '' }))}
                    className="ml-1 hover:text-destructive"
                    aria-label={t('common.clearAll')}
                  >
                    ×
                  </button>
                </Badge>
              )}
              {filters.round && (
                <Badge variant="secondary" className="gap-1">
                  {filters.round}
                  <button
                    onClick={() => setFilters((p) => ({ ...p, round: '' }))}
                    className="ml-1 hover:text-destructive"
                    aria-label={t('common.clearAll')}
                  >
                    ×
                  </button>
                </Badge>
              )}
              {filters.nationality && (
                <Badge variant="secondary" className="gap-1">
                  {filters.nationality}
                  <button
                    onClick={() => setFilters((p) => ({ ...p, nationality: '' }))}
                    className="ml-1 hover:text-destructive"
                    aria-label={t('common.clearAll')}
                  >
                    ×
                  </button>
                </Badge>
              )}
              {filters.search && (
                <Badge variant="secondary" className="gap-1">
                  &ldquo;{filters.search}&rdquo;
                  <button
                    onClick={() => setFilters((p) => ({ ...p, search: '' }))}
                    className="ml-1 hover:text-destructive"
                    aria-label={t('common.clearAll')}
                  >
                    ×
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilters({ year: '', result: '', round: '', nationality: '', search: '' })
                }
                className="text-xs h-6"
              >
                {t('common.clearAll')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Case list */}
      {isLoading ? (
        <LoadingState variant="card" count={6} />
      ) : isError ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden">
            <div className="h-1 bg-destructive" />
            <CardContent className="py-8">
              <EmptyState
                type="error"
                title={t('ui.empty.loadFailed')}
                description={t('ui.empty.loadFailedDesc')}
                action={{
                  label: t('ui.empty.retryLoad'),
                  onClick: () => refetch(),
                }}
                size="lg"
              />
            </CardContent>
          </Card>
        </motion.div>
      ) : caseItems.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-tour="cases-grid">
          <AnimatePresence>
            {caseItems.map((caseItem: any, index: number) => (
              <motion.div
                key={caseItem.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <CaseCard
                  schoolName={caseItem.school?.name}
                  year={caseItem.year}
                  round={caseItem.round}
                  major={caseItem.major}
                  result={caseItem.result}
                  gpa={caseItem.gpaRange}
                  sat={caseItem.satRange}
                  toefl={caseItem.toeflRange}
                  tags={caseItem.tags}
                  rank={caseItem.school?.usNewsRank}
                  isVerified={caseItem.isVerified}
                  hasEssay={!!caseItem.essayContent}
                  onClick={() => router.push(`/${locale}/cases/${caseItem.id}`)}
                  onEssayClick={() => router.push(`/${locale}/cases?tab=essays&id=${caseItem.id}`)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden">
            <div className="h-1 bg-success/50" />
            <CardContent className="py-10">
              {hasFilters ? (
                <EmptyState
                  type="no-results"
                  title={t('schools.noResults')}
                  description={t('ui.empty.noResultsDesc')}
                  action={{
                    label: t('ui.empty.clearFilter'),
                    onClick: () =>
                      setFilters({ year: '', result: '', round: '', nationality: '', search: '' }),
                    variant: 'outline',
                  }}
                  size="lg"
                />
              ) : (
                <div className="flex flex-col items-center text-center max-w-md mx-auto space-y-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
                    <BookOpen className="h-7 w-7 text-success" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{t('cases.emptyState.title')}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('cases.emptyState.description')}
                    </p>
                  </div>
                  <ul className="space-y-2 text-left text-sm text-muted-foreground w-full">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {t('cases.emptyState.bullet1')}
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {t('cases.emptyState.bullet2')}
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {t('cases.emptyState.bullet3')}
                    </li>
                  </ul>
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={() => setSubmitDialogOpen(true)}
                      className="gap-2 bg-success text-success-foreground hover:bg-success/90"
                    >
                      <Plus className="h-4 w-4" />
                      {t('ui.empty.shareMine')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => startTour(TOURS.CASES)}>
                      {t('cases.emptyState.startTour')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
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
import { Search, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function CasesTab() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [filters, setFilters] = useState({
    year: '',
    result: '',
    search: '',
  });
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

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
  const hasFilters = filters.year || filters.result || filters.search;

  return (
    <>
      <SubmitCaseDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        onSuccess={() => refetch()}
      />

      <div className="flex justify-end mb-4">
        <Button
          onClick={() => setSubmitDialogOpen(true)}
          className="gap-2 bg-success hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t('cases.shareCase')}
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6 overflow-hidden">
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
            <div className="flex gap-2">
              <Select
                value={filters.year || 'all'}
                onValueChange={(v) => setFilters((p) => ({ ...p, year: v === 'all' ? '' : v }))}
              >
                <SelectTrigger className="w-[130px] h-11">
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
                <SelectTrigger className="w-[130px] h-11">
                  <SelectValue placeholder={t('cases.filters.result')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('cases.filters.allResults')}</SelectItem>
                  <SelectItem value="ADMITTED">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      {t('cases.result.admitted')}
                    </span>
                  </SelectItem>
                  <SelectItem value="REJECTED">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                      {t('cases.result.rejected')}
                    </span>
                  </SelectItem>
                  <SelectItem value="WAITLISTED">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      {t('cases.result.waitlisted')}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(filters.year || filters.result || filters.search) && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{t('cases.activeFilters')}:</span>
              {filters.year && (
                <Badge variant="secondary" className="gap-1">
                  {filters.year}
                  <button
                    onClick={() => setFilters((p) => ({ ...p, year: '' }))}
                    className="ml-1 hover:text-destructive"
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
                  >
                    ×
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ year: '', result: '', search: '' })}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <CardContent className="py-8">
              {hasFilters ? (
                <EmptyState
                  type="no-results"
                  title={t('schools.noResults')}
                  description={t('ui.empty.noResultsDesc')}
                  action={{
                    label: t('ui.empty.clearFilter'),
                    onClick: () => setFilters({ year: '', result: '', search: '' }),
                    variant: 'outline',
                  }}
                  size="lg"
                />
              ) : (
                <EmptyState
                  type="cases"
                  title={t('ui.empty.noCases')}
                  description={t('ui.empty.noCasesDesc')}
                  action={{
                    label: t('ui.empty.shareMine'),
                    onClick: () => setSubmitDialogOpen(true),
                    icon: <Plus className="h-4 w-4" />,
                  }}
                  size="lg"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </>
  );
}

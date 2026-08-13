'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api/client';
import { adminRoutes } from '@study-abroad/shared';
import { Play, Search, Eye, RefreshCw, Loader2 } from 'lucide-react';

import type {
  CoverageStats,
  FreshnessItem,
  PipelineRun,
  TestScrapeResult,
} from './essay-pipeline/types';
import { StatusBadge, PipelineStatusBadge, formatDuration } from './essay-pipeline/pipeline-badges';
import { TestScrapeDialog } from './essay-pipeline/test-scrape-dialog';

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === 'object') {
    const items = (value as { items?: unknown }).items;
    if (Array.isArray(items)) {
      return items as T[];
    }
  }

  return [];
}

function normalizeCoverage(value: unknown): CoverageStats | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const coverage = value as Partial<CoverageStats>;
  return {
    year: Number(coverage.year ?? new Date().getFullYear()),
    totalSchools: Number(coverage.totalSchools ?? 0),
    schoolsWithPrompts: Number(coverage.schoolsWithPrompts ?? 0),
    schoolsWithVerified: Number(coverage.schoolsWithVerified ?? 0),
    coveragePercent: Number(coverage.coveragePercent ?? 0),
    totalPrompts: Number(coverage.totalPrompts ?? 0),
    pendingReview: Number(coverage.pendingReview ?? 0),
  };
}

function safeDateLabel(value: unknown, fallback: string) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

function safeDurationLabel(startedAt: unknown, completedAt: unknown, fallback: string) {
  const start = startedAt ? new Date(startedAt as string | number | Date) : null;
  const end = completedAt ? new Date(completedAt as string | number | Date) : null;

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return fallback;
  }

  return formatDuration(start, end);
}

export function EssayPipelineDashboard() {
  const t = useTranslations('essayPipeline');

  const [coverage, setCoverage] = useState<CoverageStats | null>(null);
  const [freshness, setFreshness] = useState<FreshnessItem[]>([]);
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Test scrape dialog
  const [testScrapeOpen, setTestScrapeOpen] = useState(false);
  const [testScrapeResult, setTestScrapeResult] = useState<TestScrapeResult | null>(null);
  const [testScrapeLoading, setTestScrapeLoading] = useState(false);
  const [savingConfirm, setSavingConfirm] = useState(false);

  // Pipeline
  const [startingPipeline, setStartingPipeline] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [coverageRes, freshnessRes, runsRes] = await Promise.all([
        apiClient.get<CoverageStats>(adminRoutes.essayScraperCoverage()),
        apiClient.get<FreshnessItem[]>(adminRoutes.essayScraperFreshness()),
        apiClient.get<PipelineRun[]>(adminRoutes.essayScraperPipelineRuns()),
      ]);
      setCoverage(normalizeCoverage(coverageRes));
      setFreshness(normalizeArray<FreshnessItem>(freshnessRes));
      setPipelineRuns(normalizeArray<PipelineRun>(runsRes));
    } catch {
      toast.error(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============ Actions ============

  const handleStartPipeline = async () => {
    setStartingPipeline(true);
    try {
      await apiClient.post<{ runId: string; status: string }>(
        adminRoutes.essayScraperPipelineStart(),
        {}
      );
      toast.success(t('pipelineStarted'));
      setTimeout(fetchData, 1000);
    } catch {
      toast.error(t('pipelineStartFailed'));
    } finally {
      setStartingPipeline(false);
    }
  };

  const handleTestScrape = async (schoolName: string) => {
    setTestScrapeOpen(true);
    setTestScrapeLoading(true);
    setTestScrapeResult(null);
    try {
      const result = await apiClient.post<TestScrapeResult>(adminRoutes.essayScraperTestScrape(), {
        schoolName,
      });
      setTestScrapeResult(result);
    } catch {
      toast.error(t('testScrapeFailed'));
      setTestScrapeOpen(false);
    } finally {
      setTestScrapeLoading(false);
    }
  };

  const handleSingleScrape = async (schoolName: string) => {
    try {
      await apiClient.post(adminRoutes.essayScraperScrapeSchool(), {
        schoolName,
      });
      toast.success(t('scrapeStarted'));
      setTimeout(fetchData, 2000);
    } catch {
      toast.error(t('scrapeFailed'));
    }
  };

  const handleConfirmSave = async (selectedIndexes: number[]) => {
    if (!testScrapeResult) return;
    setSavingConfirm(true);
    try {
      const essays = selectedIndexes.map((i) => testScrapeResult.essays[i]);
      await apiClient.post(adminRoutes.essayScraperConfirmSave(), {
        schoolId: testScrapeResult.schoolId,
        schoolName: testScrapeResult.school,
        essays,
        year: testScrapeResult.year,
      });
      toast.success(t('savedSuccessfully'));
      setTestScrapeOpen(false);
      fetchData();
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSavingConfirm(false);
    }
  };

  // ============ Filter Logic ============

  const filteredFreshness = freshness.filter((item) => {
    const schoolName = item.school?.name ?? '';
    const schoolNameZh = item.school?.nameZh ?? '';

    if (groupFilter !== 'all' && item.scrapeGroup !== groupFilter) return false;
    if (statusFilter === 'scraped' && !item.lastScrapedAt) return false;
    if (statusFilter === 'not_scraped' && item.lastScrapedAt) return false;
    if (statusFilter === 'failed' && item.lastStatus !== 'FAILED') return false;
    if (
      searchQuery &&
      !schoolName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !schoolNameZh.includes(searchQuery)
    )
      return false;
    return true;
  });

  // ============ Render ============

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* A. Coverage Overview */}
      {coverage && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('coverage')}</CardDescription>
              <CardTitle className="text-subtitle">
                {coverage.schoolsWithVerified}/{coverage.totalSchools}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={coverage.coveragePercent} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{coverage.coveragePercent}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('totalPrompts')}</CardDescription>
              <CardTitle className="text-subtitle">{coverage.totalPrompts}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {t('year')}: {coverage.year}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('pendingReview')}</CardDescription>
              <CardTitle className="text-subtitle text-amber-600 dark:text-amber-400">
                {coverage.pendingReview}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{t('needsVerification')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('pipeline')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartPipeline} disabled={startingPipeline} className="w-full">
                {startingPipeline ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {t('startPipeline')}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* B. School Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('schoolSources')}</CardTitle>
          <CardDescription>{t('schoolSourcesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchSchool')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('group')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allGroups')}</SelectItem>
                <SelectItem value="COMMON_APP">CommonApp</SelectItem>
                <SelectItem value="UC">UC</SelectItem>
                <SelectItem value="COALITION">Coalition</SelectItem>
                <SelectItem value="GENERIC">Generic</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('statusFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses')}</SelectItem>
                <SelectItem value="scraped">{t('scraped')}</SelectItem>
                <SelectItem value="not_scraped">{t('notScraped')}</SelectItem>
                <SelectItem value="failed">{t('failed')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              aria-label={t('refresh') || 'Refresh'}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>{t('school')}</TableHead>
                  <TableHead>{t('group')}</TableHead>
                  <TableHead>{t('sourceType')}</TableHead>
                  <TableHead>{t('lastScraped')}</TableHead>
                  <TableHead>{t('statusLabel')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFreshness.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      {t('noSources')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFreshness.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">
                        {item.school?.usNewsRank || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {item.school?.name ?? t('unknownSchool')}
                          </span>
                          {item.school?.nameZh && (
                            <span className="text-muted-foreground text-sm ml-2">
                              {item.school.nameZh}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.scrapeGroup}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{item.sourceType}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {safeDateLabel(item.lastScrapedAt, t('never'))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.lastStatus} error={item.lastError} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestScrape(item.school?.name ?? '')}
                            title={t('testScrape')}
                            aria-label={t('testScrape')}
                            disabled={!item.school?.name}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSingleScrape(item.school?.name ?? '')}
                            title={t('scrapeNow')}
                            aria-label={t('scrapeNow')}
                            disabled={!item.school?.name}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* C. Pipeline Runs History */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pipelineHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {pipelineRuns.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t('noRuns')}</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('trigger')}</TableHead>
                    <TableHead>{t('year')}</TableHead>
                    <TableHead>{t('statusLabel')}</TableHead>
                    <TableHead>{t('schools')}</TableHead>
                    <TableHead>{t('results')}</TableHead>
                    <TableHead>{t('startedAt')}</TableHead>
                    <TableHead>{t('duration')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipelineRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Badge variant={run.trigger === 'MANUAL' ? 'default' : 'secondary'}>
                          {run.trigger}
                        </Badge>
                      </TableCell>
                      <TableCell>{run.year}</TableCell>
                      <TableCell>
                        <PipelineStatusBadge status={run.status} />
                      </TableCell>
                      <TableCell>{run.totalSchools}</TableCell>
                      <TableCell>
                        <span className="text-green-600 dark:text-green-400">
                          {run.successCount}
                        </span>
                        {' / '}
                        <span className="text-red-600 dark:text-red-400">{run.failedCount}</span>
                        {run.newPrompts > 0 && (
                          <span className="text-blue-600 dark:text-blue-400 ml-2">
                            +{run.newPrompts}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {safeDateLabel(run.startedAt, t('never'))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.completedAt
                          ? safeDurationLabel(run.startedAt, run.completedAt, t('never'))
                          : t('running')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* D. Test Scrape Preview Dialog */}
      <TestScrapeDialog
        open={testScrapeOpen}
        onOpenChange={setTestScrapeOpen}
        result={testScrapeResult}
        loading={testScrapeLoading}
        onConfirmSave={handleConfirmSave}
        saving={savingConfirm}
      />
    </div>
  );
}

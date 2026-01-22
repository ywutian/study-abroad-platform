'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api/client';
import {
  Play,
  Search,
  Settings,
  Eye,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ============ Types ============

interface CoverageStats {
  year: number;
  totalSchools: number;
  schoolsWithPrompts: number;
  schoolsWithVerified: number;
  coveragePercent: number;
  totalPrompts: number;
  pendingReview: number;
}

interface FreshnessItem {
  id: string;
  sourceType: string;
  url: string;
  scrapeGroup: string;
  lastScrapedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  school: {
    id: string;
    name: string;
    nameZh: string | null;
    usNewsRank: number | null;
  };
}

interface PipelineRun {
  id: string;
  trigger: string;
  year: number;
  status: string;
  totalSchools: number;
  successCount: number;
  failedCount: number;
  newPrompts: number;
  changedPrompts: number;
  startedAt: string;
  completedAt: string | null;
}

interface TestScrapeEssay {
  prompt: string;
  promptZh?: string;
  wordLimit?: number;
  type?: string;
  isRequired?: boolean;
  confidence?: number;
  changeType?: string;
  aiTips?: string;
  aiCategory?: string;
}

interface TestScrapeResult {
  school: string;
  schoolId?: string;
  source: string;
  scrapeGroup: string;
  year: number;
  essays: TestScrapeEssay[];
  rawContentPreview: string;
}

// ============ Main Component ============

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
  const [selectedEssays, setSelectedEssays] = useState<number[]>([]);
  const [savingConfirm, setSavingConfirm] = useState(false);

  // Pipeline
  const [startingPipeline, setStartingPipeline] = useState(false);

  // Raw content collapsed
  const [rawContentExpanded, setRawContentExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [coverageRes, freshnessRes, runsRes] = await Promise.all([
        apiClient.get<CoverageStats>('/admin/essay-scraper/dashboard/coverage'),
        apiClient.get<FreshnessItem[]>('/admin/essay-scraper/dashboard/freshness'),
        apiClient.get<PipelineRun[]>('/admin/essay-scraper/pipeline/runs'),
      ]);
      setCoverage(coverageRes);
      setFreshness(freshnessRes);
      setPipelineRuns(runsRes);
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
      const res = await apiClient.post<{ runId: string; status: string }>(
        '/admin/essay-scraper/pipeline/start',
        {}
      );
      toast.success(t('pipelineStarted'));
      // Refresh runs
      setTimeout(fetchData, 1000);
    } catch {
      toast.error(t('pipelineStartFailed'));
    } finally {
      setStartingPipeline(false);
    }
  };

  const handleTestScrape = async (schoolName: string) => {
    setTestScrapeOpen(true);
    setTestScrapeResult(null);
    setTestScrapeLoading(true);
    setSelectedEssays([]);
    setRawContentExpanded(false);

    try {
      const res = await apiClient.post<TestScrapeResult>('/admin/essay-scraper/test-scrape', {
        schoolName,
      });
      setTestScrapeResult(res);
      // Select all by default
      setSelectedEssays(res.essays.map((_, i) => i));
    } catch {
      toast.error(t('testScrapeFailed'));
      setTestScrapeOpen(false);
    } finally {
      setTestScrapeLoading(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!testScrapeResult) return;
    setSavingConfirm(true);
    try {
      const res = await apiClient.post<{ saved: number }>('/admin/essay-scraper/confirm-save', {
        data: testScrapeResult,
        selectedIndices: selectedEssays,
      });
      toast.success(t('savedCount', { count: res.saved }));
      setTestScrapeOpen(false);
      fetchData();
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSavingConfirm(false);
    }
  };

  const handleSingleScrape = async (schoolName: string) => {
    try {
      toast.info(t('scrapingSchool', { school: schoolName }));
      await apiClient.post('/admin/essay-scraper/scrape', { schoolName });
      toast.success(t('scrapeSuccess'));
      fetchData();
    } catch {
      toast.error(t('scrapeFailed'));
    }
  };

  // ============ Filter Logic ============

  const filteredFreshness = freshness.filter((item) => {
    if (groupFilter !== 'all' && item.scrapeGroup !== groupFilter) return false;
    if (statusFilter === 'scraped' && !item.lastScrapedAt) return false;
    if (statusFilter === 'not_scraped' && item.lastScrapedAt) return false;
    if (statusFilter === 'failed' && item.lastStatus !== 'FAILED') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.school.name.toLowerCase().includes(q) || (item.school.nameZh || '').includes(q);
    }
    return true;
  });

  const toggleEssaySelection = (index: number) => {
    setSelectedEssays((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

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
              <CardTitle className="text-2xl">
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
              <CardTitle className="text-2xl">{coverage.totalPrompts}</CardTitle>
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
              <CardTitle className="text-2xl text-amber-600">{coverage.pendingReview}</CardTitle>
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
          {/* Filters */}
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
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
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
                        {item.school.usNewsRank || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{item.school.name}</span>
                          {item.school.nameZh && (
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
                        {item.lastScrapedAt
                          ? new Date(item.lastScrapedAt).toLocaleDateString()
                          : t('never')}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.lastStatus} error={item.lastError} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestScrape(item.school.name)}
                            title={t('testScrape')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSingleScrape(item.school.name)}
                            title={t('scrapeNow')}
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
                        <span className="text-green-600">{run.successCount}</span>
                        {' / '}
                        <span className="text-red-600">{run.failedCount}</span>
                        {run.newPrompts > 0 && (
                          <span className="text-blue-600 ml-2">+{run.newPrompts}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(run.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.completedAt
                          ? formatDuration(new Date(run.startedAt), new Date(run.completedAt))
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
      <Dialog open={testScrapeOpen} onOpenChange={setTestScrapeOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('testScrapePreview')}</DialogTitle>
            <DialogDescription>
              {testScrapeResult
                ? `${testScrapeResult.school} — ${testScrapeResult.essays.length} ${t('essaysFound')}`
                : t('loading')}
            </DialogDescription>
          </DialogHeader>

          {testScrapeLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : testScrapeResult ? (
            <div className="space-y-4">
              {/* Meta info */}
              <div className="flex gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{testScrapeResult.scrapeGroup}</Badge>
                <span>{testScrapeResult.year}</span>
              </div>

              {/* Essays list */}
              {testScrapeResult.essays.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('noEssaysFound')}</div>
              ) : (
                <div className="space-y-3">
                  {testScrapeResult.essays.map((essay, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedEssays.includes(i)}
                          onCheckedChange={() => toggleEssaySelection(i)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium">{essay.prompt}</p>
                          {essay.promptZh && (
                            <p className="text-sm text-muted-foreground">{essay.promptZh}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {essay.type && (
                              <Badge variant="outline" className="text-xs">
                                {essay.type}
                              </Badge>
                            )}
                            {essay.wordLimit && (
                              <Badge variant="secondary" className="text-xs">
                                {essay.wordLimit} words
                              </Badge>
                            )}
                            {essay.confidence !== undefined && (
                              <Badge
                                variant={essay.confidence >= 0.8 ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {Math.round(essay.confidence * 100)}%
                              </Badge>
                            )}
                            {essay.changeType && <ChangeTypeBadge type={essay.changeType} />}
                            {essay.isRequired ? (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Optional
                              </Badge>
                            )}
                          </div>
                          {essay.aiTips && (
                            <p className="text-xs text-blue-600 mt-1">{essay.aiTips}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Raw content preview */}
              {testScrapeResult.rawContentPreview && (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRawContentExpanded(!rawContentExpanded)}
                    className="gap-1 text-xs"
                  >
                    {rawContentExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    {t('rawContent')}
                  </Button>
                  {rawContentExpanded && (
                    <pre className="text-xs bg-muted p-3 rounded-md mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {testScrapeResult.rawContentPreview}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestScrapeOpen(false)}>
              {t('cancel')}
            </Button>
            {testScrapeResult && testScrapeResult.essays.length > 0 && (
              <Button
                onClick={handleConfirmSave}
                disabled={savingConfirm || selectedEssays.length === 0}
              >
                {savingConfirm ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {t('confirmSave', { count: selectedEssays.length })}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Sub-components ============

function StatusBadge({ status, error }: { status: string | null; error: string | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  }
  if (status === 'SUCCESS') {
    return (
      <Badge
        variant="default"
        className="text-xs gap-1 bg-green-100 text-green-800 hover:bg-green-100"
      >
        <CheckCircle2 className="h-3 w-3" />
        OK
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-xs gap-1" title={error || ''}>
      <XCircle className="h-3 w-3" />
      Failed
    </Badge>
  );
}

function PipelineStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'RUNNING':
      return (
        <Badge className="text-xs gap-1 bg-blue-100 text-blue-800 hover:bg-blue-100">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge className="text-xs gap-1 bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function ChangeTypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'NEW':
      return <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">NEW</Badge>;
    case 'MODIFIED':
      return (
        <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100">MODIFIED</Badge>
      );
    case 'UNCHANGED':
      return (
        <Badge className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-100">UNCHANGED</Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {type}
        </Badge>
      );
  }
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

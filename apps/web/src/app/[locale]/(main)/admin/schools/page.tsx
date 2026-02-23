'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
import { PageHeader } from '@/components/layout';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';
import { toast } from 'sonner';
import {
  GraduationCap,
  Search,
  Database,
  Globe,
  Calendar,
  RefreshCw,
  Loader2,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface School {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  state?: string;
  acceptanceRate?: number;
  tuition?: number;
  metadata?: {
    deadlines?: Record<string, string>;
    applicationType?: string;
    essayCount?: number;
    applicationCycle?: string;
    dataUpdated?: string;
  };
}

interface DataQualityReport {
  summary: {
    total: number;
    fullyComplete: number;
    missingCritical: number;
    averageCompleteness: number;
  };
  fieldCoverage: Record<string, { filled: number; missing: number; percent: number }>;
  worstSchools: Array<{
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
    missingFields: string[];
    completeness: number;
  }>;
}

// Human-readable field names for display
const FIELD_LABELS: Record<string, { en: string; zh: string }> = {
  acceptanceRate: { en: 'Acceptance Rate', zh: '录取率' },
  tuition: { en: 'Tuition', zh: '学费' },
  satAvg: { en: 'SAT Average', zh: 'SAT 均分' },
  actAvg: { en: 'ACT Average', zh: 'ACT 均分' },
  studentCount: { en: 'Student Count', zh: '学生人数' },
  graduationRate: { en: 'Graduation Rate', zh: '毕业率' },
  city: { en: 'City', zh: '城市' },
  website: { en: 'Website', zh: '官网' },
  description: { en: 'Description (EN)', zh: '描述 (英文)' },
  descriptionZh: { en: 'Description (ZH)', zh: '描述 (中文)' },
  sat25: { en: 'SAT 25th', zh: 'SAT 25%' },
  sat75: { en: 'SAT 75th', zh: 'SAT 75%' },
  nameZh: { en: 'Chinese Name', zh: '中文名' },
  state: { en: 'State', zh: '州' },
  isPrivate: { en: 'School Type', zh: '学校类型' },
};

export default function AdminSchoolsPage() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [schoolSearch, setSchoolSearch] = useState('');
  const [syncLimit, setSyncLimit] = useState('100');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: schoolsData, isLoading } = useQuery({
    queryKey: ['adminSchools', schoolSearch, page],
    queryFn: () =>
      apiClient.get<{ items: School[]; total: number }>('/schools', {
        params: { search: schoolSearch ?? '', pageSize: String(pageSize), page: String(page) },
      }),
  });

  const {
    data: qualityData,
    isLoading: isQualityLoading,
    refetch: refetchQuality,
  } = useQuery({
    queryKey: ['schoolDataQuality'],
    queryFn: () => apiClient.get<DataQualityReport>('/schools/admin/data-quality'),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const syncScorecardMutation = useMutation({
    mutationFn: (limit: number) =>
      apiClient.post<{ synced: number; errors: number }>(`/schools/sync/scorecard?limit=${limit}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      queryClient.invalidateQueries({ queryKey: ['schoolDataQuality'] });
      toast.success(t('toast.syncComplete', { count: data.synced }));
    },
  });

  const scrapeSchoolsMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ success: string[]; failed: { school: string; error: string }[] }>(
        '/schools/scrape/all'
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      toast.success(t('toast.scrapeComplete', { count: data.success.length }));
    },
  });

  const totalPages = schoolsData ? Math.ceil(schoolsData.total / pageSize) : 1;

  const getFieldLabel = (field: string) => {
    const label = FIELD_LABELS[field];
    if (!label) return field;
    return locale === 'zh' ? label.zh : label.en;
  };

  const getCoverageColor = (percent: number) => {
    if (percent >= 90) return 'text-green-600';
    if (percent >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return '[&>div]:bg-green-500';
    if (percent >= 70) return '[&>div]:bg-yellow-500';
    return '[&>div]:bg-red-500';
  };

  return (
    <>
      <PageHeader
        title={t('sidebar.schools')}
        description={t('data.pageDesc')}
        icon={GraduationCap}
        color="emerald"
      />

      <div className="mt-6">
        <Tabs defaultValue="schools" className="space-y-6">
          <TabsList>
            <TabsTrigger value="schools" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t('sidebar.schools')}
            </TabsTrigger>
            <TabsTrigger value="quality" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('dataQuality.title')}
            </TabsTrigger>
          </TabsList>

          {/* =================== Schools Tab =================== */}
          <TabsContent value="schools" className="space-y-6">
            {/* Data Sync Actions */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    {t('data.syncScorecard')}
                  </CardTitle>
                  <CardDescription>{t('data.syncScorecardDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Select value={syncLimit} onValueChange={setSyncLimit}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                        <SelectItem value="1000">1000</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => syncScorecardMutation.mutate(parseInt(syncLimit))}
                      disabled={syncScorecardMutation.isPending}
                    >
                      {syncScorecardMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      {t('data.startSync')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {t('data.scrapeSchools')}
                  </CardTitle>
                  <CardDescription>{t('data.scrapeSchoolsDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => scrapeSchoolsMutation.mutate()}
                    disabled={scrapeSchoolsMutation.isPending}
                    variant="outline"
                  >
                    {scrapeSchoolsMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {t('data.startScrape')}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t('data.status')}
                  </CardTitle>
                  <CardDescription>{t('data.statusDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{schoolsData?.total || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">{t('data.cycle')}: 2025-2026</p>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('data.searchPlaceholder')}
                value={schoolSearch}
                onChange={(e) => {
                  setSchoolSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Schools Table */}
            {isLoading ? (
              <ListSkeleton count={5} />
            ) : schoolsData?.items && schoolsData.items.length > 0 ? (
              <>
                <Card>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">{t('data.rank')}</TableHead>
                          <TableHead>{t('data.schoolName')}</TableHead>
                          <TableHead>{t('data.state')}</TableHead>
                          <TableHead>{t('data.applicationType')}</TableHead>
                          <TableHead>{t('data.deadline')}</TableHead>
                          <TableHead>{t('data.acceptanceRate')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schoolsData.items.map((school) => (
                          <TableRow key={school.id}>
                            <TableCell>
                              {school.usNewsRank ? (
                                <Badge variant="outline">#{school.usNewsRank}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{getSchoolName(school, locale)}</div>
                                {getSchoolSubName(school, locale) && (
                                  <div className="text-xs text-muted-foreground">
                                    {getSchoolSubName(school, locale)}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{school.state || '-'}</TableCell>
                            <TableCell>
                              {school.metadata?.applicationType ? (
                                <Badge variant="secondary">
                                  {school.metadata.applicationType.toUpperCase()}
                                </Badge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {school.metadata?.deadlines ? (
                                <div className="text-xs">
                                  {school.metadata.deadlines.rea && (
                                    <div>REA: {school.metadata.deadlines.rea}</div>
                                  )}
                                  {school.metadata.deadlines.ea && (
                                    <div>EA: {school.metadata.deadlines.ea}</div>
                                  )}
                                  {school.metadata.deadlines.ed && (
                                    <div>ED: {school.metadata.deadlines.ed}</div>
                                  )}
                                  {school.metadata.deadlines.rd && (
                                    <div>RD: {school.metadata.deadlines.rd}</div>
                                  )}
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {school.acceptanceRate
                                ? `${Number(school.acceptanceRate).toFixed(1)}%`
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  total={schoolsData.total ?? 0}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              </>
            ) : (
              <EmptyState
                icon={<GraduationCap className="h-12 w-12" />}
                title={t('schools.notFound')}
                description={t('schools.tryOther')}
              />
            )}
          </TabsContent>

          {/* =================== Data Quality Tab =================== */}
          <TabsContent value="quality" className="space-y-6">
            {/* Refresh Button */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{t('dataQuality.description')}</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchQuality()}
                disabled={isQualityLoading}
              >
                {isQualityLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {isQualityLoading ? t('dataQuality.refreshing') : t('dataQuality.refresh')}
              </Button>
            </div>

            {isQualityLoading ? (
              <ListSkeleton count={4} />
            ) : qualityData ? (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{t('dataQuality.totalSchools')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-muted-foreground" />
                        <span className="text-2xl font-bold">{qualityData.summary.total}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{t('dataQuality.fullyComplete')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="text-2xl font-bold text-green-600">
                          {qualityData.summary.fullyComplete}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{t('dataQuality.missingCritical')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        <span className="text-2xl font-bold text-yellow-600">
                          {qualityData.summary.missingCritical}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{t('dataQuality.avgCompleteness')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                        <span className="text-2xl font-bold">
                          {qualityData.summary.averageCompleteness}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Field Coverage */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t('dataQuality.fieldCoverage')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(qualityData.fieldCoverage)
                        .sort(([, a], [, b]) => a.percent - b.percent)
                        .map(([field, stats]) => (
                          <div key={field} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{getFieldLabel(field)}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground text-xs">
                                  {stats.filled}/{stats.filled + stats.missing}
                                </span>
                                <span
                                  className={cn(
                                    'font-semibold tabular-nums w-14 text-right',
                                    getCoverageColor(stats.percent)
                                  )}
                                >
                                  {stats.percent}%
                                </span>
                              </div>
                            </div>
                            <Progress
                              value={stats.percent}
                              className={cn('h-2', getProgressColor(stats.percent))}
                            />
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Worst Schools Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t('dataQuality.worstSchools')}</CardTitle>
                    <CardDescription>{t('dataQuality.worstSchoolsDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {qualityData.worstSchools.length === 0 ? (
                      <EmptyState
                        icon={<CheckCircle2 className="h-10 w-10 text-green-500" />}
                        title={t('dataQuality.noIssues')}
                      />
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[60px]">{t('data.rank')}</TableHead>
                              <TableHead>{t('data.schoolName')}</TableHead>
                              <TableHead>{t('dataQuality.completeness')}</TableHead>
                              <TableHead>{t('dataQuality.missingFields')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {qualityData.worstSchools.map((school) => (
                              <TableRow key={school.id}>
                                <TableCell>
                                  {school.usNewsRank ? (
                                    <Badge variant="outline">#{school.usNewsRank}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">
                                      {locale === 'zh' && school.nameZh
                                        ? school.nameZh
                                        : school.name}
                                    </div>
                                    {locale === 'zh' && school.nameZh && (
                                      <div className="text-xs text-muted-foreground">
                                        {school.name}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Progress
                                      value={school.completeness}
                                      className={cn(
                                        'h-2 w-16',
                                        getProgressColor(school.completeness)
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        'text-sm font-medium tabular-nums',
                                        getCoverageColor(school.completeness)
                                      )}
                                    >
                                      {school.completeness}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {school.missingFields.slice(0, 5).map((field) => (
                                      <Badge
                                        key={field}
                                        variant="destructive"
                                        className="text-xs font-normal"
                                      >
                                        {getFieldLabel(field)}
                                      </Badge>
                                    ))}
                                    {school.missingFields.length > 5 && (
                                      <Badge variant="secondary" className="text-xs font-normal">
                                        +{school.missingFields.length - 5}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <EmptyState
                icon={<XCircle className="h-12 w-12" />}
                title="Failed to load data quality report"
                description="Please try refreshing"
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

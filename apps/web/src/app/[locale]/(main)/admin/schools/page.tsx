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
import { Link } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { cn, getSchoolName, getSchoolSubName, formatAcceptanceRate } from '@/lib/utils';
import { SchoolLogo } from '@/components/features';
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
  Pencil,
  ImageIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface School {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  state?: string;
  acceptanceRate?: number;
  tuition?: number;
  website?: string;
  logoUrl?: string;
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
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [editOpen, setEditOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [editForm, setEditForm] = useState<{
    logoUrl: string;
    name?: string;
    nameZh?: string;
    website?: string;
  }>({
    logoUrl: '',
  });
  const [editPreviewFailed, setEditPreviewFailed] = useState(false);

  const { data: schoolsData, isLoading } = useQuery({
    queryKey: ['adminSchools', schoolSearch, page],
    queryFn: () =>
      apiClient.get<{ items: School[]; total: number }>('/schools', {
        params: { search: schoolSearch ?? '', pageSize: String(pageSize), page: String(page) },
      }),
  });

  const { data: logoFillStatus } = useQuery({
    queryKey: ['adminLogoFillStatus'],
    queryFn: () => apiClient.get<{ configured: boolean }>('/schools/admin/logo-fill-status'),
  });
  const logoFillConfigured = logoFillStatus?.configured ?? false;

  const {
    data: qualityData,
    isLoading: isQualityLoading,
    refetch: refetchQuality,
  } = useQuery({
    queryKey: ['schoolDataQuality'],
    queryFn: () => apiClient.get<DataQualityReport>('/schools/admin/data-quality'),
    staleTime: 60 * 60 * 1000, // 1 hour
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

  const updateSchoolMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(`/schools/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      queryClient.invalidateQueries({ queryKey: ['school', id] });
      setEditOpen(false);
      setEditingSchool(null);
      toast.success(t('schools.saveSuccess'));
    },
  });

  const fillLogosMutation = useMutation({
    mutationFn: (limit: number) =>
      apiClient.post<{
        filled: number;
        failed: number;
        skipped: number;
        message?: string;
      }>('/schools/admin/fill-logos-by-domain', { limit }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      if (data.message) toast.info(data.message);
      else
        toast.success(
          t('schools.fillByDomainSuccess', {
            filled: data.filled,
            failed: data.failed,
          })
        );
    },
    onError: () => {
      toast.error(t('schools.fillByDomainError'));
    },
  });

  const fetchLogoSuggestionMutation = useMutation({
    mutationFn: (schoolId: string) =>
      apiClient.get<{ suggestedLogoUrl: string }>(`/schools/${schoolId}/logo-suggestion`),
    onSuccess: (data) => {
      setEditForm((prev) => ({ ...prev, logoUrl: data.suggestedLogoUrl }));
      setEditPreviewFailed(false);
      toast.success(t('schools.generateFromDomainDone'));
    },
    onError: () => {
      toast.error(t('schools.generateFromDomainError'));
    },
  });

  const openEdit = (school: School) => {
    setEditingSchool(school);
    setEditForm({
      logoUrl: school.logoUrl ?? '',
      name: school.name,
      nameZh: school.nameZh ?? '',
      website: school.website ?? '',
    });
    setEditPreviewFailed(false);
    setEditOpen(true);
  };

  const isValidUrl = (s: string) => {
    if (!s.trim()) return true;
    try {
      new URL(s);
      return true;
    } catch {
      return false;
    }
  };

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
                    {t('data.goToDataUpdates')}
                  </CardTitle>
                  <CardDescription>{t('data.goToDataUpdatesDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link href="/admin/data-updates">{t('data.goToDataUpdates')}</Link>
                  </Button>
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

              {logoFillConfigured && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      {t('schools.fillByDomain')}
                    </CardTitle>
                    <CardDescription>{t('schools.fillByDomainDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      disabled={fillLogosMutation.isPending}
                      onClick={() => {
                        if (window.confirm(t('schools.fillByDomainConfirm'))) {
                          fillLogosMutation.mutate(100);
                        }
                      }}
                    >
                      {fillLogosMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="mr-2 h-4 w-4" />
                      )}
                      {t('schools.fillByDomainButton')}
                    </Button>
                  </CardContent>
                </Card>
              )}

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
                          <TableHead className="w-[50px]">{t('data.logo')}</TableHead>
                          <TableHead className="w-[60px]">{t('data.rank')}</TableHead>
                          <TableHead>{t('data.schoolName')}</TableHead>
                          <TableHead>{t('data.state')}</TableHead>
                          <TableHead>{t('data.applicationType')}</TableHead>
                          <TableHead>{t('data.deadline')}</TableHead>
                          <TableHead>{t('data.acceptanceRate')}</TableHead>
                          <TableHead className="w-[80px]">{t('data.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schoolsData.items.map((school) => (
                          <TableRow key={school.id}>
                            <TableCell>
                              <SchoolLogo
                                logoUrl={school.logoUrl}
                                name={getSchoolName(school, locale)}
                                size="sm"
                                className="rounded-md"
                              />
                            </TableCell>
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
                            <TableCell>{formatAcceptanceRate(school.acceptanceRate)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                onClick={() => openEdit(school)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                {t('common.edit')}
                              </Button>
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

        {/* Edit School Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('schools.editSchool')}</DialogTitle>
              <DialogDescription>
                {editingSchool ? getSchoolName(editingSchool, locale) : t('schools.editSchoolDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label htmlFor="edit-logoUrl">{t('schools.logoUrl')}</Label>
                  <div className="flex items-center gap-1">
                    {editForm.logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => {
                          setEditForm((prev) => ({ ...prev, logoUrl: '' }));
                          setEditPreviewFailed(false);
                        }}
                      >
                        {t('schools.clearLogo')}
                      </Button>
                    )}
                    {editingSchool?.website && logoFillConfigured && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        disabled={fetchLogoSuggestionMutation.isPending}
                        onClick={() =>
                          editingSchool && fetchLogoSuggestionMutation.mutate(editingSchool.id)
                        }
                      >
                        {fetchLogoSuggestionMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                        {t('schools.generateFromDomain')}
                      </Button>
                    )}
                  </div>
                </div>
                <Input
                  id="edit-logoUrl"
                  placeholder={t('schools.logoUrlPlaceholder')}
                  value={editForm.logoUrl}
                  onChange={(e) => {
                    setEditForm((prev) => ({ ...prev, logoUrl: e.target.value }));
                    setEditPreviewFailed(false);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('schools.logoPreview')}</Label>
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                  {editForm.logoUrl && !editPreviewFailed ? (
                    <img
                      src={editForm.logoUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => setEditPreviewFailed(true)}
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={
                  updateSchoolMutation.isPending ||
                  (editForm.logoUrl.trim() !== '' && !isValidUrl(editForm.logoUrl.trim()))
                }
                onClick={() => {
                  if (!editingSchool) return;
                  const payload: Record<string, unknown> = {};
                  if (editForm.logoUrl !== (editingSchool.logoUrl ?? ''))
                    payload.logoUrl = editForm.logoUrl.trim() || null;
                  if (editForm.name !== editingSchool.name) payload.name = editForm.name;
                  if (editForm.nameZh !== (editingSchool.nameZh ?? ''))
                    payload.nameZh = editForm.nameZh || null;
                  if (editForm.website !== (editingSchool.website ?? ''))
                    payload.website = editForm.website || null;
                  if (Object.keys(payload).length === 0) {
                    setEditOpen(false);
                    return;
                  }
                  updateSchoolMutation.mutate({ id: editingSchool.id, data: payload });
                }}
              >
                {updateSchoolMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('common.save')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

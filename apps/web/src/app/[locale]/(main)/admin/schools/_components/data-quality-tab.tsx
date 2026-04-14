'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import {
  Database,
  RefreshCw,
  Loader2,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface DataQualityReport {
  summary: {
    total: number;
    fullyComplete: number;
    missingCritical: number;
    averageCompleteness: number;
  };
  fieldCoverage: Record<string, { filled: number; missing: number; percent: number }>;
  tierDistribution: Record<string, { count: number; percent: number }>;
  predictionEligibleCoverage: Record<string, { eligible: number; total: number; percent: number }>;
  top200OfficialCoverage: {
    schools: number;
    covered: number;
    totalSlots: number;
    percent: number;
    threshold: number;
  };
  staleFields: Array<{
    schoolId: string;
    schoolName: string;
    schoolNameZh?: string;
    field: string;
    tier: string;
    source: string;
    fetchedAt: string;
    staleness: string;
    usNewsRank?: number;
  }>;
  worstSchools: Array<{
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
    missingFields: string[];
    completeness: number;
  }>;
}

// Human-readable field names
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

interface DataQualityTabProps {
  qualityData: DataQualityReport | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}

export function DataQualityTab({ qualityData, isLoading, onRefresh }: DataQualityTabProps) {
  const t = useTranslations('admin');
  const locale = useLocale();

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
      {/* Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('dataQuality.description')}</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {isLoading ? t('dataQuality.refreshing') : t('dataQuality.refresh')}
        </Button>
      </div>

      {isLoading ? (
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

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('dataQuality.top200OfficialCoverage')}
                </CardTitle>
                <CardDescription>{t('dataQuality.top200OfficialCoverageDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-3xl font-bold">
                      {qualityData.top200OfficialCoverage.percent}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {qualityData.top200OfficialCoverage.covered}/
                      {qualityData.top200OfficialCoverage.totalSlots}
                    </div>
                  </div>
                  <Badge
                    variant={
                      qualityData.top200OfficialCoverage.percent >=
                      qualityData.top200OfficialCoverage.threshold
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {t('dataQuality.threshold', {
                      value: qualityData.top200OfficialCoverage.threshold,
                    })}
                  </Badge>
                </div>
                <Progress
                  value={qualityData.top200OfficialCoverage.percent}
                  className={cn(
                    'h-2',
                    getProgressColor(qualityData.top200OfficialCoverage.percent)
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('dataQuality.tierDistribution')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {Object.entries(qualityData.tierDistribution).map(([tier, stats]) => (
                  <div key={tier} className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{tier}</div>
                    <div className="mt-1 text-xl font-semibold">{stats.count}</div>
                    <div className="text-sm text-muted-foreground">{stats.percent}%</div>
                  </div>
                ))}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('dataQuality.predictionEligibleCoverage')}
              </CardTitle>
              <CardDescription>{t('dataQuality.predictionEligibleCoverageDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(qualityData.predictionEligibleCoverage)
                  .sort(([, a], [, b]) => a.percent - b.percent)
                  .slice(0, 12)
                  .map(([field, stats]) => (
                    <div key={field} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{getFieldLabel(field)}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground text-xs">
                            {stats.eligible}/{stats.total}
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
                              <Badge variant="outline">US News #{school.usNewsRank}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {locale === 'zh' && school.nameZh ? school.nameZh : school.name}
                              </div>
                              {locale === 'zh' && school.nameZh && (
                                <div className="text-xs text-muted-foreground">{school.name}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={school.completeness}
                                className={cn('h-2 w-16', getProgressColor(school.completeness))}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dataQuality.staleFields')}</CardTitle>
              <CardDescription>{t('dataQuality.staleFieldsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {qualityData.staleFields.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-10 w-10 text-green-500" />}
                  title={t('dataQuality.noStaleFields')}
                />
              ) : (
                <ScrollArea className="h-[320px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">{t('data.rank')}</TableHead>
                        <TableHead>{t('data.schoolName')}</TableHead>
                        <TableHead>{t('dataQuality.field')}</TableHead>
                        <TableHead>{t('dataQuality.source')}</TableHead>
                        <TableHead>{t('dataQuality.staleness')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qualityData.staleFields.map((field) => (
                        <TableRow key={`${field.schoolId}:${field.field}`}>
                          <TableCell>
                            {field.usNewsRank ? (
                              <Badge variant="outline">US News #{field.usNewsRank}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {locale === 'zh' && field.schoolNameZh
                              ? field.schoolNameZh
                              : field.schoolName}
                          </TableCell>
                          <TableCell>{getFieldLabel(field.field)}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div>{field.source}</div>
                              <Badge variant="outline">{field.tier}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="destructive">{field.staleness}</Badge>
                              <div className="text-xs text-muted-foreground">
                                {new Date(field.fetchedAt).toLocaleDateString(locale)}
                              </div>
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
    </>
  );
}

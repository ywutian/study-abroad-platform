'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { GraduationCap, Search, Database, Globe, Calendar, RefreshCw, Loader2 } from 'lucide-react';

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

  const syncScorecardMutation = useMutation({
    mutationFn: (limit: number) =>
      apiClient.post<{ synced: number; errors: number }>(`/schools/sync/scorecard?limit=${limit}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      toast.success(t('toast.syncComplete', { count: data.synced }));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.syncFailed'));
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
    onError: (error: Error) => {
      toast.error(error.message || t('toast.scrapeFailed'));
    },
  });

  const totalPages = schoolsData ? Math.ceil(schoolsData.total / pageSize) : 1;

  return (
    <>
      <PageHeader
        title={t('sidebar.schools')}
        description={t('data.pageDesc')}
        icon={GraduationCap}
        color="emerald"
      />

      <div className="mt-6 space-y-6">
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
      </div>
    </>
  );
}

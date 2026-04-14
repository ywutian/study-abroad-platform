'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiClient, STALE_TIME } from '@/lib/api';
import { adminRoutes, schoolRoutes } from '@study-abroad/shared';

import { toast } from 'sonner';
import {
  GraduationCap,
  Database,
  Globe,
  Calendar,
  RefreshCw,
  Loader2,
  BarChart3,
  ImageIcon,
} from 'lucide-react';
import { SchoolsList } from './_components/schools-list';
import { DataQualityTab } from './_components/data-quality-tab';
import { DataSyncTab } from './_components/data-sync-tab';
import { EditSchoolDialog } from './_components/edit-school-dialog';
import { SchoolCommunityRatingsDialog } from './_components/school-community-ratings-dialog';

interface School {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  qsRank?: number;
  state?: string;
  acceptanceRate?: number;
  graduationRate?: number;
  retentionRate?: number;
  studentFacultyRatio?: number;
  tuition?: number;
  applicationFee?: number;
  averageAidPackage?: number;
  averageNetPrice?: number;
  roomAndBoard?: number;
  percentNeedMet?: number;
  testOptional?: boolean;
  hasEarlyDecision?: boolean;
  acceptsCommonApp?: boolean;
  acceptsCoalition?: boolean;
  feeWaiverAvailable?: boolean;
  needBlindInternational?: boolean;
  avgSalary?: number;
  salary6YrPostGrad?: number;
  website?: string;
  logoUrl?: string;
  metadata?: {
    deadlines?: Record<string, string>;
    applicationType?: string;
    essayCount?: number;
    applicationCycle?: string;
    dataUpdated?: string;
    requirements?: { toeflMin?: number; ieltsMin?: number };
  };
  communityRatingSummary?: {
    count: number;
    isPublic: boolean;
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

const VALID_TABS = ['schools', 'quality', 'sync'] as const;
type SchoolsTab = (typeof VALID_TABS)[number];

export default function AdminSchoolsPage() {
  const t = useTranslations('admin');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const initialTab = VALID_TABS.includes(searchParams.get('tab') as SchoolsTab)
    ? (searchParams.get('tab') as SchoolsTab)
    : 'schools';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'schools') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(`/admin/schools${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const [schoolSearch, setSchoolSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [editOpen, setEditOpen] = useState(false);
  const [scrapeConfirmOpen, setScrapeConfirmOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [communityDialogOpen, setCommunityDialogOpen] = useState(false);
  const [communitySchool, setCommunitySchool] = useState<School | null>(null);

  const { data: schoolsData, isLoading } = useQuery({
    queryKey: ['adminSchools', schoolSearch, page],
    queryFn: () =>
      apiClient.get<{ items: School[]; total: number }>(schoolRoutes.list(), {
        params: { search: schoolSearch ?? '', pageSize: String(pageSize), page: String(page) },
      }),
  });

  const { data: logoFillStatus } = useQuery({
    queryKey: ['adminLogoFillStatus'],
    queryFn: () => apiClient.get<{ configured: boolean }>(adminRoutes.schoolsLogoFillStatus()),
  });
  const logoFillConfigured = logoFillStatus?.configured ?? false;

  const {
    data: qualityData,
    isLoading: isQualityLoading,
    refetch: refetchQuality,
  } = useQuery({
    queryKey: ['schoolDataQuality'],
    queryFn: () => apiClient.get<DataQualityReport>(adminRoutes.schoolsDataQuality()),
    staleTime: STALE_TIME.STATIC,
  });

  const scrapeSchoolsMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ success: string[]; failed: { school: string; error: string }[] }>(
        schoolRoutes.scrapeAll()
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      toast.success(t('toast.scrapeComplete', { count: data.success.length }));
    },
  });

  const updateSchoolMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(schoolRoutes.byId(id), data),
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
      apiClient.post<{ filled: number; failed: number; skipped: number; message?: string }>(
        adminRoutes.schoolsFillLogosByDomain(),
        { limit }
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      if (data.message) toast.info(data.message);
      else
        toast.success(
          t('schools.fillByDomainSuccess', { filled: data.filled, failed: data.failed })
        );
    },
    onError: () => {
      toast.error(t('schools.fillByDomainError'));
    },
  });

  const fetchLogoSuggestionMutation = useMutation({
    mutationFn: (schoolId: string) =>
      apiClient.get<{ suggestedLogoUrl: string }>(schoolRoutes.logoSuggestion(schoolId)),
    onSuccess: (data) => {
      toast.success(t('schools.generateFromDomainDone'));
      setEditingSchool((prev) => (prev ? { ...prev, logoUrl: data.suggestedLogoUrl } : prev));
    },
    onError: () => {
      toast.error(t('schools.generateFromDomainError'));
    },
  });

  const openEdit = (school: School) => {
    setEditingSchool(school);
    setEditOpen(true);
  };

  const openCommunity = (school: School) => {
    setCommunitySchool(school);
    setCommunityDialogOpen(true);
  };

  const totalPages = schoolsData ? Math.ceil(schoolsData.total / pageSize) : 1;

  return (
    <>
      <PageHeader
        title={t('sidebar.schools')}
        description={t('data.pageDesc')}
        icon={GraduationCap}
        color="emerald"
      />

      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="schools" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t('sidebar.schools')}
            </TabsTrigger>
            <TabsTrigger value="quality" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('dataQuality.title')}
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('sidebar.dataSync')}
            </TabsTrigger>
          </TabsList>

          {/* Schools Tab */}
          <TabsContent value="schools" className="space-y-6">
            {/* Data Sync Actions */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    onClick={() => setScrapeConfirmOpen(true)}
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
                  <ConfirmDialog
                    open={scrapeConfirmOpen}
                    onOpenChange={setScrapeConfirmOpen}
                    title={t('data.scrapeConfirm.title')}
                    description={t('data.scrapeConfirm.description')}
                    type="warning"
                    confirmLabel={t('data.scrapeConfirm.confirm')}
                    onConfirm={() => scrapeSchoolsMutation.mutate()}
                    loading={scrapeSchoolsMutation.isPending}
                  />
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

            <SchoolsList
              schools={schoolsData?.items ?? []}
              total={schoolsData?.total ?? 0}
              isLoading={isLoading}
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              search={schoolSearch}
              onSearchChange={(s) => {
                setSchoolSearch(s);
                setPage(1);
              }}
              onPageChange={setPage}
              onEdit={openEdit}
              onViewCommunity={openCommunity}
            />
          </TabsContent>

          {/* Data Quality Tab */}
          <TabsContent value="quality" className="space-y-6">
            <DataQualityTab
              qualityData={qualityData}
              isLoading={isQualityLoading}
              onRefresh={() => refetchQuality()}
            />
          </TabsContent>

          {/* Data Sync Tab */}
          <TabsContent value="sync" className="space-y-6">
            <DataSyncTab />
          </TabsContent>
        </Tabs>

        <EditSchoolDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          school={editingSchool}
          logoFillConfigured={logoFillConfigured}
          onSave={(id, data) => updateSchoolMutation.mutate({ id, data })}
          onGenerateLogo={(schoolId) => fetchLogoSuggestionMutation.mutate(schoolId)}
          isSaving={updateSchoolMutation.isPending}
          isGenerating={fetchLogoSuggestionMutation.isPending}
        />
        <SchoolCommunityRatingsDialog
          open={communityDialogOpen}
          onOpenChange={setCommunityDialogOpen}
          school={communitySchool}
        />
      </div>
    </>
  );
}

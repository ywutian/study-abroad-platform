'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout';
import { CaseCard, SubmitCaseDialog } from '@/components/features';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, Filter, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function CasesPage() {
  const t = useTranslations();
  const [filters, setFilters] = useState({
    year: '',
    result: '',
    search: '',
  });
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const { data: cases, isLoading, refetch } = useQuery({
    queryKey: ['cases', filters],
    queryFn: () => apiClient.get<any>('/cases', { params: filters as any }),
  });

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader
          title={t('cases.title')}
          description="浏览真实的留学申请案例，了解录取趋势"
          className="mb-0"
        />
        <Button onClick={() => setSubmitDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          分享我的案例
        </Button>
      </div>

      <SubmitCaseDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        onSuccess={() => refetch()}
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={filters.search}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filters.year || 'all'} onValueChange={(v) => setFilters((p) => ({ ...p, year: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t('cases.filters.year')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部年份</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.result || 'all'} onValueChange={(v) => setFilters((p) => ({ ...p, result: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t('cases.filters.result')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部结果</SelectItem>
                  <SelectItem value="ADMITTED">{t('cases.result.admitted')}</SelectItem>
                  <SelectItem value="REJECTED">{t('cases.result.rejected')}</SelectItem>
                  <SelectItem value="WAITLISTED">{t('cases.result.waitlisted')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cases List */}
      {isLoading ? (
        <LoadingState variant="card" count={6} />
      ) : cases?.data?.items?.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {cases.data.items.map((caseItem: any, index: number) => (
            <div
              key={caseItem.id}
              className="animate-initial animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
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
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          type="no-data"
          title="暂无案例数据"
          description="当用户开始分享他们的申请结果后，案例将会显示在这里"
        />
      )}
    </PageContainer>
  );
}

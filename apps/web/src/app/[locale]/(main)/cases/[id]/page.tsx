'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  Target,
  BookOpen,
  Award,
  BadgeCheck,
  Share2,
  Flag,
} from 'lucide-react';
import { cn, getSchoolName } from '@/lib/utils';

type CaseResult = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';

const resultStyles: Record<CaseResult, { bg: string; text: string }> = {
  ADMITTED: { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
  REJECTED: { bg: 'bg-red-500/10', text: 'text-red-600' },
  WAITLISTED: { bg: 'bg-amber-500/10', text: 'text-amber-600' },
  DEFERRED: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
};

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const caseId = params.id as string;

  const getResultLabel = (result: CaseResult) => {
    const labels: Record<CaseResult, string> = {
      ADMITTED: t('cases.result.admitted'),
      REJECTED: t('cases.result.rejected'),
      WAITLISTED: t('cases.result.waitlisted'),
      DEFERRED: t('cases.result.deferred'),
    };
    return labels[result] || result;
  };

  const {
    data: caseData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => apiClient.get<any>(`/cases/${caseId}`),
    enabled: !!caseId,
  });

  if (isLoading) {
    return (
      <PageContainer maxWidth="4xl">
        <LoadingState loading>
          <div className="h-96" />
        </LoadingState>
      </PageContainer>
    );
  }

  if (error || !caseData) {
    return (
      <PageContainer maxWidth="4xl">
        <EmptyState
          type="error"
          title={t('cases.notFound')}
          description={t('cases.notFoundDesc')}
          action={{
            label: t('cases.backToList'),
            onClick: () => router.back(),
          }}
        />
      </PageContainer>
    );
  }

  const result = caseData.result as CaseResult;
  const styles = resultStyles[result] || resultStyles.ADMITTED;
  const resultLabel = getResultLabel(result);

  return (
    <PageContainer maxWidth="4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* 返回按钮 */}
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('cases.detail.backToList')}
        </Button>

        {/* 主要信息卡片 */}
        <Card className="overflow-hidden">
          <div className={cn('h-2', styles.bg.replace('/10', ''))} />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-title">{getSchoolName(caseData.school, locale)}</h1>
                  {caseData.isVerified && (
                    <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600">
                      <BadgeCheck className="h-3 w-3" />
                      {t('cases.detail.verified')}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{caseData.school?.name}</p>
              </div>
              <Badge className={cn('text-lg px-4 py-2', styles.bg, styles.text)}>
                {resultLabel}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 基本信息 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('cases.detail.applicationYear')}
                  </p>
                  <p className="font-semibold">{caseData.year}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Target className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('cases.detail.applicationRound')}
                  </p>
                  <p className="font-semibold">{caseData.round || 'RD'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('cases.detail.major')}</p>
                  <p className="font-semibold">{caseData.major || t('common.notSpecified')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <GraduationCap className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('cases.detail.schoolRanking')}</p>
                  <p className="font-semibold">#{caseData.school?.usNewsRank || '-'}</p>
                </div>
              </div>
            </div>

            {/* 成绩信息 */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Award className="h-4 w-4" />
                {t('cases.detail.academicBackground')}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {caseData.gpaRange && (
                  <div className="p-4 rounded-xl border bg-card">
                    <p className="text-sm text-muted-foreground">GPA</p>
                    <p className="text-2xl font-bold">{caseData.gpaRange}</p>
                  </div>
                )}
                {caseData.satRange && (
                  <div className="p-4 rounded-xl border bg-card">
                    <p className="text-sm text-muted-foreground">SAT</p>
                    <p className="text-2xl font-bold">{caseData.satRange}</p>
                  </div>
                )}
                {caseData.actRange && (
                  <div className="p-4 rounded-xl border bg-card">
                    <p className="text-sm text-muted-foreground">ACT</p>
                    <p className="text-2xl font-bold">{caseData.actRange}</p>
                  </div>
                )}
                {caseData.toeflRange && (
                  <div className="p-4 rounded-xl border bg-card">
                    <p className="text-sm text-muted-foreground">TOEFL</p>
                    <p className="text-2xl font-bold">{caseData.toeflRange}</p>
                  </div>
                )}
                {!caseData.gpaRange &&
                  !caseData.satRange &&
                  !caseData.actRange &&
                  !caseData.toeflRange && (
                    <p className="text-muted-foreground col-span-full">
                      {t('cases.detail.noScoreInfo')}
                    </p>
                  )}
              </div>
            </div>

            {/* 标签 */}
            {caseData.tags && caseData.tags.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">{t('cases.detail.applicantFeatures')}</h3>
                <div className="flex flex-wrap gap-2">
                  {caseData.tags.map((tag: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" />
                {t('cases.detail.share')}
              </Button>
              <Button variant="outline" size="sm" className="gap-2 text-muted-foreground">
                <Flag className="h-4 w-4" />
                {t('cases.detail.report')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 相关案例推荐（可选） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('cases.detail.relatedCases', { school: caseData.school?.name })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              {t('cases.detail.viewMoreCases', { school: caseData.school?.name })}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </PageContainer>
  );
}

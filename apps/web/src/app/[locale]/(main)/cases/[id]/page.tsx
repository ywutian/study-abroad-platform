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
import { ScoreItem } from '@/components/ui/score-item';
import { CaseCard } from '@/components/features';
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
  FileText,
  Trophy,
} from 'lucide-react';
import { cn, getSchoolName } from '@/lib/utils';
import {
  getResultBarColor,
  getResultBadgeClass,
  getResultLabel as getResultLabelUtil,
  VERIFIED_BADGE_CLASS,
} from '@/lib/utils/admission';

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const caseId = params.id as string;

  const {
    data: caseData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => apiClient.get<any>(`/cases/${caseId}`),
    enabled: !!caseId,
  });

  // 查询同校相关案例
  const { data: relatedData } = useQuery({
    queryKey: ['related-cases', caseData?.schoolId, caseId],
    queryFn: () =>
      apiClient.get<any>('/cases', {
        params: { schoolId: caseData.schoolId, pageSize: '6' },
      }),
    enabled: !!caseData?.schoolId,
  });

  if (isLoading) {
    return (
      <PageContainer maxWidth="6xl">
        <LoadingState loading>
          <div className="h-96" />
        </LoadingState>
      </PageContainer>
    );
  }

  if (error || !caseData) {
    return (
      <PageContainer maxWidth="6xl">
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

  const resultLabel = getResultLabelUtil(caseData.result, (key: string) => t(`cases.${key}`));
  const resultBarColor = getResultBarColor(caseData.result);
  const resultBadgeClass = getResultBadgeClass(caseData.result);
  const paragraphs =
    caseData.essayContent?.split(/\n\n+/).filter((p: string) => p.trim().length > 0) || [];

  const relatedCases = relatedData?.items?.filter((c: any) => c.id !== caseId)?.slice(0, 5) || [];

  return (
    <PageContainer maxWidth="6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* ── 返回按钮 ── */}
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('cases.detail.backToList')}
        </Button>

        {/* ── Hero Header Card ── */}
        <Card className="overflow-hidden">
          <div className={cn('h-1.5', resultBarColor)} />
          <div className="p-6 lg:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                {caseData.school?.usNewsRank && (
                  <Badge className="mb-2.5 bg-amber-500 text-white border-0 text-sm px-3 py-1 gap-1">
                    <Trophy className="h-4 w-4" />
                    US News #{caseData.school.usNewsRank}
                  </Badge>
                )}
                <h1 className="text-title-lg">{getSchoolName(caseData.school, locale)}</h1>
                <p className="text-muted-foreground mt-1.5">
                  {caseData.year} · {caseData.round || 'RD'} ·{' '}
                  {caseData.major || t('common.notSpecified')}
                </p>
                {caseData.isVerified && (
                  <Badge variant="outline" className={cn('gap-1 mt-2', VERIFIED_BADGE_CLASS)}>
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {t('cases.detail.verified')}
                  </Badge>
                )}
              </div>
              {/* 大号结果标签 */}
              <div className={cn('px-5 py-3 rounded-xl text-center shrink-0', resultBadgeClass)}>
                <p className="text-overline text-xs uppercase tracking-wider opacity-70 mb-0.5">
                  {t('cases.detail.decision')}
                </p>
                <p className="text-lg font-bold">{resultLabel}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* ── 两栏布局：左栏内容 + 右栏 Score Dashboard ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── 左栏 ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* 申请详情 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {t('cases.detail.applicationDetails')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoItem
                    icon={Calendar}
                    label={t('cases.detail.applicationYear')}
                    value={String(caseData.year)}
                  />
                  <InfoItem
                    icon={Target}
                    label={t('cases.detail.applicationRound')}
                    value={caseData.round || 'RD'}
                  />
                  <InfoItem
                    icon={BookOpen}
                    label={t('cases.detail.major')}
                    value={caseData.major || t('common.notSpecified')}
                  />
                  <InfoItem
                    icon={GraduationCap}
                    label={t('cases.detail.schoolRanking')}
                    value={caseData.school?.usNewsRank ? `#${caseData.school.usNewsRank}` : '-'}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 文书内容（如果有） */}
            {caseData.essayContent && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {t('cases.detail.essayContent')}
                  </CardTitle>
                  {caseData.essayPrompt && (
                    <div className="flex gap-3 mt-2 p-3 rounded-lg bg-muted/50 border">
                      <div className="w-0.5 shrink-0 rounded-full bg-amber-500" />
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {caseData.essayPrompt}
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="prose dark:prose-invert max-w-[68ch]">
                    {paragraphs.map((p: string, i: number) => (
                      <p key={i} className="mb-5 last:mb-0 text-base leading-[1.8]">
                        {p}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 标签 */}
            {caseData.tags && caseData.tags.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('cases.detail.applicantFeatures')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {caseData.tags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── 右栏：Score Dashboard + 操作 ── */}
          <div className="space-y-6">
            <Card className="lg:sticky lg:top-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  {t('cases.detail.academicBackground')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {caseData.gpaRange && (
                  <ScoreItem label="GPA" value={caseData.gpaRange} max="4.0" color="emerald" />
                )}
                {caseData.satRange && (
                  <ScoreItem label="SAT" value={caseData.satRange} max="1600" color="blue" />
                )}
                {caseData.actRange && (
                  <ScoreItem label="ACT" value={caseData.actRange} max="36" color="purple" />
                )}
                {caseData.toeflRange && (
                  <ScoreItem label="TOEFL" value={caseData.toeflRange} max="120" color="amber" />
                )}
                {!caseData.gpaRange &&
                  !caseData.satRange &&
                  !caseData.actRange &&
                  !caseData.toeflRange && (
                    <p className="text-sm text-muted-foreground">{t('cases.detail.noScoreInfo')}</p>
                  )}
              </CardContent>
            </Card>

            {/* 操作 */}
            <Card>
              <CardContent className="pt-5 flex flex-col gap-2">
                <Button variant="outline" size="sm" className="gap-2 w-full justify-start">
                  <Share2 className="h-4 w-4" />
                  {t('cases.detail.share')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full justify-start text-muted-foreground"
                >
                  <Flag className="h-4 w-4" />
                  {t('cases.detail.report')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── 相关案例 ── */}
        {relatedCases.length > 0 && (
          <div>
            <h2 className="text-subtitle mb-4">
              {t('cases.detail.relatedCases', {
                school: getSchoolName(caseData.school, locale),
              })}
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
              {relatedCases.map((c: any) => (
                <div key={c.id} className="min-w-[300px] flex-shrink-0">
                  <CaseCard
                    schoolName={getSchoolName(c.school, locale) || c.school?.name}
                    year={c.year}
                    round={c.round}
                    major={c.major}
                    result={c.result}
                    gpa={c.gpaRange}
                    sat={c.satRange}
                    toefl={c.toeflRange}
                    tags={c.tags}
                    isVerified={c.isVerified}
                    onClick={() => router.push(`/${locale}/cases/${c.id}`)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </PageContainer>
  );
}

// ── 信息项小组件 ──────────────────────────────────────────────────────────────

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

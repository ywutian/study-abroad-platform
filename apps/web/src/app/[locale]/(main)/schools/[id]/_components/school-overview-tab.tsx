'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  GraduationCap,
  Calendar,
  DollarSign,
  ClipboardList,
  Globe2,
  TrendingUp,
} from 'lucide-react';

import type { SchoolDetail } from './types';

interface SchoolOverviewTabProps {
  school: SchoolDetail;
}

function PercentBar({ value }: { value: number }) {
  return (
    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function StatRow({ label, value, bar }: { label: string; value: React.ReactNode; bar?: number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {bar != null && <PercentBar value={bar} />}
        <span className="font-semibold">{value}</span>
      </div>
    </div>
  );
}

export function SchoolOverviewTab({ school }: SchoolOverviewTabProps) {
  const t = useTranslations();
  const tc = useTranslations('common');
  const locale = useLocale();

  const deadlines = school.metadata?.deadlines || {};
  const requirements = school.metadata?.requirements || {};

  const hasFinancialData =
    school.tuition != null ||
    school.averageNetPrice != null ||
    school.averageAidPackage != null ||
    school.percentNeedMet != null ||
    school.applicationFee != null ||
    school.roomAndBoard != null;

  const hasApplicationInfo =
    school.acceptsCommonApp ||
    school.acceptsCoalition ||
    school.testOptional ||
    school.hasEarlyDecision ||
    school.feeWaiverAvailable ||
    school.needBlindInternational;

  const hasInternationalData =
    school.intlStudentPct != null ||
    school.countriesRepresented != null ||
    school.intlAcceptanceRate != null;

  const hasNicheData =
    school.nicheOverallGrade ||
    school.nicheSafetyGrade ||
    school.nicheLifeGrade ||
    school.nicheFoodGrade ||
    school.studentOrgsCount != null;

  const fmt = (n: number | undefined | null) => (n != null ? `$${n.toLocaleString()}` : null);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Academic Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              {t('school.academicStats')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatRow
              label={t('school.usNewsRank')}
              value={school.usNewsRank ? `#${school.usNewsRank}` : tc('notAvailable')}
            />
            <Separator />
            <StatRow
              label={t('school.satAvg')}
              value={
                school.sat25 && school.sat75
                  ? `${school.sat25}-${school.sat75}${school.satAvg ? ` (avg ${school.satAvg})` : ''}`
                  : school.satAvg || requirements.satRange || tc('notAvailable')
              }
            />
            <Separator />
            <StatRow
              label={t('school.actAvg')}
              value={
                school.act25 && school.act75
                  ? `${school.act25}-${school.act75}${school.actAvg ? ` (avg ${school.actAvg})` : ''}`
                  : school.actAvg || requirements.actRange || tc('notAvailable')
              }
            />
            <Separator />
            <StatRow
              label={t('school.graduationRate')}
              value={school.graduationRate ? `${Number(school.graduationRate).toFixed(0)}%` : 'N/A'}
              bar={school.graduationRate ? Number(school.graduationRate) : undefined}
            />
            {school.retentionRate != null && (
              <>
                <Separator />
                <StatRow
                  label={t('school.retentionRate')}
                  value={`${Number(school.retentionRate).toFixed(0)}%`}
                  bar={Number(school.retentionRate)}
                />
              </>
            )}
            {school.studentFacultyRatio != null && (
              <>
                <Separator />
                <StatRow
                  label={t('school.studentFacultyRatio')}
                  value={`${school.studentFacultyRatio}:1`}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Application Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('school.deadlines.title')}
            </CardTitle>
            <CardDescription>
              {school.metadata?.applicationCycle || '2025-2026'} {t('school.deadlines.cycle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deadlines.rea && (
              <>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">REA</Badge>
                    <span>{t('school.deadlines.rea')}</span>
                  </div>
                  <span className="font-semibold">{deadlines.rea}</span>
                </div>
                <Separator />
              </>
            )}
            {deadlines.ea && (
              <>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">EA</Badge>
                    <span>{t('school.deadlines.ea')}</span>
                  </div>
                  <span className="font-semibold">{deadlines.ea}</span>
                </div>
                <Separator />
              </>
            )}
            {deadlines.ed && (
              <>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge>ED</Badge>
                    <span>{t('school.deadlines.ed')}</span>
                  </div>
                  <span className="font-semibold">{deadlines.ed}</span>
                </div>
                <Separator />
              </>
            )}
            {deadlines.ed2 && (
              <>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">ED II</Badge>
                    <span>{t('school.deadlines.ed2')}</span>
                  </div>
                  <span className="font-semibold">{deadlines.ed2}</span>
                </div>
                <Separator />
              </>
            )}
            {deadlines.rd && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">RD</Badge>
                  <span>{t('school.deadlines.rd')}</span>
                </div>
                <span className="font-semibold">{deadlines.rd}</span>
              </div>
            )}
            {Object.keys(deadlines).length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                {t('school.deadlines.noData')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Financial Aid & Cost */}
        {hasFinancialData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t('school.financialAid.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {school.tuition != null && (
                <StatRow label={t('school.tuition')} value={fmt(school.tuition)} />
              )}
              {school.averageNetPrice != null && (
                <>
                  <Separator />
                  <StatRow
                    label={t('school.financialAid.netPrice')}
                    value={fmt(school.averageNetPrice)}
                  />
                </>
              )}
              {school.averageAidPackage != null && (
                <>
                  <Separator />
                  <StatRow
                    label={t('school.financialAid.aidPackage')}
                    value={fmt(school.averageAidPackage)}
                  />
                </>
              )}
              {school.percentNeedMet != null && (
                <>
                  <Separator />
                  <StatRow
                    label={t('school.financialAid.needMet')}
                    value={`${Number(school.percentNeedMet).toFixed(0)}%`}
                    bar={Number(school.percentNeedMet)}
                  />
                </>
              )}
              {school.applicationFee != null && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      {t('school.financialAid.applicationFee')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{fmt(school.applicationFee)}</span>
                      {school.feeWaiverAvailable && (
                        <Badge variant="secondary" className="text-xs">
                          {t('school.financialAid.feeWaiver')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}
              {school.roomAndBoard != null && (
                <>
                  <Separator />
                  <StatRow
                    label={t('school.financialAid.roomAndBoard')}
                    value={fmt(school.roomAndBoard)}
                  />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Application Info */}
        {hasApplicationInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {t('school.applicationInfo.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {school.acceptsCommonApp && <Badge>{t('school.applicationInfo.commonApp')}</Badge>}
                {school.acceptsCoalition && (
                  <Badge variant="secondary">{t('school.applicationInfo.coalition')}</Badge>
                )}
                {school.testOptional && (
                  <Badge variant="outline">{t('school.applicationInfo.testOptional')}</Badge>
                )}
                {school.needBlindInternational && (
                  <Badge variant="outline">{t('school.applicationInfo.needBlind')}</Badge>
                )}
                {school.hasEarlyDecision && (
                  <Badge variant="outline">{t('school.applicationInfo.earlyDecision')}</Badge>
                )}
                {school.feeWaiverAvailable && (
                  <Badge variant="outline">{t('school.financialAid.feeWaiver')}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* International Students */}
        {hasInternationalData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe2 className="h-5 w-5" />
                {t('school.international.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {school.intlStudentPct != null && (
                <StatRow
                  label={t('school.international.studentPct')}
                  value={`${Number(school.intlStudentPct).toFixed(1)}%`}
                  bar={Number(school.intlStudentPct)}
                />
              )}
              {school.intlAcceptanceRate != null && (
                <>
                  <Separator />
                  <StatRow
                    label={t('school.international.acceptanceRate')}
                    value={`${Number(school.intlAcceptanceRate).toFixed(1)}%`}
                    bar={Number(school.intlAcceptanceRate)}
                  />
                </>
              )}
              {school.countriesRepresented != null && (
                <>
                  <Separator />
                  <StatRow
                    label={t('school.international.countries')}
                    value={school.countriesRepresented}
                  />
                </>
              )}
              {school.needBlindInternational && (
                <>
                  <Separator />
                  <StatRow label={t('school.applicationInfo.needBlind')} value="✓" />
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Niche Campus Life Ratings */}
      {hasNicheData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('school.campusLife.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {school.nicheOverallGrade && (
                <div className="text-center">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {school.nicheOverallGrade}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('school.campusLife.overall')}
                  </p>
                </div>
              )}
              {school.nicheSafetyGrade && (
                <div className="text-center">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {school.nicheSafetyGrade}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('school.campusLife.safety')}
                  </p>
                </div>
              )}
              {school.nicheLifeGrade && (
                <div className="text-center">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {school.nicheLifeGrade}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('school.campusLife.life')}
                  </p>
                </div>
              )}
              {school.nicheFoodGrade && (
                <div className="text-center">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {school.nicheFoodGrade}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('school.campusLife.food')}
                  </p>
                </div>
              )}
            </div>
            {school.studentOrgsCount != null && (
              <div className="mt-4 pt-4 border-t border-border">
                <StatRow
                  label={t('school.campusLife.studentOrgs')}
                  value={school.studentOrgsCount.toLocaleString()}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Post-Graduation Outcomes */}
      {(school.salary6YrPostGrad != null ||
        school.loanDefaultRate != null ||
        school.monthlyLoanPayment != null) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('school.postGrad.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {school.salary6YrPostGrad != null && (
              <StatRow label={t('school.postGrad.salary')} value={fmt(school.salary6YrPostGrad)} />
            )}
            {school.loanDefaultRate != null && (
              <>
                <Separator />
                <StatRow
                  label={t('school.postGrad.loanDefault')}
                  value={`${Number(school.loanDefaultRate).toFixed(1)}%`}
                  bar={Number(school.loanDefaultRate)}
                />
              </>
            )}
            {school.monthlyLoanPayment != null && (
              <>
                <Separator />
                <StatRow
                  label={t('school.postGrad.monthlyLoan')}
                  value={fmt(school.monthlyLoanPayment)}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {(school.description || school.descriptionZh) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('school.about')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {locale === 'zh'
                ? school.descriptionZh || school.description
                : school.description || school.descriptionZh}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ChevronDown, DollarSign, Check, X } from 'lucide-react';
import { cn, getSchoolName } from '@/lib/utils';
import type { TargetSchool } from './types';

interface FinancialAidComparisonProps {
  schools: TargetSchool[];
}

function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FinancialAidComparison({ schools }: FinancialAidComparisonProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  const schoolsWithAid = useMemo(
    () =>
      schools.filter((s) => s.averageAidPackage || s.averageNetPrice || s.percentNeedMet != null),
    [schools]
  );

  if (schoolsWithAid.length < 2) return null;

  return (
    <div className="mb-4 rounded-lg border bg-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-success" />
          {t('profile.schoolSelection.aidComparison')}
          <span className="text-xs text-muted-foreground font-normal">
            ({schoolsWithAid.length} {t('profile.schoolSelection.schools')})
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t px-4 pb-4 pt-3">
          <p className="text-xs text-muted-foreground mb-3">
            {t('profile.schoolSelection.aidComparisonDesc')}
          </p>

          {/* Desktop: table layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs" role="table">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="sticky left-0 bg-card pb-2 pr-4 font-medium">
                    {t('profile.schoolSelection.school')}
                  </th>
                  <th className="pb-2 px-3 font-medium text-center">
                    {t('profile.schoolSelection.needBlind')}
                  </th>
                  <th className="pb-2 px-3 font-medium text-right">
                    {t('profile.schoolSelection.avgAid')}
                  </th>
                  <th className="pb-2 px-3 font-medium text-right">
                    {t('profile.schoolSelection.netPrice')}
                  </th>
                  <th className="pb-2 pl-3 font-medium text-right">
                    {t('profile.schoolSelection.needMet')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {schoolsWithAid.map((school) => (
                  <tr key={school.id} className="border-b last:border-0">
                    <td className="sticky left-0 bg-card py-2 pr-4 font-medium">
                      {getSchoolName(school, locale)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {school.needBlindInternational != null ? (
                        school.needBlindInternational ? (
                          <Check
                            className="h-3.5 w-3.5 text-success mx-auto"
                            aria-label={t('common.yes')}
                          />
                        ) : (
                          <X
                            className="h-3.5 w-3.5 text-destructive mx-auto"
                            aria-label={t('common.no')}
                          />
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {school.averageAidPackage
                        ? formatCurrency(school.averageAidPackage, locale)
                        : '—'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {school.averageNetPrice ? (
                        <span>
                          {formatCurrency(school.averageNetPrice, locale)}
                          <span className="text-muted-foreground">
                            /{t('profile.schoolSelection.perYear')}
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 pl-3 text-right">
                      {school.percentNeedMet != null ? `${school.percentNeedMet}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked card layout */}
          <div className="sm:hidden space-y-2">
            {schoolsWithAid.map((school) => (
              <div
                key={school.id}
                className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs"
              >
                <p className="font-medium">{getSchoolName(school, locale)}</p>
                <div className="grid grid-cols-2 gap-1.5 text-muted-foreground">
                  {school.needBlindInternational != null && (
                    <div className="flex items-center gap-1">
                      {t('profile.schoolSelection.needBlind')}:
                      {school.needBlindInternational ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <X className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                  )}
                  {school.averageAidPackage && (
                    <div>
                      {t('profile.schoolSelection.avgAid')}:{' '}
                      {formatCurrency(school.averageAidPackage, locale)}
                    </div>
                  )}
                  {school.averageNetPrice && (
                    <div>
                      {t('profile.schoolSelection.netPrice')}:{' '}
                      {formatCurrency(school.averageNetPrice, locale)}/
                      {t('profile.schoolSelection.perYear')}
                    </div>
                  )}
                  {school.percentNeedMet != null && (
                    <div>
                      {t('profile.schoolSelection.needMet')}: {school.percentNeedMet}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { memo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Calendar, DollarSign, Users, ExternalLink, FileText, Mic } from 'lucide-react';
import type { TargetSchool } from '../types';

const INTERVIEW_FORMAT_STYLES: Record<string, string> = {
  ALUMNI: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  ADMISSIONS_OFFICER: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  INITIALVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  VERICANT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  KIRA: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  GROUP: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  OPTIONAL: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  NOT_OFFERED: 'bg-muted text-muted-foreground',
};

interface SchoolExpandedDetailsProps {
  school: TargetSchool;
  isExpanded: boolean;
  essayPromptsSlot: React.ReactNode;
}

export const SchoolExpandedDetails = memo(function SchoolExpandedDetails({
  school,
  isExpanded,
  essayPromptsSlot,
}: SchoolExpandedDetailsProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="mt-3 pt-3 border-t space-y-2 text-xs">
            {/* Deadlines */}
            {school.deadlines && school.deadlines.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t('profile.schoolSelection.deadlines')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {school.deadlines.map((dl) => {
                    const deadline = new Date(dl.applicationDeadline);
                    const daysUntil = Math.ceil(
                      (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    const isUrgent = daysUntil > 0 && daysUntil <= 30;
                    const isPast = daysUntil < 0;
                    const isSelected = school.round === dl.round;
                    return (
                      <Badge
                        key={dl.round}
                        variant={isSelected ? 'default' : 'outline'}
                        className={cn(
                          'text-xs',
                          isUrgent && !isPast && 'border-destructive text-destructive',
                          isPast && 'opacity-50 line-through'
                        )}
                      >
                        {dl.round}:{' '}
                        {deadline.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                        {dl.interviewRequired && (
                          <Mic
                            className="ml-0.5 inline h-3 w-3"
                            aria-label={t('profile.schoolSelection.interviewRequired')}
                          />
                        )}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Interview info */}
            {school.deadlines?.some((dl) => dl.interviewRequired) && (
              <div className="space-y-1">
                <p className="font-medium flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {t('profile.schoolSelection.interview')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {school.deadlines
                    .filter((dl) => dl.interviewRequired)
                    .map((dl) => {
                      const format = dl.interviewFormat || null;
                      return (
                        <TooltipProvider key={dl.round}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-help',
                                  format
                                    ? INTERVIEW_FORMAT_STYLES[format] ||
                                        INTERVIEW_FORMAT_STYLES.ALUMNI
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                <Mic className="h-2.5 w-2.5" />
                                {format
                                  ? t(`profile.schoolSelection.interviewFormat.${format}`, {
                                      defaultValue: format,
                                    })
                                  : t('profile.schoolSelection.interviewRequired')}
                                {dl.interviewDeadline && (
                                  <span className="opacity-70">
                                    {' · '}
                                    {new Date(dl.interviewDeadline).toLocaleDateString(
                                      locale === 'zh' ? 'zh-CN' : 'en-US',
                                      { month: 'short', day: 'numeric' }
                                    )}
                                  </span>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">
                                {format
                                  ? t(`profile.schoolSelection.interviewTip.${format}`, {
                                      defaultValue: t('profile.schoolSelection.interviewRequired'),
                                    })
                                  : t('profile.schoolSelection.interviewRequired')}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Financial Aid */}
            {(school.averageAidPackage || school.averageNetPrice || school.percentNeedMet) && (
              <div className="space-y-1">
                <p className="font-medium flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {t('profile.schoolSelection.financialAid')}
                </p>
                <div className="flex flex-wrap gap-2 text-muted-foreground">
                  {school.needBlindInternational && (
                    <span className="text-success">{t('profile.schoolSelection.needBlind')} ✓</span>
                  )}
                  {school.averageAidPackage && (
                    <span>
                      {t('profile.schoolSelection.avgAid')}:{' '}
                      {new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0,
                      }).format(school.averageAidPackage)}
                    </span>
                  )}
                  {school.averageNetPrice && (
                    <span>
                      {t('profile.schoolSelection.netPrice')}:{' '}
                      {new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0,
                      }).format(school.averageNetPrice)}
                      /{t('profile.schoolSelection.perYear')}
                    </span>
                  )}
                  {school.percentNeedMet != null && (
                    <span>
                      {t('profile.schoolSelection.needMet')}: {school.percentNeedMet}%
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Transfer rate */}
            {school.transferAcceptanceRate != null && (
              <p className="text-muted-foreground">
                {t('schoolSelector.transferRate')}: {school.transferAcceptanceRate}%
              </p>
            )}

            {/* Essay Prompts */}
            <div className="space-y-1">
              <p className="font-medium flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {t('profile.schoolSelection.essayRequirements')}
              </p>
              {essayPromptsSlot}
            </div>

            {/* Data Sources */}
            {(school.scorecardId || school.ipedsId) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {school.scorecardId && (
                  <a
                    href={`https://collegescorecard.ed.gov/school/?${school.scorecardId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    College Scorecard
                  </a>
                )}
                {school.ipedsId && (
                  <a
                    href={`https://nces.ed.gov/ipeds/datacenter/institutionprofile.aspx?unitId=${school.ipedsId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    IPEDS
                  </a>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';
import { isSafeUrl } from '@/lib/utils/url';
import { SchoolLogo } from '@/components/features';
import { MapPin, Star, Target, Globe, ExternalLink } from 'lucide-react';

import type { SchoolDetail, PredictionData } from './types';

interface SchoolHeroHeaderProps {
  school: SchoolDetail;
  predictionData?: PredictionData | null;
  isLoggedIn: boolean;
  actions?: React.ReactNode;
}

export function SchoolHeroHeader({
  school,
  predictionData,
  isLoggedIn,
  actions,
}: SchoolHeroHeaderProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-8 overflow-hidden rounded-lg bg-primary/5 p-6 sm:p-8"
    >
      {/* Decorative elements */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="flex items-start gap-4">
          <SchoolLogo
            logoUrl={school.logoUrl}
            website={school.website}
            name={getSchoolName(school, locale)}
            size="lg"
            variant="hero"
            rounded="lg"
          />

          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-title">{getSchoolName(school, locale)}</h1>
              {school.usNewsRank && school.usNewsRank <= 20 && (
                <Badge variant="default" className="gap-1">
                  <Star className="h-3 w-3" />
                  Top {school.usNewsRank}
                </Badge>
              )}
              {school.usNewsRank && school.usNewsRank > 20 && (
                <Badge variant="info">#{school.usNewsRank} US News</Badge>
              )}
              {isLoggedIn && predictionData?.current && (
                <>
                  <Badge variant="secondary" className="gap-1">
                    <Target className="h-3 w-3" />
                    {t('school.prediction.personalEstimate')}{' '}
                    {Math.round(predictionData.current.probability * 100)}%
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn('gap-1', {
                      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30':
                        predictionData.current.tier === 'safety',
                      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30':
                        predictionData.current.tier === 'match',
                      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30':
                        predictionData.current.tier === 'reach',
                    })}
                  >
                    {predictionData.current.tier === 'safety'
                      ? t('school.prediction.safetyAdvice')
                      : predictionData.current.tier === 'match'
                        ? t('school.prediction.matchAdvice')
                        : t('school.prediction.reachAdvice')}
                  </Badge>
                </>
              )}
              {school.testOptional && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                >
                  Test Optional
                </Badge>
              )}
              {school.hasEarlyDecision && (
                <Badge
                  variant="outline"
                  className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30"
                >
                  Early Decision
                </Badge>
              )}
            </div>
            {getSchoolSubName(school, locale) && (
              <p className="text-lg text-muted-foreground mb-2">
                {getSchoolSubName(school, locale)}
              </p>
            )}
            <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                {school.city ? `${school.city}, ` : ''}
                {school.state}, {school.country}
              </span>
              {school.website && (
                <a
                  href={isSafeUrl(school.website) ? school.website : `https://${school.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Globe className="h-4 w-4" />
                  {t('school.website')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {isLoggedIn && predictionData?.current && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('prediction.probabilityVsRateDisclaimer')}
              </p>
            )}
          </div>
        </div>

        {actions}
      </div>
    </motion.div>
  );
}

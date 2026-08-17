'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { motion } from 'framer-motion';
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';
import { isSafeUrl } from '@/lib/utils/url';
import { SchoolLogo } from '@/components/features';
import { ExternalLink, Gauge, Globe, MapPin } from 'lucide-react';

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
  const testingPolicyT = useTranslations('applicationAnalysis.policy.testing');
  const locale = useLocale();
  const showTestingPolicy = school.testingPolicy != null;
  const [coverFailed, setCoverFailed] = useState(false);
  const campusCover = school.media?.campusCover;
  const campusCoverUrl = campusCover?.url && !coverFailed ? campusCover.url : null;
  const campusCoverSourceUrl = campusCover?.sourcePageUrl ?? campusCover?.originalUrl ?? null;
  const campusCoverSourceQuality = campusCoverSourceUrl
    ? 'approved_media_source'
    : campusCoverUrl
      ? 'approved_media_source_unavailable'
      : 'missing_media_source';
  const logoUrl = school.media?.logo?.url ?? school.logoUrl;
  const schoolName = getSchoolName(school, locale);
  const schoolSubName = getSchoolSubName(school, locale);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-8 overflow-hidden rounded-lg bg-primary/5"
    >
      {campusCoverUrl && (
        <div className="relative h-48 w-full overflow-hidden bg-muted sm:h-56 lg:h-64">
          <Image
            src={campusCoverUrl}
            alt={schoolName}
            fill
            priority
            sizes="100vw"
            unoptimized
            onError={() => setCoverFailed(true)}
            title={campusCoverSourceUrl ?? campusCover?.sourceType}
            data-source-url={campusCoverSourceUrl ?? undefined}
            data-source-quality={campusCoverSourceQuality}
            data-source-type={campusCover?.sourceType ?? undefined}
            className="object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between sm:p-8">
        <div className="flex items-start gap-4">
          <SchoolLogo
            logoUrl={logoUrl}
            website={school.website}
            name={schoolName}
            size="lg"
            variant="hero"
            rounded="lg"
          />

          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-title">{schoolName}</h1>
              <RankingBadge
                rankings={school.rankings}
                usNewsRank={school.usNewsRank}
                variant="amber"
              />
              {isLoggedIn && predictionData?.current && (
                <>
                  <Badge variant="secondary" className="gap-1">
                    <Gauge className="h-3 w-3" />
                    {predictionData.current.probability == null
                      ? t('school.prediction.unavailable')
                      : `${t('school.prediction.personalEstimate')} ${Math.round(
                          predictionData.current.probability * 100
                        )}%`}
                  </Badge>
                  {predictionData.current.probability != null && (
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
                  )}
                </>
              )}
              {showTestingPolicy && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                >
                  {testingPolicyT(school.testingPolicy as never)}
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
            {schoolSubName && <p className="text-lg text-muted-foreground mb-2">{schoolSubName}</p>}
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

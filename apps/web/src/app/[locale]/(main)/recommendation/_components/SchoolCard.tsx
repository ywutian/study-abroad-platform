'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '@/lib/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnimatedProgress, TapScale } from '@/components/ui/motion';
import {
  Rocket,
  Target,
  Shield,
  Star,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Trophy,
  Plus,
  Check,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { expandCollapse } from '@/lib/motion';
import { useAddToSchoolList } from '@/hooks/use-recommendation';
import type { RecommendedSchool } from '@study-abroad/shared';

const TIER_STYLES = {
  reach: {
    icon: Rocket,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-200 dark:border-red-900',
    barClassName: 'bg-red-500',
  },
  match: {
    icon: Target,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    borderColor: 'border-yellow-200 dark:border-yellow-900',
    barClassName: 'bg-yellow-500',
  },
  safety: {
    icon: Shield,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-900',
    barClassName: 'bg-green-500',
  },
};

const TIER_TO_SCHOOL_TIER: Record<string, string> = {
  reach: 'REACH',
  match: 'TARGET',
  safety: 'SAFETY',
};

interface SchoolCardProps {
  school: RecommendedSchool;
  existingSchoolIds: Set<string>;
}

export function SchoolCard({ school, existingSchoolIds }: SchoolCardProps) {
  const t = useTranslations('recommendation');
  const [expanded, setExpanded] = useState(false);
  const addToList = useAddToSchoolList();

  const tierStyle = TIER_STYLES[school.tier];
  const TierIcon = tierStyle.icon;
  const isInList = school.schoolId ? existingSchoolIds.has(school.schoolId) : false;

  const handleAddToList = () => {
    if (!school.schoolId || isInList) return;
    addToList.mutate(
      {
        schoolId: school.schoolId,
        tier: TIER_TO_SCHOOL_TIER[school.tier] || 'TARGET',
        isAIRecommended: true,
      },
      {
        onSuccess: () => {
          toast.success(t('addToListSuccess', { name: school.schoolName }));
        },
        onError: (error: any) => {
          toast.error(error.message);
        },
      }
    );
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 60) return 'text-green-600';
    if (prob >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const hasExpandableContent =
    school.reasons.length > 2 || (school.concerns && school.concerns.length > 0);

  return (
    <Card className={cn('card-elevated', tierStyle.borderColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('p-2 rounded-lg shrink-0', tierStyle.bgColor)}>
              <TierIcon className={cn('h-5 w-5', tierStyle.color)} />
            </div>
            <div className="min-w-0">
              {school.schoolId ? (
                <Link href={`/schools/${school.schoolId}`} className="hover:underline">
                  <CardTitle className="text-base truncate">
                    {school.schoolName}
                    <ExternalLink className="inline ml-1 h-3 w-3 text-muted-foreground" />
                  </CardTitle>
                </Link>
              ) : (
                <CardTitle className="text-base truncate">{school.schoolName}</CardTitle>
              )}
              {/* School Meta */}
              {school.schoolMeta && (
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {school.schoolMeta.usNewsRank && (
                    <span className="flex items-center gap-0.5">
                      <Trophy className="h-3 w-3" />#{school.schoolMeta.usNewsRank}
                    </span>
                  )}
                  {(school.schoolMeta.city || school.schoolMeta.state) && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {[school.schoolMeta.city, school.schoolMeta.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {school.schoolMeta.acceptanceRate != null && (
                    <span>
                      {t('acceptanceRate')}: {(school.schoolMeta.acceptanceRate * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Probability Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('probability')}</span>
            <span
              className={cn(
                'text-lg font-bold tabular-nums',
                getProbabilityColor(school.estimatedProbability)
              )}
            >
              {school.estimatedProbability}%
            </span>
          </div>
          <AnimatedProgress
            value={school.estimatedProbability}
            barClassName={tierStyle.barClassName}
          />
        </div>

        {/* Fit Score */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('fitScore')}</span>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            <span className="font-medium tabular-nums">{school.fitScore}/100</span>
          </div>
        </div>

        {/* Reasons - always show first 2 */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t('reasons')}</p>
          <ul className="space-y-1">
            {school.reasons.slice(0, 2).map((reason, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {reason}
              </li>
            ))}
          </ul>

          {/* Expandable content with animation */}
          <AnimatePresence>
            {expanded && hasExpandableContent && (
              <motion.div
                variants={expandCollapse}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                className="overflow-hidden"
              >
                {/* Additional reasons */}
                {school.reasons.length > 2 && (
                  <ul className="space-y-1">
                    {school.reasons.slice(2).map((reason, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Concerns */}
                {school.concerns && school.concerns.length > 0 && (
                  <div className="pt-2 mt-2 border-t space-y-1">
                    <p className="text-xs font-medium text-amber-600">{t('concerns')}</p>
                    {school.concerns.map((c, i) => (
                      <p key={i} className="text-xs text-amber-600">
                        {c}
                      </p>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {hasExpandableContent && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="mr-1 h-3 w-3" />
                  {t('showLess')}
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3 w-3" />
                  {t('showMore')}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Add to List Button */}
        {school.schoolId && (
          <TapScale>
            <Button
              variant={isInList ? 'secondary' : 'outline'}
              size="sm"
              className={cn('w-full mt-2', isInList && 'text-green-600')}
              disabled={isInList || addToList.isPending}
              onClick={handleAddToList}
            >
              {isInList ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  {t('alreadyInList')}
                </>
              ) : (
                <>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {t('addToList')}
                </>
              )}
            </Button>
          </TapScale>
        )}
      </CardContent>
    </Card>
  );
}

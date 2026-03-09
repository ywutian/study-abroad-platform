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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn, formatAcceptanceRate, getProbabilityColorClass } from '@/lib/utils';
import { expandCollapse } from '@/lib/motion';
import { useAddToSchoolList } from '@/hooks/use-recommendation';
import type { RecommendedSchool } from '@study-abroad/shared';

const TIER_STYLES = {
  reach: {
    icon: Rocket,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    barClassName: 'bg-rose-500',
  },
  match: {
    icon: Target,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    barClassName: 'bg-blue-500',
  },
  safety: {
    icon: Shield,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    barClassName: 'bg-emerald-500',
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
  const tFind = useTranslations('findCollege');
  const [expanded, setExpanded] = useState(false);
  const addToList = useAddToSchoolList();

  const tierStyle = TIER_STYLES[school.tier];
  const TierIcon = tierStyle.icon;
  const isInList = school.schoolId ? existingSchoolIds.has(school.schoolId) : false;

  const handleAddToList = (round: string) => {
    if (!school.schoolId || isInList) return;
    addToList.mutate(
      {
        schoolId: school.schoolId,
        tier: TIER_TO_SCHOOL_TIER[school.tier] || 'TARGET',
        round,
        isAIRecommended: true,
      },
      {
        onSuccess: () => {
          toast.success(t('addToListSuccess', { name: school.schoolName }));
        },
      }
    );
  };

  const ROUNDS = ['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'] as const;

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
                      {t('acceptanceRate')}:{' '}
                      {formatAcceptanceRate(school.schoolMeta.acceptanceRate)}
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
            <span className="text-muted-foreground">{t('estimatedProbability')}</span>
            <span
              className={cn(
                'text-lg font-bold tabular-nums',
                getProbabilityColorClass(school.estimatedProbability, '0-100')
              )}
            >
              {school.estimatedProbability}%
            </span>
          </div>
          <AnimatedProgress
            value={school.estimatedProbability}
            barClassName={tierStyle.barClassName}
          />
          <Link href="/prediction" className="text-xs text-primary hover:underline">
            {t('viewDetailedPrediction')}
          </Link>
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
            {isInList ? (
              <Button variant="secondary" size="sm" className="w-full mt-2 text-green-600" disabled>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                {t('alreadyInList')}
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    disabled={addToList.isPending}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {t('addToList')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {ROUNDS.map((r) => (
                    <DropdownMenuItem
                      key={r}
                      onClick={() => handleAddToList(r)}
                      disabled={addToList.isPending}
                    >
                      {tFind('rounds.' + r)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TapScale>
        )}
      </CardContent>
    </Card>
  );
}

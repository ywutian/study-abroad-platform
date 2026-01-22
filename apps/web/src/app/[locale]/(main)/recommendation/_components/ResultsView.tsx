'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/ui/motion';
import {
  Rocket,
  Target,
  Shield,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SchoolCard } from './SchoolCard';
import type { RecommendationResult } from '@study-abroad/shared';

interface ResultsViewProps {
  result: RecommendationResult;
  schoolList?: Array<{ schoolId: string }>;
  onReset: () => void;
}

export function ResultsView({ result, schoolList, onReset }: ResultsViewProps) {
  const t = useTranslations('recommendation');

  const existingSchoolIds = useMemo(
    () => new Set((schoolList || []).map((s) => s.schoolId)),
    [schoolList]
  );

  const reach = result.recommendations.filter((r) => r.tier === 'reach');
  const match = result.recommendations.filter((r) => r.tier === 'match');
  const safety = result.recommendations.filter((r) => r.tier === 'safety');
  const total = result.recommendations.length;

  return (
    <PageTransition className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-body-lg font-semibold">{t('result')}</h2>
        <Button variant="outline" onClick={onReset}>
          {t('newRecommendation')}
        </Button>
      </div>

      {/* Summary */}
      <Card className="bg-primary/5 border-primary/10">
        <CardContent className="pt-6">
          <p className="text-sm leading-relaxed">{result.summary}</p>
        </CardContent>
      </Card>

      {/* Tier Distribution Bar */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium mb-3">{t('tierDistribution')}</p>
          <div className="flex h-3 rounded-full overflow-hidden">
            {reach.length > 0 && (
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(reach.length / total) * 100}%` }}
              />
            )}
            {match.length > 0 && (
              <div
                className="bg-yellow-500 transition-all"
                style={{ width: `${(match.length / total) * 100}%` }}
              />
            )}
            {safety.length > 0 && (
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(safety.length / total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {t('reach')} ({reach.length})
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              {t('match')} ({match.length})
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {t('safety')} ({safety.length})
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Schools by Tier */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Reach */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold">{t('reach')}</h3>
            <Badge variant="outline" className="text-red-600 border-red-200">
              {reach.length}
            </Badge>
          </div>
          <StaggerContainer className="space-y-3">
            {reach.map((school) => (
              <StaggerItem key={school.schoolId || school.schoolName}>
                <SchoolCard school={school} existingSchoolIds={existingSchoolIds} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* Match */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-yellow-600" />
            <h3 className="font-semibold">{t('match')}</h3>
            <Badge variant="outline" className="text-yellow-600 border-yellow-200">
              {match.length}
            </Badge>
          </div>
          <StaggerContainer className="space-y-3">
            {match.map((school) => (
              <StaggerItem key={school.schoolId || school.schoolName}>
                <SchoolCard school={school} existingSchoolIds={existingSchoolIds} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* Safety */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold">{t('safety')}</h3>
            <Badge variant="outline" className="text-green-600 border-green-200">
              {safety.length}
            </Badge>
          </div>
          <StaggerContainer className="space-y-3">
            {safety.map((school) => (
              <StaggerItem key={school.schoolId || school.schoolName}>
                <SchoolCard school={school} existingSchoolIds={existingSchoolIds} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </div>

      {/* Analysis */}
      <StaggerContainer className="grid gap-6 md:grid-cols-3">
        {[
          {
            icon: TrendingUp,
            color: 'text-green-600',
            bulletColor: 'text-green-500',
            titleKey: 'strengths' as const,
            items: result.analysis.strengths,
          },
          {
            icon: TrendingDown,
            color: 'text-red-600',
            bulletColor: 'text-red-500',
            titleKey: 'weaknesses' as const,
            items: result.analysis.weaknesses,
          },
          {
            icon: Lightbulb,
            color: 'text-primary',
            bulletColor: '',
            titleKey: 'tips' as const,
            items: result.analysis.improvementTips,
          },
        ].map(({ icon: Icon, color, bulletColor, titleKey, items }) => (
          <StaggerItem key={titleKey}>
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className={cn('text-base flex items-center gap-2', color)}>
                  <Icon className="h-5 w-5" />
                  {t(titleKey)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {items.map((item, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      {titleKey === 'tips' ? (
                        <Badge variant="outline" className="shrink-0 h-5 w-5 p-0 justify-center">
                          {i + 1}
                        </Badge>
                      ) : (
                        <span className={cn(bulletColor, 'mt-1')}>•</span>
                      )}
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        {t('disclaimer')}
      </div>
    </PageTransition>
  );
}

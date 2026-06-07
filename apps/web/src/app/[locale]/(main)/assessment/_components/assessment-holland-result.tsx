'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Target, Briefcase, GraduationCap, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HOLLAND_ICONS, HOLLAND_COLORS, type HollandResult } from './assessment-constants';

interface AssessmentHollandResultProps {
  result: HollandResult;
  onRetake: () => void;
  onSetTargetMajor?: (major: string) => void;
  onStartRecommendation?: () => void;
  isSettingTargetMajor?: boolean;
}

export function AssessmentHollandResult({
  result,
  onRetake,
  onSetTargetMajor,
  onStartRecommendation,
  isSettingTargetMajor,
}: AssessmentHollandResultProps) {
  const t = useTranslations('assessment');
  const primaryMajor = result.majors[0];

  return (
    <div className="space-y-6">
      {/* Code display */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8"
      >
        <div className="flex justify-center gap-2 mb-4">
          {result.codes.split('').map((code, index) => {
            const Icon = HOLLAND_ICONS[code];
            return (
              <motion.div
                key={code}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'w-20 h-20 rounded-xl flex flex-col items-center justify-center text-white shadow-lg',
                  HOLLAND_COLORS[code]
                )}
              >
                <Icon className="h-8 w-8 mb-1" />
                <span className="text-xl font-bold">{code}</span>
              </motion.div>
            );
          })}
        </div>
        <h2 className="text-subtitle">{t('hollandCode', { code: result.codes })}</h2>
        <p className="text-muted-foreground mt-2">{result.typesZh.join(' · ')}</p>
      </motion.div>

      {/* Score breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {t('interestScores')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(result.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([type, score]) => {
              const Icon = HOLLAND_ICONS[type];
              const maxScore = 25;
              const percentage = Math.round((score / maxScore) * 100);
              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {type}
                    </span>
                    <span className="font-medium">
                      {score}/{maxScore}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ delay: 0.2 }}
                      className={cn('h-full', HOLLAND_COLORS[type])}
                    />
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Card className="border-primary/15">
        <CardContent className="grid min-w-0 gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h3 className="font-semibold">{t('resultActions.title')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('resultActions.description')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {primaryMajor ? (
              <Button
                onClick={() => onSetTargetMajor?.(primaryMajor)}
                disabled={isSettingTargetMajor}
                className="gap-2"
              >
                <GraduationCap className="h-4 w-4" />
                {t('resultActions.setTargetMajor', { major: primaryMajor })}
              </Button>
            ) : null}
            <Button variant="outline" onClick={onStartRecommendation} className="gap-2">
              {t('resultActions.schoolRecommendation')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              {t('holland.fields')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.fieldsZh.slice(0, 8).map((f) => (
                <Badge key={f} variant="outline">
                  {f}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              {t('holland.majors')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.majors.slice(0, 8).map((m) => (
                <Badge
                  key={m}
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                >
                  {m}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={onRetake} variant="outline" className="w-full">
        <RotateCcw className="mr-2 h-4 w-4" />
        {t('retake')}
      </Button>
    </div>
  );
}

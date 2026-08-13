'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  LineChart,
  Lightbulb,
  Briefcase,
  GraduationCap,
  RotateCcw,
} from 'lucide-react';
import type { MbtiResult } from './assessment-constants';

interface AssessmentMbtiResultProps {
  result: MbtiResult;
  onRetake: () => void;
  onSetTargetMajor?: (major: string) => void;
  onStartRecommendation?: () => void;
  isSettingTargetMajor?: boolean;
}

export function AssessmentMbtiResult({
  result,
  onRetake,
  onSetTargetMajor,
  onStartRecommendation,
  isSettingTargetMajor,
}: AssessmentMbtiResultProps) {
  const t = useTranslations('assessment');
  const primaryMajor = result.majors[0];

  return (
    <div className="space-y-6">
      {/* Type display */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8"
      >
        <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-violet-500 dark:bg-violet-600 border-2 border-violet-500/30 dark:border-violet-400/30 mb-4">
          <span className="text-4xl font-bold text-white">{result.type}</span>
        </div>
        <h2 className="text-subtitle">{result.titleZh}</h2>
        <p className="text-muted-foreground mt-2">{result.descriptionZh}</p>
      </motion.div>

      {/* Dimension scores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" />
            {t('dimensionAnalysis')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'E/I', key: 'EI', leftScore: result.scores.E, rightScore: result.scores.I },
            { label: 'S/N', key: 'SN', leftScore: result.scores.S, rightScore: result.scores.N },
            { label: 'T/F', key: 'TF', leftScore: result.scores.T, rightScore: result.scores.F },
            { label: 'J/P', key: 'JP', leftScore: result.scores.J, rightScore: result.scores.P },
          ].map((dim) => (
            <div key={dim.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span
                  className={
                    dim.leftScore > 50 ? 'font-bold text-primary' : 'text-muted-foreground'
                  }
                >
                  {t(`mbtiDimensions.${dim.key}.left`)} ({dim.leftScore}%)
                </span>
                <span
                  className={
                    dim.rightScore > 50 ? 'font-bold text-primary' : 'text-muted-foreground'
                  }
                >
                  {t(`mbtiDimensions.${dim.key}.right`)} ({dim.rightScore}%)
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                <div className="bg-primary transition-all" style={{ width: `${dim.leftScore}%` }} />
              </div>
            </div>
          ))}
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

      {/* Strengths and recommendations */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              {t('mbti.strengths')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.strengths.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              {t('mbti.careers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.careers.map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              {t('mbti.majors')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.majors.map((m) => (
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

      {/* Disclaimer */}
      <div className="text-xs text-muted-foreground text-center p-3 bg-muted/50 dark:bg-muted/30 rounded-lg">
        {t('mbtiDisclaimer')}
        <br />
        {t('mbtiTrademark')}
      </div>

      <Button onClick={onRetake} variant="outline" className="w-full">
        <RotateCcw className="mr-2 h-4 w-4" />
        {t('retake')}
      </Button>
    </div>
  );
}

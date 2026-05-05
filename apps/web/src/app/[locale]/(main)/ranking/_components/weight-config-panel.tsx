'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Save,
  Play,
  Sparkles,
  Trophy,
  Percent,
  DollarSign,
  TrendingUp,
  Star,
  Shield,
  Heart,
  UtensilsCrossed,
} from 'lucide-react';

interface RankingWeights {
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
  nicheOverall: number;
  safetyGrade: number;
  studentLifeGrade: number;
  campusFoodGrade: number;
}

const WEIGHT_CONFIG = [
  {
    key: 'usNewsRank',
    icon: Trophy,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-500',
    barColor: 'bg-amber-500',
    descKey: null,
  },
  {
    key: 'acceptanceRate',
    icon: Percent,
    bgColor: 'bg-violet-500/10',
    textColor: 'text-violet-500',
    barColor: 'bg-violet-500',
    descKey: 'acceptanceRateHint',
  },
  {
    key: 'tuition',
    icon: DollarSign,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-500',
    barColor: 'bg-blue-500',
    descKey: 'tuitionHint',
  },
  {
    key: 'avgSalary',
    icon: TrendingUp,
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-500',
    barColor: 'bg-emerald-500',
    descKey: null,
  },
  {
    key: 'nicheOverall',
    icon: Star,
    bgColor: 'bg-yellow-500/10',
    textColor: 'text-yellow-500',
    barColor: 'bg-yellow-500',
    descKey: 'nicheOverallHint',
  },
  {
    key: 'safetyGrade',
    icon: Shield,
    bgColor: 'bg-sky-500/10',
    textColor: 'text-sky-500',
    barColor: 'bg-sky-500',
    descKey: 'safetyGradeHint',
  },
  {
    key: 'studentLifeGrade',
    icon: Heart,
    bgColor: 'bg-rose-500/10',
    textColor: 'text-rose-500',
    barColor: 'bg-rose-500',
    descKey: 'studentLifeGradeHint',
  },
  {
    key: 'campusFoodGrade',
    icon: UtensilsCrossed,
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-500',
    barColor: 'bg-orange-500',
    descKey: 'campusFoodGradeHint',
  },
] as const;

interface WeightConfigPanelProps {
  weights: RankingWeights;
  onWeightChange: (key: keyof RankingWeights, value: number) => void;
  rankingName: string;
  onRankingNameChange: (name: string) => void;
  onCalculate: () => void;
  onSave: () => void;
  isCalculating: boolean;
  isSaving: boolean;
  hasResults: boolean;
}

export function WeightConfigPanel({
  weights,
  onWeightChange,
  rankingName,
  onRankingNameChange,
  onCalculate,
  onSave,
  isCalculating,
  isSaving,
  hasResults,
}: WeightConfigPanelProps) {
  const t = useTranslations();

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-warning" />
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('ranking.weights')}</CardTitle>
              <CardDescription>{t('ranking.weightsDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {WEIGHT_CONFIG.map((config, index) => {
            const key = config.key as keyof RankingWeights;
            const Icon = config.icon;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className="group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg',
                      config.bgColor
                    )}
                  >
                    <Icon className={cn('h-4 w-4', config.textColor)} />
                  </div>
                  <Label className="flex-1 font-medium">{t(`ranking.${key}`)}</Label>
                  <div className="px-3 py-1 rounded-full bg-muted border border-border/50 text-xs font-semibold tabular-nums min-w-[52px] text-center">
                    {weights[key]}%
                  </div>
                </div>
                <div className="ml-12">
                  <div className="relative">
                    <div className="absolute inset-0 h-2 rounded-full bg-muted" />
                    <motion.div
                      className={cn('absolute h-2 rounded-full', config.barColor)}
                      initial={false}
                      animate={{ width: `${weights[key]}%` }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    />
                    <Slider
                      aria-label={t(`ranking.${key}`)}
                      value={[weights[key]]}
                      onValueChange={([v]) => onWeightChange(key, v)}
                      max={100}
                      step={5}
                      className={cn(
                        'relative',
                        '[&_[data-slot=slider-track]]:bg-transparent',
                        '[&_[data-slot=slider-range]]:bg-transparent',
                        '[&_[data-slot=slider-thumb]]:border-2',
                        '[&_[data-slot=slider-thumb]]:shadow-md',
                        '[&_[data-slot=slider-thumb]]:transition-transform',
                        '[&_[data-slot=slider-thumb]]:hover:scale-110',
                        config.textColor.replace('text-', '[&_[data-slot=slider-thumb]]:border-')
                      )}
                    />
                  </div>
                  {config.descKey && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t(`ranking.${config.descKey}`)}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
          <div className="pt-2">
            <Button
              onClick={onCalculate}
              className="w-full gap-2 h-11 bg-warning text-warning-foreground hover:bg-warning/90 shadow-md"
              disabled={isCalculating}
            >
              <Play className="h-4 w-4" />
              {isCalculating ? t('common.loading') : t('ranking.preview')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Save className="h-4 w-4 text-muted-foreground" />
            {t('ranking.saveRanking')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder={t('ranking.namePlaceholder')}
            value={rankingName}
            onChange={(e) => onRankingNameChange(e.target.value)}
            className="h-11"
          />
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onSave}
            disabled={isSaving || !hasResults}
          >
            <Save className="h-4 w-4" />
            {isSaving ? t('common.loading') : t('common.save')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

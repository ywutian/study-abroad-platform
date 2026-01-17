'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { BarChart, Trophy, Briefcase, Sparkles } from 'lucide-react';

// Types
interface TestScore {
  type: string;
  score: number;
  subScores?: Record<string, number>;
}

interface Activity {
  name: string;
  category: string;
  role: string;
  description?: string;
  hoursPerWeek?: number;
  weeksPerYear?: number;
}

interface Award {
  name: string;
  level: string;
  year?: number;
  description?: string;
  competitionId?: string;
}

type ModuleType = 'standardized' | 'honors' | 'activities';

interface ModuleConfig {
  key: ModuleType;
  labelKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const MODULES: ModuleConfig[] = [
  {
    key: 'standardized',
    labelKey: 'standardized',
    descKey: 'standardizedDesc',
    icon: BarChart,
    color: 'text-blue-500',
    bgColor: 'from-blue-500 to-cyan-500',
  },
  {
    key: 'honors',
    labelKey: 'honors',
    descKey: 'honorsDesc',
    icon: Trophy,
    color: 'text-amber-500',
    bgColor: 'from-amber-500 to-orange-500',
  },
  {
    key: 'activities',
    labelKey: 'activities',
    descKey: 'activitiesDesc',
    icon: Briefcase,
    color: 'text-emerald-500',
    bgColor: 'from-emerald-500 to-teal-500',
  },
];

// Module selector component
interface ModuleSelectorProps {
  selectedModule: ModuleType | null;
  onSelect: (module: ModuleType) => void;
}

export function ModuleSelector({ selectedModule, onSelect }: ModuleSelectorProps) {
  const t = useTranslations('hall.modules');
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {MODULES.map((module) => (
        <motion.div key={module.key} whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }}>
          <Card
            className={cn(
              'cursor-pointer overflow-hidden transition-all duration-300',
              'hover:shadow-lg',
              selectedModule === module.key && 'ring-2 ring-primary'
            )}
            onClick={() => onSelect(module.key)}
          >
            <div className={cn('h-1 bg-gradient-to-r', module.bgColor)} />
            <CardContent className="p-6">
              <div
                className={cn(
                  'h-14 w-14 rounded-xl flex items-center justify-center mb-4',
                  'bg-gradient-to-br text-white shadow-lg',
                  module.bgColor
                )}
              >
                <module.icon className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t(module.labelKey)}</h3>
              <p className="text-sm text-muted-foreground">{t(module.descKey)}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// Score display helpers
function getScorePercentile(type: string, score: number): number {
  const benchmarks: Record<string, { max: number; avg: number }> = {
    SAT: { max: 1600, avg: 1050 },
    ACT: { max: 36, avg: 21 },
    TOEFL: { max: 120, avg: 80 },
    IELTS: { max: 9, avg: 6.5 },
    AP: { max: 5, avg: 3 },
    IB: { max: 45, avg: 30 },
  };
  const benchmark = benchmarks[type] || { max: 100, avg: 50 };
  return Math.round((score / benchmark.max) * 100);
}

// Standardized Test Review
interface StandardizedReviewProps {
  testScores: TestScore[];
  score: number;
  onScoreChange: (score: number) => void;
}

function StandardizedReview({ testScores, score, onScoreChange }: StandardizedReviewProps) {
  const t = useTranslations('hall.moduleReview');
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {testScores.length > 0 ? (
          testScores.map((test) => (
            <div key={test.type} className="rounded-xl bg-muted/50 p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">{test.type}</span>
                <Badge variant="outline">{getScorePercentile(test.type, test.score)}%ile</Badge>
              </div>
              <p className="text-3xl font-bold">{test.score}</p>
              <Progress value={getScorePercentile(test.type, test.score)} className="mt-2 h-2" />
            </div>
          ))
        ) : (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            {t('noTestScores')}
          </div>
        )}
      </div>

      <ScoreSlider score={score} onScoreChange={onScoreChange} label={t('scoreLabel')} />
    </div>
  );
}

// Honors Review
interface HonorsReviewProps {
  awards: Award[];
  score: number;
  onScoreChange: (score: number) => void;
}

const LEVEL_COLORS: Record<string, string> = {
  INTERNATIONAL: 'bg-purple-500/10 text-purple-600',
  NATIONAL: 'bg-red-500/10 text-red-600',
  STATE: 'bg-blue-500/10 text-blue-600',
  REGIONAL: 'bg-emerald-500/10 text-emerald-600',
  SCHOOL: 'bg-gray-500/10 text-gray-600',
};

function HonorsReview({ awards, score, onScoreChange }: HonorsReviewProps) {
  const t = useTranslations('hall.moduleReview');
  return (
    <div className="space-y-6">
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {awards.length > 0 ? (
          awards.map((award, i) => (
            <div key={i} className="rounded-xl bg-muted/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{award.name}</p>
                  {award.year && <p className="text-sm text-muted-foreground">{award.year}</p>}
                </div>
                <Badge className={LEVEL_COLORS[award.level] || 'bg-muted'}>{award.level}</Badge>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">{t('noAwards')}</div>
        )}
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm text-muted-foreground mb-2">
          {t('awardsTotal', { count: awards.length })}
        </p>
      </div>

      <ScoreSlider score={score} onScoreChange={onScoreChange} label={t('awardsScoreLabel')} />
    </div>
  );
}

// Activities Review
interface ActivitiesReviewProps {
  activities: Activity[];
  score: number;
  onScoreChange: (score: number) => void;
}

function ActivitiesReview({ activities, score, onScoreChange }: ActivitiesReviewProps) {
  const t = useTranslations('hall.moduleReview');
  return (
    <div className="space-y-6">
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {activities.length > 0 ? (
          activities.map((activity, i) => (
            <div key={i} className="rounded-xl bg-muted/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{activity.name}</p>
                  <p className="text-sm text-muted-foreground">{activity.role}</p>
                </div>
                <Badge variant="secondary">{activity.category}</Badge>
              </div>
              {(activity.hoursPerWeek || activity.weeksPerYear) && (
                <p className="text-xs text-muted-foreground mt-2">
                  {activity.hoursPerWeek && t('hoursPerWeek', { hours: activity.hoursPerWeek })}
                  {activity.hoursPerWeek && activity.weeksPerYear && ' · '}
                  {activity.weeksPerYear && t('weeksPerYear', { weeks: activity.weeksPerYear })}
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">{t('noActivities')}</div>
        )}
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm text-muted-foreground mb-2">
          {t('activitiesTotal', { count: activities.length })}
        </p>
      </div>

      <ScoreSlider score={score} onScoreChange={onScoreChange} label={t('activitiesScoreLabel')} />
    </div>
  );
}

// Score slider component
interface ScoreSliderProps {
  score: number;
  onScoreChange: (score: number) => void;
  label: string;
}

function ScoreSlider({ score, onScoreChange, label }: ScoreSliderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{label}</span>
        <Badge variant={score >= 7 ? 'default' : 'secondary'} className="text-lg px-4 py-1">
          {score}/10
        </Badge>
      </div>
      <Slider
        value={[score]}
        onValueChange={([v]) => onScoreChange(v)}
        max={10}
        step={1}
        className="cursor-pointer"
      />
      <div className="flex gap-2">
        {[3, 5, 7, 9].map((s) => (
          <Button
            key={s}
            variant={score === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => onScoreChange(s)}
          >
            {s}
          </Button>
        ))}
      </div>
    </div>
  );
}

// Main Review Module Card
interface ReviewModuleCardProps {
  moduleType: ModuleType;
  testScores?: TestScore[];
  awards?: Award[];
  activities?: Activity[];
  onSubmit: (score: number, comment: string) => void;
  onBack: () => void;
  className?: string;
}

export function ReviewModuleCard({
  moduleType,
  testScores = [],
  awards = [],
  activities = [],
  onSubmit,
  onBack,
  className,
}: ReviewModuleCardProps) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');

  const t = useTranslations('hall');
  const moduleConfig = MODULES.find((m) => m.key === moduleType)!;
  const ModuleIcon = moduleConfig.icon;

  const handleSubmit = () => {
    onSubmit(score, comment);
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className={cn('h-1.5 bg-gradient-to-r', moduleConfig.bgColor)} />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-12 w-12 rounded-xl flex items-center justify-center',
              'bg-gradient-to-br text-white shadow-lg',
              moduleConfig.bgColor
            )}
          >
            <ModuleIcon className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>{t(`modules.${moduleConfig.labelKey}`)}</CardTitle>
            <p className="text-sm text-muted-foreground">{t(`modules.${moduleConfig.descKey}`)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={moduleType}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {moduleType === 'standardized' && (
              <StandardizedReview testScores={testScores} score={score} onScoreChange={setScore} />
            )}
            {moduleType === 'honors' && (
              <HonorsReview awards={awards} score={score} onScoreChange={setScore} />
            )}
            {moduleType === 'activities' && (
              <ActivitiesReview activities={activities} score={score} onScoreChange={setScore} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Comment */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('moduleReview.commentLabel')}</label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('moduleReview.commentPlaceholder')}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            {t('moduleReview.back')}
          </Button>
          <Button onClick={handleSubmit} className="flex-1 gap-2">
            <Sparkles className="h-4 w-4" />
            {t('moduleReview.submitScore')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

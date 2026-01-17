'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Zap, Check, Gift, Clock } from 'lucide-react';

interface DailyChallengeProps {
  currentCount: number;
  targetCount: number;
  className?: string;
}

export function DailyChallenge({ currentCount, targetCount, className }: DailyChallengeProps) {
  const t = useTranslations('hall.dailyChallenge');
  const progress = (currentCount / targetCount) * 100;
  const isCompleted = currentCount >= targetCount;

  // Calculate time until reset (midnight) — use state to avoid hydration mismatch
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const h = Math.floor((midnight.getTime() - now.getTime()) / (1000 * 60 * 60));
      const m = Math.floor(((midnight.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft({ hours: h, minutes: m });
    };
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, []);

  const hoursLeft = timeLeft.hours;
  const minutesLeft = timeLeft.minutes;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="h-1.5 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center',
                isCompleted ? 'bg-emerald-500' : 'bg-primary'
              )}
            >
              {isCompleted ? (
                <Check className="h-4 w-4 text-white" />
              ) : (
                <Zap className="h-4 w-4 text-white" />
              )}
            </div>
            <div>
              <span className="font-semibold">{t('title')}</span>
              {isCompleted && (
                <Badge className="ml-2 bg-emerald-500/10 text-emerald-600">{t('completed')}</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {hoursLeft}h {minutesLeft}m
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('progress')}</span>
            <span className="font-medium">
              {currentCount} / {targetCount}
            </span>
          </div>
          <Progress
            value={Math.min(progress, 100)}
            className={cn('h-2', isCompleted && '[&>div]:bg-emerald-500')}
          />
        </div>

        {isCompleted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200 }}
            className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-500/10 rounded-lg p-3"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Gift className="h-5 w-5" />
            </motion.div>
            <div>
              <p className="font-medium text-sm">{t('challengeComplete')}</p>
              <p className="text-xs text-emerald-600/80">{t('keepItUp')}</p>
            </div>
          </motion.div>
        ) : (
          <div className="mt-4 text-sm text-muted-foreground">
            {t('remaining', { count: targetCount - currentCount })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Flame, Sparkles } from 'lucide-react';

interface SwipeResultData {
  isCorrect: boolean;
  actualResult: string;
  pointsEarned: number;
  currentStreak: number;
}

interface SwipeResultOverlayProps {
  result: SwipeResultData | null;
  className?: string;
}

/**
 * Reusable swipe result feedback overlay.
 * Displays correct/wrong animation, points earned, and streak counter.
 * Auto-dismisses via parent's setTimeout on the result state.
 */
export function SwipeResultOverlay({ result, className }: SwipeResultOverlayProps) {
  const t = useTranslations('hall.result');

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={cn(
            'absolute inset-0 z-50 flex items-center justify-center pointer-events-none',
            className
          )}
        >
          <div
            className={cn(
              'rounded-2xl px-6 py-5 sm:px-8 sm:py-6 text-center backdrop-blur-md shadow-2xl',
              result.isCorrect ? 'bg-emerald-500/90 text-white' : 'bg-destructive/90 text-white'
            )}
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.1 }}
              className="flex justify-center mb-3"
            >
              {result.isCorrect ? (
                <CheckCircle2 className="h-12 w-12 sm:h-14 sm:w-14" />
              ) : (
                <XCircle className="h-12 w-12 sm:h-14 sm:w-14" />
              )}
            </motion.div>

            {/* Title */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-lg sm:text-xl font-bold mb-1"
            >
              {result.isCorrect ? t('correct') : t('wrong')}
            </motion.p>

            {/* Points */}
            {result.isCorrect && result.pointsEarned > 0 && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-sm sm:text-base font-semibold flex items-center justify-center gap-1"
              >
                <Sparkles className="h-4 w-4" />
                {t('points', { points: result.pointsEarned })}
              </motion.p>
            )}

            {/* Actual result for wrong */}
            {!result.isCorrect && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-sm opacity-90"
              >
                {t('actual', { result: result.actualResult })}
              </motion.p>
            )}

            {/* Streak */}
            {result.isCorrect && result.currentStreak >= 2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35, type: 'spring', damping: 12 }}
                className="mt-2 flex items-center justify-center gap-1 text-sm font-medium"
              >
                <Flame className="h-4 w-4" />
                {t('streak', { count: result.currentStreak })}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

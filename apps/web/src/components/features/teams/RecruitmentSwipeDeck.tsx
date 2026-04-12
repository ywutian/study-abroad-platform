'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { X, Heart, Keyboard, RotateCcw, Inbox } from 'lucide-react';
import { RecruitmentSwipeCard } from './RecruitmentSwipeCard';
import type { TeamRecruitmentCardFrontDto } from '@study-abroad/shared';

interface RecruitmentSwipeDeckProps {
  cards: TeamRecruitmentCardFrontDto[];
  onSwipe: (cardId: string, action: 'LIKE' | 'PASS') => void;
  onEmpty?: () => void;
  isLoading?: boolean;
  isPending?: boolean;
  className?: string;
}

export function RecruitmentSwipeDeck({
  cards,
  onSwipe,
  onEmpty,
  isLoading = false,
  isPending = false,
  className,
}: RecruitmentSwipeDeckProps) {
  const t = useTranslations('teams.recruitment.swipeDeck');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastDirection, setLastDirection] = useState<'left' | 'right' | null>(null);

  // Reset on data change
  useEffect(() => {
    setCurrentIndex(0);
    setLastDirection(null);
  }, [cards.length]);

  const currentCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];
  const hasMore = currentIndex < cards.length;

  const handleSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (!currentCard || isPending) return;
      setLastDirection(direction);
      onSwipe(currentCard.id, direction === 'right' ? 'LIKE' : 'PASS');

      if (currentIndex >= cards.length - 1) {
        onEmpty?.();
      }
      setCurrentIndex((prev) => prev + 1);
    },
    [currentCard, currentIndex, cards.length, onSwipe, onEmpty, isPending]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentCard || isPending) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSwipe('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSwipe('right');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, handleSwipe, isPending]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-[520px]', className)}>
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Empty / all swiped
  if (!hasMore || !currentCard) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-[520px] text-center px-4',
          className
        )}
      >
        <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          {cards.length === 0 ? (
            <Inbox className="h-10 w-10 text-muted-foreground" />
          ) : (
            <RotateCcw className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <h3 className="text-xl font-semibold mb-2">
          {cards.length === 0 ? t('emptyPool') : t('allSwiped')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          {cards.length === 0 ? t('emptyPoolDesc') : t('allSwipedDesc')}
        </p>
        {cards.length > 0 && (
          <Button
            onClick={() => {
              setCurrentIndex(0);
              setLastDirection(null);
              onEmpty?.();
            }}
            variant="outline"
            size="sm"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('restart')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Progress */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm text-muted-foreground tabular-nums">
          {currentIndex + 1} / {cards.length}
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Keyboard className="h-3 w-3" />
          <span className="hidden sm:inline">{t('keyboardHint')}</span>
        </div>
      </div>

      {/* Card Stack */}
      <div className="relative h-[520px] sm:h-[560px] flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          {/* Background card */}
          {nextCard && (
            <motion.div
              key={`bg-${nextCard.id}`}
              className="absolute w-full max-w-md"
              initial={{ scale: 0.92, opacity: 0.5 }}
              animate={{ scale: 0.96, opacity: 0.7 }}
              style={{ zIndex: 0 }}
            >
              <RecruitmentSwipeCard card={nextCard} isTop={false} />
            </motion.div>
          )}

          {/* Top card */}
          <motion.div
            key={currentCard.id}
            className="absolute w-full max-w-md"
            style={{ zIndex: 1 }}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{
              x: lastDirection === 'right' ? 350 : lastDirection === 'left' ? -350 : 0,
              opacity: 0,
              scale: 0.8,
              rotate: lastDirection === 'right' ? 20 : lastDirection === 'left' ? -20 : 0,
              transition: { duration: 0.35 },
            }}
          >
            <RecruitmentSwipeCard card={currentCard} onSwipe={handleSwipe} isTop={true} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <TooltipProvider delayDuration={300}>
        <div className="flex justify-center items-center gap-6 mt-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                disabled={isPending}
                className={cn(
                  'h-14 w-14 rounded-full',
                  'border-2 border-destructive/50 hover:border-destructive',
                  'hover:bg-destructive/10 transition-all hover:scale-110 active:scale-95'
                )}
                onClick={() => handleSwipe('left')}
              >
                <X className="h-6 w-6 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t('pass')} (←)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                disabled={isPending}
                className={cn(
                  'h-16 w-16 rounded-full',
                  'border-2 border-green-500/50 hover:border-green-500',
                  'hover:bg-green-500/10 transition-all hover:scale-110 active:scale-95'
                )}
                onClick={() => handleSwipe('right')}
              >
                <Heart className="h-7 w-7 text-green-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t('like')} (→)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <X className="h-3 w-3 text-destructive" /> {t('pass')}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="h-3 w-3 text-green-500" /> {t('like')}
        </span>
      </div>
    </div>
  );
}

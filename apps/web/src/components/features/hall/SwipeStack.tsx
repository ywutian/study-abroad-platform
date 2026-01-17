'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { SwipeCard, SwipeCaseData } from './SwipeCard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { X, Check, Star, HelpCircle, RotateCcw, BookOpen, Keyboard } from 'lucide-react';

interface SwipeMeta {
  totalAvailable: number;
  totalSwiped: number;
  hasMore: boolean;
}

interface SwipeStackProps {
  cases: SwipeCaseData[];
  onSwipe: (caseId: string, direction: 'left' | 'right' | 'up' | 'down') => void;
  onEmpty?: () => void;
  isLoading?: boolean;
  className?: string;
  meta?: SwipeMeta;
}

export function SwipeStack({
  cases,
  onSwipe,
  onEmpty,
  isLoading = false,
  className,
  meta,
}: SwipeStackProps) {
  const t = useTranslations('hall.tinder');
  const ts = useTranslations('hall.swipeStack');
  const router = useRouter();
  const pathname = usePathname();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipedCards, setSwipedCards] = useState<string[]>([]);
  const [lastDirection, setLastDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

  // Reset on data change
  useEffect(() => {
    setCurrentIndex(0);
    setSwipedCards([]);
    setLastDirection(null);
  }, [cases.length]);

  const currentCase = cases[currentIndex];
  const nextCase = cases[currentIndex + 1];
  const hasMore = currentIndex < cases.length;

  const handleSwipe = useCallback(
    (direction: 'left' | 'right' | 'up' | 'down') => {
      if (!currentCase) return;

      setLastDirection(direction);
      setSwipedCards((prev) => [...prev, currentCase.id]);
      onSwipe(currentCase.id, direction);

      if (currentIndex >= cases.length - 1) {
        onEmpty?.();
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    },
    [currentCase, currentIndex, cases.length, onSwipe, onEmpty]
  );

  const handleButtonSwipe = (direction: 'left' | 'right' | 'up' | 'down') => {
    handleSwipe(direction);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSwipedCards([]);
    setLastDirection(null);
    onEmpty?.();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentCase) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handleSwipe('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSwipe('right');
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleSwipe('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleSwipe('down');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCase, handleSwipe]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-[400px] sm:h-[500px]', className)}>
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Empty states
  if (!hasMore || !currentCase) {
    const isPoolEmpty = meta?.totalAvailable === 0;

    if (isPoolEmpty) {
      return (
        <div
          className={cn(
            'flex flex-col items-center justify-center h-[400px] sm:h-[500px] text-center px-4',
            className
          )}
        >
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold mb-2">{t('emptyPool')}</h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 max-w-xs">
            {t('emptyPoolDesc')}
          </p>
          <Button
            onClick={() => {
              const locale = pathname.split('/')[1];
              router.push(`/${locale}/cases`);
            }}
            variant="default"
            size="sm"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            {t('emptyPoolAction')}
          </Button>
        </div>
      );
    }

    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-[400px] sm:h-[500px] text-center px-4',
          className
        )}
      >
        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <RotateCcw className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg sm:text-xl font-semibold mb-2">{t('allSwiped')}</h3>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 max-w-xs">
          {t('allSwipedDesc', { total: meta?.totalAvailable ?? 0 })}
        </p>
        <Button onClick={handleRestart} variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('restart')}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Progress Counter */}
      {cases.length > 0 && (
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-sm text-muted-foreground tabular-nums">
            {ts('progress', { current: currentIndex + 1, total: cases.length })}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Keyboard className="h-3 w-3" />
            <span className="hidden sm:inline">{ts('keyboardHint')}</span>
          </div>
        </div>
      )}

      {/* Card Stack */}
      <div className="relative h-[400px] sm:h-[480px] md:h-[520px] flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          {/* Background Card (Next) */}
          {nextCase && (
            <motion.div
              key={`bg-${nextCase.id}`}
              className="absolute w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0.5 }}
              animate={{ scale: 0.95, opacity: 0.7 }}
              style={{ zIndex: 0 }}
            >
              <SwipeCard data={nextCase} isTop={false} />
            </motion.div>
          )}

          {/* Top Card (Current) */}
          <motion.div
            key={currentCase.id}
            className="absolute w-full max-w-md"
            style={{ zIndex: 1 }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{
              x: lastDirection === 'right' ? 300 : lastDirection === 'left' ? -300 : 0,
              y: lastDirection === 'up' ? -300 : lastDirection === 'down' ? 300 : 0,
              opacity: 0,
              scale: 0.8,
              transition: { duration: 0.3 },
            }}
          >
            <SwipeCard data={currentCase} onSwipe={handleSwipe} isTop={true} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Action Buttons with Tooltips */}
      <TooltipProvider delayDuration={300}>
        <div className="flex justify-center items-center gap-3 sm:gap-4 mt-4 sm:mt-6">
          {/* Reject */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className={cn(
                  'h-12 w-12 sm:h-14 sm:w-14 rounded-full',
                  'border-2 border-destructive/50 hover:border-destructive',
                  'hover:bg-destructive/10 transition-all'
                )}
                onClick={() => handleButtonSwipe('left')}
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{ts('rejectLabel')} (←)</p>
            </TooltipContent>
          </Tooltip>

          {/* Skip / Waitlist */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className={cn(
                  'h-10 w-10 sm:h-12 sm:w-12 rounded-full',
                  'border-2 border-muted-foreground/50 hover:border-muted-foreground',
                  'hover:bg-muted transition-all'
                )}
                onClick={() => handleButtonSwipe('down')}
              >
                <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{ts('skipLabel')} (↓)</p>
            </TooltipContent>
          </Tooltip>

          {/* Favorite / Waitlist */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className={cn(
                  'h-10 w-10 sm:h-12 sm:w-12 rounded-full',
                  'border-2 border-warning/50 hover:border-warning',
                  'hover:bg-warning/10 transition-all'
                )}
                onClick={() => handleButtonSwipe('up')}
              >
                <Star className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{ts('favoriteLabel')} (↑)</p>
            </TooltipContent>
          </Tooltip>

          {/* Accept */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className={cn(
                  'h-12 w-12 sm:h-14 sm:w-14 rounded-full',
                  'border-2 border-success/50 hover:border-success',
                  'hover:bg-success/10 transition-all'
                )}
                onClick={() => handleButtonSwipe('right')}
              >
                <Check className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{ts('admitLabel')} (→)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Compact Swipe Legend (responsive) */}
      <div className="flex justify-center gap-4 sm:gap-6 mt-3 text-2xs sm:text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <X className="h-3 w-3 text-destructive" /> {ts('rejectLabel')}
        </span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-success" /> {ts('admitLabel')}
        </span>
        <span className="flex items-center gap-1">
          <Star className="h-3 w-3 text-warning" /> {ts('favoriteLabel')}
        </span>
        <span className="flex items-center gap-1">
          <HelpCircle className="h-3 w-3" /> {ts('skipLabel')}
        </span>
      </div>
    </div>
  );
}

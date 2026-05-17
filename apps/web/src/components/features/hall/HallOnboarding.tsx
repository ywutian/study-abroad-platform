'use client';

/**
 * HallOnboarding — lightweight first-visit walkthrough for the Alumni Square.
 *
 * 4 short steps (what you can do / how points work / leaderboard / privacy),
 * gated on a localStorage "seen" flag so it shows exactly once per browser.
 * Rendered by `hall/page.tsx`.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Compass, Coins, BarChart3, ShieldCheck } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'hall-onboarding-seen-v1';

const STEPS = [
  { icon: Compass, titleKey: 'welcomeTitle', bodyKey: 'welcomeBody' },
  { icon: Coins, titleKey: 'pointsTitle', bodyKey: 'pointsBody' },
  { icon: BarChart3, titleKey: 'leaderboardTitle', bodyKey: 'leaderboardBody' },
  { icon: ShieldCheck, titleKey: 'privacyTitle', bodyKey: 'privacyBody' },
] as const;

function hasSeenOnboarding(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Private mode / blocked storage — treat as seen to avoid nagging.
    return true;
  }
}

function markSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function HallOnboarding() {
  const t = useTranslations('hall.onboarding');
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // localStorage is only readable on the client — defer to an effect.
  useEffect(() => {
    if (!hasSeenOnboarding()) {
      setOpen(true);
    }
  }, []);

  const close = () => {
    markSeen();
    setOpen(false);
  };

  const isLast = stepIndex === STEPS.length - 1;
  const step = STEPS[stepIndex];
  const StepIcon = step.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <StepIcon className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{t(step.titleKey)}</DialogTitle>
          <DialogDescription className="text-center">
            {t(step.bodyKey)}
          </DialogDescription>
        </DialogHeader>

        {/* Step dots */}
        <div
          className="flex items-center justify-center gap-1.5"
          aria-label={t('step', { current: stepIndex + 1, total: STEPS.length })}
        >
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === stepIndex ? 'w-5 bg-primary' : 'w-1.5 bg-muted'
              )}
              aria-hidden
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={close}>
            {t('skip')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (isLast) {
                close();
              } else {
                setStepIndex((i) => i + 1);
              }
            }}
          >
            {isLast ? t('done') : t('next')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

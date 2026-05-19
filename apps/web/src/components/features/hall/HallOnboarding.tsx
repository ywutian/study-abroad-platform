'use client';

/**
 * HallOnboarding — lightweight first-visit walkthrough for the Alumni Square.
 *
 * 3 short steps (what you can do / learn from real cases / verified admit
 * data), gated on a localStorage "seen" flag so it shows exactly once per
 * browser. Rendered by `hall/page.tsx`. Pass `replayNonce` to replay it on
 * demand (the "?" button in the page header).
 *
 * Plan C (2026-05): the old "how points work" and "leaderboard" steps were
 * removed — Hall no longer ranks applicants against each other.
 * Hall §7 Decision B: the "privacy" step (peer-review opt-in) was removed
 * when the peer-review subsystem was retired.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Compass, Lightbulb, BadgeCheck, ChevronLeft } from 'lucide-react';

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

// Step copy lives under `hall.onboarding.steps.*`; the buttons (skip/next/done/
// step) live directly under `hall.onboarding.*` — keep the `steps.` prefix here.
const STEPS = [
  { icon: Compass, titleKey: 'steps.welcomeTitle', bodyKey: 'steps.welcomeBody' },
  { icon: Lightbulb, titleKey: 'steps.learnTitle', bodyKey: 'steps.learnBody' },
  { icon: BadgeCheck, titleKey: 'steps.verifiedTitle', bodyKey: 'steps.verifiedBody' },
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

interface HallOnboardingProps {
  /**
   * Replay trigger. Increment this (e.g. from the "?" header button) to reopen
   * the walkthrough on demand. A single mounted instance handles both the
   * first-visit auto-open and replays — avoids stacking two dialogs.
   */
  replayNonce?: number;
}

export function HallOnboarding({ replayNonce = 0 }: HallOnboardingProps) {
  const t = useTranslations('hall.onboarding');
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  // First-visit auto-open is deferred so the page (lazy-loaded tabs + hero BFF
  // fetch) settles before the modal covers it.
  useEffect(() => {
    if (hasSeenOnboarding()) return;
    const timer = window.setTimeout(() => setOpen(true), 650);
    return () => window.clearTimeout(timer);
  }, []);

  // On-demand replay — opens immediately, restarting from the first step.
  useEffect(() => {
    if (replayNonce > 0) {
      setStepIndex(0);
      setOpen(true);
    }
  }, [replayNonce]);

  const close = () => {
    markSeen();
    setOpen(false);
  };

  const isFirst = stepIndex === 0;
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
      <DialogContent
        className="sm:max-w-md"
        // Land focus on "Next" so Enter advances the walkthrough (the default
        // first-focusable element is "Skip", which would dismiss it).
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nextButtonRef.current?.focus();
        }}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <StepIcon className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{t(step.titleKey)}</DialogTitle>
          <DialogDescription className="text-center">{t(step.bodyKey)}</DialogDescription>
        </DialogHeader>

        {/* Step dots — decorative; progress is announced via the live region below */}
        <div className="flex items-center justify-center gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === stepIndex ? 'w-5 bg-primary' : 'w-1.5 bg-muted'
              )}
            />
          ))}
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {t('step', { current: stepIndex + 1, total: STEPS.length })}
        </p>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={close}>
            {t('skip')}
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={() => setStepIndex((i) => i - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t('back')}
              </Button>
            )}
            <Button
              ref={nextButtonRef}
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

/**
 * Hall refactor Stage 3 — 「学长之路」Tab.
 *
 * Merges what was previously two separate tabs (Tinder predict + Challenge
 * multi-school predict) into one place with a sub-toggle.
 * Reuses the existing TinderTab and ChallengeTab content for now;
 * Stage 6 will polish branding/animation and remove the game-y framing.
 *
 * Why merge: per project plan, the two tabs had ~95% overlap (both "guess
 * the admission outcome"), only differing in single-school vs multi-school.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { TinderTab } from './TinderTab';
import { ChallengeTab } from './ChallengeTab';

type PathMode = 'single' | 'challenge';

const MODE_VALUES: PathMode[] = ['single', 'challenge'];

export function PathTab() {
  const t = useTranslations('hall.path');
  const [mode, setMode] = useState<PathMode>('single');

  return (
    <div className="space-y-4">
      {/* Sub-mode toggle — keeps both interactions discoverable without flooding the page */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="flex gap-2 overflow-x-auto" role="tablist">
          {MODE_VALUES.map((value) => {
            const active = mode === value;
            return (
              <button
                key={value}
                role="tab"
                aria-selected={active}
                onClick={() => setMode(value)}
                className={cn(
                  'shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {t(`modes.${value}.label`)}
              </button>
            );
          })}
        </div>
        <p className="min-w-0 flex-1 text-sm text-muted-foreground sm:ml-2">
          {t(`modes.${mode}.description`)}
        </p>
      </div>

      {/* Content — wrap each in min-w-0 to honor Layout Robustness rule 1 (PR #214-220) */}
      <div className="min-w-0">{mode === 'single' ? <TinderTab /> : <ChallengeTab />}</div>
    </div>
  );
}

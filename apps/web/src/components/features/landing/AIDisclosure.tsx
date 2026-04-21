'use client';

import { ReactNode, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type AIDisclosureProps = {
  children?: ReactNode;
  inputs: string[];
  confidence: 'high' | 'medium' | 'low';
  limitations: string[];
  className?: string;
};

export function AIDisclosure({
  children,
  inputs,
  confidence,
  limitations,
  className,
}: AIDisclosureProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('ui.aiDisclosure');

  return (
    <div className={cn('space-y-3', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="editorial-link inline-flex items-center gap-1 text-sm text-[var(--landing-muted)] transition hover:text-[var(--landing-fg)]"
      >
        <span>{children ?? 'View model basis'}</span>
        <ChevronRight
          className={cn(
            'h-4 w-4 transition-transform motion-reduce:transition-none',
            open && 'rotate-90'
          )}
        />
      </button>

      {open ? (
        <div className="flex flex-wrap gap-4 rounded-2xl border border-dashed border-[color:var(--landing-border-strong)] bg-[color:var(--landing-surface-muted)] px-4 py-4">
          <div className="flex-1 min-w-[120px]">
            <div className="text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
              {t('inputs')}
            </div>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm leading-6 text-[var(--landing-fg)]">
              {inputs.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-3 py-1.5"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
              {t('confidence')}
            </div>
            <div className="mt-3 inline-flex rounded-md border border-primary/20 bg-[color:var(--ds-info-surface)] px-3 py-1.5 text-sm font-medium text-[var(--landing-fg)]">
              {t(`confidenceLevels.${confidence}`)}
            </div>
          </div>

          <div className="w-full">
            <div className="text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
              {t('limitations')}
            </div>
            <ul className="mt-2 space-y-1 text-sm italic leading-6 text-[var(--landing-muted)]">
              {limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { AIDisclosureProps };

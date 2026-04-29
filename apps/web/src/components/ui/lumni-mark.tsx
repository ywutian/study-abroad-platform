'use client';

import { cn } from '@/lib/utils';

type LumniMarkProps = {
  className?: string;
  iconClassName?: string;
  showDisc?: boolean;
  showMoon?: boolean;
};

export function LumniMark({
  className,
  iconClassName,
  showDisc = true,
  showMoon = true,
}: LumniMarkProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center',
        showDisc
          ? 'rounded-lg border border-primary/20 bg-primary text-primary-foreground shadow-[var(--ds-shadow-card)]'
          : 'text-current',
        className
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('h-6 w-6', iconClassName)}
      >
        {showMoon ? (
          <circle cx="48" cy="42" r="13" fill="var(--lumni-mark-moon, #ddb85a)" opacity="0.96" />
        ) : null}
        <path
          d="M48 79C42.5 70.2 40.2 61 41.9 53.4C43 48.6 45.1 45.4 48 43.8C50.9 45.4 53 48.6 54.1 53.4C55.8 61 53.5 70.2 48 79Z"
          fill="currentColor"
          opacity="0.22"
        />
        <path
          d="M48 75C43 63.5 38.5 55.2 31.3 47.2C24.1 39.1 18.3 30.5 14 20M31.3 47.2C25 46.1 19.3 48.1 13.8 53.2M31.3 47.2C28.3 37.1 30.3 27.5 37.4 18.4M48 75C53 63.5 57.5 55.2 64.7 47.2C71.9 39.1 77.7 30.5 82 20M64.7 47.2C71 46.1 76.7 48.1 82.2 53.2M64.7 47.2C67.7 37.1 65.7 27.5 58.6 18.4"
          stroke="var(--lumni-mark-antler, currentColor)"
          strokeWidth="5.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M39.8 57.2C34.1 54.6 28.8 53.4 23.8 53.7M56.2 57.2C61.9 54.6 67.2 53.4 72.2 53.7"
          stroke="var(--lumni-mark-antler, currentColor)"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

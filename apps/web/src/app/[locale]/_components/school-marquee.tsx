'use client';

import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

const schools = [
  'MIT',
  'Stanford',
  'Harvard',
  'Yale',
  'Princeton',
  'Columbia',
  'UC Berkeley',
  'Carnegie Mellon',
  'Cornell',
  'UPenn',
  'Duke',
  'Northwestern',
  'Johns Hopkins',
  'Caltech',
  'Brown',
  'Rice',
  'Vanderbilt',
  'Georgetown',
  'UCLA',
  'NYU',
];

export function SchoolMarquee() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative overflow-hidden py-4">
      {/* Gradient masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-24 bg-gradient-to-r from-muted/30 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-24 bg-gradient-to-l from-muted/30 to-transparent" />

      <div className={cn('flex w-max gap-6 sm:gap-8', !prefersReducedMotion && 'animate-marquee')}>
        {/* Render twice for seamless loop */}
        {[...schools, ...schools].map((school, i) => (
          <span
            key={`${school}-${i}`}
            className="whitespace-nowrap text-sm text-muted-foreground/60 font-medium select-none"
          >
            {school}
          </span>
        ))}
      </div>
    </div>
  );
}

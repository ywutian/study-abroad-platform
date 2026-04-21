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
    // DS v2.1 §4: use mask-image (not bg-gradient-to-*) for edge fade
    <div
      className="relative overflow-hidden py-4"
      style={{
        maskImage: 'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)',
      }}
    >
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

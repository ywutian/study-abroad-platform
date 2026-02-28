'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

export function CursorSpotlight() {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;
    // Skip touch devices
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const el = ref.current;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      el.style.setProperty('--spotlight-x', `${e.clientX}px`);
      el.style.setProperty('--spotlight-y', `${e.clientY}px`);
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMove);
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-[2] hidden lg:block"
      style={{
        background:
          'radial-gradient(800px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), oklch(0.58 0.22 255 / 0.03), transparent 60%)',
      }}
    />
  );
}

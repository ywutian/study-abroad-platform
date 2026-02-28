'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

interface SectionTransitionProps {
  direction: 'to-dark' | 'from-dark';
}

export function SectionTransition({ direction }: SectionTransitionProps) {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0.8]);
  const blur = useTransform(scrollYProgress, [0, 0.5], [4, 0]);
  const filterValue = useTransform(blur, (v) => `blur(${v}px)`);

  if (prefersReducedMotion) {
    return (
      <div
        className={
          direction === 'to-dark' ? 'zone-transition-to-dark' : 'zone-transition-from-dark'
        }
        aria-hidden="true"
      />
    );
  }

  return (
    <motion.div
      ref={ref}
      style={{ opacity, filter: filterValue }}
      className={direction === 'to-dark' ? 'zone-transition-to-dark' : 'zone-transition-from-dark'}
      aria-hidden="true"
    />
  );
}

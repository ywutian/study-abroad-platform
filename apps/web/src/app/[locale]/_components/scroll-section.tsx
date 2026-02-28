'use client';

import { useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type UseScrollOptions,
} from 'framer-motion';
import { cn } from '@/lib/utils';

type Effect = 'fade-up' | 'fade-scale' | 'fade-blur';
type ScrollOffset = UseScrollOptions['offset'];

const DEFAULT_OFFSET: ScrollOffset = ['start 85%', 'start 40%'];

export function ScrollSection({
  children,
  effect = 'fade-up',
  offset,
  className,
}: {
  children: React.ReactNode;
  effect?: Effect;
  offset?: ScrollOffset;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: offset || DEFAULT_OFFSET,
  });

  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 1], effect === 'fade-up' ? [40, 0] : [0, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], effect === 'fade-scale' ? [0.88, 1] : [1, 1]);
  const blur = useTransform(scrollYProgress, [0, 1], effect === 'fade-blur' ? [8, 0] : [0, 0]);
  const filterValue = useTransform(blur, (v) => (v > 0 ? `blur(${v}px)` : 'none'));

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      style={{ opacity, y, scale, filter: filterValue }}
      className={cn('will-change-transform', className)}
    >
      {children}
    </motion.div>
  );
}

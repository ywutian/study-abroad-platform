'use client';

import { motion, useScroll, useReducedMotion } from 'framer-motion';

export function ScrollProgress() {
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  if (prefersReducedMotion) return null;

  return (
    <motion.div
      className="fixed left-0 right-0 top-0 z-[60] h-[3px] origin-left bg-[color:var(--landing-border-strong)]"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

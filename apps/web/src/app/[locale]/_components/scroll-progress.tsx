'use client';

import { motion, useScroll, useReducedMotion } from 'framer-motion';

export function ScrollProgress() {
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  if (prefersReducedMotion) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-violet-500 to-primary z-[60] origin-left shadow-[0_0_8px_oklch(0.58_0.22_255_/_0.4),0_0_20px_oklch(0.58_0.22_255_/_0.15)]"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

'use client';

import { motion, useReducedMotion } from 'framer-motion';

export function SectionDivider() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="container mx-auto px-4 py-2">
      <motion.div
        className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
        initial={prefersReducedMotion ? {} : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

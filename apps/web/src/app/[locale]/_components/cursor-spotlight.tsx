'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

export function CursorSpotlight() {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void ref;
  }, []);

  if (prefersReducedMotion) {
    return null;
  }

  return null;
}

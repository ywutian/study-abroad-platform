'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_HERO_VISUAL_ID,
  HERO_VISUAL_STORAGE_KEY,
  parseHeroVisualId,
  type HeroVisualId,
} from '@study-abroad/shared';

function readFromDom(): HeroVisualId {
  if (typeof document === 'undefined') return DEFAULT_HERO_VISUAL_ID;
  return parseHeroVisualId(document.documentElement.getAttribute('data-hero-visual'));
}

function readFromStorage(): HeroVisualId {
  if (typeof localStorage === 'undefined') return DEFAULT_HERO_VISUAL_ID;
  return parseHeroVisualId(localStorage.getItem(HERO_VISUAL_STORAGE_KEY));
}

function applyHeroVisual(next: HeroVisualId) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-hero-visual', next);
}

export function HeroVisualManager() {
  useEffect(() => {
    const next = readFromStorage();
    applyHeroVisual(next);
    try {
      localStorage.setItem(HERO_VISUAL_STORAGE_KEY, next);
    } catch {
      /* quota / private mode */
    }
  }, []);

  return null;
}

export function useHeroVisual() {
  // Initial render uses SSR default to avoid hydration mismatch; useEffect syncs to DOM/localStorage.
  const [heroVisual, setHeroVisualState] = useState<HeroVisualId>(DEFAULT_HERO_VISUAL_ID);

  useEffect(() => {
    setHeroVisualState(readFromDom());

    const el = document.documentElement;
    const mo = new MutationObserver(() => {
      setHeroVisualState(readFromDom());
    });
    mo.observe(el, { attributes: true, attributeFilter: ['data-hero-visual'] });

    const onStorage = (event: StorageEvent) => {
      if (event.key !== HERO_VISUAL_STORAGE_KEY && event.key !== null) return;
      const parsed = parseHeroVisualId(
        event.newValue ?? localStorage.getItem(HERO_VISUAL_STORAGE_KEY)
      );
      applyHeroVisual(parsed);
      setHeroVisualState(parsed);
    };
    window.addEventListener('storage', onStorage);

    return () => {
      mo.disconnect();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setHeroVisual = useCallback((next: HeroVisualId) => {
    const parsed = parseHeroVisualId(next);
    applyHeroVisual(parsed);
    try {
      localStorage.setItem(HERO_VISUAL_STORAGE_KEY, parsed);
    } catch {
      /* quota / private mode */
    }
    setHeroVisualState(parsed);
  }, []);

  return { heroVisual, setHeroVisual };
}

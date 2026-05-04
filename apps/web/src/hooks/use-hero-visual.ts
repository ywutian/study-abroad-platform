'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
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

function subscribeDom(onChange: () => void) {
  const el = document.documentElement;
  const mo = new MutationObserver(onChange);
  mo.observe(el, { attributes: true, attributeFilter: ['data-hero-visual'] });

  const onStorage = (event: StorageEvent) => {
    if (event.key !== HERO_VISUAL_STORAGE_KEY && event.key !== null) return;
    applyHeroVisual(
      parseHeroVisualId(event.newValue ?? localStorage.getItem(HERO_VISUAL_STORAGE_KEY))
    );
    onChange();
  };

  window.addEventListener('storage', onStorage);
  return () => {
    mo.disconnect();
    window.removeEventListener('storage', onStorage);
  };
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
  const heroVisual = useSyncExternalStore(subscribeDom, readFromDom, () => DEFAULT_HERO_VISUAL_ID);

  const setHeroVisual = useCallback((next: HeroVisualId) => {
    const parsed = parseHeroVisualId(next);
    applyHeroVisual(parsed);
    try {
      localStorage.setItem(HERO_VISUAL_STORAGE_KEY, parsed);
    } catch {
      /* quota / private mode */
    }
  }, []);

  return { heroVisual, setHeroVisual };
}

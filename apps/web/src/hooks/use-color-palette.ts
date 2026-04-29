'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  COLOR_PALETTE_STORAGE_KEY,
  DEFAULT_COLOR_PALETTE,
  parseColorPalette,
  type ColorPalette,
} from '@study-abroad/shared';

function readFromDom(): ColorPalette {
  if (typeof document === 'undefined') return DEFAULT_COLOR_PALETTE;
  return parseColorPalette(document.documentElement.getAttribute('data-color-palette'));
}

function subscribeDom(onChange: () => void) {
  const el = document.documentElement;
  const mo = new MutationObserver(onChange);
  mo.observe(el, { attributes: true, attributeFilter: ['data-color-palette'] });
  const onStorage = (e: StorageEvent) => {
    if (e.key !== COLOR_PALETTE_STORAGE_KEY && e.key !== null) return;
    const next = parseColorPalette(
      e.newValue ??
        (typeof localStorage !== 'undefined'
          ? localStorage.getItem(COLOR_PALETTE_STORAGE_KEY)
          : null)
    );
    el.setAttribute('data-color-palette', next);
    onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    mo.disconnect();
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Site-wide color family (warm vs slate), persisted in localStorage.
 * Orthogonal to next-themes light/dark (`.dark` on `html`).
 */
export function useColorPalette() {
  const palette = useSyncExternalStore(subscribeDom, readFromDom, () => DEFAULT_COLOR_PALETTE);

  const setPalette = useCallback((next: ColorPalette) => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-color-palette', next);
    try {
      localStorage.setItem(COLOR_PALETTE_STORAGE_KEY, next);
    } catch {
      /* quota / private mode */
    }
  }, []);

  return { palette, setPalette };
}

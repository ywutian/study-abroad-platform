'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_COLOR_PALETTE,
  THEME_APPEARANCE_CSS_VAR_NAMES,
  THEME_APPEARANCE_OVERRIDES_STORAGE_KEY,
  getThemeAppearanceOverrideCssVars,
  normalizeThemeAppearanceOverrides,
  parseColorPalette,
  type ColorPalette,
  type ThemeAppearanceOverrides,
} from '@study-abroad/shared';

export const THEME_APPEARANCE_OVERRIDES_EVENT = 'theme-appearance-overrides-change';

type ThemeAppearanceOverrideMap = Partial<Record<ColorPalette, ThemeAppearanceOverrides>>;

function readOverrideMap(): ThemeAppearanceOverrideMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(
      localStorage.getItem(THEME_APPEARANCE_OVERRIDES_STORAGE_KEY) ?? '{}'
    ) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const next: ThemeAppearanceOverrideMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const palette = parseColorPalette(key);
      const overrides = normalizeThemeAppearanceOverrides(value);
      if (Object.keys(overrides).length > 0) {
        next[palette] = overrides;
      }
    }
    return next;
  } catch {
    return {};
  }
}

function writeOverrideMap(map: ThemeAppearanceOverrideMap) {
  try {
    localStorage.setItem(THEME_APPEARANCE_OVERRIDES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private browsing */
  }
}

export function applyThemeAppearanceOverrides(
  palette: ColorPalette = DEFAULT_COLOR_PALETTE,
  overrides?: ThemeAppearanceOverrides
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const name of THEME_APPEARANCE_CSS_VAR_NAMES) {
    root.style.removeProperty(name);
  }

  const normalized = normalizeThemeAppearanceOverrides(overrides);
  if (Object.keys(normalized).length === 0) return;

  const vars = getThemeAppearanceOverrideCssVars(palette, normalized);
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

function getCurrentPalette(): ColorPalette {
  if (typeof document === 'undefined') return DEFAULT_COLOR_PALETTE;
  return parseColorPalette(document.documentElement.getAttribute('data-color-palette'));
}

export function ThemeAppearanceManager() {
  useEffect(() => {
    const applyCurrent = () => {
      const palette = getCurrentPalette();
      const map = readOverrideMap();
      applyThemeAppearanceOverrides(palette, map[palette]);
    };

    applyCurrent();

    const observer = new MutationObserver(applyCurrent);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-palette', 'class'],
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_APPEARANCE_OVERRIDES_STORAGE_KEY && event.key !== null) return;
      applyCurrent();
    };
    const onOverrideChange = () => applyCurrent();

    window.addEventListener('storage', onStorage);
    window.addEventListener(THEME_APPEARANCE_OVERRIDES_EVENT, onOverrideChange);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(THEME_APPEARANCE_OVERRIDES_EVENT, onOverrideChange);
    };
  }, []);

  return null;
}

export function useThemeAppearanceOverrides(palette: ColorPalette) {
  const [map, setMap] = useState<ThemeAppearanceOverrideMap>({});

  useEffect(() => {
    setMap(readOverrideMap());
  }, []);

  const currentOverrides = useMemo(
    () => normalizeThemeAppearanceOverrides(map[palette]),
    [map, palette]
  );

  const persist = useCallback(
    (nextMap: ThemeAppearanceOverrideMap, nextPalette = palette) => {
      setMap(nextMap);
      writeOverrideMap(nextMap);
      applyThemeAppearanceOverrides(nextPalette, nextMap[nextPalette]);
      window.dispatchEvent(new Event(THEME_APPEARANCE_OVERRIDES_EVENT));
    },
    [palette]
  );

  const setCurrentOverrides = useCallback(
    (patch: ThemeAppearanceOverrides) => {
      const nextOverrides = normalizeThemeAppearanceOverrides({
        ...currentOverrides,
        ...patch,
      });
      persist({ ...map, [palette]: nextOverrides });
    },
    [currentOverrides, map, palette, persist]
  );

  const replaceCurrentOverrides = useCallback(
    (next: ThemeAppearanceOverrides) => {
      const nextOverrides = normalizeThemeAppearanceOverrides(next);
      persist({ ...map, [palette]: nextOverrides });
    },
    [map, palette, persist]
  );

  const resetCurrentOverrides = useCallback(() => {
    const nextMap = { ...map };
    delete nextMap[palette];
    persist(nextMap);
  }, [map, palette, persist]);

  const resetAllOverrides = useCallback(() => {
    persist({});
  }, [persist]);

  return {
    overridesByPalette: map,
    currentOverrides,
    setCurrentOverrides,
    replaceCurrentOverrides,
    resetCurrentOverrides,
    resetAllOverrides,
  };
}

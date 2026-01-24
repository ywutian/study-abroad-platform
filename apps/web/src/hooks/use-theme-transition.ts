'use client';

import { useCallback } from 'react';
import { useTheme } from 'next-themes';

/**
 * 带平滑过渡效果的主题切换 Hook
 */
export function useThemeTransition() {
  const { theme, setTheme, resolvedTheme, themes } = useTheme();

  const toggleTheme = useCallback(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.add('theme-transition');
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);
  }, [resolvedTheme, setTheme]);

  const setThemeWithTransition = useCallback(
    (newTheme: string) => {
      if (typeof document === 'undefined') return;
      document.documentElement.classList.add('theme-transition');
      setTheme(newTheme);
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transition');
      }, 300);
    },
    [setTheme]
  );

  return {
    theme,
    resolvedTheme,
    themes,
    toggleTheme,
    setTheme: setThemeWithTransition,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
  };
}

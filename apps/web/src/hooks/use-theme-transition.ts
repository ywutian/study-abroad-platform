'use client';

import { useCallback } from 'react';
import { useTheme } from 'next-themes';

/**
 * 带平滑过渡效果的主题切换 Hook
 */
export function useThemeTransition() {
  const { theme, setTheme, resolvedTheme, themes } = useTheme();

  const toggleTheme = useCallback(() => {
    // 添加过渡类
    document.documentElement.classList.add('theme-transition');

    // 切换主题
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

    // 过渡完成后移除类
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);
  }, [resolvedTheme, setTheme]);

  const setThemeWithTransition = useCallback(
    (newTheme: string) => {
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









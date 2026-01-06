'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeTransition } from '@/hooks/use-theme-transition';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * 带动画的主题切换按钮
 */
export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { toggleTheme, isDark } = useThemeTransition();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative p-2 rounded-lg transition-colors',
        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      aria-label={isDark ? '切换到亮色模式' : '切换到暗色模式'}
    >
      <div className="relative w-5 h-5">
        <AnimatePresence mode="wait">
          {isDark ? (
            <motion.div
              key="moon"
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              <Moon className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ scale: 0, rotate: 90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              <Sun className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {showLabel && (
        <span className="ml-2 text-sm">
          {isDark ? '暗色' : '亮色'}
        </span>
      )}
    </button>
  );
}

/**
 * 带三种模式的主题选择器
 */
export function ThemeSelector({ className }: { className?: string }) {
  const { resolvedTheme, setTheme, theme } = useThemeTransition();

  const options = [
    { value: 'light', icon: Sun, label: '亮色' },
    { value: 'dark', icon: Moon, label: '暗色' },
    { value: 'system', icon: Monitor, label: '系统' },
  ] as const;

  return (
    <div className={cn('flex rounded-lg bg-muted p-1', className)}>
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
            theme === value
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {theme === value && (
            <motion.div
              layoutId="theme-selector-bg"
              className="absolute inset-0 bg-background rounded-md shadow-sm"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

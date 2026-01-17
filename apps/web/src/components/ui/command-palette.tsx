'use client';

import { useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Search,
  Home,
  School,
  FileText,
  MessageSquare,
  User,
  Settings,
  Moon,
  Sun,
  HelpCircle,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useHotkey, getShortcutDisplay } from '@/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  shortcut?: string[];
  action: () => void;
  keywords?: string[];
  section?: string;
}

interface CommandPaletteProps {
  customCommands?: CommandItem[];
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

export function CommandPalette({ customCommands = [] }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const t = useTranslations('ui.command');

  // 默认命令
  const defaultCommands: CommandItem[] = useMemo(
    () => [
      {
        id: 'home',
        title: t('home'),
        icon: <Home className="w-4 h-4" />,
        action: () => router.push('/'),
        keywords: t('keywords.home').split(','),
        section: t('nav'),
      },
      {
        id: 'schools',
        title: t('schools'),
        icon: <School className="w-4 h-4" />,
        action: () => router.push('/schools'),
        keywords: t('keywords.schools').split(','),
        section: t('nav'),
      },
      {
        id: 'cases',
        title: t('cases'),
        icon: <FileText className="w-4 h-4" />,
        action: () => router.push('/cases'),
        keywords: t('keywords.cases').split(','),
        section: t('nav'),
      },
      {
        id: 'chat',
        title: t('aiAssistant'),
        icon: <MessageSquare className="w-4 h-4" />,
        action: () => router.push('/chat'),
        keywords: t('keywords.aiAssistant').split(','),
        section: t('nav'),
      },
      {
        id: 'profile',
        title: t('profile'),
        icon: <User className="w-4 h-4" />,
        action: () => router.push('/profile'),
        keywords: t('keywords.profile').split(','),
        section: t('nav'),
      },
      {
        id: 'toggle-theme',
        title: theme === 'dark' ? t('switchToLight') : t('switchToDark'),
        icon: theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
        action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
        keywords: t('keywords.theme').split(','),
        section: t('settings'),
      },
      {
        id: 'help',
        title: t('helpDocs'),
        icon: <HelpCircle className="w-4 h-4" />,
        shortcut: ['?'],
        action: () => window.open('/help', '_blank'),
        keywords: t('keywords.help').split(','),
        section: t('other'),
      },
    ],
    [router, theme, setTheme, t]
  );

  const allCommands = useMemo(
    () => [...defaultCommands, ...customCommands],
    [defaultCommands, customCommands]
  );

  // 搜索过滤
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return allCommands;

    const searchLower = search.toLowerCase();
    return allCommands.filter((cmd) => {
      const titleMatch = cmd.title.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some((k) => k.toLowerCase().includes(searchLower));
      return titleMatch || descMatch || keywordMatch;
    });
  }, [allCommands, search]);

  // 按 section 分组
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach((cmd) => {
      const section = cmd.section || t('other');
      if (!groups[section]) groups[section] = [];
      groups[section].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // 快捷键打开
  useHotkey('k', () => setOpen(true), ['meta']);
  useHotkey('k', () => setOpen(true), ['ctrl']);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            setOpen(false);
          }
          break;
        case 'Escape':
          setOpen(false);
          break;
      }
    },
    [filteredCommands, selectedIndex]
  );

  // 重置状态
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {/* 背景遮罩 */}
          <motion.div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* 命令面板 */}
          <motion.div
            className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onKeyDown={handleKeyDown}
          >
            {/* 搜索输入框 */}
            <div className="flex items-center gap-3 px-4 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 py-4 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* 命令列表 */}
            <div className="max-h-[50vh] overflow-y-auto py-2">
              {Object.entries(groupedCommands).map(([section, commands]) => (
                <div key={section}>
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {section}
                  </div>
                  {commands.map((cmd) => {
                    const globalIndex = filteredCommands.indexOf(cmd);
                    const isSelected = globalIndex === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted text-foreground'
                        )}
                        onClick={() => {
                          cmd.action();
                          setOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <span
                          className={cn(
                            'flex-shrink-0',
                            isSelected ? 'text-primary' : 'text-muted-foreground'
                          )}
                        >
                          {cmd.icon}
                        </span>
                        <span className="flex-1">
                          <span className="font-medium">{cmd.title}</span>
                          {cmd.description && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              {cmd.description}
                            </span>
                          )}
                        </span>
                        {cmd.shortcut && (
                          <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded">
                            {cmd.shortcut.join(' ')}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {filteredCommands.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground">{t('noResults')}</div>
              )}
            </div>

            {/* 底部提示 */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd>
                <span>{t('navigate')}</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd>
                <span>{t('select')}</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded">esc</kbd>
                <span>{t('close')}</span>
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 导出用于触发命令面板的按钮
export function CommandPaletteTrigger() {
  const t = useTranslations('common');
  return (
    <button
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors"
      onClick={() => {
        // 触发 ⌘K
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      }}
    >
      <Search className="w-4 h-4" />
      <span className="hidden sm:inline">{t('search')}</span>
      <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-background rounded">
        {getShortcutDisplay('K', ['meta'])}
      </kbd>
    </button>
  );
}

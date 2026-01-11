'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  School, 
  FileText, 
  User, 
  MessageSquare,
  ArrowRight,
  Clock,
  Sparkles,
  X,
  Command,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks';
import { useKeyboardShortcuts } from '@/hooks';

// 搜索结果类型
type SearchResultType = 'school' | 'case' | 'article' | 'ai' | 'page';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  description?: string;
  url: string;
  metadata?: Record<string, string>;
}

// 图标映射
const typeIcons: Record<SearchResultType, React.ElementType> = {
  school: School,
  case: FileText,
  article: FileText,
  ai: Sparkles,
  page: ArrowRight,
};

// 类型颜色
const typeColors: Record<SearchResultType, string> = {
  school: 'bg-blue-500/10 text-blue-500',
  case: 'bg-green-500/10 text-green-500',
  article: 'bg-purple-500/10 text-purple-500',
  ai: 'bg-primary/10 text-primary',
  page: 'bg-muted text-muted-foreground',
};

// Quick action keys for translation
const quickActionKeys = [
  { id: 'ai-chat', labelKey: 'aiChat', type: 'ai' as const, url: '/ai' },
  { id: 'schools', labelKey: 'browseSchools', type: 'page' as const, url: '/schools' },
  { id: 'cases', labelKey: 'viewCases', type: 'page' as const, url: '/cases' },
  { id: 'profile', labelKey: 'profile', type: 'page' as const, url: '/profile' },
];

// Hot searches - English terms that are commonly used
const hotSearchTerms = [
  'Harvard',
  'MIT',
  'Stanford',
  'Computer Science',
  'Scholarship',
];

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const t = useTranslations('globalSearch');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const debouncedQuery = useDebounce(query, 300);

  // Get translated quick actions
  const quickActions = quickActionKeys.map(action => ({
    ...action,
    label: t(`actions.${action.labelKey}`),
  }));

  // Get type label
  const getTypeLabel = (type: SearchResultType) => t(`types.${type}`);

  // 加载最近搜索
  useEffect(() => {
    const stored = localStorage.getItem('recent_searches');
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }
  }, []);

  // 保存最近搜索
  const saveRecentSearch = useCallback((term: string) => {
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));
  }, [recentSearches]);

  // 模拟搜索（实际应调用 API）
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    // 模拟 API 调用
    const timer = setTimeout(() => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          type: 'school',
          title: `${debouncedQuery} University`,
          description: t('mockResults.universityDesc'),
          url: '/schools/1',
          metadata: { rank: '#1' },
        },
        {
          id: '2',
          type: 'case',
          title: t('mockResults.caseTitle', { query: debouncedQuery }),
          description: 'GPA 3.8 | TOEFL 110 | GRE 325',
          url: '/cases/1',
        },
        {
          id: '3',
          type: 'ai',
          title: t('mockResults.askAi', { query: debouncedQuery }),
          description: t('mockResults.askAiDesc'),
          url: `/ai?q=${encodeURIComponent(debouncedQuery)}`,
        },
      ];
      setResults(mockResults);
      setLoading(false);
      setSelectedIndex(0);
    }, 300);

    return () => clearTimeout(timer);
  }, [debouncedQuery, t]);

  // 键盘导航
  const allItems = useMemo(() => {
    if (query.trim()) {
      return results;
    }
    return quickActions.map(action => ({
      id: action.id,
      type: action.type,
      title: action.label,
      url: action.url,
    }));
  }, [query, results]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (allItems[selectedIndex]) {
          handleSelect(allItems[selectedIndex]);
        }
        break;
      case 'Escape':
        onOpenChange(false);
        break;
    }
  }, [allItems, selectedIndex, onOpenChange]);

  // 选择结果
  const handleSelect = useCallback((item: SearchResult | typeof quickActions[0]) => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
    }
    router.push(item.url);
    onOpenChange(false);
    setQuery('');
  }, [query, router, onOpenChange, saveRecentSearch]);

  // 聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-0 gap-0 overflow-hidden">
        {/* 搜索输入 */}
        <div className="flex items-center gap-2 px-4 border-b">
          <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            className="border-0 shadow-none focus-visible:ring-0 h-14 text-base"
          />
          {query && (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={() => setQuery('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        <ScrollArea className="max-h-[400px]">
          {/* 无搜索词时显示 */}
          {!query.trim() && (
            <div className="p-4 space-y-4">
              {/* 快速操作 */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('quickActions')}</p>
                <div className="space-y-1">
                  {quickActions.map((action, index) => {
                    const Icon = typeIcons[action.type];
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleSelect(action as any)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                          selectedIndex === index
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', typeColors[action.type])}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium">{action.label}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 最近搜索 */}
              {recentSearches.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t('recentSearches')}</p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <Badge
                        key={term}
                        variant="secondary"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setQuery(term)}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {term}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 热门搜索 */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('hotSearches')}</p>
                <div className="flex flex-wrap gap-2">
                  {hotSearchTerms.map((term) => (
                    <Badge
                      key={term}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => setQuery(term)}
                    >
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 搜索结果 */}
          {query.trim() && (
            <div className="p-2">
              {results.length === 0 && !loading ? (
                <div className="py-12 text-center">
                  <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t('noResults', { query })}
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {results.map((result, index) => {
                    const Icon = typeIcons[result.type];
                    return (
                      <motion.button
                        key={result.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleSelect(result)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors',
                          selectedIndex === index
                            ? 'bg-primary/10'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', typeColors[result.type])}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {result.title}
                            </span>
                            {result.metadata?.rank && (
                              <Badge variant="secondary" className="text-xs">
                                {result.metadata.rank}
                              </Badge>
                            )}
                          </div>
                          {result.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {result.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {getTypeLabel(result.type)}
                        </Badge>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          )}
        </ScrollArea>

        {/* 底部快捷键提示 */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
              {t('navigate')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>
              {t('select')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
              {t('close')}
            </span>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Command className="w-3 h-3" />K {t('openSearch')}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 搜索触发按钮
export function SearchTrigger({ onClick }: { onClick: () => void }) {
  const t = useTranslations('globalSearch');
  return (
    <Button
      variant="outline"
      className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:w-64 sm:pr-12"
      onClick={onClick}
    >
      <Search className="mr-2 h-4 w-4" />
      <span className="hidden sm:inline-flex">{t('searchButton')}</span>
      <span className="inline-flex sm:hidden">{t('searchButtonShort')}</span>
      <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
        <span className="text-xs">⌘</span>K
      </kbd>
    </Button>
  );
}




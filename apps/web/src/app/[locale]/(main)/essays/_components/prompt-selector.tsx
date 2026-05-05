'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient, STALE_TIME } from '@/lib/api';
import { schoolRoutes, essayPromptRoutes } from '@study-abroad/shared';
import { useSchoolSearch } from '@/hooks/use-school-search';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { Badge } from '@/components/ui/badge';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link2, X, Search, FileText, Loader2 } from 'lucide-react';

interface EssayPrompt {
  id: string;
  prompt: string;
  promptZh?: string;
  wordLimit?: number;
  type: string;
  isRequired?: boolean;
  school?: {
    id: string;
    name: string;
    nameZh?: string;
  };
}

export interface SelectedPrompt {
  id: string;
  prompt: string;
  promptZh?: string;
  wordLimit?: number;
  type: string;
  schoolName: string;
}

interface PromptSelectorProps {
  onSelect: (prompt: SelectedPrompt) => void;
  onClear: () => void;
  selectedPrompt?: SelectedPrompt | null;
  initialSchoolId?: string | null;
  autoOpen?: boolean;
}

const TYPE_VARIANT_MAP: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PERSONAL_STATEMENT: 'default',
  WHY_SCHOOL: 'default',
  SUPPLEMENTAL: 'secondary',
  SHORT_ANSWER: 'secondary',
  ACTIVITY: 'outline',
  OPTIONAL: 'outline',
  OTHER: 'outline',
};

export function PromptSelector({
  onSelect,
  onClear,
  selectedPrompt,
  initialSchoolId,
  autoOpen,
}: PromptSelectorProps) {
  const t = useTranslations('essays.promptSelector');
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(initialSchoolId ?? null);
  const [selectedSchoolName, setSelectedSchoolName] = useState('');
  const [initialHandled, setInitialHandled] = useState(false);

  const { data: schools, isLoading: isSearching } = useSchoolSearch(schoolQuery, open);

  // When initialSchoolId is provided, fetch the school name and auto-open the popover
  const { data: initialSchool } = useQuery<{ name: string; nameZh?: string }>({
    queryKey: ['school-detail', initialSchoolId],
    queryFn: () => apiClient.get(schoolRoutes.byId(initialSchoolId!)),
    enabled: !!initialSchoolId && !initialHandled,
  });

  useEffect(() => {
    if (initialSchool && initialSchoolId && !initialHandled) {
      const name = getLocalizedName(initialSchool.nameZh, initialSchool.name, locale);
      setSelectedSchoolId(initialSchoolId);
      setSelectedSchoolName(name);
      setOpen(true);
      setInitialHandled(true);
    }
  }, [initialSchool, initialSchoolId, initialHandled, locale]);

  // Auto-open popover when triggered from "Start from School Prompt" card
  useEffect(() => {
    if (autoOpen && !initialSchoolId && !initialHandled) {
      setOpen(true);
      setInitialHandled(true);
    }
  }, [autoOpen, initialSchoolId, initialHandled]);

  const { data: prompts, isLoading: isLoadingPrompts } = useQuery<EssayPrompt[]>({
    queryKey: ['essay-prompts-by-school', selectedSchoolId],
    queryFn: () => apiClient.get(essayPromptRoutes.bySchool(selectedSchoolId!)),
    enabled: !!selectedSchoolId,
    staleTime: STALE_TIME.DYNAMIC,
  });

  const handleSchoolSelect = (schoolId: string, schoolName: string) => {
    setSelectedSchoolId(schoolId);
    setSelectedSchoolName(schoolName);
    setSchoolQuery('');
  };

  const handlePromptSelect = (prompt: EssayPrompt) => {
    const displayPrompt = locale === 'zh' && prompt.promptZh ? prompt.promptZh : prompt.prompt;
    onSelect({
      id: prompt.id,
      prompt: displayPrompt,
      promptZh: prompt.promptZh,
      wordLimit: prompt.wordLimit,
      type: prompt.type,
      schoolName: selectedSchoolName,
    });
    setOpen(false);
    setSelectedSchoolId(null);
    setSchoolQuery('');
  };

  const handleClear = () => {
    onClear();
    setSelectedSchoolId(null);
    setSchoolQuery('');
    setSelectedSchoolName('');
  };

  const handleBack = () => {
    setSelectedSchoolId(null);
    setSchoolQuery('');
  };

  const typeLabels: Record<string, string> = {
    PERSONAL_STATEMENT: t('types.PERSONAL_STATEMENT'),
    WHY_SCHOOL: t('types.WHY_SCHOOL'),
    SUPPLEMENTAL: t('types.SUPPLEMENTAL'),
    SHORT_ANSWER: t('types.SHORT_ANSWER'),
    ACTIVITY: t('types.ACTIVITY'),
    OPTIONAL: t('types.OPTIONAL'),
    OTHER: t('types.OTHER'),
  };

  const formatType = (type: string) => {
    return (
      typeLabels[type] ??
      type
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ')
    );
  };

  // Show selected prompt card
  if (selectedPrompt) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-primary">{t('linked')}</span>
            <Badge
              variant={TYPE_VARIANT_MAP[selectedPrompt.type] ?? 'outline'}
              className="text-2xs px-1.5 py-0"
            >
              {formatType(selectedPrompt.type)}
            </Badge>
            {selectedPrompt.wordLimit && (
              <span className="text-xs text-muted-foreground">
                {t('wordLimit', { count: selectedPrompt.wordLimit })}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground truncate">
            {selectedPrompt.schoolName} &mdash; {selectedPrompt.prompt.slice(0, 80)}
            {selectedPrompt.prompt.length > 80 ? '...' : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleClear}
          aria-label={t('clearLink')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="gap-1.5 text-xs">
          <Search className="h-3.5 w-3.5" />
          {t('linkPrompt')}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[380px] max-w-[calc(100vw-2rem)] p-0" align="start">
        {!selectedSchoolId ? (
          // Step 1: School search
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchSchool')}
                value={schoolQuery}
                onChange={(e) => setSchoolQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {isSearching && schoolQuery.length >= 1 && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {schools?.items && schools.items.length > 0 && (
              <ScrollArea className="mt-2 max-h-[240px]">
                <div className="space-y-0.5">
                  {schools.items.map((school) => {
                    const name = getLocalizedName(school.nameZh, school.name, locale);
                    return (
                      <button
                        key={school.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-sm px-2.5 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => handleSchoolSelect(school.id, name)}
                      >
                        <span className="font-medium truncate">{name}</span>
                        <RankingBadge
                          rankings={school.rankings}
                          usNewsRank={school.usNewsRank}
                          className="ml-2"
                        />
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {schools?.items &&
              schools.items.length === 0 &&
              schoolQuery.length >= 1 &&
              !isSearching && (
                <p className="py-4 text-center text-xs text-muted-foreground">{t('noPrompts')}</p>
              )}
          </div>
        ) : (
          // Step 2: Prompt list for selected school
          <div>
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={handleBack}
                aria-label={t('searchSchool')}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <span className="text-sm font-medium truncate">{selectedSchoolName}</span>
            </div>

            {isLoadingPrompts && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {prompts && prompts.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">{t('noPrompts')}</p>
            )}

            {prompts && prompts.length > 0 && (
              <ScrollArea className="max-h-[300px]">
                <div className="p-1.5">
                  {prompts.map((prompt) => {
                    const displayText =
                      locale === 'zh' && prompt.promptZh ? prompt.promptZh : prompt.prompt;
                    return (
                      <button
                        key={prompt.id}
                        type="button"
                        className="flex w-full flex-col gap-1.5 rounded-sm px-2.5 py-2.5 text-left hover:bg-muted transition-colors"
                        onClick={() => handlePromptSelect(prompt)}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={TYPE_VARIANT_MAP[prompt.type] ?? 'outline'}
                            className="text-2xs px-1.5 py-0"
                          >
                            {formatType(prompt.type)}
                          </Badge>
                          {prompt.wordLimit && (
                            <span className="text-2xs text-muted-foreground">
                              {t('wordLimit', { count: prompt.wordLimit })}
                            </span>
                          )}
                          <Badge
                            variant={prompt.isRequired ? 'default' : 'outline'}
                            className="text-2xs px-1.5 py-0"
                          >
                            {prompt.isRequired ? t('required') : t('optional')}
                          </Badge>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <FileText className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="text-xs text-foreground line-clamp-2">
                            {displayText}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

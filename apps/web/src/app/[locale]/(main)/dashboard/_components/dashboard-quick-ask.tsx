'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { openFloatingAgentChat } from '@/components/features/agent-chat/floating-chat-bridge';
import { cn } from '@/lib/utils';

/**
 * Inline AI ask box on the dashboard. Submitting opens the global
 * FloatingChat with the question prefilled and dispatched, so the user
 * stays on the dashboard and sees the AI response in the floating panel.
 *
 * 2026-05: Added in response to "都要点击很多地方才能用" — previously the
 * only way to ask AI was to click the FloatingChat icon, wait for it to
 * open, then type. This collapses 3 steps into 1.
 */
export function DashboardQuickAsk() {
  const t = useTranslations('dashboard.quickAsk');
  const [value, setValue] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const message = value.trim();
    if (!message) return;
    openFloatingAgentChat({ message });
    setValue('');
  };

  const suggestions: string[] = [
    t('suggestions.predict'),
    t('suggestions.essays'),
    t('suggestions.schools'),
  ];

  const handleSuggestion = (message: string) => {
    openFloatingAgentChat({ message });
  };

  return (
    <div className="rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] p-3 shadow-[var(--theme-card-shadow)]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-[var(--theme-radius-control,0.5rem)] border border-border bg-[color:var(--theme-control-bg)] px-3 py-2 transition-colors focus-within:border-primary/50">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <Button type="submit" size="sm" disabled={value.trim().length === 0} className="shrink-0">
          {t('submit')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t('try')}:</span>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => handleSuggestion(suggestion)}
            className={cn(
              'rounded-full border border-border bg-[color:var(--theme-control-bg)]',
              'px-2.5 py-0.5 text-xs text-muted-foreground transition-colors',
              'hover:border-primary/35 hover:bg-[color:var(--theme-control-hover-bg)] hover:text-foreground'
            )}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

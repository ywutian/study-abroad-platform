'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRight, ExternalLink, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { openFloatingAgentChat } from '@/components/features/agent-chat/floating-chat-bridge';
import { Link } from '@/lib/i18n/navigation';
import { DASHBOARD_EVENTS, trackEvent } from '@/lib/analytics';
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
    // 2026-05 Phase 4: track typed-text submissions for funnel analysis.
    // PII safety: log only the LENGTH of the message — not the content
    // (free-text from users may include personal details).
    trackEvent(DASHBOARD_EVENTS.quickAskSubmitted, {
      source: 'typed',
      messageLength: message.length,
    });
    openFloatingAgentChat({ message });
    setValue('');
  };

  const suggestions: string[] = [
    t('suggestions.predict'),
    t('suggestions.essays'),
    t('suggestions.schools'),
  ];

  const handleSuggestion = (message: string, index: number) => {
    // 2026-05 Phase 4: differentiate suggestion-chip clicks from typed
    // submissions so we can measure which suggestions land. We log the
    // INDEX of the chip (0/1/2) rather than the message content to
    // keep events PII-safe AND locale-agnostic.
    trackEvent(DASHBOARD_EVENTS.quickAskSuggestionClicked, {
      suggestionIndex: index,
    });
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
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => handleSuggestion(suggestion, index)}
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
      {/*
        2026-05 Phase 2.5d: AI entry-point hierarchy. The dashboard exposes
        4 AI surfaces (QuickAsk inline / FloatingChat panel / /ai full
        workspace / /chat 1-on-1 messaging — NOT AI). Users were confused
        about where the "real" conversation lives. This subtle link clarifies
        that QuickAsk → FloatingChat is the quick path, and /ai is the full
        experience (tool calls, history, multi-turn). The link does NOT
        compete with the primary submit CTA — it lives below as a tertiary
        affordance.
      */}
      <div className="mt-2 flex justify-end">
        <Link
          href="/ai"
          className={cn(
            'inline-flex items-center gap-1 text-2xs text-muted-foreground',
            'transition-colors hover:text-primary hover:underline'
          )}
          title={t('openFullWorkspaceHint')}
        >
          {t('openFullWorkspace')}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Lightbulb } from 'lucide-react';

interface SuggestionsPanelProps {
  suggestions: string[];
}

export const SuggestionsPanel = memo(function SuggestionsPanel({
  suggestions,
}: SuggestionsPanelProps) {
  const t = useTranslations('prediction');

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-overline text-muted-foreground">{t('suggestions')}</p>
      <ol className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              {index + 1}
            </span>
            <p className="text-sm text-muted-foreground">{suggestion}</p>
          </li>
        ))}
      </ol>
    </div>
  );
});

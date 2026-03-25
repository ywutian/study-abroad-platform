'use client';

import { memo, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { MAJOR_CATEGORY_PROGRAMS } from '@study-abroad/shared';
import { Sun, Trophy, FlaskConical, Lightbulb, Info } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';

export type SuggestionCategory = 'summer_program' | 'competition' | 'research' | 'general';

/**
 * Keywords for categorizing suggestions into display groups.
 * Program names are auto-derived from MAJOR_CATEGORY_PROGRAMS (shared package).
 * Only generic keywords and Chinese terms need manual maintenance here.
 */
const CATEGORY_KEYWORDS: Record<Exclude<SuggestionCategory, 'general'>, string[]> = {
  summer_program: [
    // Generic keywords
    'summer',
    'pre-college',
    'Governor',
    // Programs not in MAJOR_CATEGORY_PROGRAMS but still recognized
    'SAMS',
    'SSP',
    'PROMYS',
    'SUMaC',
    // Chinese keywords
    '暑期',
    '夏校',
    '夏令营',
    '暑假项目',
    '青年作家工坊',
    // Auto-derived from shared constants — adding a program to MAJOR_CATEGORY_PROGRAMS
    // automatically makes it categorizable here
    ...Object.values(MAJOR_CATEGORY_PROGRAMS).flatMap((c) => c.summer.map((p) => p.name)),
  ],
  competition: [
    // Generic keywords
    'competition',
    'olympiad',
    'contest',
    'AMC',
    'AIME',
    'Science Bowl',
    'ISEF',
    'Regeneron',
    'MATHCOUNTS',
    'Physics Bowl',
    // Chinese keywords
    '竞赛',
    '奥赛',
    '奥林匹克',
    '写作奖',
    '论文竞赛',
    // Auto-derived from shared constants
    ...Object.values(MAJOR_CATEGORY_PROGRAMS).flatMap((c) => c.competition.map((p) => p.name)),
  ],
  research: [
    'research',
    'lab',
    'paper',
    'publish',
    'PRIMES',
    'SPARK',
    'mentor',
    'professor',
    'thesis',
    'journal',
    '科研',
    '论文',
    '实验室',
    '研究',
    '课题',
  ],
};

const CATEGORY_CONFIG: Record<
  SuggestionCategory,
  {
    icon: typeof Sun;
    color: string;
    badgeBg: string;
    i18nKey: string;
  }
> = {
  summer_program: {
    icon: Sun,
    color: 'text-amber-500 dark:text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    i18nKey: 'suggestionCategories.summerProgram',
  },
  competition: {
    icon: Trophy,
    color: 'text-blue-500 dark:text-blue-400',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    i18nKey: 'suggestionCategories.competition',
  },
  research: {
    icon: FlaskConical,
    color: 'text-violet-500 dark:text-violet-400',
    badgeBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    i18nKey: 'suggestionCategories.research',
  },
  general: {
    icon: Lightbulb,
    color: 'text-emerald-500 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    i18nKey: 'suggestionCategories.general',
  },
};

const CATEGORY_ORDER: SuggestionCategory[] = [
  'summer_program',
  'competition',
  'research',
  'general',
];

/** @visibleForTesting */
export function categorizeSuggestion(text: string): SuggestionCategory {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return category as SuggestionCategory;
    }
  }
  return 'general';
}

interface SuggestionsPanelProps {
  suggestions: string[];
  dataCompleteness?: number;
}

export const SuggestionsPanel = memo(function SuggestionsPanel({
  suggestions,
  dataCompleteness,
}: SuggestionsPanelProps) {
  const t = useTranslations('prediction');
  const showGenericHint = dataCompleteness !== undefined && dataCompleteness < 40;

  const groupedWithIndex = useMemo(() => {
    const groups: Record<SuggestionCategory, string[]> = {
      summer_program: [],
      competition: [],
      research: [],
      general: [],
    };
    for (const s of suggestions) {
      groups[categorizeSuggestion(s)].push(s);
    }
    let idx = 0;
    const sections = CATEGORY_ORDER.filter((cat) => groups[cat].length > 0).map((cat) => ({
      category: cat,
      items: groups[cat].map((text) => ({ text, index: ++idx })),
    }));
    return { groups, sections, activeCategories: sections.length };
  }, [suggestions]);

  if (suggestions.length === 0) return null;

  const genericHintBanner = showGenericHint ? (
    <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5 mb-3">
      <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-xs text-muted-foreground">
        {t('suggestionsGenericHint')}{' '}
        <Link href="/profile" className="underline hover:text-foreground transition-colors">
          {t('completeProfile')}
        </Link>
      </p>
    </div>
  ) : null;

  if (groupedWithIndex.activeCategories <= 1) {
    return (
      <div className="space-y-2">
        {genericHintBanner}
        <p className="text-overline text-muted-foreground">{t('suggestions')}</p>
        <ul className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                {index + 1}
              </span>
              <p className="text-sm text-muted-foreground">{suggestion}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {genericHintBanner}
      <p className="text-overline text-muted-foreground">{t('suggestions')}</p>
      {groupedWithIndex.sections.map(({ category, items }) => {
        const config = CATEGORY_CONFIG[category];
        const Icon = config.icon;

        return (
          <div key={category} className="space-y-1.5" role="group" aria-label={t(config.i18nKey)}>
            <div className="flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${config.color}`} aria-hidden="true" />
              <span className="text-xs font-medium text-muted-foreground">{t(config.i18nKey)}</span>
            </div>
            <ul className="space-y-1.5 pl-0.5">
              {items.map(({ text, index }) => (
                <li key={index} className="flex items-start gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium shrink-0 mt-0.5 ${config.badgeBg}`}
                  >
                    {index}
                  </span>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
});

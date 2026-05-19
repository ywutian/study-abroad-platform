'use client';

/**
 * Hall — 校友广场 (refactored Stage 3)
 *
 * IA: 3 tabs in order of value to the user
 *   verified  — China Admit Dashboard (default, highest decision value)
 *   ranking   — competitive position vs target schools
 *   path      — 学长之路 (TinderTab + ChallengeTab merged with sub-toggle)
 *
 * Hall §7 Decision B: the `review` tab (peer review) was removed when the
 * peer-review subsystem was retired.
 *
 * Backwards compatible: `?tab=tinder` / `?tab=challenge` / `?tab=lists`
 * auto-redirect to the new structure so old bookmarks/emails keep working.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { API_ROUTES } from '@study-abroad/shared';
import { PageContainer, PageHeader } from '@/components/layout';
import { cn } from '@/lib/utils';
import { Award, BadgeCheck, BarChart3, GraduationCap, HelpCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { HallOnboarding } from '@/components/features/hall/HallOnboarding';

const VerifiedTab = dynamic(
  () => import('@/components/features/hall/VerifiedTab').then((m) => ({ default: m.VerifiedTab })),
  { ssr: false }
);
const RankingTab = dynamic(
  () => import('@/components/features/hall/RankingTab').then((m) => ({ default: m.RankingTab })),
  { ssr: false }
);
const PathTab = dynamic(
  () => import('@/components/features/hall/PathTab').then((m) => ({ default: m.PathTab })),
  { ssr: false }
);

type HallTabV2 = 'verified' | 'ranking' | 'path';

// Tab config with i18n keys, icons, and 1-line descriptions for hover tooltips
const TAB_CONFIG: Array<{
  value: HallTabV2;
  labelKey: string;
  descriptionKey: string;
  icon: typeof Award;
  // Stage 8 will swap to brand-aligned semantic palette
  color: string;
}> = [
  {
    value: 'verified',
    labelKey: 'hall.tabs.verified',
    descriptionKey: 'hall.tabs.verifiedDesc',
    icon: BadgeCheck,
    color: 'bg-indigo-500',
  },
  {
    value: 'ranking',
    labelKey: 'hall.tabs.ranking',
    descriptionKey: 'hall.tabs.rankingDesc',
    icon: BarChart3,
    color: 'bg-amber-500',
  },
  {
    value: 'path',
    labelKey: 'hall.tabs.path',
    descriptionKey: 'hall.tabs.pathDesc',
    icon: GraduationCap,
    color: 'bg-rose-500',
  },
];

const VALID_TABS = TAB_CONFIG.map((t) => t.value);

// Legacy tab → new tab mapping (back-compat for bookmarks/emails)
const LEGACY_TAB_MAP: Record<string, HallTabV2> = {
  tinder: 'path',
  challenge: 'path',
  lists: 'verified', // Lists merged into Verified's expert-curated section
};

// 2026-05 Hall Plan C (C4): the default tab used to be hardcoded to
// `verified`. The verified dataset is still sparse (the real China-mainland
// admit pipeline is not yet live — see HALL_PLAN_C §7.4), so leading with a
// near-empty "数据中心" signals an abandoned product on first impression.
// Below this many verified records, fall back to `path`, which always has
// browsable content.
const VERIFIED_SPARSE_THRESHOLD = 5;

export default function HallPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab');
  const mappedFromLegacy = rawTab && LEGACY_TAB_MAP[rawTab];
  // An explicit, valid (non-legacy) ?tab means the user picked a tab — their
  // choice always wins over the data-aware default below.
  const explicitTab: HallTabV2 | null = VALID_TABS.includes(rawTab as HallTabV2)
    ? (rawTab as HallTabV2)
    : null;
  const initialTab: HallTabV2 = mappedFromLegacy ? mappedFromLegacy : (explicitTab ?? 'verified');

  const [activeTab, setActiveTab] = useState<HallTabV2>(initialTab);
  const [onboardingReplayNonce, setOnboardingReplayNonce] = useState(0);
  // Once the user clicks a tab, stop applying the data-aware default.
  const [userPickedTab, setUserPickedTab] = useState(false);

  // C4 — data-aware default: only relevant when no tab was explicitly chosen.
  const hasExplicitTab = Boolean(mappedFromLegacy || explicitTab);
  const { data: verifiedProbe } = useQuery<{ total: number }>({
    queryKey: ['hall-verified-probe'],
    queryFn: () =>
      apiClient.get(`${API_ROUTES.HALLS}/verified-ranking`, {
        params: { limit: '1', offset: '0' },
      }),
    enabled: !hasExplicitTab,
    staleTime: 5 * 60_000,
  });

  // When verified is sparse and the user hasn't picked a tab, fall back to
  // `path` (always populated). Runs once the probe resolves.
  useEffect(() => {
    if (hasExplicitTab || userPickedTab) return;
    if (verifiedProbe && verifiedProbe.total < VERIFIED_SPARSE_THRESHOLD) {
      setActiveTab('path');
    }
  }, [verifiedProbe, hasExplicitTab, userPickedTab]);

  // Auto-rewrite legacy ?tab values to the new IA so the URL is canonical.
  useEffect(() => {
    if (mappedFromLegacy) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', mappedFromLegacy);
      router.replace(`/hall?${params.toString()}`, { scroll: false });
    }
    // intentionally only run on legacy hit at mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (tab: HallTabV2) => {
    setUserPickedTab(true);
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'verified') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(`/hall${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <PageContainer variant="community">
      <PageHeader
        title={t('hall.title')}
        description={t('hall.description')}
        icon={Award}
        color="indigo"
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOnboardingReplayNonce((n) => n + 1)}
            aria-label={t('hall.onboarding.replay')}
            title={t('hall.onboarding.replay')}
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        }
      />

      {/* Stage 6 — first-visit onboarding (localStorage-gated, shows once);
          the "?" header button replays it via the nonce. */}
      <HallOnboarding replayNonce={onboardingReplayNonce} />

      {/* 2026-05 Hall Plan C (C3): the HallHeroBar — a points / streak /
          badge / daily-challenge scoreboard shown on every tab — was
          removed. A gamification scoreboard frames a high-stakes,
          high-anxiety college-prep tool as a points game, which is a
          brand risk for the paying parent. Hall is a data + learning
          surface, not an arcade. */}

      {/* Tab 切换器 — 3 tabs, all min-w-0 inside grid for overflow safety */}
      <div className="mb-4 sm:mb-8">
        <div
          className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1"
          role="tablist"
          aria-label={t('hall.title')}
        >
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.value)}
                title={t(tab.descriptionKey)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-white/90 dark:bg-white/10 shadow-lg backdrop-blur-sm'
                    : 'bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    isActive ? `${tab.color} text-white` : 'bg-muted text-muted-foreground'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                </div>
                <span className={isActive ? '' : 'text-muted-foreground'}>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'verified' && <VerifiedTab />}
        {activeTab === 'ranking' && <RankingTab />}
        {activeTab === 'path' && <PathTab />}
      </AnimatePresence>
    </PageContainer>
  );
}

'use client';

/**
 * Hall — 校友广场 (refactored Stage 3)
 *
 * IA: 4 tabs in order of value to the user
 *   verified  — China Admit Dashboard (default, highest decision value)
 *   ranking   — competitive position vs target schools
 *   review    — peer reviews (Tinder-style + classic) for self-improvement
 *   path      — 学长之路 (TinderTab + ChallengeTab merged with sub-toggle)
 *
 * Backwards compatible: `?tab=tinder` / `?tab=challenge` / `?tab=lists`
 * auto-redirect to the new structure so old bookmarks/emails keep working.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { PageContainer, PageHeader } from '@/components/layout';
import { cn } from '@/lib/utils';
import { Award, BadgeCheck, BarChart3, MessageSquare, GraduationCap } from 'lucide-react';
import dynamic from 'next/dynamic';
import { HallHeroBar } from '@/components/features/hall/HallHeroBar';

const VerifiedTab = dynamic(
  () => import('@/components/features/hall/VerifiedTab').then((m) => ({ default: m.VerifiedTab })),
  { ssr: false }
);
const RankingTab = dynamic(
  () => import('@/components/features/hall/RankingTab').then((m) => ({ default: m.RankingTab })),
  { ssr: false }
);
const ReviewTab = dynamic(
  () => import('@/components/features/hall/ReviewTab').then((m) => ({ default: m.ReviewTab })),
  { ssr: false }
);
const PathTab = dynamic(
  () => import('@/components/features/hall/PathTab').then((m) => ({ default: m.PathTab })),
  { ssr: false }
);

type HallTabV2 = 'verified' | 'ranking' | 'review' | 'path';

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
    color: 'bg-gradient-to-r from-indigo-500 to-blue-500',
  },
  {
    value: 'ranking',
    labelKey: 'hall.tabs.ranking',
    descriptionKey: 'hall.tabs.rankingDesc',
    icon: BarChart3,
    color: 'bg-gradient-to-r from-amber-500 to-orange-500',
  },
  {
    value: 'review',
    labelKey: 'hall.tabs.review',
    descriptionKey: 'hall.tabs.reviewDesc',
    icon: MessageSquare,
    color: 'bg-gradient-to-r from-violet-500 to-purple-500',
  },
  {
    value: 'path',
    labelKey: 'hall.tabs.path',
    descriptionKey: 'hall.tabs.pathDesc',
    icon: GraduationCap,
    color: 'bg-gradient-to-r from-rose-500 to-pink-500',
  },
];

const VALID_TABS = TAB_CONFIG.map((t) => t.value);

// Legacy tab → new tab mapping (back-compat for bookmarks/emails)
const LEGACY_TAB_MAP: Record<string, HallTabV2> = {
  tinder: 'path',
  challenge: 'path',
  lists: 'verified', // Lists被合并到Verified的"专家清单"分类
};

export default function HallPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab');
  const mappedFromLegacy = rawTab && LEGACY_TAB_MAP[rawTab];
  const initialTab: HallTabV2 = mappedFromLegacy
    ? mappedFromLegacy
    : VALID_TABS.includes(rawTab as HallTabV2)
      ? (rawTab as HallTabV2)
      : 'verified'; // Stage 3: default is now Verified (was Tinder)

  const [activeTab, setActiveTab] = useState<HallTabV2>(initialTab);

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
      />

      {/* Stage 3 — Hero bar with overview from /halls/me/overview BFF */}
      <HallHeroBar />

      {/* Tab 切换器 — 4 tabs, all min-w-0 inside grid for overflow safety */}
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
        {activeTab === 'review' && <ReviewTab />}
        {activeTab === 'path' && <PathTab />}
      </AnimatePresence>
    </PageContainer>
  );
}

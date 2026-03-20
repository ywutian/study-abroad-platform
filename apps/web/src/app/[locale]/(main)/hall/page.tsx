'use client';

/**
 * Hall 主页面 — 功能大厅
 *
 * 职责：页面布局 + Tab 切换 + URL 持久化
 * 各 Tab 的业务逻辑已拆分到独立组件：
 * - TinderTab   — 预测游戏
 * - ReviewTab   — 锐评模式
 * - RankingTab  — 排名对比
 * - ListsTab    — 用户榜单
 * - ChallengeTab — 挑战模式
 * - VerifiedTab — 认证排行
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { PageContainer, PageHeader } from '@/components/layout';
import { cn } from '@/lib/utils';
import { Award, Zap, Users, Trophy, List, Target, CheckCircle2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { HallTab } from '@/types/hall';

// 按需加载各 Tab 组件（code-split）
const TinderTab = dynamic(
  () => import('@/components/features/hall/TinderTab').then((m) => ({ default: m.TinderTab })),
  { ssr: false }
);
const ReviewTab = dynamic(
  () => import('@/components/features/hall/ReviewTab').then((m) => ({ default: m.ReviewTab })),
  { ssr: false }
);
const RankingTab = dynamic(
  () => import('@/components/features/hall/RankingTab').then((m) => ({ default: m.RankingTab })),
  { ssr: false }
);
const ListsTab = dynamic(
  () => import('@/components/features/hall/ListsTab').then((m) => ({ default: m.ListsTab })),
  { ssr: false }
);
const ChallengeTab = dynamic(
  () =>
    import('@/components/features/hall/ChallengeTab').then((m) => ({ default: m.ChallengeTab })),
  { ssr: false }
);
const VerifiedTab = dynamic(
  () => import('@/components/features/hall/VerifiedTab').then((m) => ({ default: m.VerifiedTab })),
  { ssr: false }
);

// Tab 配置
const TAB_CONFIG = [
  {
    value: 'tinder' as const,
    labelKey: 'hall.tabs.tinder',
    icon: Zap,
    color: 'bg-gradient-to-r from-pink-500 to-rose-500',
  },
  { value: 'review' as const, labelKey: 'hall.tabs.review', icon: Users, color: 'bg-primary' },
  { value: 'ranking' as const, labelKey: 'hall.tabs.ranking', icon: Trophy, color: 'bg-warning' },
  { value: 'lists' as const, labelKey: 'hall.tabs.lists', icon: List, color: 'bg-primary' },
  {
    value: 'challenge' as const,
    labelKey: 'hall.tabs.challenge',
    icon: Target,
    color: 'bg-gradient-to-r from-amber-500 to-orange-500',
  },
  {
    value: 'verified' as const,
    labelKey: 'hall.tabs.verified',
    icon: CheckCircle2,
    color: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  },
];

const VALID_TABS = TAB_CONFIG.map((t) => t.value);

export default function HallPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = VALID_TABS.includes(searchParams.get('tab') as HallTab)
    ? (searchParams.get('tab') as HallTab)
    : 'tinder';
  const [activeTab, setActiveTab] = useState<HallTab>(initialTab);

  const handleTabChange = (tab: HallTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'tinder') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(`/hall${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <PageContainer maxWidth="7xl">
      <PageHeader
        title={t('hall.title')}
        description={t('hall.description')}
        icon={Award}
        color="rose"
      />

      {/* Tab 切换器 */}
      <div className="mb-4 sm:mb-8">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
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

      {/* Tab 内容区 */}
      <AnimatePresence mode="wait">
        {activeTab === 'tinder' && <TinderTab />}
        {activeTab === 'review' && <ReviewTab />}
        {activeTab === 'ranking' && <RankingTab />}
        {activeTab === 'lists' && <ListsTab />}
        {activeTab === 'challenge' && <ChallengeTab />}
        {activeTab === 'verified' && <VerifiedTab />}
      </AnimatePresence>
    </PageContainer>
  );
}

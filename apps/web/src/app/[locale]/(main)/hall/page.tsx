'use client';

/**
 * Hall 主页面 — 功能大厅
 *
 * 职责：页面布局 + Tab 切换
 * 各 Tab 的业务逻辑已拆分到独立组件：
 * - TinderTab  — 预测游戏
 * - ReviewTab  — 锐评模式
 * - RankingTab — 排名对比
 * - ListsTab   — 用户榜单
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence } from 'framer-motion';
import { PageContainer } from '@/components/layout';
import { cn } from '@/lib/utils';
import { Zap, Users, Trophy, List, Sparkles } from 'lucide-react';
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
];

export default function HallPage() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<HallTab>('tinder');

  return (
    <PageContainer maxWidth="7xl">
      {/* 页面头部 */}
      <div className="relative mb-4 sm:mb-8 overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 p-4 sm:p-6 md:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/15 blur-3xl" />

        <div className="relative z-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 shadow-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-title">{t('hall.title')}</h1>
                  <p className="text-muted-foreground">{t('hall.description')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab 切换器 */}
          <div className="mt-4 sm:mt-6 flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {TAB_CONFIG.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
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
      </div>

      {/* Tab 内容区 */}
      <AnimatePresence mode="wait">
        {activeTab === 'tinder' && <TinderTab />}
        {activeTab === 'review' && <ReviewTab />}
        {activeTab === 'ranking' && <RankingTab />}
        {activeTab === 'lists' && <ListsTab />}
      </AnimatePresence>
    </PageContainer>
  );
}

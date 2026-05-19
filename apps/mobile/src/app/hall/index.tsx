/**
 * Hall — 校友广场 / Alumni Square (refactored Stage 4)
 *
 * 4 tabs in order of value to the user (mirrors the web IA):
 *   verified — China Admit Dashboard (default, highest decision value)
 *   ranking  — competitive position vs target schools
 *   review   — qualitative peer feedback (Plan C / C2: numeric scoring removed)
 *   path     — 学长之路 (single-case swipe + batch challenge)
 *
 * The legacy 6-tab structure (reviews / ranking / lists / verified / …) and
 * the orphan `HallOfFameScreen` were removed in Stage 4. Lists are gone:
 * curation moved server-side.
 */
import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Segment } from '@/components/ui';
import { useColors, spacing } from '@/utils/theme';
import type { TabKey } from '@/screens/hall/types';
import { VerifiedTab } from '@/screens/hall/VerifiedTab';
import { RankingTab } from '@/screens/hall/RankingTab';
import { ReviewFeedbackTab } from '@/screens/hall/ReviewFeedbackTab';
import { PathTab } from '@/screens/hall/PathTab';

export default function HallPage() {
  const { t } = useTranslation();
  const c = useColors();
  // Stage 4: default tab is `verified` (was `reviews`).
  const [activeTab, setActiveTab] = useState<TabKey>('verified');

  const segments = useMemo(
    () => [
      { key: 'verified', label: t('hall.tabs.verified') },
      { key: 'ranking', label: t('hall.tabs.ranking') },
      { key: 'review', label: t('hall.tabs.review') },
      { key: 'path', label: t('hall.tabs.path') },
    ],
    [t]
  );

  return (
    <>
      <Stack.Screen options={{ title: t('hall.title') }} />

      <View style={[S.container, { backgroundColor: c.background }]}>
        <View style={S.header}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Segment
              segments={segments}
              value={activeTab}
              onChange={(key) => setActiveTab(key as TabKey)}
            />
          </ScrollView>
        </View>

        <View style={[S.content, { flex: 1 }]}>
          {activeTab === 'verified' && <VerifiedTab />}
          {activeTab === 'ranking' && <RankingTab />}
          {activeTab === 'review' && <ReviewFeedbackTab />}
          {activeTab === 'path' && <PathTab />}
        </View>
      </View>
    </>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
});

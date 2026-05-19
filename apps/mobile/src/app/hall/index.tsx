/**
 * Hall — 校友广场 / Alumni Square (refactored Stage 4)
 *
 * 3 tabs in order of value to the user (mirrors the web IA):
 *   verified — China Admit Dashboard (default, highest decision value)
 *   ranking  — competitive position vs target schools
 *   path     — 学长之路 (single-case swipe + batch challenge)
 *
 * Hall §7 Decision B: the `review` tab (qualitative peer feedback) was
 * removed when the peer-review subsystem was retired.
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

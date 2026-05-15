/**
 * Hall of Fame Page
 *
 * 4 tabs: Reviews (锐评) | Ranking (竞争力排名) | Lists (排行榜) | Verified (认证排名)
 */
import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Segment } from '@/components/ui';
import { useColors, spacing } from '@/utils/theme';
import type { TabKey } from '@/screens/hall/types';
import { ReviewsTab } from '@/screens/hall/ReviewsTab';
import { RankingTab } from '@/screens/hall/RankingTab';
import { ListsTab } from '@/screens/hall/ListsTab';
import { VerifiedTab } from '@/screens/hall/VerifiedTab';

export default function HallOfFamePage() {
  const { t } = useTranslation();
  const c = useColors();
  const [activeTab, setActiveTab] = useState<TabKey>('reviews');

  const segments = useMemo(
    () => [
      { key: 'reviews', label: t('hallOfFame.tabs.reviews') },
      { key: 'ranking', label: t('hallOfFame.tabs.ranking') },
      { key: 'lists', label: t('hallOfFame.tabs.lists') },
      { key: 'verified', label: t('hallOfFame.tabs.verified') },
    ],
    [t]
  );

  return (
    <>
      <Stack.Screen options={{ title: t('hallOfFame.title') }} />

      <View style={[S.container, { backgroundColor: c.background }]}>
        <View style={S.segmentWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Segment
              segments={segments}
              value={activeTab}
              onChange={(key) => setActiveTab(key as TabKey)}
            />
          </ScrollView>
        </View>

        <View style={[S.content, { flex: 1 }]}>
          {activeTab === 'reviews' && <ReviewsTab />}
          {activeTab === 'ranking' && <RankingTab />}
          {activeTab === 'lists' && <ListsTab />}
          {activeTab === 'verified' && <VerifiedTab />}
        </View>
      </View>
    </>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentWrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
});

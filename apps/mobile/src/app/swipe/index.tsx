/**
 * Swipe Prediction Game Page
 *
 * Tinder-like card swiping interface where users predict college admission
 * outcomes (admit / reject / waitlist). Features gesture-based card interactions,
 * animated overlays, stats tracking, and a leaderboard view.
 *
 * Thin orchestrator that switches between GameView and StatsView.
 */
import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/utils/theme';

import { ViewMode } from './_components/types';
import GameView from './_components/GameView';
import StatsView from './_components/StatsView';

export default function SwipePage() {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<ViewMode>('game');

  const showStats = useCallback(() => setViewMode('stats'), []);
  const showGame = useCallback(() => setViewMode('game'), []);

  return (
    <>
      <Stack.Screen options={{ title: t('swipe.title'), headerShown: viewMode === 'game' }} />

      <View
        style={[styles.container, { backgroundColor: c.background, paddingBottom: insets.bottom }]}
      >
        {viewMode === 'game' ? (
          <GameView onShowStats={showStats} />
        ) : (
          <StatsView onBack={showGame} />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

/**
 * PathTab — 「学长之路」 (Hall refactor Stage 4 M4).
 *
 * Merges the previously separate single-case Tinder prediction game and the
 * multi-school batch challenge into one tab with a sub-mode toggle.
 *
 * `single` mode reuses the existing swipe screens
 * (`screens/swipe/GameView` + `StatsView`) verbatim — that flow is already a
 * complete Reanimated 4 Tinder deck. `challenge` mode renders `ChallengeMode`.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Segment } from '@/components/ui';
import { useColors, spacing, fontSize } from '@/utils/theme';
import GameView from '@/screens/swipe/GameView';
import StatsView from '@/screens/swipe/StatsView';
import { ChallengeMode } from './ChallengeMode';

type PathMode = 'single' | 'challenge';

export function PathTab() {
  const { t } = useTranslation();
  const c = useColors();

  const [mode, setMode] = useState<PathMode>('single');
  // `single` mode owns a game/stats sub-view, same as the standalone swipe page.
  const [singleView, setSingleView] = useState<'game' | 'stats'>('game');

  const segments = useMemo(
    () => [
      { key: 'single', label: t('hall.path.modes.single') },
      { key: 'challenge', label: t('hall.path.modes.challenge') },
    ],
    [t]
  );

  const showStats = useCallback(() => setSingleView('stats'), []);
  const showGame = useCallback(() => setSingleView('game'), []);

  return (
    <View style={S.container}>
      <View style={S.toggleRow}>
        <Segment segments={segments} value={mode} onChange={(key) => setMode(key as PathMode)} />
      </View>
      <Text style={[S.modeDesc, { color: c.foregroundMuted }]}>
        {t(`hall.path.modes.${mode}Desc`)}
      </Text>

      <View style={S.content}>
        {mode === 'single' ? (
          singleView === 'game' ? (
            <GameView onShowStats={showStats} />
          ) : (
            <StatsView onBack={showGame} />
          )
        ) : (
          <ChallengeMode />
        )}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
  },
  toggleRow: {
    marginBottom: spacing.sm,
  },
  modeDesc: {
    fontSize: fontSize.xs,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
  },
});

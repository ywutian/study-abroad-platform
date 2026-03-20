/**
 * AI Recommendation Page
 *
 * AI-powered school recommendation with:
 * - Preflight check (profile completeness, points balance)
 * - Preference form (regions, majors, budget, school count)
 * - Animated generation progress
 * - Results display with tier badges, probability bars, and analysis
 * - History tab with expandable past recommendations
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  UIManager,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Segment } from '@/components/ui';
import { useColors, colors as themeColors, spacing, fontSize, fontWeight } from '@/utils/theme';

import { GenerateTab } from '@/screens/recommendation/GenerateTab';
import { HistoryTab } from '@/screens/recommendation/HistoryTab';
import { RecommendationResult, recommendationKeys } from '@/screens/recommendation/types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function RecommendationPage() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Tabs
  const [activeTab, setActiveTab] = useState('generate');

  // Cross-tab communication: when user clicks "View Full Results" in history
  const [externalResult, setExternalResult] = useState<RecommendationResult | null>(null);

  // ─── Handlers ──────────────────────────────────────────

  const handleViewHistoryResult = useCallback((item: RecommendationResult) => {
    setExternalResult(item);
    setActiveTab('generate');
  }, []);

  const handleSwitchToGenerate = useCallback(() => {
    setActiveTab('generate');
  }, []);

  const handleExternalResultConsumed = useCallback(() => {
    setExternalResult(null);
  }, []);

  // ─── Refresh ───────────────────────────────────────────

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: recommendationKeys.preflight() }),
      activeTab === 'history'
        ? queryClient.invalidateQueries({ queryKey: recommendationKeys.history() })
        : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [queryClient, activeTab]);

  // ─── Main Render ───────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          title: t('recommendation.title', 'AI Recommendation'),
          headerLargeTitle: false,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(500).springify()}>
          <LinearGradient
            colors={[colors.primary, colors.primary + 'cc']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroIcon}>
                <Ionicons name="school" size={28} color={colors.onGradient} />
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>
                  {t('recommendation.heroTitle', 'Smart School Selection')}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {t(
                    'recommendation.heroSubtitle',
                    'AI-powered recommendations tailored to your profile'
                  )}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <Segment
            segments={[
              { key: 'generate', label: t('recommendation.tabGenerate', 'Generate') },
              { key: 'history', label: t('recommendation.tabHistory', 'History') },
            ]}
            value={activeTab}
            onChange={(key) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(key);
            }}
          />
        </View>

        {/* Tab Content */}
        {activeTab === 'generate' && (
          <View style={styles.tabContent}>
            <GenerateTab
              externalResult={externalResult}
              onExternalResultConsumed={handleExternalResultConsumed}
            />
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.tabContent}>
            <HistoryTab
              onViewResult={handleViewHistoryResult}
              onSwitchToGenerate={handleSwitchToGenerate}
            />
          </View>
        )}
      </ScrollView>
    </>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Hero
  hero: {
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: themeColors.light.onGradientOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: themeColors.light.onGradient,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: fontSize.sm,
    color: themeColors.light.onGradientMuted,
    lineHeight: fontSize.sm * 1.4,
  },

  // Tabs
  tabContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  tabContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});

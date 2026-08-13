import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, Badge, Loading, EmptyState } from '@/components/ui';
import { profileRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';
import type { Profile } from '@/types';
import type { Essay } from '@study-abroad/shared/types';

const STATUS_VARIANT: Record<string, 'secondary' | 'warning' | 'success'> = {
  DRAFT: 'secondary',
  IN_REVIEW: 'warning',
  FINAL: 'success',
};

export default function EssaysScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const {
    data: profile,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<Profile>(profileRoutes.me()),
  });

  const essays = (profile?.essays || []) as Essay[];

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Loading fullScreen />
      </View>
    );
  }

  if (essays.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="document-text-outline"
          title={t('profile.essays')}
          description={t('profileEdit.noScoresDesc')}
          action={{
            label: t('essays.title'),
            onPress: () => router.push('/essays'),
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.list}>
        {essays.map((essay) => (
          <TouchableOpacity
            key={essay.id}
            activeOpacity={0.7}
            onPress={() => router.push('/essays')}
            accessibilityRole="button"
            accessibilityLabel={essay.title}
          >
            <Card>
              <CardContent style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
                    {essay.title}
                  </Text>
                  <Badge variant={STATUS_VARIANT[essay.status] || 'secondary'}>
                    {essay.status}
                  </Badge>
                </View>

                <View style={styles.meta}>
                  {essay.promptType && <Badge variant="outline">{essay.promptType}</Badge>}
                  {essay.wordCount !== undefined && (
                    <Text style={[styles.wordCount, { color: colors.foregroundMuted }]}>
                      {essay.wordCount} {t('common.words')}
                    </Text>
                  )}
                </View>
              </CardContent>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardContent: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordCount: {
    fontSize: fontSize.sm,
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, Button, Loading } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { profileRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius, withOpacity } from '@/utils/theme';
import type { Profile } from '@/types';

export default function ExportScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<Profile>(profileRoutes.me()),
  });

  const handleExportJson = async () => {
    if (!profile) return;

    setExporting(true);
    try {
      const exportData = {
        grade: profile.grade,
        schoolType: profile.schoolType,
        currentSchool: profile.currentSchool,
        targetMajor: profile.targetMajor,
        gpa: profile.gpa,
        gpaScale: profile.gpaScale,
        budgetTier: profile.budgetTier,
        testScores: profile.testScores,
        activities: profile.activities,
        awards: profile.awards,
        education: profile.education,
        exportedAt: new Date().toISOString(),
      };

      const json = JSON.stringify(exportData, null, 2);
      await Share.share({ message: json, title: 'Profile Export' });
      toast.show({ type: 'success', message: t('common.success') });
    } catch {
      toast.show({ type: 'error', message: t('common.error') });
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Loading fullScreen />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <Card>
          <CardContent style={styles.cardContent}>
            <View
              style={[styles.iconCircle, { backgroundColor: withOpacity(colors.primary, 0.125) }]}
            >
              <Ionicons name="code-slash-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>JSON</Text>
            <Text style={[styles.cardDesc, { color: colors.foregroundMuted }]}>
              {t('profile.exportData')}
            </Text>
            <Button
              onPress={handleExportJson}
              loading={exporting}
              variant="outline"
              size="sm"
              style={styles.exportButton}
              accessibilityLabel={t('profile.exportData')}
              leftIcon={<Ionicons name="share-outline" size={16} color={colors.primary} />}
            >
              {t('profile.exportData')}
            </Button>
          </CardContent>
        </Card>
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
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  cardContent: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  exportButton: {
    marginTop: spacing.xs,
  },
});

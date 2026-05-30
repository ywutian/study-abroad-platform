import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useColors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  fontFamily,
  withOpacity,
} from '@/utils/theme';
import { Loading } from '@/components/ui';
import { StatsRow } from '@/components/ui/StatsRow';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { userRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';

export default function ReferralScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();

  const { data: referralData, isLoading } = useQuery({
    queryKey: ['referral'],
    queryFn: () => apiClient.get(`${userRoutes.me()}/referral`),
  });

  const handleCopy = async () => {
    if (referralData && typeof referralData === 'object' && 'code' in referralData) {
      Clipboard.setString(String(referralData.code));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('referral.copied'));
    }
  };

  return (
    <PageContainer onRefresh={() => {}} variant="tool">
      <PageHeader
        title={t('referral.title')}
        description={t('referral.description')}
        icon="gift-outline"
        variant="tool"
      />
      {isLoading ? (
        <Loading />
      ) : (
        <View style={styles.content}>
          {/* Referral code card */}
          <View
            style={[styles.codeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.codeLabel, { color: colors.foregroundMuted }]}>
              {t('referral.yourCode')}
            </Text>
            <Text style={[styles.code, { color: colors.foreground }]}>
              {referralData && typeof referralData === 'object' && 'code' in referralData
                ? String(referralData.code)
                : '------'}
            </Text>
            <TouchableOpacity
              onPress={handleCopy}
              style={[styles.copyButton, { backgroundColor: withOpacity(colors.primary, 0.1) }]}
              accessibilityRole="button"
              accessibilityLabel={t('referral.copy')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="copy-outline" size={18} color={colors.primary} />
              <Text style={[styles.copyText, { color: colors.primary }]}>{t('referral.copy')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  codeCard: {
    alignItems: 'center',
    padding: spacing['2xl'],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  codeLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  code: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    letterSpacing: 4,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.lg,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  copyText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});

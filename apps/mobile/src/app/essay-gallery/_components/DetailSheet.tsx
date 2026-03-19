/**
 * Essay Gallery - Detail bottom sheet showing essay content and AI analysis.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Segment } from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { apiClient } from '@/lib/api/client';
import type { EssayDetail } from './types';
import { RESULT_COLORS, resultBadgeVariant } from './types';
import { AnalysisSection } from './AnalysisSection';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DetailSheetProps {
  essayId: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DetailSheet({ essayId, onClose }: DetailSheetProps) {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [detailTab, setDetailTab] = useState<'original' | 'analysis'>('original');

  const { data: essayDetail, isLoading: isDetailLoading } = useQuery<EssayDetail>({
    queryKey: ['essay-detail', essayId],
    queryFn: () => apiClient.get<EssayDetail>(`/essay-ai/gallery/${essayId}`),
    enabled: !!essayId,
  });

  const resultLabel = (result: string) => {
    const map: Record<string, string> = {
      ADMITTED: t('essayGallery.results.admitted'),
      REJECTED: t('essayGallery.results.rejected'),
      WAITLISTED: t('essayGallery.results.waitlisted'),
      DEFERRED: t('essayGallery.results.deferred'),
    };
    return map[result] || result;
  };

  // Original text tab
  const renderOriginalText = () => {
    if (!essayDetail?.content) {
      return (
        <View style={S.noContentContainer}>
          <Ionicons name="document-text-outline" size={48} color={c.foregroundMuted} />
          <Text style={[S.noContentText, { color: c.foregroundMuted }]}>
            {t('essayGallery.detail.noContent')}
          </Text>
        </View>
      );
    }

    const paragraphs = essayDetail.content.split('\n').filter((p) => p.trim().length > 0);

    return (
      <View style={S.originalTextContainer}>
        {paragraphs.map((paragraph, idx) => (
          <Text key={idx} style={[S.essayParagraph, { color: c.foreground }]}>
            {paragraph}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
      {/* Backdrop */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={[S.backdrop, { backgroundColor: c.overlay }]}
      />
      {/* Sheet */}
      <Animated.View
        entering={FadeInUp.duration(300).springify()}
        style={[
          S.detailSheet,
          {
            backgroundColor: c.card,
            height: SCREEN_HEIGHT * 0.9,
            paddingBottom: insets.bottom || spacing.lg,
          },
        ]}
      >
        {/* Handle */}
        <View style={S.sheetHandle}>
          <View style={[S.handleBar, { backgroundColor: c.border }]} />
        </View>

        {isDetailLoading || !essayDetail ? (
          <View style={S.detailLoadingContainer}>
            <ActivityIndicator size="large" color={c.primary} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.detailContent}>
            {/* Detail Header */}
            <View style={S.detailHeader}>
              <View style={S.detailHeaderTop}>
                <Text style={[S.detailSchoolName, { color: c.foreground }]} numberOfLines={2}>
                  {essayDetail.school?.name || t('essayGallery.unknownSchool')}
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={c.foregroundMuted} />
                </TouchableOpacity>
              </View>

              <View style={S.detailBadgeRow}>
                {essayDetail.school?.usNewsRank && (
                  <View style={[S.rankBadge, { backgroundColor: c.info + '20' }]}>
                    <Text style={[S.rankText, { color: c.info }]}>
                      #{essayDetail.school.usNewsRank}
                    </Text>
                  </View>
                )}
                <Badge variant={resultBadgeVariant(essayDetail.result)}>
                  {resultLabel(essayDetail.result)}
                </Badge>
                {essayDetail.isVerified && (
                  <View style={S.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={RESULT_COLORS.ADMITTED} />
                    <Text style={[S.verifiedText, { color: RESULT_COLORS.ADMITTED }]}>
                      {t('essayGallery.verified')}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Applicant stats */}
            <View style={[S.applicantStats, { backgroundColor: c.muted }]}>
              {essayDetail.gpaRange && (
                <View style={S.applicantStatItem}>
                  <Text style={[S.applicantStatLabel, { color: c.foregroundMuted }]}>GPA</Text>
                  <Text style={[S.applicantStatValue, { color: c.foreground }]}>
                    {essayDetail.gpaRange}
                  </Text>
                </View>
              )}
              {essayDetail.satRange && (
                <View style={S.applicantStatItem}>
                  <Text style={[S.applicantStatLabel, { color: c.foregroundMuted }]}>SAT</Text>
                  <Text style={[S.applicantStatValue, { color: c.foreground }]}>
                    {essayDetail.satRange}
                  </Text>
                </View>
              )}
              <View style={S.applicantStatItem}>
                <Text style={[S.applicantStatLabel, { color: c.foregroundMuted }]}>
                  {t('essayGallery.words')}
                </Text>
                <Text style={[S.applicantStatValue, { color: c.foreground }]}>
                  {essayDetail.wordCount}
                </Text>
              </View>
              {essayDetail.round && (
                <View style={S.applicantStatItem}>
                  <Text style={[S.applicantStatLabel, { color: c.foregroundMuted }]}>
                    {t('essayGallery.round')}
                  </Text>
                  <Text style={[S.applicantStatValue, { color: c.foreground }]}>
                    {essayDetail.round}
                  </Text>
                </View>
              )}
            </View>

            {/* Essay prompt */}
            {essayDetail.prompt && (
              <View style={[S.promptSection, { borderColor: c.border }]}>
                <Text style={[S.promptLabel, { color: c.foregroundMuted }]}>
                  {t('essayGallery.detail.essayPrompt')}
                </Text>
                <Text style={[S.promptText, { color: c.foreground }]}>{essayDetail.prompt}</Text>
              </View>
            )}

            {/* Tab Switch */}
            <Segment
              segments={[
                { key: 'original', label: t('essayGallery.detail.tabs.original') },
                { key: 'analysis', label: t('essayGallery.detail.tabs.aiReview') },
              ]}
              value={detailTab}
              onChange={(key) => setDetailTab(key as 'original' | 'analysis')}
              style={S.detailTabs}
            />

            {/* Tab Content */}
            {detailTab === 'original' ? (
              renderOriginalText()
            ) : (
              <AnalysisSection essayId={essayId} essayDetail={essayDetail} />
            )}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  // Backdrop & sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  detailSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  detailLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },

  // Detail header
  detailHeader: {
    marginBottom: spacing.lg,
  },
  detailHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  detailSchoolName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    flex: 1,
    marginRight: spacing.md,
  },
  detailBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  rankBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  rankText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  verifiedText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // Applicant stats
  applicantStats: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.lg,
  },
  applicantStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  applicantStatLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  applicantStatValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },

  // Prompt
  promptSection: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  promptLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  promptText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.6,
  },

  // Detail tabs
  detailTabs: {
    marginBottom: spacing.lg,
  },

  // Original text
  noContentContainer: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.md,
  },
  noContentText: {
    fontSize: fontSize.sm,
  },
  originalTextContainer: {
    gap: spacing.lg,
  },
  essayParagraph: {
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.75,
  },
});

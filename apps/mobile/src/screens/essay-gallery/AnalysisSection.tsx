/**
 * Essay Gallery - AI Analysis tab content (score ring, summary, structure, paragraph reviews).
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { CircularProgress, AnimatedButton } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import type { AnalysisResult, ParagraphAnalysis, EssayDetail, Colors } from './types';
import { RESULT_COLORS, STATUS_COLORS } from './types';

// ---------------------------------------------------------------------------
// StructureCheckItem
// ---------------------------------------------------------------------------

const StructureCheckItem = React.memo(function StructureCheckItem({
  label,
  checked,
  colors: c,
}: {
  label: string;
  checked: boolean;
  colors: Colors;
}) {
  return (
    <View style={S.structureCheckItem}>
      <Ionicons
        name={checked ? 'checkmark-circle' : 'close-circle'}
        size={20}
        color={checked ? RESULT_COLORS.ADMITTED : RESULT_COLORS.REJECTED}
      />
      <Text style={[S.structureCheckLabel, { color: c.foreground }]}>{label}</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// ParagraphReviewCard
// ---------------------------------------------------------------------------

const ParagraphReviewCard = React.memo(function ParagraphReviewCard({
  paragraph,
  expanded,
  onToggle,
  colors: c,
}: {
  paragraph: ParagraphAnalysis;
  expanded: boolean;
  onToggle: () => void;
  colors: Colors;
}) {
  const { t } = useTranslation();
  const statusColor = STATUS_COLORS[paragraph.status] || c.foregroundMuted;

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      excellent: t('essayGallery.quality.excellent'),
      good: t('essayGallery.quality.good'),
      needs_work: t('essayGallery.quality.needsWork'),
    };
    return map[status] || status;
  };

  return (
    <View style={[S.paragraphCard, { borderColor: c.border }]}>
      {/* Header - always visible, tappable */}
      <TouchableOpacity onPress={onToggle} style={S.paragraphCardHeader}>
        <View style={S.paragraphCardHeaderLeft}>
          <View style={[S.paragraphScoreBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[S.paragraphScoreText, { color: statusColor }]}>{paragraph.score}</Text>
          </View>
          <View style={[S.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <Text style={[S.statusBadgeText, { color: statusColor }]}>
              {statusLabel(paragraph.status)}
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={c.foregroundMuted}
        />
      </TouchableOpacity>

      {/* Comment */}
      <Text
        style={[S.paragraphComment, { color: c.foregroundSecondary }]}
        numberOfLines={expanded ? undefined : 2}
      >
        {paragraph.comment}
      </Text>

      {/* Expanded content */}
      {expanded && (
        <View style={S.paragraphExpandedContent}>
          {/* Paragraph excerpt */}
          <View style={[S.paragraphExcerpt, { backgroundColor: c.muted }]}>
            <Text
              style={[S.paragraphExcerptText, { color: c.foregroundSecondary }]}
              numberOfLines={4}
            >
              {paragraph.paragraphText}
            </Text>
          </View>

          {/* Highlights */}
          {paragraph.highlights.length > 0 && (
            <View style={S.highlightsSection}>
              <Text style={[S.highlightsTitle, { color: RESULT_COLORS.ADMITTED }]}>
                {t('essayGallery.detail.analysis.highlights')}
              </Text>
              {paragraph.highlights.map((h, i) => (
                <View key={i} style={S.bulletItem}>
                  <Ionicons name="star" size={12} color={RESULT_COLORS.ADMITTED} />
                  <Text style={[S.bulletText, { color: c.foreground }]}>{h}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Suggestions */}
          {paragraph.suggestions.length > 0 && (
            <View style={S.suggestionsSection}>
              <Text style={[S.suggestionsTitle, { color: RESULT_COLORS.WAITLISTED }]}>
                {t('essayGallery.detail.analysis.suggestions')}
              </Text>
              {paragraph.suggestions.map((s, i) => (
                <View key={i} style={S.bulletItem}>
                  <Ionicons name="bulb" size={12} color={RESULT_COLORS.WAITLISTED} />
                  <Text style={[S.bulletText, { color: c.foreground }]}>{s}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// AnalysisSection (main export)
// ---------------------------------------------------------------------------

interface AnalysisSectionProps {
  essayId: string;
  essayDetail: EssayDetail;
}

export function AnalysisSection({ essayId, essayDetail }: AnalysisSectionProps) {
  const { t } = useTranslation();
  const c = useColors();
  const toast = useToast();
  const [expandedParagraphs, setExpandedParagraphs] = useState<Set<number>>(new Set());

  const analysisMutation = useMutation<AnalysisResult, Error, void>({
    mutationFn: () =>
      apiClient.post<AnalysisResult>(`${API_ROUTES.ESSAY_AI}/gallery/${essayId}/analyze`, {
        schoolName: essayDetail.school?.name,
      }),
    onError: (error) => {
      toast.show({ type: 'error', message: error.message });
    },
  });

  const toggleParagraph = useCallback((index: number) => {
    setExpandedParagraphs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Not yet analyzed
  if (!analysisMutation.data && !analysisMutation.isPending) {
    return (
      <View style={S.analysisPrompt}>
        <Ionicons name="sparkles" size={48} color={c.primary} />
        <Text style={[S.analysisPromptTitle, { color: c.foreground }]}>
          {t('essayGallery.detail.ai.title')}
        </Text>
        <AnimatedButton onPress={() => analysisMutation.mutate()} style={S.analyzeButton}>
          {t('essayGallery.detail.ai.startAnalysis')}
        </AnimatedButton>
      </View>
    );
  }

  // Loading
  if (analysisMutation.isPending) {
    return (
      <View style={S.analysisPrompt}>
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={[S.analyzingText, { color: c.foregroundMuted }]}>
          {t('essayGallery.detail.ai.analyzing')}
        </Text>
      </View>
    );
  }

  const analysis = analysisMutation.data;
  if (!analysis) return null;

  return (
    <View style={S.analysisContainer}>
      {/* Overall Score Ring */}
      <View style={S.overallScoreSection}>
        <CircularProgress
          value={analysis.overallScore}
          size={100}
          strokeWidth={10}
          color={
            analysis.overallScore >= 80
              ? RESULT_COLORS.ADMITTED
              : analysis.overallScore >= 60
                ? RESULT_COLORS.DEFERRED
                : RESULT_COLORS.WAITLISTED
          }
          label={t('essayGallery.detail.analysis.score')}
        />
      </View>

      {/* Summary */}
      <View style={[S.analysisSummary, { backgroundColor: c.muted }]}>
        <Text style={[S.analysisSummaryLabel, { color: c.foregroundMuted }]}>
          {t('essayGallery.detail.analysis.overallComment')}
        </Text>
        <Text style={[S.analysisSummaryText, { color: c.foreground }]}>{analysis.summary}</Text>
      </View>

      {/* Structure Checklist */}
      <View style={S.structureSection}>
        <Text style={[S.sectionTitle, { color: c.foreground }]}>
          {t('essayGallery.detail.analysis.structureAnalysis')}
        </Text>
        <View style={[S.structureCard, { backgroundColor: c.muted }]}>
          <StructureCheckItem
            label={t('essayGallery.detail.analysis.hookStrength')}
            checked={analysis.structure.hasStrongOpening}
            colors={c}
          />
          <StructureCheckItem
            label={t('essayGallery.detail.analysis.themeClarity')}
            checked={analysis.structure.hasClarity}
            colors={c}
          />
          <StructureCheckItem
            label={t('essayGallery.detail.analysis.endingImpact')}
            checked={analysis.structure.hasGoodConclusion}
            colors={c}
          />
        </View>
        {analysis.structure.feedback && (
          <Text style={[S.structureFeedback, { color: c.foregroundSecondary }]}>
            {analysis.structure.feedback}
          </Text>
        )}
      </View>

      {/* Paragraph-by-paragraph review */}
      <View style={S.paragraphReviewSection}>
        <Text style={[S.sectionTitle, { color: c.foreground }]}>
          {t('essayGallery.detail.analysis.paragraphReview')}
        </Text>
        {analysis.paragraphs.map((para) => (
          <ParagraphReviewCard
            key={para.paragraphIndex}
            paragraph={para}
            expanded={expandedParagraphs.has(para.paragraphIndex)}
            onToggle={() => toggleParagraph(para.paragraphIndex)}
            colors={c}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  // AI Analysis prompt
  analysisPrompt: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.lg,
  },
  analysisPromptTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  analyzeButton: {
    minWidth: 200,
  },
  analyzingText: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  analysisContainer: {
    gap: spacing.lg,
  },

  // Overall score
  overallScoreSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },

  // Summary
  analysisSummary: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  analysisSummaryLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  analysisSummaryText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.6,
  },

  // Structure
  structureSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  structureCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  structureCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  structureCheckLabel: {
    fontSize: fontSize.sm,
  },
  structureFeedback: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    paddingHorizontal: spacing.xs,
  },

  // Paragraph review
  paragraphReviewSection: {
    gap: spacing.md,
  },
  paragraphCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  paragraphCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  paragraphCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paragraphScoreBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paragraphScoreText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  paragraphComment: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  paragraphExpandedContent: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  paragraphExcerpt: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  paragraphExcerptText: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.6,
    fontStyle: 'italic',
  },
  highlightsSection: {
    gap: spacing.xs,
  },
  highlightsTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  suggestionsSection: {
    gap: spacing.xs,
  },
  suggestionsTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  bulletText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    flex: 1,
  },
});

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedCard, CardContent, Avatar } from '@/components/ui';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { Review, Colors } from './types';
import { averageScore, getScoreColor } from './types';

interface ReviewItemProps {
  item: Review;
  colors: Colors;
  onReact: (reviewId: string, type: 'helpful' | 'insightful') => void;
}

export const ReviewItem = memo(function ReviewItem({ item, colors: c, onReact }: ReviewItemProps) {
  const { t } = useTranslation();
  const avg = averageScore(item);
  const avgColor = getScoreColor(avg);

  const scoreLabel = (key: string): string => {
    const map: Record<string, string> = {
      academic: t('hallOfFame.reviews.scores.academic', 'Academic'),
      test: t('hallOfFame.reviews.scores.test', 'Test'),
      activity: t('hallOfFame.reviews.scores.activity', 'Activity'),
      award: t('hallOfFame.reviews.scores.award', 'Award'),
      overall: t('hallOfFame.reviews.scores.overall', 'Overall'),
    };
    return map[key] || key;
  };

  const renderScoreBar = (label: string, value: number, color: string) => (
    <View style={S.scoreBarRow}>
      <Text style={[S.scoreBarLabel, { color: c.foregroundMuted }]}>{label}</Text>
      <View style={[S.scoreBarTrack, { backgroundColor: c.muted }]}>
        <View
          style={[S.scoreBarFill, { width: `${(value / 10) * 100}%`, backgroundColor: color }]}
        />
      </View>
      <Text style={[S.scoreBarValue, { color: c.foreground }]}>{value}</Text>
    </View>
  );

  return (
    <AnimatedCard style={S.reviewCard}>
      <CardContent>
        <View style={S.reviewHeader}>
          <View style={S.reviewerRow}>
            <Avatar source={item.reviewer.avatarUrl} name={item.reviewer.nickname} size="sm" />
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <Text style={[S.reviewerName, { color: c.foreground }]}>
                {item.reviewer.nickname}
              </Text>
              <Text style={[S.reviewDate, { color: c.foregroundMuted }]}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
          <View style={[S.avgBadge, { backgroundColor: avgColor + '18' }]}>
            <Text style={[S.avgBadgeText, { color: avgColor }]}>{avg}</Text>
          </View>
        </View>

        <View style={S.reviewForRow}>
          <Ionicons name="person-outline" size={14} color={c.foregroundMuted} />
          <Text style={[S.reviewForText, { color: c.foregroundMuted }]}>
            {t('hallOfFame.reviews.reviewFor', 'Review for')}{' '}
            <Text style={{ color: c.primary, fontWeight: fontWeight.semibold }}>
              {item.profileUser.nickname}
            </Text>
          </Text>
        </View>

        <View style={S.scoreBarsContainer}>
          {renderScoreBar(
            scoreLabel('academic'),
            item.academicScore,
            getScoreColor(item.academicScore)
          )}
          {renderScoreBar(scoreLabel('test'), item.testScore, getScoreColor(item.testScore))}
          {renderScoreBar(
            scoreLabel('activity'),
            item.activityScore,
            getScoreColor(item.activityScore)
          )}
          {renderScoreBar(scoreLabel('award'), item.awardScore, getScoreColor(item.awardScore))}
          {renderScoreBar(
            scoreLabel('overall'),
            item.overallScore,
            getScoreColor(item.overallScore)
          )}
        </View>

        {item.comment ? (
          <Text style={[S.reviewComment, { color: c.foregroundSecondary }]} numberOfLines={4}>
            {item.comment}
          </Text>
        ) : null}

        {item.tags && item.tags.length > 0 && (
          <View style={S.tagsRow}>
            {item.tags.map((tag) => (
              <View key={tag} style={[S.tagChip, { backgroundColor: c.muted }]}>
                <Text style={[S.tagChipText, { color: c.foregroundMuted }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={S.reactionsRow}>
          <TouchableOpacity
            onPress={() => onReact(item.id, 'helpful')}
            style={[
              S.reactionBtn,
              { backgroundColor: item.myReaction === 'helpful' ? c.primary + '15' : c.muted },
            ]}
          >
            <Ionicons
              name="thumbs-up-outline"
              size={14}
              color={item.myReaction === 'helpful' ? c.primary : c.foregroundMuted}
            />
            <Text
              style={[
                S.reactionText,
                { color: item.myReaction === 'helpful' ? c.primary : c.foregroundMuted },
              ]}
            >
              {t('hallOfFame.reviews.helpful', 'Helpful')}{' '}
              {item.helpfulCount > 0 ? item.helpfulCount : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onReact(item.id, 'insightful')}
            style={[
              S.reactionBtn,
              { backgroundColor: item.myReaction === 'insightful' ? c.info + '15' : c.muted },
            ]}
          >
            <Ionicons
              name="bulb-outline"
              size={14}
              color={item.myReaction === 'insightful' ? c.info : c.foregroundMuted}
            />
            <Text
              style={[
                S.reactionText,
                { color: item.myReaction === 'insightful' ? c.info : c.foregroundMuted },
              ]}
            >
              {t('hallOfFame.reviews.insightful', 'Insightful')}{' '}
              {item.insightfulCount > 0 ? item.insightfulCount : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </CardContent>
    </AnimatedCard>
  );
});

const S = StyleSheet.create({
  reviewCard: {
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  reviewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  reviewDate: {
    fontSize: fontSize.xs,
  },
  avgBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avgBadgeText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  reviewForRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  reviewForText: {
    fontSize: fontSize.xs,
  },
  scoreBarsContainer: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  scoreBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreBarLabel: {
    width: 60,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  scoreBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreBarValue: {
    width: 24,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textAlign: 'right',
  },
  reviewComment: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    marginBottom: spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  tagChipText: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  reactionText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});

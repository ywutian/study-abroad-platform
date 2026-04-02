/**
 * LeaderboardItem — Memoized row for the leaderboard list.
 * Shows rank, user info, badge icon, and accuracy.
 */
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

import { LeaderboardEntryDto, BADGE_COLORS, BADGE_ICONS, normalizeBadge } from './types';

interface LeaderboardItemProps {
  entry: LeaderboardEntryDto;
}

const LeaderboardItem = memo(function LeaderboardItem({ entry }: LeaderboardItemProps) {
  const { t } = useTranslation();
  const c = useColors();

  const badge = normalizeBadge(entry.badge);
  const entryBadgeColor = BADGE_COLORS[badge] || BADGE_COLORS.bronze;
  const entryBadgeIcon = BADGE_ICONS[badge] || BADGE_ICONS.bronze;
  const isMe = entry.isCurrentUser;

  return (
    <View
      style={[
        styles.leaderboardEntry,
        {
          backgroundColor: isMe ? c.primary + '08' : c.card,
          borderColor: isMe ? c.primary + '30' : c.border,
        },
      ]}
    >
      {/* Rank */}
      <View style={styles.rankCol}>
        {entry.rank <= 3 ? (
          <View
            style={[
              styles.topRankBadge,
              {
                backgroundColor:
                  entry.rank === 1
                    ? '#FFD700' + '20'
                    : entry.rank === 2
                      ? '#C0C0C0' + '20'
                      : '#CD7F32' + '20',
              },
            ]}
          >
            <Ionicons
              name="trophy"
              size={16}
              color={entry.rank === 1 ? '#FFD700' : entry.rank === 2 ? '#C0C0C0' : '#CD7F32'}
            />
          </View>
        ) : (
          <Text style={[styles.rankNumber, { color: c.foregroundMuted }]}>{entry.rank}</Text>
        )}
      </View>

      {/* User info */}
      <View style={styles.userCol}>
        <View style={styles.userNameRow}>
          <Text
            style={[
              styles.userName,
              { color: isMe ? c.primary : c.foreground },
              isMe && { fontWeight: fontWeight.bold },
            ]}
            numberOfLines={1}
          >
            {entry.userName || t('swipe.anonymous')}
          </Text>
          {isMe && (
            <Badge variant="default" style={{ marginLeft: spacing.xs }}>
              {t('swipe.you')}
            </Badge>
          )}
        </View>
        <Text style={[styles.userSwipes, { color: c.foregroundMuted }]}>
          {t('swipe.swipesCount', { count: entry.totalSwipes })}
        </Text>
      </View>

      {/* Badge + accuracy */}
      <View style={styles.entryRight}>
        <Ionicons name={entryBadgeIcon} size={18} color={entryBadgeColor} />
        <Text style={[styles.entryAccuracy, { color: c.foreground }]}>
          {Math.round(entry.accuracy)}%
        </Text>
      </View>
    </View>
  );
});

export default LeaderboardItem;

const styles = StyleSheet.create({
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  rankCol: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  userCol: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    flexShrink: 1,
  },
  userSwipes: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  entryRight: {
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.md,
  },
  entryAccuracy: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
});

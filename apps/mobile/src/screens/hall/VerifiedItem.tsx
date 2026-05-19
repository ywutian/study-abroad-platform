import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedCard, CardContent, Badge, Avatar } from '@/components/ui';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { VerifiedUserDto, Colors } from './types';
import { RESULT_BADGE_VARIANT } from './types';

interface VerifiedItemProps {
  item: VerifiedUserDto;
  colors: Colors;
}

// 2026-05 Hall Plan C (C4): this card used to render a gold/silver/bronze
// trophy "rank" badge, framing verified admission records as a leaderboard
// where the rank-1 student "beat" everyone else. Admissions is not a contest
// between applicants — the rank badge is dropped; this is now a neutral
// verified-record card.
export const VerifiedItem = memo(function VerifiedItem({ item, colors: c }: VerifiedItemProps) {
  const resultVariant = RESULT_BADGE_VARIANT[item.result] || ('secondary' as const);

  return (
    <AnimatedCard style={S.verifiedCard}>
      <CardContent>
        <View style={S.verifiedRow}>
          <Avatar source={item.avatarUrl} name={item.nickname} size="default" />
          <View style={S.verifiedInfo}>
            <View style={S.verifiedNameRow}>
              <Text style={[S.verifiedName, { color: c.foreground }]} numberOfLines={1}>
                {item.nickname}
              </Text>
              <Ionicons name="checkmark-circle" size={16} color={c.success} />
            </View>
            <Text style={[S.verifiedSchool, { color: c.foregroundMuted }]} numberOfLines={1}>
              {item.schoolNameZh || item.school}
              {item.major ? ` - ${item.major}` : ''}
            </Text>
            <View style={S.verifiedBadges}>
              <Badge variant={resultVariant}>{item.result}</Badge>
              {item.gpa != null && (
                <View style={[S.gpaBadge, { backgroundColor: c.info + '15' }]}>
                  <Text style={[S.gpaBadgeText, { color: c.info }]}>GPA {item.gpa}</Text>
                </View>
              )}
              {item.sat != null && (
                <View style={[S.gpaBadge, { backgroundColor: c.warning + '15' }]}>
                  <Text style={[S.gpaBadgeText, { color: c.warning }]}>SAT {item.sat}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </CardContent>
    </AnimatedCard>
  );
});

const S = StyleSheet.create({
  verifiedCard: {
    marginBottom: spacing.sm,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  verifiedInfo: {
    flex: 1,
  },
  verifiedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  verifiedName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  verifiedSchool: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  verifiedBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  gpaBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  gpaBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
});

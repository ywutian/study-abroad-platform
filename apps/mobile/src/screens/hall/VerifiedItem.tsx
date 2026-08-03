import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedCard, CardContent, Badge } from '@/components/ui';
import {
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  fontFamily,
  withOpacity,
} from '@/utils/theme';
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
          {/* No avatar. This row is an ANONYMOUS / VERIFIED_ONLY case, and an
              avatar URL joins to the real name on the public forum feed exactly
              as a userId does — the endpoint does not send one, and this card
              must not ask for one. */}
          <View style={S.verifiedInfo}>
            <View style={S.verifiedNameRow}>
              <Text style={[S.verifiedName, { color: c.foreground }]} numberOfLines={1}>
                {item.userName}
              </Text>
              <Ionicons name="checkmark-circle" size={16} color={c.success} />
            </View>
            <Text style={[S.verifiedSchool, { color: c.foregroundMuted }]} numberOfLines={1}>
              {item.schoolNameZh || item.schoolName}
              {item.major ? ` - ${item.major}` : ''}
            </Text>
            <View style={S.verifiedBadges}>
              <Badge variant={resultVariant}>{item.result}</Badge>
              {item.gpaRange && (
                <View style={[S.gpaBadge, { backgroundColor: withOpacity(c.info, 0.08) }]}>
                  <Text style={[S.gpaBadgeText, { color: c.info }]}>GPA {item.gpaRange}</Text>
                </View>
              )}
              {item.satRange && (
                <View style={[S.gpaBadge, { backgroundColor: withOpacity(c.warning, 0.08) }]}>
                  <Text style={[S.gpaBadgeText, { color: c.warning }]}>SAT {item.satRange}</Text>
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
    fontFamily: fontFamily.mono,
  },
});

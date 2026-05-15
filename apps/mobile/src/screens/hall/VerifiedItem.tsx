import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedCard, CardContent, Badge, Avatar } from '@/components/ui';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { VerifiedUserDto, Colors } from './types';
import { RESULT_BADGE_VARIANT } from './types';

interface VerifiedItemProps {
  item: VerifiedUserDto;
  colors: Colors;
}

export const VerifiedItem = memo(function VerifiedItem({ item, colors: c }: VerifiedItemProps) {
  const { t } = useTranslation();
  const isTop3 = item.rank <= 3;
  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const medalColor = isTop3 ? medalColors[item.rank - 1] : undefined;
  const resultVariant = RESULT_BADGE_VARIANT[item.result] || ('secondary' as const);

  return (
    <AnimatedCard style={S.verifiedCard}>
      <CardContent>
        <View style={S.verifiedRow}>
          <View style={[S.verifiedRank, isTop3 && { backgroundColor: medalColor + '20' }]}>
            {isTop3 ? (
              <Ionicons name="trophy" size={18} color={medalColor} />
            ) : (
              <Text style={[S.verifiedRankText, { color: c.foregroundMuted }]}>{item.rank}</Text>
            )}
          </View>

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

          <View style={S.pointsBox}>
            <Text style={[S.pointsValue, { color: c.primary }]}>{item.pointsTotal}</Text>
            <Text style={[S.pointsLabel, { color: c.foregroundMuted }]}>
              {t('hallOfFame.verified.points')}
            </Text>
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
  verifiedRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedRankText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
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
  pointsBox: {
    alignItems: 'center',
    minWidth: 44,
  },
  pointsValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  pointsLabel: {
    fontSize: 10,
  },
});

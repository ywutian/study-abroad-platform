import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { TimelineResponse } from '@study-abroad/shared';
import { AnimatedCard, CardContent, Progress } from '@/components/ui';
import { fontFamily, useColors } from '@/utils/theme';
import { getDaysLeft } from '@/app/timeline.constants';
import { styles } from '@/app/timeline.styles';

export function TimelineOverviewHeader({
  timelines,
  sorted,
}: {
  timelines: TimelineResponse[];
  sorted: TimelineResponse[];
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const total = timelines.length;
  const submitted = timelines.filter((item) => item.status === 'SUBMITTED').length;
  const inProgress = timelines.filter((item) => item.status === 'IN_PROGRESS').length;
  const upcoming = sorted.filter((item) => {
    const days = getDaysLeft(item.deadline);
    return days !== null && days >= 0 && days <= 14;
  }).length;
  return (
    <Animated.View entering={FadeInDown.duration(400).springify()}>
      <AnimatedCard>
        <CardContent>
          <View style={styles.headerStatsRow}>
            {[
              {
                value: total,
                label: t('timeline.overview.totalSchools'),
                color: colors.foreground,
              },
              { value: submitted, label: t('timeline.overview.submitted'), color: colors.primary },
              { value: inProgress, label: t('timeline.overview.inProgress'), color: colors.info },
              { value: upcoming, label: t('timeline.overview.upcoming'), color: colors.warning },
            ].map((item) => (
              <View key={item.label} style={styles.headerStat}>
                <Text
                  style={[styles.headerStatVal, { color: item.color, fontFamily: fontFamily.mono }]}
                >
                  {item.value}
                </Text>
                <Text style={[styles.headerStatLbl, { color: colors.foregroundMuted }]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
          <Progress
            value={total > 0 ? Math.round((submitted / total) * 100) : 0}
            max={100}
            height={6}
            color={colors.primary}
            trackColor={colors.muted}
            style={styles.headerProgress}
          />
        </CardContent>
      </AnimatedCard>
    </Animated.View>
  );
}

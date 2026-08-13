import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, useColors, withOpacity } from '@/utils/theme';
import { styles } from '@/app/uncommon-app.styles';

export function MetricTile({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.metricTile, { backgroundColor: colors.backgroundSecondary }]}>
      <View style={[styles.metricIcon, { backgroundColor: withOpacity(color, 0.094) }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.metricValue, { color: colors.foreground, fontFamily: fontFamily.mono }]}>
        {value}
      </Text>
      <Text style={[styles.metricLabel, { color: colors.foregroundMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

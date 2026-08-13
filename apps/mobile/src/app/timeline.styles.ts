import { StyleSheet } from 'react-native';
import { fontSize, fontWeight, spacing } from '@/utils/theme';

export const styles = StyleSheet.create({
  headerStatsRow: { flexDirection: 'row' },
  headerStat: { alignItems: 'center', flex: 1 },
  headerStatVal: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  headerStatLbl: { fontSize: fontSize.xs, marginTop: 2 },
  headerProgress: { marginTop: spacing.md },
});

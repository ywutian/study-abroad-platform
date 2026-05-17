/**
 * ChinaAdmitChart — self-drawn SVG bar chart (Hall refactor Stage 4 M5).
 *
 * recharts does not run on React Native, so the per-school year-over-year
 * mainland-China admit trend is drawn directly with `react-native-svg`.
 * Each bar is one application year; the bar label shows the admitted count.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { useColors, fontSize, fontWeight } from '@/utils/theme';

interface ChinaAdmitChartProps {
  /** Per-year admitted counts, ascending by year. */
  yearly: Array<{ year: number; admitted: number; total: number }>;
  /** Bar fill color (school difficulty-signal accent). */
  color: string;
  height?: number;
}

const BAR_GAP = 8;
const LABEL_BAND = 16; // px reserved at top for the count label
const AXIS_BAND = 14; // px reserved at bottom for the year label

export function ChinaAdmitChart({ yearly, color, height = 88 }: ChinaAdmitChartProps) {
  const c = useColors();

  if (yearly.length === 0) {
    return null;
  }

  const maxAdmit = Math.max(1, ...yearly.map((y) => y.admitted));
  const plotHeight = height - LABEL_BAND - AXIS_BAND;

  return (
    <View
      style={S.wrap}
      accessibilityRole="image"
      accessibilityLabel={yearly.map((y) => `${y.year}: ${y.admitted}`).join(', ')}
    >
      <Svg width="100%" height={height}>
        {yearly.map((y, i) => {
          const slot = 100 / yearly.length;
          const barWidthPct = slot - BAR_GAP / 3;
          const xPct = i * slot + (slot - barWidthPct) / 2;
          const barH = Math.max(3, (y.admitted / maxAdmit) * plotHeight);
          const barY = LABEL_BAND + (plotHeight - barH);
          return (
            <React.Fragment key={y.year}>
              {/* count label */}
              <SvgText
                x={`${xPct + barWidthPct / 2}%`}
                y={barY - 4}
                fontSize={11}
                fontWeight="600"
                fill={c.foreground}
                textAnchor="middle"
              >
                {String(y.admitted)}
              </SvgText>
              {/* bar */}
              <Rect
                x={`${xPct}%`}
                y={barY}
                width={`${barWidthPct}%`}
                height={barH}
                rx={3}
                fill={color}
                opacity={0.85}
              />
              {/* year axis label */}
              <SvgText
                x={`${xPct + barWidthPct / 2}%`}
                y={height - 2}
                fontSize={10}
                fill={c.foregroundMuted}
                textAnchor="middle"
              >
                {`'${String(y.year).slice(2)}`}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

/**
 * NoDataPlaceholder — shown for D-reliability schools where the platform
 * deliberately hides the (statistically meaningless) admit count.
 */
export function ChinaAdmitNoData({ label }: { label: string }) {
  const c = useColors();
  return (
    <View style={[S.noData, { backgroundColor: c.muted }]}>
      <Text style={[S.noDataText, { color: c.foregroundMuted }]}>{label}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  noData: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});

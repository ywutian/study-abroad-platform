import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SectionRendererProps } from '../types';
import { SectionTitle } from '../primitives/section-title';
import type { TestScoreItem } from '@study-abroad/shared';

export function TestScoresSection({ section, theme }: SectionRendererProps) {
  const items = ((section.content as any).items ?? []) as TestScoreItem[];
  if (!items.length) return null;

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <SectionTitle title={section.title} theme={theme} />
      <View style={styles.inline}>
        {items.map((item, i) => {
          const subScoreStr = item.subScores
            ? ` (${Object.entries(item.subScores)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')})`
            : '';
          return (
            <Text key={item.id ?? i} style={styles.score}>
              {i > 0 && '  |  '}
              <Text style={styles.type}>{item.type}: </Text>
              {item.score}
              {subScoreStr}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: { marginBottom: theme.spacing.sectionGap },
    inline: { flexDirection: 'row', flexWrap: 'wrap' },
    score: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
    },
    type: { fontWeight: 700 },
  });
}

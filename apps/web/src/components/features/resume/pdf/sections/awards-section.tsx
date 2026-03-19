import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SectionRendererProps } from '../types';
import { SectionTitle } from '../primitives/section-title';
import type { AwardItem } from '@study-abroad/shared';
import type { ResumeTheme } from '../types';

export function AwardsSection({ section, theme }: SectionRendererProps) {
  const items = ((section.content as Record<string, unknown>).items ?? []) as AwardItem[];
  if (!items.length) return null;

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <SectionTitle title={section.title} theme={theme} />
      {items.map((item, i) => (
        <View key={item.id ?? i} style={styles.item} wrap={false}>
          <View style={styles.row}>
            <View style={styles.left}>
              <Text style={styles.name}>
                {item.name}
                {item.level && <Text style={styles.level}> ({item.level})</Text>}
              </Text>
              {item.description && <Text style={styles.desc}>{item.description}</Text>}
            </View>
            {item.year && <Text style={styles.year}>{item.year}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

function getStyles(theme: ResumeTheme) {
  return StyleSheet.create({
    container: { marginBottom: theme.spacing.sectionGap },
    item: { marginBottom: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    left: { flex: 1 },
    name: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      fontWeight: 700,
      color: theme.text,
    },
    level: { fontWeight: 400 },
    desc: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.textLight,
      marginTop: 1,
    },
    year: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.textLight,
    },
  });
}

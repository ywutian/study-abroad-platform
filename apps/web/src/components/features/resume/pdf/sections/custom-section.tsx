import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SectionRendererProps } from '../types';
import { SectionTitle } from '../primitives/section-title';
import { BulletList } from '../primitives/bullet-list';

interface CustomItem {
  id: string;
  title?: string;
  subtitle?: string;
  dateRange?: string;
  bullets: string[];
}

export function CustomSection({ section, theme }: SectionRendererProps) {
  const items = ((section.content as any).items ?? []) as CustomItem[];
  if (!items.length) return null;

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <SectionTitle title={section.title} theme={theme} />
      {items.map((item, i) => (
        <View key={item.id ?? i} style={styles.item} wrap={false}>
          <View style={styles.row}>
            <View style={styles.left}>
              {item.title && <Text style={styles.title}>{item.title}</Text>}
              {item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
            </View>
            {item.dateRange && <Text style={styles.date}>{item.dateRange}</Text>}
          </View>
          <BulletList items={item.bullets} theme={theme} />
        </View>
      ))}
    </View>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: { marginBottom: theme.spacing.sectionGap },
    item: { marginBottom: theme.spacing.itemGap },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
    left: { flex: 1 },
    title: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      fontWeight: 700,
      color: theme.text,
    },
    subtitle: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
      fontStyle: 'italic',
    },
    date: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.textLight,
    },
  });
}

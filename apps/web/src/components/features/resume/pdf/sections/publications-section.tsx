import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SectionRendererProps } from '../types';
import { SectionTitle } from '../primitives/section-title';
import type { PublicationItem } from '@study-abroad/shared';

export function PublicationsSection({ section, theme }: SectionRendererProps) {
  const items = ((section.content as any).items ?? []) as PublicationItem[];
  if (!items.length) return null;

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <SectionTitle title={section.title} theme={theme} />
      {items.map((item, i) => (
        <View key={item.id ?? i} style={styles.item} wrap={false}>
          <Text style={styles.title}>{`"${item.title}"`}</Text>
          {item.authors && <Text style={styles.authors}>{item.authors}</Text>}
          <Text style={styles.venue}>
            {[item.venue, item.date, item.status && `(${item.status})`].filter(Boolean).join(', ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: { marginBottom: theme.spacing.sectionGap },
    item: { marginBottom: theme.spacing.itemGap },
    title: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      fontWeight: 700,
      color: theme.text,
    },
    authors: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
    },
    venue: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.textLight,
      fontStyle: 'italic',
    },
  });
}

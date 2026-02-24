import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SectionRendererProps } from '../types';
import { SectionTitle } from '../primitives/section-title';
import type { CertificationItem } from '@study-abroad/shared';

export function CertificationsSection({ section, theme }: SectionRendererProps) {
  const items = ((section.content as any).items ?? []) as CertificationItem[];
  if (!items.length) return null;

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <SectionTitle title={section.title} theme={theme} />
      {items.map((item, i) => (
        <View key={item.id ?? i} style={styles.item} wrap={false}>
          <View style={styles.row}>
            <Text style={styles.name}>
              {item.name}
              <Text style={styles.issuer}> — {item.issuer}</Text>
            </Text>
            {item.date && <Text style={styles.date}>{item.date}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: { marginBottom: theme.spacing.sectionGap },
    item: { marginBottom: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    name: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      fontWeight: 700,
      color: theme.text,
      flex: 1,
    },
    issuer: { fontWeight: 400 },
    date: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.textLight,
    },
  });
}

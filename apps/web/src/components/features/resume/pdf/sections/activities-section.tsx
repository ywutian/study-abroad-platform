import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SectionRendererProps } from '../types';
import { SectionTitle } from '../primitives/section-title';
import { BulletList } from '../primitives/bullet-list';
import { DateRange } from '../primitives/date-range';
import type { ActivityItem } from '@study-abroad/shared';
import type { ResumeTheme } from '../types';

export function ActivitiesSection({ section, theme }: SectionRendererProps) {
  const items = ((section.content as Record<string, unknown>).items ?? []) as ActivityItem[];
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
                {item.role && <Text style={styles.role}>, {item.role}</Text>}
              </Text>
              {item.organization && <Text style={styles.org}>{item.organization}</Text>}
            </View>
            <View style={styles.right}>
              <DateRange
                start={item.startDate}
                end={item.endDate}
                isCurrent={item.isOngoing}
                theme={theme}
              />
            </View>
          </View>
          <BulletList items={item.bullets} theme={theme} />
        </View>
      ))}
    </View>
  );
}

function getStyles(theme: ResumeTheme) {
  return StyleSheet.create({
    container: { marginBottom: theme.spacing.sectionGap },
    item: { marginBottom: theme.spacing.itemGap },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
    left: { flex: 1 },
    right: { alignItems: 'flex-end' },
    name: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      fontWeight: 700,
      color: theme.text,
    },
    role: { fontWeight: 400, fontStyle: 'italic' },
    org: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
      fontStyle: 'italic',
    },
  });
}

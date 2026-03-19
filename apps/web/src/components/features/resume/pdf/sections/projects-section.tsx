import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SectionRendererProps } from '../types';
import { SectionTitle } from '../primitives/section-title';
import { BulletList } from '../primitives/bullet-list';
import { DateRange } from '../primitives/date-range';
import type { ProjectItem } from '@study-abroad/shared';
import type { ResumeTheme } from '../types';

export function ProjectsSection({ section, theme }: SectionRendererProps) {
  const items = ((section.content as Record<string, unknown>).items ?? []) as ProjectItem[];
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
                {item.techStack && item.techStack.length > 0 && (
                  <Text style={styles.tech}> | {item.techStack.join(', ')}</Text>
                )}
              </Text>
            </View>
            <View style={styles.right}>
              <DateRange start={item.startDate} end={item.endDate} theme={theme} />
            </View>
          </View>
          {item.url && <Text style={styles.url}>{item.url}</Text>}
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
    tech: {
      fontWeight: 400,
      fontStyle: 'italic',
    },
    url: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.primary,
      marginBottom: 1,
    },
  });
}

import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SectionRendererProps } from '../types';
import { SectionTitle } from '../primitives/section-title';
import { BulletList } from '../primitives/bullet-list';
import { DateRange } from '../primitives/date-range';
import type { ExperienceItem } from '@study-abroad/shared';
import type { ResumeTheme } from '../types';

/**
 * Shared section renderer for WORK_EXPERIENCE, RESEARCH, and TEACHING.
 */
export function ExperienceSection({ section, theme }: SectionRendererProps) {
  const items = ((section.content as Record<string, unknown>).items ?? []) as ExperienceItem[];
  if (!items.length) return null;

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <SectionTitle title={section.title} theme={theme} />
      {items.map((item, i) => (
        <View key={item.id ?? i} style={styles.item} wrap={false}>
          <View style={styles.row}>
            <View style={styles.left}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.org}>
                {item.company ?? item.institution ?? ''}
                {item.location ? `, ${item.location}` : ''}
              </Text>
            </View>
            <View style={styles.right}>
              <DateRange
                start={item.startDate}
                end={item.endDate}
                isCurrent={item.isCurrent}
                theme={theme}
              />
            </View>
          </View>
          {item.advisor && <Text style={styles.advisor}>Advisor: {item.advisor}</Text>}
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
    title: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      fontWeight: 700,
      color: theme.text,
    },
    org: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
      fontStyle: 'italic',
    },
    advisor: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.textLight,
      fontStyle: 'italic',
      marginTop: 1,
    },
  });
}

import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SectionRendererProps } from '../types';
import { SectionTitle } from '../primitives/section-title';
import type { ResumeTheme } from '../types';
import { DateRange } from '../primitives/date-range';
import type { EducationItem } from '@study-abroad/shared';

export function EducationSection({ section, theme }: SectionRendererProps) {
  const items = ((section.content as Record<string, unknown>).items ?? []) as EducationItem[];
  if (!items.length) return null;

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <SectionTitle title={section.title} theme={theme} />
      {items.map((item, i) => (
        <View key={item.id ?? i} style={styles.item} wrap={false}>
          <View style={styles.row}>
            <View style={styles.left}>
              <Text style={styles.school}>{item.schoolName}</Text>
              {(item.degree || item.major) && (
                <Text style={styles.detail}>
                  {[item.degree, item.major].filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
            <View style={styles.right}>
              <DateRange start={item.startDate} end={item.endDate} theme={theme} />
              {item.location && <Text style={styles.location}>{item.location}</Text>}
            </View>
          </View>
          {/* GPA */}
          {item.gpa && (
            <Text style={styles.gpa}>
              GPA: {item.gpa}
              {item.gpaScale ? `/${item.gpaScale}` : ''}
            </Text>
          )}
          {/* Coursework */}
          {item.coursework && item.coursework.length > 0 && (
            <Text style={styles.coursework}>
              <Text style={styles.bold}>Relevant Coursework: </Text>
              {item.coursework.join(', ')}
            </Text>
          )}
          {/* Honors */}
          {item.honors && item.honors.length > 0 && (
            <Text style={styles.coursework}>
              <Text style={styles.bold}>Honors: </Text>
              {item.honors.join(', ')}
            </Text>
          )}
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
    school: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      fontWeight: 700,
      color: theme.text,
    },
    detail: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
      fontStyle: 'italic',
    },
    location: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.textLight,
    },
    gpa: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
      marginTop: 1,
    },
    coursework: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.text,
      marginTop: 1,
    },
    bold: { fontWeight: 700 },
  });
}

import React from 'react';
import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import type { LayoutProps, SectionConfig, ResumeTheme } from '../types';
import { RenderSection } from '../sections';
import { HeaderSection } from '../sections/header-section';

/**
 * Timeline Layout — Single column with vertical timeline decoration.
 * Creative/narrative style with left border + dots at each section.
 */
export function TimelineLayout({ theme, sections }: LayoutProps) {
  const headerSection = sections.find((s) => s.type === 'HEADER' && s.isVisible);
  const bodySections = sections.filter((s) => s.type !== 'HEADER' && s.isVisible);

  const styles = StyleSheet.create({
    page: {
      paddingHorizontal: theme.spacing.page.x,
      paddingVertical: theme.spacing.page.y,
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
      backgroundColor: theme.background,
    },
    header: {
      marginBottom: theme.spacing.sectionGap,
      borderBottomWidth: 1.5,
      borderBottomColor: theme.primary,
      paddingBottom: 8,
    },
  });

  return (
    <Document>
      <Page size={theme.decorations.pageSize} style={styles.page}>
        {headerSection && (
          <View style={styles.header}>
            <HeaderSection section={headerSection} theme={theme} />
          </View>
        )}
        {bodySections.map((section, i) => (
          <TimelineItem
            key={section.id}
            section={section}
            theme={theme}
            isLast={i === bodySections.length - 1}
          />
        ))}
      </Page>
    </Document>
  );
}

function TimelineItem({
  section,
  theme,
  isLast,
}: {
  section: SectionConfig;
  theme: ResumeTheme;
  isLast: boolean;
}) {
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
    },
    timelineTrack: {
      width: 20,
      alignItems: 'center',
      position: 'relative',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.primary,
      marginTop: 2,
    },
    line: {
      width: 1.5,
      flex: 1,
      backgroundColor: isLast ? 'transparent' : theme.border,
      marginTop: 2,
    },
    content: {
      flex: 1,
      paddingLeft: 8,
      paddingBottom: theme.spacing.sectionGap,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.timelineTrack}>
        <View style={styles.dot} />
        <View style={styles.line} />
      </View>
      <View style={styles.content}>
        <RenderSection section={section} theme={theme} isLast={isLast} />
      </View>
    </View>
  );
}

import React from 'react';
import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import type { LayoutProps } from '../types';
import { RenderSection } from '../sections';
import { HeaderSection } from '../sections/header-section';

/**
 * EqualColumns Layout — Full-width header + 50/50 two-column body.
 * High-density layout for consultants, data scientists, or experienced professionals.
 */
export function EqualColumnsLayout({ theme, sections, sidebarSections }: LayoutProps) {
  const headerSection = sections.find((s) => s.type === 'HEADER' && s.isVisible);
  const bodySections = sections.filter((s) => s.type !== 'HEADER' && s.isVisible);

  // If sidebarSections are explicitly set, use them for right column
  // Otherwise, split body sections roughly in half
  let leftCol: typeof bodySections;
  let rightCol: typeof bodySections;

  if (sidebarSections) {
    leftCol = bodySections;
    rightCol = sidebarSections.filter((s) => s.isVisible);
  } else {
    const mid = Math.ceil(bodySections.length / 2);
    leftCol = bodySections.slice(0, mid);
    rightCol = bodySections.slice(mid);
  }

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
      borderBottomWidth: 0.8,
      borderBottomColor: theme.border,
      paddingBottom: 6,
    },
    columns: {
      flexDirection: 'row',
      gap: 16,
    },
    col: { flex: 1 },
  });

  return (
    <Document>
      <Page size={theme.decorations.pageSize} style={styles.page}>
        {headerSection && (
          <View style={styles.header}>
            <HeaderSection section={headerSection} theme={theme} />
          </View>
        )}
        <View style={styles.columns}>
          <View style={styles.col}>
            {leftCol.map((section, i) => (
              <RenderSection
                key={section.id}
                section={section}
                theme={theme}
                isLast={i === leftCol.length - 1}
              />
            ))}
          </View>
          <View style={styles.col}>
            {rightCol.map((section, i) => (
              <RenderSection
                key={section.id}
                section={section}
                theme={theme}
                isLast={i === rightCol.length - 1}
              />
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}

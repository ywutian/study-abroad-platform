import React from 'react';
import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import type { LayoutProps } from '../types';
import { RenderSection } from '../sections';
import { HeaderSectionBanner } from '../sections/header-section';

// Sections that go in the right column by default
const RIGHT_COLUMN_TYPES = new Set(['SKILLS', 'AWARDS', 'CERTIFICATIONS', 'TEST_SCORES']);

/**
 * HeaderBannerColumns Layout — Colored header + two-column body.
 * Dense, information-rich layout for experienced professionals.
 */
export function HeaderBannerColumnsLayout({ theme, sections, sidebarSections }: LayoutProps) {
  const headerSection = sections.find((s) => s.type === 'HEADER' && s.isVisible);
  const rightCol =
    sidebarSections ?? sections.filter((s) => RIGHT_COLUMN_TYPES.has(s.type) && s.isVisible);
  const leftCol = sidebarSections
    ? sections.filter((s) => s.type !== 'HEADER' && s.isVisible)
    : sections.filter((s) => !RIGHT_COLUMN_TYPES.has(s.type) && s.type !== 'HEADER' && s.isVisible);

  const styles = StyleSheet.create({
    page: {
      paddingHorizontal: theme.spacing.page.x,
      paddingVertical: theme.spacing.page.y,
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
      backgroundColor: theme.background,
    },
    columns: {
      flexDirection: 'row',
      gap: 16,
    },
    leftCol: { flex: 1 },
    rightCol: { width: '35%' },
  });

  return (
    <Document>
      <Page size={theme.decorations.pageSize} style={styles.page}>
        {headerSection && <HeaderSectionBanner section={headerSection} theme={theme} />}
        <View style={styles.columns}>
          <View style={styles.leftCol}>
            {leftCol.map((section, i) => (
              <RenderSection
                key={section.id}
                section={section}
                theme={theme}
                isLast={i === leftCol.length - 1}
              />
            ))}
          </View>
          <View style={styles.rightCol}>
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

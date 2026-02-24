import React from 'react';
import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import type { LayoutProps } from '../types';
import { RenderSection } from '../sections';
import { HeaderSectionSidebar } from '../sections/header-section';

// Section types that belong in the sidebar by default
const SIDEBAR_TYPES = new Set(['HEADER', 'SKILLS', 'CERTIFICATIONS', 'TEST_SCORES', 'AWARDS']);

/**
 * SidebarLeft Layout — Left sidebar (25-35%) + right main body.
 * Modern tech resume style with colored sidebar for skills/contact.
 */
export function SidebarLeftLayout({ theme, sections, sidebarSections }: LayoutProps) {
  // Auto-split sections into sidebar and main if not explicitly provided
  const sidebar =
    sidebarSections ?? sections.filter((s) => SIDEBAR_TYPES.has(s.type) && s.isVisible);
  const main = sidebarSections
    ? sections.filter((s) => s.isVisible)
    : sections.filter((s) => !SIDEBAR_TYPES.has(s.type) && s.isVisible);

  const headerSection = sidebar.find((s) => s.type === 'HEADER');
  const sidebarBody = sidebar.filter((s) => s.type !== 'HEADER');

  const styles = StyleSheet.create({
    page: {
      flexDirection: 'row',
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
      backgroundColor: theme.background,
    },
    sidebar: {
      width: theme.spacing.sidebarWidth,
      backgroundColor: theme.sidebarBg,
      paddingHorizontal: 16,
      paddingVertical: theme.spacing.page.y,
    },
    main: {
      flex: 1,
      paddingHorizontal: theme.spacing.page.x,
      paddingVertical: theme.spacing.page.y,
    },
  });

  return (
    <Document>
      <Page size={theme.decorations.pageSize} style={styles.page}>
        <View style={styles.sidebar}>
          {headerSection && <HeaderSectionSidebar section={headerSection} theme={theme} />}
          <View style={{ height: theme.spacing.sectionGap }} />
          {sidebarBody.map((section) => (
            <RenderSection
              key={section.id}
              section={section}
              theme={{
                ...theme,
                text: theme.sidebarText,
                primary: theme.sidebarText,
              }}
            />
          ))}
        </View>
        <View style={styles.main}>
          {main.map((section, i) => (
            <RenderSection
              key={section.id}
              section={section}
              theme={theme}
              isLast={i === main.length - 1}
            />
          ))}
        </View>
      </Page>
    </Document>
  );
}

import React from 'react';
import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import type { LayoutProps } from '../types';
import { RenderSection } from '../sections';
import { HeaderSection } from '../sections/header-section';

const SIDEBAR_TYPES = new Set(['SKILLS', 'CERTIFICATIONS', 'TEST_SCORES', 'AWARDS']);

/**
 * SidebarRight Layout — Left main body + right sidebar (25-35%).
 * Euro-style resume with sidebar for supplementary info.
 */
export function SidebarRightLayout({ theme, sections, sidebarSections }: LayoutProps) {
  const headerSection = sections.find((s) => s.type === 'HEADER' && s.isVisible);
  const sidebar =
    sidebarSections ?? sections.filter((s) => SIDEBAR_TYPES.has(s.type) && s.isVisible);
  const main = sidebarSections
    ? sections.filter((s) => s.type !== 'HEADER' && s.isVisible)
    : sections.filter((s) => !SIDEBAR_TYPES.has(s.type) && s.type !== 'HEADER' && s.isVisible);

  const styles = StyleSheet.create({
    page: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
      backgroundColor: theme.background,
    },
    header: {
      paddingHorizontal: theme.spacing.page.x,
      paddingTop: theme.spacing.page.y,
      paddingBottom: 6,
      borderBottomWidth: 0.8,
      borderBottomColor: theme.border,
    },
    body: {
      flexDirection: 'row',
      flex: 1,
    },
    main: {
      flex: 1,
      paddingLeft: theme.spacing.page.x,
      paddingRight: 12,
      paddingTop: theme.spacing.sectionGap,
    },
    sidebar: {
      width: theme.spacing.sidebarWidth,
      backgroundColor: theme.sidebarBg,
      paddingHorizontal: 14,
      paddingTop: theme.spacing.sectionGap,
      paddingBottom: theme.spacing.page.y,
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
        <View style={styles.body}>
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
          <View style={styles.sidebar}>
            {sidebar.map((section) => (
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
        </View>
      </Page>
    </Document>
  );
}

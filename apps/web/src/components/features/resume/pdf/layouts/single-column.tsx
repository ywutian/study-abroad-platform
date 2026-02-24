import React from 'react';
import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import type { LayoutProps } from '../types';
import { RenderSection } from '../sections';
import { HeaderSection } from '../sections/header-section';

/**
 * SingleColumn Layout — Classic Jake's Resume style.
 * Full-width single column, horizontal rules between sections.
 * ATS friendly, the most common resume format.
 */
export function SingleColumnLayout({ theme, sections }: LayoutProps) {
  const headerSection = sections.find((s) => s.type === 'HEADER');
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
  });

  return (
    <Document>
      <Page size={theme.decorations.pageSize} style={styles.page}>
        {headerSection && <HeaderSection section={headerSection} theme={theme} />}
        <View
          style={{
            height: 0.8,
            backgroundColor: theme.border,
            marginBottom: theme.spacing.sectionGap,
          }}
        />
        {bodySections.map((section, i) => (
          <RenderSection
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

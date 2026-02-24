import React from 'react';
import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import type { LayoutProps } from '../types';
import { RenderSection } from '../sections';
import { HeaderSectionBanner } from '../sections/header-section';

/**
 * HeaderBannerSingle Layout — Colored header banner + single column body.
 * Executive/MBA style with prominent header area.
 */
export function HeaderBannerSingleLayout({ theme, sections }: LayoutProps) {
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
  });

  return (
    <Document>
      <Page size={theme.decorations.pageSize} style={styles.page}>
        {headerSection && <HeaderSectionBanner section={headerSection} theme={theme} />}
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

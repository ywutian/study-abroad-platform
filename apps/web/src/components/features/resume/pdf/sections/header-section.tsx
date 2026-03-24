import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SectionRendererProps } from '../types';
import { ContactRow } from '../primitives/contact-item';
import type { HeaderContent } from '@study-abroad/shared';
import { isSafeUrl } from '@/lib/utils/url';

export function HeaderSection({ section, theme }: SectionRendererProps) {
  const data = section.content as unknown as HeaderContent;
  const styles = getStyles();

  const contactItems: Array<{ value: string; href?: string }> = [
    data.email && { value: data.email, href: `mailto:${data.email}` },
    data.phone && { value: data.phone },
    data.address && { value: data.address },
    data.linkedIn && {
      value: 'LinkedIn',
      href: isSafeUrl(data.linkedIn) ? data.linkedIn : undefined,
    },
    data.github && { value: 'GitHub', href: isSafeUrl(data.github) ? data.github : undefined },
    data.website && { value: 'Website', href: isSafeUrl(data.website) ? data.website : undefined },
  ].filter(Boolean) as Array<{ value: string; href?: string }>;

  return (
    <View style={styles.container}>
      <Text
        style={{
          fontFamily: theme.fontFamily.heading,
          fontSize: theme.fontSize.name,
          fontWeight: 700,
          color: theme.text,
          textAlign: 'center',
          marginBottom: 4,
        }}
      >
        {data.name || 'Your Name'}
      </Text>
      {contactItems.length > 0 && <ContactRow items={contactItems} theme={theme} separator=" | " />}
    </View>
  );
}

/**
 * Header variant for sidebar layouts — stacks vertically.
 */
export function HeaderSectionSidebar({ section, theme }: SectionRendererProps) {
  const data = section.content as unknown as HeaderContent;

  const contactItems: Array<{ label: string; value: string; href?: string }> = [
    data.email && { label: 'Email', value: data.email, href: `mailto:${data.email}` },
    data.phone && { label: 'Phone', value: data.phone },
    data.address && { label: 'Location', value: data.address },
    data.linkedIn && {
      label: 'LinkedIn',
      value: data.linkedIn,
      href: isSafeUrl(data.linkedIn) ? data.linkedIn : undefined,
    },
    data.github && {
      label: 'GitHub',
      value: data.github,
      href: isSafeUrl(data.github) ? data.github : undefined,
    },
    data.website && {
      label: 'Website',
      value: data.website,
      href: isSafeUrl(data.website) ? data.website : undefined,
    },
  ].filter(Boolean) as Array<{ label: string; value: string; href?: string }>;

  return (
    <View>
      <Text
        style={{
          fontFamily: theme.fontFamily.heading,
          fontSize: theme.fontSize.name,
          fontWeight: 700,
          color: theme.sidebarText,
          marginBottom: 8,
        }}
      >
        {data.name || 'Your Name'}
      </Text>
      {contactItems.map((item, i) => (
        <Text
          key={i}
          style={{
            fontFamily: theme.fontFamily.body,
            fontSize: theme.fontSize.small,
            color: theme.sidebarText,
            marginBottom: 2,
          }}
        >
          {item.value}
        </Text>
      ))}
    </View>
  );
}

/**
 * Header variant for banner layouts — white text on colored bg.
 */
export function HeaderSectionBanner({ section, theme }: SectionRendererProps) {
  const data = section.content as unknown as HeaderContent;

  const contactItems: Array<{ value: string; href?: string }> = [
    data.email && { value: data.email, href: `mailto:${data.email}` },
    data.phone && { value: data.phone },
    data.address && { value: data.address },
    data.linkedIn && {
      value: 'LinkedIn',
      href: isSafeUrl(data.linkedIn) ? data.linkedIn : undefined,
    },
    data.github && { value: 'GitHub', href: isSafeUrl(data.github) ? data.github : undefined },
    data.website && { value: 'Website', href: isSafeUrl(data.website) ? data.website : undefined },
  ].filter(Boolean) as Array<{ value: string; href?: string }>;

  // Banner uses headerBg + headerText colors — with fallbacks
  const headerBg = theme.headerBg || theme.primary || '#1e3a5f';
  const headerText = theme.headerText || '#ffffff';

  const bannerTheme = {
    ...theme,
    text: headerText,
    textLight: headerText,
    primary: headerText,
  };

  return (
    <View
      style={{
        backgroundColor: headerBg,
        padding: `${theme.spacing.page.y} ${theme.spacing.page.x}`,
        marginTop: -theme.spacing.page.y,
        marginHorizontal: -theme.spacing.page.x,
        marginBottom: theme.spacing.sectionGap,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fontFamily.heading,
          fontSize: theme.fontSize.name + 4,
          fontWeight: 700,
          color: headerText,
          textAlign: 'center',
          marginBottom: 6,
        }}
      >
        {data.name || 'Your Name'}
      </Text>
      {contactItems.length > 0 && (
        <ContactRow items={contactItems} theme={bannerTheme} separator=" | " />
      )}
    </View>
  );
}

function getStyles() {
  return StyleSheet.create({
    container: { alignItems: 'center', marginBottom: 4 },
  });
}

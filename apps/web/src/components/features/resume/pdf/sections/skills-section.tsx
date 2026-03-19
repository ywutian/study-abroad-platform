import React from 'react';
import { View, StyleSheet } from '@react-pdf/renderer';
import type { SectionRendererProps } from '../types';
import { SectionTitle } from '../primitives/section-title';
import { SkillTags } from '../primitives/skill-bar';
import type { SkillCategory } from '@study-abroad/shared';
import type { ResumeTheme } from '../types';

export function SkillsSection({ section, theme }: SectionRendererProps) {
  const categories = ((section.content as Record<string, unknown>).categories ??
    []) as SkillCategory[];
  if (!categories.length) return null;

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <SectionTitle title={section.title} theme={theme} />
      {categories.map((cat, i) => (
        <SkillTags key={i} name={cat.name} items={cat.items} theme={theme} />
      ))}
    </View>
  );
}

function getStyles(theme: ResumeTheme) {
  return StyleSheet.create({
    container: { marginBottom: theme.spacing.sectionGap },
  });
}

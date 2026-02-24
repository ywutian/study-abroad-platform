import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ResumeTheme } from '../types';

interface SkillTagsProps {
  name: string;
  items: string[];
  theme: ResumeTheme;
}

/**
 * Renders a skill category as "Name: item1, item2, item3"
 * This is the standard format for ATS-friendly resumes.
 */
export function SkillTags({ name, items, theme }: SkillTagsProps) {
  if (!items.length) return null;
  const styles = getStyles(theme);

  return (
    <View style={styles.row}>
      {name && <Text style={styles.name}>{name}: </Text>}
      <Text style={styles.items}>{items.join(', ')}</Text>
    </View>
  );
}

function getStyles(theme: ResumeTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 2,
    },
    name: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      fontWeight: 700,
      color: theme.text,
    },
    items: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      color: theme.text,
      flex: 1,
    },
  });
}

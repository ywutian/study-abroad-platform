import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ResumeTheme } from '../types';

interface BulletListProps {
  items: string[];
  theme: ResumeTheme;
}

const BULLET_CHARS: Record<string, string> = {
  disc: '\u2022', // •
  dash: '\u2013', // –
  arrow: '\u203A', // ›
  square: '\u25AA', // ▪
};

export function BulletList({ items, theme }: BulletListProps) {
  if (!items.length) return null;
  const bullet = BULLET_CHARS[theme.decorations.bulletStyle] ?? '\u2022';
  const styles = getStyles(theme);

  return (
    <View style={styles.list}>
      {items.map((item, i) => (
        <View key={i} style={styles.item} wrap={false}>
          <Text style={styles.bullet}>{bullet}</Text>
          <Text style={styles.text}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function getStyles(theme: ResumeTheme) {
  return StyleSheet.create({
    list: { marginTop: 2 },
    item: {
      flexDirection: 'row',
      marginBottom: 1.5,
      paddingLeft: 2,
    },
    bullet: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      lineHeight: theme.spacing.lineHeight,
      color: theme.text,
      width: 10,
    },
    text: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.body,
      lineHeight: theme.spacing.lineHeight,
      color: theme.text,
      flex: 1,
    },
  });
}

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { ResumeTheme } from '../types';

interface DividerProps {
  theme: ResumeTheme;
}

export function Divider({ theme }: DividerProps) {
  const { sectionDivider } = theme.decorations;
  const styles = getStyles(theme);

  switch (sectionDivider) {
    case 'double-line':
      return (
        <View style={styles.doubleContainer}>
          <View style={styles.line} />
          <View style={styles.lineGap} />
          <View style={styles.line} />
        </View>
      );
    case 'dots':
      return (
        <View style={styles.dotsContainer}>
          <Text style={styles.dots}>{'•  '.repeat(20).trim()}</Text>
        </View>
      );
    case 'none':
      return <View style={styles.spacer} />;
    case 'line':
    default:
      return <View style={styles.singleLine} />;
  }
}

function getStyles(theme: ResumeTheme) {
  return StyleSheet.create({
    singleLine: {
      height: 0.5,
      backgroundColor: theme.border,
      marginVertical: theme.spacing.sectionGap / 2,
    },
    doubleContainer: {
      marginVertical: theme.spacing.sectionGap / 2,
    },
    line: { height: 0.5, backgroundColor: theme.border },
    lineGap: { height: 1.5 },
    dotsContainer: {
      marginVertical: theme.spacing.sectionGap / 2,
      alignItems: 'center',
    },
    dots: {
      fontSize: 5,
      color: theme.border,
      letterSpacing: 2,
    },
    spacer: {
      height: theme.spacing.sectionGap,
    },
  });
}

import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ResumeTheme } from '../types';

interface SectionTitleProps {
  title: string;
  theme: ResumeTheme;
}

export function SectionTitle({ title, theme }: SectionTitleProps) {
  const { headingStyle, sectionDivider } = theme.decorations;
  const styles = getStyles(theme);

  switch (headingStyle) {
    case 'background':
      return (
        <View style={styles.backgroundContainer}>
          <Text style={styles.backgroundText}>{title}</Text>
        </View>
      );
    case 'border-left':
      return (
        <View style={styles.borderLeftContainer}>
          <Text style={styles.borderLeftText}>{title}</Text>
        </View>
      );
    case 'uppercase':
      return (
        <View style={styles.uppercaseContainer}>
          <Text style={styles.uppercaseText}>{title.toUpperCase()}</Text>
          {sectionDivider === 'line' && <View style={styles.dividerLine} />}
        </View>
      );
    case 'plain':
      return (
        <View style={styles.plainContainer}>
          <Text style={styles.plainText}>{title}</Text>
        </View>
      );
    case 'underline':
    default:
      return (
        <View style={styles.underlineContainer}>
          <Text style={styles.underlineText}>{title}</Text>
          <View style={styles.dividerLine} />
        </View>
      );
  }
}

function getStyles(theme: ResumeTheme) {
  return StyleSheet.create({
    // Underline style (default — Jake's Resume)
    underlineContainer: { marginBottom: 4 },
    underlineText: {
      fontFamily: theme.fontFamily.heading,
      fontSize: theme.fontSize.sectionTitle,
      fontWeight: 700,
      color: theme.primary,
      marginBottom: 2,
    },
    dividerLine: {
      height: 0.8,
      backgroundColor: theme.border,
    },

    // Background style
    backgroundContainer: {
      backgroundColor: theme.primary,
      padding: '3 8',
      marginBottom: 6,
      marginHorizontal: -theme.spacing.page.x,
      paddingHorizontal: theme.spacing.page.x,
    },
    backgroundText: {
      fontFamily: theme.fontFamily.heading,
      fontSize: theme.fontSize.sectionTitle,
      fontWeight: 700,
      color: '#fff9ef',
    },

    // Border-left style
    borderLeftContainer: {
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
      paddingLeft: 8,
      marginBottom: 4,
    },
    borderLeftText: {
      fontFamily: theme.fontFamily.heading,
      fontSize: theme.fontSize.sectionTitle,
      fontWeight: 700,
      color: theme.primary,
    },

    // Uppercase style
    uppercaseContainer: { marginBottom: 4 },
    uppercaseText: {
      fontFamily: theme.fontFamily.heading,
      fontSize: theme.fontSize.sectionTitle - 1,
      fontWeight: 700,
      color: theme.primary,
      letterSpacing: 2,
      marginBottom: 2,
    },

    // Plain style
    plainContainer: { marginBottom: 4 },
    plainText: {
      fontFamily: theme.fontFamily.heading,
      fontSize: theme.fontSize.sectionTitle,
      fontWeight: 700,
      color: theme.text,
    },
  });
}

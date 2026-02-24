import React from 'react';
import { Text, View, StyleSheet, Link } from '@react-pdf/renderer';
import type { ResumeTheme } from '../types';

interface ContactItemProps {
  value: string;
  href?: string;
  theme: ResumeTheme;
  separator?: string;
}

export function ContactItem({ value, href, theme, separator = ' | ' }: ContactItemProps) {
  const styles = getStyles(theme);

  if (href) {
    return (
      <View style={styles.wrapper}>
        <Link src={href} style={styles.link}>
          {value}
        </Link>
        <Text style={styles.separator}>{separator}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.text}>{value}</Text>
      <Text style={styles.separator}>{separator}</Text>
    </View>
  );
}

interface ContactRowProps {
  items: Array<{ value: string; href?: string }>;
  theme: ResumeTheme;
  separator?: string;
}

export function ContactRow({ items, theme, separator = ' | ' }: ContactRowProps) {
  const styles = getStyles(theme);
  const filtered = items.filter((i) => i.value);

  return (
    <View style={styles.row}>
      {filtered.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Text style={styles.separatorText}>{separator}</Text>}
          {item.href ? (
            <Link src={item.href} style={styles.link}>
              {item.value}
            </Link>
          ) : (
            <Text style={styles.text}>{item.value}</Text>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function getStyles(theme: ResumeTheme) {
  return StyleSheet.create({
    wrapper: { flexDirection: 'row', alignItems: 'center' },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.text,
    },
    link: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.primary,
      textDecoration: 'none',
    },
    separator: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.textLight,
    },
    separatorText: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.textLight,
      marginHorizontal: 3,
    },
  });
}

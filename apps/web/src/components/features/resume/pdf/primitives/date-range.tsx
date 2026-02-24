import React from 'react';
import { Text, StyleSheet } from '@react-pdf/renderer';
import type { ResumeTheme } from '../types';

interface DateRangeProps {
  start?: string;
  end?: string;
  isCurrent?: boolean;
  theme: ResumeTheme;
}

/**
 * Renders a date range text aligned to the right.
 * Input dates are ISO month strings (YYYY-MM) or display strings.
 */
export function DateRange({ start, end, isCurrent, theme }: DateRangeProps) {
  const styles = getStyles(theme);
  const formatted = formatRange(start, end, isCurrent, theme.decorations.dateFormat);
  if (!formatted) return null;

  return <Text style={styles.text}>{formatted}</Text>;
}

function formatRange(
  start?: string,
  end?: string,
  isCurrent?: boolean,
  format: string = 'MMM YYYY'
): string {
  const fmt = (d?: string) => {
    if (!d) return '';
    // If already formatted (not ISO), pass through
    if (!/^\d{4}-\d{2}/.test(d)) return d;
    const date = new Date(d + '-01');
    if (isNaN(date.getTime())) return d;
    switch (format) {
      case 'MM/YYYY':
        return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      case 'YYYY':
        return String(date.getFullYear());
      case 'MMM YYYY':
      default:
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  };

  const s = fmt(start);
  const e = isCurrent ? 'Present' : fmt(end);

  if (s && e) return `${s} \u2013 ${e}`;
  if (s) return s;
  if (e) return e;
  return '';
}

function getStyles(theme: ResumeTheme) {
  return StyleSheet.create({
    text: {
      fontFamily: theme.fontFamily.body,
      fontSize: theme.fontSize.small,
      color: theme.textLight,
    },
  });
}

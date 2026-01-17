import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  leftElement?: React.ReactNode;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ListItem({
  title,
  subtitle,
  leftIcon,
  leftElement,
  rightIcon,
  rightElement,
  onPress,
  showChevron = true,
  disabled = false,
  style,
}: ListItemProps) {
  const colors = useColors();

  const content = (
    <View style={[styles.container, disabled && styles.disabled, style]}>
      {(leftIcon || leftElement) && (
        <View style={styles.leftContainer}>
          {leftElement || (
            <View style={[styles.iconContainer, { backgroundColor: colors.muted }]}>
              <Ionicons name={leftIcon!} size={20} color={colors.foreground} />
            </View>
          )}
        </View>
      )}

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.foregroundMuted }]}>{subtitle}</Text>
        )}
      </View>

      {(rightElement || rightIcon || (onPress && showChevron)) && (
        <View style={styles.rightContainer}>
          {rightElement || (
            <Ionicons
              name={rightIcon || 'chevron-forward'}
              size={20}
              color={colors.foregroundMuted}
            />
          )}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// Separator component
interface SeparatorProps {
  style?: StyleProp<ViewStyle>;
  inset?: boolean;
}

export function Separator({ style, inset = false }: SeparatorProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.separator,
        { backgroundColor: colors.border },
        inset && { marginLeft: spacing['4xl'] },
        style,
      ]}
    />
  );
}

// Section header
interface SectionHeaderProps {
  title: string;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, style }: SectionHeaderProps) {
  const colors = useColors();

  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[styles.sectionTitle, { color: colors.foregroundMuted }]}>{title}</Text>
    </View>
  );
}

// List group wrapper
interface ListGroupProps {
  children: React.ReactNode;
  header?: string;
  style?: StyleProp<ViewStyle>;
}

export function ListGroup({ children, header, style }: ListGroupProps) {
  const colors = useColors();

  return (
    <View style={style}>
      {header && <SectionHeader title={header} />}
      <View
        style={[
          styles.listGroup,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {React.Children.map(children, (child, index) => (
          <>
            {child}
            {index < React.Children.count(children) - 1 && <Separator inset />}
          </>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  disabled: {
    opacity: 0.5,
  },
  leftContainer: {
    marginRight: spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  rightContainer: {
    marginLeft: spacing.md,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listGroup: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
});

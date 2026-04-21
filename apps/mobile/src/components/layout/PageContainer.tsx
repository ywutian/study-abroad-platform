import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle, StyleProp, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { responsiveSpacing } from '@/utils/responsive';
import { spacing, useColors } from '@/utils/theme';

type PageContainerVariant = 'marketing' | 'entry' | 'tool' | 'ai' | 'community' | 'admin';

interface PageContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  bottomPadding?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  variant?: PageContainerVariant;
}

const variantPadding: Record<PageContainerVariant, number> = {
  marketing: responsiveSpacing.pageHorizontal,
  entry: responsiveSpacing.pageHorizontal,
  tool: responsiveSpacing.pageHorizontal,
  ai: responsiveSpacing.pageHorizontal,
  community: responsiveSpacing.pageHorizontal,
  admin: spacing.lg,
};

export function PageContainer({
  children,
  scrollable = true,
  refreshing,
  onRefresh,
  bottomPadding,
  style,
  contentContainerStyle,
  variant = 'tool',
}: PageContainerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const paddingBottom = bottomPadding ?? insets.bottom + 80;
  const paddingHorizontal = variantPadding[variant];

  if (!scrollable) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingHorizontal,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }, style]}
      contentContainerStyle={[
        {
          paddingHorizontal,
          paddingBottom,
        },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

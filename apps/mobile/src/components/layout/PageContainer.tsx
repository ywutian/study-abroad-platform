import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle, StyleProp, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, spacing } from '@/utils/theme';
import { responsiveSpacing } from '@/utils/responsive';

interface PageContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  bottomPadding?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function PageContainer({
  children,
  scrollable = true,
  refreshing,
  onRefresh,
  bottomPadding,
  style,
  contentContainerStyle,
}: PageContainerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const paddingBottom = bottomPadding ?? insets.bottom + 80;

  if (!scrollable) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingHorizontal: responsiveSpacing.pageHorizontal,
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
          paddingHorizontal: responsiveSpacing.pageHorizontal,
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

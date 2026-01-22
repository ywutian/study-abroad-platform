import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  size: number;
}

function AnimatedTabIcon({ name, focused, color, size }: TabIconProps) {
  const scale = useSharedValue(focused ? 1 : 0.85);
  const translateY = useSharedValue(focused ? -2 : 0);

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.85, {
      damping: 15,
      stiffness: 200,
    });
    translateY.value = withSpring(focused ? -2 : 0, {
      damping: 15,
      stiffness: 200,
    });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

interface AnimatedTabBarButtonProps {
  onPress: () => void;
  onLongPress: () => void;
  isFocused: boolean;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  activeColor: string;
  inactiveColor: string;
  backgroundColor: string;
}

function AnimatedTabBarButton({
  onPress,
  onLongPress,
  isFocused,
  label,
  iconName,
  activeColor,
  inactiveColor,
  backgroundColor,
}: AnimatedTabBarButtonProps) {
  const colors = useColors();
  const pressed = useSharedValue(0);
  const focused = useSharedValue(isFocused ? 1 : 0);

  React.useEffect(() => {
    focused.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
  }, [isFocused]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.92]) }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.8]),
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    width: interpolate(focused.value, [0, 1], [0, 4]),
    opacity: focused.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focused.value, [0, 1], [0.6, 1]),
    transform: [{ scale: interpolate(focused.value, [0, 1], [0.9, 1]) }],
  }));

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 100 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 100 });
      }}
      style={styles.tabButton}
    >
      <Animated.View style={[styles.tabButtonInner, containerStyle]}>
        <AnimatedTabIcon
          name={iconName}
          focused={isFocused}
          color={isFocused ? activeColor : inactiveColor}
          size={24}
        />
        <Animated.Text
          style={[styles.label, { color: isFocused ? activeColor : inactiveColor }, labelStyle]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
        {/* 活动指示器 */}
        <Animated.View
          style={[styles.indicator, { backgroundColor: activeColor }, indicatorStyle]}
        />
      </Animated.View>
    </Pressable>
  );
}

// Tab 图标映射
const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  schools: 'school',
  cases: 'folder-open',
  ai: 'sparkles',
  profile: 'person',
};

export function AnimatedTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;

        const isFocused = state.index === index;
        const iconName = TAB_ICONS[route.name] || 'ellipse';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <AnimatedTabBarButton
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            isFocused={isFocused}
            label={label as string}
            iconName={iconName}
            activeColor={colors.primary}
            inactiveColor={colors.foregroundMuted}
            backgroundColor={colors.card}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 56,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginTop: spacing.xs,
  },
  indicator: {
    height: 4,
    borderRadius: 2,
    marginTop: spacing.xs,
  },
});

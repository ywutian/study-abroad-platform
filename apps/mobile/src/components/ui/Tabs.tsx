import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

interface Tab {
  key: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  scrollable?: boolean;
}

export function Tabs({ tabs, defaultTab, onChange, style, scrollable = false }: TabsProps) {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.key);

  const handleTabPress = (key: string) => {
    setActiveTab(key);
    onChange?.(key);
  };

  const TabBar = scrollable ? ScrollView : View;
  const tabBarProps = scrollable
    ? { horizontal: true, showsHorizontalScrollIndicator: false }
    : {};

  return (
    <View style={style}>
      <TabBar
        {...tabBarProps}
        style={[
          styles.tabBar,
          { 
            backgroundColor: colors.muted,
            borderColor: colors.border,
          },
        ]}
        contentContainerStyle={scrollable ? styles.scrollContent : undefined}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => handleTabPress(tab.key)}
            style={[
              styles.tab,
              activeTab === tab.key && {
                backgroundColor: colors.background,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === tab.key
                      ? colors.foreground
                      : colors.foregroundMuted,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </TabBar>
      <View style={styles.content}>
        {tabs.find((tab) => tab.key === activeTab)?.content}
      </View>
    </View>
  );
}

// Simple segment control variant
interface SegmentProps {
  segments: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function Segment({ segments, value, onChange, style }: SegmentProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.segmentContainer,
        { backgroundColor: colors.muted },
        style,
      ]}
    >
      {segments.map((segment) => (
        <TouchableOpacity
          key={segment.key}
          onPress={() => onChange(segment.key)}
          style={[
            styles.segment,
            value === segment.key && {
              backgroundColor: colors.background,
            },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              {
                color:
                  value === segment.key
                    ? colors.foreground
                    : colors.foregroundMuted,
              },
            ]}
          >
            {segment.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    minWidth: 80,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  content: {
    marginTop: spacing.lg,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});





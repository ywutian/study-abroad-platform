/**
 * 荣誉殿堂页面
 * 
 * 展示平台优秀学员和录取案例
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import {
  AnimatedCard,
  CardContent,
  Badge,
  Avatar,
  EmptyState,
  Loading,
  Tabs,
  AnimatedCounter,
} from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { apiClient } from '@/lib/api/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HallMember {
  id: string;
  name: string;
  avatar?: string;
  school: string;
  schoolLogo?: string;
  major: string;
  year: number;
  previousSchool?: string;
  gpa?: number;
  testScores?: string;
  highlight?: string;
  rank?: number;
  verified: boolean;
}

interface HallStats {
  totalAdmissions: number;
  topSchools: number;
  avgGpa: number;
  successRate: number;
}

export default function HallOfFameScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'all' | 'ivy' | 'top10' | 'top30'>('all');
  const scrollY = useSharedValue(0);

  // 获取荣誉殿堂数据
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hallOfFame', activeTab],
    queryFn: () => apiClient.get<{ members: HallMember[]; stats: HallStats }>('/hall', {
      params: { filter: activeTab },
    }),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, 150], [0, -50], 'clamp'),
      },
    ],
    opacity: interpolate(scrollY.value, [0, 100], [1, 0], 'clamp'),
  }));

  const stats = data?.stats || {
    totalAdmissions: 0,
    topSchools: 0,
    avgGpa: 0,
    successRate: 0,
  };

  const members = data?.members || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <LinearGradient
          colors={['#FFD700', '#FFA500']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.trophyContainer}>
              <Ionicons name="trophy" size={48} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>荣誉殿堂</Text>
            <Text style={styles.headerSubtitle}>
              记录每一份努力与成功
            </Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <StatItem
              value={stats.totalAdmissions}
              label="总录取"
              icon="checkmark-done"
            />
            <View style={styles.statDivider} />
            <StatItem
              value={stats.topSchools}
              label="Top 学校"
              icon="school"
            />
            <View style={styles.statDivider} />
            <StatItem
              value={stats.avgGpa}
              label="平均 GPA"
              decimals={2}
              icon="stats-chart"
            />
            <View style={styles.statDivider} />
            <StatItem
              value={stats.successRate}
              label="成功率"
              suffix="%"
              icon="trending-up"
            />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.background }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {[
            { key: 'all', label: '全部' },
            { key: 'ivy', label: '藤校' },
            { key: 'top10', label: 'Top 10' },
            { key: 'top30', label: 'Top 30' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key as any)}
              style={[
                styles.tab,
                {
                  backgroundColor: activeTab === tab.key ? colors.primary : colors.muted,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab.key ? '#fff' : colors.foreground },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Member List */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listContainer}>
          {isLoading ? (
            <Loading />
          ) : members.length > 0 ? (
            members.map((member, index) => (
              <Animated.View
                key={member.id}
                entering={FadeInUp.delay(index * 80).springify()}
              >
                <MemberCard
                  member={member}
                  colors={colors}
                  rank={index + 1}
                  onPress={() => router.push(`/case/${member.id}`)}
                />
              </Animated.View>
            ))
          ) : (
            <EmptyState
              icon="trophy-outline"
              title="暂无数据"
              description="成为第一个加入荣誉殿堂的人吧！"
            />
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// Stat Item
function StatItem({
  value,
  label,
  icon,
  suffix,
  decimals = 0,
}: {
  value: number;
  label: string;
  icon: string;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon as any} size={18} color="rgba(255,255,255,0.8)" />
      <AnimatedCounter
        value={value}
        suffix={suffix}
        decimals={decimals}
        style={styles.statValue}
      />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Member Card
function MemberCard({
  member,
  colors,
  rank,
  onPress,
}: {
  member: HallMember;
  colors: any;
  rank: number;
  onPress: () => void;
}) {
  const getRankBadge = () => {
    if (rank === 1) return { color: '#FFD700', icon: 'trophy' };
    if (rank === 2) return { color: '#C0C0C0', icon: 'medal' };
    if (rank === 3) return { color: '#CD7F32', icon: 'medal' };
    return null;
  };

  const rankBadge = getRankBadge();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <AnimatedCard style={styles.memberCard}>
        <CardContent>
          {/* Rank Badge */}
          {rankBadge && (
            <View style={[styles.rankBadge, { backgroundColor: rankBadge.color }]}>
              <Ionicons name={rankBadge.icon as any} size={16} color="#fff" />
            </View>
          )}

          <View style={styles.memberHeader}>
            <Avatar
              source={member.avatar}
              name={member.name}
              size="lg"
            />
            <View style={styles.memberInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.memberName, { color: colors.foreground }]}>
                  {member.name}
                </Text>
                {member.verified && (
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                )}
              </View>
              <Text style={[styles.schoolName, { color: colors.primary }]}>
                {member.school}
              </Text>
              <Text style={[styles.majorYear, { color: colors.foregroundMuted }]}>
                {member.major} · {member.year}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.memberStats}>
            {member.gpa && (
              <View style={[styles.memberStat, { backgroundColor: colors.muted }]}>
                <Text style={[styles.memberStatLabel, { color: colors.foregroundMuted }]}>
                  GPA
                </Text>
                <Text style={[styles.memberStatValue, { color: colors.foreground }]}>
                  {member.gpa.toFixed(2)}
                </Text>
              </View>
            )}
            {member.testScores && (
              <View style={[styles.memberStat, { backgroundColor: colors.muted }]}>
                <Text style={[styles.memberStatLabel, { color: colors.foregroundMuted }]}>
                  标化
                </Text>
                <Text style={[styles.memberStatValue, { color: colors.foreground }]}>
                  {member.testScores}
                </Text>
              </View>
            )}
            {member.previousSchool && (
              <View style={[styles.memberStat, { backgroundColor: colors.muted }]}>
                <Text style={[styles.memberStatLabel, { color: colors.foregroundMuted }]}>
                  本科
                </Text>
                <Text
                  style={[styles.memberStatValue, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {member.previousSchool}
                </Text>
              </View>
            )}
          </View>

          {/* Highlight */}
          {member.highlight && (
            <View style={[styles.highlight, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text style={[styles.highlightText, { color: colors.primary }]}>
                {member.highlight}
              </Text>
            </View>
          )}
        </CardContent>
      </AnimatedCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerGradient: {
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius['2xl'],
    borderBottomRightRadius: borderRadius['2xl'],
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  trophyContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: '#fff',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.9)',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#fff',
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.sm,
  },
  tabsContainer: {
    paddingTop: 220,
    paddingBottom: spacing.sm,
  },
  tabs: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  listContainer: {
    padding: spacing.lg,
  },
  memberCard: {
    marginBottom: spacing.md,
    overflow: 'visible',
  },
  rankBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  memberName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  schoolName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  majorYear: {
    fontSize: fontSize.xs,
  },
  memberStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  memberStat: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  memberStatLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  memberStatValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  highlightText: {
    fontSize: fontSize.sm,
    flex: 1,
  },
});



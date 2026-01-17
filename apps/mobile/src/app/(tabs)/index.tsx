import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight, SlideInUp } from 'react-native-reanimated';

import {
  Badge,
  Avatar,
  EmptyState,
  AnimatedButton,
  AnimatedCard,
  CardContent,
  FadeInView,
  StaggeredItem,
  AnimatedSkeleton,
  SkeletonCard,
  SkeletonListItem,
} from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { School, Case, PaginatedResponse } from '@/types';

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuthStore();

  // Fetch recent cases
  const {
    data: casesData,
    isLoading: casesLoading,
    refetch: refetchCases,
  } = useQuery({
    queryKey: ['recentCases'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Case>>('/cases', {
        params: { limit: 5, sort: 'createdAt', order: 'desc' },
      }),
  });

  // Fetch top schools
  const {
    data: schoolsData,
    isLoading: schoolsLoading,
    refetch: refetchSchools,
  } = useQuery({
    queryKey: ['topSchools'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<School>>('/schools', {
        params: { limit: 5, sort: 'usnewsRank', order: 'asc' },
      }),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchCases(), refetchSchools()]);
    setRefreshing(false);
  };

  const quickActions = [
    {
      icon: 'person-outline' as const,
      title: t('home.features.profile'),
      desc: t('home.features.profileDesc'),
      route: '/(tabs)/profile',
      color: colors.primary,
    },
    {
      icon: 'analytics-outline' as const,
      title: t('home.features.prediction'),
      desc: t('home.features.predictionDesc'),
      route: '/(tabs)/ai',
      color: colors.success,
    },
    {
      icon: 'list-outline' as const,
      title: t('home.features.ranking'),
      desc: t('home.features.rankingDesc'),
      route: '/(tabs)/schools',
      color: colors.warning,
    },
    {
      icon: 'document-text-outline' as const,
      title: t('home.features.essay'),
      desc: t('home.features.essayDesc'),
      route: '/(tabs)/ai',
      color: colors.info,
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <Animated.View entering={SlideInUp.duration(500).springify()}>
        <LinearGradient
          colors={[colors.primary, colors.primary + 'cc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroContent}>
            {isAuthenticated ? (
              <FadeInView animation="fadeUp" delay={200}>
                <Text style={styles.heroWelcome}>{t('home.welcomeBack')}</Text>
                <Text style={styles.heroName}>{user?.email.split('@')[0]}</Text>
              </FadeInView>
            ) : (
              <FadeInView animation="fadeUp" delay={200}>
                <Text style={styles.heroWelcome}>{t('home.guestWelcome')}</Text>
                <Text style={styles.heroSubtitle}>{t('home.loginPrompt')}</Text>
                <AnimatedButton
                  onPress={() => router.push('/(auth)/login')}
                  variant="ghost"
                  style={styles.heroButton}
                  textStyle={styles.heroButtonText}
                >
                  {t('common.login')}
                </AnimatedButton>
              </FadeInView>
            )}
          </View>

          {/* Stats */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(400).springify()}
            style={styles.statsRow}
          >
            <View style={styles.statItem}>
              <Text style={styles.statValue}>10,000+</Text>
              <Text style={styles.statLabel}>{t('home.stats.cases')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>500+</Text>
              <Text style={styles.statLabel}>{t('home.stats.schools')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>95%</Text>
              <Text style={styles.statLabel}>{t('home.stats.accuracy')}</Text>
            </View>
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <FadeInView animation="fadeUp" delay={500}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t('home.quickActions')}
          </Text>
        </FadeInView>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <StaggeredItem
              key={index}
              index={index}
              staggerDelay={80}
              style={styles.actionCardWrapper}
            >
              <AnimatedCard
                onPress={() => router.push(action.route as any)}
                style={styles.actionCard}
              >
                <CardContent style={styles.actionCardContent}>
                  <View
                    style={[styles.actionIconContainer, { backgroundColor: action.color + '20' }]}
                  >
                    <Ionicons name={action.icon} size={24} color={action.color} />
                  </View>
                  <Text
                    style={[styles.actionTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {action.title}
                  </Text>
                  <Text
                    style={[styles.actionDesc, { color: colors.foregroundMuted }]}
                    numberOfLines={1}
                  >
                    {action.desc}
                  </Text>
                </CardContent>
              </AnimatedCard>
            </StaggeredItem>
          ))}
        </View>
      </View>

      {/* Top Schools */}
      <View style={styles.section}>
        <FadeInView animation="fadeUp" delay={600}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t('home.topSchools')}
            </Text>
            <AnimatedButton
              variant="ghost"
              size="sm"
              onPress={() => router.push('/(tabs)/schools')}
            >
              {t('home.viewAll')}
            </AnimatedButton>
          </View>
        </FadeInView>

        {schoolsLoading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.schoolCard}>
                <AnimatedSkeleton
                  variant="circle"
                  height={64}
                  style={{ alignSelf: 'center', marginBottom: 8 }}
                />
                <AnimatedSkeleton height={14} style={{ marginBottom: 8 }} />
                <AnimatedSkeleton
                  width={80}
                  height={24}
                  borderRadius={12}
                  style={{ alignSelf: 'center' }}
                />
              </View>
            ))}
          </ScrollView>
        ) : schoolsData?.data?.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {schoolsData.data.map((school, index) => (
              <StaggeredItem key={school.id} index={index} staggerDelay={100}>
                <AnimatedCard
                  onPress={() => router.push(`/school/${school.id}`)}
                  style={styles.schoolCard}
                >
                  <CardContent>
                    <Avatar
                      source={school.logoUrl}
                      name={school.name}
                      size="lg"
                      style={styles.schoolLogo}
                    />
                    <Text
                      style={[styles.schoolName, { color: colors.foreground }]}
                      numberOfLines={2}
                    >
                      {school.name}
                    </Text>
                    {school.usnewsRank && (
                      <Badge variant="secondary">#{school.usnewsRank} US News</Badge>
                    )}
                  </CardContent>
                </AnimatedCard>
              </StaggeredItem>
            ))}
          </ScrollView>
        ) : (
          <FadeInView animation="zoom">
            <EmptyState icon="school-outline" title={t('schools.noResults')} />
          </FadeInView>
        )}
      </View>

      {/* Recent Cases */}
      <View style={styles.section}>
        <FadeInView animation="fadeUp" delay={700}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t('home.recentCases')}
            </Text>
            <AnimatedButton variant="ghost" size="sm" onPress={() => router.push('/(tabs)/cases')}>
              {t('home.viewAll')}
            </AnimatedButton>
          </View>
        </FadeInView>

        {casesLoading ? (
          <View>
            {[1, 2, 3].map((i) => (
              <SkeletonListItem key={i} hasAvatar={false} />
            ))}
          </View>
        ) : casesData?.data?.length ? (
          casesData.data.map((caseItem, index) => (
            <StaggeredItem key={caseItem.id} index={index} staggerDelay={80}>
              <AnimatedCard
                onPress={() => router.push(`/case/${caseItem.id}`)}
                style={styles.caseCard}
              >
                <CardContent style={styles.caseCardContent}>
                  <View style={styles.caseInfo}>
                    <Text
                      style={[styles.caseSchool, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {caseItem.school?.name || t('common.unknownSchool')}
                    </Text>
                    <Text
                      style={[styles.caseMajor, { color: colors.foregroundMuted }]}
                      numberOfLines={1}
                    >
                      {caseItem.major} · {caseItem.year}
                    </Text>
                  </View>
                  <Badge
                    variant={
                      caseItem.result === 'ADMITTED'
                        ? 'success'
                        : caseItem.result === 'REJECTED'
                          ? 'error'
                          : 'warning'
                    }
                  >
                    {t(`cases.result.${caseItem.result.toLowerCase()}`)}
                  </Badge>
                </CardContent>
              </AnimatedCard>
            </StaggeredItem>
          ))
        ) : (
          <FadeInView animation="zoom">
            <EmptyState icon="folder-open-outline" title={t('cases.noCases')} />
          </FadeInView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
    borderBottomLeftRadius: borderRadius['2xl'],
    borderBottomRightRadius: borderRadius['2xl'],
  },
  heroContent: {
    marginBottom: spacing.xl,
  },
  heroWelcome: {
    fontSize: fontSize.base,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.xs,
  },
  heroName: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  heroSubtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.lg,
  },
  heroButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: '#ffffff',
    fontWeight: fontWeight.semibold,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.md,
  },
  section: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  viewAll: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  actionCardWrapper: {
    width: '50%',
    padding: spacing.xs,
  },
  actionCard: {
    height: 120,
  },
  actionCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  actionDesc: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  horizontalList: {
    paddingRight: spacing.lg,
  },
  schoolCard: {
    width: 140,
    marginRight: spacing.md,
  },
  schoolLogo: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  schoolName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
    marginBottom: spacing.sm,
    height: 36,
  },
  caseCard: {
    marginBottom: spacing.sm,
  },
  caseCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caseInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  caseSchool: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  caseMajor: {
    fontSize: fontSize.sm,
  },
});

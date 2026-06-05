import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Button,
  Avatar,
  Badge,
  Loading,
  EmptyState,
  ConfirmDialog,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { ListItem, ListGroup } from '@/components/ui/ListItem';
import { CircularProgress } from '@/components/ui/Progress';
import {
  profileRoutes,
  API_ROUTES,
  verificationRoutes,
  type AIAnalysisResult,
} from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import {
  useColors,
  withOpacity,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  fontFamily,
} from '@/utils/theme';
import type { Profile } from '@/types';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user, isAuthenticated, logout } = useAuthStore();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<Profile>(profileRoutes.me()),
    enabled: isAuthenticated,
  });

  const { data: verificationData } = useQuery({
    queryKey: ['verification', 'status'],
    queryFn: () =>
      apiClient.get<{ emailVerified: boolean; identityVerified: boolean }>(
        verificationRoutes.status()
      ),
    enabled: isAuthenticated,
  });

  const { data: pointsData } = useQuery({
    queryKey: ['points', 'balance'],
    // Canonical endpoint is GET /users/me/points -> { points } (there is no
    // /points/balance route — that 404'd and the card never rendered).
    queryFn: () => apiClient.get<{ points: number }>(`${API_ROUTES.USERS}/me/points`),
    enabled: isAuthenticated,
  });

  const analysis = queryClient.getQueryData<AIAnalysisResult>(['profile-ai-analysis']);

  // Calculate profile completion (memoized to avoid recalculation on every render).
  // Also resolves the first incomplete section so "Complete profile" jumps the
  // user straight to what's missing instead of always dumping them on Basic Info.
  const calculateCompletion = useMemo(() => {
    if (!profile) return { percentage: 0, missing: [] as string[], nextRoute: '/profile/basic' };
    let completed = 0;
    const total = 7;
    const missing: string[] = [];
    let nextRoute: string | null = null;
    const mark = (ok: unknown, label: string, route: string) => {
      if (ok) {
        completed++;
      } else {
        missing.push(label);
        if (!nextRoute) nextRoute = route;
      }
    };

    mark(profile.grade, t('profile.fields.grade'), '/profile/basic');
    mark(profile.targetMajor, t('profile.fields.targetMajor'), '/profile/basic');
    mark(profile.gpa, t('profile.gpa'), '/profile/basic');
    mark(profile.testScores?.length, t('profile.testScores'), '/profile/scores');
    mark(profile.activities?.length, t('profile.activities'), '/profile/activities');
    mark(profile.awards?.length, t('profile.awards'), '/profile/awards');
    mark(profile.education?.length, t('profile.education'), '/profile/education');

    return {
      percentage: Math.round((completed / total) * 100),
      missing,
      nextRoute: nextRoute ?? '/profile/basic',
    };
  }, [profile, t]);

  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);

  const handleLogout = async () => {
    setLogoutDialogVisible(false);
    await logout();
    router.replace('/(auth)/login');
  };

  const { percentage: completion, missing: missingFields, nextRoute } = calculateCompletion;

  const menuItems = useMemo(
    () => [
      {
        icon: 'person-outline' as const,
        title: t('profile.basicInfo'),
        route: '/profile/basic',
      },
      {
        icon: 'school-outline' as const,
        title: t('profile.testScores'),
        route: '/profile/scores',
        badge: profile?.testScores?.length || 0,
      },
      {
        icon: 'trophy-outline' as const,
        title: t('profile.activities'),
        route: '/profile/activities',
        badge: profile?.activities?.length || 0,
      },
      {
        icon: 'medal-outline' as const,
        title: t('profile.awards'),
        route: '/profile/awards',
        badge: profile?.awards?.length || 0,
      },
      {
        icon: 'library-outline' as const,
        title: t('profile.education'),
        route: '/profile/education',
        badge: profile?.education?.length || 0,
      },
      {
        icon: 'document-text-outline' as const,
        title: t('profile.essays'),
        route: '/profile/essays',
        badge: profile?.essays?.length || 0,
      },
    ],
    [
      t,
      profile?.testScores?.length,
      profile?.activities?.length,
      profile?.awards?.length,
      profile?.education?.length,
      profile?.essays?.length,
    ]
  );

  const settingsItems = useMemo(
    () => [
      {
        icon: 'eye-outline' as const,
        title: t('profile.visibility'),
        value: t(`profile.visibilityOptions.${profile?.visibility?.toLowerCase() || 'private'}`),
      },
      {
        icon: 'language-outline' as const,
        title: t('settings.language'),
        route: '/settings/language',
      },
      {
        icon: 'moon-outline' as const,
        title: t('settings.theme'),
        route: '/settings/theme',
      },
      {
        icon: 'download-outline' as const,
        title: t('profile.exportData'),
        route: '/profile/export',
      },
    ],
    [t, profile?.visibility]
  );

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="person-circle-outline"
          title={t('errors.unauthorized')}
          description={t('home.loginPrompt')}
          action={{
            label: t('common.login'),
            onPress: () => router.push('/(auth)/login'),
          }}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Loading fullScreen />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Avatar source={null} name={user?.email} size="lg" style={styles.avatar} />
        <Text style={[styles.email, { color: colors.foreground }]} numberOfLines={2}>
          {user?.email}
        </Text>
        <View style={styles.roleBadge}>
          <Badge
            variant={
              user?.role === 'ADMIN' ? 'error' : user?.role === 'VERIFIED' ? 'success' : 'secondary'
            }
          >
            {user?.role}
          </Badge>
        </View>

        <View
          style={[
            styles.completionCard,
            {
              backgroundColor: withOpacity(colors.primary, 0.05),
              borderColor: colors.border,
            },
          ]}
        >
          <CircularProgress value={completion} size={96} strokeWidth={8} />
          <View style={styles.completionCopy}>
            <Text style={[styles.completionTitle, { color: colors.foreground }]}>
              {t('profile.profileComplete')}
            </Text>
            <Text style={[styles.completionSummary, { color: colors.foregroundMuted }]}>
              {completion === 100
                ? t('profile.completionReady')
                : t('profile.completionSummary', { percentage: completion })}
            </Text>
            {completion < 100 && missingFields.length > 0 && (
              <Text
                style={[styles.missingFields, { color: colors.foregroundMuted }]}
                numberOfLines={3}
              >
                {t('recommendation.missingFields', { fields: missingFields.join(', ') })}
              </Text>
            )}
            {completion < 100 && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push(nextRoute as Href)}
                style={styles.completeButton}
              >
                {t('profile.completeProfile')}
              </Button>
            )}
          </View>
        </View>

        {/* Verification Status */}
        {verificationData && (
          <View style={styles.verificationRow}>
            <View
              style={[
                styles.verifyBadge,
                {
                  backgroundColor: verificationData.emailVerified
                    ? withOpacity(colors.success, 0.1)
                    : withOpacity(colors.foregroundMuted, 0.1),
                },
              ]}
            >
              <Ionicons
                name={verificationData.emailVerified ? 'checkmark-circle' : 'close-circle'}
                size={14}
                color={verificationData.emailVerified ? colors.success : colors.foregroundMuted}
              />
              <Text
                style={[
                  styles.verifyText,
                  {
                    color: verificationData.emailVerified ? colors.success : colors.foregroundMuted,
                  },
                ]}
              >
                {t('profile.emailVerified')}
              </Text>
            </View>
            <View
              style={[
                styles.verifyBadge,
                {
                  backgroundColor: verificationData.identityVerified
                    ? withOpacity(colors.success, 0.1)
                    : withOpacity(colors.foregroundMuted, 0.1),
                },
              ]}
            >
              <Ionicons
                name={verificationData.identityVerified ? 'checkmark-circle' : 'close-circle'}
                size={14}
                color={verificationData.identityVerified ? colors.success : colors.foregroundMuted}
              />
              <Text
                style={[
                  styles.verifyText,
                  {
                    color: verificationData.identityVerified
                      ? colors.success
                      : colors.foregroundMuted,
                  },
                ]}
              >
                {t('profile.identityVerified')}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Points Balance */}
      {pointsData && (
        <TouchableOpacity
          onPress={() => router.push('/points')}
          style={[styles.pointsCard, { backgroundColor: withOpacity(colors.warning, 0.1) }]}
        >
          <Ionicons name="star" size={20} color={colors.warning} />
          <Text style={[styles.pointsValue, { color: colors.warning }]}>{pointsData.points}</Text>
          <Text style={[styles.pointsLabel, { color: colors.foregroundMuted }]}>
            {t('profile.points')}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.foregroundMuted}
            style={{ marginLeft: 'auto' }}
          />
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foregroundMuted }]}>
          {t('applicationAnalysis.title')}
        </Text>
        <Card
          onPress={() => router.push('/profile/analysis' as Href)}
          accessibilityLabel={t('applicationAnalysis.summaryCard.open')}
        >
          <CardHeader>
            <View style={styles.analysisHeader}>
              <View style={styles.analysisTitleBlock}>
                <CardTitle>{t('applicationAnalysis.summaryCard.title')}</CardTitle>
                <Text style={[styles.analysisSubtitle, { color: colors.foregroundMuted }]}>
                  {t('applicationAnalysis.summaryCard.subtitle')}
                </Text>
              </View>
              <Badge
                variant={
                  analysis?.status === 'degraded'
                    ? 'error'
                    : analysis?.status === 'cached'
                      ? 'secondary'
                      : 'success'
                }
              >
                {analysis
                  ? t(`applicationAnalysis.freshness.${analysis.status ?? 'fresh'}`)
                  : t('applicationAnalysis.summaryCard.open')}
              </Badge>
            </View>
          </CardHeader>
          <CardContent>
            {analysis ? (
              <>
                <View style={styles.analysisBadgeRow}>
                  <Badge variant="outline">
                    {t(`applicationAnalysis.states.${analysis.meta?.state ?? 'ready'}.label`)}
                  </Badge>
                  <Badge variant="secondary">
                    {t(
                      `applicationAnalysis.dataQuality.${analysis.meta?.dataQuality ?? 'insufficient'}`
                    )}
                  </Badge>
                </View>
                <Text style={[styles.analysisVerdict, { color: colors.foreground }]}>
                  {analysis.portfolioSummary.verdict}
                </Text>
                {analysis.meta?.degradedReason ? (
                  <Text style={[styles.analysisBody, { color: colors.foregroundMuted }]}>
                    {analysis.meta.degradedReason}
                  </Text>
                ) : null}
                <View
                  style={[
                    styles.analysisStats,
                    {
                      backgroundColor: withOpacity(colors.primary, 0.05),
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.analysisStatBlock}>
                    <Text style={[styles.analysisStatLabel, { color: colors.foregroundMuted }]}>
                      {t('applicationAnalysis.schoolCards.updated')}
                    </Text>
                    <Text style={[styles.analysisStatValue, { color: colors.foreground }]}>
                      {analysis.meta.generatedAt
                        ? new Date(analysis.meta.generatedAt).toLocaleDateString()
                        : '—'}
                    </Text>
                  </View>
                  <View style={[styles.analysisStatDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.analysisStatBlock}>
                    <Text style={[styles.analysisStatLabel, { color: colors.foregroundMuted }]}>
                      {t('applicationAnalysis.focusSchools')}
                    </Text>
                    <Text style={[styles.analysisStatValue, { color: colors.foreground }]}>
                      {analysis.schools.length}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={[styles.analysisBody, { color: colors.foregroundMuted }]}>
                {t('applicationAnalysis.empty.description')}
              </Text>
            )}
          </CardContent>
        </Card>
      </View>

      {/* Profile Sections */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foregroundMuted }]}>
          {t('profile.title')}
        </Text>
        <ListGroup>
          {menuItems.map((item, index) => (
            <ListItem
              key={index}
              title={item.title}
              leftIcon={item.icon}
              rightElement={
                item.badge !== undefined && item.badge > 0 ? (
                  <Badge variant="secondary">{item.badge}</Badge>
                ) : undefined
              }
              onPress={() => router.push(item.route as Href)}
            />
          ))}
        </ListGroup>
      </View>

      {/* Quick Links */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foregroundMuted }]}>
          {t('more.title')}
        </Text>
        <ListGroup>
          <ListItem
            title={t('more.resume')}
            leftIcon="document-outline"
            onPress={() => router.push('/resume' as Href)}
          />
          <ListItem
            title={t('more.vault')}
            leftIcon="lock-closed-outline"
            onPress={() => router.push('/vault' as Href)}
          />
          <ListItem
            title={t('more.verification')}
            leftIcon="shield-checkmark-outline"
            onPress={() => router.push('/verification' as Href)}
          />
          <ListItem
            title={t('more.points')}
            leftIcon="star-outline"
            onPress={() => router.push('/points' as Href)}
          />
        </ListGroup>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foregroundMuted }]}>
          {t('settings.title')}
        </Text>
        <ListGroup>
          {settingsItems.map((item, index) => (
            <ListItem
              key={index}
              title={item.title}
              leftIcon={item.icon}
              rightElement={
                item.value ? (
                  <Text style={{ color: colors.foregroundMuted }}>{item.value}</Text>
                ) : undefined
              }
              onPress={item.route ? () => router.push(item.route as Href) : undefined}
              showChevron={!!item.route}
            />
          ))}
        </ListGroup>
      </View>

      {/* Admin Panel (for admins) */}
      {user?.role === 'ADMIN' && (
        <View style={styles.section}>
          <ListGroup>
            <ListItem
              title={t('admin.title')}
              leftIcon="settings-outline"
              onPress={() => router.push('/admin')}
            />
          </ListGroup>
        </View>
      )}

      {/* Logout */}
      <View style={styles.section}>
        <Button
          variant="destructive"
          onPress={() => setLogoutDialogVisible(true)}
          leftIcon={<Ionicons name="log-out-outline" size={20} color="#fff" />}
        >
          {t('common.logout')}
        </Button>
      </View>

      <ConfirmDialog
        visible={logoutDialogVisible}
        onClose={() => setLogoutDialogVisible(false)}
        onConfirm={handleLogout}
        title={t('common.logout')}
        message={t('settings.logoutConfirm')}
        confirmText={t('common.logout')}
        variant="destructive"
        icon="log-out-outline"
      />

      {/* Version */}
      <View style={styles.footer}>
        <Text style={[styles.version, { color: colors.foregroundMuted }]}>
          {t('settings.version')} {Constants.expoConfig?.version || '1.0.0'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing['4xl'],
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: borderRadius['2xl'],
    borderBottomRightRadius: borderRadius['2xl'],
  },
  avatar: {
    marginBottom: spacing.md,
  },
  email: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  roleBadge: {
    marginBottom: spacing.lg,
  },
  completionCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  completionCopy: {
    flex: 1,
    minHeight: 96,
    justifyContent: 'center',
  },
  completionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  completionSummary: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  missingFields: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  completeButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  verificationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  verifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  verifyText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  pointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  pointsValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
  },
  pointsLabel: {
    fontSize: fontSize.sm,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  analysisTitleBlock: {
    flex: 1,
  },
  analysisSubtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  analysisBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  analysisVerdict: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  analysisBody: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  analysisStats: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  analysisStatBlock: {
    flex: 1,
  },
  analysisStatLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  analysisStatValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  analysisStatDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: spacing.md,
  },
  footer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  version: {
    fontSize: fontSize.sm,
  },
});

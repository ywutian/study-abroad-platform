import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Avatar,
  Badge,
  Loading,
  EmptyState,
  ConfirmDialog,
} from '@/components/ui';
import { ListItem, ListGroup, Separator } from '@/components/ui/ListItem';
import { CircularProgress } from '@/components/ui/Progress';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { Profile } from '@/types';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user, isAuthenticated, logout } = useAuthStore();

  const {
    data: profile,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<Profile>('/profile'),
    enabled: isAuthenticated,
  });

  // Calculate profile completion (memoized to avoid recalculation on every render)
  const calculateCompletion = useMemo(() => {
    if (!profile) return { percentage: 0, missing: [] as string[] };
    let completed = 0;
    const total = 7;
    const missing: string[] = [];

    if (profile.grade) completed++;
    else missing.push(t('profile.fields.grade'));
    if (profile.targetMajor) completed++;
    else missing.push(t('profile.fields.targetMajor'));
    if (profile.gpa) completed++;
    else missing.push(t('profile.gpa'));
    if (profile.testScores?.length > 0) completed++;
    else missing.push(t('profile.testScores'));
    if (profile.activities?.length > 0) completed++;
    else missing.push(t('profile.activities'));
    if (profile.awards?.length > 0) completed++;
    else missing.push(t('profile.awards'));
    if (profile.education?.length > 0) completed++;
    else missing.push(t('profile.education'));

    return { percentage: Math.round((completed / total) * 100), missing };
  }, [profile, t]);

  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);

  const handleLogout = async () => {
    setLogoutDialogVisible(false);
    await logout();
    router.replace('/(auth)/login');
  };

  const { percentage: completion, missing: missingFields } = calculateCompletion;

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
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Avatar source={null} name={user?.email} size="xl" style={styles.avatar} />
        <Text style={[styles.email, { color: colors.foreground }]}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Badge
            variant={
              user?.role === 'ADMIN' ? 'error' : user?.role === 'VERIFIED' ? 'success' : 'secondary'
            }
          >
            {user?.role}
          </Badge>
        </View>

        {/* Completion Ring */}
        <View style={styles.completionContainer}>
          <CircularProgress
            value={completion}
            size={100}
            strokeWidth={10}
            label={t('profile.profileComplete')}
          />
        </View>

        {completion < 100 && (
          <>
            {missingFields.length > 0 && (
              <Text style={[styles.missingFields, { color: colors.foregroundMuted }]}>
                {t('recommendation.missingFields', { fields: missingFields.join(', ') })}
              </Text>
            )}
            <Button
              variant="outline"
              size="sm"
              onPress={() => router.push('/profile/basic')}
              style={styles.completeButton}
            >
              {t('profile.completeProfile')}
            </Button>
          </>
        )}
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
          {t('settings.version')} 1.0.0
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    padding: spacing['2xl'],
    paddingBottom: spacing['3xl'],
    borderBottomLeftRadius: borderRadius['2xl'],
    borderBottomRightRadius: borderRadius['2xl'],
  },
  avatar: {
    marginBottom: spacing.lg,
  },
  email: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  roleBadge: {
    marginBottom: spacing.xl,
  },
  completionContainer: {
    marginBottom: spacing.lg,
  },
  missingFields: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    lineHeight: 18,
  },
  completeButton: {
    marginTop: spacing.md,
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
  footer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  version: {
    fontSize: fontSize.sm,
  },
});

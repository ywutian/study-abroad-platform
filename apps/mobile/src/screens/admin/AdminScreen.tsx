/**
 * Admin 管理后台 - Mobile 端
 *
 * 功能：用户管理、举报处理、数据统计、学校数据同步
 */

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedCard,
  AnimatedSkeleton,
  Avatar,
  Badge,
  Button,
  CardContent,
  EmptyState,
  Modal,
} from '@/components/ui';
import { Segment } from '@/components/ui/Tabs';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { useAuthStore } from '@/stores';
import { borderRadius, spacing, useColors } from '@/utils/theme';
import { adminRoutes } from '@study-abroad/shared';
import { styles } from './AdminScreen.styles';

// ==================== Types ====================

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalCases: number;
  pendingReports: number;
  totalReviews: number;
}

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail?: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED';
  createdAt: string;
  reporter: {
    id: string;
    email: string;
  };
}

interface User {
  id: string;
  email: string;
  role: 'USER' | 'VERIFIED' | 'ADMIN';
  emailVerified: boolean;
  createdAt: string;
  _count: {
    admissionCases: number;
    reviewsGiven: number;
  };
}

// ==================== Main Component ====================

export default function AdminScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'users'>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)/profile');
    }
  }, [isAdmin]);

  // ==================== Queries ====================

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => apiClient.get<AdminStats>(adminRoutes.stats()),
    enabled: isAdmin,
  });

  const {
    data: reportsData,
    isLoading: reportsLoading,
    refetch: refetchReports,
  } = useQuery({
    queryKey: qk.admin.reports(),
    queryFn: () =>
      apiClient.get<{ items: Report[]; total: number }>(adminRoutes.reports(), {
        params: { status: 'PENDING' },
      }),
    enabled: isAdmin,
  });

  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: qk.admin.users(userSearch),
    queryFn: () =>
      apiClient.get<{ items: User[]; total: number }>(adminRoutes.users(), {
        params: userSearch ? { search: userSearch } : {},
      }),
    enabled: isAdmin,
  });

  // ==================== Mutations ====================

  const updateReportMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.put(adminRoutes.reportById(id), {
        status,
        resolution: t('admin.dialogs.defaultResolution'),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.reports() });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setSelectedReport(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert(t('admin.errors.generic'), error.message);
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiClient.post(adminRoutes.userRoleAssign(userId), { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.usersAll });
      setSelectedUser(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert(t('admin.errors.generic'), error.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(adminRoutes.userById(userId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.usersAll });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setSelectedUser(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert(t('admin.errors.generic'), error.message);
    },
  });

  // ==================== Handlers ====================

  const onRefresh = useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchReports(), refetchUsers()]);
    setRefreshing(false);
  }, [isAdmin, refetchStats, refetchReports, refetchUsers]);

  if (!isAdmin) {
    return null;
  }

  const handleDeleteUser = (userId: string) => {
    Alert.alert(t('admin.dialogs.deleteConfirmTitle'), t('admin.dialogs.deleteConfirmDesc'), [
      { text: t('admin.dialogs.cancel'), style: 'cancel' },
      {
        text: t('admin.dialogs.delete'),
        style: 'destructive',
        onPress: () => deleteUserMutation.mutate(userId),
      },
    ]);
  };

  // ==================== Render Helpers ====================

  const renderStatCard = (
    title: string,
    value: number | string,
    icon: keyof typeof Ionicons.glyphMap,
    color: string,
    index: number
  ) => (
    <Animated.View
      key={title}
      entering={FadeInDown.delay(index * 100).springify()}
      style={styles.statCardWrapper}
    >
      <AnimatedCard style={styles.statCard}>
        <CardContent style={styles.statCardContent}>
          <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
          <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>{title}</Text>
        </CardContent>
      </AnimatedCard>
    </Animated.View>
  );

  const renderStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
      PENDING: 'warning',
      REVIEWED: 'secondary',
      RESOLVED: 'success',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {t(`admin.reports.${status.toLowerCase()}`)}
      </Badge>
    );
  };

  const renderRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'error'> = {
      ADMIN: 'error',
      VERIFIED: 'default',
      USER: 'secondary',
    };
    return <Badge variant={variants[role] || 'secondary'}>{t(`admin.roles.${role}`)}</Badge>;
  };

  // ==================== Tab Content ====================

  const renderOverview = () => (
    <View style={styles.statsGrid}>
      {statsLoading ? (
        <>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.statCardWrapper}>
              <AnimatedSkeleton height={120} borderRadius={borderRadius.lg} />
            </View>
          ))}
        </>
      ) : stats ? (
        <>
          {renderStatCard(
            t('admin.stats.totalUsers'),
            stats.totalUsers,
            'people-outline',
            colors.primary,
            0
          )}
          {renderStatCard(
            t('admin.stats.totalCases'),
            stats.totalCases,
            'document-text-outline',
            colors.info,
            1
          )}
          {renderStatCard(
            t('admin.stats.pendingReports'),
            stats.pendingReports,
            'warning-outline',
            colors.warning,
            2
          )}
          {renderStatCard(
            t('admin.stats.totalReviews'),
            stats.totalReviews,
            'star-outline',
            colors.success,
            3
          )}
        </>
      ) : null}
    </View>
  );

  const renderReports = () => (
    <View>
      {reportsLoading ? (
        <View style={styles.loadingContainer}>
          {[1, 2, 3].map((i) => (
            <AnimatedSkeleton key={i} height={100} style={{ marginBottom: spacing.md }} />
          ))}
        </View>
      ) : reportsData?.items?.length ? (
        reportsData.items.map((report, index) => (
          <Animated.View key={report.id} entering={FadeInRight.delay(index * 50)}>
            <AnimatedCard style={styles.reportCard} onPress={() => setSelectedReport(report)}>
              <CardContent>
                <View style={styles.reportHeader}>
                  {renderStatusBadge(report.status)}
                  <Badge variant="secondary">{report.targetType}</Badge>
                </View>
                <Text style={[styles.reportReason, { color: colors.foreground }]}>
                  {report.reason}
                </Text>
                {report.detail && (
                  <Text
                    style={[styles.reportDetail, { color: colors.foregroundMuted }]}
                    numberOfLines={2}
                  >
                    {report.detail}
                  </Text>
                )}
                <Text style={[styles.reportMeta, { color: colors.foregroundMuted }]}>
                  {t('admin.reports.reporter')}: {report.reporter.email}
                </Text>
              </CardContent>
            </AnimatedCard>
          </Animated.View>
        ))
      ) : (
        <EmptyState
          icon="checkmark-circle-outline"
          title={t('admin.reports.noReports')}
          description={t('admin.reports.noReportsDesc')}
        />
      )}
    </View>
  );

  const renderUsers = () => (
    <View>
      {/* Search */}
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: colors.input, borderColor: colors.inputBorder },
        ]}
      >
        <Ionicons name="search-outline" size={20} color={colors.placeholder} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder={t('admin.users.search')}
          placeholderTextColor={colors.placeholder}
          value={userSearch}
          onChangeText={setUserSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {userSearch ? (
          <TouchableOpacity onPress={() => setUserSearch('')}>
            <Ionicons name="close-circle" size={20} color={colors.foregroundMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* User List */}
      {usersLoading ? (
        <View style={styles.loadingContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <AnimatedSkeleton key={i} height={72} style={{ marginBottom: spacing.sm }} />
          ))}
        </View>
      ) : usersData?.items?.length ? (
        usersData.items.map((u, index) => (
          <Animated.View key={u.id} entering={FadeInRight.delay(index * 30)}>
            <AnimatedCard style={styles.userCard} onPress={() => setSelectedUser(u)}>
              <CardContent style={styles.userCardContent}>
                <Avatar name={u.email} size="default" />
                <View style={styles.userInfo}>
                  <Text style={[styles.userEmail, { color: colors.foreground }]} numberOfLines={1}>
                    {u.email}
                  </Text>
                  <View style={styles.userMeta}>
                    {renderRoleBadge(u.role)}
                    {u.emailVerified ? (
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    ) : (
                      <Ionicons name="close-circle" size={16} color={colors.warning} />
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.foregroundMuted} />
              </CardContent>
            </AnimatedCard>
          </Animated.View>
        ))
      ) : (
        <EmptyState
          icon="people-outline"
          title={t('admin.users.notFound')}
          description={t('admin.users.notFoundDesc')}
        />
      )}
    </View>
  );

  // ==================== Main Render ====================

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('admin.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Segment
            value={activeTab}
            onChange={(v) => setActiveTab(v as typeof activeTab)}
            segments={[
              { key: 'overview', label: t('admin.tabs.overview') },
              { key: 'reports', label: t('admin.tabs.reports') },
              { key: 'users', label: t('admin.tabs.users') },
            ]}
          />
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'users' && renderUsers()}
      </ScrollView>

      {/* Report Action Modal */}
      <Modal
        visible={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={t('admin.reports.handleReport')}
      >
        {selectedReport && (
          <View style={styles.modalContent}>
            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: colors.foregroundMuted }]}>
                {t('admin.reports.statusLabel')}
              </Text>
              {renderStatusBadge(selectedReport.status)}
            </View>
            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: colors.foregroundMuted }]}>
                {t('admin.reports.type')}
              </Text>
              <Badge variant="secondary">{selectedReport.targetType}</Badge>
            </View>
            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: colors.foregroundMuted }]}>
                {t('admin.reports.reason')}
              </Text>
              <Text style={[styles.modalValue, { color: colors.foreground }]}>
                {selectedReport.reason}
              </Text>
            </View>
            {selectedReport.detail && (
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: colors.foregroundMuted }]}>
                  {t('admin.reports.details')}
                </Text>
                <Text style={[styles.modalValue, { color: colors.foreground }]}>
                  {selectedReport.detail}
                </Text>
              </View>
            )}

            {selectedReport.status === 'PENDING' && (
              <View style={styles.modalActions}>
                <Button
                  variant="outline"
                  onPress={() =>
                    updateReportMutation.mutate({ id: selectedReport.id, status: 'REVIEWED' })
                  }
                  loading={updateReportMutation.isPending}
                  style={styles.modalButton}
                >
                  {t('admin.reports.markReviewed')}
                </Button>
                <Button
                  onPress={() =>
                    updateReportMutation.mutate({ id: selectedReport.id, status: 'RESOLVED' })
                  }
                  loading={updateReportMutation.isPending}
                  style={styles.modalButton}
                >
                  {t('admin.reports.markResolved')}
                </Button>
              </View>
            )}
          </View>
        )}
      </Modal>

      {/* User Action Modal */}
      <Modal
        visible={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={t('admin.userDetail.title')}
      >
        {selectedUser && (
          <View style={styles.modalContent}>
            <View style={styles.userModalHeader}>
              <Avatar name={selectedUser.email} size="lg" />
              <Text style={[styles.userModalEmail, { color: colors.foreground }]}>
                {selectedUser.email}
              </Text>
              <View style={styles.userModalBadges}>
                {renderRoleBadge(selectedUser.role)}
                {selectedUser.emailVerified ? (
                  <Badge variant="success">{t('admin.users.verified')}</Badge>
                ) : (
                  <Badge variant="warning">{t('admin.users.notVerified')}</Badge>
                )}
              </View>
            </View>

            <View style={styles.userModalStats}>
              <View style={styles.userModalStat}>
                <Text style={[styles.userModalStatValue, { color: colors.foreground }]}>
                  {selectedUser._count.admissionCases}
                </Text>
                <Text style={[styles.userModalStatLabel, { color: colors.foregroundMuted }]}>
                  {t('admin.users.cases')}
                </Text>
              </View>
              <View style={[styles.userModalStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.userModalStat}>
                <Text style={[styles.userModalStatValue, { color: colors.foreground }]}>
                  {selectedUser._count.reviewsGiven}
                </Text>
                <Text style={[styles.userModalStatLabel, { color: colors.foregroundMuted }]}>
                  {t('admin.users.reviews')}
                </Text>
              </View>
            </View>

            {selectedUser.role !== 'ADMIN' && (
              <View style={styles.modalActions}>
                {selectedUser.role !== 'VERIFIED' && (
                  <Button
                    variant="outline"
                    onPress={() =>
                      updateUserRoleMutation.mutate({ userId: selectedUser.id, role: 'VERIFIED' })
                    }
                    loading={updateUserRoleMutation.isPending}
                    style={styles.modalButton}
                    leftIcon={
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={18}
                        color={colors.foreground}
                      />
                    }
                  >
                    {t('admin.users.setVerified')}
                  </Button>
                )}
                {selectedUser.role === 'VERIFIED' && (
                  <Button
                    variant="outline"
                    onPress={() =>
                      updateUserRoleMutation.mutate({ userId: selectedUser.id, role: 'USER' })
                    }
                    loading={updateUserRoleMutation.isPending}
                    style={styles.modalButton}
                    leftIcon={
                      <Ionicons name="person-outline" size={18} color={colors.foreground} />
                    }
                  >
                    {t('admin.users.setUser')}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onPress={() => handleDeleteUser(selectedUser.id)}
                  loading={deleteUserMutation.isPending}
                  style={styles.modalButton}
                  leftIcon={<Ionicons name="trash-outline" size={18} color="#fff" />}
                >
                  {t('admin.users.delete')}
                </Button>
              </View>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

// ==================== Styles ====================

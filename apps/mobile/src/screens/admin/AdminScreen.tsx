/**
 * Admin 管理后台 - Mobile 端
 * 
 * 功能：用户管理、举报处理、数据统计、学校数据同步
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  AnimatedCard,
  CardContent,
  Badge,
  Button,
  EmptyState,
  AnimatedSkeleton,
  Modal,
  Tabs,
  Avatar,
} from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

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

  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'users'>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Redirect if not admin
  if (user?.role !== 'ADMIN') {
    router.replace('/(tabs)/profile');
    return null;
  }

  // ==================== Queries ====================

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => apiClient.get<AdminStats>('/admin/stats'),
  });

  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ['adminReports'],
    queryFn: () => apiClient.get<{ data: Report[]; total: number }>('/admin/reports', {
      params: { status: 'PENDING' },
    }),
  });

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['adminUsers', userSearch],
    queryFn: () => apiClient.get<{ data: User[]; total: number }>('/admin/users', {
      params: userSearch ? { search: userSearch } : {},
    }),
  });

  // ==================== Mutations ====================

  const updateReportMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.put(`/admin/reports/${id}`, { status, resolution: '管理员已处理' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setSelectedReport(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('错误', error.message);
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiClient.put(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setSelectedUser(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('错误', error.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setSelectedUser(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert('错误', error.message);
    },
  });

  // ==================== Handlers ====================

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchReports(), refetchUsers()]);
    setRefreshing(false);
  }, [refetchStats, refetchReports, refetchUsers]);

  const handleDeleteUser = (userId: string) => {
    Alert.alert(
      '确认删除',
      '此操作将软删除该用户，用户数据将被保留但无法登录。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => deleteUserMutation.mutate(userId),
        },
      ]
    );
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
    const labels: Record<string, string> = {
      PENDING: '待处理',
      REVIEWED: '已审核',
      RESOLVED: '已解决',
    };
    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
  };

  const renderRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'error'> = {
      ADMIN: 'error',
      VERIFIED: 'default',
      USER: 'secondary',
    };
    const labels: Record<string, string> = {
      ADMIN: '管理员',
      VERIFIED: '已认证',
      USER: '普通用户',
    };
    return <Badge variant={variants[role] || 'secondary'}>{labels[role] || role}</Badge>;
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
          {renderStatCard('总用户', stats.totalUsers, 'people-outline', colors.primary, 0)}
          {renderStatCard('录取案例', stats.totalCases, 'document-text-outline', colors.info, 1)}
          {renderStatCard('待处理举报', stats.pendingReports, 'warning-outline', colors.warning, 2)}
          {renderStatCard('评价数量', stats.totalReviews, 'star-outline', colors.success, 3)}
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
      ) : reportsData?.data?.length ? (
        reportsData.data.map((report, index) => (
          <Animated.View key={report.id} entering={FadeInRight.delay(index * 50)}>
            <AnimatedCard
              style={styles.reportCard}
              onPress={() => setSelectedReport(report)}
            >
              <CardContent>
                <View style={styles.reportHeader}>
                  {renderStatusBadge(report.status)}
                  <Badge variant="secondary">{report.targetType}</Badge>
                </View>
                <Text style={[styles.reportReason, { color: colors.foreground }]}>
                  {report.reason}
                </Text>
                {report.detail && (
                  <Text style={[styles.reportDetail, { color: colors.foregroundMuted }]} numberOfLines={2}>
                    {report.detail}
                  </Text>
                )}
                <Text style={[styles.reportMeta, { color: colors.foregroundMuted }]}>
                  举报人: {report.reporter.email}
                </Text>
              </CardContent>
            </AnimatedCard>
          </Animated.View>
        ))
      ) : (
        <EmptyState
          icon="checkmark-circle-outline"
          title="暂无待处理举报"
          description="所有举报已处理完毕"
        />
      )}
    </View>
  );

  const renderUsers = () => (
    <View>
      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}>
        <Ionicons name="search-outline" size={20} color={colors.placeholder} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="搜索用户邮箱..."
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
      ) : usersData?.data?.length ? (
        usersData.data.map((u, index) => (
          <Animated.View key={u.id} entering={FadeInRight.delay(index * 30)}>
            <AnimatedCard
              style={styles.userCard}
              onPress={() => setSelectedUser(u)}
            >
              <CardContent style={styles.userCardContent}>
                <Avatar name={u.email} size="md" />
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
          title="未找到用户"
          description="尝试其他搜索条件"
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>管理后台</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            items={[
              { value: 'overview', label: '概览', icon: 'stats-chart-outline' },
              {
                value: 'reports',
                label: '举报',
                icon: 'warning-outline',
                badge: stats?.pendingReports,
              },
              { value: 'users', label: '用户', icon: 'people-outline' },
            ]}
          />
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
        title="处理举报"
      >
        {selectedReport && (
          <View style={styles.modalContent}>
            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: colors.foregroundMuted }]}>状态</Text>
              {renderStatusBadge(selectedReport.status)}
            </View>
            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: colors.foregroundMuted }]}>类型</Text>
              <Badge variant="secondary">{selectedReport.targetType}</Badge>
            </View>
            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: colors.foregroundMuted }]}>原因</Text>
              <Text style={[styles.modalValue, { color: colors.foreground }]}>
                {selectedReport.reason}
              </Text>
            </View>
            {selectedReport.detail && (
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: colors.foregroundMuted }]}>详情</Text>
                <Text style={[styles.modalValue, { color: colors.foreground }]}>
                  {selectedReport.detail}
                </Text>
              </View>
            )}

            {selectedReport.status === 'PENDING' && (
              <View style={styles.modalActions}>
                <Button
                  variant="outline"
                  onPress={() => updateReportMutation.mutate({ id: selectedReport.id, status: 'REVIEWED' })}
                  loading={updateReportMutation.isPending}
                  style={styles.modalButton}
                >
                  标记已审核
                </Button>
                <Button
                  onPress={() => updateReportMutation.mutate({ id: selectedReport.id, status: 'RESOLVED' })}
                  loading={updateReportMutation.isPending}
                  style={styles.modalButton}
                >
                  标记已解决
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
        title="用户详情"
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
                  <Badge variant="success">已验证</Badge>
                ) : (
                  <Badge variant="warning">未验证</Badge>
                )}
              </View>
            </View>

            <View style={styles.userModalStats}>
              <View style={styles.userModalStat}>
                <Text style={[styles.userModalStatValue, { color: colors.foreground }]}>
                  {selectedUser._count.admissionCases}
                </Text>
                <Text style={[styles.userModalStatLabel, { color: colors.foregroundMuted }]}>
                  案例
                </Text>
              </View>
              <View style={[styles.userModalStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.userModalStat}>
                <Text style={[styles.userModalStatValue, { color: colors.foreground }]}>
                  {selectedUser._count.reviewsGiven}
                </Text>
                <Text style={[styles.userModalStatLabel, { color: colors.foregroundMuted }]}>
                  评价
                </Text>
              </View>
            </View>

            {selectedUser.role !== 'ADMIN' && (
              <View style={styles.modalActions}>
                {selectedUser.role !== 'VERIFIED' && (
                  <Button
                    variant="outline"
                    onPress={() => updateUserRoleMutation.mutate({ userId: selectedUser.id, role: 'VERIFIED' })}
                    loading={updateUserRoleMutation.isPending}
                    style={styles.modalButton}
                    leftIcon={<Ionicons name="checkmark-circle-outline" size={18} color={colors.foreground} />}
                  >
                    设为已认证
                  </Button>
                )}
                {selectedUser.role === 'VERIFIED' && (
                  <Button
                    variant="outline"
                    onPress={() => updateUserRoleMutation.mutate({ userId: selectedUser.id, role: 'USER' })}
                    loading={updateUserRoleMutation.isPending}
                    style={styles.modalButton}
                    leftIcon={<Ionicons name="person-outline" size={18} color={colors.foreground} />}
                  >
                    设为普通用户
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onPress={() => handleDeleteUser(selectedUser.id)}
                  loading={deleteUserMutation.isPending}
                  style={styles.modalButton}
                  leftIcon={<Ionicons name="trash-outline" size={18} color="#fff" />}
                >
                  删除用户
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  headerRight: {
    width: 40,
  },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  
  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  statCardWrapper: {
    width: '50%',
    padding: spacing.xs,
  },
  statCard: {
    height: 120,
  },
  statCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  // Reports
  reportCard: {
    marginBottom: spacing.md,
  },
  reportHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  reportReason: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  reportDetail: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  reportMeta: {
    fontSize: fontSize.xs,
  },

  // Users
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    paddingVertical: spacing.xs,
  },
  userCard: {
    marginBottom: spacing.sm,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Loading
  loadingContainer: {
    marginTop: spacing.md,
  },

  // Modal
  modalContent: {
    paddingTop: spacing.md,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  modalLabel: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  modalValue: {
    fontSize: fontSize.sm,
    flex: 2,
    textAlign: 'right',
  },
  modalActions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  modalButton: {
    width: '100%',
  },

  // User Modal
  userModalHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  userModalEmail: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  userModalBadges: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  userModalStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  userModalStat: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  userModalStatValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  userModalStatLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  userModalStatDivider: {
    width: 1,
    height: 40,
  },
});



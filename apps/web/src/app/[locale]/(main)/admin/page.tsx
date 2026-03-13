'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/loading-state';
import { apiClient } from '@/lib/api';
import { Shield } from 'lucide-react';
import { AdminStatsCards } from './_components/admin-stats-cards';
import { AdminChartSection } from './_components/admin-chart-section';
import { AdminHealthIndicator } from './_components/admin-health-indicator';
import { AdminRecentActivity } from './_components/admin-recent-activity';

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalCases: number;
  pendingReports: number;
  totalReviews: number;
  newUsersToday?: number;
  activeUsersToday?: number;
  bannedUsers?: number;
  totalRevenue?: number;
  monthlyRevenue?: number;
  totalPosts?: number;
  pendingVerifications?: number;
  subscriptionDistribution?: Record<string, number>;
}

interface TrendData {
  date: string;
  newUsers: number;
  payments: number;
  revenue: number;
  posts: number;
}

export default function AdminOverviewPage() {
  const t = useTranslations('admin');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => apiClient.get<AdminStats>('/admin/stats'),
  });

  const { data: trends } = useQuery({
    queryKey: ['adminTrends'],
    queryFn: () => apiClient.get<TrendData[]>('/admin/stats/trends'),
  });

  const { data: health } = useQuery({
    queryKey: ['adminHealth'],
    queryFn: () =>
      apiClient.get<{
        status: string;
        components: Record<string, { status: string; details?: any }>;
      }>('/admin/ai-agent/health'),
    refetchInterval: 30000,
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['adminRecentActivity'],
    queryFn: () =>
      apiClient.get<{
        data: Array<{
          id: string;
          action: string;
          resource: string;
          details?: string;
          createdAt: string;
          admin?: { displayName?: string };
        }>;
      }>('/admin/audit-logs', { params: { pageSize: '8' } }),
  });

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} icon={Shield} color="violet" />

      {/* Stats cards */}
      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : stats ? (
        <div className="space-y-6 mt-6">
          <AdminStatsCards stats={stats} />

          {/* Trends */}
          {trends && trends.length > 0 && <AdminChartSection trends={trends} />}

          {/* Health + Recent Activity */}
          <div className="grid gap-4 lg:grid-cols-2">
            <AdminHealthIndicator health={health} />
            <AdminRecentActivity recentActivity={recentActivity} />
          </div>
        </div>
      ) : null}
    </>
  );
}

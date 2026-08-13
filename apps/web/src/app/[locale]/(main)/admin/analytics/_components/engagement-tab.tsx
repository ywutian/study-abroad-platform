'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { Users, FileText, CreditCard, DollarSign } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TrendData {
  date: string;
  newUsers: number;
  payments: number;
  revenue: number;
  posts: number;
}

export function EngagementTab() {
  const t = useTranslations('admin.analytics');

  const { data: trends } = useQuery({
    queryKey: ['adminTrends'],
    queryFn: () => apiClient.get<TrendData[]>(adminRoutes.statsTrends()),
  });

  const data = trends || [];
  const totals = data.reduce(
    (acc, d) => ({
      newUsers: acc.newUsers + d.newUsers,
      posts: acc.posts + d.posts,
      payments: acc.payments + d.payments,
      revenue: acc.revenue + (Number(d.revenue) || 0),
    }),
    { newUsers: 0, posts: 0, payments: 0, revenue: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {t('engagement.totalNewUsers')}
            </div>
            <p className="text-2xl font-bold mt-1">{totals.newUsers.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              {t('engagement.totalPosts')}
            </div>
            <p className="text-2xl font-bold mt-1">{totals.posts.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              {t('engagement.totalPayments')}
            </div>
            <p className="text-2xl font-bold mt-1">{totals.payments.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              {t('engagement.totalRevenue')}
            </div>
            <p className="text-2xl font-bold mt-1">${totals.revenue.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* User registration trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-body">{t('engagement.userTrend')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillNewUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillEngPosts" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--chart-3, 47 96% 53%))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--chart-3, 47 96% 53%))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => v.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                      color: 'hsl(var(--popover-foreground))',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="newUsers"
                    name={t('engagement.newUsers')}
                    stroke="hsl(var(--primary))"
                    fill="url(#fillNewUsers)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="posts"
                    name={t('engagement.posts')}
                    stroke="hsl(var(--chart-3, 47 96% 53%))"
                    fill="url(#fillEngPosts)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('engagement.noData')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

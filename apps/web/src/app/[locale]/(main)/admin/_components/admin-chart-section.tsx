'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
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

interface AdminChartSectionProps {
  trends: TrendData[];
}

export function AdminChartSection({ trends }: AdminChartSectionProps) {
  const t = useTranslations('admin');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('dashboard.trends')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{t('dashboard.newUsers')}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {trends.reduce((sum, d) => sum + d.newUsers, 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{t('dashboard.revenue')}</p>
                <p className="text-2xl font-bold text-emerald-600">
                  ${trends.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0).toFixed(0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{t('dashboard.posts')}</p>
                <p className="text-2xl font-bold text-violet-600">
                  {trends.reduce((sum, d) => sum + d.posts, 0)}
                </p>
              </div>
            </div>
            <div className="h-[200px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trends.slice(-30)}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillPosts" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--chart-2, 142 71% 45%))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--chart-2, 142 71% 45%))"
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
                    name={t('dashboard.newUsers')}
                    stroke="hsl(var(--primary))"
                    fill="url(#fillUsers)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="posts"
                    name={t('dashboard.posts')}
                    stroke="hsl(var(--chart-2, 142 71% 45%))"
                    fill="url(#fillPosts)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

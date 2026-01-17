'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { User, FileText, GraduationCap, Target, Users, Coins } from 'lucide-react';

interface DashboardStatsProps {
  data: {
    profile: {
      completeness: number;
      targetSchoolCount: number;
      essayCount: number;
    };
    stats: {
      followers: number;
      following: number;
      cases: number;
      predictions: number;
    };
    user: {
      points: number;
      role: string;
    };
  };
  className?: string;
}

export function DashboardStats({ data, className }: DashboardStatsProps) {
  const t = useTranslations('dashboard');
  const format = useFormatter();

  const stats = [
    {
      label: t('stats.profileCompletion'),
      value: `${data.profile.completeness}%`,
      icon: User,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      progress: data.profile.completeness,
    },
    {
      label: t('stats.essayCount'),
      value: data.profile.essayCount.toString(),
      icon: FileText,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: t('stats.targetSchools'),
      value: data.profile.targetSchoolCount.toString(),
      icon: GraduationCap,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: t('stats.predictions'),
      value: data.stats.predictions.toString(),
      icon: Target,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
    },
    {
      label: t('stats.followers'),
      value: data.stats.followers.toString(),
      icon: Users,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
    {
      label: t('stats.points'),
      value: format.number(data.user.points, 'standard'),
      icon: Coins,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      badge: data.user.role === 'VERIFIED' ? t('stats.verified') : undefined,
    },
  ];

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4', className)}>
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <stat.icon className={cn('h-4 w-4', stat.color)} />
                </div>
                {stat.badge && (
                  <Badge variant="success" className="text-2xs px-1.5 py-0">
                    {stat.badge}
                  </Badge>
                )}
              </div>

              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>

              {stat.progress !== undefined && (
                <Progress value={stat.progress} className="h-1 mt-2" />
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

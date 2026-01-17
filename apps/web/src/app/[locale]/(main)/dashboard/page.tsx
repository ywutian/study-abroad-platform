'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { motion } from 'framer-motion';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Search,
  FileCheck,
  Star,
  MessageCircle,
  ArrowRight,
  User,
  GraduationCap,
  ListChecks,
  Bell,
  TrendingUp,
} from 'lucide-react';

interface Profile {
  id: string;
  realName?: string;
  gpa?: number;
  grade?: string;
  testScores: Array<{ type: string; score: number }>;
  activities: Array<{ id: string; name: string }>;
  awards: Array<{ id: string; name: string }>;
}

interface SchoolListItem {
  id: string;
  schoolId: string;
  tier: 'SAFETY' | 'TARGET' | 'REACH';
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
    acceptanceRate?: number;
  };
  isAIRecommended: boolean;
}

// 4 Main modules configuration
const mainModules = [
  {
    id: 'find-college',
    href: '/find-college',
    icon: Search,
    titleKey: 'dashboard.modules.findCollege',
    descKey: 'dashboard.modules.findCollegeDesc',
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
  },
  {
    id: 'uncommon-app',
    href: '/uncommon-app',
    icon: FileCheck,
    titleKey: 'dashboard.modules.uncommonApp',
    descKey: 'dashboard.modules.uncommonAppDesc',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
  },
  {
    id: 'feature-hall',
    href: '/hall',
    icon: Star,
    titleKey: 'dashboard.modules.featureHall',
    descKey: 'dashboard.modules.featureHallDesc',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
  },
  {
    id: 'forum',
    href: '/forum',
    icon: MessageCircle,
    titleKey: 'dashboard.modules.forum',
    descKey: 'dashboard.modules.forumDesc',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
  },
];

export default function DashboardPage() {
  const t = useTranslations();

  // Fetch user profile for quick stats
  const { data: profile } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiClient.get<Profile>('/profiles/me'),
  });

  // Fetch school list count
  const { data: schoolList } = useQuery({
    queryKey: ['school-list'],
    queryFn: () => apiClient.get<SchoolListItem[]>('/school-lists'),
  });

  // Calculate profile completion
  const profileCompletion = profile ? calculateProfileCompletion(profile) : 0;
  const schoolCount = schoolList?.length || 0;

  return (
    <PageContainer>
      <div className="space-y-8">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-title">
              {t('dashboard.welcome', { name: profile?.realName || t('dashboard.user') })}
            </h1>
            <p className="text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
          </div>
          <Link href="/profile">
            <Button variant="outline" size="sm">
              <User className="w-4 h-4 mr-2" />
              {t('dashboard.editProfile')}
            </Button>
          </Link>
        </motion.div>

        {/* Quick Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {/* Profile Completion */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.stats.profileCompletion')}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={profileCompletion} className="flex-1 h-2" />
                    <span className="text-sm font-medium">{profileCompletion}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* School List Count */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('dashboard.stats.schoolList')}</p>
                  <p className="text-2xl font-bold">{schoolCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <ListChecks className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.stats.pendingTasks')}
                  </p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Score */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.stats.profileScore')}
                  </p>
                  <p className="text-2xl font-bold">--</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 4 Main Module Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-body-lg font-semibold mb-4">{t('dashboard.quickAccess')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mainModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <Link href={module.href}>
                    <Card className="group h-full transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-primary/30 cursor-pointer">
                      {/* Gradient top border on hover */}
                      <div
                        className={cn(
                          'absolute top-0 left-0 right-0 h-1 rounded-t-lg bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity',
                          module.color
                        )}
                      />

                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div
                            className={cn(
                              'w-12 h-12 rounded-lg flex items-center justify-center shrink-0',
                              module.bgColor
                            )}
                          >
                            <Icon className={cn('w-6 h-6', module.iconColor)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold group-hover:text-primary transition-colors">
                              {t(module.titleKey)}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {t(module.descKey)}
                            </p>
                          </div>
                        </div>

                        {/* Arrow indicator */}
                        <div className="mt-4 flex items-center justify-end text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>{t('common.enter')}</span>
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Activity (placeholder) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {t('dashboard.recentActivity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>{t('dashboard.noRecentActivity')}</p>
                <Link href="/find-college">
                  <Button variant="link" className="mt-2">
                    {t('dashboard.startExploring')}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PageContainer>
  );
}

// Helper function to calculate profile completion percentage
function calculateProfileCompletion(profile: any): number {
  let completed = 0;
  const fields = [
    profile?.realName,
    profile?.gpa,
    profile?.targetMajor,
    profile?.bio,
    profile?.testScores?.length > 0,
    profile?.activities?.length > 0,
    profile?.awards?.length > 0,
    profile?.education?.length > 0,
  ];

  fields.forEach((field) => {
    if (field) completed++;
  });

  return Math.round((completed / fields.length) * 100);
}

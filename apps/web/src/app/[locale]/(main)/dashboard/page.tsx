'use client';

/**
 * 用户仪表盘 - 整合所有功能入口
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '@/lib/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/layout/page-header';
import { OnboardingGuide } from '@/components/features';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { 
  User, FileText, GraduationCap, Target, BookOpen, 
  MessageSquare, Building2, Calendar, Compass, Users,
  Gamepad2, Brain, Trophy, Lock, ArrowRight,
  TrendingUp, Clock, CheckCircle2, Sparkles, Star,
  BarChart3, Zap, Flame, Award
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 功能卡片组件
function FeatureCard({ 
  title, 
  description, 
  href, 
  icon: Icon, 
  color, 
  isNew,
  stats,
  progress,
  index,
  t
}: {
  title: string;
  description: string;
  href: string;
  icon: any;
  color: string;
  isNew?: boolean;
  stats?: { label: string; value: string }[];
  progress?: number;
  index: number;
  t: (key: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={href}>
        <Card className={cn(
          "group relative overflow-hidden transition-all duration-300",
          "hover:shadow-lg hover:-translate-y-1 hover:border-primary/30",
          "bg-card/50 backdrop-blur-sm border-border/50"
        )}>
          {/* 渐变背景 */}
          <div className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            color
          )} />
          
          <CardContent className="relative p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={cn(
                "p-2.5 rounded-xl transition-all duration-300",
                "bg-primary/10 group-hover:bg-white/20 group-hover:scale-110"
              )}>
                <Icon className="h-5 w-5 text-primary group-hover:text-white" />
              </div>
              {isNew && (
                <Badge variant="secondary" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs border-0">
                  NEW
                </Badge>
              )}
            </div>
            
            <h3 className="font-semibold text-foreground group-hover:text-white mb-1 transition-colors">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground group-hover:text-white/80 line-clamp-2 mb-3 transition-colors">
              {description}
            </p>
            
            {/* 统计数据 */}
            {stats && stats.length > 0 && (
              <div className="flex gap-3 mb-3">
                {stats.map((stat, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-bold text-primary group-hover:text-white">{stat.value}</span>
                    <span className="text-muted-foreground group-hover:text-white/70 ml-1">{stat.label}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* 进度条 */}
            {progress !== undefined && (
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground group-hover:text-white/70">{t('progress')}</span>
                  <span className="font-medium text-primary group-hover:text-white">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}
            
            {/* 操作提示 */}
            <div className="flex items-center text-xs text-primary group-hover:text-white mt-2">
              <span>{t('enter')}</span>
              <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-1" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

// 快捷操作卡片
function QuickActionCard({
  title,
  description,
  href,
  icon: Icon,
  gradient,
  index
}: {
  title: string;
  description: string;
  href: string;
  icon: any;
  gradient: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 + index * 0.1 }}
    >
      <Link href={href}>
        <div className={cn(
          "relative overflow-hidden rounded-2xl p-6 text-white transition-all duration-300",
          "hover:shadow-xl hover:-translate-y-1",
          gradient
        )}>
          {/* 背景装饰 */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            <Icon className="h-8 w-8 mb-3 opacity-90" />
            <h3 className="font-bold text-lg mb-1">{title}</h3>
            <p className="text-sm text-white/80">{description}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// 统计卡片
function StatCard({
  label,
  value,
  change,
  icon: Icon,
  index
}: {
  label: string;
  value: string;
  change?: string;
  icon: any;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            {change && (
              <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-500 border-0">
                {change}
              </Badge>
            )}
          </div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const t = useTranslations();
  const { user } = useAuthStore();
  const isAuthenticated = !!user;
  const [greeting, setGreeting] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(true);

  // 获取用户档案完成度
  const { data: profileData } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiClient.get<any>('/profiles/me'),
    enabled: isAuthenticated,
  });

  // 计算档案完成度
  const profileProgress = profileData?.data ? calculateProfileProgress(profileData.data) : 0;
  const hasTargetSchools = (profileData?.data?.targetSchools?.length || 0) > 0;
  const isNewUser = profileProgress < 60 && !hasTargetSchools;

  function calculateProfileProgress(profile: any): number {
    let score = 0;
    const fields = [
      { key: 'firstName', weight: 10 },
      { key: 'lastName', weight: 10 },
      { key: 'gender', weight: 5 },
      { key: 'birthdate', weight: 5 },
      { key: 'school', weight: 10 },
      { key: 'gpa', weight: 15 },
      { key: 'scores', weight: 20, isArray: true },
      { key: 'activities', weight: 15, isArray: true },
      { key: 'awards', weight: 10, isArray: true },
    ];
    
    for (const field of fields) {
      if (field.isArray) {
        if (profile[field.key]?.length > 0) score += field.weight;
      } else {
        if (profile[field.key]) score += field.weight;
      }
    }
    return Math.min(100, score);
  }

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting(t('dashboard.greetingMorning'));
    } else if (hour < 18) {
      setGreeting(t('dashboard.greetingAfternoon'));
    } else {
      setGreeting(t('dashboard.greetingEvening'));
    }
  }, [t]);

  // 核心功能
  const coreFeatures = [
    { 
      title: t('nav.profile'), 
      description: t('dashboard.features.profileDesc'),
      href: '/profile',
      icon: User,
      color: 'bg-gradient-to-br from-violet-500/20 to-purple-500/20',
      progress: 65
    },
    { 
      title: t('nav.essays'), 
      description: t('dashboard.features.essaysDesc'),
      href: '/essays',
      icon: FileText,
      color: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20',
      stats: [{ label: t('dashboard.stats.essays'), value: '3' }]
    },
    { 
      title: t('nav.timeline'), 
      description: t('dashboard.features.timelineDesc'),
      href: '/timeline',
      icon: Calendar,
      color: 'bg-gradient-to-br from-amber-500/20 to-orange-500/20',
      isNew: true,
      stats: [{ label: t('dashboard.stats.todos'), value: '5' }]
    },
    { 
      title: t('nav.recommendation'), 
      description: t('dashboard.features.recommendationDesc'),
      href: '/recommendation',
      icon: Compass,
      color: 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20',
      isNew: true
    },
  ];

  // AI与工具功能
  const aiFeatures = [
    { 
      title: t('nav.prediction'), 
      description: t('dashboard.features.predictionDesc'),
      href: '/prediction',
      icon: Target,
      color: 'bg-gradient-to-br from-red-500/20 to-rose-500/20'
    },
    { 
      title: t('nav.schools'), 
      description: t('dashboard.features.schoolsDesc'),
      href: '/schools',
      icon: GraduationCap,
      color: 'bg-gradient-to-br from-indigo-500/20 to-violet-500/20'
    },
    { 
      title: t('nav.ranking'), 
      description: t('dashboard.features.rankingDesc'),
      href: '/ranking',
      icon: BarChart3,
      color: 'bg-gradient-to-br from-sky-500/20 to-blue-500/20'
    },
    { 
      title: t('nav.assessment'), 
      description: t('dashboard.features.assessmentDesc'),
      href: '/assessment',
      icon: Brain,
      color: 'bg-gradient-to-br from-pink-500/20 to-rose-500/20',
      isNew: true
    },
  ];

  // 社区功能
  const communityFeatures = [
    { 
      title: t('nav.cases'), 
      description: t('dashboard.features.casesDesc'),
      href: '/cases',
      icon: BookOpen,
      color: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20'
    },
    { 
      title: t('nav.forum'), 
      description: t('dashboard.features.forumDesc'),
      href: '/forum',
      icon: Users,
      color: 'bg-gradient-to-br from-orange-500/20 to-amber-500/20',
      isNew: true
    },
    { 
      title: t('nav.swipe'), 
      description: t('dashboard.features.swipeDesc'),
      href: '/swipe',
      icon: Gamepad2,
      color: 'bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20',
      isNew: true
    },
    { 
      title: t('nav.verifiedRanking'), 
      description: t('dashboard.features.verifiedRankingDesc'),
      href: '/verified-ranking',
      icon: Trophy,
      color: 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20',
      isNew: true
    },
  ];

  // 其他功能
  const otherFeatures = [
    { 
      title: t('nav.chat'), 
      description: t('dashboard.features.chatDesc'),
      href: '/chat',
      icon: MessageSquare,
      color: 'bg-gradient-to-br from-purple-500/20 to-violet-500/20'
    },
    { 
      title: t('nav.hall'), 
      description: t('dashboard.features.hallDesc'),
      href: '/hall',
      icon: Building2,
      color: 'bg-gradient-to-br from-slate-500/20 to-gray-500/20'
    },
    { 
      title: t('nav.vault'), 
      description: t('dashboard.features.vaultDesc'),
      href: '/vault',
      icon: Lock,
      color: 'bg-gradient-to-br from-zinc-500/20 to-neutral-500/20',
      isNew: true
    },
  ];

  // 快捷操作
  const quickActions = [
    {
      title: t('dashboard.quickActions.startPrediction'),
      description: t('dashboard.quickActions.startPredictionDesc'),
      href: '/prediction',
      icon: Zap,
      gradient: 'bg-gradient-to-br from-blue-500 to-cyan-500'
    },
    {
      title: t('dashboard.quickActions.aiEssay'),
      description: t('dashboard.quickActions.aiEssayDesc'),
      href: '/essays',
      icon: Sparkles,
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-500'
    },
    {
      title: t('dashboard.quickActions.playGame'),
      description: t('dashboard.quickActions.playGameDesc'),
      href: '/swipe',
      icon: Flame,
      gradient: 'bg-gradient-to-br from-orange-500 to-red-500'
    },
  ];

  // 统计数据
  const stats = [
    { label: t('dashboard.stats.profileComplete'), value: '65%', icon: User, change: '+5%' },
    { label: t('dashboard.stats.essaysWritten'), value: '3', icon: FileText },
    { label: t('dashboard.stats.schoolsAdded'), value: '8', icon: GraduationCap, change: '+2' },
    { label: t('dashboard.stats.predictionsMade'), value: '12', icon: Target },
  ];

  return (
    <div className="min-h-screen pb-16">
      <PageHeader
        title={t('dashboard.title')}
        description={`${greeting}${user?.email ? `, ${user.email.split('@')[0]}` : ''}`}
        color="blue"
      />

      <div className="container mx-auto px-4 -mt-8 relative z-10">
        {/* 新用户引导 */}
        {isAuthenticated && isNewUser && showOnboarding && (
          <OnboardingGuide
            profileProgress={profileProgress}
            hasSchools={hasTargetSchools}
            hasPredictions={false}
            onDismiss={() => setShowOnboarding(false)}
          />
        )}

        {/* 快捷操作 */}
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <QuickActionCard key={action.href} {...action} index={index} />
            ))}
          </div>
        </section>

        {/* 统计概览 */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t('dashboard.statsOverview')}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <StatCard key={stat.label} {...stat} index={index} />
            ))}
          </div>
        </section>

        {/* 核心功能 */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Star className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t('dashboard.coreFeatures')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {coreFeatures.map((feature, index) => (
              <FeatureCard key={feature.href} {...feature} index={index} t={(key) => t(`dashboard.${key}`)} />
            ))}
          </div>
        </section>

        {/* AI与工具 */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t('dashboard.aiTools')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {aiFeatures.map((feature, index) => (
              <FeatureCard key={feature.href} {...feature} index={index} t={(key) => t(`dashboard.${key}`)} />
            ))}
          </div>
        </section>

        {/* 社区功能 */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t('dashboard.community')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {communityFeatures.map((feature, index) => (
              <FeatureCard key={feature.href} {...feature} index={index} t={(key) => t(`dashboard.${key}`)} />
            ))}
          </div>
        </section>

        {/* 其他功能 */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">{t('dashboard.otherFeatures')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherFeatures.map((feature, index) => (
              <FeatureCard key={feature.href} {...feature} index={index} t={(key) => t(`dashboard.${key}`)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}


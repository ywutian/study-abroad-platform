'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Target,
  Users,
  Sparkles,
  Shield,
  Globe,
  Award,
  Heart,
  Zap,
  GraduationCap,
  Building2,
  TrendingUp,
  MessageCircle,
  Mail,
  ArrowRight,
} from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const stats = [
  { icon: Users, value: '50,000+', labelKey: 'stats.users', color: 'blue', gradient: 'bg-primary' },
  {
    icon: Building2,
    value: '2,000+',
    labelKey: 'stats.schools',
    color: 'emerald',
    gradient: 'bg-success',
  },
  {
    icon: Award,
    value: '10,000+',
    labelKey: 'stats.cases',
    color: 'amber',
    gradient: 'bg-warning',
  },
  {
    icon: TrendingUp,
    value: '85%',
    labelKey: 'stats.accuracy',
    color: 'violet',
    gradient: 'bg-primary',
  },
];

const values = [
  { icon: Target, titleKey: 'values.mission.title', descKey: 'values.mission.desc', color: 'blue' },
  {
    icon: Sparkles,
    titleKey: 'values.innovation.title',
    descKey: 'values.innovation.desc',
    color: 'violet',
  },
  { icon: Shield, titleKey: 'values.trust.title', descKey: 'values.trust.desc', color: 'emerald' },
  { icon: Heart, titleKey: 'values.care.title', descKey: 'values.care.desc', color: 'rose' },
];

const team = [
  {
    nameKey: 'team.members.zhangming.name',
    roleKey: 'team.members.zhangming.role',
    avatar: 'ZM',
    gradient: 'bg-primary',
  },
  {
    nameKey: 'team.members.lihua.name',
    roleKey: 'team.members.lihua.role',
    avatar: 'LH',
    gradient: 'bg-success',
  },
  {
    nameKey: 'team.members.wangfang.name',
    roleKey: 'team.members.wangfang.role',
    avatar: 'WF',
    gradient: 'bg-primary',
  },
  {
    nameKey: 'team.members.chenjie.name',
    roleKey: 'team.members.chenjie.role',
    avatar: 'CJ',
    gradient: 'bg-warning',
  },
];

const timeline = [
  {
    year: '2023',
    titleKey: 'timeline.founded.title',
    descKey: 'timeline.founded.desc',
    color: 'blue',
  },
  {
    year: '2024',
    titleKey: 'timeline.growth.title',
    descKey: 'timeline.growth.desc',
    color: 'emerald',
  },
  { year: '2025', titleKey: 'timeline.ai.title', descKey: 'timeline.ai.desc', color: 'violet' },
  {
    year: '2026',
    titleKey: 'timeline.expansion.title',
    descKey: 'timeline.expansion.desc',
    color: 'amber',
  },
];

export default function AboutPage() {
  const t = useTranslations('about');

  return (
    <PageContainer maxWidth="5xl">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-12 overflow-hidden rounded-xl bg-primary/5 p-8 sm:p-12 text-center"
      >
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br bg-primary/10 blur-3xl" />

        <div className="relative z-10">
          <Badge className="mb-4" variant="purple">
            <Globe className="h-3 w-3 mr-1" />
            {t('badge')}
          </Badge>
          <h1 className="text-display mb-4 text-primary bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-12">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.labelKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="text-center overflow-hidden hover:shadow-lg transition-shadow">
                <div className={cn('h-1 bg-gradient-to-r', stat.gradient)} />
                <CardContent className="pt-6 pb-6">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-xl mx-auto mb-3',
                      `bg-${stat.color}-500/10`
                    )}
                  >
                    <Icon className={cn('h-6 w-6', `text-${stat.color}-500`)} />
                  </div>
                  <div className={cn('text-3xl font-bold', `text-${stat.color}-600`)}>
                    {stat.value}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{t(stat.labelKey)}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Mission & Vision */}
      <div className="grid gap-6 md:grid-cols-2 mb-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full overflow-hidden">
            <div className="h-1 bg-primary" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <GraduationCap className="h-5 w-5 text-blue-500" />
                </div>
                <CardTitle>{t('story.title')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{t('story.content')}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full overflow-hidden">
            <div className="h-1 bg-primary dark:bg-primary" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>{t('vision.title')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{t('vision.content')}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Values */}
      <div className="mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-8"
        >
          <Badge variant="secondary" className="mb-2">
            {t('values.badge')}
          </Badge>
          <h2 className="text-subtitle">{t('values.title')}</h2>
        </motion.div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <motion.div
                key={value.titleKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <Card className="text-center h-full hover:shadow-lg transition-all duration-300 group">
                  <CardContent className="pt-6">
                    <div
                      className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-lg mx-auto mb-4 transition-colors',
                        `bg-${value.color}-500/10 group-hover:bg-${value.color}-500/20`
                      )}
                    >
                      <Icon className={cn('h-7 w-7', `text-${value.color}-500`)} />
                    </div>
                    <h3 className="font-semibold mb-2">{t(value.titleKey)}</h3>
                    <p className="text-sm text-muted-foreground">{t(value.descKey)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center mb-8"
        >
          <Badge variant="secondary" className="mb-2">
            {t('timeline.badge')}
          </Badge>
          <h2 className="text-subtitle">{t('timeline.title')}</h2>
        </motion.div>
        <div className="relative max-w-3xl mx-auto">
          <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-gradient-to-b from-blue-500 via-violet-500 to-amber-500" />
          <div className="space-y-8">
            {timeline.map((item, index) => (
              <motion.div
                key={item.year}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className={`flex items-center ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}
              >
                <div className={`w-1/2 ${index % 2 === 0 ? 'pr-8 text-right' : 'pl-8'}`}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow">
                    <div
                      className={cn('h-1 bg-gradient-to-r', {
                        'bg-primary': item.color === 'blue' || item.color === 'violet',
                        'bg-success': item.color === 'emerald',
                        'bg-warning': item.color === 'amber',
                      })}
                    />
                    <CardContent className="pt-4 pb-4">
                      <Badge
                        variant="outline"
                        className={cn('mb-2', {
                          'border-blue-500/30 text-blue-600 bg-blue-500/5': item.color === 'blue',
                          'border-emerald-500/30 text-emerald-600 bg-emerald-500/5':
                            item.color === 'emerald',
                          'border-violet-500/30 text-primary bg-primary/5': item.color === 'violet',
                          'border-amber-500/30 text-amber-600 bg-amber-500/5':
                            item.color === 'amber',
                        })}
                      >
                        {item.year}
                      </Badge>
                      <h3 className="font-semibold">{t(item.titleKey)}</h3>
                      <p className="text-sm text-muted-foreground">{t(item.descKey)}</p>
                    </CardContent>
                  </Card>
                </div>
                <div
                  className={cn(
                    'relative z-10 flex items-center justify-center w-4 h-4 rounded-full border-4 border-background',
                    {
                      'bg-blue-500': item.color === 'blue',
                      'bg-emerald-500': item.color === 'emerald',
                      'bg-primary': item.color === 'violet',
                      'bg-amber-500': item.color === 'amber',
                    }
                  )}
                />
                <div className="w-1/2" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-center mb-8"
        >
          <Badge variant="secondary" className="mb-2">
            {t('team.badge')}
          </Badge>
          <h2 className="text-subtitle">{t('team.title')}</h2>
        </motion.div>
        <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
          {team.map((member, index) => (
            <motion.div
              key={member.nameKey}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + index * 0.1 }}
            >
              <Card className="text-center hover:shadow-lg transition-all duration-300 overflow-hidden group">
                <div className={cn('h-1 bg-gradient-to-r', member.gradient)} />
                <CardContent className="pt-6">
                  <Avatar
                    className={cn(
                      'w-20 h-20 mx-auto mb-4 bg-gradient-to-br',
                      member.gradient,
                      'ring-4 ring-background shadow-lg'
                    )}
                  >
                    <AvatarFallback className="text-white text-xl font-bold bg-transparent">
                      {member.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold">{t(member.nameKey)}</h3>
                  <p className="text-sm text-muted-foreground">{t(member.roleKey)}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Contact CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-primary" />
          <CardContent className="py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-success mx-auto mb-4 ">
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-subtitle mb-2">{t('contact.title')}</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">{t('contact.desc')}</p>
            <Button className="gap-2 bg-success hover:opacity-90 text-white " asChild>
              <a href="mailto:contact@studyabroad.com">
                <Mail className="h-4 w-4" />
                contact@studyabroad.com
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </PageContainer>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Target, Users, Lightbulb, Shield, Globe, Heart, Zap, GraduationCap } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const COLOR_CLASSES: Record<
  string,
  { bg: string; bgHover: string; text: string; textBold: string }
> = {
  blue: {
    bg: 'bg-blue-500/10',
    bgHover: 'group-hover:bg-blue-500/20',
    text: 'text-blue-500',
    textBold: 'text-blue-600 dark:text-blue-400',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    bgHover: 'group-hover:bg-emerald-500/20',
    text: 'text-emerald-500',
    textBold: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    bg: 'bg-amber-500/10',
    bgHover: 'group-hover:bg-amber-500/20',
    text: 'text-amber-500',
    textBold: 'text-amber-600 dark:text-amber-400',
  },
  violet: {
    bg: 'bg-violet-500/10',
    bgHover: 'group-hover:bg-violet-500/20',
    text: 'text-violet-500',
    textBold: 'text-violet-600 dark:text-violet-400',
  },
  rose: {
    bg: 'bg-rose-500/10',
    bgHover: 'group-hover:bg-rose-500/20',
    text: 'text-rose-500',
    textBold: 'text-rose-600 dark:text-rose-400',
  },
};

const values = [
  { icon: Target, titleKey: 'values.mission.title', descKey: 'values.mission.desc', color: 'blue' },
  {
    icon: Lightbulb,
    titleKey: 'values.innovation.title',
    descKey: 'values.innovation.desc',
    color: 'violet',
  },
  { icon: Shield, titleKey: 'values.trust.title', descKey: 'values.trust.desc', color: 'emerald' },
  { icon: Heart, titleKey: 'values.care.title', descKey: 'values.care.desc', color: 'rose' },
];

export default function AboutPage() {
  const t = useTranslations('about');

  return (
    <PageContainer maxWidth="5xl">
      {/* Hero Section */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-12 overflow-hidden border-b border-border px-4 pb-12 pt-10 text-center"
      >
        <div className="absolute left-1/2 top-0 h-56 w-[min(42rem,92vw)] -translate-x-1/2 rounded-full bg-[color:var(--theme-glow-1)] opacity-70 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-px w-full -translate-x-1/2 bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="relative z-10">
          <Badge className="mb-4" variant="purple">
            <Globe className="h-3 w-3 mr-1" />
            {t('badge')}
          </Badge>
          <h1 className="mx-auto mb-4 max-w-3xl text-display text-foreground">{t('title')}</h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            {t('subtitle')}
          </p>
        </div>
      </motion.div>

      {/* Mission & Vision */}
      <div className="grid gap-6 md:grid-cols-2 mb-12">
        <motion.div initial={false} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
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
          id="vision"
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="scroll-mt-24"
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
          initial={false}
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
                id={value.titleKey === 'values.mission.title' ? 'mission' : undefined}
                key={value.titleKey}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="scroll-mt-24"
              >
                <Card className="text-center h-full group">
                  <CardContent className="pt-6">
                    <div
                      className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-lg mx-auto mb-4 transition-colors',
                        COLOR_CLASSES[value.color]?.bg,
                        COLOR_CLASSES[value.color]?.bgHover
                      )}
                    >
                      <Icon className={cn('h-7 w-7', COLOR_CLASSES[value.color]?.text)} />
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

      {/* Team */}
      <motion.div
        id="team"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-12 scroll-mt-24"
      >
        <Card className="overflow-hidden">
          <div className="h-1 bg-primary" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>{t('team.title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{t('team.content')}</p>
          </CardContent>
        </Card>
      </motion.div>
    </PageContainer>
  );
}

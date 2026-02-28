'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Target,
  BarChart3,
  Award,
  MessageSquare,
  CheckCircle,
  Building2,
  TrendingUp,
  Sparkles,
  Users,
} from 'lucide-react';
import { Card3D } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

const tabs = [
  { icon: Target, gradient: 'from-violet-500 to-purple-600', label: 'step1' },
  { icon: BarChart3, gradient: 'from-blue-500 to-cyan-500', label: 'step2' },
  { icon: Award, gradient: 'from-amber-500 to-orange-500', label: 'step3' },
  { icon: MessageSquare, gradient: 'from-emerald-500 to-teal-500', label: 'step4' },
] as const;

export function ProductPreview() {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState(0);
  const [prevTab, setPrevTab] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const direction = activeTab >= prevTab ? 1 : -1;

  const switchTab = (newTab: number) => {
    setPrevTab(activeTab);
    setActiveTab(newTab);
  };

  useEffect(() => {
    if (!isPlaying || prefersReducedMotion) return;
    const interval = setInterval(() => {
      setActiveTab((prev) => {
        setPrevTab(prev);
        return (prev + 1) % tabs.length;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [isPlaying, prefersReducedMotion]);

  const current = tabs[activeTab];

  return (
    <Card3D intensity={5} glare={true} className="rounded-2xl">
      <div
        className="rounded-2xl border-2 border-primary/10 bg-card/90 backdrop-blur-md shadow-2xl overflow-hidden"
        onMouseEnter={() => setIsPlaying(false)}
        onMouseLeave={() => setIsPlaying(true)}
      >
        {/* Browser toolbar */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b bg-muted/50">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-2 sm:mx-4">
            <div className="h-5 sm:h-6 bg-muted rounded-md flex items-center px-2 sm:px-3">
              <span className="text-2xs sm:text-xs text-muted-foreground">studyabroad.app</span>
            </div>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex border-b bg-muted/20" role="tablist">
          {tabs.map((tab, index) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={index}
                role="tab"
                aria-selected={activeTab === index}
                aria-label={t(`home.demo.step${index + 1}.title`)}
                onClick={() => switchTab(index)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 text-2xs sm:text-xs font-medium transition-all relative',
                  activeTab === index
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground/70'
                )}
              >
                <TabIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span className="truncate">{t(`home.demo.step${index + 1}.title`)}</span>
                {activeTab === index && (
                  <motion.div
                    layoutId="activeTab"
                    className={cn(
                      'absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r',
                      tab.gradient
                    )}
                    style={{ boxShadow: '0 0 8px 2px oklch(0.58 0.22 255 / 0.3)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="relative h-[260px] sm:h-[300px] lg:h-[340px] overflow-hidden p-4 sm:p-6">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={activeTab}
              className="absolute inset-4 sm:inset-6"
              initial={{ opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <TabContent step={activeTab} gradient={current.gradient} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div
          className="flex items-center justify-center gap-1.5 pb-3 sm:pb-4"
          role="tablist"
          aria-label="Preview steps"
        >
          {tabs.map((_, index) => (
            <button
              key={index}
              role="tab"
              aria-selected={activeTab === index}
              aria-label={`Step ${index + 1}`}
              onClick={() => switchTab(index)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                activeTab === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
      </div>
    </Card3D>
  );
}

function TabContent({ step, gradient }: { step: number; gradient: string }) {
  const t = useTranslations();

  if (step === 0) {
    return (
      <div className="space-y-2.5 sm:space-y-3">
        <div className="h-8 sm:h-9 bg-muted/50 rounded-lg flex items-center px-3 gap-2">
          <Target className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-2xs text-muted-foreground">
            {t('home.demoUI.step1.searchPlaceholder')}
          </span>
          <div className="flex-1" />
          <div className="flex gap-1">
            <div className="px-1.5 sm:px-2 py-0.5 rounded bg-violet-500/20 text-2xs text-violet-600 dark:text-violet-400">
              {t('home.demoUI.step1.filterUS')}
            </div>
            <div className="px-1.5 sm:px-2 py-0.5 rounded bg-blue-500/20 text-2xs text-blue-600 dark:text-blue-400">
              {t('home.demoUI.step1.filterTop50')}
            </div>
          </div>
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          {[
            { name: 'MIT', rank: '#1', rate: '4%', color: 'bg-red-500' },
            { name: 'Stanford', rank: '#3', rate: '4%', color: 'bg-red-600' },
            { name: 'CMU', rank: '#7', rate: '11%', color: 'bg-blue-500' },
          ].map((school, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2.5 sm:gap-3 p-1.5 sm:p-2 rounded-lg bg-muted/30 border border-border/50"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div
                className={cn(
                  'w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-white text-2xs font-bold',
                  school.color
                )}
              >
                {school.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{school.name}</div>
                <div className="text-2xs text-muted-foreground">
                  {t('home.demoUI.step1.acceptance', { rate: school.rate })}
                </div>
              </div>
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
            </motion.div>
          ))}
        </div>
        <div
          className={cn(
            'h-7 sm:h-8 rounded-lg bg-gradient-to-r flex items-center justify-center',
            gradient
          )}
        >
          <span className="text-2xs text-white font-medium">
            {t('home.demoUI.step1.viewAllSchools')}
          </span>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="space-y-2.5 sm:space-y-3">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/50">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xs sm:text-xs font-bold">
            YT
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium">{t('home.demoUI.step2.yourProfile')}</div>
            <div className="text-2xs text-muted-foreground truncate">
              {t('home.demoUI.step2.profileDetail')}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-bold text-blue-500">85</div>
            <div className="text-2xs text-muted-foreground">{t('home.demoUI.step2.score')}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {[
            {
              label: t('home.demoUI.step2.safety'),
              value: 92,
              color: 'text-emerald-500',
              bg: 'bg-emerald-500',
            },
            {
              label: t('home.demoUI.step2.target'),
              value: 68,
              color: 'text-blue-500',
              bg: 'bg-blue-500',
            },
            {
              label: t('home.demoUI.step2.reach'),
              value: 35,
              color: 'text-amber-500',
              bg: 'bg-amber-500',
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="p-1.5 sm:p-2 rounded-lg bg-muted/30 border border-border/50 text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className={cn('text-base sm:text-lg font-bold', item.color)}>{item.value}%</div>
              <div className="text-2xs text-muted-foreground">{item.label}</div>
              <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', item.bg)}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.value}%` }}
                  transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span className="text-2xs font-medium text-blue-600 dark:text-blue-400">
              {t('home.demoUI.step2.aiSuggestion')}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground">{t('home.demoUI.step2.suggestionText')}</p>
        </div>
        <div
          className={cn(
            'h-7 sm:h-8 rounded-lg bg-gradient-to-r flex items-center justify-center',
            gradient
          )}
        >
          <span className="text-2xs text-white font-medium">
            {t('home.demoUI.step2.fullAnalysis')}
          </span>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50">
          <div>
            <div className="text-xs font-medium">{t('home.demoUI.step3.applicationProgress')}</div>
            <div className="text-2xs text-muted-foreground">
              {t('home.demoUI.step3.tasksCompleted')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-14 sm:w-16 h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-amber-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '37.5%' }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className="text-xs font-bold text-amber-500">38%</span>
          </div>
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          {[
            {
              task: t('home.demoUI.step3.completeProfile'),
              status: 'done',
              date: t('home.demoUI.step3.dateOct15'),
            },
            {
              task: t('home.demoUI.step3.submitScores'),
              status: 'done',
              date: t('home.demoUI.step3.dateOct20'),
            },
            {
              task: t('home.demoUI.step3.writeEssay'),
              status: 'current',
              date: t('home.demoUI.step3.dateNov1'),
            },
            {
              task: t('home.demoUI.step3.requestRecs'),
              status: 'pending',
              date: t('home.demoUI.step3.dateNov15'),
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              className={cn(
                'flex items-center gap-2.5 sm:gap-3 p-1.5 sm:p-2 rounded-lg border',
                item.status === 'current'
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-muted/30 border-border/50'
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div
                className={cn(
                  'w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0',
                  item.status === 'done'
                    ? 'bg-emerald-500'
                    : item.status === 'current'
                      ? 'bg-amber-500'
                      : 'bg-muted'
                )}
              >
                {item.status === 'done' ? (
                  <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn('text-2xs sm:text-xs', item.status === 'current' && 'font-medium')}
                >
                  {item.task}
                </div>
              </div>
              <div className="text-2xs text-muted-foreground shrink-0">{item.date}</div>
            </motion.div>
          ))}
        </div>
        <div
          className={cn(
            'h-7 sm:h-8 rounded-lg bg-gradient-to-r flex items-center justify-center',
            gradient
          )}
        >
          <span className="text-2xs text-white font-medium">
            {t('home.demoUI.step3.viewTimeline')}
          </span>
        </div>
      </div>
    );
  }

  // Step 4: Community
  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{t('home.demoUI.step4.trendingTopics')}</span>
        <span className="text-2xs text-primary">{t('home.demoUI.step4.viewAll')}</span>
      </div>
      <div className="space-y-1.5 sm:space-y-2">
        {[
          {
            title: t('home.demoUI.step4.post1Title'),
            tag: t('home.demoUI.step4.post1Tag'),
            replies: 128,
            color: 'bg-red-500/20 text-red-600 dark:text-red-400',
          },
          {
            title: t('home.demoUI.step4.post2Title'),
            tag: t('home.demoUI.step4.post2Tag'),
            replies: 56,
            color: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
          },
          {
            title: t('home.demoUI.step4.post3Title'),
            tag: t('home.demoUI.step4.post3Tag'),
            replies: 89,
            color: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
          },
        ].map((post, i) => (
          <motion.div
            key={i}
            className="p-1.5 sm:p-2 rounded-lg bg-muted/30 border border-border/50"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-2xs font-bold shrink-0">
                {['A', 'B', 'C'][i]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-2xs sm:text-xs font-medium truncate">{post.title}</div>
                <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                  <span className={cn('px-1.5 py-0.5 rounded text-2xs', post.color)}>
                    {post.tag}
                  </span>
                  <span className="text-2xs text-muted-foreground flex items-center gap-0.5">
                    <MessageSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {post.replies}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-2 p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
        </div>
        <span className="text-2xs text-emerald-600 dark:text-emerald-400">
          {t('home.demoUI.step4.connectMessage')}
        </span>
      </div>
      <div
        className={cn(
          'h-7 sm:h-8 rounded-lg bg-gradient-to-r flex items-center justify-center',
          gradient
        )}
      >
        <span className="text-2xs text-white font-medium">
          {t('home.demoUI.step4.joinCommunity')}
        </span>
      </div>
    </div>
  );
}

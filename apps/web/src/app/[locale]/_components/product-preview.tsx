'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Target, BarChart3, Award, MessageSquare, CheckCircle, Sparkles, Lock } from 'lucide-react';
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
    }, 8000);
    return () => clearInterval(interval);
  }, [isPlaying, prefersReducedMotion]);

  const current = tabs[activeTab];

  return (
    <Card3D intensity={3} glare={true} className="rounded-2xl w-full">
      <div
        className="rounded-2xl border border-border/60 bg-card shadow-xl shadow-black/[0.08] dark:shadow-black/[0.25] overflow-hidden w-full flex flex-col"
        onMouseEnter={() => setIsPlaying(false)}
        onMouseLeave={() => setIsPlaying(true)}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border/30 bg-muted/30 w-full">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60 dark:bg-red-400/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60 dark:bg-yellow-400/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60 dark:bg-green-400/50" />
          </div>
          <div className="flex-1 mx-2 sm:mx-3 max-w-md min-w-0">
            <div className="h-6 bg-muted/40 rounded-md flex items-center justify-center gap-1.5 px-3 w-full">
              <Lock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <span className="text-xs text-muted-foreground/60 truncate">studyabroad.app</span>
            </div>
          </div>
        </div>

        {/* Horizontal layout: sidebar tabs + content */}
        <div className="flex min-h-[280px] sm:min-h-[320px] w-full">
          {/* Left sidebar — tab navigation */}
          <div
            className="w-14 sm:w-36 md:w-40 border-r border-border/30 bg-muted/10 flex flex-col shrink-0"
            role="tablist"
          >
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
                    'relative flex items-center gap-2.5 px-3 sm:px-4 py-3.5 text-xs font-medium transition-all text-left w-full overflow-hidden',
                    activeTab === index
                      ? 'text-foreground bg-background/60'
                      : 'text-muted-foreground hover:text-foreground/70 hover:bg-muted/20'
                  )}
                >
                  <TabIcon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline truncate">
                    {t(`home.demo.step${index + 1}.title`)}
                  </span>
                  {activeTab === index && (
                    <motion.div
                      layoutId="activeTab"
                      className={cn(
                        'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b',
                        tab.gradient
                      )}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
            {/* Spacer + progress dots at bottom */}
            <div className="flex-1" />
            <div
              className="flex sm:flex-col items-center justify-center gap-1.5 py-3 px-2"
              role="group"
              aria-label="Preview progress"
            >
              {tabs.map((_, index) => (
                <button
                  key={index}
                  aria-label={t(`home.demo.step${index + 1}.title`)}
                  onClick={() => switchTab(index)}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    activeTab === index
                      ? 'w-1.5 h-5 sm:w-5 sm:h-1.5 bg-primary'
                      : 'w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground/25'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Right content area */}
          <div className="flex-1 relative overflow-hidden min-w-0 w-full">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={activeTab}
                className="absolute inset-0 p-4 sm:p-5 lg:p-6 w-full h-full"
                initial={{ opacity: 0, y: direction * 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction * -12 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <TabContent step={activeTab} gradient={current.gradient} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Card3D>
  );
}

function TabContent({ step, gradient }: { step: number; gradient: string }) {
  const t = useTranslations();

  // Step 0: School Search
  if (step === 0) {
    return (
      <div className="flex flex-col gap-3 h-full w-full">
        <div className="h-9 bg-muted/30 rounded-lg flex items-center px-3 gap-2 shrink-0">
          <Target className="w-4 h-4 text-muted-foreground/60 shrink-0" />
          <span className="text-xs sm:text-sm text-muted-foreground/70 truncate whitespace-nowrap">
            {t('home.demoUI.step1.searchPlaceholder')}
          </span>
          <div className="flex-1 min-w-0" />
          <div className="flex gap-1.5 shrink-0 hidden sm:flex">
            <div className="px-2 py-0.5 rounded bg-violet-500/10 text-2xs text-violet-600 dark:text-violet-400 whitespace-nowrap">
              {t('home.demoUI.step1.filterUS')}
            </div>
            <div className="px-2 py-0.5 rounded bg-blue-500/10 text-2xs text-blue-600 dark:text-blue-400 whitespace-nowrap">
              {t('home.demoUI.step1.filterTop50')}
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
          {[
            { name: 'MIT', rank: '#1', rate: '4%', color: 'bg-red-500' },
            { name: 'Stanford', rank: '#3', rate: '4%', color: 'bg-red-600' },
            { name: 'CMU', rank: '#7', rate: '11%', color: 'bg-blue-500' },
          ].map((school, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2.5 sm:gap-3 p-2 sm:p-2.5 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors w-full shrink-0"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div
                className={cn(
                  'w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0',
                  school.color
                )}
              >
                {school.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{school.name}</div>
                <div className="text-2xs sm:text-xs text-muted-foreground truncate">
                  {t('home.demoUI.step1.acceptance', { rate: school.rate })}
                </div>
              </div>
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0" />
            </motion.div>
          ))}
        </div>
        <div
          className={cn(
            'h-9 rounded-lg bg-gradient-to-r flex items-center justify-center shrink-0 w-full',
            gradient
          )}
        >
          <span className="text-xs sm:text-sm text-white font-medium truncate px-2">
            {t('home.demoUI.step1.viewAllSchools')}
          </span>
        </div>
      </div>
    );
  }

  // Step 1: AI Analysis
  if (step === 1) {
    return (
      <div className="flex flex-col gap-3 h-full w-full">
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full">
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
              className={cn('p-3 rounded-lg text-center', item.bg ? 'bg-muted/10' : '')}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className={cn('text-2xl sm:text-3xl font-bold', item.color)}>{item.value}%</div>
              <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
              <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', item.bg)}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.value}%` }}
                  transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
        <div className="flex-1 flex flex-col gap-2.5 min-h-0 overflow-hidden w-full">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 w-full shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
              YT
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {t('home.demoUI.step2.yourProfile')}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {t('home.demoUI.step2.profileDetail')}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold text-blue-500">85</div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {t('home.demoUI.step2.score')}
              </div>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 w-full shrink-0 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1 shrink-0">
              <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                {t('home.demoUI.step2.aiSuggestion')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {t('home.demoUI.step2.suggestionText')}
            </p>
          </div>
        </div>
        <div
          className={cn(
            'h-9 rounded-lg bg-gradient-to-r flex items-center justify-center shrink-0 w-full',
            gradient
          )}
        >
          <span className="text-xs sm:text-sm text-white font-medium truncate px-2">
            {t('home.demoUI.step2.fullAnalysis')}
          </span>
        </div>
      </div>
    );
  }

  // Step 2: Application Tracking
  if (step === 2) {
    return (
      <div className="flex flex-col gap-3 h-full w-full">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/10 w-full shrink-0">
          <div className="min-w-0 pr-2">
            <div className="text-sm font-medium truncate">
              {t('home.demoUI.step3.applicationProgress')}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {t('home.demoUI.step3.tasksCompleted')}
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-12 sm:w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-amber-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '66%' }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="text-sm font-bold text-amber-500">66%</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden w-full">
          {[
            {
              task: t('home.demoUI.step3.completeProfile'),
              status: 'done',
              date: t('home.demoUI.step3.dateOct15'),
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
                'flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg w-full shrink-0',
                item.status === 'current' ? 'bg-amber-500/10' : 'bg-muted/10'
              )}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div
                className={cn(
                  'w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0',
                  item.status === 'done'
                    ? 'bg-emerald-500'
                    : item.status === 'current'
                      ? 'bg-amber-500'
                      : 'bg-muted'
                )}
              >
                {item.status === 'done' ? (
                  <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                ) : (
                  <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-xs sm:text-sm truncate',
                    item.status === 'current' && 'font-medium'
                  )}
                >
                  {item.task}
                </div>
              </div>
              <div className="text-2xs sm:text-xs text-muted-foreground shrink-0 whitespace-nowrap pl-1">
                {item.date}
              </div>
            </motion.div>
          ))}
        </div>
        <div
          className={cn(
            'h-9 rounded-lg bg-gradient-to-r flex items-center justify-center shrink-0 w-full',
            gradient
          )}
        >
          <span className="text-xs sm:text-sm text-white font-medium truncate px-2">
            {t('home.demoUI.step3.viewTimeline')}
          </span>
        </div>
      </div>
    );
  }

  // Step 3: Community
  return (
    <div className="flex flex-col gap-3 h-full w-full">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-sm font-medium truncate pr-2">
          {t('home.demoUI.step4.trendingTopics')}
        </span>
        <span className="text-xs text-primary shrink-0 whitespace-nowrap">
          {t('home.demoUI.step4.viewAll')}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden w-full">
        {[
          {
            title: t('home.demoUI.step4.post1Title'),
            tag: t('home.demoUI.step4.post1Tag'),
            replies: 128,
            color: 'bg-red-500/10 text-red-600 dark:text-red-400',
          },
          {
            title: t('home.demoUI.step4.post2Title'),
            tag: t('home.demoUI.step4.post2Tag'),
            replies: 56,
            color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
          },
          {
            title: t('home.demoUI.step4.post3Title'),
            tag: t('home.demoUI.step4.post3Tag'),
            replies: 89,
            color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          },
        ].map((post, i) => (
          <motion.div
            key={i}
            className="p-2 sm:p-2.5 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors w-full shrink-0"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="flex items-start gap-2.5 sm:gap-3 w-full">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {['A', 'B', 'C'][i]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm font-medium truncate">{post.title}</div>
                <div className="flex items-center gap-2 mt-1 shrink-0 overflow-hidden">
                  <span
                    className={cn('px-1.5 sm:px-2 py-0.5 rounded text-2xs truncate', post.color)}
                  >
                    {post.tag}
                  </span>
                  <span className="text-2xs text-muted-foreground flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <MessageSquare className="w-3 h-3" /> {post.replies}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div
        className={cn(
          'h-9 rounded-lg bg-gradient-to-r flex items-center justify-center shrink-0 w-full',
          gradient
        )}
      >
        <span className="text-xs sm:text-sm text-white font-medium truncate px-2">
          {t('home.demoUI.step4.joinCommunity')}
        </span>
      </div>
    </div>
  );
}

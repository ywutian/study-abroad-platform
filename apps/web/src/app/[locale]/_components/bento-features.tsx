'use client';

import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Target,
  BarChart3,
  BookOpen,
  MessageSquare,
  Globe2,
  CheckCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { SectionHeader } from '@/components/features/landing';
import { AnimatedNumber, ChatMessageMotion } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';

export function BentoFeatures() {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <section id="features" className="zone-tinted section-expansive">
      <div className="container mx-auto px-4">
        <SectionHeader
          title={t('home.modules.title')}
          subtitle={t('home.modules.subtitle')}
          align="left"
          size="display"
          className="max-w-6xl"
        />

        <div
          ref={ref}
          className="mx-auto max-w-6xl grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8"
        >
          {/* Large card: School Finder (spans 2 cols, 2 rows on lg) */}
          <BentoCard
            index={0}
            isInView={isInView}
            reduced={!!prefersReducedMotion}
            className="col-span-2 lg:col-span-2 lg:row-span-2"
            gradient="from-violet-500/10 to-purple-600/10"
            borderColor="hover:border-violet-500/30"
            href="/schools"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-2.5 shadow-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-semibold">
                  {t('home.modules.schools.title')}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('home.modules.schools.desc')}
                </p>
              </div>
            </div>
            {/* Mini search UI mockup */}
            <div className="rounded-xl bg-muted/30 border border-border/40 p-3 sm:p-5">
              <div className="h-9 bg-background/80 rounded-lg flex items-center px-3 gap-2 mb-4 shadow-sm">
                <Target className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {t('home.demoUI.step1.searchPlaceholder')}
                </span>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'MIT', rank: '#1', match: 92, color: 'bg-red-500' },
                  { name: 'Stanford University', rank: '#3', match: 85, color: 'bg-red-600' },
                  { name: 'Carnegie Mellon', rank: '#7', match: 78, color: 'bg-blue-500' },
                ].map((school, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50 hover:bg-background transition-colors"
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-md flex items-center justify-center text-white text-2xs font-bold shrink-0',
                        school.color
                      )}
                    >
                      {school.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{school.name}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${school.match}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-primary">{school.match}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

          {/* Medium card: AI Prediction */}
          <BentoCard
            index={1}
            isInView={isInView}
            reduced={!!prefersReducedMotion}
            className="col-span-2 lg:col-span-1 lg:row-span-2"
            gradient="from-blue-500/5 to-cyan-500/5"
            borderColor="hover:border-blue-500/30"
            href="/prediction"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5 shadow-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t('home.modules.uncommonApp.title')}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('home.modules.uncommonApp.desc')}
                </p>
              </div>
            </div>
            {/* Animated gauge */}
            <div className="flex flex-col items-center py-4">
              <PredictionGauge value={85} isInView={isInView} reduced={!!prefersReducedMotion} />
              <p className="text-sm text-muted-foreground mt-3">{t('home.demoUI.step2.score')}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { label: t('home.demoUI.step2.safety'), value: 92, color: 'text-emerald-500' },
                { label: t('home.demoUI.step2.target'), value: 68, color: 'text-blue-500' },
                { label: t('home.demoUI.step2.reach'), value: 35, color: 'text-amber-500' },
              ].map((item, i) => (
                <div key={i} className="text-center p-2.5 rounded-lg bg-muted/30">
                  <div className={cn('text-lg font-bold', item.color)}>{item.value}%</div>
                  <div className="text-2xs text-muted-foreground mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
          </BentoCard>

          {/* Small card: Data scale */}
          <BentoCard
            index={2}
            isInView={isInView}
            reduced={!!prefersReducedMotion}
            gradient="from-emerald-500/5 to-teal-500/5"
            borderColor="hover:border-emerald-500/30"
            href="/schools"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-2.5 shadow-lg">
                <Globe2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <AnimatedNumber
                    value={3000}
                    className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400"
                  />
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    +
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{t('home.stats.schools')}</p>
              </div>
            </div>
          </BentoCard>

          {/* Medium card: Essay & AI */}
          <BentoCard
            index={3}
            isInView={isInView}
            reduced={!!prefersReducedMotion}
            gradient="from-amber-500/5 to-orange-500/5"
            borderColor="hover:border-amber-500/30"
            href="/hall"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-2.5 shadow-lg">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold">{t('home.modules.featureHall.title')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('home.modules.featureHall.desc')}
                </p>
              </div>
            </div>
            {/* Chat bubbles */}
            <div className="space-y-2">
              <ChatMessageMotion isOwn={true} index={0}>
                <div className="ml-auto max-w-[80%] rounded-xl rounded-br-sm bg-primary/10 px-3 py-2">
                  <p className="text-xs">{t('home.bento.chatUser')}</p>
                </div>
              </ChatMessageMotion>
              <ChatMessageMotion isOwn={false} index={1}>
                <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-muted px-3 py-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-2xs font-medium text-primary">AI</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('home.bento.chatAi')}</p>
                </div>
              </ChatMessageMotion>
            </div>
          </BentoCard>

          {/* Small card: Community */}
          <BentoCard
            index={4}
            isInView={isInView}
            reduced={!!prefersReducedMotion}
            gradient="from-violet-500/5 to-indigo-500/5"
            borderColor="hover:border-violet-500/30"
            href="/forum"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 p-2.5 shadow-lg">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold">{t('home.modules.forum.title')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('home.modules.forum.desc')}
                </p>
              </div>
            </div>
            {/* Overlapping avatars */}
            <div className="flex items-center gap-3 mt-3">
              <div className="flex -space-x-2">
                {['L', 'W', 'Z', 'C', 'H'].map((letter, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-2xs font-bold text-white ring-2 ring-background"
                    style={{ opacity: 1 - i * 0.1 }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <AnimatedNumber value={1200} className="text-sm font-bold" />
                <span className="text-xs text-muted-foreground">+</span>
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

// Reusable bento card wrapper with cursor-following glow
function BentoCard({
  children,
  index,
  isInView,
  reduced,
  className,
  gradient,
  borderColor,
  href,
}: {
  children: React.ReactNode;
  index: number;
  isInView: boolean;
  reduced: boolean;
  className?: string;
  gradient: string;
  borderColor: string;
  href?: string;
}) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      initial={reduced ? {} : { opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      whileHover={
        reduced ? {} : { y: -4, transition: { type: 'spring', stiffness: 300, damping: 20 } }
      }
      transition={{ delay: index * 0.08, ...transitions.springGentle }}
      className={cn(
        'group relative rounded-2xl border bg-card p-4 sm:p-6 lg:p-8 xl:p-10 shadow-lg transition-all duration-300 hover:shadow-xl overflow-hidden card-glow',
        borderColor,
        className
      )}
    >
      {/* Cursor-following glow — pointer devices only */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 hidden [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), oklch(0.58 0.22 255 / 0.06), transparent 40%)',
        }}
      />
      {/* Subtle gradient background */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-50 pointer-events-none',
          gradient
        )}
      />
      <div className="relative">{children}</div>
      {href && (
        <Link href={href} className="absolute inset-0 z-10" aria-hidden="true" tabIndex={-1} />
      )}
    </motion.div>
  );
}

// SVG circular gauge for prediction
function PredictionGauge({
  value,
  isInView,
  reduced,
}: {
  value: number;
  isInView: boolean;
  reduced: boolean;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative w-32 h-32 sm:w-36 sm:h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        {/* Animated progress circle */}
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={isInView && !reduced ? { strokeDashoffset: offset } : {}}
          transition={{ duration: 1.5, delay: 0.3, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.58 0.22 255)">
              <animate
                attributeName="stop-color"
                values="oklch(0.58 0.22 255); oklch(0.72 0.16 200); oklch(0.58 0.22 255)"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="oklch(0.72 0.16 200)">
              <animate
                attributeName="stop-color"
                values="oklch(0.72 0.16 200); oklch(0.65 0.20 280); oklch(0.72 0.16 200)"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber
          value={value}
          className="text-3xl sm:text-4xl font-bold text-foreground drop-shadow-[0_0_8px_oklch(0.58_0.22_255_/_0.3)]"
        />
        <span className="text-xs text-muted-foreground -mt-1">%</span>
      </div>
    </div>
  );
}

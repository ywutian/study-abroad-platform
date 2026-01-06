'use client';

/**
 * 首页 - 带全面动画升级
 */

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useScroll, useTransform, useReducedMotion, useInView } from 'framer-motion';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { FeatureCard, StatCard } from '@/components/features';
import {
  User,
  BarChart3,
  Target,
  BookOpen,
  MessageSquare,
  Building2,
  ArrowRight,
  Sparkles,
  GraduationCap,
  Globe2,
  TrendingUp,
  CheckCircle,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { transitions } from '@/lib/motion';

export default function HomePage() {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();

  // Parallax refs
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const features = [
    {
      title: t('nav.profile'),
      description: t('home.features.profile'),
      href: '/profile',
      icon: User,
      gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    },
    {
      title: t('nav.ranking'),
      description: t('home.features.ranking'),
      href: '/ranking',
      icon: BarChart3,
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
    },
    {
      title: t('nav.prediction'),
      description: t('home.features.prediction'),
      href: '/prediction',
      icon: Target,
      gradient: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
    },
    {
      title: t('nav.cases'),
      description: t('home.features.cases'),
      href: '/cases',
      icon: BookOpen,
      gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    },
    {
      title: t('nav.chat'),
      description: t('home.features.chat'),
      href: '/chat',
      icon: MessageSquare,
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
    },
    {
      title: t('nav.hall'),
      description: t('home.features.hall'),
      href: '/hall',
      icon: Building2,
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)',
    },
  ];

  const stats = [
    { value: '10,000+', label: t('home.stats.cases') },
    { value: '500+', label: t('home.stats.schools') },
    { value: '95%', label: t('home.stats.accuracy') },
    { value: '24/7', label: t('home.stats.aiAssistant') },
  ];

  const whyChooseUs = [
    {
      icon: GraduationCap,
      title: t('home.whyChooseUs.realData'),
      description: t('home.whyChooseUs.realDataDesc'),
    },
    {
      icon: TrendingUp,
      title: t('home.whyChooseUs.smartAlgorithm'),
      description: t('home.whyChooseUs.smartAlgorithmDesc'),
    },
    {
      icon: Globe2,
      title: t('home.whyChooseUs.globalCoverage'),
      description: t('home.whyChooseUs.globalCoverageDesc'),
    },
  ];

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Hero Section */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero py-20"
      >
        {/* Animated Background */}
        <HeroBackground prefersReducedMotion={prefersReducedMotion} />

        {/* Content */}
        <motion.div
          className="container relative mx-auto px-4 z-10"
          style={prefersReducedMotion ? {} : { y: heroY, opacity: heroOpacity }}
        >
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <motion.div
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary-foreground backdrop-blur-sm"
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <motion.span
                animate={prefersReducedMotion ? {} : { rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="h-4 w-4" />
              </motion.span>
              <span>{t('home.badge')}</span>
            </motion.div>

            {/* Title */}
            <motion.h1
              className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ...transitions.springGentle }}
            >
              <span className="block">{t('common.appName')}</span>
              <motion.span
                className="mt-2 block bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent"
                initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                {t('home.heroTitle')}
              </motion.span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="mx-auto mb-8 max-w-2xl text-lg text-slate-300 sm:text-xl"
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {t('home.heroSubtitle')}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col justify-center gap-4 sm:flex-row"
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Link href="/register">
                <motion.div
                  whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                >
                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 shadow-lg shadow-primary/25 sm:w-auto"
                  >
                    {t('common.register')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/login">
                <motion.div
                  whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-slate-600 text-white hover:bg-slate-800 sm:w-auto"
                  >
                    {t('common.login')}
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:mt-20 sm:grid-cols-4 sm:gap-8">
            {stats.map((stat, index) => (
              <StatCard key={stat.label} value={stat.value} label={stat.label} index={index} />
            ))}
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        {!prefersReducedMotion && (
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            <motion.div
              className="flex flex-col items-center gap-2 text-slate-400"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-xs">向下滚动</span>
              <div className="h-6 w-4 rounded-full border-2 border-slate-500 p-1">
                <motion.div
                  className="h-1.5 w-1.5 rounded-full bg-slate-400"
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </section>

      {/* Features Section */}
      <FeaturesSection features={features} t={t} prefersReducedMotion={prefersReducedMotion} />

      {/* Why Choose Us Section */}
      <WhyChooseUsSection items={whyChooseUs} t={t} prefersReducedMotion={prefersReducedMotion} />

      {/* CTA Section */}
      <CTASection t={t} prefersReducedMotion={prefersReducedMotion} />

      {/* Footer */}
      <Footer t={t} />
    </div>
  );
}

// ============================================
// Hero Background
// ============================================

function HeroBackground({ prefersReducedMotion }: { prefersReducedMotion: boolean | null }) {
  if (prefersReducedMotion) {
    return (
      <>
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </>
    );
  }

  return (
    <>
      {/* Grid */}
      <div className="absolute inset-0 bg-grid opacity-30" />

      {/* Animated Orbs */}
      <motion.div
        className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/20 blur-3xl"
        animate={{
          x: [0, 30, 0],
          y: [0, 20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
        animate={{
          x: [0, -20, 0],
          y: [0, -30, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating Elements */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-primary/40"
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + (i % 3) * 20}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3 + i,
            repeat: Infinity,
            delay: i * 0.5,
          }}
        />
      ))}
    </>
  );
}

// ============================================
// Features Section
// ============================================

function FeaturesSection({
  features,
  t,
  prefersReducedMotion,
}: {
  features: any[];
  t: any;
  prefersReducedMotion: boolean | null;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section ref={ref} className="bg-background py-16 sm:py-20 lg:py-24">
      <div className="container mx-auto px-4">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={transitions.springGentle}
        >
          <h2 className="text-3xl font-bold sm:text-4xl">{t('home.coreFeatures')}</h2>
          <p className="mt-4 text-muted-foreground">{t('home.coreFeaturesSubtitle')}</p>
        </motion.div>

        <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Link key={feature.href} href={feature.href}>
              <FeatureCard
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
                index={index}
                gradient={feature.gradient}
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// Why Choose Us Section
// ============================================

function WhyChooseUsSection({
  items,
  t,
  prefersReducedMotion,
}: {
  items: any[];
  t: any;
  prefersReducedMotion: boolean | null;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section ref={ref} className="border-y bg-muted/30 py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={transitions.springGentle}
            >
              <h2 className="text-3xl font-bold sm:text-4xl">{t('home.whyChooseUs.title')}</h2>
              <p className="mt-4 text-muted-foreground">{t('home.whyChooseUs.subtitle')}</p>

              <div className="mt-8 space-y-6">
                {items.map((item, index) => (
                  <motion.div
                    key={item.title}
                    className="flex gap-4"
                    initial={prefersReducedMotion ? {} : { opacity: 0, x: -16 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.2 + index * 0.1 }}
                  >
                    <motion.div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                      whileHover={prefersReducedMotion ? {} : { scale: 1.1, rotate: 5 }}
                    >
                      <item.icon className="h-6 w-6" />
                    </motion.div>
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Preview Card */}
            <motion.div
              className="relative hidden lg:block"
              initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.3 }}
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5" />
              <motion.div
                className="relative rounded-3xl border bg-card p-8 shadow-xl"
                whileHover={prefersReducedMotion ? {} : { y: -4 }}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10" />
                    <div className="space-y-1">
                      <div className="h-4 w-32 rounded bg-muted" />
                      <div className="h-3 w-24 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[75, 62, 88].map((value, i) => (
                      <motion.div
                        key={i}
                        className="rounded-lg bg-muted/50 p-3 text-center"
                        initial={prefersReducedMotion ? {} : { scale: 0.9, opacity: 0 }}
                        animate={isInView ? { scale: 1, opacity: 1 } : {}}
                        transition={{ delay: 0.5 + i * 0.1 }}
                      >
                        <div className="text-2xl font-bold text-primary">{value}%</div>
                        <div className="text-xs text-muted-foreground">{t('home.whyChooseUs.admissionRate')}</div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="h-32 rounded-lg bg-muted/30" />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// CTA Section
// ============================================

function CTASection({ t, prefersReducedMotion }: { t: any; prefersReducedMotion: boolean | null }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <section ref={ref} className="relative overflow-hidden bg-gradient-hero py-16 sm:py-20">
      {/* Animated Background */}
      {!prefersReducedMotion && (
        <>
          <motion.div
            className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-white/5 blur-2xl"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="absolute -right-20 -bottom-20 h-40 w-40 rounded-full bg-white/5 blur-2xl"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
        </>
      )}

      <motion.div
        className="container relative mx-auto px-4 text-center"
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={transitions.springGentle}
      >
        <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
          {t('home.ctaTitle')}
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-slate-300">{t('home.ctaSubtitle')}</p>
        <Link href="/register">
          <motion.div
            whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
          >
            <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 shadow-xl">
              {t('home.ctaButton')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </Link>
      </motion.div>
    </section>
  );
}

// ============================================
// Footer
// ============================================

function Footer({ t }: { t: any }) {
  return (
    <footer className="border-t bg-card py-8 sm:py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="md" />
          </Link>
          <p className="text-sm text-muted-foreground">{t('home.copyright')}</p>
          <div className="flex gap-6">
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('home.aboutUs')}
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('home.privacy')}
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('home.terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

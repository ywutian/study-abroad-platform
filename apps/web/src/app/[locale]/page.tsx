'use client';

/**
 * 首页 - 优化版
 * 实现：响应式设计、清晰视觉层次、可复用组件
 */

import { useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useScroll, useTransform, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  EnhancedStatCard,
  SectionHeader,
  FeaturePreviewCard,
  TestimonialCard,
  CTASection,
  LandingFooter,
} from '@/components/features/landing';
import {
  Target,
  BookOpen,
  MessageSquare,
  Building2,
  ArrowRight,
  Sparkles,
  GraduationCap,
  TrendingUp,
  CheckCircle,
  Globe,
  Globe2,
  FileText,
  Users,
  Award,
  BarChart3,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { transitions } from '@/lib/motion';
import { localeNames, type Locale } from '@/lib/i18n/config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// 四大模块数据
const mainModules = [
  {
    id: 'find-college',
    href: '/find-college',
    icon: Target,
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
  },
  {
    id: 'uncommon-app',
    href: '/uncommon-app',
    icon: BookOpen,
    gradient: 'from-blue-500 to-cyan-500',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
  },
  {
    id: 'feature-hall',
    href: '/hall',
    icon: Building2,
    gradient: 'from-amber-500 to-orange-500',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
  },
  {
    id: 'forum',
    href: '/forum',
    icon: MessageSquare,
    gradient: 'from-emerald-500 to-teal-500',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
  },
];

// 成功案例数据
const stories = [
  {
    school: 'MIT',
    program: 'Computer Science',
    gradient: 'from-red-500 to-orange-500',
    storyKey: 'story1',
  },
  {
    school: 'Stanford',
    program: 'MBA',
    gradient: 'from-blue-500 to-cyan-500',
    storyKey: 'story2',
  },
  {
    school: 'CMU',
    program: 'Data Science',
    gradient: 'from-emerald-500 to-teal-500',
    storyKey: 'story3',
  },
];

export default function HomePage() {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();
  const [hasScrolled, setHasScrolled] = useState(false);
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as Locale;

  // 滚动监听
  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    router.replace('/', { locale: newLocale });
  };

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // 统计数据
  const stats = [
    { icon: FileText, value: '10,000+', label: t('home.stats.cases'), color: 'primary' as const },
    { icon: Building2, value: '500+', label: t('home.stats.schools'), color: 'success' as const },
    { icon: TrendingUp, value: '95%', label: t('home.stats.accuracy'), color: 'warning' as const },
    { icon: Users, value: '24/7', label: t('home.stats.aiAssistant'), color: 'info' as const },
  ];

  // Why Choose Us 数据
  const whyChooseUs = [
    {
      icon: GraduationCap,
      titleKey: 'home.whyChooseUs.realData',
      descKey: 'home.whyChooseUs.realDataDesc',
    },
    {
      icon: TrendingUp,
      titleKey: 'home.whyChooseUs.smartAlgorithm',
      descKey: 'home.whyChooseUs.smartAlgorithmDesc',
    },
    {
      icon: Globe2,
      titleKey: 'home.whyChooseUs.globalCoverage',
      descKey: 'home.whyChooseUs.globalCoverageDesc',
    },
  ];

  // Footer 配置
  const footerSections = [
    {
      title: t('home.footer.products'),
      links: [
        { label: t('home.modules.findCollege.title'), href: '/find-college' },
        { label: t('home.modules.uncommonApp.title'), href: '/uncommon-app' },
        { label: t('home.modules.featureHall.title'), href: '/hall' },
        { label: t('home.modules.forum.title'), href: '/forum' },
      ],
    },
    {
      title: t('home.footer.resources'),
      links: [
        { label: t('home.footer.helpCenter'), href: '/help' },
        { label: t('home.privacy'), href: '/privacy' },
        { label: t('home.terms'), href: '/terms' },
        { label: t('home.aboutUs'), href: '/about' },
      ],
    },
    {
      title: t('home.footer.contact'),
      links: [{ label: 'contact@studyabroad.com', href: 'mailto:contact@studyabroad.com' }],
    },
  ];

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Header - 滚动时添加毛玻璃效果 */}
      <motion.header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 px-4 transition-all duration-300',
          hasScrolled ? 'py-2 sm:py-3 glass border-b border-border/50 shadow-sm' : 'py-3 sm:py-4'
        )}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={hasScrolled ? 'sm' : 'md'} />
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 sm:gap-2 text-dropdown-muted hover:text-dropdown hover:bg-accent"
                  suppressHydrationWarning
                >
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline" suppressHydrationWarning>
                    {localeNames[locale]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-dropdown border-dropdown">
                {(Object.entries(localeNames) as [Locale, string][]).map(([loc, name]) => (
                  <DropdownMenuItem
                    key={loc}
                    onClick={() => handleLocaleChange(loc)}
                    className={cn(
                      'text-dropdown-muted hover:text-dropdown hover:bg-accent cursor-pointer',
                      locale === loc && 'bg-accent text-dropdown'
                    )}
                  >
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center overflow-hidden bg-gradient-hero pt-20 sm:pt-24 pb-12 sm:pb-16"
      >
        <HeroBackground prefersReducedMotion={prefersReducedMotion} />

        <motion.div
          className="container relative mx-auto px-4 z-10"
          style={prefersReducedMotion ? {} : { y: heroY, opacity: heroOpacity }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left">
              {/* Badge */}
              <motion.div
                className="mb-4 sm:mb-6 inline-flex items-center gap-2 sm:gap-3 rounded-md border-2 border-primary/30 bg-primary/5 px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm"
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              >
                <div className="flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-md bg-primary/10">
                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                </div>
                <span className="font-medium text-primary">{t('home.badge')}</span>
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              </motion.div>

              {/* Title */}
              <motion.h1
                className="mb-4 sm:mb-6 text-3xl font-bold tracking-tight text-hero sm:text-4xl lg:text-5xl xl:text-6xl"
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, ...transitions.springGentle }}
              >
                <span className="block">{t('common.appName')}</span>
                <motion.span
                  className="mt-1 sm:mt-2 block text-primary"
                  initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {t('home.heroTitle')}
                </motion.span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                className="mb-6 sm:mb-8 max-w-xl text-base text-hero-subtitle sm:text-lg lg:text-xl mx-auto lg:mx-0"
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {t('home.heroSubtitle')}
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                className="flex flex-col sm:flex-row justify-center lg:justify-start gap-3 sm:gap-4 mb-6 sm:mb-8"
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Link href="/register">
                  <motion.div
                    whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                  >
                    <Button
                      size="lg"
                      className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold"
                    >
                      {t('common.register')}
                      <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/login">
                  <motion.div
                    whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                  >
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base"
                    >
                      {t('common.login')}
                    </Button>
                  </motion.div>
                </Link>
              </motion.div>

              {/* Feature List */}
              <motion.div
                className="flex flex-wrap justify-center lg:justify-start gap-x-4 sm:gap-x-6 gap-y-2"
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                {[
                  { icon: CheckCircle, text: t('home.heroLeft.top100') },
                  { icon: CheckCircle, text: t('home.heroLeft.aiAnalysis') },
                  { icon: CheckCircle, text: t('home.heroLeft.realTimeData') },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 sm:gap-2 text-hero-feature text-xs sm:text-sm"
                  >
                    <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                    <span>{item.text}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: Feature Preview - 移动端隐藏 */}
            <motion.div
              className="hidden lg:block relative"
              initial={prefersReducedMotion ? {} : { opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <HeroFeaturePreview t={t} prefersReducedMotion={prefersReducedMotion} />
            </motion.div>
          </div>

          {/* Stats */}
          <motion.div
            className="mx-auto mt-12 sm:mt-16 grid max-w-4xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            {stats.map((stat, index) => (
              <EnhancedStatCard
                key={stat.label}
                icon={stat.icon}
                value={stat.value}
                label={stat.label}
                color={stat.color}
                index={index}
              />
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Modules Section */}
      <section className="bg-background py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <SectionHeader title={t('home.modules.title')} subtitle={t('home.modules.subtitle')} />

          <div className="mx-auto max-w-6xl grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {mainModules.map((module, index) => {
              const moduleKeys = ['findCollege', 'uncommonApp', 'featureHall', 'forum'];
              const moduleKey = moduleKeys[index];
              return (
                <FeaturePreviewCard
                  key={module.id}
                  icon={module.icon}
                  title={t(`home.modules.${moduleKey}.title`)}
                  description={t(`home.modules.${moduleKey}.desc`)}
                  gradient={module.gradient}
                  iconBg={module.iconBg}
                  iconColor={module.iconColor}
                  href={module.href}
                  index={index}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <WhyChooseUsSection items={whyChooseUs} t={t} prefersReducedMotion={prefersReducedMotion} />

      {/* Success Stories */}
      <section className="bg-muted/30 border-y py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <SectionHeader title={t('home.stories.title')} subtitle={t('home.stories.subtitle')} />

          <div className="mx-auto max-w-6xl grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story, index) => (
              <TestimonialCard
                key={story.storyKey}
                name={t(`home.stories.${story.storyKey}.name`)}
                avatar={t(`home.stories.${story.storyKey}.avatar`)}
                background={t(`home.stories.${story.storyKey}.background`)}
                school={story.school}
                program={story.program}
                result={t(`home.stories.${story.storyKey}.result`)}
                quote={t(`home.stories.${story.storyKey}.quote`)}
                gradient={story.gradient}
                index={index}
              />
            ))}
          </div>

          <motion.div
            className="text-center mt-8 sm:mt-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            <Link href="/cases">
              <Button
                variant="outline"
                size="lg"
                className="group h-10 sm:h-11 px-5 sm:px-6 text-sm"
              >
                {t('home.stories.viewMore')}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection
        badge={t('home.ctaBadge')}
        title={t('home.ctaTitle')}
        subtitle={t('home.ctaSubtitle')}
        primaryAction={{ label: t('home.ctaButton'), href: '/register' }}
        secondaryAction={{ label: t('home.viewCases'), href: '/cases' }}
        features={[t('home.ctaFeature1'), t('home.ctaFeature2'), t('home.ctaFeature3')]}
      />

      {/* Footer */}
      <LandingFooter
        description={t('home.footer.description')}
        sections={footerSections}
        copyright={t('home.copyright')}
      />
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
        <div className="absolute -left-40 -top-40 h-60 sm:h-80 w-60 sm:w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-60 sm:h-80 w-60 sm:w-80 rounded-full bg-primary/10 blur-3xl" />
      </>
    );
  }

  return (
    <>
      <div className="absolute inset-0 bg-grid opacity-30" />
      <motion.div
        className="absolute -left-40 -top-40 h-60 sm:h-80 w-60 sm:w-80 rounded-full bg-primary/20 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, 20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 h-60 sm:h-80 w-60 sm:w-80 rounded-full bg-primary/10 blur-3xl"
        animate={{ x: [0, -20, 0], y: [0, -30, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

// ============================================
// Hero Demo Preview - 视频轮播风格
// ============================================
function HeroFeaturePreview({
  t,
  prefersReducedMotion,
}: {
  t: ReturnType<typeof useTranslations>;
  prefersReducedMotion: boolean | null;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const demoSteps = [
    {
      icon: Target,
      gradient: 'from-violet-500 to-purple-600',
      bgColor: 'bg-violet-500/10',
      iconColor: 'text-violet-500',
    },
    {
      icon: BarChart3,
      gradient: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
    },
    {
      icon: Award,
      gradient: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
    },
    {
      icon: MessageSquare,
      gradient: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
    },
  ];

  // 自动播放
  useEffect(() => {
    if (!isPlaying || prefersReducedMotion) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % demoSteps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isPlaying, prefersReducedMotion, demoSteps.length]);

  const currentStep = demoSteps[activeStep];
  const CurrentIcon = currentStep.icon;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsPlaying(false)}
      onMouseLeave={() => setIsPlaying(true)}
    >
      {/* 装饰背景 */}
      <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-3xl blur-2xl" />

      {/* 主卡片 - 模拟应用界面 */}
      <motion.div
        className="relative rounded-2xl border-2 border-border/50 bg-card/95 backdrop-blur-sm shadow-2xl overflow-hidden"
        whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
        transition={{ duration: 0.3 }}
      >
        {/* 顶部工具栏 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-4">
            <div className="h-6 bg-muted rounded-md flex items-center px-3">
              <span className="text-xs text-muted-foreground">studyabroad.app</span>
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-6">
          {/* 步骤进度指示器 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-1">
              {demoSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveStep(index)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    activeStep === index
                      ? 'w-8 bg-primary'
                      : index < activeStep
                        ? 'w-4 bg-primary/50'
                        : 'w-4 bg-muted'
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {t('home.demoFlow.badge')}
            </span>
          </div>

          {/* 动画内容 - 轮播（固定高度防止布局抖动） */}
          <div className="relative h-[340px] overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={activeStep}
                className="absolute inset-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                {/* 步骤图标和标题 */}
                <div className="flex items-start gap-4 mb-6">
                  <motion.div
                    className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg',
                      currentStep.gradient
                    )}
                    animate={prefersReducedMotion ? {} : { scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <CurrentIcon className="w-7 h-7 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">
                      {t('home.demoFlow.stepIndicator', { current: activeStep + 1 })}
                    </div>
                    <h3 className="text-lg font-semibold">
                      {t(`home.demo.step${activeStep + 1}.title`)}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t(`home.demo.step${activeStep + 1}.desc`)}
                    </p>
                  </div>
                </div>

                {/* 模拟界面内容 - 根据步骤显示不同内容 */}
                <DemoStepContent step={activeStep} gradient={currentStep.gradient} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* 播放状态指示 */}
        <div className="absolute bottom-4 right-4">
          <motion.div
            className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer"
            onClick={() => setIsPlaying(!isPlaying)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            {isPlaying ? (
              <div className="flex gap-0.5">
                <motion.div
                  className="w-1 h-3 bg-primary rounded-full"
                  animate={{ scaleY: [1, 0.5, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
                <motion.div
                  className="w-1 h-3 bg-primary rounded-full"
                  animate={{ scaleY: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              </div>
            ) : (
              <svg className="w-3 h-3 text-primary ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* 浮动装饰元素 */}
      {!prefersReducedMotion && (
        <>
          <motion.div
            className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/20 to-transparent blur-xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-transparent blur-xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          />
        </>
      )}
    </div>
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
  items: { icon: typeof GraduationCap; titleKey: string; descKey: string }[];
  t: ReturnType<typeof useTranslations>;
  prefersReducedMotion: boolean | null;
}) {
  return (
    <section className="bg-background py-12 sm:py-16 lg:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:gap-12 lg:grid-cols-2 lg:items-center">
            {/* Left: Content */}
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={transitions.springGentle}
            >
              <h2 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
                {t('home.whyChooseUs.title')}
              </h2>
              <p className="mt-3 sm:mt-4 text-muted-foreground text-sm sm:text-base">
                {t('home.whyChooseUs.subtitle')}
              </p>

              <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6">
                {items.map((item, index) => (
                  <motion.div
                    key={index}
                    className="flex gap-3 sm:gap-4"
                    initial={prefersReducedMotion ? {} : { opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                  >
                    <motion.div
                      className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                      whileHover={prefersReducedMotion ? {} : { scale: 1.1, rotate: 5 }}
                    >
                      <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </motion.div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">{t(item.titleKey)}</h3>
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                        {t(item.descKey)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right: Preview Card */}
            <motion.div
              className="hidden lg:block relative"
              initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5" />
              <Card className="relative shadow-xl">
                <div className="h-1.5 bg-primary rounded-t-xl" />
                <CardContent className="pt-6 pb-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70" />
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
                          whileInView={{ scale: 1, opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                        >
                          <div className="text-xl sm:text-2xl font-bold text-primary">{value}%</div>
                          <div className="text-xs text-muted-foreground">
                            {t('home.whyChooseUs.admissionRate')}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    {/* Simulated school match list */}
                    <div className="space-y-2">
                      {[
                        { name: 'Stanford University', match: 92 },
                        { name: 'MIT', match: 85 },
                        { name: 'UC Berkeley', match: 78 },
                      ].map((school, i) => (
                        <motion.div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                          initial={prefersReducedMotion ? {} : { opacity: 0, y: 8 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.7 + i * 0.1 }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                              <GraduationCap className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span className="text-xs font-medium">{school.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${school.match}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-primary">
                              {school.match}%
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Demo Step Content - 每个步骤的详细模拟界面
// ============================================
function DemoStepContent({ step, gradient }: { step: number; gradient: string }) {
  const t = useTranslations();
  // 步骤1: 智能选校 - 筛选界面
  if (step === 0) {
    return (
      <div className="space-y-3">
        {/* 搜索栏 */}
        <div className="h-9 bg-muted/50 rounded-lg flex items-center px-3 gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {t('home.demoUI.step1.searchPlaceholder')}
          </span>
          <div className="flex-1" />
          <div className="flex gap-1">
            <div className="px-2 py-0.5 rounded bg-violet-500/20 text-2xs text-violet-600">
              {t('home.demoUI.step1.filterUS')}
            </div>
            <div className="px-2 py-0.5 rounded bg-blue-500/20 text-2xs text-blue-600">
              {t('home.demoUI.step1.filterTop50')}
            </div>
          </div>
        </div>
        {/* 筛选条件 */}
        <div className="flex gap-2 flex-wrap">
          <div className="px-2.5 py-1 rounded-md bg-muted/50 border border-border/50 text-2xs flex items-center gap-1">
            <Building2 className="w-3 h-3" /> {t('home.demoUI.step1.filterPrivate')}
          </div>
          <div className="px-2.5 py-1 rounded-md bg-muted/50 border border-border/50 text-2xs flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> {t('home.demoUI.step1.filterHighRanking')}
          </div>
          <div className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/30 text-2xs text-primary flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> {t('home.demoUI.step1.filterCSMajor')}
          </div>
        </div>
        {/* 学校列表 */}
        <div className="space-y-2">
          {[
            { name: 'MIT', rank: '#1', rate: '4%', color: 'bg-red-500' },
            { name: 'Stanford', rank: '#3', rate: '4%', color: 'bg-red-600' },
            { name: 'CMU', rank: '#7', rate: '11%', color: 'bg-blue-500' },
          ].map((school, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/50"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-md flex items-center justify-center text-white text-2xs font-bold',
                  school.color
                )}
              >
                {school.rank}
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium">{school.name}</div>
                <div className="text-2xs text-muted-foreground">
                  {t('home.demoUI.step1.acceptance', { rate: school.rate })}
                </div>
              </div>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </motion.div>
          ))}
        </div>
        {/* 按钮 */}
        <div className="flex gap-2 pt-1">
          <div
            className={cn(
              'h-8 flex-1 rounded-lg bg-gradient-to-r flex items-center justify-center',
              gradient
            )}
          >
            <span className="text-2xs text-white font-medium">
              {t('home.demoUI.step1.viewAllSchools')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 步骤2: AI分析 - 数据分析界面
  if (step === 1) {
    return (
      <div className="space-y-3">
        {/* 用户档案 */}
        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/50">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
            YT
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium">{t('home.demoUI.step2.yourProfile')}</div>
            <div className="text-2xs text-muted-foreground">
              {t('home.demoUI.step2.profileDetail')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-blue-500">85</div>
            <div className="text-2xs text-muted-foreground">{t('home.demoUI.step2.score')}</div>
          </div>
        </div>
        {/* 录取概率 */}
        <div className="grid grid-cols-3 gap-2">
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
              className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className={cn('text-lg font-bold', item.color)}>{item.value}%</div>
              <div className="text-2xs text-muted-foreground">{item.label}</div>
              <div className="h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', item.bg)}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.value}%` }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
        {/* 提升建议 */}
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span className="text-2xs font-medium text-blue-600">
              {t('home.demoUI.step2.aiSuggestion')}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground">{t('home.demoUI.step2.suggestionText')}</p>
        </div>
        {/* 按钮 */}
        <div className="flex gap-2">
          <div
            className={cn(
              'h-8 flex-1 rounded-lg bg-gradient-to-r flex items-center justify-center',
              gradient
            )}
          >
            <span className="text-2xs text-white font-medium">
              {t('home.demoUI.step2.fullAnalysis')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 步骤3: 申请规划 - 时间线界面
  if (step === 2) {
    return (
      <div className="space-y-3">
        {/* 进度概览 */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50">
          <div>
            <div className="text-xs font-medium">{t('home.demoUI.step3.applicationProgress')}</div>
            <div className="text-2xs text-muted-foreground">
              {t('home.demoUI.step3.tasksCompleted')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-amber-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '37.5%' }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="text-xs font-bold text-amber-500">38%</span>
          </div>
        </div>
        {/* 任务时间线 */}
        <div className="space-y-2">
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
                'flex items-center gap-3 p-2 rounded-lg border',
                item.status === 'current'
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-muted/30 border-border/50'
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center',
                  item.status === 'done'
                    ? 'bg-emerald-500'
                    : item.status === 'current'
                      ? 'bg-amber-500'
                      : 'bg-muted'
                )}
              >
                {item.status === 'done' ? (
                  <CheckCircle className="w-3 h-3 text-white" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1">
                <div className={cn('text-xs', item.status === 'current' ? 'font-medium' : '')}>
                  {item.task}
                </div>
              </div>
              <div className="text-2xs text-muted-foreground">{item.date}</div>
            </motion.div>
          ))}
        </div>
        {/* 按钮 */}
        <div className="flex gap-2">
          <div
            className={cn(
              'h-8 flex-1 rounded-lg bg-gradient-to-r flex items-center justify-center',
              gradient
            )}
          >
            <span className="text-2xs text-white font-medium">
              {t('home.demoUI.step3.viewTimeline')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 步骤4: 社区互动 - 论坛界面
  return (
    <div className="space-y-3">
      {/* 热门话题 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{t('home.demoUI.step4.trendingTopics')}</span>
        <span className="text-2xs text-primary">{t('home.demoUI.step4.viewAll')}</span>
      </div>
      {/* 帖子列表 */}
      <div className="space-y-2">
        {[
          {
            title: t('home.demoUI.step4.post1Title'),
            tag: t('home.demoUI.step4.post1Tag'),
            replies: 128,
            color: 'bg-red-500/20 text-red-600',
          },
          {
            title: t('home.demoUI.step4.post2Title'),
            tag: t('home.demoUI.step4.post2Tag'),
            replies: 56,
            color: 'bg-blue-500/20 text-blue-600',
          },
          {
            title: t('home.demoUI.step4.post3Title'),
            tag: t('home.demoUI.step4.post3Tag'),
            replies: 89,
            color: 'bg-emerald-500/20 text-emerald-600',
          },
        ].map((post, i) => (
          <motion.div
            key={i}
            className="p-2 rounded-lg bg-muted/30 border border-border/50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-2xs font-bold shrink-0">
                {['A', 'B', 'C'][i]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{post.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('px-1.5 py-0.5 rounded text-2xs', post.color)}>
                    {post.tag}
                  </span>
                  <span className="text-2xs text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> {post.replies}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      {/* 消息提示 */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
          <Users className="w-3 h-3 text-white" />
        </div>
        <div className="flex-1">
          <span className="text-2xs text-emerald-600">{t('home.demoUI.step4.connectMessage')}</span>
        </div>
      </div>
      {/* 按钮 */}
      <div className="flex gap-2">
        <div
          className={cn(
            'h-8 flex-1 rounded-lg bg-gradient-to-r flex items-center justify-center',
            gradient
          )}
        >
          <span className="text-2xs text-white font-medium">
            {t('home.demoUI.step4.joinCommunity')}
          </span>
        </div>
      </div>
    </div>
  );
}

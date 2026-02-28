'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import { transitions } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Magnetic } from '@/components/ui/tilt-card';
import { ProductPreview } from './product-preview';

export function HeroSection() {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const previewScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);
  const previewOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0.6]);
  const contentY = useTransform(scrollYProgress, [0, 0.5], ['0%', '15%']);

  const features = [
    { text: t('home.heroLeft.top100') },
    { text: t('home.heroLeft.aiAnalysis') },
    { text: t('home.heroLeft.realTimeData') },
  ];

  const titleLine1 = t('common.appName');
  const titleLine2 = t('home.heroTitle');

  return (
    <section
      ref={heroRef}
      className="relative min-h-[92vh] flex items-center overflow-hidden bg-gradient-hero pt-20 sm:pt-24 pb-8 sm:pb-12"
    >
      {/* Background */}
      <HeroBackground prefersReducedMotion={prefersReducedMotion} />

      {/* Content */}
      <motion.div
        className="container relative mx-auto px-4 z-10"
        style={prefersReducedMotion ? {} : { y: contentY }}
      >
        {/* Two-column layout: text left, horizontal preview right */}
        <div className="grid gap-10 md:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1.1fr] xl:grid-cols-[1fr_1.2fr] md:gap-8 lg:gap-12 items-center">
          {/* Left: Text content */}
          <div className="text-center md:text-left min-w-0">
            {/* Badge */}
            <motion.div
              className="mb-4 sm:mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md px-4 sm:px-5 py-2 text-xs sm:text-sm shadow-[0_0_20px_oklch(0.58_0.22_255_/_0.15)] relative overflow-hidden"
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            >
              <div className="absolute inset-0 animate-shimmer opacity-40" />
              <Sparkles className="relative h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              <span className="relative font-medium text-primary">{t('home.badge')}</span>
              <div className="relative h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </motion.div>

            {/* Title */}
            <h1 className="mb-5 sm:mb-8 hero-title-glow">
              <motion.span
                className="block text-display-hero text-hero tracking-normal"
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <TitleLine text={titleLine1} delay={0.2} reduced={!!prefersReducedMotion} />
              </motion.span>
              <motion.span
                className="block mt-2 sm:mt-3 text-display-hero text-gradient-animated tracking-normal"
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <TitleLine text={titleLine2} delay={0.4} reduced={!!prefersReducedMotion} />
              </motion.span>
            </h1>

            {/* Subtitle */}
            <motion.p
              className="mb-6 sm:mb-8 max-w-xl text-base text-hero-subtitle sm:text-lg lg:text-xl mx-auto md:mx-0 leading-relaxed font-medium"
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              {t('home.heroSubtitle')}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row justify-center md:justify-start gap-3 sm:gap-4 mb-8 sm:mb-10"
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Magnetic intensity={0.3}>
                <Link href="/register">
                  <motion.div
                    whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                  >
                    <Button
                      size="lg"
                      className="w-full sm:w-auto h-12 px-6 sm:px-8 lg:h-14 lg:px-10 text-sm sm:text-base lg:text-lg font-semibold btn-gradient-primary btn-glow rounded-xl"
                    >
                      {t('home.ctaButton')}
                      <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </motion.div>
                </Link>
              </Magnetic>
              <Magnetic intensity={0.2}>
                <Link href="/login">
                  <motion.div
                    whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                  >
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full sm:w-auto h-12 px-6 sm:px-8 lg:h-14 lg:px-10 text-sm sm:text-base backdrop-blur-sm rounded-xl border-primary/10 text-foreground/80 hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
                    >
                      {t('common.login')}
                    </Button>
                  </motion.div>
                </Link>
              </Magnetic>
            </motion.div>

            {/* Feature list */}
            <motion.div
              className="flex flex-wrap justify-center md:justify-start gap-x-4 sm:gap-x-6 gap-y-2"
              initial={prefersReducedMotion ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {features.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-hero-feature text-xs sm:text-sm"
                >
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                  <span>{item.text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Product Preview — horizontal layout */}
          <motion.div
            className="relative mx-auto w-full max-w-2xl lg:max-w-none min-w-0"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, ...transitions.springGentle }}
            style={prefersReducedMotion ? {} : { scale: previewScale, opacity: previewOpacity }}
          >
            {/* Glow behind preview */}
            <div className="absolute -inset-4 sm:-inset-6 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-violet-500/10 blur-xl pointer-events-none" />
            <div className="relative w-full">
              <ProductPreview />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

// Animated title with per-word stagger
function TitleLine({ text, delay, reduced }: { text: string; delay: number; reduced: boolean }) {
  if (reduced) return <>{text}</>;

  const words = text.split(/(\s+)/);
  return (
    <>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: delay + i * 0.06,
            type: 'spring',
            stiffness: 200,
            damping: 20,
          }}
        >
          {word === ' ' ? '\u00A0' : word}
        </motion.span>
      ))}
    </>
  );
}

function HeroBackground({ prefersReducedMotion }: { prefersReducedMotion: boolean | null }) {
  return (
    <>
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className={cn('aurora-bg', prefersReducedMotion && '[animation-play-state:paused]')} />
      <div
        className={cn(
          'hero-orb hero-orb-1',
          prefersReducedMotion && '[animation-play-state:paused]'
        )}
      />
      <div
        className={cn(
          'hero-orb hero-orb-2',
          prefersReducedMotion && '[animation-play-state:paused]'
        )}
      />
      <div
        className={cn(
          'hero-orb hero-orb-3',
          prefersReducedMotion && '[animation-play-state:paused]'
        )}
      />
      <div className="absolute inset-0 bg-noise pointer-events-none z-[1]" />
    </>
  );
}

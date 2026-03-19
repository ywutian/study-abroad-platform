'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle, Quote, Star } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { FadeInView } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

const stories = [
  {
    storyKey: 'story1',
    school: 'MIT',
    program: 'Computer Science',
    color: 'border-l-red-500',
    gradient: 'from-red-500 to-orange-500',
    tall: true,
  },
  {
    storyKey: 'story2',
    school: 'Stanford',
    program: 'MBA',
    color: 'border-l-blue-500',
    gradient: 'from-blue-500 to-cyan-500',
    tall: false,
  },
  {
    storyKey: 'story3',
    school: 'CMU',
    program: 'Data Science',
    color: 'border-l-emerald-500',
    gradient: 'from-emerald-500 to-teal-500',
    tall: true,
  },
];

export function SocialProof() {
  const t = useTranslations();
  const _prefersReducedMotion = useReducedMotion();

  return (
    <section id="testimonials" className="zone-dark section-expansive relative overflow-hidden">
      <div className="container relative mx-auto px-4">
        {/* Pull Quote */}
        <ScrollReveal
          variant="blur"
          className="mx-auto max-w-3xl text-center mb-8 sm:mb-12 lg:mb-16"
        >
          <Quote className="h-8 w-8 sm:h-10 sm:w-10 text-primary/30 mx-auto mb-4" />
          <blockquote className="text-display-section italic text-gradient-animated">
            &ldquo;{t('home.stories.story1.quote')}&rdquo;
          </blockquote>
          <div className="mt-4 sm:mt-6 flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
              {t('home.stories.story1.avatar')}
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[var(--zone-fg)]">
                {t('home.stories.story1.name')}
              </p>
              <p className="text-xs text-[var(--zone-muted)]">
                MIT &apos;27 · {t('home.stories.story1.background')}
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* Testimonial cards — mobile: horizontal scroll, md+: grid */}
        <div className="relative">
          {/* Mobile: horizontal scroll */}
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:hidden">
            {stories.map((story, index) => (
              <TestimonialCard key={story.storyKey} story={story} index={index} t={t} />
            ))}
            <GhostCard t={t} />
          </div>

          {/* md+: grid layout */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stories.map((story, index) => (
              <FadeInView key={story.storyKey} direction="up" delay={index * 0.1}>
                <TestimonialCard story={story} index={index} t={t} isGrid />
              </FadeInView>
            ))}
          </div>
        </div>

        {/* Aggregate rating */}
        <div className="mt-8 sm:mt-12 flex items-center justify-center gap-2 text-[var(--zone-muted)]">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 15 }}
              >
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </motion.div>
            ))}
          </div>
          <span className="text-sm font-semibold text-[var(--zone-fg)]">4.9/5</span>
          <span className="text-sm">·</span>
          <span className="text-sm">{t('home.socialProofRating')}</span>
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({
  story,
  index: _index,
  t,
  isGrid = false,
}: {
  story: (typeof stories)[number];
  index: number;
  t: ReturnType<typeof useTranslations>;
  isGrid?: boolean;
}) {
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div
      className={cn(
        'group relative rounded-xl bg-[var(--zone-card)] border border-[var(--zone-border)] overflow-hidden',
        'transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
        'border-l-4 md:backdrop-blur-sm',
        story.color,
        isGrid
          ? 'min-h-[240px]'
          : 'w-[calc(100vw-3rem)] sm:w-[320px] shrink-0 snap-center min-h-[240px]'
      )}
      onMouseMove={handleMouseMove}
    >
      {/* Cursor glow — hover devices only */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-300 z-0"
        style={{
          background:
            'radial-gradient(300px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), oklch(0.58 0.22 255 / 0.08), transparent 60%)',
        }}
      />
      <div className="relative z-10 p-4 sm:p-5 lg:p-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-11 h-11 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br shadow-md text-sm',
                story.gradient
              )}
            >
              {t(`home.stories.${story.storyKey}.avatar`)}
            </div>
            <div>
              <p className="font-semibold text-sm text-[var(--zone-fg)]">
                {t(`home.stories.${story.storyKey}.name`)}
              </p>
              <p className="text-xs text-[var(--zone-muted)]">
                {t(`home.stories.${story.storyKey}.background`)}
              </p>
            </div>
          </div>
        </div>

        {/* Result badge */}
        <div className="mb-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white rounded-full bg-gradient-to-r',
              story.gradient
            )}
          >
            <CheckCircle className="h-3 w-3" />
            {story.school} · {t(`home.stories.${story.storyKey}.result`)}
          </span>
        </div>

        {/* Quote */}
        <blockquote className="flex-1 text-sm text-[var(--zone-muted)] leading-relaxed">
          &ldquo;{t(`home.stories.${story.storyKey}.quote`)}&rdquo;
        </blockquote>
      </div>
    </div>
  );
}

function GhostCard({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Link href="/cases" className="snap-center">
      <div className="w-[calc(100vw-5rem)] sm:w-[240px] shrink-0 rounded-xl border-2 border-dashed border-[var(--zone-border)] min-h-[240px] flex flex-col items-center justify-center gap-3 text-[var(--zone-muted)] hover:text-[var(--zone-fg)] hover:border-primary/30 transition-all duration-300 cursor-pointer">
        <div className="w-12 h-12 rounded-full bg-[var(--zone-card)] flex items-center justify-center">
          <ArrowRight className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium">{t('home.stories.viewMore')}</span>
      </div>
    </Link>
  );
}

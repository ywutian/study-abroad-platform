'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { useHomeContent } from './home-content';

export function SocialProof() {
  const home = useHomeContent();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="landing-section relative overflow-hidden bg-[color:var(--landing-surface)]/62">
      <PageContainer variant="marketing">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <div className="landing-kicker">{home.social.eyebrow}</div>
          <h2 className="mt-4 text-display-section text-[var(--landing-fg)]">
            {home.social.title}
          </h2>
          {home.social.subtitle ? (
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--landing-muted)] sm:text-lg">
              {home.social.subtitle}
            </p>
          ) : null}
        </motion.div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-[color:var(--landing-border)] bg-[var(--landing-border)] sm:grid-cols-2 xl:grid-cols-4">
          {home.social.stats.map((stat, index) => (
            <motion.div
              key={`${stat.value}-${stat.label}`}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="bg-[color:var(--landing-surface)] px-6 py-7"
            >
              <div className="text-display-section font-semibold leading-none tracking-[-0.04em] text-[var(--landing-fg)]">
                {stat.value}
              </div>
              <div className="mt-3 text-2xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {home.social.quotes.map((quote, index) => (
            <motion.article
              key={quote.name}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.24 }}
              transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-6 py-6 shadow-[var(--landing-shadow-card)]"
            >
              <Quote className="absolute right-6 top-6 h-10 w-10 text-primary/12" />

              <div className="landing-serif text-subtitle italic leading-relaxed tracking-[-0.01em] text-[var(--landing-fg)]">
                “{quote.quote}”
              </div>

              <div className="mt-8 flex items-center gap-4 border-t border-[color:var(--landing-border)] pt-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)] text-lg font-semibold text-[var(--landing-fg)]">
                  {quote.monogram}
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--landing-fg)]">{quote.name}</div>
                  <div className="text-xs text-[var(--landing-muted)]">{quote.meta}</div>
                </div>
                <span className="ml-auto rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)] px-3 py-1 text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
                  {quote.tag}
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}

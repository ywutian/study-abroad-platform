'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Anchor, FileSearch, SlidersHorizontal, UserCheck } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { useHomeContent } from './home-content';

const principleIcons = [Anchor, SlidersHorizontal, UserCheck, FileSearch] as const;

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

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {home.social.principles.map((principle, index) => {
            const Icon = principleIcons[index] ?? Anchor;
            return (
              <motion.article
                key={principle.title}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.24 }}
                transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-6 py-6 shadow-[var(--landing-shadow-card)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)] text-[var(--landing-muted)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-2xl font-bold tracking-tight text-[var(--landing-fg)]">
                  {principle.title}
                </h3>
                <p className="landing-serif mt-3 text-base leading-8 text-[var(--landing-muted)] sm:text-lg">
                  {principle.body}
                </p>
              </motion.article>
            );
          })}
        </div>
      </PageContainer>
    </section>
  );
}

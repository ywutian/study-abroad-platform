'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { PageContainer } from '@/components/layout/page-container';
import { useHomeContent } from './home-content';

export function TrustBar() {
  const home = useHomeContent();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative border-y border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/58 py-10 sm:py-12">
      <PageContainer variant="marketing">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-center text-2xs uppercase tracking-[0.3em] text-[var(--landing-subtle)]">
            {home.trust.label}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {home.trust.stats.map((stat, index) => (
              <motion.div
                key={`${stat.value}-${stat.label}`}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/86 px-5 py-5 shadow-[var(--landing-shadow-card)]"
              >
                <div className="text-4xl font-semibold leading-none tracking-[-0.04em] text-[var(--landing-fg)] sm:text-5xl">
                  {stat.value}
                </div>
                <div className="mt-3 text-2xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="mt-8 border-t border-[color:var(--landing-border)] pt-6">
          <div className="landing-marquee-mask overflow-hidden">
            <div className="animate-marquee flex w-max gap-8 sm:gap-12">
              {[...home.trust.schools, ...home.trust.schools].map((school, index) => (
                <span
                  key={`${school}-${index}`}
                  className="text-xl font-medium tracking-[-0.02em] text-[var(--landing-muted)] sm:text-2xl"
                >
                  {school}
                </span>
              ))}
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}

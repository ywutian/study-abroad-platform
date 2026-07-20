'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Bot,
  Compass,
  LockKeyhole,
  MessageCircleHeart,
  Scale,
  School,
  UserRound,
} from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { cn } from '@/lib/utils';

import { useHomeContent } from './home-content';

const workflowIcons = [UserRound, School, Compass, Scale, MessageCircleHeart, LockKeyhole] as const;

export function HowItWorks() {
  const home = useHomeContent();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="workflow" className="landing-section relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[color:var(--landing-border)]/60" />

      <PageContainer variant="marketing" className="relative">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <div className="landing-kicker">{home.how.eyebrow}</div>
          <h2 className="mt-4 text-display-section text-[var(--landing-fg)]">{home.how.title}</h2>
          {home.how.subtitle ? (
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--landing-muted)] sm:text-lg">
              {home.how.subtitle}
            </p>
          ) : null}
        </motion.div>

        <ol className="relative mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {home.how.steps.map((step, index) => {
            const Icon = workflowIcons[index] ?? Bot;
            const isPreview = index === home.how.steps.length - 1;

            return (
              <motion.li
                key={step.number}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.24 }}
                transition={{
                  duration: 0.55,
                  delay: index * 0.07,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative"
              >
                {index < home.how.steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute left-[calc(50%+2rem)] right-[-1rem] top-8 z-0 hidden h-px bg-[color:var(--landing-border-strong)] xl:block"
                  />
                ) : null}

                <article
                  className={cn(
                    'relative z-10 flex h-full min-h-[292px] flex-col rounded-xl border bg-[color:var(--landing-surface)] p-5 shadow-[var(--landing-shadow-card)]',
                    isPreview
                      ? 'border-dashed border-[color:var(--landing-border-strong)] bg-[color:var(--landing-surface-muted)]/55'
                      : 'border-[color:var(--landing-border)]'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        'flex h-16 w-16 items-center justify-center rounded-full border bg-[color:var(--landing-surface)] shadow-sm',
                        isPreview
                          ? 'border-dashed border-[color:var(--landing-border-strong)] text-[var(--landing-subtle)]'
                          : 'border-[color:var(--landing-border-strong)] text-[var(--landing-fg)]'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-xs text-[var(--landing-subtle)]">
                      {step.number}
                    </span>
                  </div>

                  {step.tag ? (
                    <div className="mt-6 text-2xs uppercase tracking-[0.2em] text-[var(--landing-subtle)]">
                      {step.tag}
                    </div>
                  ) : null}
                  <h3 className="mt-3 text-xl font-semibold leading-7 tracking-[-0.025em] text-[var(--landing-fg)]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--landing-muted)]">
                    {step.description}
                  </p>

                  <div className="mt-auto pt-6">
                    <span
                      className={cn(
                        'block h-1 rounded-full',
                        isPreview
                          ? 'bg-[color:var(--landing-border-strong)]'
                          : 'bg-gradient-to-r from-[color:var(--ds-primary)] to-[color:var(--ds-accent)]'
                      )}
                    />
                  </div>
                </article>
              </motion.li>
            );
          })}
        </ol>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, delay: 0.22 }}
          className="mt-6 flex items-start gap-3 border-l-2 border-[color:var(--landing-border-strong)] pl-4 text-sm leading-7 text-[var(--landing-muted)]"
        >
          <Bot className="mt-1 h-4 w-4 shrink-0 text-[var(--landing-fg)]" />
          <span>{home.how.footer}</span>
        </motion.div>
      </PageContainer>
    </section>
  );
}

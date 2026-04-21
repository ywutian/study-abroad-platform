'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { PageContainer } from '@/components/layout/page-container';
import { cn } from '@/lib/utils';
import { useHomeContent } from './home-content';

type SignalNoiseCopy = {
  label: string;
  tabs: string[];
  notes: string[];
  footer: string;
};

type DecisionQuestionsCopy = {
  eyebrow: string;
  excerpt: string;
  stamp: string;
  questions: string[];
};

export function ProblemStatement() {
  const home = useHomeContent();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="landing-section">
      <PageContainer variant="marketing">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <div className="landing-kicker">{home.problem.eyebrow}</div>
          <h2 className="mt-4 text-display-section text-[var(--landing-fg)]">
            {home.problem.title}
          </h2>
          {home.problem.subtitle ? (
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--landing-muted)] sm:text-lg">
              {home.problem.subtitle}
            </p>
          ) : null}
        </motion.div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <SignalNoiseVisual reduced={!!prefersReducedMotion} />
          <DecisionQuestionsVisual reduced={!!prefersReducedMotion} />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {home.problem.items.map((item, index) => (
            <motion.article
              key={item.number}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.55,
                delay: index * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-6 py-7 shadow-[var(--landing-shadow-card)]"
            >
              <div className="flex items-end gap-4">
                <span className="text-4xl font-semibold leading-none tracking-[-0.04em] text-[var(--landing-subtle)]">
                  {item.number}
                </span>
                <span className="mb-2 h-px flex-1 bg-[var(--landing-border)]" />
              </div>
              <h3 className="mt-5 text-2xl font-bold tracking-tight text-[var(--landing-fg)]">
                {item.title}
              </h3>
              <p className="mt-4 text-sm leading-8 text-[var(--landing-muted)] sm:text-base">
                {item.description}
              </p>
            </motion.article>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}

function SignalNoiseVisual({ reduced }: { reduced: boolean }) {
  const t = useTranslations('home');
  const copy = t.raw('problem.visuals.signalNoise') as SignalNoiseCopy;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] shadow-[var(--landing-shadow-card)]"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)] px-5 py-4">
        <div className="text-2xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
          {copy.label}
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ds-status-reach)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ds-status-target)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ds-status-safety)]" />
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-[color:var(--landing-border)] sm:grid-cols-3 xl:grid-cols-6">
        {copy.tabs.map((tab) => (
          <div
            key={tab}
            className="truncate border-r border-[color:var(--landing-border)] px-4 py-3 text-xs text-[var(--landing-muted)] last:border-r-0"
          >
            {tab}
          </div>
        ))}
      </div>

      <div className="relative min-h-[320px] overflow-hidden px-6 py-6">
        <div className="landing-grid-mask absolute inset-0 opacity-45" />
        <div className="relative grid gap-3 sm:grid-cols-2">
          {copy.notes.map((note, index) => (
            <motion.div
              key={note}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              className={cn(
                'rounded-2xl border px-4 py-3 text-sm shadow-[var(--landing-shadow-card)]',
                index % 3 === 0 &&
                  'border-[color:var(--ds-status-target)]/20 bg-[color:var(--ds-status-target-bg)] text-[color:var(--ds-status-target-fg)]',
                index % 3 === 1 &&
                  'border-[color:var(--ds-status-safety)]/20 bg-[color:var(--ds-status-safety-bg)] text-[color:var(--ds-status-safety-fg)]',
                index % 3 === 2 &&
                  'border-[color:var(--ds-status-reach)]/20 bg-[color:var(--ds-status-reach-bg)] text-[color:var(--ds-status-reach-fg)]'
              )}
            >
              {note}
            </motion.div>
          ))}
        </div>

        <div className="relative mt-6 text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
          {copy.footer}
        </div>
      </div>
    </motion.div>
  );
}

function DecisionQuestionsVisual({ reduced }: { reduced: boolean }) {
  const t = useTranslations('home');
  const copy = t.raw('problem.visuals.decisionQuestions') as DecisionQuestionsCopy;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-6 py-6 shadow-[var(--landing-shadow-card)]"
    >
      <div className="absolute right-5 top-5 rounded-full border border-[color:var(--ds-status-reach)]/25 bg-[color:var(--ds-status-reach-bg)] px-3 py-1 text-2xs uppercase tracking-[0.22em] text-[color:var(--ds-status-reach-fg)]">
        {copy.stamp}
      </div>

      <div>
        <div className="text-2xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
          {copy.eyebrow}
        </div>
        <div className="mt-6 max-w-sm text-2xl italic leading-relaxed tracking-[-0.01em] text-[var(--landing-fg)]">
          {copy.excerpt}
        </div>
      </div>

      <div className="space-y-3 border-t border-[color:var(--landing-border)] pt-6">
        {copy.questions.map((question, index) => (
          <div
            key={question}
            className="flex items-start gap-3 text-sm text-[var(--landing-muted)]"
          >
            <span className="font-mono text-xs text-[var(--landing-subtle)]">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className={cn(index === copy.questions.length - 1 && 'text-[var(--landing-fg)]')}>
              {question}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

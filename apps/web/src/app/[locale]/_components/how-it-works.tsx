'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Bot, CalendarRange, FileText, Target } from 'lucide-react';
import { AdmissionTierBadge, StatusDot } from '@/components/features/landing';
import { PageContainer } from '@/components/layout/page-container';
import { cn } from '@/lib/utils';
import { useHomeContent } from './home-content';

type DashboardVisualCopy = {
  eyebrow: string;
  title: string;
  note: string;
  cards: string[];
  assistantBadge: string;
  tip: string;
  tasksLabel: string;
  tasks: string[];
  columns: string[];
};

export function HowItWorks() {
  const home = useHomeContent();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="landing-section relative">
      <PageContainer variant="marketing">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="landing-kicker justify-center">{home.how.eyebrow}</div>
          <h2 className="mt-4 text-display-section text-[var(--landing-fg)]">{home.how.title}</h2>
          {home.how.subtitle ? (
            <p className="mt-4 text-base leading-8 text-[var(--landing-muted)] sm:text-lg">
              {home.how.subtitle}
            </p>
          ) : null}
        </motion.div>

        <DashboardVisual reduced={!!prefersReducedMotion} />

        <div className="mt-10 grid gap-6 lg:grid-cols-4">
          {home.how.steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-6 py-6 shadow-[var(--landing-shadow-card)]"
            >
              <div className="flex items-center gap-4 lg:flex-col lg:items-start">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--landing-border-strong)] bg-gradient-to-br from-[color:var(--landing-surface-muted)] to-[color:var(--landing-surface)] text-2xl font-bold tracking-tight text-[var(--landing-fg)] shadow-sm">
                  {step.number}
                </div>
                <div className="lg:mt-4">
                  <h3 className="text-2xl font-bold tracking-tight text-balance text-[var(--landing-fg)]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-8 text-balance text-[var(--landing-muted)] sm:text-base">
                    {step.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}

function DashboardVisual({ reduced }: { reduced: boolean }) {
  const t = useTranslations('home');
  const copy = t.raw('how.dashboard') as DashboardVisualCopy;

  const rows = [
    { school: 'MIT EECS', tier: 'reach' as const, progress: 34 },
    { school: 'CMU CS', tier: 'reach' as const, progress: 46 },
    { school: 'Georgia Tech', tier: 'target' as const, progress: 71 },
    { school: 'UIUC CS+X', tier: 'target' as const, progress: 82 },
    { school: 'Purdue ECE', tier: 'safety' as const, progress: 93 },
  ];

  const icons = [Target, FileText, CalendarRange];

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="mt-10 overflow-hidden rounded-3xl border border-[color:var(--landing-border-strong)] bg-[color:var(--landing-surface)] shadow-[var(--landing-shadow-elevated)]"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/75 px-5 py-4">
        <div>
          <div className="text-2xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
            {copy.eyebrow}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--landing-fg)]">
            {copy.title}
          </div>
        </div>
        <div className="hidden text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)] md:block">
          {copy.note}
        </div>
      </div>

      <div className="grid gap-6 px-4 py-5 lg:grid-cols-[1.1fr_0.9fr] lg:px-6 lg:py-6">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {copy.cards.map((card, index) => {
              const Icon = icons[index];
              return (
                <div
                  key={card}
                  className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/55 px-4 py-4"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <div className="mt-4 text-sm font-medium text-[var(--landing-fg)]">{card}</div>
                </div>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-3xl border border-[color:var(--landing-border)]">
            <div className="grid grid-cols-[1.3fr_0.8fr_1fr] gap-3 border-b border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/72 px-4 py-3 text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
              {copy.columns.map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
            <div className="divide-y divide-[color:var(--landing-border)]">
              {rows.map((row) => (
                <div
                  key={row.school}
                  className="grid grid-cols-[1.3fr_0.8fr_1fr] gap-3 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-[var(--landing-fg)]">{row.school}</span>
                  <AdmissionTierBadge tier={row.tier} />
                  <span className="flex items-center gap-3">
                    <span className="h-2 flex-1 rounded-full bg-[var(--landing-border)]">
                      <span
                        className={cn(
                          'block h-2 rounded-full',
                          row.tier === 'reach' && 'bg-[color:var(--ds-status-reach)]',
                          row.tier === 'target' && 'bg-[color:var(--ds-status-target)]',
                          row.tier === 'safety' && 'bg-[color:var(--ds-status-safety)]'
                        )}
                        style={{ width: `${row.progress}%` }}
                      />
                    </span>
                    <span className="font-mono text-xs text-[var(--landing-muted)]">
                      {row.progress}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/55 px-5 py-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-3 py-2 text-2xs uppercase tracking-[0.18em] text-[var(--landing-muted)]">
              <StatusDot status="ai" />
              <Bot className="h-3.5 w-3.5 text-primary" />
              {copy.assistantBadge}
            </div>
            <div className="mt-4 text-sm leading-7 text-[var(--landing-fg)]">{copy.tip}</div>
          </div>

          <div className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/55 px-5 py-5">
            <div className="text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
              {copy.tasksLabel}
            </div>
            <div className="mt-4 space-y-3">
              {copy.tasks.map((task, index) => (
                <div
                  key={task}
                  className="flex items-start gap-3 text-sm text-[var(--landing-muted)]"
                >
                  <span
                    className={cn(
                      'mt-1 flex h-4 w-4 items-center justify-center rounded-full border text-2xs',
                      index === 0
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-[color:var(--landing-border)] text-[var(--landing-subtle)]'
                    )}
                  >
                    {index === 0 ? '✓' : '○'}
                  </span>
                  <span className={cn(index === 0 && 'line-through text-[var(--landing-subtle)]')}>
                    {task}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

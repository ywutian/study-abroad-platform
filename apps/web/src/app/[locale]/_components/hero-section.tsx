'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ArrowRight, ChevronRight, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { AdmissionTierBadge, AIDisclosure, StatusDot } from '@/components/features/landing';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { useHomeContent } from './home-content';

type ConsoleRow = {
  name: string;
  probability: number;
  status: string;
  tone: 'reach' | 'target' | 'safety';
};

type HeroConsoleCopy = {
  workspace: string;
  profileLabel: string;
  profileMeta: string;
  termLabel: string;
  sections: string[];
  title: string;
  assistantBadge: string;
  assistantMessages: string[];
  tasksLabel: string;
  tasks: string[];
  askAnything: string;
  statusReady: string;
  statusLive: string;
  rows: ConsoleRow[];
};

export function HeroSection() {
  const home = useHomeContent();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="landing-hero-shell relative overflow-hidden pt-32 pb-20 sm:pt-36 lg:pt-44 lg:pb-28">
      <div className="landing-canvas-texture" />
      <div className="landing-grid-mask absolute inset-0 opacity-40" />

      <PageContainer variant="marketing" className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10"
          >
            {/* @design-system-ignore-next-line */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/10 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 px-4 py-2 text-xs uppercase tracking-[0.16em] text-[var(--landing-fg)] dark:from-indigo-500/10 dark:to-purple-500/10">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>{home.hero.eyebrow}</span>
            </div>

            <h1 className="mt-6 max-w-4xl text-display-hero font-semibold leading-[1.06] tracking-[-0.04em] text-[var(--landing-fg)]">
              <span className="block text-balance">{home.hero.headline[0]}</span>
              <span className="mt-2 block text-balance italic font-medium bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                {home.hero.headline[1]}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--landing-muted)] sm:text-lg">
              {home.hero.subtitle}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register">
                <Button
                  size="lg"
                  className="h-12 min-w-[160px] rounded-full bg-zinc-950 px-7 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:h-14 sm:min-w-[180px] sm:px-8 sm:text-base"
                >
                  {home.hero.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/cases">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 min-w-[140px] rounded-full border-[color:var(--landing-border-strong)] bg-transparent px-7 text-sm text-[var(--landing-fg)] transition-colors hover:bg-[color:var(--landing-surface-muted)] sm:h-14 sm:min-w-[160px] sm:px-8 sm:text-base"
                >
                  {home.hero.secondaryCta}
                </Button>
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-y-3 gap-x-6 sm:grid-cols-2 text-sm text-[var(--landing-muted)] max-w-lg">
              {home.hero.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/5 text-primary">
                    <ChevronRight className="h-3 w-3" />
                  </span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-12 flex flex-col gap-4 border-t border-[color:var(--landing-border)] pt-6 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-3 text-xs leading-relaxed text-[var(--landing-subtle)]">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--landing-muted)]" />
                <span className="max-w-[280px]">{home.hero.trustLine}</span>
              </div>
              <div className="hidden h-8 w-px bg-[color:var(--landing-border)] sm:block" />
              <div className="flex items-center gap-3 text-xs leading-relaxed text-[var(--landing-subtle)]">
                <Zap className="h-4 w-4 shrink-0 text-primary/70" />
                <span className="max-w-[200px]">{home.hero.statLabel}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Ambient Glow (Aurora) */}
            <div className="absolute left-1/2 top-1/2 -z-10 h-[100%] w-[100%] -translate-x-1/2 -translate-y-1/2">
              <div className="absolute left-0 top-0 h-[60%] w-[60%] rounded-full bg-primary/30 blur-[100px]" />
              <div className="absolute bottom-0 right-0 h-[60%] w-[60%] rounded-full bg-blue-400/20 blur-[100px]" />
              <div className="absolute bottom-1/4 left-1/4 h-[50%] w-[50%] animate-pulse rounded-full bg-purple-400/20 blur-[100px]" />
            </div>
            <div className="landing-console-backdrop" />
            <HeroConsole reduced={!!prefersReducedMotion} disclosure={home.hero.aiDisclosure} />
          </motion.div>
        </div>
      </PageContainer>
    </section>
  );
}

function HeroConsole({
  reduced,
  disclosure,
}: {
  reduced: boolean;
  disclosure: {
    trigger: string;
    inputs: string[];
    confidence: 'high' | 'medium' | 'low';
    limitations: string[];
  };
}) {
  const t = useTranslations('home');
  const copy = t.raw('hero.console') as HeroConsoleCopy;
  const [typedMessage, setTypedMessage] = useState(
    reduced ? copy.assistantMessages[0] : copy.assistantMessages[0].slice(0, 0)
  );
  const [messageIndex, setMessageIndex] = useState(0);
  const [activeTask, setActiveTask] = useState(0);

  useEffect(() => {
    if (reduced) {
      setTypedMessage(copy.assistantMessages[0]);
      return;
    }

    const message = copy.assistantMessages[messageIndex];
    setTypedMessage('');

    let current = 0;
    const typing = window.setInterval(() => {
      current += 1;
      setTypedMessage(message.slice(0, current));

      if (current >= message.length) {
        window.clearInterval(typing);
        window.setTimeout(() => {
          setMessageIndex((prev) => (prev + 1) % copy.assistantMessages.length);
          setActiveTask((prev) => (prev + 1) % copy.tasks.length);
        }, 2200);
      }
    }, 24);

    return () => window.clearInterval(typing);
  }, [copy.assistantMessages, copy.tasks.length, messageIndex, reduced]);

  return (
    <div className="relative mx-auto w-full max-w-[480px] lg:max-w-[520px] xl:max-w-[560px] lg:ml-16 xl:ml-24">
      {/* Main Window */}
      <div className="relative z-10 rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/70 shadow-xl shadow-primary/10 ring-1 ring-inset ring-white/40 dark:ring-white/10 backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/85 px-5 py-4 rounded-t-3xl">
          <div className="flex items-center gap-2">
            <StatusDot status="danger" />
            <StatusDot status="warning" />
            <StatusDot status="success" />
          </div>
          <span className="text-2xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
            {copy.workspace}
          </span>
        </div>

        <div className="flex flex-col gap-4 px-4 py-5 sm:px-5 lg:px-6 lg:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-2xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
                {copy.termLabel}
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--landing-fg)]">
                {copy.title}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdmissionTierBadge tier="reach" showBand />
              <AdmissionTierBadge tier="target" showBand />
              <AdmissionTierBadge tier="safety" showBand />
            </div>
          </div>

          <div className="space-y-3">
            {copy.rows.map((row) => (
              <div
                key={row.name}
                className="grid gap-2 rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/55 px-4 py-2.5 shadow-[var(--landing-shadow-card)] sm:grid-cols-[1.4fr_auto_1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--landing-fg)]">
                    {row.name}
                  </div>
                  <div className="text-xs text-[var(--landing-subtle)]">{row.status}</div>
                </div>
                <AdmissionTierBadge tier={row.tone} probability={row.probability} />
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--landing-border)]">
                    <div
                      className={cn(
                        'h-full rounded-full bg-gradient-to-r',
                        row.tone === 'reach' &&
                          'from-[color:var(--ds-status-reach)] to-[color:var(--ds-status-reach)]/70',
                        row.tone === 'target' &&
                          'from-[color:var(--ds-status-target)] to-[color:var(--ds-status-target)]/70',
                        row.tone === 'safety' &&
                          'from-[color:var(--ds-status-safety)] to-[color:var(--ds-status-safety)]/70'
                      )}
                      style={{ width: `${row.probability}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-xs text-[var(--landing-muted)]">
                    {row.probability}%
                  </span>
                </div>
                <span className="text-right text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
                  {row.status}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-dashed border-[color:var(--landing-border)] pt-4">
            <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
              <StatusDot status="success" pulse />
              {copy.statusLive}
            </div>
            <div className="text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
              {copy.statusReady}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Widget: AI Assistant */}
      <motion.div
        initial={reduced ? false : { opacity: 0, x: 20, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -right-6 -top-6 z-30 hidden lg:block xl:-right-12 2xl:-right-16"
      >
        <div className="w-[280px] rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/70 p-5 shadow-2xl shadow-primary/10 ring-1 ring-inset ring-white/40 dark:ring-white/10 backdrop-blur-2xl animate-float animation-delay-300">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-3 py-2 text-2xs uppercase tracking-[0.18em] text-[var(--landing-muted)]">
            <StatusDot status="ai" />
            {copy.assistantBadge}
          </div>

          <div className="mt-4 min-h-[88px] rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4 py-4 text-sm leading-7 text-[var(--landing-fg)] shadow-[var(--landing-shadow-card)]">
            {typedMessage}
            {!reduced && typedMessage.length < copy.assistantMessages[messageIndex].length ? (
              <span className="ml-1 inline-block h-4 w-0.5 animate-[landingBlink_1s_steps(2)_infinite] bg-primary align-middle" />
            ) : null}
          </div>

          <div className="mt-4 border-t border-dashed border-[color:var(--landing-border)] pt-4">
            <AIDisclosure
              inputs={disclosure.inputs}
              confidence={disclosure.confidence}
              limitations={disclosure.limitations}
            >
              {disclosure.trigger}
            </AIDisclosure>
          </div>
        </div>
      </motion.div>

      {/* Floating Widget: Tasks */}
      <motion.div
        initial={reduced ? false : { opacity: 0, x: 20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -bottom-8 -right-4 z-20 hidden lg:block xl:-right-8 2xl:-right-12"
      >
        <div className="w-[260px] rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/70 p-5 shadow-2xl shadow-primary/10 ring-1 ring-inset ring-white/40 dark:ring-white/10 backdrop-blur-2xl animate-float animation-delay-500">
          <div className="text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
            {copy.tasksLabel}
          </div>
          <div className="mt-4 space-y-3">
            {copy.tasks.map((task, index) => {
              const completed = index < activeTask;

              return (
                <div
                  key={task}
                  className="flex items-start gap-3 text-sm text-[var(--landing-muted)]"
                >
                  <span
                    className={cn(
                      'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-2xs',
                      completed
                        ? 'border-primary bg-primary/12 text-primary'
                        : index === activeTask
                          ? 'border-primary text-primary'
                          : 'border-[color:var(--landing-border)] text-[var(--landing-subtle)]'
                    )}
                  >
                    {completed ? '✓' : '○'}
                  </span>
                  <span className={cn(completed && 'line-through text-[var(--landing-subtle)]')}>
                    {task}
                  </span>
                </div>
              );
            })}
          </div>

          <button className="mt-5 flex w-full items-center justify-center rounded-full bg-[var(--landing-fg)] px-4 py-2.5 text-sm font-medium text-[var(--landing-bg)] transition hover:bg-[var(--landing-fg)]/92">
            {copy.askAnything}
          </button>
        </div>
      </motion.div>

      {/* Floating Widget: Profile & Nav */}
      <motion.div
        initial={reduced ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -left-6 top-16 z-20 hidden lg:block xl:-left-12 2xl:-left-16"
      >
        <div className="flex w-[180px] flex-col gap-4 rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/70 p-4 shadow-2xl shadow-primary/10 ring-1 ring-inset ring-white/40 dark:ring-white/10 backdrop-blur-2xl animate-float">
          <div className="rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4 py-3 shadow-[var(--landing-shadow-card)]">
            <div className="text-sm font-medium text-[var(--landing-fg)]">{copy.profileLabel}</div>
            <div className="mt-1 text-xs text-[var(--landing-muted)]">{copy.profileMeta}</div>
          </div>

          <div className="space-y-1">
            {copy.sections.map((section, index) => (
              <div
                key={section}
                className={cn(
                  'rounded-xl px-3 py-2.5 text-sm transition',
                  index === 0
                    ? 'border border-[color:var(--landing-border-strong)] bg-[color:var(--landing-surface)] text-[var(--landing-fg)] shadow-[var(--landing-shadow-card)]'
                    : 'text-[var(--landing-muted)]'
                )}
              >
                {section}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

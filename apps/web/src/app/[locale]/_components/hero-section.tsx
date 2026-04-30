'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ArrowRight, CheckCircle2, ChevronRight, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { AdmissionTierBadge, AIDisclosure, StatusDot } from '@/components/features/landing';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { LumniMark } from '@/components/ui/lumni-mark';
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
  signalLabel: string;
  symbolLabel: string;
  workflowLine: string;
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
      <div className="landing-grid-mask absolute inset-0" />

      <PageContainer variant="marketing" className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10"
          >
            <div className="landing-eyebrow-pill">
              <Sparkles className="h-3.5 w-3.5 text-[var(--lumni-gold-ink)]" />
              <span>{home.hero.eyebrow}</span>
            </div>

            <h1 className="mt-6 max-w-4xl text-display-hero font-semibold leading-[1.06] text-[var(--landing-fg)]">
              <span className="block text-balance">{home.hero.headline[0]}</span>
              <span className="landing-hero-accent mt-2 block text-balance">
                {home.hero.headline[1]}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--landing-muted)] sm:text-lg">
              {home.hero.subtitle}
            </p>

            <MobileLumniCommandPreview />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register">
                <Button
                  size="lg"
                  className="h-12 min-w-[160px] rounded-[var(--theme-radius-button)] bg-[var(--landing-fg)] px-7 text-sm font-medium text-[var(--landing-bg)] transition-colors hover:bg-[var(--landing-fg)]/90 sm:h-14 sm:min-w-[180px] sm:px-8 sm:text-base"
                >
                  {home.hero.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/cases">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 min-w-[140px] rounded-[var(--theme-radius-button)] border-[color:var(--landing-border-strong)] bg-[color:var(--landing-surface)]/52 px-7 text-sm text-[var(--landing-fg)] transition-colors hover:bg-[color:var(--landing-surface-muted)] sm:h-14 sm:min-w-[160px] sm:px-8 sm:text-base"
                >
                  {home.hero.secondaryCta}
                </Button>
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-y-3 gap-x-6 text-sm text-[var(--landing-muted)] sm:grid-cols-2 max-w-lg">
              {home.hero.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] text-[var(--lumni-gold-ink)]">
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
                <Zap className="h-4 w-4 shrink-0 text-[var(--lumni-gold-ink)]" />
                <span className="max-w-[200px]">{home.hero.statLabel}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            <LumniHeroScene reduced={!!prefersReducedMotion} disclosure={home.hero.aiDisclosure} />
          </motion.div>
        </div>
      </PageContainer>
    </section>
  );
}

function MobileLumniCommandPreview() {
  const t = useTranslations('home');
  const copy = t.raw('hero.console') as HeroConsoleCopy;
  const primaryRow = copy.rows[0];

  return (
    <div className="relative mt-7 overflow-hidden rounded-lg border border-[color:var(--landing-border-strong)] bg-[var(--lumni-hero-shell)] p-3 text-[var(--lumni-hero-text)] shadow-[var(--landing-shadow-soft)] lg:hidden">
      <div className="lumni-night-grid pointer-events-none absolute inset-0" />
      <div className="relative flex items-center justify-between gap-3 rounded-md border border-[color:var(--lumni-hero-line)] bg-[var(--lumni-hero-panel)] px-3 py-2.5">
        <div>
          <div className="text-2xs uppercase tracking-[0.2em] text-[var(--lumni-hero-muted)]">
            {copy.workspace}
          </div>
          <div className="mt-0.5 text-xs text-[var(--lumni-hero-soft)]">{copy.workflowLine}</div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--lumni-hero-line)] px-2 py-1 text-2xs uppercase tracking-[0.14em] text-[var(--lumni-hero-soft)]">
          <StatusDot status="success" pulse />
          {copy.statusReady}
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-[104px_1fr] gap-3">
        <div className="flex min-h-[150px] items-center justify-center rounded-md border border-[color:var(--lumni-hero-line)] bg-[var(--lumni-hero-panel)]">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="absolute h-20 w-20 rounded-full bg-[var(--lumni-moon)]" />
            <LumniMark
              showDisc={false}
              showMoon={false}
              className="relative h-24 w-24 text-[var(--lumni-hero-mark)]"
              iconClassName="h-full w-full"
            />
          </div>
        </div>

        <div className="min-w-0 rounded-md border border-[color:var(--lumni-hero-line)] bg-[var(--lumni-hero-panel)] p-3">
          <div className="text-2xs uppercase tracking-[0.2em] text-[var(--lumni-hero-muted)]">
            {copy.termLabel}
          </div>
          <div className="mt-1 text-base font-semibold tracking-tight text-[var(--lumni-hero-text)]">
            {copy.title}
          </div>
          <div className="mt-3 rounded-md border border-[color:var(--lumni-moon)] bg-[color:var(--lumni-hero-active)] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{primaryRow.name}</span>
              <span className="shrink-0 rounded-full bg-[#fff4e2] px-2 py-0.5 text-2xs font-medium text-[#8a5f12]">
                {primaryRow.status} {primaryRow.probability}%
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--lumni-hero-soft)]">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--lumni-moon)]" />
            <span>{copy.tasks[0]}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LumniHeroScene({
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
  const [activeRow, setActiveRow] = useState(0);
  const [activeTask, setActiveTask] = useState(0);

  useEffect(() => {
    if (reduced) return;

    const interval = window.setInterval(() => {
      setActiveRow((prev) => (prev + 1) % copy.rows.length);
      setActiveTask((prev) => (prev + 1) % copy.tasks.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, [copy.rows.length, copy.tasks.length, reduced]);

  const activeMessage = copy.assistantMessages[activeTask % copy.assistantMessages.length];

  return (
    <div className="relative mx-auto w-full max-w-[660px] lg:ml-4 xl:ml-10">
      <div className="group relative overflow-hidden rounded-xl border border-[color:var(--landing-border-strong)] bg-[var(--lumni-hero-shell)] p-3 text-[var(--lumni-hero-text)] shadow-[var(--landing-shadow-elevated)] sm:p-4">
        <div className="lumni-night-grid absolute inset-0" />

        <div className="relative mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--lumni-hero-line)] bg-[var(--lumni-hero-panel)] px-4 py-3">
          <div>
            <div className="text-2xs uppercase tracking-[0.22em] text-[var(--lumni-hero-muted)]">
              {copy.workspace}
            </div>
            <div className="mt-1 text-sm text-[var(--lumni-hero-soft)]">{copy.workflowLine}</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[color:var(--lumni-hero-line)] px-3 py-1.5 text-2xs uppercase tracking-[0.18em] text-[var(--lumni-hero-soft)]">
            <StatusDot status="success" pulse />
            {copy.statusReady}
          </div>
        </div>

        <div className="relative grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex min-h-[360px] flex-col justify-between rounded-lg border border-[color:var(--lumni-hero-line)] bg-[var(--lumni-hero-panel)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-2xs uppercase tracking-[0.22em] text-[var(--lumni-hero-soft)]">
                {copy.signalLabel}
              </div>
              <div className="text-2xs uppercase tracking-[0.18em] text-[var(--lumni-hero-soft)]">
                {copy.symbolLabel}
              </div>
            </div>

            <div className="relative mx-auto my-8 flex h-52 w-full max-w-[260px] items-center justify-center sm:h-60">
              <motion.div
                className="absolute h-36 w-36 rounded-full bg-[var(--lumni-moon)] shadow-[0_0_0_1px_rgba(255,255,255,0.18)] sm:h-40 sm:w-40"
                animate={
                  reduced
                    ? undefined
                    : {
                        scale: [1, 1.035, 1],
                        boxShadow: [
                          '0 0 0 1px rgba(255,255,255,0.18), 0 0 0 rgba(221,184,90,0)',
                          '0 0 0 1px rgba(255,255,255,0.22), 0 0 34px var(--lumni-moon-soft)',
                          '0 0 0 1px rgba(255,255,255,0.18), 0 0 0 rgba(221,184,90,0)',
                        ],
                      }
                }
                transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="absolute h-44 w-44 rounded-full border border-[color:var(--lumni-hero-line)] sm:h-52 sm:w-52" />
              <LumniMark
                showDisc={false}
                showMoon={false}
                className="relative h-48 w-48 text-[var(--lumni-hero-mark)] sm:h-56 sm:w-56"
                iconClassName="h-full w-full"
              />
            </div>

            <div className="rounded-lg border border-[color:var(--lumni-hero-line)] bg-[color:var(--lumni-hero-inset)] px-4 py-4">
              <div className="text-2xs uppercase tracking-[0.22em] text-[var(--lumni-hero-muted)]">
                {copy.workspace}
              </div>
              <div className="mt-2 text-xl font-semibold tracking-tight text-[var(--lumni-hero-text)]">
                {copy.profileLabel}
              </div>
              <div className="mt-1 text-sm text-[var(--lumni-hero-soft)]">{copy.profileMeta}</div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-[color:var(--lumni-hero-line)] bg-[var(--lumni-hero-panel)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-2xs uppercase tracking-[0.22em] text-[var(--lumni-hero-muted)]">
                    {copy.termLabel}
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--lumni-hero-text)]">
                    {copy.title}
                  </h2>
                </div>
                <div className="rounded-full border border-[color:var(--lumni-hero-line)] px-3 py-1 text-2xs uppercase tracking-[0.18em] text-[var(--lumni-hero-soft)]">
                  {copy.statusLive}
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {copy.rows.slice(0, 4).map((row, index) => (
                  <motion.div
                    key={row.name}
                    initial={false}
                    animate={
                      reduced
                        ? undefined
                        : {
                            y: activeRow === index ? -1 : 0,
                            scale: activeRow === index ? 1.01 : 1,
                          }
                    }
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      'grid gap-3 rounded-lg border px-3 py-3 transition duration-300 sm:grid-cols-[1fr_auto] sm:items-center',
                      activeRow === index
                        ? 'border-[color:var(--lumni-moon)] bg-[color:var(--lumni-hero-active)]'
                        : 'border-[color:var(--lumni-hero-line)] bg-[color:var(--lumni-hero-inset)]'
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--lumni-hero-text)]">
                        {row.name}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-[var(--lumni-hero-muted)]">
                        <span>{row.status}</span>
                        <span className="h-1 w-1 rounded-full bg-[var(--lumni-hero-muted)]" />
                        <span className="font-mono">{row.probability}%</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[color:var(--lumni-hero-inset)]">
                        <motion.div
                          className="h-full rounded-full bg-[var(--lumni-moon)]"
                          initial={false}
                          animate={{
                            width: activeRow === index ? `${row.probability}%` : '18%',
                            opacity: activeRow === index ? 1 : 0.42,
                          }}
                          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </div>
                    <AdmissionTierBadge tier={row.tone} probability={row.probability} />
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-lg border border-[color:var(--lumni-hero-line)] bg-[var(--lumni-hero-panel)] p-4">
                <div className="text-2xs uppercase tracking-[0.18em] text-[var(--lumni-hero-muted)]">
                  {copy.tasksLabel}
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-[color:var(--lumni-hero-inset)]">
                  <motion.div
                    className="h-full rounded-full bg-[var(--lumni-moon)]"
                    initial={false}
                    animate={{ width: `${((activeTask + 1) / copy.tasks.length) * 100}%` }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <div className="mt-3 space-y-2.5">
                  {copy.tasks.map((task, index) => (
                    <div
                      key={task}
                      className="flex items-start gap-2.5 text-sm text-[var(--lumni-hero-soft)]"
                    >
                      <CheckCircle2
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          index <= activeTask
                            ? 'text-[var(--lumni-moon)]'
                            : 'text-[var(--lumni-hero-muted)]'
                        )}
                      />
                      <span
                        className={cn(
                          index < activeTask && 'text-[var(--lumni-hero-muted)] line-through'
                        )}
                      >
                        {task}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[color:var(--lumni-hero-line)] bg-[var(--lumni-hero-panel)] p-4">
                <div className="inline-flex items-center gap-2 rounded-md border border-[color:var(--lumni-hero-line)] px-2.5 py-1.5 text-2xs uppercase tracking-[0.18em] text-[var(--lumni-hero-soft)]">
                  <StatusDot status="ai" />
                  {copy.assistantBadge}
                </div>
                <motion.p
                  key={activeMessage}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-3 min-h-[72px] text-sm leading-7 text-[var(--lumni-hero-text)]"
                >
                  {activeMessage}
                </motion.p>
                <div className="lumni-disclosure-on-ink mt-3 border-t border-dashed border-[color:var(--lumni-hero-line)] pt-3">
                  <AIDisclosure
                    inputs={disclosure.inputs}
                    confidence={disclosure.confidence}
                    limitations={disclosure.limitations}
                  >
                    {disclosure.trigger}
                  </AIDisclosure>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

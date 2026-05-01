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
            className="relative hidden lg:block"
          >
            <div className="absolute left-1/2 top-1/2 -z-10 h-full w-full -translate-x-1/2 -translate-y-1/2">
              <div className="absolute left-0 top-2 h-2/3 w-2/3 rounded-full bg-primary/18 blur-[110px]" />
              <div className="absolute bottom-2 right-0 h-2/3 w-2/3 rounded-full bg-[color:var(--ds-info)]/12 blur-[110px]" />
              <div
                className={cn(
                  'absolute bottom-1/4 left-1/4 h-1/2 w-1/2 rounded-full bg-[color:var(--theme-glow-2)] blur-[120px]',
                  !prefersReducedMotion && 'animate-pulse'
                )}
              />
            </div>
            <div className="landing-console-backdrop" />
            <PremiumHeroConsole reduced={!!prefersReducedMotion} disclosure={home.hero.aiDisclosure} />
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

function PremiumHeroConsole({
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
  const [typedMessage, setTypedMessage] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  const [activeRow, setActiveRow] = useState(0);
  const [activeTask, setActiveTask] = useState(0);
  const messageCount = copy.assistantMessages.length;
  const rowCount = copy.rows.length;
  const taskCount = copy.tasks.length;
  const firstMessage = copy.assistantMessages[0] ?? '';
  const currentMessage = copy.assistantMessages[messageIndex] ?? '';

  useEffect(() => {
    if (reduced) {
      setTypedMessage(firstMessage);
      return;
    }

    setTypedMessage('');
    let index = 0;
    let delayTimer: number | undefined;

    const typeTimer = window.setInterval(() => {
      index += 1;
      setTypedMessage(currentMessage.slice(0, index));

      if (index >= currentMessage.length) {
        window.clearInterval(typeTimer);
        delayTimer = window.setTimeout(() => {
          setMessageIndex((prev) => (prev + 1) % messageCount);
          setActiveRow((prev) => (prev + 1) % rowCount);
          setActiveTask((prev) => (prev + 1) % taskCount);
        }, 2200);
      }
    }, 24);

    return () => {
      window.clearInterval(typeTimer);
      if (delayTimer) window.clearTimeout(delayTimer);
    };
  }, [currentMessage, firstMessage, messageCount, reduced, rowCount, taskCount]);

  return (
    <div className="relative mx-auto w-full max-w-[600px] lg:ml-8 xl:ml-16">
      <motion.div
        className="relative z-10 overflow-hidden rounded-[2rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/78 text-[var(--landing-fg)] shadow-[var(--landing-shadow-elevated)] ring-1 ring-white/55 backdrop-blur-2xl dark:ring-white/10"
        animate={reduced ? undefined : { y: [0, -4, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="landing-grid-mask absolute inset-0 opacity-45" />
        <div className="relative flex h-16 items-center justify-between border-b border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/42 px-7">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
            <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
            <span className="h-3 w-3 rounded-full bg-[#10b981]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] shadow-[var(--landing-shadow-card)]">
              <div className="absolute h-7 w-7 rounded-full bg-[color:var(--lumni-moon)]/85" />
              <LumniMark
                showDisc={false}
                showMoon={false}
                className="relative h-8 w-8 text-[var(--landing-fg)]"
                iconClassName="h-full w-full"
              />
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-2xs uppercase tracking-[0.2em] text-[var(--landing-subtle)]">
                {copy.workspace}
              </div>
              <div className="text-xs text-[var(--landing-muted)]">{copy.workflowLine}</div>
            </div>
          </div>
        </div>

        <div className="relative px-8 py-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--landing-subtle)]">
                {copy.termLabel}
              </div>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--landing-fg)]">
                {copy.title}
              </h2>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/70 px-3 py-1.5 text-2xs uppercase tracking-[0.18em] text-[var(--landing-muted)] sm:flex">
              <StatusDot status="success" pulse={!reduced} />
              {copy.statusLive}
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4">
            {copy.rows.slice(1, 3).map((row) => (
              <div
                key={row.name}
                className="rounded-lg border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/68 px-4 py-3"
              >
                <AdmissionTierBadge tier={row.tone} probability={row.probability} />
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--landing-surface-muted)]">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      row.tone === 'safety'
                        ? 'bg-emerald-500'
                        : row.tone === 'target'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    )}
                    style={{ width: `${Math.max(18, row.probability)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {copy.rows.map((row, index) => (
              <motion.div
                key={row.name}
                initial={false}
                animate={
                  reduced
                    ? undefined
                    : {
                        y: activeRow === index ? -2 : 0,
                        scale: activeRow === index ? 1.015 : 1,
                      }
                }
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'grid items-center gap-4 rounded-2xl border bg-[color:var(--landing-surface)]/72 px-5 py-4 shadow-[var(--landing-shadow-card)] transition duration-300 sm:grid-cols-[1fr_auto_auto]',
                  activeRow === index
                    ? 'border-[color:var(--ds-primary)]/35 ring-1 ring-[color:var(--ds-primary)]/12'
                    : 'border-[color:var(--landing-border)]'
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-[var(--landing-fg)]">
                    {row.name}
                  </div>
                  <div className="mt-1 text-sm text-[var(--landing-muted)]">{row.status}</div>
                </div>
                <AdmissionTierBadge tier={row.tone} probability={row.probability} />
                <div className="flex min-w-[170px] items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--landing-surface-muted)]">
                    <motion.div
                      className={cn(
                        'h-full rounded-full',
                        row.tone === 'safety'
                          ? 'bg-emerald-500'
                          : row.tone === 'target'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                      )}
                      initial={false}
                      animate={{
                        width: activeRow === index ? `${row.probability}%` : '18%',
                        opacity: activeRow === index ? 1 : 0.45,
                      }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <span className="font-mono text-xs text-[var(--landing-muted)]">
                    {row.probability}%
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-7 flex items-center gap-3 border-t border-dashed border-[color:var(--landing-border)] pt-5 text-sm uppercase tracking-[0.2em] text-[var(--landing-subtle)]">
            <StatusDot status="success" pulse={!reduced} />
            {copy.statusLive}
          </div>
        </div>
      </motion.div>

      <motion.div
        className={cn(
          'absolute -left-24 top-20 z-20 w-[210px] rounded-[1.65rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/82 p-5 text-[var(--landing-fg)] shadow-[var(--landing-shadow-elevated)] backdrop-blur-2xl',
          !reduced && 'animate-[landingFloat_7s_ease-in-out_infinite]'
        )}
      >
        <div className="rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4 py-4 shadow-[var(--landing-shadow-card)]">
          <div className="text-base font-semibold">{copy.profileLabel}</div>
          <div className="mt-1 text-sm leading-5 text-[var(--landing-muted)]">{copy.profileMeta}</div>
        </div>
        <div className="mt-5 rounded-2xl border border-[color:var(--landing-border-strong)] bg-[color:var(--landing-surface)] px-4 py-3 text-base font-medium shadow-[var(--landing-shadow-card)]">
          {copy.sections[0]}
        </div>
        <div className="mt-5 space-y-4 px-2 text-sm text-[var(--landing-muted)]">
          {copy.sections.slice(1).map((section) => (
            <div key={section}>{section}</div>
          ))}
        </div>
      </motion.div>

      <motion.div
        className={cn(
          'absolute -right-14 top-[-3rem] z-20 w-[315px] rounded-[1.8rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/86 p-6 text-[var(--landing-fg)] shadow-[var(--landing-shadow-elevated)] backdrop-blur-2xl',
          !reduced && 'animate-[landingFloat_8s_ease-in-out_infinite]'
        )}
        style={{ animationDelay: reduced ? undefined : '1.2s' }}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4 py-2 text-sm uppercase tracking-[0.22em] text-[var(--landing-muted)]">
          <StatusDot status="ai" pulse={!reduced} />
          {copy.assistantBadge}
        </div>
        <div className="mt-6 min-h-[144px] rounded-[1.4rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-6 py-5 text-base leading-8 shadow-[var(--landing-shadow-card)]">
          {typedMessage}
          {!reduced && <span className="ml-0.5 inline-block h-5 w-px translate-y-1 bg-[var(--landing-fg)]" />}
        </div>
        <div className="lumni-disclosure-on-light mt-5 border-t border-dashed border-[color:var(--landing-border)] pt-4">
          <AIDisclosure
            inputs={disclosure.inputs}
            confidence={disclosure.confidence}
            limitations={disclosure.limitations}
          >
            {disclosure.trigger}
          </AIDisclosure>
        </div>
      </motion.div>

      <motion.div
        className={cn(
          'absolute -bottom-8 right-2 z-30 w-[285px] rounded-[1.8rem] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/88 p-6 text-[var(--landing-fg)] shadow-[var(--landing-shadow-elevated)] backdrop-blur-2xl',
          !reduced && 'animate-[landingFloat_9s_ease-in-out_infinite]'
        )}
        style={{ animationDelay: reduced ? undefined : '0.6s' }}
      >
        <div className="mb-5 text-sm uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
          {copy.tasksLabel}
        </div>
        <div className="space-y-3">
          {copy.tasks.map((task, index) => (
            <div key={task} className="flex items-start gap-3 text-sm leading-6 text-[var(--landing-muted)]">
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                  index <= activeTask
                    ? 'border-[color:var(--ds-primary)] text-[var(--ds-primary)]'
                    : 'border-[color:var(--landing-border-strong)] text-[var(--landing-subtle)]'
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <span className={cn(index < activeTask && 'line-through opacity-60')}>{task}</span>
            </div>
          ))}
        </div>
        <Button className="mt-6 h-12 w-full rounded-full bg-[var(--landing-fg)] text-[var(--landing-bg)] hover:bg-[var(--landing-fg)]/90">
          {copy.askAnything}
        </Button>
      </motion.div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Feather,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  School,
  Zap,
} from 'lucide-react';
import { type HeroVisualId } from '@study-abroad/shared';
import { AdmissionTierBadge, AIDisclosure, StatusDot } from '@/components/features/landing';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { LumniMark } from '@/components/ui/lumni-mark';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { useHeroVisual } from '@/hooks/use-hero-visual';
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
  const { heroVisual } = useHeroVisual();
  const t = useTranslations('home');
  const consoleCopy = t.raw('hero.console') as HeroConsoleCopy;
  const isDense = heroVisual === 'dense-cockpit';
  const isCentered = heroVisual === 'centered-mark';

  if (isCentered) {
    return (
      <section
        data-hero-visual={heroVisual}
        className="landing-hero-shell landing-hero-alt relative overflow-hidden pt-28 pb-24 sm:pt-32 lg:pt-36 lg:pb-32"
      >
        <div className="landing-canvas-texture" />
        <div className="landing-grid-mask absolute inset-0" />
        <CenteredMarkHero reduced={!!prefersReducedMotion} />
      </section>
    );
  }

  return (
    <section
      data-hero-visual={heroVisual}
      className={cn(
        'landing-hero-shell relative overflow-hidden pt-32 pb-20 sm:pt-36 lg:pt-44 lg:pb-28',
        heroVisual !== 'matrix-premium' && 'landing-hero-alt'
      )}
    >
      <div className="landing-canvas-texture" />
      <div className="landing-grid-mask absolute inset-0" />

      {isDense && <DeerMoonWatermark />}

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

            <MobileLumniCommandPreview visual={heroVisual} />

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

            {isDense && <DenseSocialProofRow />}
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
            <HeroVisualScene
              visual={heroVisual}
              copy={consoleCopy}
              reduced={!!prefersReducedMotion}
              disclosure={home.hero.aiDisclosure}
            />
          </motion.div>
        </div>

        {isDense && <DenseCounselorRow />}
      </PageContainer>
    </section>
  );
}

function MobileLumniCommandPreview({ visual }: { visual: HeroVisualId }) {
  const t = useTranslations('home');
  const copy = t.raw('hero.console') as HeroConsoleCopy;
  const primaryRow = copy.rows[0];

  return (
    <div
      className={cn(
        'relative mt-7 overflow-hidden rounded-lg border p-3 shadow-[var(--landing-shadow-soft)] lg:hidden',
        visual === 'deer-moon-monolith'
          ? 'border-[#1f1a15] bg-[#11100f] text-[#fff8ee]'
          : 'border-[color:var(--landing-border-strong)] bg-[var(--lumni-hero-shell)] text-[var(--lumni-hero-text)]'
      )}
    >
      <div className="lumni-night-grid pointer-events-none absolute inset-0" />
      <div
        className={cn(
          'relative flex items-center justify-between gap-3 rounded-md border px-3 py-2.5',
          visual === 'deer-moon-monolith'
            ? 'border-white/12 bg-white/6'
            : 'border-[color:var(--lumni-hero-line)] bg-[var(--lumni-hero-panel)]'
        )}
      >
        <div>
          <div
            className={cn(
              'text-2xs uppercase tracking-[0.2em]',
              visual === 'deer-moon-monolith' ? 'text-white/48' : 'text-[var(--lumni-hero-muted)]'
            )}
          >
            {copy.workspace}
          </div>
          <div
            className={cn(
              'mt-0.5 text-xs',
              visual === 'deer-moon-monolith' ? 'text-white/64' : 'text-[var(--lumni-hero-soft)]'
            )}
          >
            {copy.workflowLine}
          </div>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-2 py-1 text-2xs uppercase tracking-[0.14em]',
            visual === 'deer-moon-monolith'
              ? 'border-white/14 text-white/70'
              : 'border-[color:var(--lumni-hero-line)] text-[var(--lumni-hero-soft)]'
          )}
        >
          <StatusDot status="success" pulse />
          {copy.statusReady}
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-[104px_1fr] gap-3">
        <div
          className={cn(
            'flex min-h-[150px] items-center justify-center rounded-md border',
            visual === 'deer-moon-monolith'
              ? 'border-white/12 bg-black'
              : 'border-[color:var(--lumni-hero-line)] bg-[var(--lumni-hero-panel)]'
          )}
        >
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div
              className={cn(
                'absolute h-20 w-20 rounded-full',
                visual === 'framer-orbit'
                  ? 'bg-[#7aa8ff]'
                  : visual === 'lovable-aura'
                    ? 'bg-[#ff5aa5]'
                    : 'bg-[var(--lumni-moon)]'
              )}
            />
            <LumniMark
              showDisc={false}
              showMoon={false}
              className={cn(
                'relative h-24 w-24',
                visual === 'deer-moon-monolith' ? 'text-[#fff7e5]' : 'text-[var(--lumni-hero-mark)]'
              )}
              iconClassName="h-full w-full"
            />
          </div>
        </div>

        <div
          className={cn(
            'min-w-0 rounded-md border p-3',
            visual === 'deer-moon-monolith'
              ? 'border-white/12 bg-white/6'
              : 'border-[color:var(--lumni-hero-line)] bg-[var(--lumni-hero-panel)]'
          )}
        >
          <div
            className={cn(
              'text-2xs uppercase tracking-[0.2em]',
              visual === 'deer-moon-monolith' ? 'text-white/46' : 'text-[var(--lumni-hero-muted)]'
            )}
          >
            {copy.termLabel}
          </div>
          <div
            className={cn(
              'mt-1 text-base font-semibold tracking-tight',
              visual === 'deer-moon-monolith' ? 'text-white' : 'text-[var(--lumni-hero-text)]'
            )}
          >
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

type HeroVisualSceneProps = {
  visual: HeroVisualId;
  copy: HeroConsoleCopy;
  reduced: boolean;
  disclosure: {
    trigger: string;
    inputs: string[];
    confidence: 'high' | 'medium' | 'low';
    limitations: string[];
  };
};

function HeroVisualScene({ visual, copy, reduced, disclosure }: HeroVisualSceneProps) {
  if (visual === 'deer-moon-monolith') {
    return <DeerMoonMonolith copy={copy} reduced={reduced} disclosure={disclosure} />;
  }
  if (visual === 'framer-orbit') {
    return <FramerOrbitHero copy={copy} reduced={reduced} disclosure={disclosure} />;
  }
  if (visual === 'lovable-aura') {
    return <LovableAuraHero copy={copy} reduced={reduced} disclosure={disclosure} />;
  }
  if (visual === 'beige-editorial') {
    return <BeigeEditorialHero copy={copy} reduced={reduced} disclosure={disclosure} />;
  }
  if (visual === 'command-minimal') {
    return <CommandMinimalHero copy={copy} reduced={reduced} disclosure={disclosure} />;
  }
  if (visual === 'dense-cockpit') {
    return <DenseCockpitHero reduced={reduced} disclosure={disclosure} />;
  }
  if (visual === 'centered-mark') {
    // CenteredMarkHero owns its full hero block — see HeroSection early-branch.
    return null;
  }

  return <PremiumHeroConsole copy={copy} reduced={reduced} disclosure={disclosure} />;
}

function PremiumHeroConsole({
  copy,
  reduced,
  disclosure,
}: {
  copy: HeroConsoleCopy;
  reduced: boolean;
  disclosure: {
    trigger: string;
    inputs: string[];
    confidence: 'high' | 'medium' | 'low';
    limitations: string[];
  };
}) {
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
          <div className="mt-1 text-sm leading-5 text-[var(--landing-muted)]">
            {copy.profileMeta}
          </div>
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
          {!reduced && (
            <span className="ml-0.5 inline-block h-5 w-px translate-y-1 bg-[var(--landing-fg)]" />
          )}
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
            <div
              key={task}
              className="flex items-start gap-3 text-sm leading-6 text-[var(--landing-muted)]"
            >
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

function BrandSeal({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <div className="absolute h-[68%] w-[68%] rounded-full bg-[var(--lumni-moon)] shadow-[0_0_44px_var(--lumni-moon-soft)]" />
      <LumniMark
        showDisc={false}
        showMoon={false}
        className={cn('relative h-full w-full text-[var(--landing-fg)]', markClassName)}
        iconClassName="h-full w-full"
      />
    </div>
  );
}

function CompactRows({ copy, dark = false }: { copy: HeroConsoleCopy; dark?: boolean }) {
  return (
    <div className="space-y-2.5">
      {copy.rows.slice(0, 4).map((row, index) => (
        <div
          key={row.name}
          className={cn(
            'grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border px-4 py-3',
            dark
              ? 'border-white/10 bg-white/[0.06] text-white'
              : 'border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/80 text-[var(--landing-fg)]'
          )}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{row.name}</div>
            <div
              className={cn('mt-1 text-xs', dark ? 'text-white/52' : 'text-[var(--landing-muted)]')}
            >
              {row.status}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-1.5 rounded-full',
                row.tone === 'safety'
                  ? 'bg-emerald-400'
                  : row.tone === 'target'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
              )}
              style={{ width: `${22 + index * 10}px` }}
            />
            <span
              className={cn(
                'font-mono text-xs',
                dark ? 'text-white/58' : 'text-[var(--landing-muted)]'
              )}
            >
              {row.probability}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightCard({
  copy,
  disclosure,
  dark = false,
}: {
  copy: HeroConsoleCopy;
  disclosure: HeroVisualSceneProps['disclosure'];
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-[1.5rem] border p-5 shadow-[var(--landing-shadow-card)]',
        dark
          ? 'border-white/12 bg-white/[0.07] text-white'
          : 'border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/90 text-[var(--landing-fg)]'
      )}
    >
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-2xs uppercase tracking-[0.2em]',
          dark
            ? 'border-white/12 text-white/60'
            : 'border-[color:var(--landing-border)] text-[var(--landing-muted)]'
        )}
      >
        <StatusDot status="ai" />
        {copy.assistantBadge}
      </div>
      <p
        className={cn(
          'mt-4 text-sm leading-7',
          dark ? 'text-white/80' : 'text-[var(--landing-fg)]'
        )}
      >
        {copy.assistantMessages[2]}
      </p>
      <div
        className={cn(
          'mt-4 border-t border-dashed pt-3',
          dark
            ? 'border-white/14 lumni-disclosure-on-ink'
            : 'border-[color:var(--landing-border)] lumni-disclosure-on-light'
        )}
      >
        <AIDisclosure
          inputs={disclosure.inputs}
          confidence={disclosure.confidence}
          limitations={disclosure.limitations}
        >
          {disclosure.trigger}
        </AIDisclosure>
      </div>
    </div>
  );
}

function DeerMoonMonolith({
  copy,
  reduced,
  disclosure,
}: {
  copy: HeroConsoleCopy;
  reduced: boolean;
  disclosure: HeroVisualSceneProps['disclosure'];
}) {
  return (
    <div className="group relative mx-auto w-full max-w-[640px]" tabIndex={0}>
      <motion.div
        className="relative overflow-hidden rounded-[2.4rem] border border-[#1f1b16] bg-[#0d0c0b] p-8 text-[#fff8ec] shadow-[0_34px_90px_rgba(12,10,8,0.28)]"
        animate={reduced ? undefined : { y: [0, -5, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(221,184,90,0.24),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_42%)]" />
        <div className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative grid min-h-[520px] place-items-center">
          <BrandSeal className="h-80 w-80" markClassName="text-[#fff8ec]" />
          <div className="absolute left-0 top-0 max-w-[210px]">
            <div className="text-2xs uppercase tracking-[0.28em] text-white/42">
              {copy.symbolLabel}
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight">{copy.workspace}</div>
          </div>
          <div className="absolute bottom-0 right-0 rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-right">
            <div className="text-2xs uppercase tracking-[0.22em] text-white/42">
              {copy.statusReady}
            </div>
            <div className="mt-1 text-sm text-white/72">{copy.workflowLine}</div>
          </div>
        </div>
      </motion.div>

      <div className="absolute -right-8 top-10 w-[310px] translate-x-3 opacity-0 transition duration-500 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100">
        <InsightCard copy={copy} disclosure={disclosure} dark />
      </div>
      <div className="absolute -left-8 bottom-8 w-[330px] rounded-[1.6rem] border border-white/10 bg-[#151311]/86 p-4 text-white shadow-2xl backdrop-blur-xl">
        <CompactRows copy={copy} dark />
      </div>
    </div>
  );
}

function FramerOrbitHero({
  copy,
  reduced,
  disclosure,
}: {
  copy: HeroConsoleCopy;
  reduced: boolean;
  disclosure: HeroVisualSceneProps['disclosure'];
}) {
  return (
    <div className="relative mx-auto w-full max-w-[650px]">
      <div className="relative overflow-hidden rounded-[2.25rem] border border-[#171717] bg-[#030303] p-6 text-white shadow-[0_32px_90px_rgba(0,0,0,0.28)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_24%,rgba(101,116,255,0.42),transparent_26%),radial-gradient(circle_at_88%_70%,rgba(231,111,138,0.28),transparent_30%)]" />
        <div className="relative grid min-h-[520px] grid-cols-[0.9fr_1.1fr] gap-5">
          <div className="flex flex-col justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-5">
            <div>
              <div className="text-2xs uppercase tracking-[0.26em] text-white/44">
                {copy.workspace}
              </div>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight">{copy.title}</h2>
            </div>
            <InsightCard copy={copy} disclosure={disclosure} dark />
          </div>
          <div className="relative rounded-[1.5rem] border border-white/10 bg-black/35 p-5">
            <div className="absolute inset-8 rounded-full border border-[#6574ff]/40" />
            <div className="absolute inset-16 rounded-full border border-[#e76f8a]/30" />
            <motion.div
              className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5"
              animate={reduced ? undefined : { rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            >
              <BrandSeal className="h-full w-full" markClassName="text-white" />
            </motion.div>
            <div className="absolute bottom-5 left-5 right-5">
              <CompactRows copy={copy} dark />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LovableAuraHero({
  copy,
  reduced,
  disclosure,
}: {
  copy: HeroConsoleCopy;
  reduced: boolean;
  disclosure: HeroVisualSceneProps['disclosure'];
}) {
  return (
    <div className="relative mx-auto w-full max-w-[650px]">
      <div className="relative overflow-hidden rounded-[2.25rem] border border-[color:var(--landing-border)] bg-white p-6 shadow-[var(--landing-shadow-elevated)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_25%,rgba(88,134,255,0.34),transparent_28%),radial-gradient(circle_at_70%_42%,rgba(255,80,166,0.26),transparent_30%),radial-gradient(circle_at_60%_92%,rgba(255,144,64,0.30),transparent_34%)]" />
        <div className="relative min-h-[520px] rounded-[1.6rem] border border-white/60 bg-white/70 p-6 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-[430px] items-center gap-3 rounded-[1.25rem] border border-black/10 bg-white px-4 py-3 shadow-lg">
            <Sparkles className="h-4 w-4 text-[#6574ff]" />
            <span className="text-sm text-[var(--landing-muted)]">{copy.workflowLine}</span>
          </div>
          <div className="mt-8 grid grid-cols-[0.92fr_1.08fr] gap-5">
            <div className="rounded-[1.75rem] border border-black/10 bg-white/86 p-5 shadow-xl">
              <BrandSeal className="mx-auto h-44 w-44" markClassName="text-[#201915]" />
              <div className="mt-5 text-center">
                <div className="text-2xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
                  {copy.statusReady}
                </div>
                <div className="mt-2 text-2xl font-semibold">{copy.workspace}</div>
              </div>
            </div>
            <div className="space-y-4">
              <CompactRows copy={copy} />
              <InsightCard copy={copy} disclosure={disclosure} />
            </div>
          </div>
        </div>
        {!reduced ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#5886ff] via-[#ff50a6] to-[#ff9040]" />
        ) : null}
      </div>
    </div>
  );
}

function BeigeEditorialHero({
  copy,
  disclosure,
}: {
  copy: HeroConsoleCopy;
  reduced: boolean;
  disclosure: HeroVisualSceneProps['disclosure'];
}) {
  return (
    <div className="relative mx-auto w-full max-w-[630px]">
      <div className="relative overflow-hidden rounded-[2rem] border border-[#d8c8b2] bg-[#f7f1e6] p-7 text-[#1d1813] shadow-[0_24px_70px_rgba(70,52,30,0.16)]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(29,24,19,0.045)_1px,transparent_1px),linear-gradient(rgba(29,24,19,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="relative grid min-h-[520px] grid-cols-[0.82fr_1.18fr] gap-5">
          <div className="flex flex-col justify-between border-r border-[#d8c8b2] pr-5">
            <div>
              <div className="text-2xs uppercase tracking-[0.28em] text-[#7a6a58]">
                {copy.termLabel}
              </div>
              <h2 className="mt-5 text-5xl font-semibold leading-[0.95] tracking-tight">
                {copy.title}
              </h2>
            </div>
            <BrandSeal className="h-48 w-48" markClassName="text-[#1d1813]" />
          </div>
          <div className="space-y-5">
            <div className="rounded-[1.5rem] border border-[#d8c8b2] bg-[#fff9ef]/76 p-5">
              <div className="text-2xs uppercase tracking-[0.24em] text-[#7a6a58]">
                {copy.profileLabel}
              </div>
              <div className="mt-2 text-lg font-semibold">{copy.profileMeta}</div>
            </div>
            <CompactRows copy={copy} />
            <InsightCard copy={copy} disclosure={disclosure} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CommandMinimalHero({
  copy,
  disclosure,
}: {
  copy: HeroConsoleCopy;
  reduced: boolean;
  disclosure: HeroVisualSceneProps['disclosure'];
}) {
  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      <div className="relative rounded-[1.4rem] border border-[color:var(--landing-border)] bg-white p-4 shadow-[var(--landing-shadow-elevated)]">
        <div className="grid min-h-[520px] grid-cols-[84px_1fr] gap-4">
          <div className="flex flex-col items-center justify-between rounded-[1rem] border border-[color:var(--landing-border)] bg-[#fbfcfd] py-4">
            <BrandSeal className="h-14 w-14" />
            <div className="flex flex-col gap-2">
              {copy.sections.slice(0, 4).map((section) => (
                <span
                  key={section}
                  className="h-2 w-8 rounded-full bg-[color:var(--landing-border-strong)]"
                />
              ))}
            </div>
            <StatusDot status="success" pulse />
          </div>
          <div className="grid grid-rows-[auto_1fr_auto] gap-4">
            <div className="flex items-center justify-between rounded-[1rem] border border-[color:var(--landing-border)] px-5 py-4">
              <div>
                <div className="text-2xs uppercase tracking-[0.24em] text-[var(--landing-subtle)]">
                  {copy.workspace}
                </div>
                <div className="mt-1 text-2xl font-semibold">{copy.title}</div>
              </div>
              <div className="rounded-full border border-[color:var(--landing-border)] px-3 py-1.5 text-2xs uppercase tracking-[0.18em] text-[var(--landing-muted)]">
                {copy.statusReady}
              </div>
            </div>
            <CompactRows copy={copy} />
            <InsightCard copy={copy} disclosure={disclosure} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Dense Cockpit (Pro) — browser-chrome console with cycling tabs
   ============================================================ */

type DenseListRow = {
  name: string;
  loc: string;
  tone: 'reach' | 'target' | 'safety';
  probability: number;
  deadline: string;
  spark: number[];
};

type DenseFitFactor = {
  label: string;
  score: number;
  tone: 'reach' | 'target' | 'safety';
};

type DenseEssayScore = {
  label: string;
  score: number;
  tone: 'reach' | 'target' | 'safety';
};

type DenseCockpitCopy = {
  tabs: { list: string; fit: string; essay: string };
  url: string;
  list: {
    summary: string;
    tierLabels: { reach: string; target: string; safety: string };
    rows: DenseListRow[];
  };
  fit: {
    title: string;
    subtitle: string;
    factors: DenseFitFactor[];
  };
  essay: {
    promptLabel: string;
    body: string;
    accentLine: string;
    coachLabel: string;
    coachNote: string;
    scores: DenseEssayScore[];
  };
  badges: {
    matchScore: { label: string; value: string };
    essayShipped: { school: string; status: string };
  };
  socialProof: { headline: string; subline: string };
  counselorEyebrow: string;
  counselorSchools: string[];
};

const DENSE_TABS = ['list', 'fit', 'essay'] as const;
type DenseTabId = (typeof DENSE_TABS)[number];

function useDenseCockpitCopy(): DenseCockpitCopy {
  const t = useTranslations('home');
  return t.raw('hero.denseCockpit') as DenseCockpitCopy;
}

function DenseCockpitHero({
  reduced,
  disclosure,
}: {
  reduced: boolean;
  disclosure: HeroVisualSceneProps['disclosure'];
}) {
  const copy = useDenseCockpitCopy();
  const [tab, setTab] = useState<DenseTabId>('list');

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setTab((current) => {
        const idx = DENSE_TABS.indexOf(current);
        return DENSE_TABS[(idx + 1) % DENSE_TABS.length];
      });
    }, 4500);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div className="relative mx-auto w-full max-w-[600px]">
      <div
        aria-hidden
        className="absolute -right-3 -top-5 z-30 hidden rotate-[2deg] items-center gap-2.5 rounded-[10px] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-3.5 py-2 shadow-[var(--landing-shadow-elevated)] sm:flex"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[color:var(--lumni-moon)] to-[color:var(--ds-warning)] text-white">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <div className="text-2xs font-medium text-[var(--landing-muted)]">
            {copy.badges.matchScore.label}
          </div>
          <div className="font-mono text-base font-bold tracking-tight text-[var(--landing-fg)]">
            {copy.badges.matchScore.value}
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute -left-7 bottom-8 z-30 hidden -rotate-[2.5deg] items-center gap-2.5 rounded-[10px] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-3.5 py-2 shadow-[var(--landing-shadow-elevated)] sm:flex"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--ds-foreground)] text-[color:var(--ds-warning)]">
          <Check className="h-4 w-4" />
        </div>
        <div>
          <div className="text-2xs font-medium text-[var(--landing-muted)]">
            {copy.badges.essayShipped.school}
          </div>
          <div className="text-xs font-semibold text-[var(--landing-fg)]">
            {copy.badges.essayShipped.status}
          </div>
        </div>
      </div>

      <motion.div
        className="relative z-10 overflow-hidden rounded-[16px] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] text-[var(--landing-fg)] shadow-[var(--landing-shadow-elevated)]"
        animate={reduced ? undefined : { y: [0, -3, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="flex h-9 items-center gap-2.5 border-b border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/60 px-3.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#e0826b]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ds-warning)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#8a9670]" />
          </div>
          <div className="flex h-5 flex-1 items-center justify-center gap-1.5 rounded-[5px] bg-[color:var(--landing-surface-muted)] font-mono text-2xs tracking-tight text-[var(--landing-muted)]">
            <Lock className="h-2.5 w-2.5" aria-hidden />
            {copy.url}
          </div>
          <kbd className="rounded-[4px] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-1.5 py-0.5 font-mono text-2xs text-[var(--landing-muted)]">
            ⌘K
          </kbd>
        </div>

        <div
          role="tablist"
          className="flex gap-0 border-b border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4"
        >
          {DENSE_TABS.map((id) => {
            const label = copy.tabs[id];
            const Icon = id === 'list' ? School : id === 'fit' ? Target : Feather;
            const isActive = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(id)}
                className={cn(
                  '-mb-px flex h-9 items-center gap-1.5 border-b-2 px-3.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'border-[color:var(--ds-foreground)] text-[var(--landing-fg)]'
                    : 'border-transparent text-[var(--landing-muted)] hover:text-[var(--landing-fg)]'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="relative h-[380px] overflow-hidden bg-[color:var(--landing-surface)]">
          {tab === 'list' && <DenseListPane copy={copy} reduced={reduced} />}
          {tab === 'fit' && <DenseFitPane copy={copy} reduced={reduced} />}
          {tab === 'essay' && <DenseEssayPane copy={copy} disclosure={disclosure} />}
        </div>
      </motion.div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[10%] -bottom-10 h-16 rounded-full bg-[color:var(--landing-border-strong)] opacity-40 blur-[20px]"
      />
    </div>
  );
}

function DenseListPane({ copy, reduced }: { copy: DenseCockpitCopy; reduced: boolean }) {
  return (
    <div className="lumni-fade-in flex h-full flex-col gap-1.5 p-3.5">
      <div className="flex items-center justify-between px-2 pb-3">
        <div className="flex gap-2">
          <DenseTierPill tone="reach" count={2} label={copy.list.tierLabels.reach} />
          <DenseTierPill tone="target" count={2} label={copy.list.tierLabels.target} />
          <DenseTierPill tone="safety" count={1} label={copy.list.tierLabels.safety} />
        </div>
        <span className="font-mono text-2xs text-[var(--landing-muted)]">{copy.list.summary}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {copy.list.rows.map((row, index) => (
          <div
            key={row.name}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-lg bg-[color:var(--landing-surface-muted)]/50 px-3 py-2.5 ring-1 ring-inset ring-[color:var(--landing-border)]"
            style={{
              animation: reduced
                ? undefined
                : `lumni-fade-in 400ms ${100 + index * 60}ms backwards cubic-bezier(0.16,1,0.3,1)`,
            }}
          >
            <ProbRing value={row.probability / 100} size={36} tone={row.tone} strokeWidth={3} />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold tracking-tight text-[var(--landing-fg)]">
                {row.name}
              </div>
              <div className="text-2xs text-[var(--landing-muted)]">{row.loc}</div>
            </div>
            <Sparkline data={row.spark} width={64} height={22} tone={row.tone} />
            <DenseTierBadge tone={row.tone} label={copy.list.tierLabels[row.tone]} />
            <span className="min-w-[44px] text-right font-mono text-2xs text-[var(--landing-muted)]">
              {row.deadline}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DenseFitPane({ copy, reduced }: { copy: DenseCockpitCopy; reduced: boolean }) {
  return (
    <div className="lumni-fade-in h-full p-3.5">
      <div className="flex items-center justify-between px-2 pb-3.5">
        <div>
          <div className="text-xs font-semibold text-[var(--landing-fg)]">{copy.fit.title}</div>
          <div className="mt-0.5 text-2xs text-[var(--landing-muted)]">{copy.fit.subtitle}</div>
        </div>
        <ProbRing value={0.42} size={48} tone="target" />
      </div>
      <div className="grid gap-2">
        {copy.fit.factors.map((factor, index) => (
          <div
            key={factor.label}
            className="rounded-lg bg-[color:var(--landing-surface-muted)]/50 px-3 py-2.5 ring-1 ring-inset ring-[color:var(--landing-border)]"
            style={{
              animation: reduced
                ? undefined
                : `lumni-fade-in 400ms ${100 + index * 60}ms backwards cubic-bezier(0.16,1,0.3,1)`,
            }}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--landing-fg)]">{factor.label}</span>
              <span className="font-mono text-2xs font-semibold text-[var(--landing-muted)]">
                {factor.score}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[color:var(--landing-border)]">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-700 ease-out',
                  factor.tone === 'reach'
                    ? 'bg-[color:var(--ds-destructive)]'
                    : factor.tone === 'target'
                      ? 'bg-[color:var(--ds-warning)]'
                      : 'bg-[color:var(--ds-success)]'
                )}
                style={{ width: `${factor.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DenseEssayPane({
  copy,
  disclosure,
}: {
  copy: DenseCockpitCopy;
  disclosure: HeroVisualSceneProps['disclosure'];
}) {
  return (
    <div className="lumni-fade-in grid h-full grid-cols-[1fr_220px] gap-3 p-3.5">
      <div className="rounded-lg bg-[color:var(--landing-surface-muted)]/50 p-3.5 ring-1 ring-inset ring-[color:var(--landing-border)]">
        <div className="mb-2 font-mono text-2xs text-[var(--landing-muted)]">
          {copy.essay.promptLabel}
        </div>
        <div className="text-xs leading-relaxed text-[var(--landing-fg)]">
          {copy.essay.body}
          <span className="bg-[color:var(--ds-warning)]/35 underline decoration-[color:var(--ds-warning)] decoration-[1.5px] underline-offset-2">
            {copy.essay.accentLine}
          </span>
          ...
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-lg bg-gradient-to-b from-[color:var(--landing-surface)] to-[color:var(--landing-surface-muted)] p-3 ring-1 ring-inset ring-[color:var(--landing-border)]">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Sparkles className="h-2.5 w-2.5 text-[color:var(--ds-warning)]" aria-hidden />
            <span className="text-2xs font-semibold uppercase tracking-[0.04em] text-[var(--lumni-gold-ink)]">
              {copy.essay.coachLabel}
            </span>
          </div>
          <p className="text-2xs leading-snug text-[var(--landing-muted)]">
            {copy.essay.coachNote}
          </p>
        </div>
        <div className="flex flex-col gap-2.5 rounded-lg bg-[color:var(--landing-surface-muted)]/50 p-3 ring-1 ring-inset ring-[color:var(--landing-border)]">
          {copy.essay.scores.map((score) => (
            <div key={score.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-2xs text-[var(--landing-muted)]">{score.label}</span>
                <span
                  className={cn(
                    'font-mono text-2xs font-semibold',
                    score.tone === 'reach'
                      ? 'text-[color:var(--ds-destructive)]'
                      : score.tone === 'target'
                        ? 'text-[color:var(--ds-warning)]'
                        : 'text-[color:var(--ds-success)]'
                  )}
                >
                  {score.score}
                </span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-[color:var(--landing-border)]">
                <div
                  className={cn(
                    'h-full rounded-full',
                    score.tone === 'reach'
                      ? 'bg-[color:var(--ds-destructive)]'
                      : score.tone === 'target'
                        ? 'bg-[color:var(--ds-warning)]'
                        : 'bg-[color:var(--ds-success)]'
                  )}
                  style={{ width: `${score.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="lumni-disclosure-on-light mt-1 border-t border-dashed border-[color:var(--landing-border)] pt-2.5">
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
  );
}

function DenseTierPill({
  tone,
  count,
  label,
}: {
  tone: 'reach' | 'target' | 'safety';
  count: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--landing-surface-muted)] px-2 py-0.5 text-2xs font-medium text-[var(--landing-fg)] ring-1 ring-inset ring-[color:var(--landing-border)]">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'reach'
            ? 'bg-[color:var(--ds-destructive)]'
            : tone === 'target'
              ? 'bg-[color:var(--ds-warning)]'
              : 'bg-[color:var(--ds-success)]'
        )}
      />
      {count} {label}
    </span>
  );
}

function DenseTierBadge({ tone, label }: { tone: 'reach' | 'target' | 'safety'; label: string }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide',
        tone === 'reach'
          ? 'bg-[color:var(--ds-destructive)]/15 text-[color:var(--ds-destructive)]'
          : tone === 'target'
            ? 'bg-[color:var(--ds-warning)]/15 text-[color:var(--ds-warning)]'
            : 'bg-[color:var(--ds-success)]/15 text-[color:var(--ds-success)]'
      )}
    >
      {label}
    </span>
  );
}

function DenseSocialProofRow() {
  const copy = useDenseCockpitCopy();
  const initials = ['SC', 'JP', 'AM', 'KW'];
  const tones = [
    'bg-[color:var(--ds-foreground)] text-[color:var(--ds-background)]',
    'bg-[color:var(--ds-warning)] text-[color:var(--ds-foreground)]',
    'bg-[color:var(--ds-success)] text-[color:var(--ds-foreground)]',
    'bg-[color:var(--ds-info)] text-[color:var(--ds-foreground)]',
  ];
  return (
    <div className="mt-7 flex items-center gap-5 border-t border-[color:var(--landing-border)] pt-6">
      <div className="flex">
        {initials.map((label, index) => (
          <div
            key={label}
            aria-hidden
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-2xs font-semibold ring-2 ring-[color:var(--landing-bg)]',
              tones[index]
            )}
            style={{ marginLeft: index === 0 ? 0 : -10 }}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-[var(--landing-fg)]">
          {copy.socialProof.headline}
        </div>
        <div className="mt-0.5 text-xs text-[var(--landing-muted)]">{copy.socialProof.subline}</div>
      </div>
    </div>
  );
}

function DenseCounselorRow() {
  const copy = useDenseCockpitCopy();
  return (
    <div className="relative mx-auto mt-20 hidden max-w-[1100px] px-8 text-center md:block">
      <div className="mb-5 text-xs font-medium uppercase tracking-[0.08em] text-[var(--landing-muted)]">
        {copy.counselorEyebrow}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4 opacity-55">
        {copy.counselorSchools.map((name) => (
          <span
            key={name}
            className="text-lg font-semibold tracking-tight text-[var(--landing-fg)]"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function DeerMoonWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -left-12 top-32 z-0 hidden h-[620px] w-[620px] opacity-[0.07] lg:block"
      style={{
        maskImage: 'radial-gradient(circle at 50% 50%, black 50%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 50%, transparent 80%)',
      }}
    >
      <LumniMark
        showDisc={false}
        className="h-full w-full text-[var(--landing-fg)]"
        iconClassName="h-full w-full"
      />
    </div>
  );
}

/* ============================================================
   Centered Mark — illustrative deer-moon centerpiece w/ parallax
   ============================================================ */

type CenteredMarkCopy = {
  eyebrowBadge: string;
  eyebrow: string;
  headline: { lead: string; accent: string };
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  trustItems: { icon: 'check' | 'shield'; text: string }[];
  counselorEyebrow: string;
  counselorSchools: string[];
};

function CenteredMarkHero({ reduced }: { reduced: boolean }) {
  const t = useTranslations('home');
  const copy = t.raw('hero.centeredMark') as CenteredMarkCopy;

  return (
    <div className="relative mx-auto max-w-[1280px] px-6">
      <div className="mb-9 text-center">
        <div className="landing-eyebrow-pill inline-flex">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-[color:var(--ds-warning)]/35 to-[color:var(--ds-warning)] px-2 py-0.5 text-2xs font-semibold text-[var(--landing-fg)]">
            <Sparkles className="h-2.5 w-2.5" aria-hidden /> {copy.eyebrowBadge}
          </span>
          <span className="text-xs text-[var(--landing-muted)]">{copy.eyebrow}</span>
          <ArrowRight className="h-3 w-3 text-[var(--landing-muted)]" aria-hidden />
        </div>
      </div>

      <div className="relative mx-auto text-center">
        <ParallaxDeerMoon reduced={reduced} />

        <h1 className="mx-auto mt-10 max-w-[920px] text-balance text-[clamp(48px,7vw,84px)] font-semibold leading-[1.0] tracking-[-0.034em] text-[var(--landing-fg)]">
          <span className="block">{copy.headline.lead}</span>
          <span
            className="block bg-gradient-to-b from-[color:var(--ds-warning)] to-[var(--lumni-gold-ink)] bg-clip-text italic text-transparent"
            style={{ fontWeight: 400 }}
          >
            {copy.headline.accent}
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-[580px] text-balance text-lg leading-[1.55] text-[var(--landing-muted)]">
          {copy.subtitle}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register">
            <Button
              size="lg"
              className="h-12 min-w-[160px] rounded-[var(--theme-radius-button)] bg-[var(--landing-fg)] px-7 text-sm font-medium text-[var(--landing-bg)] hover:bg-[var(--landing-fg)]/90 sm:h-14 sm:min-w-[180px] sm:px-8 sm:text-base"
            >
              {copy.primaryCta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/cases">
            <Button
              variant="outline"
              size="lg"
              className="h-12 min-w-[160px] rounded-[var(--theme-radius-button)] border-[color:var(--landing-border-strong)] bg-[color:var(--landing-surface)]/52 px-7 text-sm text-[var(--landing-fg)] hover:bg-[color:var(--landing-surface-muted)] sm:h-14 sm:min-w-[180px] sm:px-8 sm:text-base"
            >
              <Play className="h-3.5 w-3.5" />
              {copy.secondaryCta}
            </Button>
          </Link>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--landing-muted)]">
          {copy.trustItems.map((item, idx) => (
            <span key={item.text} className="inline-flex items-center gap-2 whitespace-nowrap">
              {idx > 0 && (
                <span
                  aria-hidden
                  className="h-[3px] w-[3px] rounded-full bg-[color:var(--landing-border-strong)]"
                />
              )}
              {item.icon === 'check' ? (
                <Check className="h-3 w-3 text-[color:var(--ds-success)]" aria-hidden />
              ) : (
                <ShieldCheck className="h-3 w-3 text-[color:var(--ds-success)]" aria-hidden />
              )}
              {item.text}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mx-auto mt-20 hidden max-w-[1100px] px-8 text-center md:block">
        <div className="mb-5 text-xs font-medium uppercase tracking-[0.10em] text-[var(--landing-muted)]">
          {copy.counselorEyebrow}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 opacity-55">
          {copy.counselorSchools.map((name) => (
            <span
              key={name}
              className="text-lg font-semibold tracking-tight text-[var(--landing-fg)]"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ParallaxDeerMoon({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (reduced) return;
    function handle(event: MouseEvent) {
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (event.clientX - cx) / window.innerWidth;
      const dy = (event.clientY - cy) / window.innerHeight;
      setTilt({ x: dx * 6, y: dy * 6 });
    }
    window.addEventListener('mousemove', handle);
    return () => window.removeEventListener('mousemove', handle);
  }, [reduced]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="relative mx-auto"
      style={{
        width: 'min(420px, 80vw)',
        height: 'min(420px, 80vw)',
        perspective: 1200,
        transform: `rotateX(${-tilt.y}deg) rotateY(${tilt.x}deg)`,
        transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          inset: '8%',
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--lumni-moon) 55%, transparent), color-mix(in oklab, var(--lumni-moon) 10%, transparent) 60%, transparent 75%)',
          filter: 'blur(6px)',
        }}
      />
      <LumniMark
        className="relative h-full w-full text-[var(--landing-fg)]"
        iconClassName="h-full w-full"
      />
    </div>
  );
}

/* ============================================================
   ProbRing & Sparkline — private SVG helpers used by DenseCockpit
   ============================================================ */

const TONE_VAR: Record<'reach' | 'target' | 'safety', string> = {
  reach: 'var(--ds-destructive)',
  target: 'var(--ds-warning)',
  safety: 'var(--ds-success)',
};

function ProbRing({
  value,
  size,
  tone,
  strokeWidth = 3,
}: {
  value: number;
  size: number;
  tone: 'reach' | 'target' | 'safety';
  strokeWidth?: number;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Probability ${Math.round(clamped * 100)}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--landing-border)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={TONE_VAR[tone]}
        strokeWidth={strokeWidth}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-mono, monospace)"
        fontSize={size * 0.32}
        fontWeight={600}
        fill="var(--landing-fg)"
      >
        {Math.round(clamped * 100)}
      </text>
    </svg>
  );
}

function Sparkline({
  data,
  width,
  height,
  tone,
  strokeWidth = 1.5,
}: {
  data: number[];
  width: number;
  height: number;
  tone: 'reach' | 'target' | 'safety';
  strokeWidth?: number;
}) {
  if (data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - strokeWidth) - strokeWidth / 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        fill="none"
        stroke={TONE_VAR[tone]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

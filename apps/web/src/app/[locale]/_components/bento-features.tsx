'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, BarChart3, Clock3, FileText, Shield, Sparkles, Users } from 'lucide-react';
import { AdmissionTierBadge, StatusDot } from '@/components/features/landing';
import { PageContainer } from '@/components/layout/page-container';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { useHomeContent, type HomeContentItem } from './home-content';

type MatchingVisualCopy = {
  label: string;
  schools: Array<{ name: string; odds: number; tier: 'reach' | 'target' | 'safety' }>;
};

type EssayVisualCopy = {
  kicker: string;
  lines: string[];
  chips: string[];
};

type TimelineVisualCopy = {
  label: string;
  items: Array<{ month: string; label: string }>;
};

type ProbabilityVisualCopy = {
  label: string;
  ranges: Array<{ tier: 'reach' | 'target' | 'safety'; text: string }>;
  note: string;
};

type TeamVisualCopy = {
  label: string;
  members: Array<{ name: string; task: string; status: 'success' | 'warning' | 'ai' }>;
};

type MentorVisualCopy = {
  label: string;
  quote: string;
  points: string[];
};

const featureRoutes = [
  '/schools',
  '/essays',
  '/timeline',
  '/prediction',
  '/teams',
  '/help',
] as const;
const featureSpans = [
  'lg:col-span-4',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-6',
] as const;
const featureIcons = [BarChart3, FileText, Clock3, Sparkles, Users, Shield] as const;

export function BentoFeatures() {
  const home = useHomeContent();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="features" className="landing-section relative">
      <PageContainer variant="marketing" className="relative">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <div className="landing-kicker">{home.features.eyebrow}</div>
          <h2 className="mt-4 text-display-section text-[var(--landing-fg)]">
            {home.features.title}
          </h2>
          {home.features.subtitle ? (
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--landing-muted)] sm:text-lg">
              {home.features.subtitle}
            </p>
          ) : null}
        </motion.div>

        <div className="mt-10 grid gap-5 lg:grid-cols-6">
          {home.features.items.map((item, index) => (
            <FeatureCard
              key={item.number}
              item={item}
              href={featureRoutes[index]}
              index={index}
              reduced={!!prefersReducedMotion}
              className={featureSpans[index]}
            />
          ))}
        </div>
      </PageContainer>
    </section>
  );
}

function FeatureCard({
  item,
  href,
  index,
  reduced,
  className,
}: {
  item: HomeContentItem;
  href: string;
  index: number;
  reduced: boolean;
  className: string;
}) {
  const t = useTranslations('home');
  const visuals = [
    <MatchingVisual key="matching" />,
    <EssayVisual key="essay" />,
    <TimelineVisual key="timeline" />,
    <ProbabilityVisual key="probability" />,
    <TeamVisual key="team" />,
    <MentorVisual key="mentor" />,
  ];

  const Icon = featureIcons[index];

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.55, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <Link
        href={href}
        className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] shadow-[var(--landing-shadow-card)] transition duration-300 hover:-translate-y-0.5 hover:border-[color:var(--landing-border-strong)] hover:shadow-[var(--landing-shadow-elevated)]"
      >
        <div className="flex h-full flex-col gap-6 p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-semibold leading-none tracking-[-0.04em] text-[var(--landing-subtle)]">
                  {item.number}
                </span>
                {item.tag ? (
                  <span className="mb-2 text-2xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
                    {item.tag}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-5 text-2xl font-bold leading-8 tracking-tight text-balance text-[var(--landing-fg)]">
                {item.title}
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-8 text-balance text-[var(--landing-muted)] sm:text-base">
                {item.description}
              </p>
            </div>
            <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)] text-[var(--landing-muted)] transition group-hover:text-[var(--landing-fg)]">
              <Icon className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-auto">{visuals[index]}</div>

          <div className="inline-flex items-center gap-2 text-sm text-[var(--landing-muted)]">
            <span>{t('features.visuals.openModule')}</span>
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function MatchingVisual() {
  const t = useTranslations('home');
  const copy = t.raw('features.visuals.matching') as MatchingVisualCopy;

  return (
    <div className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/65 p-4">
      <div className="text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
        {copy.label}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <AdmissionTierBadge tier="reach" showBand />
        <AdmissionTierBadge tier="target" showBand />
        <AdmissionTierBadge tier="safety" showBand />
      </div>
      <div className="mt-4 space-y-3">
        {copy.schools.map((school) => (
          <div key={school.name} className="flex items-center gap-3">
            <div className="w-16 text-sm text-[var(--landing-fg)]">{school.name}</div>
            <div className="h-2 flex-1 rounded-full bg-[var(--landing-border)]">
              <div
                className={cn(
                  'h-2 rounded-full',
                  school.tier === 'reach' && 'bg-[color:var(--ds-status-reach)]',
                  school.tier === 'target' && 'bg-[color:var(--ds-status-target)]',
                  school.tier === 'safety' && 'bg-[color:var(--ds-status-safety)]'
                )}
                style={{ width: `${school.odds}%` }}
              />
            </div>
            <div className="w-10 text-right font-mono text-xs text-[var(--landing-muted)]">
              {school.odds}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EssayVisual() {
  const t = useTranslations('home');
  const copy = t.raw('features.visuals.essay') as EssayVisualCopy;

  return (
    <div className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/65 p-4">
      <div className="flex items-center justify-between text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
        <span>{copy.kicker}</span>
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="mt-4 space-y-2 text-sm leading-7 text-[var(--landing-fg)]">
        <div>{copy.lines[0]}</div>
        <div className="inline-block rounded-lg border border-[color:var(--ds-status-reach)]/20 bg-[color:var(--ds-status-reach-bg)] px-2 py-1 text-[color:var(--ds-status-reach-fg)] line-through">
          {copy.lines[1]}
        </div>
        <div className="inline-block rounded-lg border border-[color:var(--ds-status-safety)]/20 bg-[color:var(--ds-status-safety-bg)] px-2 py-1 text-[color:var(--ds-status-safety-fg)]">
          {copy.lines[2]}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {copy.chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-3 py-1 text-2xs text-[var(--landing-muted)]"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function TimelineVisual() {
  const t = useTranslations('home');
  const copy = t.raw('features.visuals.timeline') as TimelineVisualCopy;

  return (
    <div className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/65 p-4">
      <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
        <Clock3 className="h-3.5 w-3.5 text-primary" />
        <span>{copy.label}</span>
      </div>
      <div className="mt-4 space-y-4">
        {copy.items.map((item, index) => (
          <div key={item.month} className="flex items-start gap-3">
            <div className="flex min-w-12 flex-col items-center">
              <div className="text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
                {item.month}
              </div>
              {index < copy.items.length - 1 ? (
                <div className="mt-2 h-10 w-px bg-[var(--landing-border)]" />
              ) : null}
            </div>
            <div className="flex-1 rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4 py-3 text-sm text-[var(--landing-fg)] shadow-[var(--landing-shadow-card)]">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProbabilityVisual() {
  const t = useTranslations('home');
  const copy = t.raw('features.visuals.probability') as ProbabilityVisualCopy;

  return (
    <div className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/65 p-4">
      <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
        <BarChart3 className="h-3.5 w-3.5 text-primary" />
        <span>{copy.label}</span>
      </div>
      <div className="mt-4 space-y-3">
        {copy.ranges.map((range) => (
          <div
            key={range.text}
            className="flex items-center justify-between rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4 py-3 shadow-[var(--landing-shadow-card)]"
          >
            <span className="text-sm text-[var(--landing-fg)]">{range.text}</span>
            <AdmissionTierBadge tier={range.tier} />
          </div>
        ))}
      </div>
      <div className="mt-4 text-sm text-[var(--landing-muted)]">{copy.note}</div>
    </div>
  );
}

function TeamVisual() {
  const t = useTranslations('home');
  const copy = t.raw('features.visuals.team') as TeamVisualCopy;

  return (
    <div className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/65 p-4">
      <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
        <Users className="h-3.5 w-3.5 text-primary" />
        <span>{copy.label}</span>
      </div>
      <div className="mt-4 space-y-3">
        {copy.members.map((member) => (
          <div
            key={member.name}
            className="flex items-center gap-3 rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4 py-3 shadow-[var(--landing-shadow-card)]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)] text-sm font-semibold text-[var(--landing-fg)]">
              {member.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-[var(--landing-fg)]">{member.name}</div>
              <div className="truncate text-xs text-[var(--landing-muted)]">{member.task}</div>
            </div>
            <StatusDot status={member.status} pulse={member.status === 'ai'} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MentorVisual() {
  const t = useTranslations('home');
  const copy = t.raw('features.visuals.mentor') as MentorVisualCopy;

  return (
    <div className="grid gap-4 rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface-muted)]/65 p-4 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-3xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-5 py-5 shadow-[var(--landing-shadow-card)]">
        <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span>{copy.label}</span>
        </div>
        <div className="mt-4 text-xl italic leading-relaxed tracking-[-0.01em] text-[var(--landing-fg)]">
          {copy.quote}
        </div>
      </div>
      <div className="space-y-3">
        {copy.points.map((point, index) => (
          <div
            key={point}
            className="flex items-center gap-3 rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4 py-4 shadow-[var(--landing-shadow-card)]"
          >
            <span className="text-sm font-semibold text-[var(--landing-subtle)]">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="text-sm text-[var(--landing-fg)]">{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

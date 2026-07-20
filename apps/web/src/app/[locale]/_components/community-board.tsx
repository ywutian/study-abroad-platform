'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, MessageCircleMore, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { PageContainer } from '@/components/layout/page-container';
import { Link } from '@/lib/i18n/navigation';

import { LANDING_LINKS } from './landing-links';

type CommunityBoardCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  liveLabel: string;
  liveTitle: string;
  liveBody: string;
  prompt: string;
  reply: string;
  cards: Array<{
    tag: string;
    title: string;
    body: string;
  }>;
};

const showcaseImages = [
  '/images/landing/community/chat.png',
  '/images/landing/community/recommendation.png',
  '/images/landing/community/prediction.png',
  '/images/landing/community/essay-editor.png',
  '/images/landing/community/timeline.png',
  '/images/landing/community/forum.png',
] as const;

export function CommunityBoard() {
  const t = useTranslations('home');
  const copy = t.raw('communityBoard') as CommunityBoardCopy;
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="community"
      className="landing-section relative overflow-hidden border-y border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/62"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,color-mix(in_oklab,var(--ds-primary)_12%,transparent),transparent_31%)]" />

      <PageContainer variant="marketing" className="relative">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <div className="landing-kicker">{copy.eyebrow}</div>
            <h2 className="mt-4 text-display-section text-[var(--landing-fg)]">{copy.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--landing-muted)] sm:text-lg">
              {copy.subtitle}
            </p>
          </motion.div>

          <Link
            href={LANDING_LINKS.register}
            className="group inline-flex w-fit items-center gap-2 border-b border-[color:var(--landing-fg)] pb-1 text-sm font-medium text-[var(--landing-fg)] transition hover:text-[var(--landing-muted)]"
          >
            {copy.cta}
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-10 grid gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.78fr)]">
          <motion.aside
            initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.24 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex min-h-[310px] flex-col justify-between overflow-hidden rounded-xl border border-[color:var(--landing-border-strong)] bg-[var(--landing-fg)] p-6 text-[var(--landing-bg)] shadow-[var(--landing-shadow-elevated)] sm:p-7"
          >
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full border border-[var(--landing-bg)]/15" />
            <div className="absolute right-9 top-11 h-20 w-20 rounded-full border border-[var(--landing-bg)]/15" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--landing-bg)]/20 bg-[var(--landing-bg)]/10 px-3 py-1.5 text-2xs uppercase tracking-[0.2em] text-[var(--landing-bg)]/78">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-warning)]" />
                {copy.liveLabel}
              </div>
              <h3 className="mt-6 max-w-sm text-3xl font-semibold leading-tight tracking-[-0.035em]">
                {copy.liveTitle}
              </h3>
              <p className="mt-4 max-w-md text-sm leading-7 text-[var(--landing-bg)]/72 sm:text-base">
                {copy.liveBody}
              </p>
            </div>

            <div className="relative mt-8 space-y-3">
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-[var(--landing-bg)]/12 px-4 py-3 text-sm leading-6 text-[var(--landing-bg)]/92">
                {copy.prompt}
              </div>
              <div className="ml-auto max-w-[84%] rounded-2xl rounded-br-sm bg-[var(--ds-warning)] px-4 py-3 text-sm font-medium leading-6 text-[var(--landing-fg)]">
                {copy.reply}
              </div>
            </div>
          </motion.aside>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {copy.cards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.18 }}
                transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href={LANDING_LINKS.register}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] shadow-[var(--landing-shadow-card)] transition duration-300 hover:-translate-y-1 hover:border-[color:var(--landing-border-strong)] hover:shadow-[var(--landing-shadow-elevated)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden border-b border-[color:var(--landing-border)] bg-[var(--landing-bg)]">
                    <Image
                      src={showcaseImages[index] ?? showcaseImages[0]}
                      alt={card.title}
                      fill
                      sizes="(min-width: 1280px) 22vw, (min-width: 640px) 42vw, 92vw"
                      className="object-cover object-top transition duration-500 group-hover:scale-[1.035]"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--landing-bg)]/35 to-transparent" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-2xs uppercase tracking-[0.18em] text-[var(--landing-subtle)]">
                        {card.tag}
                      </span>
                      {index === 0 ? (
                        <MessageCircleMore className="h-4 w-4 text-[var(--landing-muted)]" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-[var(--landing-muted)]" />
                      )}
                    </div>
                    <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-[var(--landing-fg)]">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--landing-muted)]">
                      {card.body}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </PageContainer>
    </section>
  );
}

'use client';

import { ArrowRight } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { LumniMark } from '@/components/ui/lumni-mark';
import { Link } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/stores';
import { useHomeContent } from './home-content';

const footerRoutes = [
  ['/schools', '/essays', '/timeline', '/prediction', '/teams'],
  ['/cases', '/help', '/about', '/register', '/terms'],
  ['/about', '/teams', '/help', '/privacy', '/register'],
  ['/privacy', '/terms', '/help'],
] as const;

export function CTAFooter() {
  const home = useHomeContent();
  const { user } = useAuthStore();

  return (
    <>
      <section
        id="cta"
        className="landing-section relative overflow-hidden border-t border-[color:var(--landing-border)]"
      >
        <PageContainer variant="marketing">
          <div className="mx-auto max-w-4xl text-center">
            <div className="landing-kicker justify-center">{home.cta.eyebrow}</div>
            <h2 className="mt-5 text-display-hero font-bold leading-[0.96] tracking-tight text-[var(--landing-fg)]">
              <span className="block text-balance">{home.cta.title[0]}</span>
              <span className="landing-hero-accent mt-2 block text-balance">
                {home.cta.title[1]}
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[var(--landing-muted)] sm:text-lg">
              {home.cta.subtitle}
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register">
                <Button
                  size="lg"
                  className="btn-elegant-glow h-12 rounded-full border border-primary/10 bg-[var(--landing-fg)] px-8 text-sm text-[var(--landing-bg)] shadow-[var(--landing-shadow-elevated)] hover:bg-[var(--landing-fg)]/92 sm:h-14 sm:text-base"
                >
                  {home.cta.primary}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/help">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-full border-[color:var(--landing-border-strong)] bg-[color:var(--landing-surface)]/72 px-8 text-sm text-[var(--landing-fg)] hover:bg-[color:var(--landing-surface-muted)] sm:h-14 sm:text-base"
                >
                  {home.cta.secondary}
                </Button>
              </Link>
            </div>

            <div className="mt-6 text-2xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
              {home.cta.trust}
            </div>
          </div>
        </PageContainer>
      </section>

      <footer className="border-t border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/65">
        <PageContainer variant="marketing" className="py-10 sm:py-12">
          <div className="grid gap-10 lg:grid-cols-[1.8fr_repeat(4,minmax(0,1fr))]">
            <div>
              <Link href={user ? '/dashboard' : '/'} className="inline-flex items-center gap-3">
                <LumniMark className="h-11 w-11" iconClassName="h-5 w-5" />
                <span className="text-2xl font-semibold tracking-[-0.02em] text-[var(--landing-fg)]">
                  {home.brand}
                </span>
              </Link>
              <p className="mt-5 max-w-md text-sm leading-7 text-[var(--landing-muted)] sm:text-base">
                {home.footer.description}
              </p>
            </div>

            {home.footer.columns.map((column, columnIndex) => (
              <div key={column.title}>
                <div className="text-2xs uppercase tracking-[0.22em] text-[var(--landing-subtle)]">
                  {column.title}
                </div>
                <ul className="mt-4 space-y-3">
                  {column.links.map((label, labelIndex) => (
                    <li key={label}>
                      <Link
                        href={footerRoutes[columnIndex][labelIndex] ?? '/'}
                        className="text-sm text-[var(--landing-muted)] transition hover:text-[var(--landing-fg)]"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-[color:var(--landing-border)] pt-6 text-sm text-[var(--landing-subtle)] sm:flex-row sm:items-center sm:justify-between">
            <span>{home.footer.copyright}</span>
            <span className="text-2xs uppercase tracking-[0.22em]">{home.footer.note}</span>
          </div>
        </PageContainer>
      </footer>
    </>
  );
}

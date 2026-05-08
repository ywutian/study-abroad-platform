'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Globe, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ColorPaletteMenu } from '@/components/ui/color-palette-menu';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LumniMark } from '@/components/ui/lumni-mark';
import { PageContainer } from '@/components/layout/page-container';
import { type Locale } from '@/lib/i18n/config';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores';
import { useHomeContent } from './home-content';

const localeCodes: Record<Locale, string> = {
  en: 'EN',
  zh: 'ZH',
};

type NavItem = {
  label: string;
  href: string;
  anchor?: boolean;
};

export function LandingHeader() {
  const { user } = useAuthStore();
  const home = useHomeContent();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as Locale;
  const prefersReducedMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { label: home.nav.product, href: '#features', anchor: true },
    { label: home.nav.cases, href: '/cases' },
    { label: home.nav.pricing, href: '#cta', anchor: true },
    { label: home.nav.community, href: '/teams' },
    { label: home.nav.about, href: '/about' },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLocaleChange = (nextLocale: Locale) => {
    router.replace('/', { locale: nextLocale });
  };

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-[color:var(--landing-border-strong)] bg-[var(--theme-nav-bg,var(--landing-glass))] shadow-[var(--theme-nav-shadow,none)]'
            : 'border-b border-transparent bg-transparent'
        )}
        style={
          scrolled
            ? {
                backdropFilter:
                  'var(--theme-nav-blur, saturate(160%) blur(var(--theme-backdrop-blur, 12px)))',
              }
            : undefined
        }
      >
        <PageContainer
          variant="marketing"
          className="flex h-[var(--theme-nav-height,74px)] items-center justify-between"
        >
          <div className="flex items-center gap-5 lg:gap-8">
            <Link
              href={user ? '/dashboard' : '/'}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex items-center gap-3">
                <LumniMark className="h-10 w-10" iconClassName="h-5 w-5" />
                <span className="hidden sm:flex sm:flex-col">
                  <span className="text-lg font-semibold leading-none tracking-[-0.02em] text-[var(--landing-fg)]">
                    {home.brand}
                  </span>
                  <span className="mt-1 text-2xs uppercase tracking-[0.24em] text-[var(--landing-subtle)]">
                    {home.hero.statLabel}
                  </span>
                </span>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) =>
                item.anchor ? (
                  <a key={item.label} href={item.href} className="landing-nav-link">
                    {item.label}
                  </a>
                ) : (
                  <Link key={item.label} href={item.href} className="landing-nav-link">
                    {item.label}
                  </Link>
                )
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-[var(--theme-radius-button)] px-4 text-[var(--landing-muted)] hover:bg-[color:var(--landing-surface-muted)] hover:text-[var(--landing-fg)]"
                >
                  {home.nav.signIn}
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="rounded-[var(--theme-radius-button)] border border-primary/10 bg-[var(--landing-fg)] px-4 text-[var(--landing-bg)] shadow-[var(--landing-shadow-card)] hover:bg-[var(--landing-fg)]/92 hover:shadow-[var(--landing-shadow-elevated)]"
                >
                  {home.nav.getStarted}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            <ColorPaletteMenu className="shrink-0 rounded-[var(--theme-radius-button)] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/80 text-[var(--landing-fg)] hover:bg-[color:var(--landing-surface-muted)] hover:text-[var(--landing-fg)]" />
            <ThemeToggle className="shrink-0 rounded-[var(--theme-radius-button)] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/80 text-[var(--landing-muted)] hover:text-[var(--landing-fg)]" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-[var(--theme-radius-button)] border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/80 px-3 text-[var(--landing-muted)] hover:bg-[color:var(--landing-surface-muted)] hover:text-[var(--landing-fg)]"
                  suppressHydrationWarning
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">{localeCodes[locale]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[132px] border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] text-[var(--landing-fg)]"
              >
                {(Object.entries(localeCodes) as [Locale, string][]).map(([loc, code]) => (
                  <DropdownMenuItem
                    key={loc}
                    onClick={() => handleLocaleChange(loc)}
                    className={cn(
                      'cursor-pointer text-[var(--landing-muted)] focus:bg-[color:var(--landing-surface-muted)] focus:text-[var(--landing-fg)]',
                      locale === loc &&
                        'bg-[color:var(--landing-surface-muted)] text-[var(--landing-fg)]'
                    )}
                  >
                    {code} · {loc === 'en' ? 'English' : 'Chinese'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              className="rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/80 px-3 text-[var(--landing-muted)] hover:bg-[color:var(--landing-surface-muted)] hover:text-[var(--landing-fg)] lg:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </PageContainer>
      </header>

      <div
        className={cn(
          /* §7 Tooling 层:导航覆盖层降级圆角 rounded-xl → rounded-lg (marketing 层控制在 xl 以内) */
          'fixed inset-x-4 top-[78px] z-40 origin-top rounded-lg border border-[color:var(--landing-border-strong)] bg-[color:var(--theme-popover-bg)] px-4 py-4 shadow-[var(--landing-shadow-elevated)] backdrop-blur-[var(--theme-backdrop-blur)] transition duration-300 lg:hidden',
          mobileMenuOpen
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0',
          prefersReducedMotion && 'transition-none'
        )}
      >
        <nav className="flex flex-col gap-1">
          {navItems.map((item) =>
            item.anchor ? (
              <a
                key={item.label}
                href={item.href}
                className="rounded-lg px-4 py-3 text-sm text-[var(--landing-muted)] transition hover:bg-[color:var(--landing-surface-muted)] hover:text-[var(--landing-fg)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg px-4 py-3 text-sm text-[var(--landing-muted)] transition hover:bg-[color:var(--landing-surface-muted)] hover:text-[var(--landing-fg)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="mt-4 grid gap-2 border-t border-[color:var(--landing-border)] pt-4 sm:grid-cols-2">
          <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="outline"
              className="w-full rounded-[var(--theme-radius-button)] border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] text-[var(--landing-fg)]"
            >
              {home.nav.signIn}
            </Button>
          </Link>
          <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
            <Button className="w-full rounded-[var(--theme-radius-button)] bg-[var(--landing-fg)] text-[var(--landing-bg)] shadow-[var(--landing-shadow-card)]">
              {home.nav.getStarted}
            </Button>
          </Link>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-[color:var(--landing-border)] pt-4">
          <ColorPaletteMenu
            align="end"
            className="rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/80 text-[var(--landing-fg)] hover:bg-[color:var(--landing-surface-muted)]"
          />
          <ThemeToggle className="rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)]/80 text-[var(--landing-muted)] hover:text-[var(--landing-fg)]" />
        </div>
      </div>
    </>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { type Locale } from '@/lib/i18n/config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Menu, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuthStore } from '@/stores';

const localeCodes: Record<Locale, string> = {
  en: 'EN',
  zh: 'ZH',
};

type ScrollState = 'top' | 'scrolling' | 'scrolled';

const NAV_LINKS = [
  { key: 'schools', href: '/schools' },
  { key: 'cases', href: '/cases' },
  { key: 'forum', href: '/forum' },
  { key: 'ai', href: '/ai' },
] as const;

export function LandingHeader() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as Locale;
  const { user } = useAuthStore();
  const prefersReducedMotion = useReducedMotion();
  const [scrollState, setScrollState] = useState<ScrollState>('top');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const getScrollState = (y: number): ScrollState => {
      if (y <= 20) return 'top';
      if (y <= 200) return 'scrolling';
      return 'scrolled';
    };

    setScrollState(getScrollState(window.scrollY));

    const handleScroll = () => {
      setScrollState(getScrollState(window.scrollY));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    router.replace('/', { locale: newLocale });
  };

  return (
    <>
      <header
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
        className={cn(
          'px-4 py-3 sm:py-4 border-b border-transparent',
          'transition-all duration-500 ease-out',
          scrollState === 'top' && 'bg-transparent',
          scrollState === 'scrolling' && 'glass border-border/5',
          scrollState === 'scrolled' && 'glass-premium border-border/10 header-border-gradient'
        )}
      >
        <div className="container mx-auto flex items-center justify-between">
          {/* Logo */}
          <motion.div
            whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2">
              <Logo size="sm" />
            </Link>
          </motion.div>

          {/* Desktop nav links — md+ */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ key, href }) => (
              <Link
                key={key}
                href={href}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg',
                  'text-muted-foreground hover:text-foreground',
                  'hover:bg-accent/50 transition-colors duration-200'
                )}
              >
                {t(`nav.${key}`)}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Auth buttons - desktop */}
            <div className="hidden sm:flex items-center gap-2 mr-1">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-sm">
                  {t('common.login')}
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="text-sm gap-1.5">
                  {t('common.register')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            <ThemeToggle />

            {/* Language switcher — compact locale code */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 sm:gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 px-2"
                  suppressHydrationWarning
                >
                  <Globe className="h-4 w-4" />
                  <span className="text-xs font-medium" suppressHydrationWarning>
                    {localeCodes[locale]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-dropdown border-dropdown min-w-[120px]"
              >
                {(Object.entries(localeCodes) as [Locale, string][]).map(([loc, code]) => (
                  <DropdownMenuItem
                    key={loc}
                    onClick={() => handleLocaleChange(loc)}
                    className={cn(
                      'text-dropdown-muted hover:text-dropdown hover:bg-accent cursor-pointer',
                      locale === loc && 'bg-accent text-dropdown'
                    )}
                  >
                    {code} — {loc === 'en' ? 'English' : '中文'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile hamburger — below md */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden px-2"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'fixed', top: '3.5rem', left: 0, right: 0, zIndex: 9998 }}
            className="md:hidden glass-premium border-b border-border/10 shadow-lg"
          >
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
              {NAV_LINKS.map(({ key, href }) => (
                <Link
                  key={key}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors"
                >
                  {t(`nav.${key}`)}
                </Link>
              ))}
              <div className="mt-2 pt-3 border-t border-border/10 flex flex-col gap-2">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full justify-center text-sm">
                    {t('common.login')}
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full justify-center text-sm gap-1.5">
                    {t('common.register')}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

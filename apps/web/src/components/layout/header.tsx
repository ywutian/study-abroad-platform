'use client';

import { chatRoutes, userRoutes } from '@study-abroad/shared';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  Gift,
  Globe,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  MessagesSquare,
  PenTool,
  Compass,
  Settings,
  Shield,
  Lightbulb,
  TrendingUp,
  Trophy,
  User,
  UserPlus,
  Users,
  Briefcase,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { ClientOnly } from '@/components/common/client-only';
import { HelpCenter, NotificationCenter } from '@/components/features';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ColorPaletteMenu } from '@/components/ui/color-palette-menu';
import { CountBadge } from '@/components/ui/count-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useOnboardingProgress } from '@/hooks/use-onboarding-progress';
import { apiClient } from '@/lib/api';
import { type Locale, localeNames } from '@/lib/i18n/config';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import { SafeLink } from '@/components/common/safe-link';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores';

import { MobileNav } from './mobile-nav';

// ============================================================================
// SSR-safe placeholders (prevent CLS while interactive sections hydrate)
// ============================================================================

function MoreMenuPlaceholder() {
  return <div className="ml-1 h-8 w-16 rounded-md bg-muted/60 animate-pulse" />;
}

function HeaderActionsPlaceholder() {
  return (
    <div className="hidden items-center gap-2 sm:flex">
      <div className="h-8 w-8 rounded-lg bg-muted/60 animate-pulse" />
      <div className="h-8 w-8 rounded-lg bg-muted/60 animate-pulse" />
      <div className="h-8 w-8 rounded-lg bg-muted/60 animate-pulse" />
      <div className="h-8 w-8 rounded-lg bg-muted/60 animate-pulse" />
      <div className="mx-1 h-5 w-px bg-border hidden sm:block" />
      <div className="h-8 w-20 rounded-md bg-muted/60 animate-pulse" />
    </div>
  );
}

// ============================================================================
// Nav item type
// ============================================================================

interface NavItemDef {
  href: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

// ============================================================================
// Interactive sub-components (rendered only after hydration via ClientOnly)
// ============================================================================

/** "More" mega-menu dropdown with research, social, and tools nav items */
function MoreMegaMenu({
  researchNavItems,
  socialNavItems,
  toolsNavItems,
  unreadCount,
  isActive,
}: {
  researchNavItems: NavItemDef[];
  socialNavItems: NavItemDef[];
  toolsNavItems: NavItemDef[];
  unreadCount: number;
  isActive: (href: string) => boolean;
}) {
  const t = useTranslations();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          // Cases and AI live inside this menu; a tour cannot highlight an
          // item in a closed dropdown, so the welcome tour points at the
          // opener instead of at something the user cannot see yet.
          data-tour="nav-more"
          variant="ghost"
          size="sm"
          className={cn(
            'relative ml-1 gap-1 px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted',
            'data-[state=open]:bg-muted data-[state=open]:text-foreground'
          )}
        >
          {t('common.more')}
          <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          <CountBadge
            count={unreadCount}
            dot
            variant="destructive"
            size="sm"
            className="absolute top-1 right-1"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[520px] max-h-[70vh] overflow-y-auto p-3"
        sideOffset={8}
      >
        <div className="grid grid-cols-2 gap-1">
          {/* Research & Discover Section */}
          <div className="col-span-2 mb-2">
            <DropdownMenuLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('nav.sections.research')}
            </DropdownMenuLabel>
          </div>
          {researchNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <DropdownMenuItem key={item.href} asChild className="p-0">
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
                    active ? 'bg-primary/5 text-primary' : 'hover:bg-muted/50'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                      active ? 'bg-primary/10' : 'bg-muted'
                    )}
                  >
                    <Icon
                      className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-sm font-medium',
                        active ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {item.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                </Link>
              </DropdownMenuItem>
            );
          })}

          {/* Community Section */}
          <div className="col-span-2 mb-2 mt-3">
            <DropdownMenuLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('nav.sections.social')}
            </DropdownMenuLabel>
          </div>
          {socialNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const showBadge = item.href === '/chat' && unreadCount > 0;
            return (
              <DropdownMenuItem key={item.href} asChild className="p-0">
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
                    active ? 'bg-primary/5 text-primary' : 'hover:bg-muted/50'
                  )}
                >
                  <div
                    className={cn(
                      'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                      active ? 'bg-primary/10' : 'bg-muted'
                    )}
                  >
                    <Icon
                      className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')}
                    />
                    {showBadge && (
                      <CountBadge count={unreadCount} variant="destructive" size="sm" absolute />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-sm font-medium',
                        active ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {item.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                </Link>
              </DropdownMenuItem>
            );
          })}

          {/* Tools Section */}
          <div className="col-span-2 mb-2 mt-3">
            <DropdownMenuLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('nav.sections.tools')}
            </DropdownMenuLabel>
          </div>
          {toolsNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <DropdownMenuItem key={item.href} asChild className="p-0">
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
                    active ? 'bg-primary/5 text-primary' : 'hover:bg-muted/50'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                      active ? 'bg-primary/10' : 'bg-muted'
                    )}
                  >
                    <Icon
                      className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-sm font-medium',
                        active ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {item.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Right-side header actions: language switcher, theme toggle, user menu */
function HeaderActions() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as Locale;
  const { user, logout, setUser } = useAuthStore();
  const userEmail = typeof user?.email === 'string' ? user.email.trim() : '';
  const userInitial = userEmail[0]?.toUpperCase() ?? 'U';

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return;
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
    const businessPath = currentPath.replace(/^\/(?:en|zh)(?=\/|$)/, '') || '/';
    const search = typeof window !== 'undefined' ? window.location.search : '';

    if (user) {
      setUser({ ...user, locale: newLocale });
      void apiClient
        .put<typeof user>(userRoutes.me(), { locale: newLocale }, { suppressErrorToast: true })
        .then((updatedUser) => setUser(updatedUser))
        .catch(() => setUser(user));
    }

    router.replace(`${businessPath}${search}`, { locale: newLocale });
  };

  return (
    <div className="hidden items-center gap-1 sm:flex lg:gap-2">
      {/* Language Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-tour="user-menu"
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label={t('ui.a11y.switchLanguage')}
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">{localeNames[locale]}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {(Object.entries(localeNames) as [Locale, string][]).map(([loc, name]) => (
            <DropdownMenuItem
              key={loc}
              onClick={() => switchLocale(loc)}
              className="flex items-center justify-between"
            >
              <span>{name}</span>
              {locale === loc && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme Toggle */}
      <ColorPaletteMenu className="text-muted-foreground hover:text-foreground hover:bg-muted" />
      <ThemeToggle className="text-muted-foreground hover:text-foreground hover:bg-muted" />

      {/* Notifications + Help (logged-in only for notifications, help always visible) */}
      {user && <NotificationCenter />}
      <HelpCenter />

      {/* Divider */}
      <div className="mx-1 h-5 w-px bg-border hidden sm:block" />

      {/* User Menu */}
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 px-2 hover:bg-muted"
              aria-label={t('ui.a11y.userMenu')}
            >
              <Avatar className="h-7 w-7 ring-2 ring-muted transition-all hover:ring-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-xs font-semibold text-primary-foreground">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            {/* User Info */}
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-sm font-medium text-foreground truncate">
                {userEmail || t('nav.user.manageAccount')}
              </p>
              <p className="text-xs text-muted-foreground">{t('nav.user.manageAccount')}</p>
            </div>

            <DropdownMenuGroup className="p-1">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2.5 px-2 py-1.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{t('nav.profile')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2.5 px-2 py-1.5">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>{t('common.settings')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/vault" className="flex items-center gap-2.5 px-2 py-1.5">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span>{t('nav.vault')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/referral" className="flex items-center gap-2.5 px-2 py-1.5">
                  <Gift className="h-4 w-4 text-muted-foreground" />
                  <span>{t('nav.referral')}</span>
                </Link>
              </DropdownMenuItem>
              {(user.role === 'ADMIN' ||
                user.role === 'SUPER_ADMIN' ||
                user.role === 'OPERATOR') && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center gap-2.5 px-2 py-1.5">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span>{t('nav.adminPanel')}</span>
                  </Link>
                </DropdownMenuItem>
              )}
              {/*
               * Counselor workbench — PR 2 §D. Visible only to COUNSELOR
               * and admin tiers. Non-counselor roles never render this
               * link (no DOM presence; no SEO discovery; matches the
               * `noindex` route metadata).
               */}
              {(user.role === 'COUNSELOR' ||
                user.role === 'ADMIN' ||
                user.role === 'SUPER_ADMIN') && (
                <DropdownMenuItem asChild>
                  <Link
                    href="/counselor/patterns"
                    className="flex items-center gap-2.5 px-2 py-1.5"
                  >
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span>{t('nav.counselorWorkbench')}</span>
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={logout}
              className="flex items-center gap-2.5 px-3 py-1.5 text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span>{t('common.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              {t('common.login')}
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="shadow-sm">
              {t('common.register')}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Header (main export)
// ============================================================================

export function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  // Unread message count (for "More" mega-menu badge)
  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => apiClient.get<{ count: number }>(chatRoutes.unreadCount()),
    enabled: !!user,
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count || 0;

  // Onboarding progress (for gentle reminder dot on Dashboard nav)
  const { showIndicator: showOnboardingDot } = useOnboardingProgress();

  // Primary navigation - core features (rendered during SSR for SEO)
  const mainNavItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/schools', label: t('nav.schools'), icon: GraduationCap },
    { href: '/prediction', label: t('nav.prediction'), icon: TrendingUp },
    { href: '/essays', label: t('nav.essays'), icon: PenTool },
    { href: '/profile', label: t('nav.profile'), icon: User },
  ];

  // Research & Discover — "I want to research schools and learn from others"
  const researchNavItems: NavItemDef[] = [
    {
      href: '/cases',
      label: t('nav.cases'),
      icon: BookOpen,
      description: t('nav.descriptions.cases'),
    },
    {
      href: '/ranking',
      label: t('nav.ranking'),
      icon: BarChart3,
      description: t('nav.descriptions.ranking'),
    },
    { href: '/hall', label: t('nav.hall'), icon: Trophy, description: t('nav.descriptions.hall') },
    {
      href: '/uncommon-app',
      label: t('nav.uncommonApp'),
      icon: Compass,
      description: t('nav.descriptions.uncommonApp'),
    },
  ];

  // Community — "I want to connect with other applicants"
  const socialNavItems: NavItemDef[] = [
    {
      href: '/forum',
      label: t('nav.forum'),
      icon: MessageSquare,
      description: t('nav.descriptions.forum'),
    },
    {
      href: '/teams',
      label: t('nav.teams'),
      icon: Users,
      description: t('nav.descriptions.teams'),
    },
    {
      href: '/chat',
      label: t('nav.chat'),
      icon: MessagesSquare,
      description: t('nav.descriptions.chat'),
    },
    {
      href: '/followers',
      label: t('nav.followers'),
      icon: UserPlus,
      description: t('nav.descriptions.followers'),
    },
  ];

  // Tools — practical utilities
  const toolsNavItems: NavItemDef[] = [
    {
      href: '/resume',
      label: t('nav.resume'),
      icon: FileText,
      description: t('nav.descriptions.resume'),
    },
    {
      href: '/timeline',
      label: t('nav.timeline'),
      icon: Calendar,
      description: t('nav.descriptions.timeline'),
    },
    {
      href: '/assessment',
      label: t('nav.assessment'),
      icon: ClipboardList,
      description: t('nav.descriptions.assessment'),
    },
    { href: '/ai', label: t('nav.ai'), icon: Lightbulb, description: t('nav.descriptions.ai') },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // Grouped sections for mobile nav
  const mobileNavSections = [
    {
      label: '',
      items: mainNavItems.map((item) => ({
        href: item.href,
        label: item.label,
        icon: <item.icon className="h-5 w-5" />,
      })),
    },
    {
      label: t('nav.sections.research'),
      items: researchNavItems.map((item) => ({
        href: item.href,
        label: item.label,
        icon: <item.icon className="h-5 w-5" />,
      })),
    },
    {
      label: t('nav.sections.social'),
      items: socialNavItems.map((item) => ({
        href: item.href,
        label: item.label,
        icon: <item.icon className="h-5 w-5" />,
      })),
    },
    {
      label: t('nav.sections.tools'),
      items: toolsNavItems.map((item) => ({
        href: item.href,
        label: item.label,
        icon: <item.icon className="h-5 w-5" />,
      })),
    },
    {
      label: t('nav.sections.account'),
      items: [
        { href: '/vault', label: t('nav.vault'), icon: <Lock className="h-5 w-5" /> },
        { href: '/help', label: t('nav.help'), icon: <HelpCircle className="h-5 w-5" /> },
        { href: '/referral', label: t('nav.referral'), icon: <Gift className="h-5 w-5" /> },
      ],
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-[color:var(--theme-surface)]/96 shadow-[0_1px_0_color-mix(in_oklab,var(--ds-foreground)_4%,transparent)] backdrop-blur-sm">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left: Hamburger (mobile) + Logo + Navigation */}
        <div className="flex items-center gap-1 lg:gap-2">
          {/* Mobile hamburger drawer */}
          <ClientOnly
            fallback={
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label={t('ui.a11y.navigationMenu')}
              >
                <Menu className="h-5 w-5" />
              </Button>
            }
          >
            <div className="lg:hidden">
              <MobileNav sections={mobileNavSections} user={user} onLogout={logout} />
            </div>
          </ClientOnly>

          <Link
            href={user ? '/dashboard' : '/'}
            className="mr-4 lg:mr-6 transition-opacity hover:opacity-80"
          >
            <Logo size="sm" />
          </Link>

          <nav className="hidden items-center lg:flex">
            {/* Static nav links — rendered on server for SEO */}
            {mainNavItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                // SafeLink: if a soft navigation hangs (stuck loading.tsx / stale RSC /
                // failed prefetch — the "点 tab 没反应" class), it hard-navigates after a
                // timeout so the tab is never a dead click.
                <SafeLink
                  key={item.href}
                  href={item.href}
                  // Anchors the first-run welcome tour. Derived from href rather
                  // than written per item so a new nav entry cannot silently miss
                  // one. `tour-anchors.test.ts` fails when a tour step points at a
                  // name nothing renders — which is how five of these steps spent
                  // their life highlighting empty space.
                  data-tour={`nav-${item.href.replace(/^\//, '')}`}
                  className={cn(
                    'group relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  <span>{item.label}</span>
                  {item.href === '/dashboard' && showOnboardingDot && !active && (
                    <span className="ml-0.5 h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                  )}
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                  )}
                </SafeLink>
              );
            })}

            {/* "More" mega-menu — client-only (contains Radix DropdownMenu) */}
            <ClientOnly fallback={<MoreMenuPlaceholder />}>
              <MoreMegaMenu
                researchNavItems={researchNavItems}
                socialNavItems={socialNavItems}
                toolsNavItems={toolsNavItems}
                unreadCount={unreadCount}
                isActive={isActive}
              />
            </ClientOnly>
          </nav>
        </div>

        {/* Right: Actions — client-only (all Radix dropdowns + auth-dependent UI) */}
        <ClientOnly fallback={<HeaderActionsPlaceholder />}>
          <HeaderActions />
        </ClientOnly>
      </div>
    </header>
  );
}

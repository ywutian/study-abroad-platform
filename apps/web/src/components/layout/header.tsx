'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  Globe,
  LayoutDashboard,
  GraduationCap,
  TrendingUp,
  BookOpen,
  MessageSquare,
  Sparkles,
  Target,
  ClipboardList,
  Calendar,
  FileText,
  Lock,
  Users,
  Trophy,
  User,
  Settings,
  LogOut,
  Check,
  Shield,
  PenTool,
  Compass,
  Rocket,
  ShieldCheck,
  HelpCircle,
  Gift,
  Menu,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Logo } from '@/components/ui/logo';
import { CountBadge } from '@/components/ui/count-badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ClientOnly } from '@/components/common/client-only';
import { MobileNav } from './mobile-nav';
import { useAuthStore } from '@/stores';
import { localeNames, type Locale } from '@/lib/i18n/config';
import { useRouter } from '@/lib/i18n/navigation';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

// ============================================================================
// SSR-safe placeholders (prevent CLS while interactive sections hydrate)
// ============================================================================

function MoreMenuPlaceholder() {
  return <div className="ml-1 h-8 w-16 rounded-md bg-muted/60 animate-pulse" />;
}

function HeaderActionsPlaceholder() {
  return (
    <div className="flex items-center gap-2">
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

/** "More" mega-menu dropdown with tools, community, and utility nav items */
function MoreMegaMenu({
  toolsNavItems,
  communityNavItems,
  utilityNavItems,
  unreadCount,
  isActive,
}: {
  toolsNavItems: NavItemDef[];
  communityNavItems: NavItemDef[];
  utilityNavItems: NavItemDef[];
  unreadCount: number;
  isActive: (href: string) => boolean;
}) {
  const t = useTranslations();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
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
          {/* Tools Section */}
          <div className="col-span-2 mb-2">
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

          {/* Community Section */}
          <div className="col-span-2 mb-2 mt-3">
            <DropdownMenuLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('nav.sections.community')}
            </DropdownMenuLabel>
          </div>
          {communityNavItems.map((item) => {
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

          {/* Utilities Section */}
          <div className="col-span-2 mb-2 mt-3">
            <DropdownMenuLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('nav.sections.utility')}
            </DropdownMenuLabel>
          </div>
          <DropdownMenuSeparator className="col-span-2 my-1" />
          {utilityNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <DropdownMenuItem key={item.href} asChild className="col-span-2 p-0">
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                    active ? 'bg-primary/5 text-primary' : 'hover:bg-muted/50'
                  )}
                >
                  <Icon
                    className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')}
                  />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      active ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">— {item.description}</span>
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
  const { user, logout } = useAuthStore();

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex items-center gap-1 lg:gap-2">
      {/* Language Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted"
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
      <ThemeToggle className="text-muted-foreground hover:text-foreground hover:bg-muted" />

      {/* Divider */}
      <div className="mx-1 h-5 w-px bg-border hidden sm:block" />

      {/* User Menu */}
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-2 hover:bg-muted">
              <Avatar className="h-7 w-7 ring-2 ring-muted transition-all hover:ring-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-xs font-semibold text-white">
                  {user.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            {/* User Info */}
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
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
              {user.role === 'ADMIN' && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center gap-2.5 px-2 py-1.5">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span>{t('nav.adminPanel')}</span>
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
    queryFn: () => apiClient.get<{ count: number }>('/chats/unread-count'),
    enabled: !!user,
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count || 0;

  // Primary navigation - core features (rendered during SSR for SEO)
  const mainNavItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/schools', label: t('nav.schools'), icon: GraduationCap },
    { href: '/prediction', label: t('nav.prediction'), icon: TrendingUp },
    { href: '/cases', label: t('nav.cases'), icon: BookOpen },
    { href: '/forum', label: t('nav.forum'), icon: MessageSquare },
  ];

  // Tools & Resources
  const toolsNavItems: NavItemDef[] = [
    { href: '/ai', label: t('nav.ai'), icon: Sparkles, description: t('nav.descriptions.ai') },
    {
      href: '/essays',
      label: t('nav.essays'),
      icon: PenTool,
      description: t('nav.descriptions.essays'),
    },
    {
      href: '/find-college',
      label: t('nav.findCollege'),
      icon: Compass,
      description: t('nav.descriptions.findCollege'),
    },
    {
      href: '/uncommon-app',
      label: t('nav.uncommonApp'),
      icon: Rocket,
      description: t('nav.descriptions.uncommonApp'),
    },
    {
      href: '/recommendation',
      label: t('nav.recommendation'),
      icon: Target,
      description: t('nav.descriptions.recommendation'),
    },
    {
      href: '/assessment',
      label: t('nav.assessment'),
      icon: ClipboardList,
      description: t('nav.descriptions.assessment'),
    },
    {
      href: '/timeline',
      label: t('nav.timeline'),
      icon: Calendar,
      description: t('nav.descriptions.timeline'),
    },
  ];

  // Discovery & Community
  const communityNavItems: NavItemDef[] = [
    { href: '/hall', label: t('nav.hall'), icon: Trophy, description: t('nav.descriptions.hall') },
    {
      href: '/verified-ranking',
      label: t('nav.verifiedRanking'),
      icon: ShieldCheck,
      description: t('nav.descriptions.verifiedRanking'),
    },
    {
      href: '/essay-gallery',
      label: t('nav.essayGallery'),
      icon: FileText,
      description: t('nav.descriptions.essayGallery'),
    },
    {
      href: '/chat',
      label: t('nav.chat'),
      icon: MessageSquare,
      description: t('nav.descriptions.chat'),
    },
    {
      href: '/followers',
      label: t('nav.followers'),
      icon: Users,
      description: t('nav.descriptions.followers'),
    },
  ];

  // Utilities
  const utilityNavItems: NavItemDef[] = [
    { href: '/vault', label: t('nav.vault'), icon: Lock, description: t('nav.descriptions.vault') },
    {
      href: '/help',
      label: t('nav.help'),
      icon: HelpCircle,
      description: t('nav.descriptions.help'),
    },
    {
      href: '/referral',
      label: t('nav.referral'),
      icon: Gift,
      description: t('nav.descriptions.referral'),
    },
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
      label: t('nav.sections.tools'),
      items: toolsNavItems.map((item) => ({
        href: item.href,
        label: item.label,
        icon: <item.icon className="h-5 w-5" />,
      })),
    },
    {
      label: t('nav.sections.community'),
      items: communityNavItems.map((item) => ({
        href: item.href,
        label: item.label,
        icon: <item.icon className="h-5 w-5" />,
      })),
    },
    {
      label: t('nav.sections.utility'),
      items: utilityNavItems.map((item) => ({
        href: item.href,
        label: item.label,
        icon: <item.icon className="h-5 w-5" />,
      })),
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left: Hamburger (mobile) + Logo + Navigation */}
        <div className="flex items-center gap-1 lg:gap-2">
          {/* Mobile hamburger drawer */}
          <ClientOnly
            fallback={
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            }
          >
            <div className="lg:hidden">
              <MobileNav sections={mobileNavSections} user={user} onLogout={logout} />
            </div>
          </ClientOnly>

          <Link href="/" className="mr-4 lg:mr-6 transition-opacity hover:opacity-80">
            <Logo size="sm" />
          </Link>

          <nav className="hidden items-center lg:flex">
            {/* Static nav links — rendered on server for SEO */}
            {mainNavItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
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
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}

            {/* "More" mega-menu — client-only (contains Radix DropdownMenu) */}
            <ClientOnly fallback={<MoreMenuPlaceholder />}>
              <MoreMegaMenu
                toolsNavItems={toolsNavItems}
                communityNavItems={communityNavItems}
                utilityNavItems={utilityNavItems}
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

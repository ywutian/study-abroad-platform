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
  School,
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
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Logo } from '@/components/ui/logo';
import { useAuthStore } from '@/stores';
import { localeNames, type Locale } from '@/lib/i18n/config';
import { useRouter } from '@/lib/i18n/navigation';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as Locale;
  const { user, logout } = useAuthStore();

  // Primary navigation - core features
  const mainNavItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/ranking', label: t('nav.ranking'), icon: School },
    { href: '/prediction', label: t('nav.prediction'), icon: TrendingUp },
    { href: '/cases', label: t('nav.cases'), icon: BookOpen },
    { href: '/forum', label: t('nav.forum'), icon: MessageSquare },
  ];

  // Tools & Resources - grouped logically
  const toolsNavItems = [
    { href: '/ai', label: t('nav.ai'), icon: Sparkles, description: t('nav.descriptions.ai') },
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
  const communityNavItems = [
    { href: '/hall', label: t('nav.hall'), icon: Trophy, description: t('nav.descriptions.hall') },
    {
      href: '/essay-gallery',
      label: t('nav.essayGallery'),
      icon: FileText,
      description: t('nav.descriptions.essayGallery'),
    },
    { href: '/chat', label: t('nav.chat'), icon: Users, description: t('nav.descriptions.chat') },
  ];

  // Utilities
  const utilityNavItems = [
    { href: '/vault', label: t('nav.vault'), icon: Lock, description: t('nav.descriptions.vault') },
  ];

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-lg supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left: Logo + Navigation */}
        <div className="flex items-center gap-1 lg:gap-2">
          {/* Logo */}
          <Link href="/" className="mr-4 lg:mr-6 transition-opacity hover:opacity-80">
            <Logo size="sm" />
          </Link>

          {/* Main Navigation */}
          <nav className="hidden items-center lg:flex">
            {mainNavItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'text-primary' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      active ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'
                    )}
                  />
                  <span>{item.label}</span>
                  {/* Active indicator */}
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}

            {/* More Dropdown - Mega Menu Style */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'ml-1 gap-1 px-3 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80',
                    'data-[state=open]:bg-slate-100/80 data-[state=open]:text-slate-900'
                  )}
                >
                  {t('common.more')}
                  <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[420px] p-3" sideOffset={8}>
                <div className="grid grid-cols-2 gap-1">
                  {/* Tools Section */}
                  <div className="col-span-2 mb-2">
                    <DropdownMenuLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
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
                            active ? 'bg-primary/5 text-primary' : 'hover:bg-slate-50'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                              active ? 'bg-primary/10' : 'bg-slate-100'
                            )}
                          >
                            <Icon
                              className={cn('h-4 w-4', active ? 'text-primary' : 'text-slate-500')}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={cn(
                                'text-sm font-medium',
                                active ? 'text-primary' : 'text-slate-900'
                              )}
                            >
                              {item.label}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {item.description}
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}

                  {/* Community Section */}
                  <div className="col-span-2 mb-2 mt-3">
                    <DropdownMenuLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {t('nav.sections.community')}
                    </DropdownMenuLabel>
                  </div>
                  {communityNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <DropdownMenuItem key={item.href} asChild className="p-0">
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
                            active ? 'bg-primary/5 text-primary' : 'hover:bg-slate-50'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                              active ? 'bg-primary/10' : 'bg-slate-100'
                            )}
                          >
                            <Icon
                              className={cn('h-4 w-4', active ? 'text-primary' : 'text-slate-500')}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={cn(
                                'text-sm font-medium',
                                active ? 'text-primary' : 'text-slate-900'
                              )}
                            >
                              {item.label}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {item.description}
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}

                  {/* Utilities Section */}
                  <DropdownMenuSeparator className="col-span-2 my-2" />
                  {utilityNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <DropdownMenuItem key={item.href} asChild className="col-span-2 p-0">
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                            active ? 'bg-primary/5 text-primary' : 'hover:bg-slate-50'
                          )}
                        >
                          <Icon
                            className={cn('h-4 w-4', active ? 'text-primary' : 'text-slate-400')}
                          />
                          <span
                            className={cn(
                              'text-sm font-medium',
                              active ? 'text-primary' : 'text-slate-700'
                            )}
                          >
                            {item.label}
                          </span>
                          <span className="text-xs text-slate-400">— {item.description}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 lg:gap-2">
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 px-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline text-sm">{localeNames[locale]}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
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

          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-slate-200 hidden sm:block" />

          {/* User Menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2 hover:bg-slate-100/80">
                  <Avatar className="h-7 w-7 ring-2 ring-slate-100 transition-all hover:ring-primary/20">
                    <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-xs font-semibold text-white">
                      {user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3 w-3 text-slate-400 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
                {/* User Info */}
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900 truncate">{user.email}</p>
                  <p className="text-xs text-slate-500">{t('nav.user.manageAccount')}</p>
                </div>

                <DropdownMenuGroup className="p-1">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2.5 px-2 py-1.5">
                      <User className="h-4 w-4 text-slate-400" />
                      <span>{t('nav.profile')}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2.5 px-2 py-1.5">
                      <Settings className="h-4 w-4 text-slate-400" />
                      <span>{t('common.settings')}</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={logout}
                  className="flex items-center gap-2.5 px-3 py-1.5 text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t('common.logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
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
      </div>
    </header>
  );
}

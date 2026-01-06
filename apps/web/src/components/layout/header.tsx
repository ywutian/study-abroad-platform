'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores';
import { localeNames, type Locale } from '@/lib/i18n/config';
import { useRouter } from '@/lib/i18n/navigation';
import { useParams } from 'next/navigation';
import { MobileNav } from './mobile-nav';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { 
  Globe, User, BarChart3, Target, BookOpen, MessageSquare, 
  Building2, Brain, FileText, Search 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/components/features/notifications/notification-center';
import { HelpCenter } from '@/components/features/help/help-center';
import { GlobalSearch, SearchTrigger } from '@/components/features/search/global-search';
import { useKeyboardShortcuts } from '@/hooks';

export function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as Locale;
  const { user, logout } = useAuthStore();
  const [searchOpen, setSearchOpen] = useState(false);

  // 全局键盘快捷键
  useKeyboardShortcuts([
    { key: 'k', modifiers: ["meta"], handler: () => setSearchOpen(true) },
  ]);

  const navItems = [
    { href: '/profile', label: t('nav.profile'), icon: <User className="h-4 w-4" /> },
    { href: '/essays', label: t('nav.essays'), icon: <FileText className="h-4 w-4" /> },
    { href: '/ai', label: t('nav.ai'), icon: <Brain className="h-4 w-4" /> },
    { href: '/ranking', label: t('nav.ranking'), icon: <BarChart3 className="h-4 w-4" /> },
    { href: '/prediction', label: t('nav.prediction'), icon: <Target className="h-4 w-4" /> },
    { href: '/cases', label: t('nav.cases'), icon: <BookOpen className="h-4 w-4" /> },
    { href: '/chat', label: t('nav.chat'), icon: <MessageSquare className="h-4 w-4" /> },
    { href: '/hall', label: t('nav.hall'), icon: <Building2 className="h-4 w-4" /> },
  ];

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:h-16">
        {/* 左侧：移动端菜单 + Logo */}
        <div className="flex items-center gap-2 sm:gap-4">
          <MobileNav items={navItems} user={user} onLogout={logout} />
          <Link href="/" className="flex items-center">
            <Logo size="md" />
          </Link>
        </div>

        {/* 中间：桌面端导航 */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-1 -bottom-[13px] h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* 右侧：搜索 + 通知 + 帮助 + 主题切换 + 语言切换 + 用户菜单 */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* 全局搜索 */}
          <div className="hidden sm:block">
            <SearchTrigger onClick={() => setSearchOpen(true)} />
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="sm:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

          {/* 通知中心 */}
          {user && <NotificationCenter />}

          {/* 帮助中心 */}
          <HelpCenter />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-2 sm:px-3">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">{localeNames[locale]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.entries(localeNames) as [Locale, string][]).map(([loc, name]) => (
                <DropdownMenuItem
                  key={loc}
                  onClick={() => switchLocale(loc)}
                  className={cn(locale === loc && 'bg-muted')}
                >
                  {name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full"
                  data-tour="user-menu"
                >
                  <Avatar className="h-8 w-8 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-xs text-muted-foreground">登录为</p>
                  <p className="truncate text-sm font-medium">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    {t('nav.profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    {t('common.settings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  {t('common.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  {t('common.login')}
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-gradient-primary hover:opacity-90">
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

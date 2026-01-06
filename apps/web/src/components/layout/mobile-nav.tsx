'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, X, ChevronRight } from 'lucide-react';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

interface MobileNavProps {
  items: NavItem[];
  user?: { email: string } | null;
  onLogout?: () => void;
}

export function MobileNav({ items, user, onLogout }: MobileNavProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">打开菜单</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle className="text-left text-lg font-bold text-gradient">
            {t('common.appName')}
          </SheetTitle>
        </SheetHeader>
        
        <nav className="flex flex-col p-4">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  {item.label}
                </span>
                <ChevronRight className={cn('h-4 w-4 opacity-0 transition-opacity', isActive && 'opacity-100')} />
              </Link>
            );
          })}
        </nav>

        <Separator />

        <div className="p-4">
          {user ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">当前账号</p>
                <p className="truncate text-sm font-medium">{user.email}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Link href="/profile" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full justify-start">
                    {t('nav.profile')}
                  </Button>
                </Link>
                <Link href="/settings" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full justify-start">
                    {t('common.settings')}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    onLogout?.();
                    setOpen(false);
                  }}
                >
                  {t('common.logout')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link href="/login" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full">
                  {t('common.login')}
                </Button>
              </Link>
              <Link href="/register" onClick={() => setOpen(false)}>
                <Button className="w-full">{t('common.register')}</Button>
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}






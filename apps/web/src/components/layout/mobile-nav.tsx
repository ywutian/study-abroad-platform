'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, ChevronRight } from 'lucide-react';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useHydrated } from '@/hooks/use-hydration';

interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

interface NavSection {
  label: string; // Section header (empty string = no header)
  items: NavItem[];
}

interface MobileNavProps {
  sections: NavSection[];
  user?: { email: string; role?: string } | null;
  onLogout?: () => void;
}

export function MobileNav({ sections, user, onLogout }: MobileNavProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isHydrated = useHydrated();

  const isActive = (href: string) => {
    const normalizedPath = pathname.replace(/^\/(zh|en)/, '');
    if (href === '/dashboard') {
      return normalizedPath === href || normalizedPath === '/';
    }
    return normalizedPath.startsWith(href);
  };

  // SSR placeholder
  if (!isHydrated) {
    return (
      <Button variant="ghost" size="icon" suppressHydrationWarning>
        <Menu className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t('ui.a11y.openMenu')}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] p-0">
        <SheetHeader className="border-b border-border px-4 py-4">
          <SheetTitle className="text-left text-lg font-bold text-gradient">
            {t('common.appName')}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <nav className="flex flex-col py-2">
            {sections.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                {/* Section separator + label */}
                {sectionIdx > 0 && <Separator className="my-2" />}
                {section.label && (
                  <div className="px-6 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {section.label}
                    </span>
                  </div>
                )}

                {/* Section items */}
                <div className="px-2">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <span className="flex items-center gap-3">
                          {item.icon && (
                            <span className={cn(active ? 'text-primary' : 'text-muted-foreground')}>
                              {item.icon}
                            </span>
                          )}
                          {item.label}
                        </span>
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 opacity-0 transition-opacity',
                            active && 'opacity-100'
                          )}
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Bottom: User section */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background p-4">
          {user ? (
            <div className="space-y-2">
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">{t('ui.a11y.currentAccount')}</p>
                <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/profile" onClick={() => setOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">
                    {t('nav.profile')}
                  </Button>
                </Link>
                <Link href="/settings" onClick={() => setOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">
                    {t('common.settings')}
                  </Button>
                </Link>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  onLogout?.();
                  setOpen(false);
                }}
              >
                {t('common.logout')}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link href="/login" onClick={() => setOpen(false)} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  {t('common.login')}
                </Button>
              </Link>
              <Link href="/register" onClick={() => setOpen(false)} className="flex-1">
                <Button size="sm" className="w-full">
                  {t('common.register')}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

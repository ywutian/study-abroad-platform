'use client';

import * as React from 'react';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface MegaMenuItem {
  href: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
}

export interface MegaMenuGroup {
  label: string;
  items: MegaMenuItem[];
}

interface MegaMenuProps {
  label: string;
  groups: MegaMenuGroup[];
  /** 单列布局（适合少量项目） */
  singleColumn?: boolean;
}

export function MegaMenu({ label, groups, singleColumn }: MegaMenuProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const isActive = groups.some((group) => group.items.some((item) => pathname === item.href));

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  React.useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);
  const isSingle = singleColumn || totalItems <= 4;

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className={cn(
          'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        {label}
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
        />
        {isActive && (
          <span className="absolute inset-x-1 -bottom-[13px] h-0.5 rounded-full bg-primary" />
        )}
      </button>

      {/* Dropdown Panel */}
      <div
        className={cn(
          'absolute left-1/2 top-full z-50 pt-2 -translate-x-1/2',
          'opacity-0 invisible transition-all duration-200',
          open && 'opacity-100 visible'
        )}
      >
        <div
          className={cn(
            'rounded-xl border bg-popover/95 backdrop-blur-sm shadow-xl',
            'ring-1 ring-black/5 dark:ring-white/10',
            isSingle ? 'min-w-[280px]' : 'min-w-[520px]'
          )}
        >
          <div
            className={cn(
              'p-4',
              !isSingle && 'grid gap-6',
              groups.length === 2 && !isSingle && 'grid-cols-2',
              groups.length >= 3 && !isSingle && 'grid-cols-3'
            )}
          >
            {groups.map((group) => (
              <div key={group.label}>
                {groups.length > 1 && (
                  <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </div>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const itemActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'group flex items-start gap-3 rounded-lg p-2.5 transition-colors',
                          itemActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                        )}
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                            itemActive
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                          )}
                        >
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              'font-medium leading-tight',
                              itemActive && 'text-primary'
                            )}
                          >
                            {item.label}
                          </div>
                          {item.description && (
                            <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { apiClient } from '@/lib/api';
import {
  BarChart3,
  Users,
  GraduationCap,
  Calendar,
  PenTool,
  ScrollText,
  Bot,
  Brain,
  Coins,
  FileCheck,
  ShieldCheck,
  CreditCard,
  Settings,
  Layers,
  SlidersHorizontal,
  ChevronDown,
  Menu,
  type LucideIcon,
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalCases: number;
  pendingReports: number;
  totalReviews: number;
  pendingVerifications?: number;
}

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

export function AdminSidebar() {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => apiClient.get<AdminStats>('/admin/stats'),
    refetchInterval: 60000,
  });

  const navGroups: NavGroup[] = [
    {
      title: t('sidebar.groups.overview'),
      defaultOpen: true,
      items: [{ href: '/admin', icon: BarChart3, label: t('sidebar.overview'), exact: true }],
    },
    {
      title: t('sidebar.groups.users'),
      items: [
        { href: '/admin/users', icon: Users, label: t('sidebar.users') },
        {
          href: '/admin/verifications',
          icon: FileCheck,
          label: t('sidebar.verifications'),
          badge: stats?.pendingVerifications,
        },
      ],
    },
    {
      title: t('sidebar.groups.academic'),
      items: [
        { href: '/admin/schools', icon: GraduationCap, label: t('sidebar.schools') },
        { href: '/admin/calendar', icon: Calendar, label: t('sidebar.calendar') },
        { href: '/admin/calibrations', icon: SlidersHorizontal, label: t('sidebar.calibrations') },
        { href: '/admin/essays', icon: PenTool, label: t('sidebar.essays') },
        { href: '/admin/activity-templates', icon: Layers, label: t('sidebar.activityTemplates') },
        { href: '/admin/points', icon: Coins, label: t('sidebar.points') },
      ],
    },
    {
      title: t('sidebar.groups.moderation'),
      items: [
        {
          href: '/admin/moderation',
          icon: ShieldCheck,
          label: t('sidebar.moderation'),
          badge: stats?.pendingReports,
        },
        { href: '/admin/payments', icon: CreditCard, label: t('sidebar.payments') },
        { href: '/admin/audit-logs', icon: ScrollText, label: t('sidebar.auditLogs') },
      ],
    },
    {
      title: t('sidebar.groups.ai'),
      items: [
        { href: '/admin/ai-operations', icon: Bot, label: t('sidebar.aiOps') },
        { href: '/admin/memory', icon: Brain, label: t('sidebar.memory') },
      ],
    },
    {
      title: t('sidebar.groups.system'),
      items: [{ href: '/admin/settings', icon: Settings, label: t('sidebar.settings') }],
    },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => isActive(item.href, item.exact));

  const renderNavItem = (item: NavItem, compact?: boolean) => {
    const Icon = item.icon;
    const active = isActive(item.href, item.exact);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          compact && 'gap-1.5 px-3 py-1.5 text-xs',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <Icon className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        <span className="truncate">{item.label}</span>
        {item.badge ? (
          <Badge
            variant="warning"
            className={cn(
              'ml-auto justify-center',
              compact ? 'text-[10px] h-4 min-w-4 px-1' : 'text-xs h-5 min-w-5'
            )}
          >
            {item.badge}
          </Badge>
        ) : null}
      </Link>
    );
  };

  const renderGroups = () =>
    navGroups.map((group) => (
      <SidebarGroup key={group.title} group={group} isGroupActive={isGroupActive(group)}>
        {group.items.map((item) => renderNavItem(item))}
      </SidebarGroup>
    ));

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-56 md:flex-col md:pt-16 z-30">
        <div className="flex flex-1 flex-col border-r bg-card/50 backdrop-blur-sm">
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1 px-3">{renderGroups()}</nav>
          </ScrollArea>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div className="md:hidden border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-2 px-4 py-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Menu className="h-4 w-4" />
                {t('sidebar.menu')}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="px-4 py-3 border-b">
                <SheetTitle className="text-sm">{t('sidebar.adminNav')}</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-60px)]">
                <nav className="space-y-1 px-3 py-4">{renderGroups()}</nav>
              </ScrollArea>
            </SheetContent>
          </Sheet>
          {/* Show current section name on mobile */}
          {navGroups.flatMap((g) => g.items).find((item) => isActive(item.href, item.exact)) && (
            <span className="text-sm font-medium text-muted-foreground truncate">
              {
                navGroups.flatMap((g) => g.items).find((item) => isActive(item.href, item.exact))
                  ?.label
              }
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function SidebarGroup({
  group,
  isGroupActive,
  children,
}: {
  group: NavGroup;
  isGroupActive: boolean;
  children: React.ReactNode;
}) {
  // Single-item groups (Overview, System) render without collapsible header
  if (group.items.length === 1) {
    return <div className="mb-1">{children}</div>;
  }

  const [open, setOpen] = useState(group.defaultOpen ?? isGroupActive ?? true);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        {group.title}
        <ChevronDown
          className={cn('h-3 w-3 transition-transform', open ? 'rotate-0' : '-rotate-90')}
        />
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

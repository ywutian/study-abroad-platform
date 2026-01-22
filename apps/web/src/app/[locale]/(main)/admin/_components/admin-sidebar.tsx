'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import {
  BarChart3,
  AlertTriangle,
  Users,
  GraduationCap,
  Calendar,
  Globe,
  PenTool,
  ScrollText,
  Bot,
  Brain,
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalCases: number;
  pendingReports: number;
  totalReviews: number;
}

export function AdminSidebar() {
  const t = useTranslations('admin');
  const pathname = usePathname();

  const { data: stats } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => apiClient.get<AdminStats>('/admin/stats'),
    refetchInterval: 60000,
  });

  const navItems = [
    { href: '/admin', icon: BarChart3, label: t('sidebar.overview'), exact: true },
    {
      href: '/admin/reports',
      icon: AlertTriangle,
      label: t('sidebar.reports'),
      badge: stats?.pendingReports,
    },
    { href: '/admin/users', icon: Users, label: t('sidebar.users') },
    { href: '/admin/schools', icon: GraduationCap, label: t('sidebar.schools') },
    { href: '/admin/deadlines', icon: Calendar, label: t('sidebar.deadlines') },
    { href: '/admin/events', icon: Globe, label: t('sidebar.events') },
    { href: '/admin/essays', icon: PenTool, label: t('sidebar.essays') },
    { href: '/admin/audit-logs', icon: ScrollText, label: t('sidebar.auditLogs') },
    { href: '/admin/ai-agent', icon: Bot, label: t('sidebar.aiAgent') },
    { href: '/admin/memory', icon: Brain, label: t('sidebar.memory') },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-56 md:flex-col md:pt-16 z-30">
        <div className="flex flex-1 flex-col border-r bg-card/50 backdrop-blur-sm">
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1 px-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge ? (
                      <Badge
                        variant="warning"
                        className="ml-auto text-xs h-5 min-w-5 justify-center"
                      >
                        {item.badge}
                      </Badge>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>
        </div>
      </aside>

      {/* Mobile horizontal nav */}
      <div className="md:hidden overflow-x-auto border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <nav className="flex gap-1 px-4 py-2 min-w-max">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
                {item.badge ? (
                  <Badge variant="warning" className="text-[10px] h-4 min-w-4 justify-center px-1">
                    {item.badge}
                  </Badge>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

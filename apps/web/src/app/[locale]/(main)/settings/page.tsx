'use client';

import {
  COLOR_PALETTES,
  type ColorPalette,
  DEFAULT_COLOR_PALETTE,
  getColorThemeLabel,
  userRoutes,
} from '@study-abroad/shared';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import type { ComponentType } from 'react';
import {
  Bell,
  Clock,
  CreditCard,
  FileText,
  HelpCircle,
  Languages,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Settings,
  Shield,
  Lightbulb,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageContainer, PageHeader } from '@/components/layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Separator } from '@/components/ui/separator';
import { useColorPalette } from '@/hooks/use-color-palette';
import { apiClient } from '@/lib/api';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { SettingItemRow, type SettingItem } from './_components/setting-item-row';

interface SettingSection {
  id: string;
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  comingSoon?: boolean;
  items: SettingItem[];
}

export default function SettingsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const { palette, setPalette } = useColorPalette();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const labelLocale = locale.startsWith('zh') ? 'zh' : 'en';

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
    toast.success(t('settings.toast.logoutSuccess'));
  };

  const deleteAccountMutation = useMutation({
    mutationFn: () => apiClient.delete(userRoutes.me()),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      toast.success(t('settings.toast.accountDeleted'));
      logout();
      router.push('/login');
    },
  });

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

  const handleLanguageChange = (lang: string) => {
    const newPath = pathname.replace(/^\/[a-z]{2}/, `/${lang}`);
    window.location.assign(newPath);
  };

  const sections: SettingSection[] = [
    {
      id: 'profile',
      title: t('settings.sections.profile'),
      icon: User,
      color: 'blue',
      items: [
        {
          id: 'profile',
          icon: User,
          label: t('settings.items.editProfile'),
          description: t('settings.items.editProfileDesc'),
          type: 'link',
          href: '/profile',
        },
        {
          id: 'security',
          icon: Shield,
          label: t('settings.items.security'),
          description: t('settings.items.securityDesc'),
          type: 'link',
          href: '/settings/security',
        },
        // Hall §7 Decision B: the "peerReview" settings item (Hall 锐评 opt-in)
        // was removed when the peer-review subsystem was retired.
      ],
    },
    {
      id: 'preferences',
      title: t('settings.sections.preferences'),
      icon: Palette,
      color: 'violet',
      items: [
        {
          id: 'theme',
          icon: mounted && theme === 'dark' ? Moon : mounted && theme === 'light' ? Sun : Monitor,
          label: t('settings.theme'),
          description: t('settings.items.darkModeDesc'),
          type: 'select',
          value: mounted ? theme || 'system' : 'system',
          options: [
            { value: 'system', label: t('ui.theme.system') },
            { value: 'light', label: t('ui.theme.light') },
            { value: 'dark', label: t('ui.theme.dark') },
          ],
          onSelect: setTheme,
        },
        {
          id: 'colorPalette',
          icon: Palette,
          label: t('settings.items.colorTheme'),
          description: t('settings.items.colorThemeDesc'),
          type: 'select',
          value: mounted ? palette : DEFAULT_COLOR_PALETTE,
          options: COLOR_PALETTES.map((p) => ({
            value: p,
            label: getColorThemeLabel(p, labelLocale),
          })),
          onSelect: (value) => setPalette(value as ColorPalette),
        },
        {
          id: 'language',
          icon: Languages,
          label: t('settings.items.language'),
          description: t('settings.items.languageDesc'),
          type: 'select',
          value: pathname.startsWith('/en') ? 'en' : 'zh',
          options: [
            { value: 'zh', label: '简体中文' },
            { value: 'en', label: 'English' },
          ],
          onSelect: handleLanguageChange,
        },
      ],
    },
    {
      id: 'notifications',
      title: t('settings.sections.notifications'),
      icon: Bell,
      color: 'amber',
      comingSoon: true,
      items: [
        {
          id: 'push',
          icon: Bell,
          label: t('settings.items.pushNotification'),
          description: t('settings.items.pushNotificationDesc'),
          type: 'toggle' as const,
          value: false,
        },
        {
          id: 'email',
          icon: FileText,
          label: t('settings.items.emailNotification'),
          description: t('settings.items.emailNotificationDesc'),
          type: 'toggle' as const,
          value: false,
        },
      ],
    },
    {
      id: 'subscription',
      title: t('settings.sections.subscription'),
      icon: CreditCard,
      color: 'emerald',
      items: [
        {
          id: 'subscription',
          icon: CreditCard,
          label: t('settings.items.subscription'),
          description:
            user?.role === 'VERIFIED' ? t('common.verified') : t('settings.items.subscriptionDesc'),
          type: 'link',
          href: '/settings/subscription',
        },
      ],
    },
    {
      id: 'help',
      title: t('settings.sections.help'),
      icon: HelpCircle,
      color: 'slate',
      items: [
        {
          id: 'help',
          icon: HelpCircle,
          label: t('settings.items.helpCenter'),
          description: t('settings.items.helpCenterDesc'),
          type: 'link',
          href: '/help',
        },
        {
          id: 'terms',
          icon: FileText,
          label: t('settings.items.termsOfService'),
          type: 'link',
          href: '/terms',
        },
        {
          id: 'privacy',
          icon: Lock,
          label: t('settings.items.privacyPolicy'),
          type: 'link',
          href: '/privacy',
        },
      ],
    },
    {
      id: 'account',
      title: t('settings.sections.accountActions'),
      icon: Shield,
      color: 'rose',
      items: [
        {
          id: 'logout',
          icon: LogOut,
          label: t('settings.items.logout'),
          type: 'action',
          onClick: () => setLogoutDialogOpen(true),
        },
        {
          id: 'delete',
          icon: Trash2,
          label: t('settings.items.deleteAccount'),
          description: t('settings.items.deleteAccountDesc'),
          type: 'action',
          danger: true,
          onClick: () => setDeleteDialogOpen(true),
        },
      ],
    },
  ];

  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    blue: { bg: 'bg-blue-500/10', icon: 'text-blue-500', border: 'bg-primary' },
    violet: { bg: 'bg-primary/10', icon: 'text-primary', border: 'bg-primary' },
    amber: { bg: 'bg-amber-500/10', icon: 'text-amber-500', border: 'bg-warning' },
    emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-500', border: 'bg-success' },
    slate: { bg: 'bg-muted', icon: 'text-muted-foreground', border: 'from-slate-500 to-gray-500' },
    rose: { bg: 'bg-rose-500/10', icon: 'text-rose-500', border: 'bg-destructive' },
  };

  return (
    <PageContainer maxWidth="5xl">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
        icon={Settings}
        color="slate"
      />

      {/* 用户卡片 */}
      {user && (
        <Card className="mb-8 overflow-hidden">
          <div className="h-1.5 bg-primary" />
          <CardContent className="flex flex-col sm:flex-row items-center gap-4 p-6">
            <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
              <AvatarImage src={undefined} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h3 className="text-xl font-bold">{user.email?.split('@')[0]}</h3>
                {user.role === 'SUPER_ADMIN' && (
                  <Badge variant="purple">
                    <Lightbulb className="h-3 w-3 mr-1" />
                    {t('common.superAdmin')}
                  </Badge>
                )}
                {user.role === 'ADMIN' && (
                  <Badge variant="purple">
                    <Lightbulb className="h-3 w-3 mr-1" />
                    {t('common.administrator')}
                  </Badge>
                )}
                {user.role === 'OPERATOR' && (
                  <Badge variant="warning">{t('common.operator')}</Badge>
                )}
                {user.role === 'VERIFIED' && (
                  <Badge variant="success">{t('common.verified')}</Badge>
                )}
              </div>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
            <Button variant="outline" className="gap-2" asChild>
              <Link href="/profile">
                <User className="h-4 w-4" />
                {t('settings.items.editProfile')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 设置区块 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section, sectionIndex) => {
          const colors = colorMap[section.color];
          const SectionIcon = section.icon;

          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIndex * 0.08 }}
            >
              <Card className={cn('h-full overflow-hidden', section.comingSoon && 'opacity-60')}>
                <div className={cn('h-1 bg-gradient-to-r', colors.border)} />
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg',
                        colors.bg
                      )}
                    >
                      <SectionIcon className={cn('h-4 w-4', colors.icon)} />
                    </div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    {section.comingSoon && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        {t('common.comingSoon')}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 pt-0">
                  {section.items.map((item, itemIndex) => (
                    <div key={item.id}>
                      {itemIndex > 0 && <Separator className="my-2" />}
                      <SettingItemRow item={item} disabled={section.comingSoon} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* 退出登录对话框 */}
      <ConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        title={t('settings.dialogs.logoutTitle')}
        description={t('settings.dialogs.logoutDesc')}
        onConfirm={handleLogout}
      />

      {/* 删除账户对话框 */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('settings.dialogs.deleteTitle')}
        description={t('settings.dialogs.deleteDesc')}
        type="danger"
        onConfirm={handleDeleteAccount}
      />
    </PageContainer>
  );
}

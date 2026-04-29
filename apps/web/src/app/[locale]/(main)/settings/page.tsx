'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  User,
  Shield,
  Bell,
  Moon,
  Sun,
  CreditCard,
  HelpCircle,
  FileText,
  Lock,
  Trash2,
  LogOut,
  ChevronRight,
  Languages,
  Settings,
  Palette,
  Sparkles,
  Clock,
} from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuthStore } from '@/stores/auth';
import { useRouter, usePathname } from '@/lib/i18n/navigation';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import {
  COLOR_PALETTES,
  DEFAULT_COLOR_PALETTE,
  getColorThemeLabel,
  userRoutes,
  type ColorPalette,
} from '@study-abroad/shared';
import { useColorPalette } from '@/hooks/use-color-palette';

interface SettingSection {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  comingSoon?: boolean;
  items: SettingItem[];
}

interface SettingItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  type: 'toggle' | 'select' | 'link' | 'action';
  value?: boolean | string;
  options?: { value: string; label: string }[];
  href?: string;
  danger?: boolean;
  onToggle?: (value: boolean) => void;
  onSelect?: (value: string) => void;
  onClick?: () => void;
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
          icon: mounted && theme === 'dark' ? Moon : Sun,
          label: t('settings.items.darkMode'),
          description: t('settings.items.darkModeDesc'),
          type: 'toggle',
          value: mounted ? theme === 'dark' : false,
          onToggle: (value) => setTheme(value ? 'dark' : 'light'),
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
                    <Sparkles className="h-3 w-3 mr-1" />
                    {t('common.superAdmin')}
                  </Badge>
                )}
                {user.role === 'ADMIN' && (
                  <Badge variant="purple">
                    <Sparkles className="h-3 w-3 mr-1" />
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

function SettingItemRow({ item, disabled }: { item: SettingItem; disabled?: boolean }) {
  const t = useTranslations();
  const [mounted, setMounted] = useState(false);
  const Icon = item.icon;

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl p-3 transition-all duration-200',
        disabled && 'cursor-not-allowed',
        !disabled &&
          (item.type === 'link' || item.type === 'action') &&
          'hover:bg-muted cursor-pointer',
        item.danger && !disabled && 'text-destructive hover:bg-destructive/5'
      )}
      role={disabled ? 'group' : undefined}
      aria-disabled={disabled || undefined}
      title={disabled ? t('settings.comingSoonHint') : undefined}
    >
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
          item.danger ? 'bg-destructive/10' : 'bg-muted'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{item.label}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
        )}
      </div>

      {item.type === 'toggle' &&
        (mounted ? (
          <Switch
            checked={item.value as boolean}
            onCheckedChange={item.onToggle}
            disabled={disabled}
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-6 w-11 shrink-0 rounded-full border border-border bg-muted/70"
          />
        ))}

      {item.type === 'select' && (
        <Select value={item.value as string} onValueChange={item.onSelect} disabled={disabled}>
          <SelectTrigger className="h-9 w-[9.5rem] min-w-[9rem] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {item.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {(item.type === 'link' || item.type === 'action') && (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </div>
  );

  if (disabled) {
    return content;
  }

  if (item.type === 'link' && item.href) {
    return <Link href={item.href}>{content}</Link>;
  }

  if (item.type === 'action' && item.onClick) {
    return (
      <button onClick={item.onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}

'use client';

/**
 * 设置页面
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  User,
  Shield,
  Bell,
  Globe,
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
  Fingerprint,
} from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuthStore } from '@/stores/auth';
import { useRouter, usePathname } from '@/lib/i18n/navigation';
import { Link } from '@/lib/i18n/navigation';

interface SettingSection {
  title: string;
  description?: string;
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
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
    toast.success('已退出登录');
  };

  const handleDeleteAccount = () => {
    toast.info('功能开发中，请联系客服');
    setDeleteDialogOpen(false);
  };

  const handleLanguageChange = (lang: string) => {
    const newPath = pathname.replace(/^\/[a-z]{2}/, `/${lang}`);
    window.location.href = newPath;
  };

  const sections: SettingSection[] = [
    {
      title: '个人资料',
      items: [
        {
          id: 'profile',
          icon: User,
          label: '编辑资料',
          description: '修改头像、昵称等信息',
          type: 'link',
          href: '/profile',
        },
        {
          id: 'security',
          icon: Shield,
          label: '账号安全',
          description: '修改密码、绑定手机',
          type: 'link',
          href: '/settings/security',
        },
      ],
    },
    {
      title: '偏好设置',
      items: [
        {
          id: 'theme',
          icon: theme === 'dark' ? Moon : Sun,
          label: '深色模式',
          description: '切换明暗主题',
          type: 'toggle',
          value: theme === 'dark',
          onToggle: (value) => setTheme(value ? 'dark' : 'light'),
        },
        {
          id: 'language',
          icon: Languages,
          label: '语言',
          description: '选择界面语言',
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
      title: '通知',
      items: [
        {
          id: 'push',
          icon: Bell,
          label: '推送通知',
          description: '接收申请进度、AI回复等通知',
          type: 'toggle',
          value: notifications,
          onToggle: setNotifications,
        },
        {
          id: 'email',
          icon: FileText,
          label: '邮件通知',
          description: '接收重要更新和周报',
          type: 'toggle',
          value: emailNotifications,
          onToggle: setEmailNotifications,
        },
      ],
    },
    {
      title: '订阅与支付',
      items: [
        {
          id: 'subscription',
          icon: CreditCard,
          label: '会员订阅',
          description: user?.role === 'VERIFIED' ? '已验证用户' : '升级解锁更多功能',
          type: 'link',
          href: '/settings/subscription',
        },
      ],
    },
    {
      title: '帮助与支持',
      items: [
        {
          id: 'help',
          icon: HelpCircle,
          label: '帮助中心',
          description: '常见问题与使用指南',
          type: 'link',
          href: '/help',
        },
        {
          id: 'terms',
          icon: FileText,
          label: '用户协议',
          type: 'link',
          href: '/terms',
        },
        {
          id: 'privacy',
          icon: Lock,
          label: '隐私政策',
          type: 'link',
          href: '/privacy',
        },
      ],
    },
    {
      title: '账号操作',
      items: [
        {
          id: 'logout',
          icon: LogOut,
          label: '退出登录',
          type: 'action',
          onClick: () => setLogoutDialogOpen(true),
        },
        {
          id: 'delete',
          icon: Trash2,
          label: '删除账号',
          description: '永久删除您的账号和所有数据',
          type: 'action',
          danger: true,
          onClick: () => setDeleteDialogOpen(true),
        },
      ],
    },
  ];

  return (
    <PageContainer>
      <PageHeader title="设置" description="管理您的账号和偏好设置" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Card */}
        {user && (
          <Card className="lg:col-span-3">
            <CardContent className="flex items-center gap-4 p-6">
              <Avatar className="h-16 w-16">
                <AvatarImage src={undefined} />
                <AvatarFallback className="text-lg">
                  {user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{user.email?.split('@')[0]}</h3>
                  {user.role === 'ADMIN' && (
                    <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                      管理员
                    </Badge>
                  )}
                  {user.role === 'VERIFIED' && (
                    <Badge variant="secondary" className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                      已验证
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/profile">编辑资料</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Settings Sections */}
        {sections.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIndex * 0.1 }}
            className="lg:col-span-1"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{section.title}</CardTitle>
                {section.description && (
                  <CardDescription>{section.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-1">
                {section.items.map((item, itemIndex) => (
                  <div key={item.id}>
                    {itemIndex > 0 && <Separator className="my-2" />}
                    <SettingItemRow item={item} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Logout Dialog */}
      <ConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        title="退出登录"
        description="确定要退出登录吗？"
        onConfirm={handleLogout}
      />

      {/* Delete Account Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="删除账号"
        description="此操作不可逆，您的所有数据将被永久删除。确定要继续吗？"
        type="danger"
        onConfirm={handleDeleteAccount}
      />
    </PageContainer>
  );
}

function SettingItemRow({ item }: { item: SettingItem }) {
  const Icon = item.icon;

  const content = (
    <div className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
      item.type === 'link' || item.type === 'action' 
        ? 'hover:bg-muted cursor-pointer' 
        : ''
    } ${item.danger ? 'text-destructive' : ''}`}>
      <div className={`rounded-lg p-2 ${
        item.danger ? 'bg-destructive/10' : 'bg-muted'
      }`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{item.label}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
        )}
      </div>

      {item.type === 'toggle' && (
        <Switch
          checked={item.value as boolean}
          onCheckedChange={item.onToggle}
        />
      )}

      {item.type === 'select' && (
        <Select value={item.value as string} onValueChange={item.onSelect}>
          <SelectTrigger className="w-32">
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
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );

  if (item.type === 'link' && item.href) {
    return <Link href={item.href}>{content}</Link>;
  }

  if (item.type === 'action' && item.onClick) {
    return <button onClick={item.onClick} className="w-full text-left">{content}</button>;
  }

  return content;
}



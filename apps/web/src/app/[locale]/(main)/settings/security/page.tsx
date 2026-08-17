'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Key,
  Smartphone,
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Clock as ClockIcon,
} from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PasswordStrength, isPasswordValid } from '@/components/ui/password-strength';
import { apiClient } from '@/lib/api';
import { authRoutes, userRoutes } from '@study-abroad/shared';
import { useRouter } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/stores/auth';

export default function SecurityPage() {
  const t = useTranslations('security');
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const changePasswordMutation = useMutation({
    // @cache-invalidation-allowed: security form (change-password) — toast + clears local fields; no cached list/detail
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiClient.post(authRoutes.changePassword(), data),
    onSuccess: () => {
      toast.success(t('passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
  });

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('passwordTooShort'));
      return;
    }
    if (!isPasswordValid(newPassword)) {
      toast.error(t('passwordTooWeak'));
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const deleteAccountMutation = useMutation({
    mutationFn: (password: string) =>
      apiClient.delete(userRoutes.me(), { body: JSON.stringify({ password }) }),
    onSuccess: () => {
      // @cache-invalidation-allowed: account deleted; user leaves the app
      setDeleteDialogOpen(false);
      setDeletePassword('');
      toast.success(tSettings('toast.accountDeleted'));
      logout();
      router.push('/login');
    },
  });

  return (
    <PageContainer maxWidth="3xl">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={ShieldCheck}
        color="emerald"
      />

      <div className="space-y-6">
        {/* Password Section — wired to POST /auth/change-password */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden">
            <div className="h-1 bg-primary" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Key className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle>{t('changePassword')}</CardTitle>
                  <CardDescription>{t('changePasswordDesc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">{t('currentPassword')}</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={showCurrentPassword ? t('hidePassword') : t('showPassword')}
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">{t('newPassword')}</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={showNewPassword ? t('hidePassword') : t('showPassword')}
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('passwordRequirements')}</p>
                <PasswordStrength password={newPassword} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  !isPasswordValid(newPassword) ||
                  changePasswordMutation.isPending
                }
                className="gap-2 bg-primary hover:opacity-90 text-primary-foreground"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tCommon('processing')}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {t('updatePassword')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Two-Factor Authentication — Coming Soon (no backend) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="overflow-hidden opacity-60">
            <div className="h-1 bg-primary dark:bg-primary" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>{t('twoFactor')}</CardTitle>
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <ClockIcon className="h-3 w-3" />
                      {tCommon('comingSoon')}
                    </Badge>
                  </div>
                  <CardDescription>{t('twoFactorDesc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="overflow-hidden border-destructive/30">
            <div className="h-1 bg-gradient-to-r bg-destructive" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <CardTitle className="text-destructive">{t('dangerZone')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{t('dangerZoneDesc')}</p>
              <Button
                variant="destructive"
                className="gap-2"
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <AlertTriangle className="h-4 w-4" />
                {t('deleteAccount')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeletePassword('');
        }}
        title={tSettings('dialogs.deleteTitle')}
        description={tSettings('dialogs.deleteDesc')}
        type="danger"
        confirmDisabled={!deletePassword.trim() || deleteAccountMutation.isPending}
        loading={deleteAccountMutation.isPending}
        extra={
          <div className="mt-4 space-y-2 text-left">
            <Label htmlFor="security-delete-password" className="text-sm text-foreground">
              {t('enterPasswordToDelete')}
            </Label>
            <Input
              id="security-delete-password"
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={tSettings('dialogs.deletePasswordPlaceholder')}
              className="dark:bg-slate-900"
            />
          </div>
        }
        onConfirm={() => {
          if (!deletePassword.trim()) return;
          deleteAccountMutation.mutate(deletePassword);
        }}
      />
    </PageContainer>
  );
}

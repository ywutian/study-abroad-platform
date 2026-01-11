'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Shield,
  Key,
  Smartphone,
  History,
  LogOut,
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Monitor,
  MapPin,
  Clock,
  ShieldCheck,
} from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

const mockSessions: Session[] = [
  { id: '1', device: 'Chrome on macOS', location: '北京, 中国', lastActive: '当前会话', current: true },
  { id: '2', device: 'Safari on iPhone', location: '上海, 中国', lastActive: '2小时前', current: false },
];

export default function SecurityPage() {
  const t = useTranslations('security');
  const tCommon = useTranslations('common');
  const { user } = useAuthStore();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [logoutAllDialogOpen, setLogoutAllDialogOpen] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('passwordTooShort'));
      return;
    }

    setIsChangingPassword(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success(t('passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(tCommon('error'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleToggle2FA = async (enabled: boolean) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    setTwoFactorEnabled(enabled);
    toast.success(enabled ? t('twoFactorEnabled') : t('twoFactorDisabled'));
  };

  const handleLogoutAllDevices = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.success(t('loggedOutAll'));
    setLogoutAllDialogOpen(false);
  };

  const handleRevokeSession = async (sessionId: string) => {
    toast.success(t('sessionRevoked'));
  };

  return (
    <PageContainer maxWidth="3xl">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={ShieldCheck}
        color="emerald"
      />

      <div className="space-y-6">
        {/* Password Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
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
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
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
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('passwordRequirements')}</p>
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
                disabled={!currentPassword || !newPassword || !confirmPassword || isChangingPassword}
                className="gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white shadow-md shadow-blue-500/25"
              >
                {isChangingPassword ? (
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

        {/* Two-Factor Authentication */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                  <Smartphone className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <CardTitle>{t('twoFactor')}</CardTitle>
                  <CardDescription>{t('twoFactorDesc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  {twoFactorEnabled ? (
                    <Badge variant="success" className="gap-1">
                      <Check className="h-3 w-3" />
                      {t('enabled')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      {t('disabled')}
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {twoFactorEnabled ? t('twoFactorOn') : t('twoFactorOff')}
                  </span>
                </div>
                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={handleToggle2FA}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Active Sessions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-500 to-yellow-500" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <History className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle>{t('activeSessions')}</CardTitle>
                    <CardDescription>{t('activeSessionsDesc')}</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setLogoutAllDialogOpen(true)}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('logoutAll')}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-xl transition-colors',
                      session.current ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        session.current ? 'bg-emerald-500/10' : 'bg-muted'
                      )}>
                        <Monitor className={cn('h-5 w-5', session.current ? 'text-emerald-500' : 'text-muted-foreground')} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{session.device}</p>
                          {session.current && (
                            <Badge variant="success" className="text-xs">
                              {t('currentSession')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.lastActive}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!session.current && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRevokeSession(session.id)}
                      >
                        {t('revoke')}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="overflow-hidden border-destructive/30">
            <div className="h-1 bg-gradient-to-r from-red-500 to-rose-500" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <CardTitle className="text-destructive">{t('dangerZone')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('dangerZoneDesc')}
              </p>
              <Button variant="destructive" className="gap-2" asChild>
                <a href="/settings">
                  <AlertTriangle className="h-4 w-4" />
                  {t('deleteAccount')}
                </a>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Logout All Dialog */}
      <ConfirmDialog
        open={logoutAllDialogOpen}
        onOpenChange={setLogoutAllDialogOpen}
        title={t('logoutAllTitle')}
        description={t('logoutAllDesc')}
        onConfirm={handleLogoutAllDevices}
      />
    </PageContainer>
  );
}

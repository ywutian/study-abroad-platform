'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/lib/i18n/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import {
  KeyRound,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { PasswordStrength, isPasswordValid } from '@/components/ui/password-strength';

export default function ResetPasswordPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: { token: string; newPassword: string }) =>
      apiClient.post('/auth/reset-password', data, { skipAuth: true }),
    onSuccess: () => {
      setSuccess(true);
    },
    // Error toast handled by global MutationCache
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error(t('auth.resetPassword.invalidLink'));
      return;
    }

    if (!isPasswordValid(password)) {
      toast.error(t('auth.resetPassword.passwordTooWeak'));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t('auth.resetPassword.passwordMismatch'));
      return;
    }

    mutation.mutate({ token, newPassword: password });
  };

  // No token - invalid link
  if (!token) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-auth-error-bg ring-1 ring-auth-error-ring">
            <AlertCircle className="h-8 w-8 text-auth-error" />
          </div>
          <h1 className="text-title text-auth">{t('auth.resetPassword.invalidLink')}</h1>
          <p className="mt-2 text-sm text-auth-muted">{t('auth.resetPassword.linkExpiredDesc')}</p>
        </div>
        <Link href="/forgot-password" className="block">
          <Button className="w-full h-12 bg-primary text-white font-medium rounded-xl">
            {t('auth.resetPassword.getNewLink')}
          </Button>
        </Link>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-success/10 ring-1 ring-success/20">
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-title text-auth">{t('auth.resetPassword.success')}</h1>
          <p className="mt-2 text-sm text-auth-muted">{t('auth.resetPassword.successDesc')}</p>
        </div>
        <Link href="/login" className="block">
          <Button className="w-full h-12 bg-primary text-white font-medium rounded-xl">
            {t('auth.resetPassword.goToLogin')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-auth-icon-bg ring-1 ring-auth-icon-ring">
          <KeyRound className="h-8 w-8 text-auth-accent" />
        </div>
        <h1 className="text-title text-auth">{t('auth.resetPassword.title')}</h1>
        <p className="mt-2 text-sm text-auth-muted">{t('auth.resetPassword.description')}</p>
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-auth-subtle">
            {t('auth.resetPassword.newPassword')}
          </Label>
          <div className="relative group">
            <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
              <Lock className="h-4 w-4 text-auth-icon group-focus-within:text-auth-icon-focus transition-colors" />
            </div>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={mutation.isPending}
              className="h-12 pl-11 pr-11 bg-auth-input-bg border-auth-input-border text-auth-input-text placeholder:text-auth-input-placeholder rounded-xl focus:bg-auth-input-bg focus:border-auth-focus-border focus:ring-2 focus:ring-auth-focus-ring transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center text-auth-icon hover:text-auth transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-auth-subtle">
            {t('auth.resetPassword.confirmPassword')}
          </Label>
          <div className="relative group">
            <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
              <ShieldCheck className="h-4 w-4 text-auth-icon group-focus-within:text-auth-icon-focus transition-colors" />
            </div>
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('auth.resetPassword.confirmPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={mutation.isPending}
              className="h-12 pl-11 pr-11 bg-auth-input-bg border-auth-input-border text-auth-input-text placeholder:text-auth-input-placeholder rounded-xl focus:bg-auth-input-bg focus:border-auth-focus-border focus:ring-2 focus:ring-auth-focus-ring transition-all"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center text-auth-icon hover:text-auth transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* 密码强度 */}
        <PasswordStrength password={password} />

        <Button
          type="submit"
          className="w-full h-12 bg-primary text-white font-medium rounded-xl  transition-all duration-300 disabled:opacity-50"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('auth.resetPassword.resetting')}
            </>
          ) : (
            t('auth.resetPassword.resetButton')
          )}
        </Button>

        <div className="text-center pt-2">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-auth-muted hover:text-auth hover:bg-transparent"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('auth.resetPassword.backToLogin')}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

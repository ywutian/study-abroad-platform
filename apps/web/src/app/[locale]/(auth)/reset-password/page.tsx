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
import { KeyRound, ArrowLeft, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';

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
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error(t('auth.resetPassword.invalidLink'));
      return;
    }

    if (password.length < 8) {
      toast.error(t('auth.resetPassword.passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t('auth.resetPassword.passwordMismatch'));
      return;
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      toast.error(t('auth.resetPassword.passwordNeedLetter'));
      return;
    }

    mutation.mutate({ token, newPassword: password });
  };

  // No token - invalid link
  if (!token) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--auth-error-bg)] ring-1 ring-[var(--auth-error-ring)]">
            <AlertCircle className="h-8 w-8 text-[var(--auth-error)]" />
          </div>
          <h1 className="text-2xl font-bold text-auth tracking-tight">
            {t('auth.resetPassword.invalidLink')}
          </h1>
          <p className="mt-2 text-sm text-auth-muted">
            {t('auth.resetPassword.linkExpiredDesc')}
          </p>
        </div>
        <Link href="/forgot-password" className="block">
          <Button className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25">
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
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-auth tracking-tight">
            {t('auth.resetPassword.success')}
          </h1>
          <p className="mt-2 text-sm text-auth-muted">
            {t('auth.resetPassword.successDesc')}
          </p>
        </div>
        <Link href="/login" className="block">
          <Button className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25">
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
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--auth-icon-bg)] ring-1 ring-[var(--auth-icon-ring)]">
          <KeyRound className="h-8 w-8 text-[var(--auth-accent)]" />
        </div>
        <h1 className="text-2xl font-bold text-auth tracking-tight">
          {t('auth.resetPassword.title')}
        </h1>
        <p className="mt-2 text-sm text-auth-muted">
          {t('auth.resetPassword.description')}
        </p>
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
              placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={mutation.isPending}
              className="h-12 pl-11 pr-11 bg-auth-input-bg border-auth-input-border text-auth-input-text placeholder:text-auth-input-placeholder rounded-xl focus:bg-auth-input-bg focus:border-[var(--auth-focus-border)] focus:ring-2 focus:ring-[var(--auth-focus-ring)] transition-all"
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
              placeholder={t('auth.resetPassword.confirmPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={mutation.isPending}
              className="h-12 pl-11 pr-11 bg-auth-input-bg border-auth-input-border text-auth-input-text placeholder:text-auth-input-placeholder rounded-xl focus:bg-auth-input-bg focus:border-[var(--auth-focus-border)] focus:ring-2 focus:ring-[var(--auth-focus-ring)] transition-all"
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

        {/* 密码要求 */}
        <div className="space-y-2 p-3 rounded-xl bg-auth-input-bg border border-auth-input-border">
          <p className="text-xs text-auth-muted mb-2">{t('auth.resetPassword.requirements.title') || '密码要求'}</p>
          <div className="space-y-1.5 text-xs">
            <p className={`flex items-center gap-2 ${password.length >= 8 ? 'text-emerald-400' : 'text-auth-muted'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${password.length >= 8 ? 'bg-emerald-500/20' : 'bg-auth-input-bg'}`}>
                {password.length >= 8 ? '✓' : '○'}
              </span>
              {t('auth.resetPassword.requirements.minLength')}
            </p>
            <p className={`flex items-center gap-2 ${/[A-Za-z]/.test(password) ? 'text-emerald-400' : 'text-auth-muted'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${/[A-Za-z]/.test(password) ? 'bg-emerald-500/20' : 'bg-auth-input-bg'}`}>
                {/[A-Za-z]/.test(password) ? '✓' : '○'}
              </span>
              {t('auth.resetPassword.requirements.hasLetter')}
            </p>
            <p className={`flex items-center gap-2 ${/\d/.test(password) ? 'text-emerald-400' : 'text-auth-muted'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${/\d/.test(password) ? 'bg-emerald-500/20' : 'bg-auth-input-bg'}`}>
                {/\d/.test(password) ? '✓' : '○'}
              </span>
              {t('auth.resetPassword.requirements.hasNumber')}
            </p>
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-50"
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

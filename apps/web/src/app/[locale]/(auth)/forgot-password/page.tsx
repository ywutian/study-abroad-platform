'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/lib/i18n/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { Mail, ArrowLeft, Loader2, CheckCircle, Send } from 'lucide-react';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: (email: string) =>
      apiClient.post('/auth/forgot-password', { email }, { skipAuth: true }),
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error(t('auth.forgotPassword.emailRequired'));
      return;
    }
    mutation.mutate(email);
  };

  if (submitted) {
    return (
      <div className="space-y-6">
        {/* 成功图标 */}
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-auth tracking-tight">
            {t('auth.forgotPassword.emailSent')}
          </h1>
          <p className="mt-2 text-sm text-auth-muted">
            {t('auth.forgotPassword.emailSentDesc')}
          </p>
        </div>

        {/* 提示信息 */}
        <div className="space-y-3 text-center">
          <p className="text-sm text-auth-subtle">
            {t('auth.forgotPassword.checkInbox')}{' '}
            <span className="font-medium text-auth">{email}</span>
          </p>
          <p className="text-xs text-auth-muted">
            {t('auth.forgotPassword.checkSpam')}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3 pt-2">
          <Button 
            variant="outline" 
            onClick={() => setSubmitted(false)} 
            className="w-full h-11 bg-auth-input-bg border-auth-input-border text-auth hover:bg-accent hover:text-auth rounded-xl"
          >
            <Send className="mr-2 h-4 w-4" />
            {t('auth.forgotPassword.resend')}
          </Button>
          <Link href="/login" className="block">
            <Button 
              variant="ghost" 
              className="w-full h-11 text-auth-subtle hover:text-auth hover:bg-auth-input-bg rounded-xl"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('auth.forgotPassword.backToLogin')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--auth-icon-bg)] ring-1 ring-[var(--auth-icon-ring)]">
          <Mail className="h-8 w-8 text-[var(--auth-accent)]" />
        </div>
        <h1 className="text-2xl font-bold text-auth tracking-tight">
          {t('auth.forgotPassword.title')}
        </h1>
        <p className="mt-2 text-sm text-auth-muted">
          {t('auth.forgotPassword.description')}
        </p>
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-auth-subtle">
            {t('auth.forgotPassword.emailLabel')}
          </Label>
          <div className="relative group">
            <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
              <Mail className="h-4 w-4 text-auth-icon group-focus-within:text-auth-icon-focus transition-colors" />
            </div>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mutation.isPending}
              className="h-12 pl-11 pr-4 bg-auth-input-bg border-auth-input-border text-auth-input-text placeholder:text-auth-input-placeholder rounded-xl focus:bg-auth-input-bg focus:border-[var(--auth-focus-border)] focus:ring-2 focus:ring-[var(--auth-focus-ring)] transition-all"
              autoComplete="email"
            />
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
              {t('auth.forgotPassword.sending')}
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              {t('auth.forgotPassword.sendLink')}
            </>
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
              {t('auth.forgotPassword.backToLogin')}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { CheckCircle, XCircle, Loader2, ArrowRight, RefreshCw } from 'lucide-react';

type VerifyState = 'loading' | 'success' | 'error';

export default function VerifyEmailCallbackPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMessage(t('auth.verifyEmail.invalidLink'));
      return;
    }

    const verifyEmail = async () => {
      try {
        await apiClient.get(`/auth/verify-email?token=${token}`, { skipAuth: true });
        setState('success');
      } catch (error: any) {
        setState('error');
        setErrorMessage(error.message || t('auth.verifyEmail.failed'));
      }
    };

    verifyEmail();
  }, [token, t]);

  if (state === 'loading') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--auth-icon-bg)] ring-1 ring-[var(--auth-icon-ring)]">
            <Loader2 className="h-10 w-10 animate-spin text-[var(--auth-accent)]" />
          </div>
          <h1 className="text-2xl font-bold text-auth tracking-tight">
            {t('auth.verifyEmail.verifying')}
          </h1>
          <p className="mt-2 text-sm text-auth-muted">
            {t('auth.verifyEmail.verifyingDesc')}
          </p>
        </div>

        <div className="flex justify-center">
          <div className="flex items-center gap-2 text-auth-muted text-sm">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--auth-pulse-dot)] animate-pulse" />
            <span>正在验证您的邮箱...</span>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--auth-error-bg)] ring-1 ring-[var(--auth-error-ring)]">
            <XCircle className="h-10 w-10 text-[var(--auth-error)]" />
          </div>
          <h1 className="text-2xl font-bold text-auth tracking-tight">
            {t('auth.verifyEmail.failed')}
          </h1>
          <p className="mt-2 text-sm text-auth-muted">
            {errorMessage}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
          <p className="text-sm text-auth-subtle text-center">
            {t('auth.verifyEmail.linkExpired')}
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/login" className="block">
            <Button className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25">
              {t('auth.verifyEmail.goToLogin')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/register" className="block">
            <Button 
              variant="outline" 
              className="w-full h-11 bg-auth-input-bg border-auth-input-border text-auth hover:bg-accent hover:text-auth rounded-xl"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('auth.verifyEmail.reRegister')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <CheckCircle className="h-10 w-10 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-auth tracking-tight">
          {t('auth.verifyEmail.success')}
        </h1>
        <p className="mt-2 text-sm text-auth-muted">
          {t('auth.verifyEmail.successDesc')}
        </p>
      </div>

      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
        <p className="text-sm text-auth-subtle text-center">
          {t('auth.verifyEmail.successHint')}
        </p>
      </div>

      <Link href="/login" className="block">
        <Button className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/25">
          {t('auth.verifyEmail.goToLogin')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

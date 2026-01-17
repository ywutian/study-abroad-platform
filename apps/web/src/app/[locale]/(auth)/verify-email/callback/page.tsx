'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

type VerifyState = 'loading' | 'success' | 'error';

export default function VerifyEmailCallbackPage() {
  const searchParams = useSearchParams();
  const t = useTranslations('auth.verifyEmail');
  const token = searchParams.get('token');

  const [state, setState] = useState<VerifyState>(token ? 'loading' : 'error');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMessage(t('invalidToken'));
      return;
    }

    const verify = async () => {
      try {
        await apiClient.get('/auth/verify-email', {
          params: { token },
          skipAuth: true,
        });
        setState('success');
      } catch (err) {
        setState('error');
        setErrorMessage(err instanceof Error ? err.message : t('verifyFailed'));
      }
    };

    verify();
  }, [token, t]);

  // 加载状态
  if (state === 'loading') {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-auth-icon-bg ring-1 ring-auth-icon-ring">
          <Loader2 className="h-8 w-8 text-auth-accent animate-spin" />
        </div>
        <div>
          <h1 className="text-title text-auth">{t('verifying')}</h1>
          <p className="mt-2 text-sm text-auth-muted">{t('pleaseWait')}</p>
        </div>
      </div>
    );
  }

  // 成功状态
  if (state === 'success') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-title text-auth">{t('verifiedTitle')}</h1>
          <p className="mt-2 text-sm text-auth-muted">{t('verifiedDesc')}</p>
        </div>
        <Link href="/login?verified=true" className="block">
          <Button className="w-full h-12 bg-primary text-white font-medium rounded-xl">
            {t('goToLogin')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  // 错误状态
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-destructive/10 ring-1 ring-destructive/20">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-title text-auth">{t('verifyFailedTitle')}</h1>
        <p className="mt-2 text-sm text-auth-muted">{errorMessage || t('verifyFailed')}</p>
      </div>
      <div className="space-y-3">
        <Link href="/login" className="block">
          <Button className="w-full h-11 bg-primary text-white font-medium rounded-xl">
            {t('backToLogin')}
          </Button>
        </Link>
      </div>
    </div>
  );
}

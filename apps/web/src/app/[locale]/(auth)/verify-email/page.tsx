'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { Mail, ArrowLeft, RefreshCw } from 'lucide-react';

export default function VerifyEmailPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  return (
    <div className="space-y-6">
      {/* 图标 */}
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--auth-icon-bg)] ring-1 ring-[var(--auth-icon-ring)]">
          <Mail className="h-10 w-10 text-[var(--auth-accent)]" />
        </div>
        <h1 className="text-2xl font-bold text-auth tracking-tight">
          {t('auth.verifyEmail.title')}
        </h1>
        <p className="mt-2 text-sm text-auth-muted">
          {t('auth.verifyEmail.subtitle')}
        </p>
      </div>

      {/* 邮箱信息 */}
      <div className="space-y-4 text-center">
        <div className="p-4 rounded-xl bg-auth-input-bg border border-auth-input-border">
          <p className="text-sm text-auth-subtle">
            {t('auth.verifyEmail.sentTo')}
          </p>
          <p className="mt-1 font-medium text-auth truncate">
            {email}
          </p>
        </div>
        <p className="text-xs text-auth-muted">
          {t('auth.verifyEmail.checkSpam')}
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="space-y-3 pt-2">
        <Button 
          variant="outline" 
          className="w-full h-11 bg-auth-input-bg border-auth-input-border text-auth hover:bg-accent hover:text-auth rounded-xl"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('auth.verifyEmail.resend')}
        </Button>
        <Link href="/login" className="block">
          <Button 
            variant="ghost" 
            className="w-full h-11 text-auth-subtle hover:text-auth hover:bg-auth-input-bg rounded-xl"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('auth.verifyEmail.backToLogin')}
          </Button>
        </Link>
      </div>
    </div>
  );
}

'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { Mail } from 'lucide-react';

export default function VerifyEmailPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  return (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <Mail className="h-8 w-8 text-blue-600" />
        </div>
        <CardTitle className="text-2xl">{t('auth.verifyEmail.title')}</CardTitle>
        <CardDescription>{t('auth.verifyEmail.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          {t('auth.verifyEmail.sentTo')} <strong>{email}</strong>
        </p>
        <p className="text-sm text-slate-500">{t('auth.verifyEmail.checkSpam')}</p>
        <div className="pt-4">
          <Link href="/login">
            <Button variant="outline">{t('auth.verifyEmail.backToLogin')}</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}


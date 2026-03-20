'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('admin');

  useEffect(() => {
    console.error('Admin error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center" role="alert">
          <h2 className="text-2xl font-bold">{t('error')}</h2>
          <p className="text-muted-foreground">{t('errorDescription')}</p>
          <div className="flex gap-3">
            <Button onClick={() => reset()}>{t('tryAgain')}</Button>
            <Button variant="outline" asChild>
              <Link href="/admin">{t('backToDashboard')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

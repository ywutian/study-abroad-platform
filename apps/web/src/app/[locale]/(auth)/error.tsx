'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4" role="alert">
      <h2 className="text-2xl font-bold">{t('auth.error')}</h2>
      <p className="text-muted-foreground">{t('auth.errorProcessing')}</p>
      <Button onClick={() => reset()}>{t('common.retry')}</Button>
    </div>
  );
}

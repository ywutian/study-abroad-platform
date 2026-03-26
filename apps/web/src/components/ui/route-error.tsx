'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

type ErrorCategory = 'ai' | 'data' | 'content' | 'generic';

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  category?: ErrorCategory;
}

export function RouteError({ error, reset, category = 'generic' }: RouteErrorProps) {
  const t = useTranslations('errors.route');

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-2xl font-bold">{t('title')}</h2>
      <p className="text-center text-muted-foreground max-w-md">{t(category)}</p>
      <div className="flex gap-3">
        <Button onClick={() => reset()} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          {t('tryAgain')}
        </Button>
        <Button variant="outline" className="gap-2" asChild>
          <Link href="/dashboard">
            <Home className="h-4 w-4" />
            {t('backHome')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

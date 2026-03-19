'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { RecommendationPreflight } from '@study-abroad/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/i18n/navigation';

interface ProfileStatusBannerProps {
  preflight?: RecommendationPreflight;
  isLoading: boolean;
}

export function ProfileStatusBanner({ preflight, isLoading }: ProfileStatusBannerProps) {
  const t = useTranslations('recommendation');

  if (isLoading) {
    return <Skeleton className="h-12 w-full rounded-lg" />;
  }

  if (!preflight) return null;

  if (preflight.profileComplete) {
    return (
      <Alert className="border-success/30 bg-success/5">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <AlertDescription className="text-sm">
          {t('profileReady')}
          {preflight.profileSummary && (
            <span className="ml-2 text-muted-foreground">
              GPA: {preflight.profileSummary.gpa ?? '—'} · {t('tests')}:{' '}
              {preflight.profileSummary.testCount} · {t('activities')}:{' '}
              {preflight.profileSummary.activityCount}
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="text-sm">
        {t('profileIncomplete')}
        {preflight.missingFields.length > 0 && (
          <span className="ml-1 text-muted-foreground">
            {t('missing')}: {preflight.missingFields.join(', ')}
          </span>
        )}
        <Link href="/profile" className="ml-2 underline underline-offset-2">
          {t('completeProfile')}
        </Link>
      </AlertDescription>
    </Alert>
  );
}

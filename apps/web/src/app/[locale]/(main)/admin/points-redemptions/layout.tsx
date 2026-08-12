import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Ban } from 'lucide-react';
import { POINTS_ECONOMY_AVAILABLE } from '@study-abroad/shared';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function generateMetadata(): Metadata {
  return POINTS_ECONOMY_AVAILABLE ? {} : { robots: { index: false, follow: false } };
}

export default async function PointsRedemptionsLayout({ children }: { children: React.ReactNode }) {
  if (!POINTS_ECONOMY_AVAILABLE) {
    const t = await getTranslations('admin.pointsRedemptions');

    return (
      <Card data-testid="points-economy-unavailable" className="mx-auto mt-12 max-w-xl">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-muted">
            <Ban className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-title">{t('unavailableTitle')}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            {t('unavailableDescription')}
          </p>
          <Button asChild className="mt-6">
            <Link href="/admin">{t('backToAdmin')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return children;
}

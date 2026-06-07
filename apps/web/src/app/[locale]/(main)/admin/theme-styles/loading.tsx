'use client';

import { PageHeader } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/loading-state';
import { Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function LoadingAdminThemeStylesPage() {
  const t = useTranslations('admin.themeStyles');

  return (
    <>
      <PageHeader title={t('title')} icon={Palette} variant="admin" />
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4 xl:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <CardSkeleton key={item} />
          ))}
        </div>
        <CardSkeleton />
      </div>
    </>
  );
}

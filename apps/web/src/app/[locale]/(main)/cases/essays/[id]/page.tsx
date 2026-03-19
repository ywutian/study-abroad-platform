'use client';

import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { useTranslations } from 'next-intl';
import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { EssayDetailPanel } from '../../_components/EssayDetailPanel';
import { AIErrorBoundary } from '@/components/features/ai-error-boundary';

export default function EssayDetailPage() {
  const params = useParams();
  const essayId = params.id as string;
  const t = useTranslations('essayGallery');

  return (
    <PageContainer maxWidth="default">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
          <Link href="/cases?tab=essays">
            <ArrowLeft className="h-4 w-4" />
            {t('title')}
          </Link>
        </Button>
      </div>

      <AIErrorBoundary feature="essay-review">
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <EssayDetailPanel essayId={essayId} onClose={() => {}} />
        </div>
      </AIErrorBoundary>
    </PageContainer>
  );
}

'use client';

import { useCallback, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Megaphone } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api/client';
import { STALE_TIME } from '@/lib/api';
import { essayAiRoutes } from '@study-abroad/shared';
import {
  getResultLabel as getResultLabelUtil,
  getEssayTypeLabel as getEssayTypeLabelUtil,
} from '@/lib/utils/admission';
import { SubmitCaseDialog } from '@/components/features';

import { EssayCard, type GalleryEssay } from './essay-card';
import { LoadingSkeleton } from './loading-skeleton';

interface RejectedResponse {
  items: GalleryEssay[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * "文书避雷" tab — the blue-ocean differentiator the 19-agent debate
 * landed on. CollegeVine/Khan can't ship this; Chinese parents will
 * absolutely consume rejection retrospectives.
 *
 * Hard editorial rule (also enforced upstream): we never harvest
 * rejected essays — only self-uploads with author-written reflections.
 * The empty state is the most common path at launch and is intentionally
 * inviting rather than apologetic.
 */
export function RejectedEssaysTab() {
  const t = useTranslations('essayGallery');
  const tc = useTranslations('cases');
  const locale = useLocale();
  const router = useRouter();
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const getResultLabel = useCallback(
    (result: string) => getResultLabelUtil(result, (key: string) => tc(key)),
    [tc]
  );
  const getTypeLabel = useCallback(
    (type?: string) => getEssayTypeLabelUtil(type, (key: string) => t(key)),
    [t]
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['essay-gallery-rejected'],
    queryFn: () => apiClient.get<RejectedResponse>(essayAiRoutes.galleryRejected()),
    staleTime: STALE_TIME.MODERATE,
  });

  const essays = data?.items ?? [];

  return (
    <>
      {/*
       * Editorial banner — top of the tab. Sets expectations BEFORE the
       * reader sees any content: the archive is self-upload only, never
       * scraped. This is the editorial promise that lets us ship the
       * feature with the user-trust posture from the debate intact.
       */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900 dark:bg-rose-950/30">
        <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
            {t('rejected.bannerTitle')}
          </p>
          <p className="mt-1 text-xs text-rose-800/80 dark:text-rose-200/80">
            {t('rejected.bannerBody')}
          </p>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 mt-1 text-rose-700 dark:text-rose-300"
            onClick={() => setSubmitDialogOpen(true)}
          >
            {t('rejected.shareYours')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <Card className="overflow-hidden">
          <div className="h-1 bg-destructive" />
          <CardContent className="py-8">
            <EmptyState
              type="error"
              title={t('loadError')}
              description={t('loadErrorDesc')}
              action={{ label: t('retry'), onClick: () => refetch() }}
              size="lg"
            />
          </CardContent>
        </Card>
      ) : essays.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {essays.map((essay, index) => (
            <EssayCard
              key={essay.id}
              essay={essay}
              index={index}
              onClick={() => router.push(`/cases/essays/${essay.id}`)}
              getResultLabel={getResultLabel}
              getTypeLabel={getTypeLabel}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      ) : (
        /*
         * Empty state — the expected launch case (0 self-uploaded rejected
         * essays in production). Hard rule from the debate: do NOT fake-
         * populate this tab. The CTA invites learners to contribute.
         */
        <Card className="overflow-hidden">
          <div className="h-1 bg-rose-500/40" />
          <CardContent className="py-10">
            <div className="mx-auto max-w-md text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <Megaphone className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold mb-2">{t('rejected.emptyTitle')}</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {t('rejected.emptyDescription')}
              </p>
              <Button onClick={() => setSubmitDialogOpen(true)}>{t('rejected.emptyCta')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <SubmitCaseDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        defaultIncludeEssay
      />
    </>
  );
}

'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/lib/i18n/navigation';
import { apiClient, STALE_TIME } from '@/lib/api';
import { schoolRoutes } from '@study-abroad/shared';
import { AI_TIMEOUTS } from '@/lib/constants';
import { getSchoolName } from '@/lib/utils';
import { School, Loader2 } from 'lucide-react';

import type { RecommendationResponse } from '@/components/features/schools/school-recommendation.types';

const MAX_SCHOOLS = 6;

export function RecommendedSchoolsBlock() {
  const t = useTranslations('prediction');
  const locale = useLocale();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['school-ai-recommendations'],
    queryFn: () =>
      apiClient.get<RecommendationResponse>(schoolRoutes.aiRecommend(), {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    staleTime: STALE_TIME.MODERATE,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card className="mt-6">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t('recommendedSchoolsLoading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data || data.status === 'profile_incomplete' || data.status === 'ai_error') {
    return null;
  }

  const flat = [...(data.reach ?? []), ...(data.target ?? []), ...(data.safety ?? [])];
  const seen = new Set<string>();
  const items = flat
    .filter((item) => {
      const id = item.school?.id ?? item.schoolId;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, MAX_SCHOOLS);

  if (items.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardContent className="py-4">
        <p className="text-overline text-muted-foreground mb-3">{t('recommendedSchoolsTitle')}</p>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const id = item.school?.id ?? item.schoolId;
            const name = item.school?.name ?? item.schoolId;
            const nameZh = item.school?.nameZh;
            return (
              <Link
                key={id}
                href={`/schools/${id}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <School className="h-3.5 w-3.5 text-muted-foreground" />
                {getSchoolName({ name, nameZh }, locale)}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

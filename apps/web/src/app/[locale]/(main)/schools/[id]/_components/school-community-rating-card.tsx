'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { schoolRoutes, type SchoolCommunityRatingSummary } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Loader2, Shield, Smile, UtensilsCrossed, Users } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SchoolCommunityRatingCardProps {
  schoolId: string;
  summary: SchoolCommunityRatingSummary;
}

interface MySchoolCommunityRating {
  id: string;
  safetyRating: number;
  lifeRating: number;
  foodRating: number;
  isHidden: boolean;
  hiddenReason?: string | null;
}

type RatingField = 'safetyRating' | 'lifeRating' | 'foodRating';

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export function SchoolCommunityRatingCard({ schoolId, summary }: SchoolCommunityRatingCardProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { accessToken, isInitialized } = useAuthStore();
  const isLoggedIn = isInitialized && !!accessToken;

  const [draft, setDraft] = useState<Record<RatingField, number | null>>({
    safetyRating: null,
    lifeRating: null,
    foodRating: null,
  });

  const { data: myRating } = useQuery({
    queryKey: ['schoolCommunityRatingMe', schoolId],
    queryFn: () =>
      apiClient.get<MySchoolCommunityRating | null>(schoolRoutes.communityRatingMe(schoolId)),
    enabled: isLoggedIn,
  });

  useEffect(() => {
    if (!myRating) return;
    setDraft({
      safetyRating: myRating.safetyRating,
      lifeRating: myRating.lifeRating,
      foodRating: myRating.foodRating,
    });
  }, [myRating]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<RatingField, number>) =>
      apiClient.put(schoolRoutes.communityRatingMe(schoolId), payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school', schoolId] }),
        queryClient.invalidateQueries({ queryKey: ['schoolCommunityRatingMe', schoolId] }),
      ]);
      toast.success(t('school.community.saved'));
    },
    onError: () => {
      toast.error(t('school.community.saveFailed'));
    },
  });

  const canSubmit =
    draft.safetyRating != null && draft.lifeRating != null && draft.foodRating != null;

  const ratingRows = [
    {
      key: 'safetyRating' as const,
      label: t('school.community.safety'),
      icon: Shield,
    },
    {
      key: 'lifeRating' as const,
      label: t('school.community.life'),
      icon: Smile,
    },
    {
      key: 'foodRating' as const,
      label: t('school.community.food'),
      icon: UtensilsCrossed,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="">{t('school.community.title')}</CardTitle>
        <CardDescription>{t('school.community.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {summary.isPublic ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">{t('school.community.safety')}</div>
              <div className="mt-1 text-2xl font-semibold">{summary.safetyAvg?.toFixed(1)}</div>
            </div>
            <div className="rounded-xl border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">{t('school.community.life')}</div>
              <div className="mt-1 text-2xl font-semibold">{summary.lifeAvg?.toFixed(1)}</div>
            </div>
            <div className="rounded-xl border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">{t('school.community.food')}</div>
              <div className="mt-1 text-2xl font-semibold">{summary.foodAvg?.toFixed(1)}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            {summary.count > 0
              ? t('school.community.pending', {
                  count: summary.count,
                  minCount: 5,
                })
              : t('school.community.notEnough')}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{t('school.community.count', { count: summary.count })}</span>
          <Badge variant="secondary">{t('school.community.userLabel')}</Badge>
        </div>

        {isLoggedIn ? (
          <div className="space-y-4 rounded-xl border p-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">{t('school.community.rateTitle')}</div>
              <p className="text-xs text-muted-foreground">{t('school.community.rateHint')}</p>
              {myRating?.isHidden && (
                <Badge variant="outline" className="mt-1">
                  {t('school.community.hidden')}
                </Badge>
              )}
            </div>

            {ratingRows.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.key} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {row.label}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {RATING_OPTIONS.map((value) => (
                      <Button
                        key={`${row.key}-${value}`}
                        type="button"
                        size="sm"
                        variant={draft[row.key] === value ? 'default' : 'outline'}
                        className="min-w-10"
                        onClick={() => {
                          setDraft((current) => ({
                            ...current,
                            [row.key]: value,
                          }));
                        }}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}

            <Button
              onClick={() =>
                canSubmit &&
                saveMutation.mutate({
                  safetyRating: draft.safetyRating as number,
                  lifeRating: draft.lifeRating as number,
                  foodRating: draft.foodRating as number,
                })
              }
              disabled={!canSubmit || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {myRating ? t('school.community.update') : t('school.community.submit')}
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground mb-3">{t('school.community.loginHint')}</p>
            <Button asChild variant="outline">
              <Link href="/login">{t('school.community.loginAction')}</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

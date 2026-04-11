'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { adminRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Loader2, MessageSquare, RotateCcw, ShieldOff } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SchoolCommunityRatingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school: {
    id: string;
    name: string;
    nameZh?: string;
  } | null;
}

interface CommunityRatingsAdminData {
  schoolId: string;
  threshold: number;
  totalCount: number;
  hiddenCount: number;
  visibleCount: number;
  publicSummary: {
    count: number;
    safetyAvg: number | null;
    lifeAvg: number | null;
    foodAvg: number | null;
    isPublic: boolean;
  };
  visibleSummary: {
    count: number;
    safetyAvg: number | null;
    lifeAvg: number | null;
    foodAvg: number | null;
  };
  ratings: Array<{
    id: string;
    userId: string;
    safetyRating: number;
    lifeRating: number;
    foodRating: number;
    isHidden: boolean;
    hiddenReason?: string | null;
    updatedAt: string;
    user: {
      email: string;
    };
  }>;
}

function SummaryMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value != null ? value.toFixed(1) : '-'}</div>
    </div>
  );
}

export function SchoolCommunityRatingsDialog({
  open,
  onOpenChange,
  school,
}: SchoolCommunityRatingsDialogProps) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['adminSchoolCommunityRatings', school?.id],
    queryFn: () =>
      apiClient.get<CommunityRatingsAdminData>(adminRoutes.schoolsCommunityRatings(school!.id)),
    enabled: open && !!school?.id,
  });

  const hideMutation = useMutation({
    mutationFn: (ratingId: string) =>
      apiClient.post(adminRoutes.schoolsCommunityRatingHide(ratingId), {}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['adminSchoolCommunityRatings', school?.id] }),
        queryClient.invalidateQueries({ queryKey: ['adminSchools'] }),
      ]);
      toast.success(t('schools.community.hiddenSuccess'));
    },
    onError: () => {
      toast.error(t('schools.community.actionError'));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (ratingId: string) =>
      apiClient.post(adminRoutes.schoolsCommunityRatingRestore(ratingId)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['adminSchoolCommunityRatings', school?.id] }),
        queryClient.invalidateQueries({ queryKey: ['adminSchools'] }),
      ]);
      toast.success(t('schools.community.restoredSuccess'));
    },
    onError: () => {
      toast.error(t('schools.community.actionError'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('schools.community.title')}
          </DialogTitle>
          <DialogDescription>
            {school?.nameZh ? `${school.name} / ${school.nameZh}` : school?.name}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {tc('loading')}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryMetric
                label={t('schools.community.safety')}
                value={data.visibleSummary.safetyAvg}
              />
              <SummaryMetric
                label={t('schools.community.life')}
                value={data.visibleSummary.lifeAvg}
              />
              <SummaryMetric
                label={t('schools.community.food')}
                value={data.visibleSummary.foodAvg}
              />
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">
                {t('schools.community.totalCount', { count: data.totalCount })}
              </Badge>
              <Badge variant="secondary">
                {t('schools.community.visibleCount', { count: data.visibleCount })}
              </Badge>
              <Badge variant="secondary">
                {t('schools.community.hiddenCount', { count: data.hiddenCount })}
              </Badge>
              <Badge variant={data.publicSummary.isPublic ? 'default' : 'outline'}>
                {data.publicSummary.isPublic
                  ? t('schools.community.publicReady')
                  : t('schools.community.publicPending', { minCount: data.threshold })}
              </Badge>
            </div>

            <Separator />

            <ScrollArea className="h-[420px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('schools.community.user')}</TableHead>
                    <TableHead>{t('schools.community.safety')}</TableHead>
                    <TableHead>{t('schools.community.life')}</TableHead>
                    <TableHead>{t('schools.community.food')}</TableHead>
                    <TableHead>{t('schools.community.status')}</TableHead>
                    <TableHead>{t('schools.community.updatedAt')}</TableHead>
                    <TableHead>{t('data.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ratings.map((rating) => {
                    const busy =
                      hideMutation.isPending && hideMutation.variables === rating.id
                        ? 'hide'
                        : restoreMutation.isPending && restoreMutation.variables === rating.id
                          ? 'restore'
                          : null;

                    return (
                      <TableRow key={rating.id}>
                        <TableCell className="font-medium">{rating.user.email}</TableCell>
                        <TableCell>{rating.safetyRating}</TableCell>
                        <TableCell>{rating.lifeRating}</TableCell>
                        <TableCell>{rating.foodRating}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={rating.isHidden ? 'outline' : 'secondary'}>
                              {rating.isHidden
                                ? t('schools.community.hidden')
                                : t('schools.community.visible')}
                            </Badge>
                            {rating.hiddenReason && (
                              <span className="text-xs text-muted-foreground">
                                {rating.hiddenReason}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(rating.updatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {rating.isHidden ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => restoreMutation.mutate(rating.id)}
                              disabled={busy != null}
                            >
                              {busy === 'restore' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                              {t('schools.community.restore')}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-destructive hover:text-destructive"
                              onClick={() => hideMutation.mutate(rating.id)}
                              disabled={busy != null}
                            >
                              {busy === 'hide' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ShieldOff className="h-3.5 w-3.5" />
                              )}
                              {t('schools.community.hide')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

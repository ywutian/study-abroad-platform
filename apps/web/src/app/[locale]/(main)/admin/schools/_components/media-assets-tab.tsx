'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Check, ImageIcon, Loader2, RefreshCw, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { schoolRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type MediaCoverage = {
  totalSchools: number;
  campusCover: {
    approvedPrimary: number;
    missingPrimary: number;
    candidate: number;
    pendingReview: number;
    failed: number;
    rejected: number;
  };
  logo: {
    approvedPrimary: number;
    candidate: number;
    pendingReview: number;
    failed: number;
  };
};

type SchoolMediaAsset = {
  id: string;
  type: 'LOGO' | 'CAMPUS_COVER';
  status: 'CANDIDATE' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FAILED' | 'ARCHIVED';
  sourceType: string;
  storageUrl?: string | null;
  originalUrl?: string | null;
  sourcePageUrl?: string | null;
  license?: string | null;
  attribution?: string | null;
  width?: number | null;
  height?: number | null;
  isPrimary: boolean;
  failureReason?: string | null;
  school: { id: string; name: string; nameZh?: string | null; website?: string | null };
};

const statusVariant: Record<
  SchoolMediaAsset['status'],
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  APPROVED: 'default',
  PENDING_REVIEW: 'secondary',
  CANDIDATE: 'outline',
  FAILED: 'destructive',
  REJECTED: 'destructive',
  ARCHIVED: 'outline',
};

export function MediaAssetsTab() {
  const t = useTranslations('admin.media');
  const queryClient = useQueryClient();

  const coverageQuery = useQuery({
    queryKey: ['schoolMediaCoverage'],
    queryFn: () => apiClient.get<MediaCoverage>(schoolRoutes.mediaCoverage()),
  });

  const assetsQuery = useQuery({
    queryKey: ['schoolMediaAssets'],
    queryFn: () =>
      apiClient.get<SchoolMediaAsset[]>(schoolRoutes.mediaAssets(), {
        params: { limit: '80', type: 'CAMPUS_COVER' },
      }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['schoolMediaCoverage'] });
    queryClient.invalidateQueries({ queryKey: ['schoolMediaAssets'] });
    queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
  };

  const discoverMutation = useMutation({
    mutationFn: () =>
      apiClient.post(schoolRoutes.mediaDiscover(), {
        limit: 100,
        source: 'official,wikimedia',
        dryRun: false,
      }),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for schoolMediaCoverage/schoolMediaAssets/adminSchools
      invalidate();
      toast.success(t('toast.discoveryQueued'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: (assetId: string) => apiClient.put(schoolRoutes.mediaApprove(assetId), {}),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for schoolMediaCoverage/schoolMediaAssets/adminSchools
      invalidate();
      toast.success(t('toast.approved'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (assetId: string) =>
      apiClient.put(schoolRoutes.mediaReject(assetId), { reason: 'Rejected from admin queue' }),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for schoolMediaCoverage/schoolMediaAssets/adminSchools
      invalidate();
      toast.success(t('toast.rejected'));
    },
  });

  const retryMutation = useMutation({
    mutationFn: (assetId: string) => apiClient.post(schoolRoutes.mediaRetry(assetId), {}),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for schoolMediaCoverage/schoolMediaAssets/adminSchools
      invalidate();
      toast.success(t('toast.retryCompleted'));
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (assetId: string) => apiClient.put(schoolRoutes.mediaSetPrimary(assetId), {}),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for schoolMediaCoverage/schoolMediaAssets/adminSchools
      invalidate();
      toast.success(t('toast.primaryUpdated'));
    },
  });

  const coverage = coverageQuery.data;
  const assets = Array.isArray(assetsQuery.data) ? assetsQuery.data : [];
  const isMutating =
    discoverMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    retryMutation.isPending ||
    setPrimaryMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('coverage.approvedCovers')}</CardTitle>
            <CardDescription>{t('coverage.approvedCoversDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {coverage?.campusCover?.approvedPrimary ?? 0}/{coverage?.totalSchools ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('coverage.pendingReview')}</CardTitle>
            <CardDescription>{t('coverage.pendingReviewDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {coverage?.campusCover?.pendingReview ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('coverage.candidates')}</CardTitle>
            <CardDescription>{t('coverage.candidatesDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {coverage?.campusCover?.candidate ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('coverage.missingCovers')}</CardTitle>
            <CardDescription>{t('coverage.missingCoversDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {coverage?.campusCover?.missingPrimary ?? 0}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              {t('review.title')}
            </CardTitle>
            <CardDescription>{t('review.description')}</CardDescription>
          </div>
          <Button variant="outline" onClick={() => discoverMutation.mutate()} disabled={isMutating}>
            {discoverMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t('actions.discover')}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.preview')}</TableHead>
                <TableHead>{t('table.school')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead>{t('table.source')}</TableHead>
                <TableHead>{t('table.audit')}</TableHead>
                <TableHead className="text-right">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => {
                const previewUrl = asset.storageUrl ?? asset.originalUrl;
                return (
                  <TableRow key={asset.id}>
                    <TableCell>
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={asset.school.name}
                          className="h-14 w-24 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-24 items-center justify-center rounded-md bg-muted">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{asset.school.name}</div>
                      {asset.width && asset.height && (
                        <div className="text-xs text-muted-foreground">
                          {asset.width} x {asset.height}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[asset.status]}>{asset.status}</Badge>
                      {asset.isPrimary && <Badge className="ml-2">{t('badges.primary')}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{asset.sourceType}</div>
                      {asset.sourcePageUrl && (
                        <a
                          href={asset.sourcePageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {t('links.sourcePage')}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-muted-foreground">
                      {asset.license && <div>{t('table.license', { license: asset.license })}</div>}
                      {asset.attribution && <div className="line-clamp-2">{asset.attribution}</div>}
                      {asset.failureReason && (
                        <div className="line-clamp-2 text-destructive">{asset.failureReason}</div>
                      )}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {asset.status !== 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveMutation.mutate(asset.id)}
                          disabled={isMutating}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {asset.status === 'APPROVED' && !asset.isPrimary && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPrimaryMutation.mutate(asset.id)}
                          disabled={isMutating}
                        >
                          {t('actions.setPrimary')}
                        </Button>
                      )}
                      {(asset.status === 'FAILED' || asset.status === 'CANDIDATE') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryMutation.mutate(asset.id)}
                          disabled={isMutating}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {asset.status !== 'REJECTED' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => rejectMutation.mutate(asset.id)}
                          disabled={isMutating}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

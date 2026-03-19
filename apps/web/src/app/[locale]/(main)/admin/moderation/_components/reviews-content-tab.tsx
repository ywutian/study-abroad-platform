'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Star, Eye, EyeOff, Trash2 } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  content: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  createdAt: string;
  reviewer: { email: string };
  profileUser?: { email: string };
}

interface ReviewsContentTabProps {
  pageSize: number;
  onDeleteRequest: (target: { type: string; id: string }) => void;
}

export function ReviewsContentTab({ pageSize, onDeleteRequest }: ReviewsContentTabProps) {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const queryClient = useQueryClient();

  const [reviewPage, setReviewPage] = useState(1);
  const [reviewStatus, setReviewStatus] = useState('ALL');

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['adminReviews', reviewStatus, reviewPage],
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(reviewPage),
        pageSize: String(pageSize),
      };
      if (reviewStatus !== 'ALL') params.status = reviewStatus;
      return apiClient.get<{ data: Review[]; total: number; totalPages: number }>(
        '/admin/reviews',
        { params }
      );
    },
  });

  const hideReviewMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/admin/reviews/${id}/hide`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReviews'] });
      toast.success(t('contentMod.reviewHidden'));
    },
  });

  const unhideReviewMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/admin/reviews/${id}/unhide`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReviews'] });
      toast.success(t('contentMod.reviewShown'));
    },
  });

  return (
    <div className="space-y-4">
      <Select
        value={reviewStatus}
        onValueChange={(v) => {
          setReviewStatus(v);
          setReviewPage(1);
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{t('contentMod.all')}</SelectItem>
          <SelectItem value="PUBLISHED">{t('contentMod.visible')}</SelectItem>
          <SelectItem value="HIDDEN">{t('contentMod.hidden')}</SelectItem>
        </SelectContent>
      </Select>

      {reviewsLoading ? (
        <ListSkeleton count={5} />
      ) : reviewsData?.data && reviewsData.data.length > 0 ? (
        <>
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('contentMod.reviewer')}</TableHead>
                    <TableHead>{t('contentMod.rating')}</TableHead>
                    <TableHead>{t('contentMod.content')}</TableHead>
                    <TableHead>{t('contentMod.status')}</TableHead>
                    <TableHead>{t('contentMod.createdAt')}</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewsData.data.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell className="text-muted-foreground">
                        {review.reviewer?.email}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          {review.rating}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        {review.content || '—'}
                      </TableCell>
                      <TableCell>
                        {review.status === 'HIDDEN' ? (
                          <Badge variant="secondary">{t('contentMod.hidden')}</Badge>
                        ) : (
                          <Badge variant="success">{t('contentMod.visible')}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmt.dateTime(new Date(review.createdAt), 'medium')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {review.status === 'HIDDEN' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => unhideReviewMutation.mutate(review.id)}
                              title={t('contentMod.unhideReview')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => hideReviewMutation.mutate(review.id)}
                              title={t('contentMod.hideReview')}
                            >
                              <EyeOff className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => onDeleteRequest({ type: 'review', id: review.id })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
          <PaginationControls
            page={reviewPage}
            totalPages={reviewsData.totalPages ?? 1}
            total={reviewsData.total ?? 0}
            pageSize={pageSize}
            onPageChange={setReviewPage}
          />
        </>
      ) : (
        <EmptyState
          icon={<Star className="h-12 w-12" />}
          title={t('contentMod.noReviews')}
          description={t('contentMod.noReviewsDesc')}
        />
      )}
    </div>
  );
}

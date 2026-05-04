/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { useRouter } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/stores/auth';
import { schoolListRoutes } from '@study-abroad/shared';
import { Bookmark, Share2, Link2 } from 'lucide-react';

interface SchoolBookmarkButtonProps {
  schoolId: string;
  canShare: boolean;
}

export function SchoolBookmarkButton({ schoolId, canShare }: SchoolBookmarkButtonProps) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, isInitialized } = useAuthStore();

  const { data: schoolListData } = useQuery({
    queryKey: ['school-lists'],
    queryFn: () => apiClient.get<any[]>(schoolListRoutes.list()),
    enabled: isInitialized && !!accessToken,
  });

  const bookmarkItem = schoolListData?.find((item: any) => item.schoolId === schoolId);
  const isBookmarked = !!bookmarkItem;

  const addBookmarkMutation = useMutation({
    mutationFn: ({
      schoolId: sid,
      tier = 'TARGET',
      round,
    }: {
      schoolId: string;
      tier?: string;
      round?: string;
    }) =>
      apiClient.post(schoolListRoutes.list(), {
        schoolId: sid,
        tier,
        ...(round && { round }),
      }),
    onSuccess: () => {
      toast.success(t('school.bookmarkAdded'));
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.info(t('school.alreadyBookmarked'));
      }
    },
    meta: { skipGlobalErrorToast: true },
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: (listItemId: string) => apiClient.delete(schoolListRoutes.byId(listItemId)),
    onSuccess: () => {
      toast.success(t('school.bookmarkRemoved'));
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
    },
  });

  const handleAddToList = (round: string) => {
    if (!accessToken) {
      toast.error(t('school.loginToBookmark'));
      router.push('/login');
      return;
    }
    addBookmarkMutation.mutate({ schoolId, round });
  };

  const handleBookmarkRemove = () => {
    if (bookmarkItem) removeBookmarkMutation.mutate(bookmarkItem.id);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t('school.linkCopied'));
    } catch {
      toast.error(t('school.copyFailed'));
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: document.title,
        url: window.location.href,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') toast.error(t('school.shareFailed'));
    }
  };

  return (
    <div className="flex gap-2">
      {isBookmarked ? (
        <Button
          variant="warning"
          size="sm"
          className="gap-2"
          onClick={handleBookmarkRemove}
          disabled={removeBookmarkMutation.isPending}
        >
          <Bookmark className="h-4 w-4 fill-current" />
          <span className="hidden sm:inline">{t('school.bookmarked')}</span>
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={addBookmarkMutation.isPending}
            >
              <Bookmark className="h-4 w-4" />
              <span className="hidden sm:inline">{t('school.bookmark')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'] as const).map((round) => (
              <DropdownMenuItem
                key={round}
                onClick={() => handleAddToList(round)}
                disabled={addBookmarkMutation.isPending}
              >
                {t('schools.rounds.' + round)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('school.share')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleCopyLink}>
            <Link2 className="mr-2 h-4 w-4" />
            {t('school.copyLink')}
          </DropdownMenuItem>
          {canShare && (
            <DropdownMenuItem onClick={handleNativeShare}>
              <Share2 className="mr-2 h-4 w-4" />
              {t('school.shareNative')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

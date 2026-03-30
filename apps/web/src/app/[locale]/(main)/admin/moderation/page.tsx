'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout';
import { apiClient } from '@/lib/api';
import { API_ROUTES } from '@study-abroad/shared';
import { toast } from 'sonner';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { ForumContentTab } from './_components/forum-content-tab';
import { ChatContentTab } from './_components/chat-content-tab';
import { ReviewsContentTab } from './_components/reviews-content-tab';
import { AiModerationTab } from './_components/ai-moderation-tab';
import { ReportsTab } from './_components/reports-tab';
import { ReviewStatisticsTab } from './_components/review-statistics-tab';

const PAGE_SIZE = 20;
const VALID_TABS = ['forum', 'chat', 'reviews', 'aiModeration', 'reports', 'statistics'] as const;
type ModerationTab = (typeof VALID_TABS)[number];

export default function AdminModerationPage() {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = VALID_TABS.includes(searchParams.get('tab') as ModerationTab)
    ? (searchParams.get('tab') as ModerationTab)
    : 'forum';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'forum') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(`/admin/moderation${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) => {
      switch (type) {
        case 'post':
          return apiClient.delete(`${API_ROUTES.ADMIN}/forums/posts/${id}`);
        case 'comment':
          return apiClient.delete(`${API_ROUTES.ADMIN}/forums/comments/${id}`);
        case 'message':
          return apiClient.delete(`${API_ROUTES.ADMIN}/chats/messages/${id}`);
        case 'review':
          return apiClient.delete(`${API_ROUTES.ADMIN}/reviews/${id}`);
        default:
          throw new Error('Unknown type');
      }
    },
    onSuccess: (_, { type }) => {
      setDeleteTarget(null);
      if (type === 'post') {
        queryClient.invalidateQueries({ queryKey: ['adminForumPosts'] });
        toast.success(t('contentMod.postDeleted'));
      } else if (type === 'message') {
        queryClient.invalidateQueries({ queryKey: ['adminChatMessages'] });
        toast.success(t('contentMod.messageDeleted'));
      } else if (type === 'review') {
        queryClient.invalidateQueries({ queryKey: ['adminReviews'] });
        toast.success(t('contentMod.reviewDeleted'));
      }
    },
  });

  return (
    <>
      <PageHeader
        title={t('contentMod.title')}
        description={t('contentMod.description')}
        icon={ShieldCheck}
        color="emerald"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList>
          <TabsTrigger value="forum">{t('contentMod.forum')}</TabsTrigger>
          <TabsTrigger value="chat">{t('contentMod.chat')}</TabsTrigger>
          <TabsTrigger value="reviews">{t('contentMod.reviews')}</TabsTrigger>
          <TabsTrigger value="aiModeration">{t('moderation.aiModeration')}</TabsTrigger>
          <TabsTrigger value="reports">{t('contentMod.reports')}</TabsTrigger>
          <TabsTrigger value="statistics">{t('reviewStats.title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="forum">
          <ForumContentTab pageSize={PAGE_SIZE} onDeleteRequest={setDeleteTarget} />
        </TabsContent>

        <TabsContent value="chat">
          <ChatContentTab pageSize={PAGE_SIZE} onDeleteRequest={setDeleteTarget} />
        </TabsContent>

        <TabsContent value="reviews">
          <ReviewsContentTab pageSize={PAGE_SIZE} onDeleteRequest={setDeleteTarget} />
        </TabsContent>

        <TabsContent value="aiModeration" className="space-y-4">
          <AiModerationTab />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>

        <TabsContent value="statistics">
          <ReviewStatisticsTab />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('contentMod.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('contentMod.confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('contentMod.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('contentMod.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

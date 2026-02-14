'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Search,
  Pin,
  Lock,
  Trash2,
  Loader2,
  MessageSquare,
  Star,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';

// Types
interface ForumPost {
  id: string;
  title: string;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  author: { email: string };
  category?: { name: string };
  _count?: { comments: number };
}

interface Conversation {
  id: string;
  createdAt: string;
  participants: { user: { email: string } }[];
  _count?: { messages: number };
}

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  sender: { email: string };
}

interface Review {
  id: string;
  rating: number;
  content: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  createdAt: string;
  reviewer: { email: string };
  profileUser?: { email: string };
}

export default function AdminContentPage() {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const queryClient = useQueryClient();

  // Forum state
  const [forumSearch, setForumSearch] = useState('');
  const [forumPage, setForumPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);

  // Chat state
  const [chatPage, setChatPage] = useState(1);
  const [chatSearch, setChatSearch] = useState('');
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [msgPage, setMsgPage] = useState(1);

  // Review state
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewStatus, setReviewStatus] = useState('ALL');

  const pageSize = 20;

  // === Forum Queries ===
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['adminForumPosts', forumSearch, forumPage],
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(forumPage),
        pageSize: String(pageSize),
      };
      if (forumSearch) params.search = forumSearch;
      return apiClient.get<{ data: ForumPost[]; total: number; totalPages: number }>(
        '/admin/forums/posts',
        { params }
      );
    },
  });

  const pinMutation = useMutation({
    mutationFn: (postId: string) => apiClient.put(`/admin/forums/posts/${postId}/pin`),
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: ['adminForumPosts'] });
      const post = postsData?.data.find((p) => p.id === postId);
      toast.success(post?.isPinned ? t('contentMod.postUnpinned') : t('contentMod.postPinned'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const lockMutation = useMutation({
    mutationFn: (postId: string) => apiClient.put(`/admin/forums/posts/${postId}/lock`),
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: ['adminForumPosts'] });
      const post = postsData?.data.find((p) => p.id === postId);
      toast.success(post?.isLocked ? t('contentMod.postUnlocked') : t('contentMod.postLocked'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // === Chat Queries ===
  const { data: convosData, isLoading: convosLoading } = useQuery({
    queryKey: ['adminChatConvos', chatSearch, chatPage],
    queryFn: () => {
      const params: Record<string, string> = { page: String(chatPage), pageSize: String(pageSize) };
      if (chatSearch) params.search = chatSearch;
      return apiClient.get<{ data: Conversation[]; total: number; totalPages: number }>(
        '/admin/chats/conversations',
        { params }
      );
    },
    enabled: !selectedConvo,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['adminChatMessages', selectedConvo, msgPage],
    queryFn: () =>
      apiClient.get<{ data: ChatMessage[]; total: number; totalPages: number }>(
        `/admin/chats/conversations/${selectedConvo}/messages`,
        { params: { page: String(msgPage), pageSize: String(pageSize) } }
      ),
    enabled: !!selectedConvo,
  });

  // === Review Queries ===
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
    onError: (error: Error) => toast.error(error.message),
  });

  const unhideReviewMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/admin/reviews/${id}/unhide`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReviews'] });
      toast.success(t('contentMod.reviewShown'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // === Delete Mutation (generic) ===
  const deleteMutation = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) => {
      switch (type) {
        case 'post':
          return apiClient.delete(`/admin/forums/posts/${id}`);
        case 'comment':
          return apiClient.delete(`/admin/forums/comments/${id}`);
        case 'message':
          return apiClient.delete(`/admin/chats/messages/${id}`);
        case 'review':
          return apiClient.delete(`/admin/reviews/${id}`);
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
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title={t('contentMod.title')}
        description={t('contentMod.description')}
        icon={ShieldCheck}
        color="emerald"
      />

      <Tabs defaultValue="forum" className="mt-6">
        <TabsList>
          <TabsTrigger value="forum">{t('contentMod.forum')}</TabsTrigger>
          <TabsTrigger value="chat">{t('contentMod.chat')}</TabsTrigger>
          <TabsTrigger value="reviews">{t('contentMod.reviews')}</TabsTrigger>
        </TabsList>

        {/* Forum Tab */}
        <TabsContent value="forum" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('contentMod.search')}
              value={forumSearch}
              onChange={(e) => {
                setForumSearch(e.target.value);
                setForumPage(1);
              }}
              className="pl-9"
            />
          </div>

          {postsLoading ? (
            <ListSkeleton count={5} />
          ) : postsData?.data && postsData.data.length > 0 ? (
            <>
              <Card>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>{t('contentMod.author')}</TableHead>
                        <TableHead>{t('contentMod.category')}</TableHead>
                        <TableHead>{t('contentMod.replies')}</TableHead>
                        <TableHead>{t('contentMod.status')}</TableHead>
                        <TableHead>{t('contentMod.createdAt')}</TableHead>
                        <TableHead className="w-[140px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {postsData.data.map((post) => (
                        <TableRow key={post.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {post.title}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {post.author?.email}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{post.category?.name ?? '—'}</Badge>
                          </TableCell>
                          <TableCell>{post._count?.comments ?? 0}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {post.isPinned && (
                                <Badge variant="info" className="gap-1">
                                  <Pin className="h-3 w-3" />
                                  {t('contentMod.pinned')}
                                </Badge>
                              )}
                              {post.isLocked && (
                                <Badge variant="warning" className="gap-1">
                                  <Lock className="h-3 w-3" />
                                  {t('contentMod.locked')}
                                </Badge>
                              )}
                              {!post.isPinned && !post.isLocked && '—'}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {fmt.dateTime(new Date(post.createdAt), 'medium')}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => pinMutation.mutate(post.id)}
                                title={post.isPinned ? t('contentMod.unpin') : t('contentMod.pin')}
                              >
                                <Pin
                                  className={`h-4 w-4 ${post.isPinned ? 'text-blue-500' : ''}`}
                                />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => lockMutation.mutate(post.id)}
                                title={
                                  post.isLocked ? t('contentMod.unlock') : t('contentMod.lock')
                                }
                              >
                                <Lock
                                  className={`h-4 w-4 ${post.isLocked ? 'text-amber-500' : ''}`}
                                />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleteTarget({ type: 'post', id: post.id })}
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
                page={forumPage}
                totalPages={postsData.totalPages ?? 1}
                total={postsData.total ?? 0}
                pageSize={pageSize}
                onPageChange={setForumPage}
              />
            </>
          ) : (
            <EmptyState
              icon={<MessageSquare className="h-12 w-12" />}
              title={t('contentMod.noPosts')}
              description={t('contentMod.noPostsDesc')}
            />
          )}
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-4">
          {selectedConvo ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedConvo(null);
                  setMsgPage(1);
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('contentMod.backToConversations')}
              </Button>

              {messagesLoading ? (
                <ListSkeleton count={5} />
              ) : messagesData?.data && messagesData.data.length > 0 ? (
                <>
                  <Card>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('contentMod.sender')}</TableHead>
                            <TableHead>{t('contentMod.content')}</TableHead>
                            <TableHead>{t('contentMod.sentAt')}</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {messagesData.data.map((msg) => (
                            <TableRow key={msg.id}>
                              <TableCell className="text-muted-foreground">
                                {msg.sender?.email}
                              </TableCell>
                              <TableCell className="max-w-[300px] truncate">
                                {msg.content}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {fmt.dateTime(new Date(msg.createdAt), 'medium')}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => setDeleteTarget({ type: 'message', id: msg.id })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                  <PaginationControls
                    page={msgPage}
                    totalPages={messagesData.totalPages ?? 1}
                    total={messagesData.total ?? 0}
                    pageSize={pageSize}
                    onPageChange={setMsgPage}
                  />
                </>
              ) : (
                <EmptyState
                  icon={<MessageSquare className="h-12 w-12" />}
                  title={t('contentMod.noMessages')}
                  description={t('contentMod.noMessagesDesc')}
                />
              )}
            </>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('contentMod.search')}
                  value={chatSearch}
                  onChange={(e) => {
                    setChatSearch(e.target.value);
                    setChatPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              {convosLoading ? (
                <ListSkeleton count={5} />
              ) : convosData?.data && convosData.data.length > 0 ? (
                <>
                  <Card>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('contentMod.participants')}</TableHead>
                            <TableHead>{t('contentMod.messages')}</TableHead>
                            <TableHead>{t('contentMod.createdAt')}</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {convosData.data.map((convo) => (
                            <TableRow key={convo.id}>
                              <TableCell>
                                {convo.participants
                                  ?.map((p) => p.user?.email)
                                  .filter(Boolean)
                                  .join(', ') || '—'}
                              </TableCell>
                              <TableCell>{convo._count?.messages ?? 0}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {fmt.dateTime(new Date(convo.createdAt), 'medium')}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedConvo(convo.id)}
                                >
                                  {t('contentMod.viewMessages')}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                  <PaginationControls
                    page={chatPage}
                    totalPages={convosData.totalPages ?? 1}
                    total={convosData.total ?? 0}
                    pageSize={pageSize}
                    onPageChange={setChatPage}
                  />
                </>
              ) : (
                <EmptyState
                  icon={<MessageSquare className="h-12 w-12" />}
                  title={t('contentMod.noConversations')}
                  description={t('contentMod.noConversationsDesc')}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
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
                                onClick={() => setDeleteTarget({ type: 'review', id: review.id })}
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

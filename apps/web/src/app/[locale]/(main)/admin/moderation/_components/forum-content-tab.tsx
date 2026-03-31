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
import { adminRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Pin, Lock, Trash2, MessageSquare, X } from 'lucide-react';

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

interface ForumContentTabProps {
  pageSize: number;
  onDeleteRequest: (target: { type: string; id: string }) => void;
}

export function ForumContentTab({ pageSize, onDeleteRequest }: ForumContentTabProps) {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const queryClient = useQueryClient();

  const [forumSearch, setForumSearch] = useState('');
  const [forumPage, setForumPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    mutationFn: (postId: string) => apiClient.put(adminRoutes.forumsPostPin(postId)),
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: ['adminForumPosts'] });
      const post = postsData?.data.find((p) => p.id === postId);
      toast.success(post?.isPinned ? t('contentMod.postUnpinned') : t('contentMod.postPinned'));
    },
  });

  const lockMutation = useMutation({
    mutationFn: (postId: string) => apiClient.put(adminRoutes.forumsPostLock(postId)),
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: ['adminForumPosts'] });
      const post = postsData?.data.find((p) => p.id === postId);
      toast.success(post?.isLocked ? t('contentMod.postUnlocked') : t('contentMod.postLocked'));
    },
  });

  const batchMutation = useMutation({
    mutationFn: (dto: { ids: string[]; action: string }) =>
      apiClient.post<{ success: number; failed: number }>(adminRoutes.forumsPostsBatch(), dto),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['adminForumPosts'] });
      setSelectedIds(new Set());
      toast.success(`${result.success} posts updated`);
    },
  });

  const toggleSelectAll = () => {
    if (!postsData?.data) return;
    if (selectedIds.size === postsData.data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(postsData.data.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
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
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => batchMutation.mutate({ ids: [...selectedIds], action: 'delete' })}
              >
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => batchMutation.mutate({ ids: [...selectedIds], action: 'lock' })}
              >
                <Lock className="mr-1 h-3 w-3" /> Lock
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => batchMutation.mutate({ ids: [...selectedIds], action: 'pin' })}
              >
                <Pin className="mr-1 h-3 w-3" /> Pin
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                <X className="mr-1 h-3 w-3" /> Clear
              </Button>
            </div>
          )}
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={postsData?.data && selectedIds.size === postsData.data.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
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
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(post.id)}
                          onCheckedChange={() => toggleSelect(post.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {post.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{post.author?.email}</TableCell>
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
                            <Pin className={`h-4 w-4 ${post.isPinned ? 'text-blue-500' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => lockMutation.mutate(post.id)}
                            title={post.isLocked ? t('contentMod.unlock') : t('contentMod.lock')}
                          >
                            <Lock className={`h-4 w-4 ${post.isLocked ? 'text-amber-500' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => onDeleteRequest({ type: 'post', id: post.id })}
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
    </div>
  );
}

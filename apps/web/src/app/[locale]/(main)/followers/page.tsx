'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/api-error';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { apiClient } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { RecommendedUsers, UserProfilePreview } from '@/components/features';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';
import { Users, Search, Shield, Loader2, UserCheck, Heart, X } from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import { UserCard, type User } from './_components/user-card';

interface FollowRelation {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
  follower?: User;
  following?: User;
}

interface BlockRelation {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
  blocked?: User;
}

export default function FollowersPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('followers');
  const [searchQuery, setSearchQuery] = useState('');
  const [userToUnfollow, setUserToUnfollow] = useState<string | null>(null);
  const [userToUnblock, setUserToUnblock] = useState<string | null>(null);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const { user } = useAuthStore();

  // ---- Data fetching ----
  const { data: followers = [], isLoading: followersLoading } = useQuery({
    queryKey: ['followers'],
    queryFn: () => apiClient.get<FollowRelation[]>('/chats/followers'),
    enabled: !!user,
  });

  const { data: following = [], isLoading: followingLoading } = useQuery({
    queryKey: ['following'],
    queryFn: () => apiClient.get<FollowRelation[]>('/chats/following'),
    enabled: !!user,
  });

  const { data: blocked = [], isLoading: blockedLoading } = useQuery({
    queryKey: ['blocked'],
    queryFn: () => apiClient.get<BlockRelation[]>('/chats/blocked'),
    enabled: !!user,
  });

  // ---- Mutations ----
  const followMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/chats/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      toast.success(t('followers.toast.followSuccess'));
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/chats/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following'] });
      setUserToUnfollow(null);
      toast.success(t('followers.toast.unfollowSuccess'));
    },
  });

  const _blockMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/chats/block/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked'] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      toast.success(t('followers.toast.blockSuccess'));
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/chats/block/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked'] });
      setUserToUnblock(null);
      toast.success(t('followers.toast.unblockSuccess'));
    },
  });

  const startConversation = async (userId: string) => {
    try {
      const conversation = await apiClient.post<{ id: string }>('/chats/conversations', { userId });
      router.push(`/chat?conversation=${conversation.id}`);
    } catch (error: unknown) {
      toast.error(
        error instanceof ApiError ? error.displayMessage : t('followers.toast.messageError')
      );
    }
  };

  // ---- Helpers ----
  const isFollowing = (userId: string) => following?.some((f) => f.following?.id === userId);

  const isMutualFollow = (userId: string) => {
    const userFollowsMe = followers?.some((f) => f.follower?.id === userId);
    const iFollowUser = following?.some((f) => f.following?.id === userId);
    return !!userFollowsMe && !!iFollowUser;
  };

  const filterBySearch = (user?: User) => {
    if (!searchQuery || !user) return true;
    const q = searchQuery.toLowerCase();
    return (
      (user.profile?.nickname?.toLowerCase() || '').includes(q) ||
      (user.email?.toLowerCase() || '').includes(q)
    );
  };

  // ---- Derived data ----
  const mutualCount = useMemo(
    () => followers?.filter((f) => isMutualFollow(f.follower?.id || '')).length || 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [followers, following]
  );

  const filteredFollowers = followers?.filter((f) => filterBySearch(f.follower)) || [];
  const filteredFollowing = following?.filter((f) => filterBySearch(f.following)) || [];
  const filteredBlocked = blocked?.filter((b) => filterBySearch(b.blocked)) || [];

  // ---- Tab counts ----
  const tabCounts: Record<string, number> = {
    followers: followers?.length || 0,
    following: following?.length || 0,
    blocked: blocked?.length || 0,
  };

  return (
    <PageContainer maxWidth="5xl">
      <PageHeader
        title={t('followers.title')}
        description={t('followers.description')}
        icon={Users}
        color="violet"
        stats={[
          {
            label: t('followers.tabs.followers'),
            value: String(followers?.length || 0),
            icon: Users,
          },
          {
            label: t('followers.tabs.following'),
            value: String(following?.length || 0),
            icon: Heart,
          },
          { label: t('followers.mutualFollow'), value: String(mutualCount), icon: UserCheck },
        ]}
      />

      {/* Recommended Users */}
      <RecommendedUsers className="mb-6" />

      {/* Tabs + Search */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <TabsList className="bg-muted/50 h-10">
            {(['followers', 'following', 'blocked'] as const).map((tab) => {
              const icons = { followers: Users, following: Heart, blocked: Shield };
              const Icon = icons[tab];
              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="gap-2 h-8 data-[state=active]:shadow-sm data-[state=active]:bg-background"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t(`followers.tabs.${tab}`)}</span>
                  {tabCounts[tab] > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold"
                    >
                      {tabCounts[tab]}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t('followers.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-8 h-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ---- Followers Tab ---- */}
        <TabsContent value="followers" className="mt-0">
          {followersLoading ? (
            <LoadingState variant="card" count={6} />
          ) : filteredFollowers.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {filteredFollowers.map((relation, index) => (
                  <motion.div
                    key={relation.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <UserCard
                      user={relation.follower}
                      relation={relation}
                      variant="follower"
                      isMutual={isMutualFollow(relation.follower?.id || '')}
                      isFollowingUser={isFollowing(relation.follower?.id || '')}
                      onPreview={() => setPreviewUserId(relation.follower?.id || '')}
                      onFollow={() => followMutation.mutate(relation.follower?.id || '')}
                      onMessage={() => startConversation(relation.follower?.id || '')}
                      followPending={followMutation.isPending}
                      t={t}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title={t('followers.empty.followers')}
              description={t('followers.empty.followersDesc')}
            />
          )}
        </TabsContent>

        {/* ---- Following Tab ---- */}
        <TabsContent value="following" className="mt-0">
          {followingLoading ? (
            <LoadingState variant="card" count={6} />
          ) : filteredFollowing.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {filteredFollowing.map((relation, index) => (
                  <motion.div
                    key={relation.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <UserCard
                      user={relation.following}
                      relation={relation}
                      variant="following"
                      isMutual={isMutualFollow(relation.following?.id || '')}
                      isFollowingUser={true}
                      onPreview={() => setPreviewUserId(relation.following?.id || '')}
                      onUnfollow={() => setUserToUnfollow(relation.following?.id || '')}
                      onMessage={() => startConversation(relation.following?.id || '')}
                      t={t}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyState
              icon={<Heart className="h-12 w-12" />}
              title={t('followers.empty.following')}
              description={t('followers.empty.followingDesc')}
            />
          )}
        </TabsContent>

        {/* ---- Blocked Tab ---- */}
        <TabsContent value="blocked" className="mt-0">
          {blockedLoading ? (
            <LoadingState variant="card" count={3} />
          ) : filteredBlocked.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {filteredBlocked.map((relation, index) => (
                  <motion.div
                    key={relation.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <UserCard
                      user={relation.blocked}
                      relation={relation}
                      variant="blocked"
                      isMutual={false}
                      isFollowingUser={false}
                      onPreview={() => setPreviewUserId(relation.blocked?.id || '')}
                      onUnblock={() => setUserToUnblock(relation.blocked?.id || '')}
                      t={t}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyState
              icon={<Shield className="h-12 w-12" />}
              title={t('followers.empty.blocked')}
              description={t('followers.empty.blockedDesc')}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ---- Dialogs ---- */}
      <AlertDialog open={!!userToUnfollow} onOpenChange={() => setUserToUnfollow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('followers.dialogs.unfollowTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('followers.dialogs.unfollowDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToUnfollow && unfollowMutation.mutate(userToUnfollow)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unfollowMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('followers.dialogs.unfollow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToUnblock} onOpenChange={() => setUserToUnblock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('followers.dialogs.unblockTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('followers.dialogs.unblockDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToUnblock && unblockMutation.mutate(userToUnblock)}
            >
              {unblockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('followers.dialogs.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Profile Preview */}
      <UserProfilePreview
        userId={previewUserId}
        open={!!previewUserId}
        onOpenChange={(open) => !open && setPreviewUserId(null)}
      />
    </PageContainer>
  );
}

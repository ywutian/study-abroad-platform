'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiClient } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { RecommendedUsers, UserProfilePreview } from '@/components/features';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  UserMinus,
  Search,
  MessageSquare,
  Shield,
  Loader2,
  UserCheck,
  Heart,
  Eye,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface UserProfile {
  nickname?: string;
  avatar?: string;
  bio?: string;
  targetMajor?: string;
}

interface User {
  id: string;
  email: string;
  role: string;
  profile?: UserProfile;
}

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

// ============================================================================
// User Card Component
// ============================================================================

function UserCard({
  user,
  relation,
  variant,
  isMutual,
  isFollowingUser,
  onPreview,
  onFollow,
  onUnfollow,
  onMessage,
  onUnblock,
  followPending,
  t,
}: {
  user?: User;
  relation: { id: string; createdAt: string };
  variant: 'follower' | 'following' | 'blocked';
  isMutual: boolean;
  isFollowingUser: boolean;
  onPreview: () => void;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onMessage?: () => void;
  onUnblock?: () => void;
  followPending?: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const displayName = user?.profile?.nickname || user?.email?.split('@')[0] || '';
  const avatarLetter = (user?.profile?.nickname?.[0] || user?.email?.[0] || '?').toUpperCase();
  const isBlocked = variant === 'blocked';

  const getRoleBadge = (role: string) => {
    if (role === 'ADMIN') return <Badge variant="purple">{t('common.administrator')}</Badge>;
    if (role === 'VERIFIED') return <Badge variant="success">{t('common.verified')}</Badge>;
    return null;
  };

  return (
    <Card
      className={cn(
        'group overflow-hidden border-border transition-all duration-200',
        !isBlocked && 'hover:shadow-md hover:border-primary/20',
        isBlocked && 'opacity-75'
      )}
    >
      <CardContent className="p-0">
        {/* Card body */}
        <div className="flex items-center gap-4 p-4">
          {/* Avatar - clickable for preview */}
          <button onClick={onPreview} className="shrink-0 focus:outline-none">
            <Avatar
              className={cn(
                'h-12 w-12 ring-2 ring-offset-2 ring-offset-background transition-all',
                variant === 'follower' && 'ring-primary/20 group-hover:ring-primary/40',
                variant === 'following' && 'ring-primary/20 group-hover:ring-primary/40',
                isBlocked && 'ring-muted grayscale'
              )}
            >
              {user?.profile?.avatar ? (
                <AvatarImage src={user.profile.avatar} className={cn(isBlocked && 'grayscale')} />
              ) : (
                <AvatarFallback
                  className={cn(
                    'font-semibold text-white',
                    !isBlocked && 'bg-gradient-to-br from-primary/80 to-primary',
                    isBlocked && 'bg-muted text-muted-foreground'
                  )}
                >
                  {avatarLetter}
                </AvatarFallback>
              )}
            </Avatar>
          </button>

          {/* User info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={onPreview}
                className={cn(
                  'font-semibold truncate text-left hover:underline',
                  isBlocked ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {displayName}
              </button>
              {isMutual && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <ArrowUpDown className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    </TooltipTrigger>
                    <TooltipContent>{t('followers.mutualFollow')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {!isBlocked && user?.profile?.bio && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{user.profile.bio}</p>
            )}

            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {!isBlocked && getRoleBadge(user?.role || '')}
              {isMutual && (
                <Badge
                  variant="secondary"
                  className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-0 text-[10px] px-1.5 py-0"
                >
                  <UserCheck className="h-2.5 w-2.5" />
                  {t('followers.mutualFollow')}
                </Badge>
              )}
              {isBlocked && (
                <Badge variant="destructive" className="gap-1 text-[10px]">
                  <Shield className="h-2.5 w-2.5" />
                  {t('followers.blocked')}
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isBlocked && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={onPreview}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('followers.userProfile')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Follow back button (for followers tab) */}
            {variant === 'follower' && !isFollowingUser && onFollow && (
              <Button
                size="sm"
                variant="default"
                className="h-8 gap-1.5 text-xs"
                onClick={onFollow}
                disabled={followPending}
              >
                {followPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                {t('followers.actions.follow')}
              </Button>
            )}

            {/* Message button (mutual follows) */}
            {!isBlocked && isMutual && onMessage && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:border-primary/30"
                      onClick={onMessage}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('followers.actions.sendMessage')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Unfollow button (for following tab) */}
            {variant === 'following' && onUnfollow && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={onUnfollow}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('followers.actions.unfollow')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Unblock button */}
            {isBlocked && onUnblock && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onUnblock}>
                {t('followers.unblock')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page
// ============================================================================

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
    onError: (error: Error) => toast.error(error.message),
  });

  const unfollowMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/chats/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following'] });
      setUserToUnfollow(null);
      toast.success(t('followers.toast.unfollowSuccess'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const _blockMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/chats/block/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked'] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      toast.success(t('followers.toast.blockSuccess'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/chats/block/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked'] });
      setUserToUnblock(null);
      toast.success(t('followers.toast.unblockSuccess'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

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
      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-600 text-white">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('followers.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('followers.description')}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            {
              label: t('followers.tabs.followers'),
              value: followers?.length || 0,
              icon: Users,
              accent: 'text-primary',
              bg: 'bg-primary/10',
            },
            {
              label: t('followers.tabs.following'),
              value: following?.length || 0,
              icon: Heart,
              accent: 'text-pink-600 dark:text-pink-400',
              bg: 'bg-pink-500/10',
            },
            {
              label: t('followers.mutualFollow'),
              value: mutualCount,
              icon: UserCheck,
              accent: 'text-green-600 dark:text-green-400',
              bg: 'bg-green-500/10',
            },
          ].map((stat) => (
            <Card key={stat.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.bg)}
                >
                  <stat.icon className={cn('h-5 w-5', stat.accent)} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

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
                      onMessage={() => router.push('/chat')}
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
                      onMessage={() => router.push('/chat')}
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

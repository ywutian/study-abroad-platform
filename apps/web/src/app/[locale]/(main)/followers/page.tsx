'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { PageContainer, PageHeader } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
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
} from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  role: string;
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

export default function FollowersPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('followers');
  const [searchQuery, setSearchQuery] = useState('');
  const [userToUnfollow, setUserToUnfollow] = useState<string | null>(null);
  const [userToUnblock, setUserToUnblock] = useState<string | null>(null);

  // Fetch followers
  const { data: followersData, isLoading: followersLoading } = useQuery({
    queryKey: ['followers'],
    queryFn: () => apiClient.get<{ success: boolean; data: FollowRelation[] }>('/chat/followers'),
  });
  const followers = followersData?.data || [];

  // Fetch following
  const { data: followingData, isLoading: followingLoading } = useQuery({
    queryKey: ['following'],
    queryFn: () => apiClient.get<{ success: boolean; data: FollowRelation[] }>('/chat/following'),
  });
  const following = followingData?.data || [];

  // Fetch blocked users
  const { data: blockedData, isLoading: blockedLoading } = useQuery({
    queryKey: ['blocked'],
    queryFn: () => apiClient.get<{ success: boolean; data: BlockRelation[] }>('/chat/blocked'),
  });
  const blocked = blockedData?.data || [];

  // Follow user mutation
  const followMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/chat/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      toast.success(t('followers.toast.followSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Unfollow user mutation
  const unfollowMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/chat/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following'] });
      setUserToUnfollow(null);
      toast.success(t('followers.toast.unfollowSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Block user mutation
  const blockMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/chat/block/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked'] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      toast.success(t('followers.toast.blockSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Unblock user mutation
  const unblockMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/chat/block/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked'] });
      setUserToUnblock(null);
      toast.success(t('followers.toast.unblockSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Check if user is being followed
  const isFollowing = (userId: string) => {
    return following?.some((f) => f.following?.id === userId);
  };

  // Check if user is mutual follow
  const isMutualFollow = (userId: string) => {
    const userFollowsMe = followers?.some((f) => f.follower?.id === userId);
    const iFollowUser = following?.some((f) => f.following?.id === userId);
    return userFollowsMe && iFollowUser;
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge variant="gradient-purple">{t('common.administrator')}</Badge>;
      case 'VERIFIED':
        return <Badge variant="gradient-success">{t('common.verified')}</Badge>;
      default:
        return null;
    }
  };

  const filterBySearch = (email: string) => {
    if (!searchQuery) return true;
    return email.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const tabConfig = [
    { value: 'followers', icon: Users, color: 'blue' },
    { value: 'following', icon: Heart, color: 'rose' },
    { value: 'blocked', icon: Shield, color: 'slate' },
  ];

  return (
    <PageContainer maxWidth="5xl">
      <PageHeader
        title={t('followers.title')}
        description={t('followers.description')}
        icon={Users}
        color="indigo"
        stats={[
          { label: t('followers.tabs.followers'), value: followers?.length || 0, icon: Users, color: 'text-blue-500' },
          { label: t('followers.tabs.following'), value: following?.length || 0, icon: Heart, color: 'text-rose-500' },
          { label: t('followers.mutualFollow'), value: followers?.filter(f => isMutualFollow(f.follower?.id || '')).length || 0, icon: UserCheck, color: 'text-emerald-500' },
        ]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <TabsList className="bg-muted/50">
            {tabConfig.map((tab) => {
              const TabIcon = tab.icon;
              const count = tab.value === 'followers' ? followers?.length : tab.value === 'following' ? following?.length : blocked?.length;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    'gap-2 data-[state=active]:shadow-sm',
                    tab.value === 'followers' && 'data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600',
                    tab.value === 'following' && 'data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-600',
                    tab.value === 'blocked' && 'data-[state=active]:bg-muted data-[state=active]:text-muted-foreground',
                  )}
                >
                  <TabIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t(`followers.tabs.${tab.value}`)}</span>
                  {count !== undefined && count > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">{count}</Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('followers.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Followers Tab */}
        <TabsContent value="followers" className="mt-0">
          {followersLoading ? (
            <LoadingState variant="card" count={6} />
          ) : followers && followers.filter((f) => filterBySearch(f.follower?.email || '')).length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {followers
                .filter((f) => filterBySearch(f.follower?.email || ''))
                .map((relation, index) => (
                  <motion.div
                    key={relation.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                      <CardContent className="flex items-center gap-4 p-4">
                        <Avatar className="h-12 w-12 border-2 border-blue-500/20">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-semibold">
                            {relation.follower?.email?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{relation.follower?.email?.split('@')[0]}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {getRoleBadge(relation.follower?.role || '')}
                            {isMutualFollow(relation.follower?.id || '') && (
                              <Badge variant="success" className="gap-1">
                                <UserCheck className="h-3 w-3" />
                                {t('followers.mutualFollow')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {!isFollowing(relation.follower?.id || '') && (
                            <Button
                              size="icon-sm"
                              variant="outline"
                              onClick={() => followMutation.mutate(relation.follower?.id || '')}
                              disabled={followMutation.isPending}
                              className="hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/30"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          )}
                          {isMutualFollow(relation.follower?.id || '') && (
                            <Button
                              size="icon-sm"
                              variant="outline"
                              onClick={() => router.push('/chat')}
                              className="hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title={t('followers.empty.followers')}
              description={t('followers.empty.followersDesc')}
            />
          )}
        </TabsContent>

        {/* Following Tab */}
        <TabsContent value="following" className="mt-0">
          {followingLoading ? (
            <LoadingState variant="card" count={6} />
          ) : following && following.filter((f) => filterBySearch(f.following?.email || '')).length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {following
                .filter((f) => filterBySearch(f.following?.email || ''))
                .map((relation, index) => (
                  <motion.div
                    key={relation.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
                      <CardContent className="flex items-center gap-4 p-4">
                        <Avatar className="h-12 w-12 border-2 border-rose-500/20">
                          <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-500 text-white font-semibold">
                            {relation.following?.email?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{relation.following?.email?.split('@')[0]}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {getRoleBadge(relation.following?.role || '')}
                            {isMutualFollow(relation.following?.id || '') && (
                              <Badge variant="success" className="gap-1">
                                <UserCheck className="h-3 w-3" />
                                {t('followers.mutualFollow')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {isMutualFollow(relation.following?.id || '') && (
                            <Button
                              size="icon-sm"
                              variant="outline"
                              onClick={() => router.push('/chat')}
                              className="hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon-sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                            onClick={() => setUserToUnfollow(relation.following?.id || '')}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
            </div>
          ) : (
            <EmptyState
              icon={<Heart className="h-12 w-12" />}
              title={t('followers.empty.following')}
              description={t('followers.empty.followingDesc')}
            />
          )}
        </TabsContent>

        {/* Blocked Tab */}
        <TabsContent value="blocked" className="mt-0">
          {blockedLoading ? (
            <LoadingState variant="card" count={3} />
          ) : blocked && blocked.filter((b) => filterBySearch(b.blocked?.email || '')).length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {blocked
                .filter((b) => filterBySearch(b.blocked?.email || ''))
                .map((relation, index) => (
                  <motion.div
                    key={relation.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="h-1 bg-gradient-to-r from-slate-500 to-gray-500" />
                      <CardContent className="flex items-center gap-4 p-4">
                        <Avatar className="h-12 w-12 opacity-60">
                          <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                            {relation.blocked?.email?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate text-muted-foreground">{relation.blocked?.email?.split('@')[0]}</p>
                          <Badge variant="destructive" className="mt-1">
                            <Shield className="h-3 w-3 mr-1" />
                            {t('followers.blocked')}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUserToUnblock(relation.blocked?.id || '')}
                        >
                          {t('followers.unblock')}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
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

      {/* Unfollow Confirmation */}
      <AlertDialog open={!!userToUnfollow} onOpenChange={() => setUserToUnfollow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('followers.dialogs.unfollowTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('followers.dialogs.unfollowDesc')}
            </AlertDialogDescription>
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

      {/* Unblock Confirmation */}
      <AlertDialog open={!!userToUnblock} onOpenChange={() => setUserToUnblock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('followers.dialogs.unblockTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('followers.dialogs.unblockDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => userToUnblock && unblockMutation.mutate(userToUnblock)}>
              {unblockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('followers.dialogs.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

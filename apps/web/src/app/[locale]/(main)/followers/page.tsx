'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  UserX,
  Search,
  MessageSquare,
  Shield,
  Loader2,
} from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';

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
  const { data: followers, isLoading: followersLoading } = useQuery({
    queryKey: ['followers'],
    queryFn: () => apiClient.get<FollowRelation[]>('/chat/followers'),
  });

  // Fetch following
  const { data: following, isLoading: followingLoading } = useQuery({
    queryKey: ['following'],
    queryFn: () => apiClient.get<FollowRelation[]>('/chat/following'),
  });

  // Fetch blocked users
  const { data: blocked, isLoading: blockedLoading } = useQuery({
    queryKey: ['blocked'],
    queryFn: () => apiClient.get<BlockRelation[]>('/chat/blocked'),
  });

  // Follow user mutation
  const followMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/chat/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      toast.success('关注成功');
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
      toast.success('已取消关注');
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
      toast.success('已拉黑');
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
      toast.success('已解除拉黑');
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
        return <Badge variant="destructive">管理员</Badge>;
      case 'VERIFIED':
        return <Badge variant="default">已认证</Badge>;
      default:
        return null;
    }
  };

  const filterBySearch = (email: string) => {
    if (!searchQuery) return true;
    return email.toLowerCase().includes(searchQuery.toLowerCase());
  };

  return (
    <PageContainer>
      <PageHeader
        title="关注管理"
        description="管理您的关注列表、粉丝和黑名单"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="followers" className="gap-2">
            <Users className="h-4 w-4" />
            粉丝
            {followers && <Badge variant="secondary">{followers.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="following" className="gap-2">
            <UserPlus className="h-4 w-4" />
            关注
            {following && <Badge variant="secondary">{following.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="blocked" className="gap-2">
            <Shield className="h-4 w-4" />
            黑名单
            {blocked && blocked.length > 0 && <Badge variant="destructive">{blocked.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索用户..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Followers Tab */}
        <TabsContent value="followers">
          {followersLoading ? (
            <LoadingState variant="card" count={3} />
          ) : followers && followers.filter((f) => filterBySearch(f.follower?.email || '')).length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {followers
                .filter((f) => filterBySearch(f.follower?.email || ''))
                .map((relation) => (
                  <Card key={relation.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {relation.follower?.email?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{relation.follower?.email}</p>
                        <div className="flex items-center gap-2">
                          {getRoleBadge(relation.follower?.role || '')}
                          {isMutualFollow(relation.follower?.id || '') && (
                            <Badge variant="outline">互相关注</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {!isFollowing(relation.follower?.id || '') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => followMutation.mutate(relation.follower?.id || '')}
                            disabled={followMutation.isPending}
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        )}
                        {isMutualFollow(relation.follower?.id || '') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push('/chat')}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="暂无粉丝"
              description="分享您的档案，吸引更多关注"
            />
          )}
        </TabsContent>

        {/* Following Tab */}
        <TabsContent value="following">
          {followingLoading ? (
            <LoadingState variant="card" count={3} />
          ) : following && following.filter((f) => filterBySearch(f.following?.email || '')).length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {following
                .filter((f) => filterBySearch(f.following?.email || ''))
                .map((relation) => (
                  <Card key={relation.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {relation.following?.email?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{relation.following?.email}</p>
                        <div className="flex items-center gap-2">
                          {getRoleBadge(relation.following?.role || '')}
                          {isMutualFollow(relation.following?.id || '') && (
                            <Badge variant="outline">互相关注</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {isMutualFollow(relation.following?.id || '') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push('/chat')}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setUserToUnfollow(relation.following?.id || '')}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <EmptyState
              icon={<UserPlus className="h-12 w-12" />}
              title="暂未关注任何人"
              description="在功能大厅发现优秀的申请者"
            />
          )}
        </TabsContent>

        {/* Blocked Tab */}
        <TabsContent value="blocked">
          {blockedLoading ? (
            <LoadingState variant="card" count={3} />
          ) : blocked && blocked.filter((b) => filterBySearch(b.blocked?.email || '')).length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {blocked
                .filter((b) => filterBySearch(b.blocked?.email || ''))
                .map((relation) => (
                  <Card key={relation.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-muted text-muted-foreground">
                          {relation.blocked?.email?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{relation.blocked?.email}</p>
                        <p className="text-xs text-muted-foreground">已拉黑</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setUserToUnblock(relation.blocked?.id || '')}
                      >
                        解除
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <EmptyState
              icon={<Shield className="h-12 w-12" />}
              title="黑名单为空"
              description="您没有拉黑任何用户"
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Unfollow Confirmation */}
      <AlertDialog open={!!userToUnfollow} onOpenChange={() => setUserToUnfollow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消关注？</AlertDialogTitle>
            <AlertDialogDescription>
              取消关注后，如果对方也取消关注您，你们将无法私聊。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToUnfollow && unfollowMutation.mutate(userToUnfollow)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unfollowMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              取消关注
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unblock Confirmation */}
      <AlertDialog open={!!userToUnblock} onOpenChange={() => setUserToUnblock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认解除拉黑？</AlertDialogTitle>
            <AlertDialogDescription>
              解除后，该用户可以再次关注您并发送消息。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => userToUnblock && unblockMutation.mutate(userToUnblock)}>
              {unblockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认解除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}





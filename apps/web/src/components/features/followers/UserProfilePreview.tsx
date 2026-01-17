'use client';

import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  UserPlus,
  UserMinus,
  MessageSquare,
  BadgeCheck,
  GraduationCap,
  Target,
  BookOpen,
  BarChart,
  Users,
  Loader2,
  Shield,
} from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';

interface UserProfilePreviewProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  profile?: {
    targetMajor?: string;
    grade?: string;
    gpa?: number;
    gpaScale?: number;
    visibility?: string;
    _count?: {
      testScores: number;
      activities: number;
      awards: number;
      targetSchools: number;
    };
  };
  _count?: {
    followers: number;
    following: number;
    admissionCases: number;
  };
  isFollowing?: boolean;
  isFollowedBy?: boolean;
}

export function UserProfilePreview({ userId, open, onOpenChange }: UserProfilePreviewProps) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user-preview', userId],
    queryFn: async () => {
      // 获取用户基本信息和档案
      // apiClient 已自动解包 { success, data } -> data
      const [userData, following, followers] = await Promise.all([
        apiClient.get<UserProfile>(`/hall/profiles/${userId}`),
        apiClient.get<any[]>('/chat/following'),
        apiClient.get<any[]>('/chat/followers'),
      ]);

      return {
        ...userData,
        isFollowing: following?.some((f: any) => f.following?.id === userId),
        isFollowedBy: followers?.some((f: any) => f.follower?.id === userId),
      };
    },
    enabled: !!userId && open,
  });

  const followMutation = useMutation({
    mutationFn: () => apiClient.post(`/chat/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preview', userId] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['recommended-users'] });
      toast.success(t('followers.toast.followSuccess'));
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => apiClient.delete(`/chat/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preview', userId] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      toast.success(t('followers.toast.unfollowSuccess'));
    },
  });

  const isMutualFollow = user?.isFollowing && user?.isFollowedBy;

  // 计算档案完整度
  const calculateCompleteness = () => {
    if (!user?.profile) return 0;
    const counts = user.profile._count || {
      testScores: 0,
      activities: 0,
      awards: 0,
      targetSchools: 0,
    };
    let score = 0;
    if (user.profile.targetMajor) score += 20;
    if (user.profile.gpa) score += 20;
    if (counts.testScores > 0) score += 20;
    if (counts.activities > 0) score += 20;
    if (counts.awards > 0) score += 10;
    if (counts.targetSchools > 0) score += 10;
    return score;
  };

  const handleStartChat = () => {
    onOpenChange(false);
    router.push('/chat');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{t('followers.userProfile')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* 头部 - 头像和基本信息 */}
              <div className="text-center space-y-3">
                <div className="relative mx-auto w-fit">
                  <Avatar className="h-20 w-20 border-4 border-background shadow-xl">
                    <AvatarFallback
                      className={cn(
                        'text-2xl font-bold text-white',
                        user.role === 'VERIFIED' ? 'bg-success' : 'bg-primary'
                      )}
                    >
                      {user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {user.role === 'VERIFIED' && (
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1.5 shadow-lg">
                      <BadgeCheck className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-bold">{user.email.split('@')[0]}</h3>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {user.role === 'VERIFIED' && (
                      <Badge variant="success" className="gap-1">
                        <BadgeCheck className="h-3 w-3" />
                        {t('followers.verified')}
                      </Badge>
                    )}
                    {isMutualFollow && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-emerald-600 border-emerald-500/30"
                      >
                        <Users className="h-3 w-3" />
                        {t('followers.mutual')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* 统计数据 */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-blue-600">
                    {user._count?.followers || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('followers.followers')}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-rose-600">
                    {user._count?.following || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('followers.following')}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-amber-600">
                    {user._count?.admissionCases || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('followers.cases')}</div>
                </div>
              </div>

              {/* 档案信息 */}
              {user.profile && user.profile.visibility !== 'PRIVATE' && (
                <div className="space-y-3 rounded-xl bg-muted/50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('followers.profileCompleteness')}
                    </span>
                    <span className="font-medium">{calculateCompleteness()}%</span>
                  </div>
                  <Progress value={calculateCompleteness()} className="h-2" />

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {user.profile.targetMajor && (
                      <div className="flex items-center gap-2 text-sm">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{user.profile.targetMajor}</span>
                      </div>
                    )}
                    {user.profile.grade && (
                      <div className="flex items-center gap-2 text-sm">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span>{user.profile.grade}</span>
                      </div>
                    )}
                    {user.profile.gpa && (
                      <div className="flex items-center gap-2 text-sm">
                        <BarChart className="h-4 w-4 text-muted-foreground" />
                        <span>
                          GPA {user.profile.gpa}/{user.profile.gpaScale || 4.0}
                        </span>
                      </div>
                    )}
                    {user.profile._count && user.profile._count.activities > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {t('followers.activities', { count: user.profile._count.activities })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3">
                {user.isFollowing ? (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => unfollowMutation.mutate()}
                    disabled={unfollowMutation.isPending}
                  >
                    {unfollowMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserMinus className="h-4 w-4 mr-2" />
                        {t('followers.actions.unfollow')}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-primary hover:opacity-90"
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                  >
                    {followMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        {t('followers.actions.follow')}
                      </>
                    )}
                  </Button>
                )}

                {isMutualFollow && (
                  <Button variant="outline" className="flex-1" onClick={handleStartChat}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {t('followers.actions.sendMessage')}
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t('followers.loadError')}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

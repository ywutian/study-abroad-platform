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
  Heart,
  FileText,
  Loader2,
  Shield,
  ArrowUpDown,
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
    nickname?: string;
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
      const [userData, following, followers] = await Promise.all([
        apiClient.get<UserProfile>(`/halls/profiles/${userId}`),
        apiClient.get<any[]>('/chats/following'),
        apiClient.get<any[]>('/chats/followers'),
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
    mutationFn: () => apiClient.post(`/chats/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preview', userId] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['recommended-users'] });
      toast.success(t('followers.toast.followSuccess'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unfollowMutation = useMutation({
    mutationFn: () => apiClient.delete(`/chats/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preview', userId] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      toast.success(t('followers.toast.unfollowSuccess'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const isMutualFollow = user?.isFollowing && user?.isFollowedBy;
  const displayName = user?.profile?.nickname || user?.email?.split('@')[0] || '';

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

  const completeness = calculateCompleteness();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{t('followers.userProfile')}</DialogTitle>
            </DialogHeader>

            {/* Top gradient banner */}
            <div className="h-20 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />

            <div className="px-6 pb-6 -mt-10 space-y-5">
              {/* Avatar & Name */}
              <div className="text-center space-y-3">
                <div className="relative mx-auto w-fit">
                  <Avatar className="h-20 w-20 ring-4 ring-background shadow-lg">
                    <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-2xl font-bold text-white">
                      {(user.profile?.nickname?.[0] || user.email[0]).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {user.role === 'VERIFIED' && (
                    <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 ring-2 ring-background">
                      <BadgeCheck className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-foreground">{displayName}</h3>
                  <div className="flex items-center justify-center gap-2 mt-1.5">
                    {user.role === 'VERIFIED' && (
                      <Badge variant="success" className="gap-1 text-[10px]">
                        <BadgeCheck className="h-3 w-3" />
                        {t('followers.verified')}
                      </Badge>
                    )}
                    {isMutualFollow && (
                      <Badge
                        variant="secondary"
                        className="gap-1 text-[10px] bg-green-500/10 text-green-700 dark:text-green-400 border-0"
                      >
                        <ArrowUpDown className="h-3 w-3" />
                        {t('followers.mutual')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/50 p-3">
                {[
                  {
                    value: user._count?.followers || 0,
                    label: t('followers.followers'),
                    icon: Users,
                    accent: 'text-primary',
                  },
                  {
                    value: user._count?.following || 0,
                    label: t('followers.following'),
                    icon: Heart,
                    accent: 'text-pink-600 dark:text-pink-400',
                  },
                  {
                    value: user._count?.admissionCases || 0,
                    label: t('followers.cases'),
                    icon: FileText,
                    accent: 'text-amber-600 dark:text-amber-400',
                  },
                ].map((stat) => (
                  <div key={stat.label} className="text-center py-1">
                    <div className={cn('text-xl font-bold', stat.accent)}>{stat.value}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Profile details */}
              {user.profile && user.profile.visibility !== 'PRIVATE' && (
                <div className="space-y-3 rounded-xl bg-muted/30 border border-border p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('followers.profileCompleteness')}
                    </span>
                    <span className="font-medium text-foreground">{completeness}%</span>
                  </div>
                  <Progress value={completeness} className="h-1.5" />

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    {user.profile.targetMajor && (
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{user.profile.targetMajor}</span>
                      </div>
                    )}
                    {user.profile.grade && (
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{user.profile.grade}</span>
                      </div>
                    )}
                    {user.profile.gpa && (
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <BarChart className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>
                          GPA {user.profile.gpa}/{user.profile.gpaScale || 4.0}
                        </span>
                      </div>
                    )}
                    {user.profile._count && user.profile._count.activities > 0 && (
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>
                          {t('followers.activities', { count: user.profile._count.activities })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2.5">
                {user.isFollowing ? (
                  <Button
                    variant="outline"
                    className="flex-1 h-10"
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
                    className="flex-1 h-10"
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
                  <Button variant="outline" className="flex-1 h-10" onClick={handleStartChat}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {t('followers.actions.sendMessage')}
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
              <Shield className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('followers.loadError')}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

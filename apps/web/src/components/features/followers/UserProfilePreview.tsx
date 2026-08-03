/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { qk } from '@/lib/query';
import { ApiError } from '@/lib/api/api-error';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { chatRoutes, type SocialUser } from '@study-abroad/shared';
import {
  UserPlus,
  UserMinus,
  MessageSquare,
  BadgeCheck,
  GraduationCap,
  Target,
  Users,
  Heart,
  FileText,
  Loader2,
  Shield,
  ArrowUpDown,
} from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';

interface UserProfilePreviewProps {
  user: (SocialUser & { isFollowing?: boolean; isFollowedBy?: boolean }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfilePreview({ user, open, onOpenChange }: UserProfilePreviewProps) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const followMutation = useMutation({
    mutationFn: () => apiClient.post(chatRoutes.follow(userId!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.social.following() });
      queryClient.invalidateQueries({ queryKey: qk.social.followers() });
      queryClient.invalidateQueries({ queryKey: qk.social.recommended() });
      toast.success(t('followers.toast.followSuccess'));
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => apiClient.delete(chatRoutes.follow(userId!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.social.following() });
      queryClient.invalidateQueries({ queryKey: qk.social.followers() });
      toast.success(t('followers.toast.unfollowSuccess'));
    },
  });

  const isMutualFollow = user?.isFollowing && user?.isFollowedBy;
  const displayName = user?.profile?.nickname || user?.email?.split('@')[0] || '';

  const handleStartChat = async () => {
    try {
      const conversation = await apiClient.post<{ id: string }>(chatRoutes.conversations(), {
        userId,
      });
      onOpenChange(false);
      router.push(`/chat?conversation=${conversation.id}`);
    } catch (error: unknown) {
      toast.error(
        error instanceof ApiError ? error.displayMessage : t('followers.toast.messageError')
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {user ? (
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
                    <AvatarImage src={user.profile?.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-2xl font-bold text-white">
                      {(user.profile?.nickname?.[0] || user.email?.[0] || '?').toUpperCase()}
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
                      <Badge variant="success" className="gap-1 text-2xs">
                        <BadgeCheck className="h-3 w-3" />
                        {t('followers.verified')}
                      </Badge>
                    )}
                    {isMutualFollow && (
                      <Badge
                        variant="secondary"
                        className="gap-1 text-2xs bg-green-500/10 text-green-700 dark:text-green-400 border-0"
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
                    value: user.stats.followers,
                    label: t('followers.followers'),
                    icon: Users,
                    accent: 'text-primary',
                  },
                  {
                    value: user.stats.following,
                    label: t('followers.following'),
                    icon: Heart,
                    accent: 'text-pink-600 dark:text-pink-400',
                  },
                  {
                    value: user.stats.cases,
                    label: t('followers.cases'),
                    icon: FileText,
                    accent: 'text-amber-600 dark:text-amber-400',
                  },
                ].map((stat) => (
                  <div key={stat.label} className="text-center py-1">
                    <div className={cn('text-xl font-bold', stat.accent)}>{stat.value}</div>
                    <div className="text-2xs text-muted-foreground mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Profile details */}
              {user.profile && (
                <div className="space-y-3 rounded-xl bg-muted/30 border border-border p-4">
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
                  </div>
                  {user.profile.bio && (
                    <p className="text-sm text-muted-foreground">{user.profile.bio}</p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2.5">
                {user.isFollowing ? (
                  <Button
                    variant="outline"
                    aria-label={t('followers.actions.unfollow')}
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
                    aria-label={t('followers.actions.follow')}
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

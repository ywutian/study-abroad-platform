'use client';

import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  UserPlus,
  Sparkles,
  BadgeCheck,
  GraduationCap,
  Users,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface RecommendedUser {
  id: string;
  email: string;
  role: string;
  profile?: {
    targetMajor?: string;
    grade?: string;
    visibility?: string;
    completeness?: {
      testScores: number;
      activities: number;
      awards: number;
    };
  };
  stats?: {
    followers: number;
    cases: number;
  };
}

interface RecommendedUsersProps {
  className?: string;
}

export function RecommendedUsers({ className }: RecommendedUsersProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const {
    data: users,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['recommended-users'],
    queryFn: () => apiClient.get<RecommendedUser[]>('/chat/recommendations?limit=8'),
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/chat/follow/${userId}`),
    onSuccess: (_, userId) => {
      // 从推荐列表中移除已关注的用户
      queryClient.setQueryData(['recommended-users'], (old: RecommendedUser[] | undefined) =>
        old?.filter((u) => u.id !== userId)
      );
      queryClient.invalidateQueries({ queryKey: ['following'] });
      toast.success(t('followers.toast.followSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardContent className="p-6">
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-44 shrink-0 animate-pulse">
                <div className="h-48 bg-muted rounded-xl" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!users || users.length === 0) {
    return null;
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="h-1 bg-primary" />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('followers.recommended.title')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t('followers.recommended.description')}</p>
      </CardHeader>
      <CardContent className="pb-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-2">
            {users.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="w-44 shrink-0"
              >
                <Card className="h-full overflow-hidden border-2 hover:border-violet-500/30 transition-colors">
                  <div
                    className={cn('h-1', user.role === 'VERIFIED' ? 'bg-success' : 'bg-gray-400')}
                  />
                  <CardContent className="p-4 text-center space-y-3">
                    {/* Avatar */}
                    <div className="relative mx-auto w-fit">
                      <Avatar className="h-16 w-16 border-2 border-violet-500/20 shadow-lg">
                        <AvatarFallback className="bg-primary dark:bg-primary text-white text-xl font-bold">
                          {user.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {user.role === 'VERIFIED' && (
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1">
                          <BadgeCheck className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Name & Badge */}
                    <div>
                      <p className="font-semibold truncate">{user.email.split('@')[0]}</p>
                      {user.role === 'VERIFIED' && (
                        <Badge variant="success" className="mt-1 text-xs">
                          {t('verification.status.verified')}
                        </Badge>
                      )}
                    </div>

                    {/* Info */}
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {user.profile?.targetMajor && (
                        <div className="flex items-center justify-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{user.profile.targetMajor}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-3">
                        {user.stats && user.stats.followers > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            {user.stats.followers}
                          </span>
                        )}
                        {user.stats && user.stats.cases > 0 && (
                          <span className="flex items-center gap-0.5">
                            <FileText className="h-3 w-3" />
                            {user.stats.cases}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Follow Button */}
                    <Button
                      size="sm"
                      className="w-full bg-primary dark:bg-primary hover:opacity-90"
                      onClick={() => followMutation.mutate(user.id)}
                      disabled={followMutation.isPending}
                    >
                      {followMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-1" />
                          {t('followers.follow')}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

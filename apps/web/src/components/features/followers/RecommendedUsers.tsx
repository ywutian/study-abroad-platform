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
    queryFn: () => apiClient.get<RecommendedUser[]>('/chats/recommendations?limit=8'),
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/chats/follow/${userId}`),
    onSuccess: (_, userId) => {
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
      <Card className={cn('overflow-hidden border-border', className)}>
        <CardContent className="p-6">
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-40 shrink-0 animate-pulse">
                <div className="h-44 bg-muted rounded-xl" />
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
    <Card className={cn('overflow-hidden border-border', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            {t('followers.recommended.title')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground pl-9">
          {t('followers.recommended.description')}
        </p>
      </CardHeader>
      <CardContent className="pb-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-2">
            {users.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.04 }}
                className="w-40 shrink-0"
              >
                <Card className="h-full overflow-hidden border-border hover:border-primary/30 hover:shadow-sm transition-all duration-200">
                  <CardContent className="p-3.5 text-center space-y-2.5">
                    {/* Avatar */}
                    <div className="relative mx-auto w-fit">
                      <Avatar className="h-14 w-14 ring-2 ring-offset-2 ring-offset-background ring-primary/20">
                        <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-white text-lg font-bold">
                          {user.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {user.role === 'VERIFIED' && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full p-0.5 ring-2 ring-background">
                          <BadgeCheck className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Name & Badge */}
                    <div>
                      <p className="font-semibold text-sm truncate text-foreground">
                        {user.email.split('@')[0]}
                      </p>
                      {user.role === 'VERIFIED' && (
                        <Badge variant="success" className="mt-1 text-[10px] px-1.5 py-0">
                          {t('verification.status.verified')}
                        </Badge>
                      )}
                    </div>

                    {/* Info */}
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      {user.profile?.targetMajor && (
                        <div className="flex items-center justify-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          <span className="truncate max-w-[110px]">{user.profile.targetMajor}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-2.5">
                        {user.stats && user.stats.followers > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Users className="h-2.5 w-2.5" />
                            {user.stats.followers}
                          </span>
                        )}
                        {user.stats && user.stats.cases > 0 && (
                          <span className="flex items-center gap-0.5">
                            <FileText className="h-2.5 w-2.5" />
                            {user.stats.cases}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Follow Button */}
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={() => followMutation.mutate(user.id)}
                      disabled={followMutation.isPending}
                    >
                      {followMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
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

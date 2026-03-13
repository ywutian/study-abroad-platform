'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  UserPlus,
  UserMinus,
  MessageSquare,
  Shield,
  Loader2,
  UserCheck,
  Eye,
  ArrowUpDown,
} from 'lucide-react';

interface UserProfile {
  nickname?: string;
  avatar?: string;
  bio?: string;
  targetMajor?: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
  profile?: UserProfile;
}

interface UserCardProps {
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
  t: (key: string) => string;
}

export function UserCard({
  user,
  relation: _relation,
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
}: UserCardProps) {
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

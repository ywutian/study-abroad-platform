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
    if (role === 'SUPER_ADMIN') return <Badge variant="purple">{t('common.superAdmin')}</Badge>;
    if (role === 'ADMIN') return <Badge variant="purple">{t('common.administrator')}</Badge>;
    if (role === 'OPERATOR') return <Badge variant="warning">{t('common.operator')}</Badge>;
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
          <button
            type="button"
            aria-label={`${t('followers.userProfile')}: ${displayName}`}
            onClick={onPreview}
            className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
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
                    'font-semibold text-primary-foreground',
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
                type="button"
                aria-label={`${t('followers.userProfile')}: ${displayName}`}
                onClick={onPreview}
                className={cn(
                  'min-h-10 truncate rounded text-left font-semibold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-6',
                  isBlocked ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {displayName}
              </button>
              {isMutual && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex h-5 w-5 items-center justify-center">
                        <ArrowUpDown className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      </span>
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
                  className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-0 text-2xs px-1.5 py-0"
                >
                  <UserCheck className="h-2.5 w-2.5" />
                  {t('followers.mutualFollow')}
                </Badge>
              )}
              {isBlocked && (
                <Badge variant="destructive" className="gap-1 text-2xs">
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
                      aria-label={`${t('followers.userProfile')}: ${displayName}`}
                      className="h-10 w-10 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
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
                aria-label={t('followers.actions.follow')}
                className="h-10 gap-1.5 text-xs sm:h-8"
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
                      aria-label={t('followers.actions.sendMessage')}
                      className="h-10 w-10 text-muted-foreground hover:border-primary/30 hover:text-primary sm:h-8 sm:w-8"
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
                      aria-label={t('followers.actions.unfollow')}
                      className="h-10 w-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-8 sm:w-8"
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
              <Button
                size="sm"
                variant="outline"
                className="h-10 text-xs sm:h-8"
                onClick={onUnblock}
              >
                {t('followers.unblock')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

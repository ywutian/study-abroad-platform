'use client';

import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { VerificationIcon } from '@/components/features';

interface UserProfileCardProps {
  user: {
    id: string;
    email?: string;
    role?: string;
    profile?: {
      nickname?: string;
      realName?: string;
      avatarUrl?: string;
      bio?: string;
      targetMajor?: string;
    };
  };
  children: React.ReactNode;
}

export function UserProfileCard({ user, children }: UserProfileCardProps) {
  const t = useTranslations('chat');
  const displayName = user.profile?.nickname || user.profile?.realName || user.email || '?';

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" side="right" align="start">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-background shadow">
              <AvatarImage src={user.profile?.avatarUrl} />
              <AvatarFallback className="bg-primary text-white font-medium">
                {displayName[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate flex items-center gap-1">
                {displayName}
                {user.role === 'VERIFIED' && <VerificationIcon verified size="sm" />}
              </p>
              {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
            </div>
          </div>

          {user.profile?.targetMajor && (
            <div className="text-sm">
              <span className="text-muted-foreground">{t('targetMajor')}: </span>
              <span className="font-medium">{user.profile.targetMajor}</span>
            </div>
          )}

          {user.profile?.bio && (
            <p className="text-sm text-muted-foreground line-clamp-3">{user.profile.bio}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

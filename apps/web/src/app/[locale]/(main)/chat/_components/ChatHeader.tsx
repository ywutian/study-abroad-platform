'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserProfileCard, VerificationIcon } from '@/components/features';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowLeft, MoreVertical, Flag, Ban, Pin } from 'lucide-react';
import type { Conversation } from './types';
import { getDisplayName } from './utils';

interface ChatHeaderProps {
  selectedUser: Conversation['otherUser'];
  isOnline: boolean;
  isPinned: boolean;
  onBack: () => void;
  onPin: () => void;
  onReport: () => void;
  onBlock: () => void;
}

export function ChatHeader({
  selectedUser,
  isOnline,
  isPinned,
  onBack,
  onPin,
  onReport,
  onBlock,
}: ChatHeaderProps) {
  const t = useTranslations();

  return (
    <div className="border-b px-4 py-3 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onBack}
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {selectedUser && (
            <UserProfileCard user={selectedUser}>
              <div className="relative cursor-pointer">
                <Avatar className="h-10 w-10 border-2 border-background shadow">
                  <AvatarImage src={selectedUser.profile?.avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-br bg-primary text-white font-medium">
                    {getDisplayName(selectedUser)?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background',
                    isOnline ? 'bg-emerald-500' : 'bg-gray-400'
                  )}
                  aria-hidden="true"
                />
                <span className="sr-only">{isOnline ? t('chat.online') : t('chat.offline')}</span>
              </div>
            </UserProfileCard>
          )}
          <div>
            <p className="font-medium flex items-center gap-1">
              {getDisplayName(selectedUser)}
              {selectedUser?.role === 'VERIFIED' && <VerificationIcon verified size="sm" />}
            </p>
            <p className={cn('text-xs', isOnline ? 'text-emerald-500' : 'text-muted-foreground')}>
              {isOnline ? t('chat.online') : t('chat.offline')}
            </p>
          </div>
        </div>

        {/* 操作菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('common.more')}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onPin} className="gap-2">
              <Pin className="h-4 w-4" />
              {isPinned ? t('chat.unpinConversation') : t('chat.pinConversation')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReport} className="gap-2">
              <Flag className="h-4 w-4" />
              {t('chat.reportUser')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onBlock}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Ban className="h-4 w-4" />
              {t('chat.blockUser')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

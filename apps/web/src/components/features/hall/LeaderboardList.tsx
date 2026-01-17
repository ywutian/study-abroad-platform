'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trophy, Medal, Award, Crown, User } from 'lucide-react';
import { BadgeDisplay, SwipeBadge } from './BadgeDisplay';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName?: string;
  accuracy: number;
  totalSwipes: number;
  correctCount: number;
  badge: SwipeBadge;
  isCurrentUser: boolean;
}

interface LeaderboardListProps {
  entries: LeaderboardEntry[];
  currentUserEntry?: LeaderboardEntry;
  className?: string;
}

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return null;
  }
}

function getRankBgClass(rank: number) {
  switch (rank) {
    case 1:
      return 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30';
    case 2:
      return 'bg-gradient-to-r from-gray-300/10 to-gray-400/10 border-gray-400/30';
    case 3:
      return 'bg-gradient-to-r from-amber-600/10 to-orange-500/10 border-amber-600/30';
    default:
      return 'bg-muted/50';
  }
}

interface LeaderboardItemProps {
  entry: LeaderboardEntry;
  index: number;
}

function LeaderboardItem({ entry, index }: LeaderboardItemProps) {
  const t = useTranslations('hall.leaderboard');
  const rankIcon = getRankIcon(entry.rank);
  const bgClass = entry.rank <= 3 ? getRankBgClass(entry.rank) : '';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
        bgClass,
        entry.isCurrentUser && 'ring-2 ring-primary/50 bg-primary/5'
      )}
    >
      {/* Rank */}
      <div className="w-8 h-8 flex items-center justify-center shrink-0">
        {rankIcon || (
          <span
            className={cn(
              'text-lg font-bold',
              entry.rank <= 10 ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {entry.rank}
          </span>
        )}
      </div>

      {/* Badge */}
      <BadgeDisplay badge={entry.badge} size="sm" animated={false} />

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium truncate', entry.isCurrentUser && 'text-primary')}>
            {entry.userName || t('userFallback', { id: entry.userId.slice(-4) })}
          </span>
          {entry.isCurrentUser && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {t('you')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('correct', { count: entry.correctCount })}</span>
          <span>·</span>
          <span>{t('predictions', { count: entry.totalSwipes })}</span>
        </div>
      </div>

      {/* Accuracy with mini bar */}
      <div className="text-right shrink-0 w-16">
        <p
          className={cn(
            'text-lg font-bold tabular-nums',
            entry.accuracy >= 70
              ? 'text-emerald-500'
              : entry.accuracy >= 50
                ? 'text-amber-500'
                : 'text-muted-foreground'
          )}
        >
          {entry.accuracy}%
        </p>
        {/* Mini accuracy bar */}
        <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              entry.accuracy >= 70
                ? 'bg-emerald-500'
                : entry.accuracy >= 50
                  ? 'bg-amber-500'
                  : 'bg-muted-foreground/50'
            )}
            style={{ width: `${Math.min(entry.accuracy, 100)}%` }}
          />
        </div>
        <p className="text-2xs text-muted-foreground mt-0.5">{t('accuracy')}</p>
      </div>
    </motion.div>
  );
}

export function LeaderboardList({ entries, currentUserEntry, className }: LeaderboardListProps) {
  const t = useTranslations('hall.leaderboard');
  const showCurrentUserSeparately = currentUserEntry && !entries.some((e) => e.isCurrentUser);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="h-1.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-amber-500" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {entries.length === 0 ? (
          <div className="text-center py-8">
            <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">{t('empty')}</p>
            <p className="text-sm text-muted-foreground/80">{t('emptyDesc', { count: 10 })}</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {entries.map((entry, index) => (
                <LeaderboardItem key={entry.userId} entry={entry} index={index} />
              ))}
            </div>

            {/* Current user entry if not in top list */}
            {showCurrentUserSeparately && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">{t('yourRank')}</p>
                <LeaderboardItem entry={currentUserEntry} index={0} />
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

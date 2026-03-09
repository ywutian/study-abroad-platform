'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, getSchoolName } from '@/lib/utils';

export interface TeamCardData {
  id: string;
  name: string;
  description?: string | null;
  visibility: string;
  joinPolicy: string;
  maxMembers?: number | null;
  schoolId?: string | null;
  school?: { id: string; name: string; nameZh?: string | null } | null;
  tags?: string[] | null;
  creatorId: string;
  memberCount: number;
  createdAt: string;
}

interface TeamCardProps {
  team: TeamCardData;
  locale: string;
  showJoin?: boolean;
  isMember?: boolean;
  onJoinClick?: () => void;
  className?: string;
}

export function TeamCard({
  team,
  locale,
  showJoin = false,
  isMember = false,
  onJoinClick,
  className,
}: TeamCardProps) {
  const t = useTranslations('teams');
  const schoolName = team.school ? getSchoolName(team.school, locale) : null;
  const countLabel =
    team.maxMembers != null
      ? t('memberCount', { current: team.memberCount, max: team.maxMembers })
      : `${team.memberCount}`;

  return (
    <Card
      className={cn(
        'overflow-hidden transition-shadow hover:shadow-md border-border/50',
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link href={`/teams/${team.id}`} className="block focus:outline-none">
                <h3 className="font-semibold text-title truncate">{team.name}</h3>
              </Link>
              {schoolName && (
                <p className="text-caption text-muted-foreground truncate mt-0.5">{schoolName}</p>
              )}
            </div>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {team.joinPolicy === 'OPEN' ? t('joinPolicy.open') : t('joinPolicy.inviteOnly')}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-muted-foreground">{countLabel}</span>
            <div className="flex items-center gap-1">
              <Link href={`/teams/${team.id}`}>
                <Button variant="ghost" size="sm">
                  {t('view')}
                </Button>
              </Link>
              {showJoin && !isMember && onJoinClick && (
                <Button size="sm" onClick={onJoinClick}>
                  {t('join')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

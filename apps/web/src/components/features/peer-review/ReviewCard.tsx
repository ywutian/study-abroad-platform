'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RatingDisplay } from './RatingDisplay';
import { BadgeCheck, User } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';

interface ReviewUser {
  id: string;
  name?: string;
  avatar?: string;
  isVerified: boolean;
}

interface ReviewCardProps {
  reviewer: ReviewUser;
  profileScore?: number;
  helpfulScore?: number;
  responseScore?: number;
  overallScore?: number;
  comment?: string;
  isAnonymous: boolean;
  createdAt: string;
}

export function ReviewCard({
  reviewer,
  profileScore,
  helpfulScore,
  responseScore,
  overallScore,
  comment,
  isAnonymous,
  createdAt,
}: ReviewCardProps) {
  const t = useTranslations('peerReview');
  const locale = useLocale();
  const dateLocale = locale === 'zh' ? zhCN : enUS;

  const avgScore = overallScore || 0;

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardContent className="pt-4">
        <div className="flex items-start gap-4">
          {/* Reviewer Info */}
          <Avatar className="h-10 w-10 border">
            {isAnonymous ? (
              <AvatarFallback className="bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </AvatarFallback>
            ) : reviewer.avatar ? (
              <AvatarImage src={reviewer.avatar} alt={reviewer.name || ''} />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary">
                {reviewer.name?.[0] || '?'}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">
                {isAnonymous ? t('anonymous') : reviewer.name || t('anonymous')}
              </span>
              {!isAnonymous && reviewer.isVerified && (
                <BadgeCheck className="h-4 w-4 text-emerald-500" />
              )}
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(createdAt), {
                  addSuffix: true,
                  locale: dateLocale,
                })}
              </span>
            </div>

            {/* Overall Rating */}
            <div className="mt-2">
              <RatingDisplay rating={avgScore} size="sm" />
            </div>

            {/* Detailed Scores */}
            {(profileScore || helpfulScore || responseScore) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {profileScore && (
                  <Badge variant="outline" className="text-xs">
                    {t('profileScore')}: {profileScore}
                  </Badge>
                )}
                {helpfulScore && (
                  <Badge variant="outline" className="text-xs">
                    {t('helpfulScore')}: {helpfulScore}
                  </Badge>
                )}
                {responseScore && (
                  <Badge variant="outline" className="text-xs">
                    {t('responseScore')}: {responseScore}
                  </Badge>
                )}
              </div>
            )}

            {/* Comment */}
            {comment && (
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{comment}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CountBadge } from '@/components/ui/count-badge';
import { TouchCard } from '@/components/ui/touch-card';
import { BadgeCheck, Trophy } from 'lucide-react';
import {
  getResultBarColor,
  getResultBadgeClass,
  getResultLabel,
  VERIFIED_BADGE_CLASS,
} from '@/lib/utils/admission';

type CaseResult = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';

interface CaseCardProps {
  schoolName: string;
  year: number;
  round?: string;
  major?: string;
  result: CaseResult;
  gpa?: string;
  sat?: string;
  toefl?: string;
  tags?: string[];
  rank?: number;
  isVerified?: boolean;
  className?: string;
  onClick?: () => void;
}

const MAX_VISIBLE_TAGS = 3;

export function CaseCard({
  schoolName,
  year,
  round = 'RD',
  major,
  result,
  gpa,
  sat,
  toefl,
  tags,
  rank,
  isVerified = false,
  className,
  onClick,
}: CaseCardProps) {
  const t = useTranslations('cases');
  const tc = useTranslations('common');

  const barColor = getResultBarColor(result);
  const badgeClass = getResultBadgeClass(result);
  const resultLabel = getResultLabel(result, (key: string) => t(key));

  const visibleTags = tags?.slice(0, MAX_VISIBLE_TAGS) || [];
  const overflowCount = tags ? tags.length - MAX_VISIBLE_TAGS : 0;

  return (
    <TouchCard
      className={cn('overflow-hidden', className)}
      onClick={onClick}
      enableTilt={false}
      variant="default"
    >
      {/* ── 顶部结果颜色条 ── */}
      <div className={cn('h-1', barColor)} />

      <div className="p-4 pb-3">
        {/* ── Header: 学校 + 排名 + 结果 ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-sm">{schoolName}</h3>
              {rank && (
                <Badge className="shrink-0 gap-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs px-1.5 py-0">
                  <Trophy className="h-3 w-3" />#{rank}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {year} · {round} · {major || tc('notSpecified')}
            </p>
          </div>
          <Badge variant="outline" className={cn('shrink-0 text-xs', badgeClass)}>
            {resultLabel}
          </Badge>
        </div>
      </div>

      {/* ── Body: 分数 + 标签 ── */}
      <div className="px-4 pb-4 pt-0 space-y-3">
        {/* 分数行 */}
        {(gpa || sat || toefl) && (
          <div className="flex gap-3 text-xs">
            {gpa && (
              <div>
                <span className="text-muted-foreground">GPA</span>{' '}
                <span className="font-semibold">{gpa}</span>
              </div>
            )}
            {sat && (
              <div>
                <span className="text-muted-foreground">SAT</span>{' '}
                <span className="font-semibold">{sat}</span>
              </div>
            )}
            {toefl && (
              <div>
                <span className="text-muted-foreground">TOEFL</span>{' '}
                <span className="font-semibold">{toefl}</span>
              </div>
            )}
          </div>
        )}

        {/* 标签 + 认证 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {isVerified && (
            <Badge
              variant="outline"
              className={cn('gap-0.5 text-xs px-1.5 py-0', VERIFIED_BADGE_CLASS)}
            >
              <BadgeCheck className="h-3 w-3" />
            </Badge>
          )}
          {visibleTags.map((tag, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {overflowCount > 0 && (
            <CountBadge
              count={overflowCount}
              size="sm"
              className="bg-muted text-muted-foreground"
            />
          )}
        </div>
      </div>
    </TouchCard>
  );
}

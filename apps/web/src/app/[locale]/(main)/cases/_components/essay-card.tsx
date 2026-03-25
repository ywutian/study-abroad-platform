/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { motion } from 'framer-motion';
import { FileText, CheckCircle2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { cn, getSchoolName } from '@/lib/utils';
import {
  getResultBarColor,
  getResultBadgeClass,
  getEssayTypeBadgeClass,
  VERIFIED_BADGE_CLASS,
} from '@/lib/utils/admission';
import { type SchoolRanking } from '@/lib/utils/ranking';

export interface GalleryEssay {
  id: string;
  year: number;
  result: string;
  essayType?: string;
  promptNumber?: number;
  prompt: string | null;
  preview: string | null;
  wordCount: number;
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
    rankings?: SchoolRanking[];
  } | null;
  tags: string[];
  isVerified: boolean;
}

interface EssayCardProps {
  essay: GalleryEssay;
  index: number;
  onClick: () => void;
  getResultLabel: (result: string) => string;
  getTypeLabel: (type?: string) => string;
  locale: string;
  t: any;
}

export function EssayCard({
  essay,
  index,
  onClick,
  getResultLabel,
  getTypeLabel,
  locale,
  t,
}: EssayCardProps) {
  const barColor = getResultBarColor(essay.result);
  const resultBadgeClass = getResultBadgeClass(essay.result);
  const typeBadgeClass = essay.essayType ? getEssayTypeBadgeClass(essay.essayType) : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.32) }}
    >
      <Card
        className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
        onClick={onClick}
      >
        <div className={cn('h-1', barColor)} />
        <CardContent className="pt-3 pb-3">
          {/* School + Result */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-semibold text-sm truncate">
                {getSchoolName(essay.school, locale) || t('unknownSchool')}
              </h3>
              <RankingBadge
                rankings={essay.school?.rankings}
                usNewsRank={essay.school?.usNewsRank}
                variant="amber"
                className="text-[10px] h-5"
              />
            </div>
            <Badge className={cn('shrink-0 text-[11px]', resultBadgeClass)}>
              {getResultLabel(essay.result)}
            </Badge>
          </div>

          {/* Type + Year */}
          <div className="flex items-center gap-1.5 mb-2">
            {essay.essayType && (
              <Badge variant="outline" className={cn('text-[10px] h-5', typeBadgeClass)}>
                {getTypeLabel(essay.essayType)}
                {essay.promptNumber && ` #${essay.promptNumber}`}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{essay.year}</span>
          </div>

          {/* Preview */}
          {essay.preview && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
              {essay.preview}
            </p>
          )}

          {/* Footer: word count + verified */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {t('wordCount', { count: essay.wordCount })}
            </span>
            {essay.isVerified && (
              <Badge
                variant="secondary"
                className={cn('gap-0.5 text-[10px] px-1.5 py-0', VERIFIED_BADGE_CLASS)}
              >
                <CheckCircle2 className="h-3 w-3" />
                {t('detail.verified')}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

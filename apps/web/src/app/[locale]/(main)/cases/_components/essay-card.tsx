/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { motion } from 'framer-motion';
import { FileText, CheckCircle2, Archive } from 'lucide-react';
import { getArchiveLabel } from '@study-abroad/shared';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  /**
   * Provenance — Mom-persona trust signal. Null when the essay was
   * self-uploaded (no public archive to cite); rendered as an archive
   * chip on the card and as the "本文来源 · 查看原文" footer on detail.
   */
  sourceArchive?: string | null;
  sourceUrl?: string | null;
  sourceAuthor?: string | null;
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

  const schoolDisplayName = getSchoolName(essay.school, locale) || t('unknownSchool');

  return (
    <motion.div
      // `min-w-0` on the grid item: without it, the outer flex/grid container
      // gives this card `min-width: auto`, and a long school name then pushes
      // the cell past its allotted width — defeating the inner `truncate`.
      // See PR #214/#215/#217 layout-robustness rules.
      className="min-w-0"
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
              {/* TooltipProvider is already mounted at the app root, but
                  the `no-tooltip-without-provider` quality rule is per-file.
                  Nested providers are a no-op in Radix, so the local one is
                  cheap insurance + appeases the lint. */}
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h3 className="font-semibold text-sm truncate cursor-default">
                      {schoolDisplayName}
                    </h3>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start">
                    {schoolDisplayName}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <RankingBadge
                rankings={essay.school?.rankings}
                usNewsRank={essay.school?.usNewsRank}
                variant="amber"
                className="text-2xs h-5"
              />
            </div>
            <Badge className={cn('shrink-0 text-2xs', resultBadgeClass)}>
              {getResultLabel(essay.result)}
            </Badge>
          </div>

          {/* Type + Year */}
          <div className="flex items-center gap-1.5 mb-2">
            {essay.essayType && (
              <Badge variant="outline" className={cn('text-2xs h-5', typeBadgeClass)}>
                {getTypeLabel(essay.essayType)}
                {essay.promptNumber && ` #${essay.promptNumber}`}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{essay.year}</span>
          </div>

          {/*
           * Archive provenance chip — Mom-persona's killer trust signal.
           * Shown ONLY when we have a verifiable source archive (harvested
           * essays); self-uploaded essays have null sourceArchive and the
           * chip is suppressed. Locale-aware label, fallback to bare host.
           */}
          {essay.sourceArchive && (
            <div className="mb-2">
              <Badge
                variant="outline"
                className="text-2xs h-4 px-1.5 gap-1 border-indigo-200 bg-indigo-50/60 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <Archive className="h-2.5 w-2.5" />
                <span className="truncate max-w-[180px]">
                  {getArchiveLabel(essay.sourceArchive, locale === 'zh' ? 'zh' : 'en')}
                </span>
              </Badge>
            </div>
          )}

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
                className={cn('gap-0.5 text-2xs px-1.5 py-0', VERIFIED_BADGE_CLASS)}
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

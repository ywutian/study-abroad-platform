'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lightbulb, PencilLine, ArrowRight, PenTool, RefreshCw, Copy, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import type {
  Essay,
  EssayReview,
  PolishResult,
  RewriteResult,
  ContinueResult,
  OpeningResult,
} from '@/types/essay';

const AIScoreRadar = dynamic(
  () => import('@/components/features/essay-ai').then((m) => ({ default: m.AIScoreRadar })),
  { ssr: false }
);
const ScoreDetailList = dynamic(
  () => import('@/components/features/essay-ai').then((m) => ({ default: m.ScoreDetailList })),
  { ssr: false }
);

interface EssayAIDialogsProps {
  selectedEssay: Essay | null;

  // Review
  isReviewOpen: boolean;
  setIsReviewOpen: (open: boolean) => void;
  reviewResult: EssayReview | null;
  derivedScores: { originality: number; impact: number; relevance: number } | null;
  onReReview: () => void;

  // Polish
  isPolishOpen: boolean;
  setIsPolishOpen: (open: boolean) => void;
  polishResult: PolishResult | null;
  onApplyPolish: () => void;

  // Continue
  isContinueOpen: boolean;
  setIsContinueOpen: (open: boolean) => void;
  continueResult: ContinueResult | null;
  onAppendContinuation: () => void;

  // Opening
  isOpeningOpen: boolean;
  setIsOpeningOpen: (open: boolean) => void;
  openingResult: OpeningResult | null;

  // Rewrite
  isRewriteOpen: boolean;
  setIsRewriteOpen: (open: boolean) => void;
  rewriteResult: RewriteResult | null;

  // Shared
  copiedIndex: number | null;
  onCopyToClipboard: (text: string, index: number) => void;
}

export function EssayAIDialogs({
  isReviewOpen,
  setIsReviewOpen,
  reviewResult,
  derivedScores,
  onReReview,
  isPolishOpen,
  setIsPolishOpen,
  polishResult,
  onApplyPolish,
  isContinueOpen,
  setIsContinueOpen,
  continueResult,
  onAppendContinuation,
  isOpeningOpen,
  setIsOpeningOpen,
  openingResult,
  isRewriteOpen,
  setIsRewriteOpen,
  rewriteResult,
  copiedIndex,
  onCopyToClipboard,
}: EssayAIDialogsProps) {
  const t = useTranslations();

  return (
    <>
      {/* AI Review Result Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              {t('essays.dialog.reviewTitle')}
            </DialogTitle>
            <DialogDescription>{t('essayAi.review.description')}</DialogDescription>
          </DialogHeader>

          {reviewResult && (
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="radar" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="radar">{t('essayAi.radar.title')}</TabsTrigger>
                  <TabsTrigger value="details">{t('essays.tabs.details')}</TabsTrigger>
                  <TabsTrigger value="suggestions">{t('essayAi.review.suggestions')}</TabsTrigger>
                </TabsList>

                <TabsContent value="radar" className="flex-1 mt-4">
                  <div className="flex justify-center py-4">
                    <AIScoreRadar
                      scores={[
                        {
                          key: 'clarity',
                          label: t('essayAi.radar.dimensions.clarity'),
                          score: reviewResult.scores?.clarity ?? reviewResult.content?.score ?? 0,
                          maxScore: 10,
                        },
                        {
                          key: 'uniqueness',
                          label: t('essayAi.radar.dimensions.originality'),
                          score: reviewResult.scores?.uniqueness ?? derivedScores?.originality ?? 0,
                          maxScore: 10,
                        },
                        {
                          key: 'storytelling',
                          label: t('essayAi.radar.dimensions.structure'),
                          score:
                            reviewResult.scores?.storytelling ?? reviewResult.structure?.score ?? 0,
                          maxScore: 10,
                        },
                        {
                          key: 'authenticity',
                          label: t('essayAi.radar.dimensions.authenticity'),
                          score: reviewResult.scores?.authenticity ?? 0,
                          maxScore: 10,
                        },
                        {
                          key: 'language',
                          label: t('essayAi.radar.dimensions.language'),
                          score: reviewResult.scores?.language ?? reviewResult.language?.score ?? 0,
                          maxScore: 10,
                        },
                      ]}
                      overallScore={reviewResult.overallScore}
                      size="md"
                      animated
                    />
                  </div>
                </TabsContent>

                <TabsContent value="details" className="flex-1 mt-4">
                  <ScrollArea className="h-[350px] pr-4">
                    <ScoreDetailList
                      scores={[
                        {
                          key: 'clarity',
                          label: t('essayAi.radar.dimensions.clarity'),
                          score: reviewResult.scores?.clarity ?? reviewResult.content?.score ?? 0,
                          maxScore: 10,
                        },
                        {
                          key: 'uniqueness',
                          label: t('essayAi.radar.dimensions.originality'),
                          score: reviewResult.scores?.uniqueness ?? 0,
                          maxScore: 10,
                        },
                        {
                          key: 'storytelling',
                          label: t('essayAi.radar.dimensions.structure'),
                          score:
                            reviewResult.scores?.storytelling ?? reviewResult.structure?.score ?? 0,
                          maxScore: 10,
                        },
                        {
                          key: 'authenticity',
                          label: t('essayAi.radar.dimensions.authenticity'),
                          score: reviewResult.scores?.authenticity ?? 0,
                          maxScore: 10,
                        },
                        {
                          key: 'language',
                          label: t('essayAi.radar.dimensions.language'),
                          score: reviewResult.scores?.language ?? reviewResult.language?.score ?? 0,
                          maxScore: 10,
                        },
                      ]}
                    />
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="suggestions" className="flex-1 mt-4">
                  <ScrollArea className="h-[350px] pr-4">
                    <div className="space-y-4">
                      {reviewResult.suggestions?.length > 0 && (
                        <div className="space-y-3">
                          {reviewResult.suggestions.map((suggestion, i) => (
                            <motion.div
                              key={i}
                              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                            >
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {i + 1}
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {suggestion}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* Cliché Detection */}
                      {reviewResult.cliches && reviewResult.cliches.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {t('essayAi.review.cliches')}
                          </p>
                          {reviewResult.cliches.map((cliche, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5"
                            >
                              <p className="text-sm line-through text-muted-foreground">
                                {cliche.text}
                              </p>
                              <p className="text-sm text-foreground">→ {cliche.suggestion}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {!reviewResult.suggestions?.length && !reviewResult.cliches?.length && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                          <Check className="h-12 w-12 text-emerald-500 mb-4" />
                          <p className="text-lg font-semibold">
                            {t('essays.review.noSuggestions')}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t('essays.review.excellentWork')}
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onReReview}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('essayAi.review.newReview')}
            </Button>
            <Button onClick={() => setIsReviewOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Polish Result Dialog */}
      <Dialog open={isPolishOpen} onOpenChange={setIsPolishOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilLine className="h-5 w-5 text-primary" />
              {t('essays.dialog.polishTitle')}
            </DialogTitle>
            <DialogDescription>{t('essays.dialog.polishDesc')}</DialogDescription>
          </DialogHeader>

          {polishResult && (
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="result" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="result">{t('essays.tabs.polishedResult')}</TabsTrigger>
                  <TabsTrigger value="changes">
                    {t('essays.tabs.changeComparison')} ({polishResult.changes?.length || 0})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="result" className="flex-1 mt-4">
                  <ScrollArea className="h-[350px] rounded-md border p-4 bg-muted/30">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {polishResult.polished}
                    </p>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="changes" className="flex-1 mt-4">
                  <ScrollArea className="h-[350px]">
                    <div className="space-y-4">
                      {polishResult.changes?.map((change, i) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {t('essays.labels.change')} {i + 1}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{change.reason}</span>
                          </div>
                          <div className="grid gap-2 text-sm">
                            <div className="rounded bg-red-50 dark:bg-red-950/30 p-2">
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                {t('essays.labels.original')}
                              </span>
                              <p className="mt-1 line-through text-muted-foreground">
                                {change.original}
                              </p>
                            </div>
                            <div className="rounded bg-green-50 dark:bg-green-950/30 p-2">
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                {t('essays.labels.revised')}
                              </span>
                              <p className="mt-1">{change.revised}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsPolishOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onApplyPolish}>
              <Check className="mr-2 h-4 w-4" />
              {t('essays.actions.applyPolish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Continue Dialog */}
      <Dialog open={isContinueOpen} onOpenChange={setIsContinueOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              {t('essays.dialog.continueTitle')}
            </DialogTitle>
            <DialogDescription>{t('essays.dialog.continueDesc')}</DialogDescription>
          </DialogHeader>

          {continueResult && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {continueResult.continuation}
                </p>
              </div>
              {continueResult.suggestions?.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">{t('essays.labels.nextSteps')}</h4>
                  <ul className="space-y-1">
                    {continueResult.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => continueResult && onCopyToClipboard(continueResult.continuation, -1)}
            >
              <Copy className="mr-2 h-4 w-4" />
              {t('essays.actions.copyText')}
            </Button>
            <Button onClick={onAppendContinuation}>
              <Check className="mr-2 h-4 w-4" />
              {t('essays.actions.addToEssay')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Opening Dialog */}
      <Dialog open={isOpeningOpen} onOpenChange={setIsOpeningOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" />
              {t('essays.dialog.openingTitle')}
            </DialogTitle>
            <DialogDescription>{t('essays.dialog.openingDesc')}</DialogDescription>
          </DialogHeader>

          {openingResult && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {openingResult.openings?.map((opening, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-4 transition-all hover:border-primary/50 hover:bg-muted/50"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="secondary">{opening.style}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCopyToClipboard(opening.text, i)}
                      >
                        {copiedIndex === i ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed">{opening.text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button onClick={() => setIsOpeningOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Rewrite Dialog */}
      <Dialog open={isRewriteOpen} onOpenChange={setIsRewriteOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              {t('essays.dialog.rewriteTitle')}
            </DialogTitle>
            <DialogDescription>{t('essays.dialog.rewriteDesc')}</DialogDescription>
          </DialogHeader>

          {rewriteResult && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {rewriteResult.versions?.map((version, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-4 transition-all hover:border-primary/50 hover:bg-muted/50"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="secondary">{version.style}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCopyToClipboard(version.text, i)}
                      >
                        {copiedIndex === i ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed">{version.text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button onClick={() => setIsRewriteOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

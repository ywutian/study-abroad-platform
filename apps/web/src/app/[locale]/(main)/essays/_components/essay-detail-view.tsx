'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Lightbulb,
  Pencil,
  Trash2,
  PencilLine,
  RefreshCw,
  PenTool,
  ArrowRight,
  ChevronDown,
  Calendar,
  Hash,
  BookOpen,
} from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Essay } from '@/types/essay';

interface EssayDetailViewProps {
  selectedEssay: Essay | null;
  getWordCount: (text: string) => number;
  onCreate: () => void;
  onCreateFromPrompt: () => void;
  onEdit: (essay: Essay) => void;
  onDelete: (id: string) => void;
  onReview: (essay: Essay) => void;
  onPolish: (essay: Essay) => void;
  onContinue: (essay: Essay) => void;
  onGenerateOpening: (essay: Essay) => void;
  onBrainstorm: () => void;
  onRewriteSelected: () => void;
  reviewPending: boolean;
  polishPending: boolean;
  rewritePending: boolean;
  continuePending: boolean;
  openingPending: boolean;
}

export function EssayDetailView({
  selectedEssay,
  getWordCount,
  onCreate,
  onCreateFromPrompt,
  onEdit,
  onDelete,
  onReview,
  onPolish,
  onContinue,
  onGenerateOpening,
  onBrainstorm,
  onRewriteSelected,
  reviewPending,
  polishPending,
  rewritePending,
  continuePending,
  openingPending,
}: EssayDetailViewProps) {
  const t = useTranslations();
  const fmt = useFormatter();

  return (
    <div className="lg:col-span-2">
      <Card className="h-full overflow-hidden">
        <div className="h-1 bg-primary" />
        {selectedEssay ? (
          <>
            <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Lightbulb className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-xl">{selectedEssay.title}</CardTitle>
                  {selectedEssay.prompt && (
                    <CardDescription className="line-clamp-2">
                      {selectedEssay.prompt}
                    </CardDescription>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Lightbulb className="mr-1 h-4 w-4" />
                      {t('essays.aiTools')}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => onReview(selectedEssay)}
                      disabled={reviewPending}
                    >
                      <Lightbulb className="mr-2 h-4 w-4" />
                      {t('essays.aiActions.review')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onPolish(selectedEssay)}
                      disabled={polishPending}
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      {t('essays.aiActions.polish')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onContinue(selectedEssay)}
                      disabled={continuePending}
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      {t('essays.aiActions.continue')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onGenerateOpening(selectedEssay)}
                      disabled={openingPending}
                    >
                      <PenTool className="mr-2 h-4 w-4" />
                      {t('essays.aiActions.generateOpening')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onBrainstorm}>
                      <Lightbulb className="mr-2 h-4 w-4" />
                      {t('essays.aiActions.brainstorm')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onRewriteSelected} disabled={rewritePending}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t('essays.aiActions.rewriteSelected')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={() => onEdit(selectedEssay)}>
                  <Pencil className="mr-1 h-4 w-4" />
                  {t('common.edit')}
                </Button>
                <Button
                  variant="soft-destructive"
                  size="sm"
                  onClick={() => onDelete(selectedEssay.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Hash className="h-4 w-4" />
                  {t('essays.wordCount', {
                    count: selectedEssay.wordCount || getWordCount(selectedEssay.content),
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {t('essays.updatedAt')}{' '}
                  {fmt.dateTime(new Date(selectedEssay.updatedAt), 'medium')}
                </span>
              </div>
              <ScrollArea className="h-[400px] rounded-md border bg-muted/30 p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {selectedEssay.content}
                </p>
              </ScrollArea>
            </CardContent>
          </>
        ) : (
          <div className="flex h-[500px] flex-col items-center justify-center px-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-primary/10 mb-6">
              <PenTool className="h-10 w-10 text-primary/60" />
            </div>
            <p className="text-lg font-semibold">{t('essays.selectToView')}</p>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              {t('essays.clickNewToCreate')}
            </p>

            <div
              data-tour="essay-empty-cards"
              className="mt-6 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <button
                type="button"
                onClick={onCreateFromPrompt}
                aria-label={t('essays.onboarding.fromPromptTitle')}
                className="group flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <h4 className="text-sm font-semibold">{t('essays.onboarding.fromPromptTitle')}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('essays.onboarding.fromPromptDesc')}
                </p>
              </button>
              <button
                type="button"
                onClick={onCreate}
                aria-label={t('essays.onboarding.freeWriteTitle')}
                className="group flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Pencil className="h-4 w-4 text-primary" />
                </div>
                <h4 className="text-sm font-semibold">{t('essays.onboarding.freeWriteTitle')}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('essays.onboarding.freeWriteDesc')}
                </p>
              </button>
            </div>

            <div className="mt-4">
              <Button variant="outline" className="gap-2" asChild>
                <Link href="/cases?tab=essays">
                  <BookOpen className="h-4 w-4" />
                  {t('essays.action.browseExamples')}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

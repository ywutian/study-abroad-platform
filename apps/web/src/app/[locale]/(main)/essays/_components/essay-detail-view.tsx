'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Sparkles,
  Pencil,
  Trash2,
  Wand2,
  RefreshCw,
  PenTool,
  ArrowRight,
  ChevronDown,
  Lightbulb,
  Calendar,
  Hash,
} from 'lucide-react';
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
        <div className="h-1 bg-primary dark:bg-primary" />
        {selectedEssay ? (
          <>
            <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
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
                      <Sparkles className="mr-1 h-4 w-4" />
                      {t('essays.aiTools')}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => onReview(selectedEssay)}
                      disabled={reviewPending}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t('essays.aiActions.review')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onPolish(selectedEssay)}
                      disabled={polishPending}
                    >
                      <Wand2 className="mr-2 h-4 w-4" />
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
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
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
            <Button
              className="mt-6 gap-2 bg-primary dark:bg-primary hover:opacity-90 text-white"
              onClick={onCreate}
            >
              <Plus className="h-4 w-4" />
              {t('essays.new')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

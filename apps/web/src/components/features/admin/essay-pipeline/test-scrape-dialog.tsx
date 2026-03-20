'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { ChangeTypeBadge } from './pipeline-badges';
import type { TestScrapeResult } from './types';

interface TestScrapeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: TestScrapeResult | null;
  loading: boolean;
  onConfirmSave: (selectedIndexes: number[]) => void;
  saving: boolean;
}

export function TestScrapeDialog({
  open,
  onOpenChange,
  result,
  loading,
  onConfirmSave,
  saving,
}: TestScrapeDialogProps) {
  const t = useTranslations('essayPipeline');
  const [selectedEssays, setSelectedEssays] = useState<number[]>([]);
  const [rawContentExpanded, setRawContentExpanded] = useState(false);

  const toggleEssaySelection = (index: number) => {
    setSelectedEssays((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('testScrapePreview')}</DialogTitle>
          <DialogDescription>
            {result
              ? `${result.school} — ${result.essays.length} ${t('essaysFound')}`
              : t('loading')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="flex gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{result.scrapeGroup}</Badge>
              <span>{result.year}</span>
            </div>

            {result.essays.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{t('noEssaysFound')}</div>
            ) : (
              <div className="space-y-3">
                {result.essays.map((essay, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedEssays.includes(i)}
                        onCheckedChange={() => toggleEssaySelection(i)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{essay.prompt}</p>
                        {essay.promptZh && (
                          <p className="text-sm text-muted-foreground">{essay.promptZh}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {essay.type && (
                            <Badge variant="outline" className="text-xs">
                              {essay.type}
                            </Badge>
                          )}
                          {essay.wordLimit && (
                            <Badge variant="secondary" className="text-xs">
                              {essay.wordLimit} words
                            </Badge>
                          )}
                          {essay.confidence !== undefined && (
                            <Badge
                              variant={essay.confidence >= 0.8 ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {Math.round(essay.confidence * 100)}%
                            </Badge>
                          )}
                          {essay.changeType && <ChangeTypeBadge type={essay.changeType} />}
                          {essay.isRequired ? (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Optional
                            </Badge>
                          )}
                        </div>
                        {essay.aiTips && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            {essay.aiTips}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.rawContentPreview && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRawContentExpanded(!rawContentExpanded)}
                  className="gap-1 text-xs"
                >
                  {rawContentExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {t('rawContent')}
                </Button>
                {rawContentExpanded && (
                  <pre className="text-xs bg-muted p-3 rounded-md mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {result.rawContentPreview}
                  </pre>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          {result && result.essays.length > 0 && (
            <Button
              onClick={() => onConfirmSave(selectedEssays)}
              disabled={saving || selectedEssays.length === 0}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t('confirmSave', { count: selectedEssays.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

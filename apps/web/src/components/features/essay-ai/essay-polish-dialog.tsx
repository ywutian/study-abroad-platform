'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles, ArrowRight, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface EssayPolishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  essayId: string;
  essayContent: string;
  onApply?: (polishedContent: string) => void;
}

type PolishStyle = 'formal' | 'vivid' | 'concise';

interface PolishChange {
  original: string;
  revised: string;
  reason: string;
}

interface PolishResult {
  id: string;
  polished: string;
  changes: PolishChange[];
  tokenUsed: number;
}

export const EssayPolishDialog: React.FC<EssayPolishDialogProps> = ({
  open,
  onOpenChange,
  essayId,
  essayContent,
  onApply,
}) => {
  const t = useTranslations('essayAi');
  const [style, setStyle] = useState<PolishStyle>('formal');
  const [result, setResult] = useState<PolishResult | null>(null);
  const [copied, setCopied] = useState(false);

  const polishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<PolishResult>('/essay-ai/polish', {
        essayId,
        style,
      });
      return response;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(t('polish.success'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('polish.failed'));
    },
  });

  const handleCopy = async () => {
    if (result?.polished) {
      await navigator.clipboard.writeText(result.polished);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t('copied'));
    }
  };

  const handleApply = () => {
    if (result?.polished && onApply) {
      onApply(result.polished);
      onOpenChange(false);
      toast.success(t('polish.applied'));
    }
  };

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('polish.title')}
          </DialogTitle>
          <DialogDescription>{t('polish.description')}</DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>{t('polish.style')}</Label>
              <Select value={style} onValueChange={(v: PolishStyle) => setStyle(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">{t('polish.styles.formal')}</SelectItem>
                  <SelectItem value="vivid">{t('polish.styles.vivid')}</SelectItem>
                  <SelectItem value="concise">{t('polish.styles.concise')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t(`polish.styleDesc.${style}`)}</p>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
              <Label className="text-sm font-medium">{t('polish.preview')}</Label>
              <p className="mt-2 text-sm line-clamp-6">{essayContent}</p>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t('polish.cost', { points: 20 })}</span>
              <span>{essayContent.length} {t('characters')}</span>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Changes List */}
              {result.changes.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">{t('polish.changes')}</Label>
                  {result.changes.map((change, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0 bg-red-50 text-red-700 border-red-200">
                          {t('polish.original')}
                        </Badge>
                        <p className="text-sm line-through text-muted-foreground">{change.original}</p>
                      </div>
                      <div className="flex items-center justify-center">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0 bg-green-50 text-green-700 border-green-200">
                          {t('polish.revised')}
                        </Badge>
                        <p className="text-sm">{change.revised}</p>
                      </div>
                      <p className="text-xs text-muted-foreground pl-2 border-l-2 border-primary/30">
                        {change.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Polished Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{t('polish.result')}</Label>
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? t('copied') : t('copy')}
                  </Button>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm whitespace-pre-wrap">{result.polished}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-right">
                {t('tokenUsed', { tokens: result.tokenUsed })}
              </p>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                {t('cancel')}
              </Button>
              <Button onClick={() => polishMutation.mutate()} disabled={polishMutation.isPending}>
                {polishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Sparkles className="mr-2 h-4 w-4" />
                {t('polish.start')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setResult(null)}>
                {t('polish.retry')}
              </Button>
              {onApply && (
                <Button onClick={handleApply}>
                  <Check className="mr-2 h-4 w-4" />
                  {t('polish.apply')}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};




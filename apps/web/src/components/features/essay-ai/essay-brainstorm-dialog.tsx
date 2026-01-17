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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Lightbulb, Sparkles, ChevronRight, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';

interface EssayBrainstormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPrompt?: string;
  onSelectIdea?: (idea: string) => void;
}

interface EssayIdea {
  title: string;
  description: string;
  suitableFor?: string;
}

interface BrainstormResult {
  ideas: EssayIdea[];
  overallAdvice: string;
  tokenUsed: number;
}

export const EssayBrainstormDialog: React.FC<EssayBrainstormDialogProps> = ({
  open,
  onOpenChange,
  initialPrompt = '',
  onSelectIdea,
}) => {
  const t = useTranslations('essayAi');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [background, setBackground] = useState('');
  const [school, setSchool] = useState('');
  const [major, setMajor] = useState('');
  const [result, setResult] = useState<BrainstormResult | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const brainstormMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<BrainstormResult>('/essay-ai/brainstorm', {
        prompt,
        background: background || undefined,
        school: school || undefined,
        major: major || undefined,
      });
      return response;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(t('brainstorm.success'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('brainstorm.failed'));
    },
  });

  const handleCopy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    toast.success(t('copied'));
  };

  const handleSelectIdea = (idea: EssayIdea) => {
    if (onSelectIdea) {
      onSelectIdea(`${idea.title}\n\n${idea.description}`);
      onOpenChange(false);
      toast.success(t('brainstorm.ideaSelected'));
    }
  };

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            {t('brainstorm.title')}
          </DialogTitle>
          <DialogDescription>{t('brainstorm.description')}</DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">{t('brainstorm.prompt')} *</Label>
              <Textarea
                id="prompt"
                placeholder={t('brainstorm.promptPlaceholder')}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="background">{t('brainstorm.background')}</Label>
              <Textarea
                id="background"
                placeholder={t('brainstorm.backgroundPlaceholder')}
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="school">{t('brainstorm.school')}</Label>
                <Input
                  id="school"
                  placeholder={t('brainstorm.schoolPlaceholder')}
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="major">{t('brainstorm.major')}</Label>
                <Input
                  id="major"
                  placeholder={t('brainstorm.majorPlaceholder')}
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t('brainstorm.cost', { points: 15 })}</span>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* Overall Advice */}
              <Card className="bg-primary/10 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('brainstorm.overallAdvice')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{result.overallAdvice}</p>
                </CardContent>
              </Card>

              {/* Ideas */}
              <div className="space-y-3">
                {result.ideas.map((idea, idx) => (
                  <Card key={idx} className="group hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Badge variant="outline" className="shrink-0">
                            {idx + 1}
                          </Badge>
                          {idea.title}
                        </CardTitle>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(idea.description, idx)}
                          >
                            {copiedIdx === idx ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          {onSelectIdea && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleSelectIdea(idea)}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {idea.suitableFor && (
                        <CardDescription className="text-xs">
                          {t('brainstorm.suitableFor')}: {idea.suitableFor}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{idea.description}</p>
                    </CardContent>
                  </Card>
                ))}
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
              <Button
                onClick={() => brainstormMutation.mutate()}
                disabled={brainstormMutation.isPending || !prompt.trim()}
              >
                {brainstormMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Lightbulb className="mr-2 h-4 w-4" />
                {t('brainstorm.start')}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setResult(null)}>
              {t('brainstorm.newBrainstorm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

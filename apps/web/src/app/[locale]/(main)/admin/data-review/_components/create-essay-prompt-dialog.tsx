'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useSchoolSearch } from '@/hooks/use-school-search';

const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);
const ESSAY_TYPES = [
  'SUPPLEMENTAL',
  'SHORT_ANSWER',
  'PERSONAL_STATEMENT',
  'WHY_SCHOOL',
  'ACTIVITY',
  'OPTIONAL',
  'OTHER',
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEssayPromptDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('admin.dataReview.manualEntry.essayForm');
  const te = useTranslations('admin.dataReview.enums');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [type, setType] = useState<string>('SUPPLEMENTAL');
  const [prompt, setPrompt] = useState('');
  const [promptZh, setPromptZh] = useState('');
  const [wordLimit, setWordLimit] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [sourceUrl, setSourceUrl] = useState('');

  const { data: schools } = useSchoolSearch(schoolQuery, open);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.post('/admin/essay-prompts', body),
    onSuccess: () => {
      toast.success(t('success'));
      queryClient.invalidateQueries({ queryKey: ['essayPrompts'] });
      queryClient.invalidateQueries({ queryKey: ['reviewStats'] });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setSchoolQuery('');
    setSchoolId('');
    setSchoolName('');
    setYear(String(new Date().getFullYear()));
    setType('SUPPLEMENTAL');
    setPrompt('');
    setPromptZh('');
    setWordLimit('');
    setIsRequired(true);
    setSourceUrl('');
  };

  const handleSubmit = () => {
    if (!schoolId || !year || !type || !prompt.trim()) return;
    mutation.mutate({
      schoolId,
      year: parseInt(year),
      type,
      prompt: prompt.trim(),
      promptZh: promptZh.trim() || undefined,
      wordLimit: wordLimit ? parseInt(wordLimit) : undefined,
      isRequired,
      sourceUrl: sourceUrl.trim() || undefined,
    });
  };

  const caseT = useTranslations('admin.dataReview.manualEntry.caseForm');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* School search */}
          <div className="space-y-1.5 relative">
            <Label>{caseT('school')} *</Label>
            <Input
              placeholder={caseT('schoolSearch')}
              value={schoolId ? schoolName : schoolQuery}
              onChange={(e) => {
                setSchoolQuery(e.target.value);
                setSchoolId('');
                setSchoolName('');
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
            />
            {showDropdown && schools?.items && schools.items.length > 0 && !schoolId && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                {schools.items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => {
                      setSchoolId(s.id);
                      setSchoolName(getLocalizedName(s.nameZh, s.name, locale));
                      setShowDropdown(false);
                    }}
                  >
                    <span className="font-medium">
                      {getLocalizedName(s.nameZh, s.name, locale)}
                    </span>
                    {s.usNewsRank && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        US News #{s.usNewsRank}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{caseT('year')} *</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('type')} *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESSAY_TYPES.map((et) => (
                    <SelectItem key={et} value={et}>
                      {te.has(`essayType.${et}`) ? te(`essayType.${et}` as never) : et}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('prompt')} *</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('promptPlaceholder')}
              rows={3}
              maxLength={5000}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('promptZh')}</Label>
            <Textarea
              value={promptZh}
              onChange={(e) => setPromptZh(e.target.value)}
              placeholder={t('promptZhPlaceholder')}
              rows={2}
              maxLength={5000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('wordLimit')}</Label>
              <Input
                type="number"
                value={wordLimit}
                onChange={(e) => setWordLimit(e.target.value)}
                placeholder="250"
                min={0}
                max={10000}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('isRequired')}</Label>
              <div className="flex items-center h-9">
                <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('sourceUrl')}</Label>
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!schoolId || !prompt.trim() || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

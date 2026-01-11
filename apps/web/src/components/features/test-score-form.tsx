'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { Save, Loader2 } from 'lucide-react';

const TEST_TYPES = [
  { value: 'SAT', label: 'SAT', maxScore: 1600 },
  { value: 'ACT', label: 'ACT', maxScore: 36 },
  { value: 'TOEFL', label: 'TOEFL', maxScore: 120 },
  { value: 'IELTS', label: 'IELTS', maxScore: 9 },
  { value: 'AP', label: 'AP', maxScore: 5 },
  { value: 'IB', label: 'IB', maxScore: 45 },
];

interface TestScore {
  id: string;
  type: string;
  score: number;
  subScores?: Record<string, number>;
  testDate?: string;
}

interface TestScoreFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingScore?: TestScore | null;
}

export function TestScoreForm({ open, onOpenChange, editingScore }: TestScoreFormProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const isEditing = !!editingScore;

  const [formData, setFormData] = useState({
    type: editingScore?.type || '',
    score: editingScore?.score?.toString() || '',
    testDate: editingScore?.testDate?.slice(0, 10) || '',
    // SAT sub-scores
    satReading: editingScore?.subScores?.reading?.toString() || '',
    satMath: editingScore?.subScores?.math?.toString() || '',
    // TOEFL sub-scores
    toeflReading: editingScore?.subScores?.reading?.toString() || '',
    toeflListening: editingScore?.subScores?.listening?.toString() || '',
    toeflSpeaking: editingScore?.subScores?.speaking?.toString() || '',
    toeflWriting: editingScore?.subScores?.writing?.toString() || '',
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.post('/profiles/me/test-scores', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.scoreAdded'));
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) =>
      apiClient.put(`/profiles/me/test-scores/${editingScore?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.scoreUpdated'));
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      type: '',
      score: '',
      testDate: '',
      satReading: '',
      satMath: '',
      toeflReading: '',
      toeflListening: '',
      toeflSpeaking: '',
      toeflWriting: '',
    });
  };

  const handleSubmit = () => {
    if (!formData.type || !formData.score) {
      toast.error(t('validation.scoreRequired'));
      return;
    }

    let subScores: Record<string, number> | undefined;

    if (formData.type === 'SAT' && (formData.satReading || formData.satMath)) {
      subScores = {};
      if (formData.satReading) subScores.reading = parseInt(formData.satReading);
      if (formData.satMath) subScores.math = parseInt(formData.satMath);
    } else if (formData.type === 'TOEFL') {
      subScores = {};
      if (formData.toeflReading) subScores.reading = parseInt(formData.toeflReading);
      if (formData.toeflListening) subScores.listening = parseInt(formData.toeflListening);
      if (formData.toeflSpeaking) subScores.speaking = parseInt(formData.toeflSpeaking);
      if (formData.toeflWriting) subScores.writing = parseInt(formData.toeflWriting);
    }

    const data = {
      type: formData.type,
      score: parseInt(formData.score),
      testDate: formData.testDate || undefined,
      subScores,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const selectedType = TEST_TYPES.find((tt) => tt.value === formData.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('form.editScore') : t('form.addScore')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('form.testType')} *</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => setFormData((p) => ({ ...p, type: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('form.selectTestType')} />
              </SelectTrigger>
              <SelectContent>
                {TEST_TYPES.map((tt) => (
                  <SelectItem key={tt.value} value={tt.value}>
                    {tt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('form.score')} * {selectedType && `(Max ${selectedType.maxScore})`}</Label>
            <Input
              type="number"
              value={formData.score}
              onChange={(e) => setFormData((p) => ({ ...p, score: e.target.value }))}
              placeholder={selectedType ? `0 - ${selectedType.maxScore}` : t('form.scorePlaceholder')}
              max={selectedType?.maxScore}
              min={0}
            />
          </div>

          {formData.type === 'SAT' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('form.readingEBRW')}</Label>
                <Input
                  type="number"
                  value={formData.satReading}
                  onChange={(e) => setFormData((p) => ({ ...p, satReading: e.target.value }))}
                  placeholder="200 - 800"
                  max={800}
                  min={200}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('form.math')}</Label>
                <Input
                  type="number"
                  value={formData.satMath}
                  onChange={(e) => setFormData((p) => ({ ...p, satMath: e.target.value }))}
                  placeholder="200 - 800"
                  max={800}
                  min={200}
                />
              </div>
            </div>
          )}

          {formData.type === 'TOEFL' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('form.reading')}</Label>
                <Input
                  type="number"
                  value={formData.toeflReading}
                  onChange={(e) => setFormData((p) => ({ ...p, toeflReading: e.target.value }))}
                  placeholder="0 - 30"
                  max={30}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('form.listening')}</Label>
                <Input
                  type="number"
                  value={formData.toeflListening}
                  onChange={(e) => setFormData((p) => ({ ...p, toeflListening: e.target.value }))}
                  placeholder="0 - 30"
                  max={30}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('form.speaking')}</Label>
                <Input
                  type="number"
                  value={formData.toeflSpeaking}
                  onChange={(e) => setFormData((p) => ({ ...p, toeflSpeaking: e.target.value }))}
                  placeholder="0 - 30"
                  max={30}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('form.writing')}</Label>
                <Input
                  type="number"
                  value={formData.toeflWriting}
                  onChange={(e) => setFormData((p) => ({ ...p, toeflWriting: e.target.value }))}
                  placeholder="0 - 30"
                  max={30}
                  min={0}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('form.testDate')}</Label>
            <Input
              type="date"
              value={formData.testDate}
              onChange={(e) => setFormData((p) => ({ ...p, testDate: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

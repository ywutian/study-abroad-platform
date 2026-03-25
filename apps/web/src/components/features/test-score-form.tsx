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
import { profileRoutes } from '@study-abroad/shared';
import { Save, Loader2, Plus, Trash2 } from 'lucide-react';

const TEST_TYPES = [
  { value: 'SAT', label: 'SAT', maxScore: 1600 },
  { value: 'ACT', label: 'ACT', maxScore: 36 },
  { value: 'TOEFL', label: 'TOEFL', maxScore: 120 },
  { value: 'IELTS', label: 'IELTS', maxScore: 9 },
  { value: 'AP', label: 'AP', maxScore: 5 },
  { value: 'IB', label: 'IB', maxScore: 45 },
  { value: 'A_LEVEL', label: 'A-Level', maxScore: 240 },
  { value: 'IGCSE', label: 'IGCSE', maxScore: 90 },
];

const AP_SUBJECTS = [
  'Calculus AB',
  'Calculus BC',
  'Statistics',
  'Physics C: Mechanics',
  'Physics C: E&M',
  'Physics 1',
  'Physics 2',
  'Chemistry',
  'Biology',
  'Computer Science A',
  'CS Principles',
  'English Language',
  'English Literature',
  'US History',
  'World History',
  'European History',
  'Psychology',
  'Economics (Macro)',
  'Economics (Micro)',
  'Environmental Science',
  'Spanish Language',
  'Chinese Language',
];

const IB_SUBJECTS = [
  // Group 1-2: Languages
  'English A',
  'Chinese A',
  'English B',
  'Chinese B',
  'Spanish B',
  'French B',
  // Group 3: Individuals & Societies
  'History',
  'Economics',
  'Psychology',
  'Geography',
  'Business Management',
  // Group 4: Sciences
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'ESS',
  // Group 5: Mathematics
  'Mathematics AA',
  'Mathematics AI',
  // Group 6: The Arts
  'Visual Arts',
  'Music',
  'Theatre',
];

const A_LEVEL_SUBJECTS = [
  // STEM
  'Mathematics',
  'Further Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Design & Technology',
  'Engineering',
  // Humanities & Social Sciences
  'Economics',
  'Business Studies',
  'Accounting',
  'History',
  'Geography',
  'Psychology',
  'Sociology',
  'Politics',
  'Philosophy & Ethics',
  // Languages
  'Chinese',
  'French',
  'Spanish',
  'German',
  'Japanese',
  // Arts
  'English Literature',
  'Art & Design',
  'Music',
];

const A_LEVEL_GRADES = ['A*', 'A', 'B', 'C', 'D', 'E', 'U'] as const;
const A_LEVEL_UCAS: Record<string, number> = {
  'A*': 56,
  A: 48,
  B: 40,
  C: 32,
  D: 24,
  E: 16,
  U: 0,
};

const IGCSE_SUBJECTS = [
  // Math
  'Mathematics',
  'Additional Mathematics',
  // English
  'English Language',
  'English Literature',
  // Sciences
  'Physics',
  'Chemistry',
  'Biology',
  'Combined Science',
  // Languages
  'Chinese (First Language)',
  'Chinese (Second Language)',
  'French',
  'Spanish',
  'German',
  // Humanities
  'History',
  'Geography',
  'Economics',
  'Sociology',
  // Business & Computing
  'Business Studies',
  'Computer Science',
  'Accounting',
  // Arts
  'Art & Design',
  'Music',
  'Drama',
  // Other
  'Physical Education',
  'Environmental Management',
];

const IGCSE_GRADES = ['9', '8', '7', '6', '5', '4', '3', '2', '1'] as const;
const IGCSE_LETTER_GRADES = ['A*', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'U'] as const;
const IGCSE_GRADE_POINTS: Record<string, number> = {
  '9': 9,
  'A*': 9,
  '8': 8,
  A: 8,
  '7': 7,
  B: 7,
  '6': 6,
  C: 6,
  '5': 5,
  D: 5,
  '4': 4,
  E: 4,
  '3': 3,
  F: 3,
  '2': 2,
  G: 2,
  '1': 1,
  U: 0,
};

interface SubjectEntry {
  subject: string;
  score: string; // number for AP/IB, grade string for A-Level
  level?: 'HL' | 'SL'; // IB only
}

interface TestScore {
  id: string;
  type: string;
  score: number;
  subScores?: Record<string, number | string>;
  testDate?: string;
}

interface TestScoreFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingScore?: TestScore | null;
}

function parseSubjectEntries(
  type: string,
  subScores?: Record<string, number | string>
): SubjectEntry[] {
  if (!subScores || Object.keys(subScores).length === 0) return [];
  return Object.entries(subScores).map(([subject, score]) => {
    if (type === 'IB') {
      // IB stores as "Physics (HL)": 7
      const match = subject.match(/^(.+?)\s*\((HL|SL)\)$/);
      if (match) {
        return { subject: match[1], score: String(score), level: match[2] as 'HL' | 'SL' };
      }
    }
    return { subject, score: String(score) };
  });
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

  const [subjectEntries, setSubjectEntries] = useState<SubjectEntry[]>(() => {
    if (editingScore && ['AP', 'IB', 'A_LEVEL', 'IGCSE'].includes(editingScore.type)) {
      return parseSubjectEntries(editingScore.type, editingScore.subScores);
    }
    return [];
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.post(profileRoutes.testScores(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.scoreAdded'));
      onOpenChange(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.put(profileRoutes.testScore(editingScore!.id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.scoreUpdated'));
      onOpenChange(false);
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
    setSubjectEntries([]);
  };

  const [igcseGradeMode, setIgcseGradeMode] = useState<'numeric' | 'letter'>('numeric');

  const addSubjectEntry = () => {
    setSubjectEntries((prev) => [
      ...prev,
      { subject: '', score: '', level: formData.type === 'IB' ? 'SL' : undefined },
    ]);
  };

  const removeSubjectEntry = (index: number) => {
    setSubjectEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSubjectEntry = (index: number, field: keyof SubjectEntry, value: string) => {
    setSubjectEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  // Auto-calculate A-Level UCAS total
  const aLevelTotal = subjectEntries.reduce((sum, entry) => {
    return sum + (A_LEVEL_UCAS[entry.score] ?? 0);
  }, 0);

  // Auto-calculate IGCSE total
  const igcseTotal = subjectEntries.reduce((sum, entry) => {
    return sum + (IGCSE_GRADE_POINTS[entry.score] ?? 0);
  }, 0);

  const handleSubmit = () => {
    const isSubjectType = ['AP', 'IB', 'A_LEVEL', 'IGCSE'].includes(formData.type);

    if (!formData.type) {
      toast.error(t('validation.scoreRequired'));
      return;
    }

    // For subject-based types, score is computed or required differently
    if (!isSubjectType && !formData.score) {
      toast.error(t('validation.scoreRequired'));
      return;
    }

    let subScores: Record<string, number | string> | undefined;
    let totalScore: number;

    if (formData.type === 'AP') {
      // AP: subScores = { "Calculus BC": 5, "Chemistry": 4 }, score = average or count
      subScores = {};
      for (const entry of subjectEntries) {
        if (entry.subject && entry.score) {
          subScores[entry.subject] = parseInt(entry.score);
        }
      }
      // Score = highest single AP score or total subjects count (use manual input)
      totalScore = formData.score ? parseInt(formData.score) : subjectEntries.length;
    } else if (formData.type === 'IB') {
      // IB: subScores = { "Physics (HL)": 7, "Chemistry (SL)": 6 }, score = total (max 45)
      subScores = {};
      for (const entry of subjectEntries) {
        if (entry.subject && entry.score) {
          const key = entry.level ? `${entry.subject} (${entry.level})` : entry.subject;
          subScores[key] = parseInt(entry.score);
        }
      }
      totalScore = formData.score ? parseInt(formData.score) : 0;
    } else if (formData.type === 'A_LEVEL') {
      // A-Level: subScores = { "Mathematics": "A*", "Physics": "A" }, score = UCAS total
      subScores = {};
      for (const entry of subjectEntries) {
        if (entry.subject && entry.score) {
          subScores[entry.subject] = entry.score; // Store grade string
        }
      }
      totalScore = aLevelTotal;
    } else if (formData.type === 'IGCSE') {
      // IGCSE: subScores = { "Mathematics": "9", "Physics": "A*" }, score = points total
      subScores = {};
      for (const entry of subjectEntries) {
        if (entry.subject && entry.score) {
          subScores[entry.subject] = entry.score; // Store grade/number string
        }
      }
      totalScore = igcseTotal;
    } else if (formData.type === 'SAT' && (formData.satReading || formData.satMath)) {
      subScores = {};
      if (formData.satReading) subScores.reading = parseInt(formData.satReading);
      if (formData.satMath) subScores.math = parseInt(formData.satMath);
      totalScore = parseInt(formData.score);
    } else if (formData.type === 'TOEFL') {
      subScores = {};
      if (formData.toeflReading) subScores.reading = parseInt(formData.toeflReading);
      if (formData.toeflListening) subScores.listening = parseInt(formData.toeflListening);
      if (formData.toeflSpeaking) subScores.speaking = parseInt(formData.toeflSpeaking);
      if (formData.toeflWriting) subScores.writing = parseInt(formData.toeflWriting);
      totalScore = parseInt(formData.score);
    } else {
      totalScore = parseInt(formData.score);
    }

    const data = {
      type: formData.type,
      score: totalScore,
      testDate: formData.testDate || undefined,
      subScores: subScores && Object.keys(subScores).length > 0 ? subScores : undefined,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const selectedType = TEST_TYPES.find((tt) => tt.value === formData.type);
  const isSubjectType = ['AP', 'IB', 'A_LEVEL', 'IGCSE'].includes(formData.type);

  const getSubjectList = () => {
    if (formData.type === 'AP') return AP_SUBJECTS;
    if (formData.type === 'IB') return IB_SUBJECTS;
    if (formData.type === 'A_LEVEL') return A_LEVEL_SUBJECTS;
    if (formData.type === 'IGCSE') return IGCSE_SUBJECTS;
    return [];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isSubjectType ? 'sm:max-w-lg' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle>{isEditing ? t('form.editScore') : t('form.addScore')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label>{t('form.testType')} *</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => {
                setFormData((p) => ({ ...p, type: v, score: '' }));
                setSubjectEntries([]);
              }}
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

          {/* Score field — hidden for A-Level/IGCSE (auto-calculated), shown for others */}
          {formData.type !== 'A_LEVEL' && formData.type !== 'IGCSE' && (
            <div className="space-y-2">
              <Label>
                {t('form.score')} * {selectedType && `(Max ${selectedType.maxScore})`}
              </Label>
              <Input
                type="number"
                value={formData.score}
                onChange={(e) => setFormData((p) => ({ ...p, score: e.target.value }))}
                placeholder={
                  selectedType ? `0 - ${selectedType.maxScore}` : t('form.scorePlaceholder')
                }
                max={selectedType?.maxScore}
                min={0}
              />
            </div>
          )}

          {/* SAT sub-scores */}
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

          {/* TOEFL sub-scores */}
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

          {/* AP / IB / A-Level subject entries */}
          {isSubjectType && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('form.subjects')}</Label>
                <div className="flex items-center gap-2">
                  {formData.type === 'IGCSE' && (
                    <button
                      type="button"
                      className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
                      onClick={() =>
                        setIgcseGradeMode((m) => (m === 'numeric' ? 'letter' : 'numeric'))
                      }
                    >
                      {igcseGradeMode === 'numeric' ? '9-1' : 'A*-G'}
                    </button>
                  )}
                  {formData.type === 'A_LEVEL' && subjectEntries.length > 0 && (
                    <span className="text-xs text-muted-foreground">UCAS: {aLevelTotal} pts</span>
                  )}
                  {formData.type === 'IGCSE' && subjectEntries.length > 0 && (
                    <span className="text-xs text-muted-foreground">{igcseTotal} pts</span>
                  )}
                </div>
              </div>

              {subjectEntries.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  {/* Subject dropdown */}
                  <Select
                    value={entry.subject}
                    onValueChange={(v) => updateSubjectEntry(index, 'subject', v)}
                  >
                    <SelectTrigger className="flex-1 min-w-0">
                      <SelectValue placeholder={t('form.selectSubject')} />
                    </SelectTrigger>
                    <SelectContent>
                      {getSubjectList().map((subj) => (
                        <SelectItem key={subj} value={subj}>
                          {subj}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* IB: HL/SL toggle */}
                  {formData.type === 'IB' && (
                    <Select
                      value={entry.level || 'SL'}
                      onValueChange={(v) => updateSubjectEntry(index, 'level', v)}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HL">HL</SelectItem>
                        <SelectItem value="SL">SL</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {/* Score/Grade input */}
                  {formData.type === 'A_LEVEL' || formData.type === 'IGCSE' ? (
                    <Select
                      value={entry.score}
                      onValueChange={(v) => updateSubjectEntry(index, 'score', v)}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        {(formData.type === 'A_LEVEL'
                          ? A_LEVEL_GRADES
                          : igcseGradeMode === 'numeric'
                            ? IGCSE_GRADES
                            : IGCSE_LETTER_GRADES
                        ).map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="number"
                      value={entry.score}
                      onChange={(e) => updateSubjectEntry(index, 'score', e.target.value)}
                      placeholder={formData.type === 'AP' ? '1-5' : '1-7'}
                      className="w-20"
                      min={1}
                      max={formData.type === 'AP' ? 5 : 7}
                    />
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive"
                    onClick={() => removeSubjectEntry(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 w-full"
                onClick={addSubjectEntry}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('form.addSubject')}
              </Button>
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

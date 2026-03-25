'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { motion } from 'framer-motion';
import { Mail, Plus, Pencil, Trash2, Save, Loader2 } from 'lucide-react';

const RECOMMENDER_ROLES = ['TEACHER', 'COUNSELOR', 'COACH', 'EMPLOYER', 'OTHER'] as const;
const LETTER_STATUSES = [
  'NOT_REQUESTED',
  'REQUESTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'CONFIRMED',
] as const;

const STATUS_COLORS: Record<string, string> = {
  NOT_REQUESTED: 'bg-muted text-muted-foreground',
  REQUESTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  SUBMITTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CONFIRMED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
};

interface RecommendationLetter {
  id: string;
  recommenderName: string;
  recommenderEmail?: string;
  recommenderRole: string;
  subject?: string;
  status: string;
  dueDate?: string;
  notes?: string;
}

export function RecommendationLettersTab() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecommendationLetter | null>(null);

  const [formData, setFormData] = useState({
    recommenderName: '',
    recommenderEmail: '',
    recommenderRole: '' as string,
    subject: '',
    status: 'NOT_REQUESTED',
    dueDate: '',
    notes: '',
  });

  const { data: letters = [] } = useQuery<RecommendationLetter[]>({
    queryKey: ['recommendation-letters'],
    queryFn: () => apiClient.get(profileRoutes.recommendationLetters()),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post(profileRoutes.recommendationLetters(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendation-letters'] });
      toast.success(t('recLetter.toast.created'));
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(profileRoutes.recommendationLetter(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendation-letters'] });
      toast.success(t('recLetter.toast.updated'));
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(profileRoutes.recommendationLetter(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendation-letters'] });
      toast.success(t('recLetter.toast.deleted'));
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({
      recommenderName: '',
      recommenderEmail: '',
      recommenderRole: '',
      subject: '',
      status: 'NOT_REQUESTED',
      dueDate: '',
      notes: '',
    });
    setFormOpen(true);
  };

  const openEdit = (letter: RecommendationLetter) => {
    setEditing(letter);
    setFormData({
      recommenderName: letter.recommenderName,
      recommenderEmail: letter.recommenderEmail || '',
      recommenderRole: letter.recommenderRole,
      subject: letter.subject || '',
      status: letter.status,
      dueDate: letter.dueDate?.slice(0, 10) || '',
      notes: letter.notes || '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSubmit = () => {
    if (!formData.recommenderName || !formData.recommenderRole) {
      toast.error(t('recLetter.validation.required'));
      return;
    }
    const payload = {
      recommenderName: formData.recommenderName,
      recommenderEmail: formData.recommenderEmail || undefined,
      recommenderRole: formData.recommenderRole,
      subject: formData.subject || undefined,
      status: formData.status,
      dueDate: formData.dueDate || undefined,
      notes: formData.notes || undefined,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-violet-500" />
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-violet-500" />
              {t('recLetter.title')}
            </CardTitle>
            <CardDescription>{t('recLetter.desc')}</CardDescription>
          </div>
          <Button onClick={openCreate} className="gap-2 bg-violet-500 hover:opacity-90 text-white">
            <Plus className="h-4 w-4" />
            {t('recLetter.add')}
          </Button>
        </CardHeader>
        <CardContent>
          {letters.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {letters.map((letter, index) => (
                <motion.div
                  key={letter.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="group rounded-xl border p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{letter.recommenderName}</p>
                        <Badge className={STATUS_COLORS[letter.status] || ''}>
                          {t(`recLetter.status.${letter.status}`)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {t(`recLetter.role.${letter.recommenderRole}`)}
                        {letter.subject && ` · ${letter.subject}`}
                      </p>
                      {letter.recommenderEmail && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {letter.recommenderEmail}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(letter)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteMutation.mutate(letter.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-violet-500/10">
                <Mail className="h-8 w-8 text-violet-500/50" />
              </div>
              <p className="font-medium">{t('recLetter.empty')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('recLetter.emptyHint')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('recLetter.editTitle') : t('recLetter.addTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('recLetter.field.name')} *</Label>
              <Input
                value={formData.recommenderName}
                onChange={(e) => setFormData((p) => ({ ...p, recommenderName: e.target.value }))}
                placeholder={t('recLetter.field.namePlaceholder')}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('recLetter.field.email')}</Label>
              <Input
                type="email"
                value={formData.recommenderEmail}
                onChange={(e) => setFormData((p) => ({ ...p, recommenderEmail: e.target.value }))}
                placeholder={t('recLetter.field.emailPlaceholder')}
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('recLetter.field.role')} *</Label>
                <Select
                  value={formData.recommenderRole}
                  onValueChange={(v) => setFormData((p) => ({ ...p, recommenderRole: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('recLetter.field.selectRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    {RECOMMENDER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`recLetter.role.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('recLetter.field.status')}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LETTER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`recLetter.status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('recLetter.field.subject')}</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                  placeholder={t('recLetter.field.subjectPlaceholder')}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('recLetter.field.dueDate')}</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('recLetter.field.notes')}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                placeholder={t('recLetter.field.notesPlaceholder')}
                rows={2}
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
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
    </>
  );
}

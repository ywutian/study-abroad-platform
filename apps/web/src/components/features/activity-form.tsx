'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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

const ACTIVITY_CATEGORY_KEYS = [
  { value: 'ACADEMIC', labelKey: 'academic' },
  { value: 'ARTS', labelKey: 'arts' },
  { value: 'ATHLETICS', labelKey: 'athletics' },
  { value: 'COMMUNITY_SERVICE', labelKey: 'communityService' },
  { value: 'LEADERSHIP', labelKey: 'leadership' },
  { value: 'WORK', labelKey: 'work' },
  { value: 'RESEARCH', labelKey: 'research' },
  { value: 'OTHER', labelKey: 'other' },
];

interface Activity {
  id: string;
  name: string;
  category: string;
  role: string;
  organization?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  hoursPerWeek?: number;
  weeksPerYear?: number;
  isOngoing?: boolean;
}

interface ActivityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingActivity?: Activity | null;
}

export function ActivityForm({ open, onOpenChange, editingActivity }: ActivityFormProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const isEditing = !!editingActivity;

  const [formData, setFormData] = useState({
    name: editingActivity?.name || '',
    category: editingActivity?.category || '',
    role: editingActivity?.role || '',
    organization: editingActivity?.organization || '',
    description: editingActivity?.description || '',
    startDate: editingActivity?.startDate?.slice(0, 10) || '',
    endDate: editingActivity?.endDate?.slice(0, 10) || '',
    hoursPerWeek: editingActivity?.hoursPerWeek?.toString() || '',
    weeksPerYear: editingActivity?.weeksPerYear?.toString() || '',
    isOngoing: editingActivity?.isOngoing || false,
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.post('/profiles/me/activities', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.activityAdded'));
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) =>
      apiClient.put(`/profiles/me/activities/${editingActivity?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.activityUpdated'));
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      role: '',
      organization: '',
      description: '',
      startDate: '',
      endDate: '',
      hoursPerWeek: '',
      weeksPerYear: '',
      isOngoing: false,
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.category || !formData.role) {
      toast.error(t('validation.activityRequired'));
      return;
    }

    const data = {
      name: formData.name,
      category: formData.category,
      role: formData.role,
      organization: formData.organization || undefined,
      description: formData.description || undefined,
      startDate: formData.startDate || undefined,
      endDate: formData.isOngoing ? undefined : formData.endDate || undefined,
      hoursPerWeek: formData.hoursPerWeek ? parseInt(formData.hoursPerWeek) : undefined,
      weeksPerYear: formData.weeksPerYear ? parseInt(formData.weeksPerYear) : undefined,
      isOngoing: formData.isOngoing,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('form.editActivity') : t('form.addActivity')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('form.activityName')} *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder={t('form.activityNamePlaceholder')}
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('form.activityCategory')} *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_CATEGORY_KEYS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {t(`activityCategories.${c.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('form.role')} *</Label>
              <Input
                value={formData.role}
                onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
                placeholder={t('form.rolePlaceholder')}
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('form.organization')}</Label>
            <Input
              value={formData.organization}
              onChange={(e) => setFormData((p) => ({ ...p, organization: e.target.value }))}
              placeholder={t('form.organizationPlaceholder')}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('form.activityDescription')}</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder={t('form.activityDescPlaceholder')}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{formData.description.length}/500</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('form.startDate')}</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('form.endDate')}</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                disabled={formData.isOngoing}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isOngoing"
              checked={formData.isOngoing}
              onCheckedChange={(checked) =>
                setFormData((p) => ({ ...p, isOngoing: checked as boolean }))
              }
            />
            <Label htmlFor="isOngoing" className="cursor-pointer">
              {t('form.ongoing')}
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('form.hoursPerWeek')}</Label>
              <Input
                type="number"
                value={formData.hoursPerWeek}
                onChange={(e) => setFormData((p) => ({ ...p, hoursPerWeek: e.target.value }))}
                placeholder="1 - 40"
                min={1}
                max={40}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('form.weeksPerYear')}</Label>
              <Input
                type="number"
                value={formData.weeksPerYear}
                onChange={(e) => setFormData((p) => ({ ...p, weeksPerYear: e.target.value }))}
                placeholder="1 - 52"
                min={1}
                max={52}
              />
            </div>
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





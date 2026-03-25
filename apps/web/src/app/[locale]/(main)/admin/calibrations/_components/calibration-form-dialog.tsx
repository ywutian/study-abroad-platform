'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { API_ROUTES, schoolRoutes } from '@study-abroad/shared';
import { getSchoolName } from '@/lib/utils';

interface SchoolOption {
  id: string;
  name: string;
  nameZh?: string;
}

interface CalibrationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCalibration?: {
    id: string;
    schoolId: string;
    multiplier: string;
    reason: string | null;
    school: { id: string; name: string; nameZh: string | null };
  } | null;
  prefillSchoolId?: string;
  prefillSchoolName?: string;
  prefillMultiplier?: number;
  onSuccess?: () => void;
}

/** Convert multiplier (e.g. 1.15) to percentage (e.g. 15) */
function multiplierToPercent(m: number): number {
  return Math.round((m - 1) * 100);
}

/** Convert percentage (e.g. 15) to multiplier (e.g. 1.15) */
function percentToMultiplier(p: number): number {
  return Math.round((1 + p / 100) * 1000) / 1000;
}

export function CalibrationFormDialog({
  open,
  onOpenChange,
  editingCalibration,
  prefillSchoolId,
  prefillSchoolName,
  prefillMultiplier,
  onSuccess,
}: CalibrationFormDialogProps) {
  const t = useTranslations('admin.calibrations');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [schoolId, setSchoolId] = useState('');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [percent, setPercent] = useState(0);
  const [reason, setReason] = useState('');

  const isEditing = !!editingCalibration;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editingCalibration) {
        setSchoolId(editingCalibration.schoolId);
        setPercent(multiplierToPercent(Number(editingCalibration.multiplier)));
        setReason(editingCalibration.reason || '');
        setSchoolQuery('');
      } else if (prefillSchoolId) {
        setSchoolId(prefillSchoolId);
        setSchoolQuery(prefillSchoolName || '');
        setPercent(prefillMultiplier ? multiplierToPercent(prefillMultiplier) : 0);
        setReason('');
      } else {
        setSchoolId('');
        setSchoolQuery('');
        setPercent(0);
        setReason('');
      }
    }
  }, [open, editingCalibration, prefillSchoolId, prefillSchoolName, prefillMultiplier]);

  const { data: schoolOptions = [] } = useQuery<SchoolOption[]>({
    queryKey: ['schoolSearch', schoolQuery],
    queryFn: async () => {
      const r = (await apiClient.get(schoolRoutes.list(), {
        params: { search: schoolQuery, pageSize: 10 },
      })) as { items?: SchoolOption[] };
      return r.items ?? (r as unknown as SchoolOption[]);
    },
    enabled: schoolQuery.length >= 2 && !isEditing && !schoolId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { schoolId: string; multiplier: number; reason?: string }) =>
      apiClient.post(`${API_ROUTES.ADMIN}/calibrations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCalibrations'] });
      queryClient.invalidateQueries({ queryKey: ['adminCalibrationStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminCalibrationSuggestions'] });
      toast.success(t('created'));
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { multiplier?: number; reason?: string } }) =>
      apiClient.put(`${API_ROUTES.ADMIN}/calibrations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCalibrations'] });
      queryClient.invalidateQueries({ queryKey: ['adminCalibrationStats'] });
      toast.success(t('updated'));
      onOpenChange(false);
      onSuccess?.();
    },
  });

  function handleSubmit() {
    const multiplier = percentToMultiplier(percent);
    if (multiplier < 0.5 || multiplier > 2.0) return;

    if (isEditing && editingCalibration) {
      updateMutation.mutate({
        id: editingCalibration.id,
        data: { multiplier, reason: reason || undefined },
      });
    } else {
      createMutation.mutate({
        schoolId,
        multiplier,
        reason: reason || undefined,
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const previewAfter = useMemo(() => {
    const multiplier = percentToMultiplier(percent);
    return Math.min(98, Math.round(50 * multiplier));
  }, [percent]);

  const percentLabel = percent >= 0 ? `+${percent}%` : `${percent}%`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? t('editTitle') : t('create')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* School Search (only for create) */}
          {!isEditing && (
            <div className="space-y-2">
              <Label>{t('school')}</Label>
              {schoolId && prefillSchoolName ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{prefillSchoolName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-muted-foreground"
                    onClick={() => {
                      setSchoolId('');
                      setSchoolQuery('');
                    }}
                  >
                    ×
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder={t('searchSchool')}
                      value={schoolQuery}
                      onChange={(e) => {
                        setSchoolQuery(e.target.value);
                        setSchoolId('');
                      }}
                    />
                  </div>
                  {schoolOptions.length > 0 && !schoolId && (
                    <div className="border rounded-md max-h-40 overflow-auto">
                      {schoolOptions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setSchoolId(s.id);
                            setSchoolQuery(getSchoolName(s, locale));
                          }}
                        >
                          {getSchoolName(s, locale)}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {isEditing && (
            <div className="space-y-1">
              <Label>{t('school')}</Label>
              <p className="text-sm text-muted-foreground">
                {getSchoolName(editingCalibration!.school, locale)}
              </p>
            </div>
          )}

          {/* Adjustment Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('adjustment')}</Label>
              <span
                className={`text-sm font-semibold ${
                  percent > 0
                    ? 'text-green-600 dark:text-green-400'
                    : percent < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                }`}
              >
                {percentLabel}
              </span>
            </div>
            <Slider
              value={[percent]}
              onValueChange={([v]) => setPercent(v)}
              min={-50}
              max={100}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-50%</span>
              <span>0%</span>
              <span>+100%</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('adjustmentHelper')}</p>
          </div>

          {/* Effect Preview */}
          <div className="rounded-md bg-muted/50 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t('preview')}</p>
            <div className="flex items-center gap-2 text-sm">
              <span>
                {t('previewBefore')}: <strong>50%</strong>
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span
                className={
                  previewAfter > 50
                    ? 'text-green-600 dark:text-green-400'
                    : previewAfter < 50
                      ? 'text-red-600 dark:text-red-400'
                      : ''
                }
              >
                {t('previewAfter')}: <strong>{previewAfter}%</strong>
              </span>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>{t('reason')}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isPending || (!isEditing && !schoolId)}
            className="w-full"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? t('save') : t('create')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

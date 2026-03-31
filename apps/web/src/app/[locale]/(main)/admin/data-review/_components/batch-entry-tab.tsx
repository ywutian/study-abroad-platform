/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { adminRoutes } from '@study-abroad/shared';

import type { BatchRow } from './batch-entry-types';
import { MAX_ROWS, createEmptyRow, isRowValid } from './batch-entry-types';
import { BatchRowComponent } from './batch-row';
import { PasteDialog, ActivitiesEditorDialog, AwardsEditorDialog } from './batch-editor-dialogs';

export function BatchEntryTab() {
  const t = useTranslations('admin.dataReview.batchEntry');
  const te = useTranslations('admin.dataReview.enums');
  const [rows, setRows] = useState<BatchRow[]>([createEmptyRow()]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [editingActivities, setEditingActivities] = useState<string | null>(null);
  const [editingAwards, setEditingAwards] = useState<string | null>(null);

  const validCount = rows.filter(isRowValid).length;

  const submitMutation = useMutation({
    mutationFn: async (items: BatchRow[]) => {
      const payload = items.filter(isRowValid).map((row) => ({
        school: row.school,
        year: parseInt(row.year, 10),
        round: row.round || undefined,
        result: row.result,
        major: row.major || undefined,
        gpa: row.gpa || undefined,
        sat: row.sat || undefined,
        act: row.act || undefined,
        toefl: row.toefl || undefined,
        apCount: row.apCount ? parseInt(row.apCount, 10) : undefined,
        apSubjects: row.apSubjects || undefined,
        ibScore: row.ibScore ? parseInt(row.ibScore, 10) : undefined,
        highSchoolType: row.hsType || undefined,
        curriculum: row.curriculum || undefined,
        demographicTags: row.demographics
          ? row.demographics
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        activities:
          row.activities.length > 0
            ? row.activities
                .map((a) => `${a.category} - ${a.description}${a.role ? ` (${a.role})` : ''}`)
                .join(';')
            : undefined,
        awards: row.awards.length > 0 ? row.awards.map((a) => a.name).join(';') : undefined,
        financialAid: row.financialAid || undefined,
        enrollmentStatus: row.enrollmentStatus || undefined,
        narrative: row.narrative || undefined,
        tags: row.tags || undefined,
      }));

      return apiClient.post(adminRoutes.casesBatchImport(), {
        items: payload,
        visibility: 'ANONYMOUS',
        autoVerify: false,
      });
    },
    onSuccess: () => {
      toast.success(t('submitSuccess', { count: validCount }));
      setRows([createEmptyRow()]);
    },
  });

  const addRow = useCallback(() => {
    setRows((prev) => {
      if (prev.length >= MAX_ROWS) {
        toast.error(t('maxRows', { max: MAX_ROWS }));
        return prev;
      }
      return [...prev, createEmptyRow()];
    });
  }, [t]);

  const addRows = useCallback(() => {
    setRows((prev) => {
      const remaining = MAX_ROWS - prev.length;
      const count = Math.min(5, remaining);
      if (count <= 0) {
        toast.error(t('maxRows', { max: MAX_ROWS }));
        return prev;
      }
      return [...prev, ...Array.from({ length: count }, createEmptyRow)];
    });
  }, [t]);

  const deleteRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const duplicateRow = useCallback((id: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], id: crypto.randomUUID() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const updateRow = useCallback((id: string, field: keyof BatchRow, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }, []);

  const handlePaste = useCallback(
    (text: string) => {
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) return;

      const headers = lines[0].split('\t').map((h) => h.trim().toLowerCase());
      const headerMap: Record<string, string> = {
        school: 'school',
        学校: 'school',
        year: 'year',
        年份: 'year',
        result: 'result',
        结果: 'result',
        round: 'round',
        轮次: 'round',
        major: 'major',
        专业: 'major',
        gpa: 'gpa',
        sat: 'sat',
        act: 'act',
        toefl: 'toefl',
        tags: 'tags',
        标签: 'tags',
      };

      const colMap = headers.map((h) => headerMap[h] || h);
      const newRows: BatchRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split('\t');
        const row = createEmptyRow();
        colMap.forEach((field, idx) => {
          if (field in row && cells[idx]) {
            (row as any)[field] = cells[idx].trim();
          }
        });
        if (row.school || row.result) {
          newRows.push(row);
        }
      }

      if (newRows.length > 0) {
        setRows((prev) =>
          [...prev.filter((r) => r.school || r.result), ...newRows].slice(0, MAX_ROWS)
        );
        toast.success(t('parsedRows', { count: newRows.length }));
      }
      setPasteOpen(false);
    },
    [t]
  );

  const handleSubmit = () => {
    if (validCount === 0) {
      toast.error(t('validationError'));
      return;
    }
    submitMutation.mutate(rows);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t('addRow')}
        </Button>
        <Button size="sm" variant="outline" onClick={addRows}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t('addRows')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
          <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
          {t('paste')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setRows([createEmptyRow()])}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {t('clear')}
        </Button>
        <div className="ml-auto">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={validCount === 0 || submitMutation.isPending}
          >
            {submitMutation.isPending
              ? t('submitting')
              : t('submit', { valid: validCount, total: rows.length })}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 px-2 py-1.5 text-left font-medium">
                #
              </th>
              <th className="sticky left-8 z-10 min-w-[180px] bg-muted/50 px-2 py-1.5 text-left font-medium">
                {t('school')} *
              </th>
              <th className="min-w-[80px] px-2 py-1.5 text-left font-medium">{t('year')} *</th>
              <th className="min-w-[110px] px-2 py-1.5 text-left font-medium">{t('result')} *</th>
              <th className="min-w-[90px] px-2 py-1.5 text-left font-medium">{t('round')}</th>
              <th className="min-w-[120px] px-2 py-1.5 text-left font-medium">{t('major')}</th>
              <th className="min-w-[80px] px-2 py-1.5 text-left font-medium">{t('gpa')}</th>
              <th className="min-w-[80px] px-2 py-1.5 text-left font-medium">{t('sat')}</th>
              <th className="min-w-[80px] px-2 py-1.5 text-left font-medium">{t('act')}</th>
              <th className="min-w-[80px] px-2 py-1.5 text-left font-medium">{t('toefl')}</th>
              <th className="min-w-[70px] px-2 py-1.5 text-left font-medium">{t('apCount')}</th>
              <th className="min-w-[110px] px-2 py-1.5 text-left font-medium">{t('hsType')}</th>
              <th className="min-w-[100px] px-2 py-1.5 text-left font-medium">{t('curriculum')}</th>
              <th className="min-w-[90px] px-2 py-1.5 text-left font-medium">{t('activities')}</th>
              <th className="min-w-[90px] px-2 py-1.5 text-left font-medium">{t('awards')}</th>
              <th className="min-w-[120px] px-2 py-1.5 text-left font-medium">{t('tags')}</th>
              <th className="min-w-[60px] px-2 py-1.5 text-left font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={17} className="py-8 text-center text-muted-foreground">
                  {t('noRows')}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <BatchRowComponent
                  key={row.id}
                  row={row}
                  index={idx}
                  onUpdate={updateRow}
                  onDelete={deleteRow}
                  onDuplicate={duplicateRow}
                  onEditActivities={() => setEditingActivities(row.id)}
                  onEditAwards={() => setEditingAwards(row.id)}
                  t={t}
                  te={te}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paste Dialog */}
      <PasteDialog open={pasteOpen} onOpenChange={setPasteOpen} onPaste={handlePaste} t={t} />

      {/* Activities Editor Dialog */}
      {editingActivities && (
        <ActivitiesEditorDialog
          activities={rows.find((r) => r.id === editingActivities)?.activities || []}
          onSave={(activities) => {
            updateRow(editingActivities, 'activities', activities);
            setEditingActivities(null);
          }}
          onClose={() => setEditingActivities(null)}
          t={t}
          te={te}
        />
      )}

      {/* Awards Editor Dialog */}
      {editingAwards && (
        <AwardsEditorDialog
          awards={rows.find((r) => r.id === editingAwards)?.awards || []}
          onSave={(awards) => {
            updateRow(editingAwards, 'awards', awards);
            setEditingAwards(null);
          }}
          onClose={() => setEditingAwards(null)}
          t={t}
          te={te}
        />
      )}
    </div>
  );
}

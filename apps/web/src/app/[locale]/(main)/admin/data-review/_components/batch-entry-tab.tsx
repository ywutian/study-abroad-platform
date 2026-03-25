'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, ClipboardPaste, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api/client';
import { API_ROUTES } from '@study-abroad/shared';

// ============ Types ============

interface BatchRow {
  id: string;
  school: string;
  schoolId?: string;
  year: string;
  round: string;
  result: string;
  major: string;
  gpa: string;
  sat: string;
  act: string;
  toefl: string;
  apCount: string;
  apSubjects: string;
  ibScore: string;
  hsType: string;
  curriculum: string;
  demographics: string;
  activities: ActivityItem[];
  awards: AwardItem[];
  financialAid: string;
  enrollmentStatus: string;
  narrative: string;
  tags: string;
}

interface ActivityItem {
  category: string;
  description: string;
  role: string;
  tier: string;
  hoursPerWeek: string;
  weeksPerYear: string;
}

interface AwardItem {
  name: string;
  level: string;
  competition: string;
  tier: string;
  year: string;
}

interface SchoolOption {
  id: string;
  name: string;
  nameZh?: string;
}

// ============ Constants ============

const RESULT_OPTIONS = ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'];
const ROUND_OPTIONS = ['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'];
const HS_TYPE_OPTIONS = [
  'PUBLIC_US',
  'PRIVATE_US',
  'BOARDING_US',
  'INTL_CN',
  'PUBLIC_CN',
  'PRIVATE_CN',
  'INTL_OTHER',
  'PUBLIC_OTHER',
  'PRIVATE_OTHER',
];
const CURRICULUM_OPTIONS = ['AP', 'IB', 'A_LEVEL', 'GAOKAO', 'CANADIAN', 'AUSTRALIAN', 'OTHER'];
const AID_OPTIONS = [
  'no_aid',
  'need_based',
  'merit',
  'need_and_merit',
  'full_tuition',
  'full_ride',
  'loan_only',
  'none_received',
  'unknown',
];
const AWARD_LEVEL_OPTIONS = ['school', 'regional', 'state', 'national', 'international'];
const ACTIVITY_CATEGORY_OPTIONS = [
  'RESEARCH',
  'ACADEMIC',
  'CLUB',
  'ATHLETICS',
  'COMMUNITY_SERVICE',
  'ARTS',
  'WORK',
  'ENTREPRENEURSHIP',
  'LEADERSHIP',
  'WRITING',
  'OTHER',
];
const MAX_ROWS = 100;

function createEmptyRow(): BatchRow {
  return {
    id: crypto.randomUUID(),
    school: '',
    year: new Date().getFullYear().toString(),
    round: '',
    result: '',
    major: '',
    gpa: '',
    sat: '',
    act: '',
    toefl: '',
    apCount: '',
    apSubjects: '',
    ibScore: '',
    hsType: '',
    curriculum: '',
    demographics: '',
    activities: [],
    awards: [],
    financialAid: '',
    enrollmentStatus: '',
    narrative: '',
    tags: '',
  };
}

function isRowValid(row: BatchRow): boolean {
  return !!(row.school && row.year && row.result);
}

// ============ School Search Hook ============

function useSchoolSearch() {
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cacheRef = useRef<Map<string, SchoolOption[]>>(new Map());

  const { data: results = [] } = useQuery({
    queryKey: ['schoolSearch', query],
    queryFn: async () => {
      if (query.length < 2) return [];
      if (cacheRef.current.has(query)) return cacheRef.current.get(query)!;
      const res = await apiClient.get<{ data: SchoolOption[] }>(
        `/schools?search=${encodeURIComponent(query)}&pageSize=10`
      );
      const schools = (res as any)?.data || res || [];
      cacheRef.current.set(query, schools);
      return schools;
    },
    enabled: query.length >= 2,
    staleTime: 60_000,
  });

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(q), 300);
  }, []);

  return { results, search };
}

// ============ Main Component ============

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

      return apiClient.post(`${API_ROUTES.ADMIN}/cases/batch-import`, {
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

// ============ Row Component ============

function BatchRowComponent({
  row,
  index,
  onUpdate,
  onDelete,
  onDuplicate,
  onEditActivities,
  onEditAwards,
  t,
  te,
}: {
  row: BatchRow;
  index: number;
  onUpdate: (id: string, field: keyof BatchRow, value: any) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEditActivities: () => void;
  onEditAwards: () => void;
  t: ReturnType<typeof useTranslations>;
  te: ReturnType<typeof useTranslations>;
}) {
  const valid = isRowValid(row);
  const rowClass = valid ? '' : row.school || row.result ? 'bg-destructive/5' : '';

  return (
    <tr className={`border-b border-border hover:bg-muted/30 ${rowClass}`}>
      <td className="sticky left-0 z-10 bg-background px-2 py-1 text-muted-foreground">
        {index + 1}
      </td>
      <td className="sticky left-8 z-10 bg-background px-1 py-1">
        <Input
          value={row.school}
          onChange={(e) => onUpdate(row.id, 'school', e.target.value)}
          placeholder={t('schoolSearch')}
          className="h-7 text-xs"
        />
      </td>
      <td className="px-1 py-1">
        <Input
          value={row.year}
          onChange={(e) => onUpdate(row.id, 'year', e.target.value)}
          className="h-7 w-[70px] text-xs"
          type="number"
        />
      </td>
      <td className="px-1 py-1">
        <Select value={row.result} onValueChange={(v) => onUpdate(row.id, 'result', v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="--" />
          </SelectTrigger>
          <SelectContent>
            {RESULT_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {te(`result.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-1 py-1">
        <Select value={row.round} onValueChange={(v) => onUpdate(row.id, 'round', v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="--" />
          </SelectTrigger>
          <SelectContent>
            {ROUND_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {te(`round.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-1 py-1">
        <Input
          value={row.major}
          onChange={(e) => onUpdate(row.id, 'major', e.target.value)}
          className="h-7 text-xs"
        />
      </td>
      <td className="px-1 py-1">
        <Input
          value={row.gpa}
          onChange={(e) => onUpdate(row.id, 'gpa', e.target.value)}
          className="h-7 w-[70px] text-xs"
          placeholder="3.9"
        />
      </td>
      <td className="px-1 py-1">
        <Input
          value={row.sat}
          onChange={(e) => onUpdate(row.id, 'sat', e.target.value)}
          className="h-7 w-[70px] text-xs"
          placeholder="1550"
        />
      </td>
      <td className="px-1 py-1">
        <Input
          value={row.act}
          onChange={(e) => onUpdate(row.id, 'act', e.target.value)}
          className="h-7 w-[60px] text-xs"
          placeholder="35"
        />
      </td>
      <td className="px-1 py-1">
        <Input
          value={row.toefl}
          onChange={(e) => onUpdate(row.id, 'toefl', e.target.value)}
          className="h-7 w-[60px] text-xs"
          placeholder="115"
        />
      </td>
      <td className="px-1 py-1">
        <Input
          value={row.apCount}
          onChange={(e) => onUpdate(row.id, 'apCount', e.target.value)}
          className="h-7 w-[50px] text-xs"
          type="number"
        />
      </td>
      <td className="px-1 py-1">
        <Select value={row.hsType} onValueChange={(v) => onUpdate(row.id, 'hsType', v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="--" />
          </SelectTrigger>
          <SelectContent>
            {HS_TYPE_OPTIONS.map((h) => (
              <SelectItem key={h} value={h}>
                {te(`hsType.${h}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-1 py-1">
        <Select value={row.curriculum} onValueChange={(v) => onUpdate(row.id, 'curriculum', v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="--" />
          </SelectTrigger>
          <SelectContent>
            {CURRICULUM_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {te(`curriculum.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-1 py-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onEditActivities}>
          {row.activities.length > 0 ? (
            <Badge variant="secondary" className="mr-1">
              {row.activities.length}
            </Badge>
          ) : null}
          {t('activities')}
        </Button>
      </td>
      <td className="px-1 py-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onEditAwards}>
          {row.awards.length > 0 ? (
            <Badge variant="secondary" className="mr-1">
              {row.awards.length}
            </Badge>
          ) : null}
          {t('awards')}
        </Button>
      </td>
      <td className="px-1 py-1">
        <Input
          value={row.tags}
          onChange={(e) => onUpdate(row.id, 'tags', e.target.value)}
          className="h-7 text-xs"
          placeholder="tag1;tag2"
        />
      </td>
      <td className="px-1 py-1">
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onDuplicate(row.id)}
            title={t('duplicateRow')}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={() => onDelete(row.id)}
            title={t('deleteRow')}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ============ Paste Dialog ============

function PasteDialog({
  open,
  onOpenChange,
  onPaste,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaste: (text: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [text, setText] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pasteTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('pasteDescription')}</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('pasteArea')}
          rows={10}
          className="font-mono text-xs"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('pasteCancel')}
          </Button>
          <Button
            onClick={() => {
              onPaste(text);
              setText('');
            }}
          >
            {t('pasteImport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Activities Editor Dialog ============

function ActivitiesEditorDialog({
  activities,
  onSave,
  onClose,
  t,
  te,
}: {
  activities: ActivityItem[];
  onSave: (items: ActivityItem[]) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
  te: ReturnType<typeof useTranslations>;
}) {
  const [items, setItems] = useState<ActivityItem[]>(
    activities.length > 0
      ? activities
      : [{ category: '', description: '', role: '', tier: '', hoursPerWeek: '', weeksPerYear: '' }]
  );

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { category: '', description: '', role: '', tier: '', hoursPerWeek: '', weeksPerYear: '' },
    ]);

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof ActivityItem, value: string) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('activitiesEditor')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {items.map((item, idx) => (
              <div key={idx} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => removeItem(idx)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">{t('category')}</label>
                    <Select
                      value={item.category}
                      onValueChange={(v) => updateItem(idx, 'category', v)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_CATEGORY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {te(`activityCategory.${c}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('role')}</label>
                    <Input
                      value={item.role}
                      onChange={(e) => updateItem(idx, 'role', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('description')}</label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">{t('tier')}</label>
                    <Select value={item.tier} onValueChange={(v) => updateItem(idx, 'tier', v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        {['1', '2', '3', '4'].map((v) => (
                          <SelectItem key={v} value={v}>
                            Tier {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('hoursPerWeek')}</label>
                    <Input
                      value={item.hoursPerWeek}
                      onChange={(e) => updateItem(idx, 'hoursPerWeek', e.target.value)}
                      className="h-7 text-xs"
                      type="number"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('weeksPerYear')}</label>
                    <Input
                      value={item.weeksPerYear}
                      onChange={(e) => updateItem(idx, 'weeksPerYear', e.target.value)}
                      className="h-7 text-xs"
                      type="number"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('addActivity')}
          </Button>
          <Button size="sm" onClick={() => onSave(items.filter((i) => i.description))}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Awards Editor Dialog ============

function AwardsEditorDialog({
  awards,
  onSave,
  onClose,
  t,
  te,
}: {
  awards: AwardItem[];
  onSave: (items: AwardItem[]) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
  te: ReturnType<typeof useTranslations>;
}) {
  const [items, setItems] = useState<AwardItem[]>(
    awards.length > 0 ? awards : [{ name: '', level: '', competition: '', tier: '', year: '' }]
  );

  const addItem = () =>
    setItems((prev) => [...prev, { name: '', level: '', competition: '', tier: '', year: '' }]);

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof AwardItem, value: string) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('awardsEditor')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {items.map((item, idx) => (
              <div key={idx} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => removeItem(idx)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">{t('name')}</label>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('level')}</label>
                    <Select value={item.level} onValueChange={(v) => updateItem(idx, 'level', v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        {AWARD_LEVEL_OPTIONS.map((l) => (
                          <SelectItem key={l} value={l}>
                            {te(`awardLevel.${l}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">{t('competition')}</label>
                    <Input
                      value={item.competition}
                      onChange={(e) => updateItem(idx, 'competition', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('tier')}</label>
                    <Select value={item.tier} onValueChange={(v) => updateItem(idx, 'tier', v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        {['1', '2', '3', '4', '5'].map((v) => (
                          <SelectItem key={v} value={v}>
                            Tier {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('awardYear')}</label>
                    <Input
                      value={item.year}
                      onChange={(e) => updateItem(idx, 'year', e.target.value)}
                      className="h-7 text-xs"
                      type="number"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('addAward')}
          </Button>
          <Button size="sm" onClick={() => onSave(items.filter((i) => i.name))}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

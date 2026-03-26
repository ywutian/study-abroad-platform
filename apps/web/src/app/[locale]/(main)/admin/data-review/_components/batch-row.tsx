/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { useTranslations } from 'next-intl';
import type { BatchRow } from './batch-entry-types';
import {
  RESULT_OPTIONS,
  ROUND_OPTIONS,
  HS_TYPE_OPTIONS,
  CURRICULUM_OPTIONS,
  isRowValid,
} from './batch-entry-types';

interface BatchRowComponentProps {
  row: BatchRow;
  index: number;
  onUpdate: (id: string, field: keyof BatchRow, value: any) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEditActivities: () => void;
  onEditAwards: () => void;
  t: ReturnType<typeof useTranslations>;
  te: ReturnType<typeof useTranslations>;
}

export function BatchRowComponent({
  row,
  index,
  onUpdate,
  onDelete,
  onDuplicate,
  onEditActivities,
  onEditAwards,
  t,
  te,
}: BatchRowComponentProps) {
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

// @i18n-skip-file Resume editor — content mirrors the English PDF output for ATS
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { AwardItem } from '@study-abroad/shared';

interface AwardsEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}

export function AwardsEditor({ content, onChange }: AwardsEditorProps) {
  const items = (content.items ?? []) as AwardItem[];

  const updateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newItem: AwardItem = {
      id: crypto.randomUUID(),
      name: '',
      level: '',
    };
    onChange({ ...content, items: [...items, newItem] });
  };

  const removeItem = (index: number) => {
    onChange({ ...content, items: items.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className="space-y-2">
          {index > 0 && <Separator />}
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => removeItem(index)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Award Name</Label>
              <Input
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Level</Label>
              <Input
                value={item.level}
                onChange={(e) => updateItem(index, 'level', e.target.value)}
                placeholder="National / State / School"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Input
                value={item.year ?? ''}
                onChange={(e) =>
                  updateItem(index, 'year', e.target.value ? Number(e.target.value) : undefined)
                }
                className="h-7 text-xs"
                type="number"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                value={item.description ?? ''}
                onChange={(e) => updateItem(index, 'description', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
        <Plus className="mr-1 h-3 w-3" />
        Add Award
      </Button>
    </div>
  );
}

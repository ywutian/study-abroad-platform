'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { BulletEditor } from '../bullet-editor';

interface CustomItem {
  id: string;
  title?: string;
  subtitle?: string;
  dateRange?: string;
  bullets: string[];
}

interface CustomEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}

export function CustomEditor({ content, onChange }: CustomEditorProps) {
  const items = ((content as any).items ?? []) as CustomItem[];

  const updateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newItem: CustomItem = {
      id: crypto.randomUUID(),
      title: '',
      bullets: [],
    };
    onChange({ ...content, items: [...items, newItem] });
  };

  const removeItem = (index: number) => {
    onChange({ ...content, items: items.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
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
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={item.title ?? ''}
                onChange={(e) => updateItem(index, 'title', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subtitle</Label>
              <Input
                value={item.subtitle ?? ''}
                onChange={(e) => updateItem(index, 'subtitle', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Date Range</Label>
              <Input
                value={item.dateRange ?? ''}
                onChange={(e) => updateItem(index, 'dateRange', e.target.value)}
                placeholder="e.g., Sep 2023 – Present"
                className="h-7 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bullet Points</Label>
            <BulletEditor
              bullets={item.bullets}
              onChange={(bullets) => updateItem(index, 'bullets', bullets)}
            />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
        <Plus className="mr-1 h-3 w-3" />
        Add Item
      </Button>
    </div>
  );
}

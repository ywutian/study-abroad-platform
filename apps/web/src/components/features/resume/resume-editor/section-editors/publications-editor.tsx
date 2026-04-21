// @i18n-skip-file Resume editor — content mirrors the English PDF output for ATS
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { PublicationItem } from '@study-abroad/shared';

interface PublicationsEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}

export function PublicationsEditor({ content, onChange }: PublicationsEditorProps) {
  const items = (content.items ?? []) as PublicationItem[];

  const updateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newItem: PublicationItem = {
      id: crypto.randomUUID(),
      title: '',
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
              <Label className="text-xs">Title</Label>
              <Input
                value={item.title}
                onChange={(e) => updateItem(index, 'title', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Authors</Label>
              <Input
                value={item.authors ?? ''}
                onChange={(e) => updateItem(index, 'authors', e.target.value)}
                placeholder="Last, F., Last, F., ..."
                className="h-7 text-xs"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Venue / Journal</Label>
              <Input
                value={item.venue ?? ''}
                onChange={(e) => updateItem(index, 'venue', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                value={item.date ?? ''}
                onChange={(e) => updateItem(index, 'date', e.target.value)}
                className="h-7 text-xs"
                type="month"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Input
                value={item.status ?? ''}
                onChange={(e) => updateItem(index, 'status', e.target.value)}
                placeholder="Published / Under Review / Submitted"
                className="h-7 text-xs"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">DOI (optional)</Label>
              <Input
                value={item.doi ?? ''}
                onChange={(e) => updateItem(index, 'doi', e.target.value)}
                placeholder="10.xxxx/xxxxx"
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
        <Plus className="mr-1 h-3 w-3" />
        Add Publication
      </Button>
    </div>
  );
}

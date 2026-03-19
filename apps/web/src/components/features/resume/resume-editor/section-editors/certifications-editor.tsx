'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { CertificationItem } from '@study-abroad/shared';

interface CertificationsEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}

export function CertificationsEditor({ content, onChange }: CertificationsEditorProps) {
  const items = (content.items ?? []) as CertificationItem[];

  const updateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newItem: CertificationItem = {
      id: crypto.randomUUID(),
      name: '',
      issuer: '',
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
              <Label className="text-xs">Certification Name</Label>
              <Input
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Issuer</Label>
              <Input
                value={item.issuer}
                onChange={(e) => updateItem(index, 'issuer', e.target.value)}
                placeholder="e.g., AWS, Google, Coursera"
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
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">URL (optional)</Label>
              <Input
                value={item.url ?? ''}
                onChange={(e) => updateItem(index, 'url', e.target.value)}
                placeholder="https://..."
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
        <Plus className="mr-1 h-3 w-3" />
        Add Certification
      </Button>
    </div>
  );
}

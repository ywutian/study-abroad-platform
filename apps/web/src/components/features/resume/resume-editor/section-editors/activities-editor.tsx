'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { BulletEditor } from '../bullet-editor';
import type { ActivityItem } from '@study-abroad/shared';

interface ActivitiesEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}

export function ActivitiesEditor({ content, onChange }: ActivitiesEditorProps) {
  const items = (content.items ?? []) as ActivityItem[];

  const updateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newItem: ActivityItem = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
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
              <Label className="text-xs">Activity Name</Label>
              <Input
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Input
                value={item.role}
                onChange={(e) => updateItem(index, 'role', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Organization</Label>
              <Input
                value={item.organization ?? ''}
                onChange={(e) => updateItem(index, 'organization', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Input
                value={item.category ?? ''}
                onChange={(e) => updateItem(index, 'category', e.target.value)}
                placeholder="e.g., LEADERSHIP"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input
                value={item.startDate ?? ''}
                onChange={(e) => updateItem(index, 'startDate', e.target.value)}
                className="h-7 text-xs"
                type="month"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input
                value={item.endDate ?? ''}
                onChange={(e) => updateItem(index, 'endDate', e.target.value)}
                className="h-7 text-xs"
                type="month"
                disabled={item.isOngoing}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={item.isOngoing ?? false}
              onCheckedChange={(v) => updateItem(index, 'isOngoing', v)}
            />
            <Label className="text-xs">Ongoing</Label>
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
        Add Activity
      </Button>
    </div>
  );
}

'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { BulletEditor } from '../bullet-editor';
import type { ExperienceItem } from '@study-abroad/shared';

interface ExperienceEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  type: string;
}

const LABELS: Record<string, { title: string; org: string; add: string }> = {
  WORK_EXPERIENCE: { title: 'Job Title', org: 'Company', add: 'Add Experience' },
  RESEARCH: { title: 'Research Title', org: 'Institution', add: 'Add Research' },
  TEACHING: { title: 'Course/Position', org: 'Institution', add: 'Add Teaching' },
};

export function ExperienceEditor({ content, onChange, type }: ExperienceEditorProps) {
  const items = (content.items ?? []) as ExperienceItem[];
  const labels = LABELS[type] ?? LABELS.WORK_EXPERIENCE;

  const updateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newItem: ExperienceItem = {
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
              <Label className="text-xs">{labels.title}</Label>
              <Input
                value={item.title}
                onChange={(e) => updateItem(index, 'title', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{labels.org}</Label>
              <Input
                value={item.company ?? item.institution ?? ''}
                onChange={(e) =>
                  updateItem(
                    index,
                    type === 'WORK_EXPERIENCE' ? 'company' : 'institution',
                    e.target.value
                  )
                }
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Location</Label>
              <Input
                value={item.location ?? ''}
                onChange={(e) => updateItem(index, 'location', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            {type === 'RESEARCH' && (
              <div className="space-y-1">
                <Label className="text-xs">Advisor</Label>
                <Input
                  value={item.advisor ?? ''}
                  onChange={(e) => updateItem(index, 'advisor', e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            )}
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
                disabled={item.isCurrent}
              />
            </div>
          </div>
          {type === 'WORK_EXPERIENCE' && (
            <div className="flex items-center gap-2">
              <Switch
                checked={item.isCurrent ?? false}
                onCheckedChange={(v) => updateItem(index, 'isCurrent', v)}
              />
              <Label className="text-xs">Current position</Label>
            </div>
          )}
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
        {labels.add}
      </Button>
    </div>
  );
}

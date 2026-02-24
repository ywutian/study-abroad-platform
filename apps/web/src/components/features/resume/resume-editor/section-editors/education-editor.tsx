'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { EducationItem } from '@study-abroad/shared';

interface EducationEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}

export function EducationEditor({ content, onChange }: EducationEditorProps) {
  const items = ((content as any).items ?? []) as EducationItem[];

  const updateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newItem: EducationItem = {
      id: crypto.randomUUID(),
      schoolName: '',
      startDate: '',
      endDate: '',
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
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">School Name</Label>
              <Input
                value={item.schoolName}
                onChange={(e) => updateItem(index, 'schoolName', e.target.value)}
                placeholder="Harvard University"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Degree</Label>
              <Input
                value={item.degree ?? ''}
                onChange={(e) => updateItem(index, 'degree', e.target.value)}
                placeholder="Bachelor of Arts"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Major</Label>
              <Input
                value={item.major ?? ''}
                onChange={(e) => updateItem(index, 'major', e.target.value)}
                placeholder="Computer Science"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">GPA</Label>
              <Input
                value={item.gpa ?? ''}
                onChange={(e) =>
                  updateItem(index, 'gpa', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="3.85"
                className="h-7 text-xs"
                type="number"
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">GPA Scale</Label>
              <Input
                value={item.gpaScale ?? ''}
                onChange={(e) =>
                  updateItem(index, 'gpaScale', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="4.0"
                className="h-7 text-xs"
                type="number"
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input
                value={item.startDate}
                onChange={(e) => updateItem(index, 'startDate', e.target.value)}
                placeholder="2020-09"
                className="h-7 text-xs"
                type="month"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input
                value={item.endDate ?? ''}
                onChange={(e) => updateItem(index, 'endDate', e.target.value)}
                placeholder="2024-05"
                className="h-7 text-xs"
                type="month"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Location</Label>
              <Input
                value={item.location ?? ''}
                onChange={(e) => updateItem(index, 'location', e.target.value)}
                placeholder="Cambridge, MA"
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
        <Plus className="mr-1 h-3 w-3" />
        Add Education
      </Button>
    </div>
  );
}

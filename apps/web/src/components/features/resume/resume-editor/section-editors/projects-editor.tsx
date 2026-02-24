'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { BulletEditor } from '../bullet-editor';
import type { ProjectItem } from '@study-abroad/shared';

interface ProjectsEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}

export function ProjectsEditor({ content, onChange }: ProjectsEditorProps) {
  const items = ((content as any).items ?? []) as ProjectItem[];

  const updateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newItem: ProjectItem = {
      id: crypto.randomUUID(),
      name: '',
      techStack: [],
      bullets: [],
    };
    onChange({ ...content, items: [...items, newItem] });
  };

  const removeItem = (index: number) => {
    onChange({ ...content, items: items.filter((_, i) => i !== index) });
  };

  const addTech = (itemIndex: number, tech: string) => {
    if (!tech.trim()) return;
    const updated = [...items];
    updated[itemIndex] = {
      ...updated[itemIndex],
      techStack: [...(updated[itemIndex].techStack ?? []), tech.trim()],
    };
    onChange({ ...content, items: updated });
  };

  const removeTech = (itemIndex: number, techIndex: number) => {
    const updated = [...items];
    updated[itemIndex] = {
      ...updated[itemIndex],
      techStack: (updated[itemIndex].techStack ?? []).filter(
        (_: string, i: number) => i !== techIndex
      ),
    };
    onChange({ ...content, items: updated });
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
              <Label className="text-xs">Project Name</Label>
              <Input
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL (optional)</Label>
              <Input
                value={item.url ?? ''}
                onChange={(e) => updateItem(index, 'url', e.target.value)}
                placeholder="https://..."
                className="h-7 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Start</Label>
                <Input
                  value={item.startDate ?? ''}
                  onChange={(e) => updateItem(index, 'startDate', e.target.value)}
                  className="h-7 text-xs"
                  type="month"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Input
                  value={item.endDate ?? ''}
                  onChange={(e) => updateItem(index, 'endDate', e.target.value)}
                  className="h-7 text-xs"
                  type="month"
                />
              </div>
            </div>
          </div>
          {/* Tech Stack */}
          <div className="space-y-1">
            <Label className="text-xs">Tech Stack</Label>
            <div className="flex flex-wrap gap-1">
              {(item.techStack ?? []).map((tech, techIndex) => (
                <Badge key={techIndex} variant="secondary" className="gap-1 text-xs">
                  {tech}
                  <button
                    onClick={() => removeTech(index, techIndex)}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              <TechInput onAdd={(tech) => addTech(index, tech)} />
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
        Add Project
      </Button>
    </div>
  );
}

function TechInput({ onAdd }: { onAdd: (tech: string) => void }) {
  const [value, setValue] = useState('');

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          onAdd(value);
          setValue('');
        }
      }}
      placeholder="Add tech..."
      className="h-6 w-24 text-xs"
    />
  );
}

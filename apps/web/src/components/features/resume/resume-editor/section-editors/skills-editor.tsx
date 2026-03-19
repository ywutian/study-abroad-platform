'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import type { SkillCategory } from '@study-abroad/shared';

interface SkillsEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}

export function SkillsEditor({ content, onChange }: SkillsEditorProps) {
  const categories = (content.categories ?? []) as SkillCategory[];

  const updateCategory = (index: number, field: string, value: unknown) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...content, categories: updated });
  };

  const addCategory = () => {
    onChange({
      ...content,
      categories: [...categories, { name: '', items: [] }],
    });
  };

  const removeCategory = (index: number) => {
    onChange({
      ...content,
      categories: categories.filter((_, i) => i !== index),
    });
  };

  const addSkill = (catIndex: number, skill: string) => {
    if (!skill.trim()) return;
    const updated = [...categories];
    updated[catIndex] = {
      ...updated[catIndex],
      items: [...updated[catIndex].items, skill.trim()],
    };
    onChange({ ...content, categories: updated });
  };

  const removeSkill = (catIndex: number, skillIndex: number) => {
    const updated = [...categories];
    updated[catIndex] = {
      ...updated[catIndex],
      items: updated[catIndex].items.filter((_: string, i: number) => i !== skillIndex),
    };
    onChange({ ...content, categories: updated });
  };

  return (
    <div className="space-y-4">
      {categories.map((cat, catIndex) => (
        <div key={catIndex} className="space-y-2">
          {catIndex > 0 && <Separator />}
          <div className="flex items-center gap-2">
            <Input
              value={cat.name}
              onChange={(e) => updateCategory(catIndex, 'name', e.target.value)}
              placeholder="Category (e.g., Languages, Frameworks)"
              className="h-7 text-xs font-medium"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => removeCategory(catIndex)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {cat.items.map((skill, skillIndex) => (
              <Badge key={skillIndex} variant="secondary" className="gap-1 text-xs">
                {skill}
                <button
                  onClick={() => removeSkill(catIndex, skillIndex)}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            <SkillInput onAdd={(skill) => addSkill(catIndex, skill)} />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={addCategory}>
        <Plus className="mr-1 h-3 w-3" />
        Add Category
      </Button>
    </div>
  );
}

function SkillInput({ onAdd }: { onAdd: (skill: string) => void }) {
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
      placeholder="Add skill..."
      className="h-6 w-24 text-xs"
    />
  );
}

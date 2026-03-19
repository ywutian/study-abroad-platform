'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X, GripVertical } from 'lucide-react';

interface BulletEditorProps {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  placeholder?: string;
}

export function BulletEditor({
  bullets,
  onChange,
  placeholder = 'Add a bullet point...',
}: BulletEditorProps) {
  const addBullet = () => {
    onChange([...bullets, '']);
  };

  const updateBullet = (index: number, value: string) => {
    const updated = [...bullets];
    updated[index] = value;
    onChange(updated);
  };

  const removeBullet = (index: number) => {
    onChange(bullets.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      {bullets.map((bullet, index) => (
        <div key={index} className="group flex items-center gap-1">
          <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
          <span className="flex-shrink-0 text-xs text-muted-foreground">{'\u2022'}</span>
          <Input
            value={bullet}
            onChange={(e) => updateBullet(index, e.target.value)}
            placeholder={placeholder}
            className="h-7 text-xs"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100"
            onClick={() => removeBullet(index)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addBullet}>
        <Plus className="mr-1 h-3 w-3" />
        Add bullet
      </Button>
    </div>
  );
}

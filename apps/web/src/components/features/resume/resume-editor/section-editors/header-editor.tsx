// @i18n-skip-file Resume editor — content mirrors the English PDF output for ATS
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { HeaderContent } from '@study-abroad/shared';

interface HeaderEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}

export function HeaderEditor({ content, onChange }: HeaderEditorProps) {
  const data = content as unknown as HeaderContent;

  const update = (field: keyof HeaderContent, value: string) => {
    onChange({ ...content, [field]: value });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1">
        <Label className="text-xs">Full Name</Label>
        <Input
          value={data.name ?? ''}
          onChange={(e) => update('name', e.target.value)}
          placeholder="John Doe"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Email</Label>
        <Input
          value={data.email ?? ''}
          onChange={(e) => update('email', e.target.value)}
          placeholder="john@example.com"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Phone</Label>
        <Input
          value={data.phone ?? ''}
          onChange={(e) => update('phone', e.target.value)}
          placeholder="+1 (555) 123-4567"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Address</Label>
        <Input
          value={data.address ?? ''}
          onChange={(e) => update('address', e.target.value)}
          placeholder="City, State"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">LinkedIn</Label>
        <Input
          value={data.linkedIn ?? ''}
          onChange={(e) => update('linkedIn', e.target.value)}
          placeholder="linkedin.com/in/johndoe"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">GitHub</Label>
        <Input
          value={data.github ?? ''}
          onChange={(e) => update('github', e.target.value)}
          placeholder="github.com/johndoe"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Website</Label>
        <Input
          value={data.website ?? ''}
          onChange={(e) => update('website', e.target.value)}
          placeholder="johndoe.com"
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

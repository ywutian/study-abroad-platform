'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

const CATEGORIES = [
  'ACADEMIC',
  'ARTS',
  'ATHLETICS',
  'COMMUNITY_SERVICE',
  'LEADERSHIP',
  'WORK',
  'RESEARCH',
  'INTERNSHIP',
  'CLUB',
  'HOBBY',
  'OTHER',
] as const;

const TIER_LABELS: Record<number, string> = {
  1: 'Elite',
  2: 'Significant',
  3: 'Notable',
  4: 'General',
};

export type TemplateFormData = {
  name: string;
  nameZh: string;
  category: (typeof CATEGORIES)[number];
  tier: number;
  aliases: string;
  description: string;
};

export { CATEGORIES };

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: TemplateFormData;
  onFormChange: (form: TemplateFormData) => void;
  onSubmit: () => void;
  onReset: () => void;
  isPending: boolean;
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  editingId,
  form,
  onFormChange,
  onSubmit,
  onReset,
  isPending,
}: TemplateFormDialogProps) {
  const t = useTranslations('admin');

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onOpenChange(false);
          onReset();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingId ? 'Edit Activity Template' : 'Create Activity Template'}
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? 'Update activity template details'
              : 'Add a new activity template for student profiles'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder="e.g. Student Council President"
            />
          </div>
          <div className="space-y-2">
            <Label>Chinese Name</Label>
            <Input
              value={form.nameZh}
              onChange={(e) => onFormChange({ ...form, nameZh: e.target.value })}
              placeholder="中文名称"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  onFormChange({ ...form, category: v as (typeof CATEGORIES)[number] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tier (1-4)</Label>
              <Select
                value={String(form.tier)}
                onValueChange={(v) => onFormChange({ ...form, tier: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((tierValue) => (
                    <SelectItem key={tierValue} value={String(tierValue)}>
                      {tierValue} - {TIER_LABELS[tierValue]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Aliases (comma-separated)</Label>
            <Input
              value={form.aliases}
              onChange={(e) => onFormChange({ ...form, aliases: e.target.value })}
              placeholder="e.g. SCP, president, 学生会主席"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              placeholder="Optional description"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onReset();
            }}
          >
            {t('dialogs.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={isPending || !form.name.trim()}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingId ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

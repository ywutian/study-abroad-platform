'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { useTranslations } from 'next-intl';
import type { ActivityItem, AwardItem } from './batch-entry-types';
import { ACTIVITY_CATEGORY_OPTIONS, AWARD_LEVEL_OPTIONS } from './batch-entry-types';

// ============ Paste Dialog ============

export function PasteDialog({
  open,
  onOpenChange,
  onPaste,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaste: (text: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [text, setText] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pasteTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('pasteDescription')}</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('pasteArea')}
          rows={10}
          className="font-mono text-xs"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('pasteCancel')}
          </Button>
          <Button
            onClick={() => {
              onPaste(text);
              setText('');
            }}
          >
            {t('pasteImport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Activities Editor Dialog ============

export function ActivitiesEditorDialog({
  activities,
  onSave,
  onClose,
  t,
  te,
}: {
  activities: ActivityItem[];
  onSave: (items: ActivityItem[]) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
  te: ReturnType<typeof useTranslations>;
}) {
  const [items, setItems] = useState<ActivityItem[]>(
    activities.length > 0
      ? activities
      : [{ category: '', description: '', role: '', tier: '', hoursPerWeek: '', weeksPerYear: '' }]
  );

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { category: '', description: '', role: '', tier: '', hoursPerWeek: '', weeksPerYear: '' },
    ]);

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof ActivityItem, value: string) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('activitiesEditor')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {items.map((item, idx) => (
              <div key={idx} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => removeItem(idx)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">{t('category')}</label>
                    <Select
                      value={item.category}
                      onValueChange={(v) => updateItem(idx, 'category', v)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_CATEGORY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {te(`activityCategory.${c}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('role')}</label>
                    <Input
                      value={item.role}
                      onChange={(e) => updateItem(idx, 'role', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('description')}</label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">{t('tier')}</label>
                    <Select value={item.tier} onValueChange={(v) => updateItem(idx, 'tier', v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        {['1', '2', '3', '4'].map((v) => (
                          <SelectItem key={v} value={v}>
                            Tier {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('hoursPerWeek')}</label>
                    <Input
                      value={item.hoursPerWeek}
                      onChange={(e) => updateItem(idx, 'hoursPerWeek', e.target.value)}
                      className="h-7 text-xs"
                      type="number"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('weeksPerYear')}</label>
                    <Input
                      value={item.weeksPerYear}
                      onChange={(e) => updateItem(idx, 'weeksPerYear', e.target.value)}
                      className="h-7 text-xs"
                      type="number"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('addActivity')}
          </Button>
          <Button size="sm" onClick={() => onSave(items.filter((i) => i.description))}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Awards Editor Dialog ============

export function AwardsEditorDialog({
  awards,
  onSave,
  onClose,
  t,
  te,
}: {
  awards: AwardItem[];
  onSave: (items: AwardItem[]) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
  te: ReturnType<typeof useTranslations>;
}) {
  const [items, setItems] = useState<AwardItem[]>(
    awards.length > 0 ? awards : [{ name: '', level: '', competition: '', tier: '', year: '' }]
  );

  const addItem = () =>
    setItems((prev) => [...prev, { name: '', level: '', competition: '', tier: '', year: '' }]);

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof AwardItem, value: string) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('awardsEditor')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {items.map((item, idx) => (
              <div key={idx} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => removeItem(idx)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">{t('name')}</label>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('level')}</label>
                    <Select value={item.level} onValueChange={(v) => updateItem(idx, 'level', v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        {AWARD_LEVEL_OPTIONS.map((l) => (
                          <SelectItem key={l} value={l}>
                            {te(`awardLevel.${l}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">{t('competition')}</label>
                    <Input
                      value={item.competition}
                      onChange={(e) => updateItem(idx, 'competition', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('tier')}</label>
                    <Select value={item.tier} onValueChange={(v) => updateItem(idx, 'tier', v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        {['1', '2', '3', '4', '5'].map((v) => (
                          <SelectItem key={v} value={v}>
                            Tier {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('awardYear')}</label>
                    <Input
                      value={item.year}
                      onChange={(e) => updateItem(idx, 'year', e.target.value)}
                      className="h-7 text-xs"
                      type="number"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('addAward')}
          </Button>
          <Button size="sm" onClick={() => onSave(items.filter((i) => i.name))}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

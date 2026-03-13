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
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Loader2 } from 'lucide-react';
import { PERSONAL_CATEGORIES } from '@/types/timeline';
import type { PersonalEventFormData } from '@/lib/validations/timeline';
import type { CreateEventDialogProps } from './timeline-helpers';

export function CreateEventDialog({
  open,
  onOpenChange,
  eventForm,
  createPersonalEventMutation,
  getCategoryLabel,
}: CreateEventDialogProps) {
  const t = useTranslations('timeline');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{t('personalEvents.createTitle')}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={eventForm.handleSubmit((data) => createPersonalEventMutation.mutate(data))}
          className="overflow-y-auto px-4 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="event-title">{t('personalEvents.form.title')}</Label>
              <Input
                id="event-title"
                {...eventForm.register('title')}
                placeholder={t('personalEvents.form.titlePlaceholder')}
              />
              {eventForm.formState.errors.title && (
                <p className="text-xs text-destructive">
                  {eventForm.formState.errors.title.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t('personalEvents.form.category')}</Label>
              <Select
                value={eventForm.watch('category')}
                onValueChange={(value) =>
                  eventForm.setValue('category', value as PersonalEventFormData['category'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONAL_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {getCategoryLabel(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-deadline">{t('personalEvents.form.deadline')}</Label>
              <Input id="event-deadline" type="date" {...eventForm.register('deadline')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-date">{t('personalEvents.form.eventDate')}</Label>
              <Input id="event-date" type="date" {...eventForm.register('eventDate')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-desc">{t('personalEvents.form.description')}</Label>
            <Textarea
              id="event-desc"
              className="min-h-[80px]"
              {...eventForm.register('description')}
              placeholder={t('personalEvents.form.descriptionPlaceholder')}
            />
          </div>
        </form>
        <SheetFooter className="px-4">
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" type="button" onClick={() => onOpenChange(false)}>
              {t('personalEvents.form.cancel')}
            </Button>
            <Button
              size="sm"
              disabled={createPersonalEventMutation.isPending}
              onClick={eventForm.handleSubmit((data) => createPersonalEventMutation.mutate(data))}
            >
              {createPersonalEventMutation.isPending && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              {t('personalEvents.form.submit')}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

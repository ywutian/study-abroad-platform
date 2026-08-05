'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ACTIVITY_CATEGORY_KEYS } from './constants';
import type { Activity } from './types';

interface CommonAppPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities: Activity[];
}

export function ActivitiesCommonAppPreview({
  open,
  onOpenChange,
  activities,
}: CommonAppPreviewProps) {
  const t = useTranslations('profile');

  const top10 = [...activities].slice(0, 10);

  const totalHours = top10.reduce((sum, a) => sum + (a.hoursPerWeek ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('caPreview.title')}</DialogTitle>
          <p className="text-sm text-muted-foreground">{t('caPreview.desc')}</p>
        </DialogHeader>

        {top10.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t('caPreview.noActivities')}
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              {top10.map((activity, index) => {
                const hasCommonAppDesc = !!activity.commonAppDescription?.trim();
                const desc = hasCommonAppDesc
                  ? activity.commonAppDescription!
                  : (activity.description ?? '');
                const descTruncated = desc.slice(0, 150);
                const isOverLimit = desc.length > 150;

                return (
                  <div key={activity.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">
                          {activity.name.length > 50
                            ? `${activity.name.slice(0, 50)}…`
                            : activity.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {t(
                            (ACTIVITY_CATEGORY_KEYS[activity.category] ??
                              'activityCategories.other') as Parameters<typeof t>[0]
                          )}
                        </Badge>
                      </div>
                      {activity.role && (
                        <p className="text-xs text-muted-foreground">{activity.role}</p>
                      )}
                      {desc && (
                        <div className="space-y-1">
                          <p
                            className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}
                          >
                            {descTruncated}
                            {isOverLimit && '…'}
                          </p>
                          {isOverLimit && (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-destructive" />
                              <Badge variant="destructive" className="text-2xs px-1.5 py-0">
                                {t('caPreview.charWarning')}
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
          <span>{t('caPreview.totalActivities', { count: top10.length })}</span>
          <span>{t('caPreview.totalHours', { hours: totalHours })}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

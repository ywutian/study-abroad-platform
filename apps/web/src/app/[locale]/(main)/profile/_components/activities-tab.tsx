'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { BookOpen, Plus, Pencil, Trash2, GripVertical, Sparkles, Loader2, Eye } from 'lucide-react';
import { ACTIVITY_CATEGORY_KEYS, TIER_BADGE_CONFIG } from './constants';
import { ActivitiesCommonAppPreview } from './activities-common-app-preview';
import type { Activity } from './types';

interface AiSortResult {
  suggestedOrder: Array<{
    activityId: string;
    rank: number;
    reasoning: string;
  }>;
  summary: string;
}

interface ActivitiesTabProps {
  activities: Activity[];
  onAddActivity: () => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (id: string) => void;
  onReorderActivities: (ids: string[]) => void;
  aiSortResult?: AiSortResult | null;
  aiSortPending?: boolean;
  onAiSort?: () => void;
  onAiSortAccept?: (ids: string[]) => void;
  onAiSortDismiss?: () => void;
}

export function ActivitiesTab({
  activities,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onReorderActivities,
  aiSortResult,
  aiSortPending,
  onAiSort,
  onAiSortAccept,
  onAiSortDismiss,
}: ActivitiesTabProps) {
  const t = useTranslations();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [caPreviewOpen, setCaPreviewOpen] = useState(false);

  // Build sorted preview from AI result (spread to avoid mutating state)
  const sortedPreview = aiSortResult?.suggestedOrder
    ? [...aiSortResult.suggestedOrder]
        .sort((a, b) => a.rank - b.rank)
        .map((item) => ({
          ...item,
          activity: activities.find((a) => a.id === item.activityId),
        }))
        .filter((item) => item.activity)
    : [];

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-warning" />
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-warning" />
            {t('profile.activities')}
          </CardTitle>
          <CardDescription>{t('profile.activitiesDesc')}</CardDescription>
        </div>
        <div className="flex gap-2">
          {activities.length > 0 && (
            <Button variant="outline" onClick={() => setCaPreviewOpen(true)} className="gap-2">
              <Eye className="h-4 w-4" />
              {t('profile.caPreview.title')}
            </Button>
          )}
          {onAiSort && (
            <Button
              variant="outline"
              onClick={() => onAiSort()}
              disabled={activities.length < 2 || aiSortPending}
              className="gap-2"
            >
              {aiSortPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {t('profile.aiSort')}
            </Button>
          )}
          <Button variant="warning" onClick={onAddActivity} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('profile.actions.addActivity')}
          </Button>
        </div>
      </CardHeader>

      {/* Common App Preview Dialog */}
      <ActivitiesCommonAppPreview
        open={caPreviewOpen}
        onOpenChange={setCaPreviewOpen}
        activities={activities}
      />

      {/* AI Sort Preview Dialog */}
      <Dialog
        open={previewOpen || !!aiSortResult}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewOpen(false);
            onAiSortDismiss?.();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('profile.aiSortPreview')}
            </DialogTitle>
          </DialogHeader>
          {aiSortResult && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{aiSortResult.summary}</p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {sortedPreview.map((item) => (
                  <div
                    key={item.activityId}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {item.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{item.activity!.name}</p>
                        <Badge variant="secondary" className="text-xs">
                          {t(
                            ACTIVITY_CATEGORY_KEYS[item.activity!.category] ||
                              'profile.activityCategories.other'
                          )}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{item.reasoning}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPreviewOpen(false);
                onAiSortDismiss?.();
              }}
            >
              {t('profile.aiSortReject')}
            </Button>
            <Button
              onClick={() => {
                if (aiSortResult?.suggestedOrder) {
                  const ids = [...aiSortResult.suggestedOrder]
                    .sort((a, b) => a.rank - b.rank)
                    .map((item) => item.activityId);
                  onAiSortAccept?.(ids);
                }
                setPreviewOpen(false);
              }}
            >
              {t('profile.aiSortAccept')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CardContent>
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group rounded-xl border p-4 hover:shadow-md transition-all"
                draggable
                onDragStart={(e) => {
                  (e as unknown as React.DragEvent).dataTransfer?.setData(
                    'text/plain',
                    String(index)
                  );
                }}
                onDragOver={(e) => (e as unknown as React.DragEvent).preventDefault?.()}
                onDrop={(e) => {
                  const fromIndex = parseInt(
                    (e as unknown as React.DragEvent).dataTransfer?.getData('text/plain') ?? '0'
                  );
                  if (fromIndex === index || isNaN(fromIndex)) return;
                  const ids = activities.map((a) => a.id);
                  const [removed] = ids.splice(fromIndex, 1);
                  ids.splice(index, 0, removed);
                  onReorderActivities(ids);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning">
                        <BookOpen className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{activity.name}</p>
                        <Badge variant="secondary" className="text-xs">
                          {t(
                            ACTIVITY_CATEGORY_KEYS[activity.category] ||
                              'profile.activityCategories.other'
                          )}
                        </Badge>
                        {activity.activityTemplate?.tier && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${TIER_BADGE_CONFIG[activity.activityTemplate.tier]?.className || ''}`}
                          >
                            {TIER_BADGE_CONFIG[activity.activityTemplate.tier]?.label}
                          </Badge>
                        )}
                        {activity.isOngoing && (
                          <Badge className="text-xs bg-success/10 text-success border-success/20">
                            {t('common.ongoing')}
                          </Badge>
                        )}
                        {activity.gradeLevels && activity.gradeLevels.length > 0 && (
                          <span className="flex gap-0.5">
                            {activity.gradeLevels.map((g: number) => (
                              <span
                                key={g}
                                className="rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs text-primary"
                              >
                                {g}th
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{activity.role}</p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {activity.description}
                        </p>
                      )}
                      {(activity.hoursPerWeek || activity.weeksPerYear) && (
                        <p className="text-xs text-muted-foreground">
                          {activity.hoursPerWeek &&
                            `${activity.hoursPerWeek} ${t('common.perWeek')}`}
                          {activity.hoursPerWeek && activity.weeksPerYear && ' · '}
                          {activity.weeksPerYear &&
                            `${activity.weeksPerYear} ${t('common.weeksPerYear')}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEditActivity(activity)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => onDeleteActivity(activity.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-warning/10">
              <BookOpen className="h-8 w-8 text-warning/50" />
            </div>
            <p className="font-medium">{t('profile.empty.noActivities')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('profile.empty.noActivitiesHint')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

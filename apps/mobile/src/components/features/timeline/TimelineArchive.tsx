import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PersonalEventDetail, TimelineResponse } from '@study-abroad/shared';

import { AnimatedCard, Badge, CardContent, EmptyState, Loading } from '@/components/ui';
import { fontSize, fontWeight, spacing, useColors } from '@/utils/theme';

const ARCHIVED_TIMELINE_STATUSES = new Set([
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'WAITLISTED',
  'WITHDRAWN',
]);
const ARCHIVED_PERSONAL_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

function daysUntil(value?: Date | string) {
  if (!value) return null;
  const target = new Date(value);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

function formatDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getPersonalLifecycleDate(event: PersonalEventDetail): Date | null {
  const times = [event.deadline, event.eventDate]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => !Number.isNaN(value));
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

export function isArchivedTimeline(timeline: TimelineResponse): boolean {
  const days = daysUntil(timeline.deadline);
  return ARCHIVED_TIMELINE_STATUSES.has(timeline.status) || (days !== null && days < 0);
}

export function isArchivedPersonalEvent(event: PersonalEventDetail): boolean {
  if (ARCHIVED_PERSONAL_STATUSES.has(event.status)) return true;
  const lifecycleDate = getPersonalLifecycleDate(event);
  return lifecycleDate ? (daysUntil(lifecycleDate) ?? 0) < 0 : false;
}

export function TimelineArchive({
  timelines,
  personalEvents,
  loading,
  renderSchoolCard,
}: {
  timelines: TimelineResponse[];
  personalEvents: PersonalEventDetail[];
  loading: boolean;
  renderSchoolCard: (timeline: TimelineResponse, index: number, readOnly: boolean) => ReactNode;
}) {
  const { t } = useTranslation();
  const colors = useColors();

  if (loading) return <Loading text={t('timeline.loading')} />;
  if (timelines.length === 0 && personalEvents.length === 0) {
    return (
      <EmptyState
        icon="archive-outline"
        title={t('timeline.archive.emptyTitle')}
        description={t('timeline.archive.emptyDescription')}
      />
    );
  }

  return (
    <>
      <View style={{ marginBottom: spacing.md }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
          }}
        >
          {t('timeline.archive.schoolTitle')}
        </Text>
      </View>
      {timelines.map((timeline, index) => renderSchoolCard(timeline, index, true))}

      <View style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
          }}
        >
          {t('timeline.archive.personalTitle')}
        </Text>
      </View>
      {personalEvents.map((event) => {
        const lifecycleDate = getPersonalLifecycleDate(event);
        return (
          <AnimatedCard key={event.id} style={{ marginBottom: spacing.md }}>
            <CardContent>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {event.title}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                    <Badge variant="outline">
                      {t(`timeline.category.${event.category}`, event.category)}
                    </Badge>
                    <Badge variant="secondary">
                      {t(`timeline.status.${event.status}`, event.status)}
                    </Badge>
                  </View>
                </View>
                {lifecycleDate && (
                  <Text style={{ color: colors.foregroundMuted, fontSize: fontSize.xs }}>
                    {formatDate(lifecycleDate)}
                  </Text>
                )}
              </View>
            </CardContent>
          </AnimatedCard>
        );
      })}
    </>
  );
}

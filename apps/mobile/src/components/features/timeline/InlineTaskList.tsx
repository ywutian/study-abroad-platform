import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import type { TaskResponse } from '@study-abroad/shared';
import { API_ROUTES } from '@study-abroad/shared';

import { AnimatedButton, Checkbox, Loading } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { fontSize, spacing, useColors } from '@/utils/theme';

const TASK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  ESSAY: 'document-text-outline',
  DOCUMENT: 'folder-outline',
  TEST: 'school-outline',
  INTERVIEW: 'people-outline',
  RECOMMENDATION: 'mail-outline',
  OTHER: 'ellipsis-horizontal',
};

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function InlineTaskList({
  timelineId,
  t,
  readOnly,
  onToggle,
  onAdd,
}: {
  timelineId: string;
  t: TFunction;
  readOnly?: boolean;
  onToggle: (id: string) => void;
  onAdd: () => void;
}) {
  const colors = useColors();
  const { data: timeline, isLoading } = useQuery<{ tasks?: TaskResponse[] }>({
    queryKey: qk.timeline.tasks(timelineId),
    queryFn: () => apiClient.get(`${API_ROUTES.TIMELINES}/${timelineId}`),
    staleTime: 30_000,
  });
  const tasks = timeline?.tasks ?? [];

  if (isLoading) return <Loading size="small" />;

  return (
    <View style={{ gap: spacing.xs }}>
      {tasks.length ? (
        tasks.map((task) => (
          <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Checkbox
              checked={task.completed}
              onPress={() => onToggle(task.id)}
              disabled={readOnly}
            />
            <Ionicons
              name={TASK_ICONS[task.type] ?? 'ellipsis-horizontal'}
              size={16}
              color={task.completed ? colors.foregroundMuted : colors.foreground}
              style={{ marginLeft: spacing.xs }}
            />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  color: task.completed ? colors.foregroundMuted : colors.foreground,
                  textDecorationLine: task.completed ? 'line-through' : 'none',
                }}
                numberOfLines={1}
              >
                {task.title}
              </Text>
              {task.dueDate && (
                <Text
                  style={{ fontSize: fontSize.xs, color: colors.foregroundMuted, marginTop: 2 }}
                >
                  {formatDate(task.dueDate)}
                </Text>
              )}
            </View>
          </View>
        ))
      ) : (
        <Text
          style={{
            fontSize: fontSize.sm,
            fontStyle: 'italic',
            color: colors.foregroundMuted,
            paddingVertical: spacing.sm,
          }}
        >
          {t('timeline.noTasks')}
        </Text>
      )}
      {!readOnly && (
        <AnimatedButton
          variant="ghost"
          size="sm"
          onPress={onAdd}
          leftIcon={<Ionicons name="add-circle-outline" size={16} color={colors.primary} />}
          style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
        >
          {t('timeline.addTask')}
        </AnimatedButton>
      )}
    </View>
  );
}

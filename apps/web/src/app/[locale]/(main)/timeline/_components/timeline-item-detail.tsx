'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { TaskResponse } from '@/types/timeline';
import type { PersonalTaskResponse } from '@/types/timeline';
import type { UseMutationResult } from '@tanstack/react-query';

interface TimelineItemDetailProps {
  tasks: (TaskResponse | PersonalTaskResponse)[];
  isLoading: boolean;
  toggleTaskMutation: UseMutationResult<unknown, Error, string>;
  formatDate: (dateStr?: string) => string;
  onDelete: () => void;
  deleteLabel: string;
  /** Whether to show the task type badge (school timeline tasks have types) */
  showTaskType?: boolean;
  /** When provided, an "add task" input row is shown below the task list. */
  onAddTask?: (title: string) => void;
  addTaskPending?: boolean;
  /** When provided, each task row gets a delete (trash) button. */
  onDeleteTask?: (taskId: string) => void;
  /** When provided, the footer shows an Edit button (e.g. edit a personal event). */
  onEdit?: () => void;
  editLabel?: string;
}

export function TimelineItemDetail({
  tasks,
  isLoading,
  toggleTaskMutation,
  formatDate,
  onDelete,
  deleteLabel,
  showTaskType = false,
  onAddTask,
  addTaskPending = false,
  onDeleteTask,
  onEdit,
  editLabel,
}: TimelineItemDetailProps) {
  const t = useTranslations('timeline');
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const submitNewTask = () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed || !onAddTask) return;
    onAddTask(trimmed);
    setNewTaskTitle('');
  };

  return (
    <div className="border-t bg-muted/20 p-4">
      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-4">
          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
          {t('schoolTimelines.loadingTasks')}
        </div>
      ) : tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-background transition-colors"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTaskMutation.mutate(task.id);
                }}
                className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                  task.completed
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/30 hover:border-primary'
                }`}
              >
                {task.completed && <CheckCircle2 className="h-3 w-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                >
                  {task.title}
                </span>
                {task.dueDate && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatDate(task.dueDate)}
                  </span>
                )}
              </div>
              {showTaskType && 'type' in task && (
                <Badge variant="outline" className="text-xs">
                  {t(`taskTypes.${task.type}`)}
                </Badge>
              )}
              {onDeleteTask && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task.id);
                  }}
                  className="flex-shrink-0 text-muted-foreground/60 hover:text-destructive transition-colors"
                  aria-label={t('schoolTimelines.deleteTask')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-4">
          {t('schoolTimelines.noTasks')}
        </div>
      )}

      {onAddTask && (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitNewTask();
          }}
        >
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder={t('schoolTimelines.addTaskPlaceholder')}
            className="h-8"
            onClick={(e) => e.stopPropagation()}
            maxLength={200}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={addTaskPending || !newTaskTitle.trim()}
          >
            {addTaskPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span className="ml-1">{t('schoolTimelines.addTask')}</span>
          </Button>
        </form>
      )}

      <div className="mt-4 pt-3 border-t flex justify-end gap-2">
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            {editLabel}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {deleteLabel}
        </Button>
      </div>
    </div>
  );
}

import type {
  ApplicationRound,
  TaskResponseDto,
  TimelineResponseDto,
} from './dto';

export interface TimelineResponseInput {
  id: string;
  schoolId: string;
  schoolName: string;
  round: string;
  applicationYear: number;
  deadline: Date | null;
  status: string;
  progress: number;
  priority: number;
  notes: string | null;
  createdAt: Date;
  tasks?: Array<{ completed: boolean }>;
}

export interface ApplicationTaskRecord {
  id: string;
  timelineId: string;
  title: string;
  type: string;
  description?: string | null;
  dueDate?: Date | null;
  completed: boolean;
  completedAt?: Date | null;
  essayPrompt?: string | null;
  wordLimit?: number | null;
  sortOrder: number;
}

export function mapTimelineToResponse(
  timeline: TimelineResponseInput,
): TimelineResponseDto {
  const tasks = timeline.tasks ?? [];
  return {
    id: timeline.id,
    schoolId: timeline.schoolId,
    schoolName: timeline.schoolName,
    round: timeline.round as ApplicationRound,
    applicationYear: timeline.applicationYear,
    deadline: timeline.deadline ?? undefined,
    status: timeline.status as TimelineResponseDto['status'],
    progress: timeline.progress,
    priority: timeline.priority,
    notes: timeline.notes ?? undefined,
    tasksTotal: tasks.length,
    tasksCompleted: tasks.filter((task) => task.completed).length,
    createdAt: timeline.createdAt,
  };
}

export function mapTaskToResponse(
  task: ApplicationTaskRecord,
): TaskResponseDto {
  return {
    id: task.id,
    timelineId: task.timelineId,
    title: task.title,
    type: task.type as TaskResponseDto['type'],
    description: task.description ?? undefined,
    dueDate: task.dueDate ?? undefined,
    completed: task.completed,
    completedAt: task.completedAt,
    essayPrompt: task.essayPrompt ?? undefined,
    wordLimit: task.wordLimit ?? undefined,
    ...resolveTaskSourceState(task),
    sortOrder: task.sortOrder,
  };
}

function resolveTaskSourceState(
  task: ApplicationTaskRecord,
): Pick<TaskResponseDto, 'sourceStatus' | 'sourcePolicy'> {
  if (task.type !== 'ESSAY') return { sourceStatus: 'first_party' };

  const text = `${task.title} ${task.essayPrompt ?? ''}`.toLowerCase();
  if (text.includes('common app') || text.includes('personal statement')) {
    return {
      sourceStatus: 'generic',
      sourcePolicy:
        'Generic Common App writing task; not a school-specific sourced prompt.',
    };
  }
  return {
    sourceStatus: 'source_review_required',
    sourcePolicy:
      'School-specific essay task must link to a source-backed verified EssayPrompt before it is treated as authoritative.',
  };
}

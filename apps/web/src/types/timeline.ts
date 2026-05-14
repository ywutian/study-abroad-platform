export interface TimelineResponse {
  id: string;
  schoolId: string;
  schoolName: string;
  round: string;
  deadline?: string;
  status: string;
  progress: number;
  priority: number;
  notes?: string;
  tasksTotal: number;
  tasksCompleted: number;
  createdAt: string;
}

export interface TaskResponse {
  id: string;
  timelineId: string;
  title: string;
  type: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  essayPrompt?: string;
  wordLimit?: number;
  sortOrder: number;
}

export interface TimelineOverview {
  totalSchools: number;
  submitted: number;
  inProgress: number;
  notStarted: number;
  upcomingDeadlines: TimelineResponse[];
  overdueTasks: TaskResponse[];
  totalPersonalEvents: number;
  personalInProgress: number;
  personalCompleted: number;
  upcomingPersonalEvents: PersonalEventResponse[];
}

export interface GlobalEvent {
  id: string;
  title: string;
  titleZh?: string;
  category: string;
  eventDate: string;
  registrationDeadline?: string;
  lateDeadline?: string;
  resultDate?: string;
  description?: string;
  descriptionZh?: string;
  url?: string;
  year: number;
}

export interface TimelineDetail extends TimelineResponse {
  tasks?: TaskResponse[];
}

export interface PersonalEventResponse {
  id: string;
  category: string;
  title: string;
  globalEventId?: string;
  deadline?: string;
  eventDate?: string;
  status: string;
  progress: number;
  priority: number;
  description?: string;
  url?: string;
  notes?: string;
  tasksTotal: number;
  tasksCompleted: number;
  createdAt: string;
}

export interface PersonalTaskResponse {
  id: string;
  eventId: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  sortOrder: number;
}

export interface PersonalEventDetail extends PersonalEventResponse {
  tasks?: PersonalTaskResponse[];
}

export type TabType = 'todo' | 'school' | 'personal' | 'archive';

export const PERSONAL_CATEGORIES = [
  'COMPETITION',
  'TEST',
  'SUMMER_PROGRAM',
  'INTERNSHIP',
  'ACTIVITY',
  'MATERIAL',
  'OTHER',
] as const;

export type PersonalCategory = (typeof PERSONAL_CATEGORIES)[number];

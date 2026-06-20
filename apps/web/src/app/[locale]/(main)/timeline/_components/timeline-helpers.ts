import type { ReactNode } from 'react';
import type {
  TimelineResponse,
  PersonalEventResponse,
  TimelineDetail,
  PersonalEventDetail,
  TabType,
  TimelineStatus,
} from '@/types/timeline';
import type { PersonalEventFormData } from '@/lib/validations/timeline';
import type { UseMutationResult } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';

/**
 * Display rows for the board/archive views. The archive view overwrites `status`
 * with a UI-only display value ('OVERDUE'), so `status` is widened to `string`
 * at the display layer only — the shared contract (`TimelineResponse` /
 * `PersonalEventResponse`) stays strict.
 */
export type TimelineDisplayRow = Omit<TimelineResponse, 'status'> & { status: string };
export type PersonalEventDisplayRow = Omit<PersonalEventResponse, 'status'> & {
  status: string;
};

/**
 * Statuses a user can set on a school-application timeline, paired with their
 * i18n key under `timeline.statuses.*`. These are the settable subset of
 * `TimelineStatus` (the display-only 'OVERDUE'/'COMPLETED'/'CANCELLED' values
 * are excluded).
 */
export const SCHOOL_STATUS_OPTIONS: { value: TimelineStatus; key: string }[] = [
  { value: 'NOT_STARTED', key: 'notStarted' },
  { value: 'IN_PROGRESS', key: 'inProgress' },
  { value: 'SUBMITTED', key: 'submitted' },
  { value: 'ACCEPTED', key: 'accepted' },
  { value: 'REJECTED', key: 'rejected' },
  { value: 'WAITLISTED', key: 'waitlisted' },
  { value: 'WITHDRAWN', key: 'withdrawn' },
];

export type UpdateTimelineVars = { id: string; status: TimelineStatus };

/** Props shared by components that need date formatting */
export interface DateHelpers {
  formatDate: (dateStr?: string) => string;
  getDaysUntil: (dateStr?: string) => number | null;
  formatDaysUntil: (days: number | null) => string;
}

/** Props shared by components that need badge/icon helpers */
export interface BadgeHelpers {
  getStatusBadge: (status: string) => ReactNode;
  getRoundBadge: (round: string) => ReactNode;
  getCategoryIcon: (category: string) => ReactNode;
  getCategoryLabel: (category: string) => string;
  getCategoryColor: (category: string) => string;
}

export interface TimelineOverviewProps {
  overview: {
    totalSchools: number;
    inProgress: number;
    submitted: number;
    notStarted: number;
    totalPersonalEvents: number;
    personalCompleted: number;
  };
}

export interface TimelineTabsProps extends DateHelpers, BadgeHelpers {
  activeTab: TabType;
  sortedTimelines: TimelineDisplayRow[];
  expandedTimeline: string | null;
  setExpandedTimeline: (id: string | null) => void;
  timelineDetail: TimelineDetail | undefined;
  timelineDetailLoading: boolean;
  toggleTaskMutation: UseMutationResult<unknown, Error, string>;
  setDeleteTarget: (target: { type: string; id: string; name: string }) => void;
  schoolsWithoutTimeline: Array<{
    id: string;
    schoolId: string;
    school: { id: string; name: string; nameZh?: string };
  }>;
  generateTimelineMutation: UseMutationResult<unknown, Error, string[]>;
  updateTimelineMutation: UseMutationResult<unknown, Error, UpdateTimelineVars>;
}

export interface PersonalEventsSectionProps extends DateHelpers, BadgeHelpers {
  sortedPersonalEvents: PersonalEventDisplayRow[];
  expandedPersonalEvent: string | null;
  setExpandedPersonalEvent: (id: string | null) => void;
  personalEventDetail: PersonalEventDetail | undefined;
  personalEventDetailLoading: boolean;
  togglePersonalTaskMutation: UseMutationResult<unknown, Error, string>;
  setDeleteTarget: (target: { type: string; id: string; name: string }) => void;
}

export interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventForm: UseFormReturn<PersonalEventFormData>;
  createPersonalEventMutation: UseMutationResult<unknown, Error, PersonalEventFormData>;
  getCategoryLabel: (category: string) => string;
}

export interface DeleteConfirmationDialogProps {
  deleteTarget: { type: string; id: string; name: string } | null;
  setDeleteTarget: (target: { type: string; id: string; name: string } | null) => void;
  deleteTimelineMutation: UseMutationResult<unknown, Error, string>;
  deletePersonalEventMutation: UseMutationResult<unknown, Error, string>;
}

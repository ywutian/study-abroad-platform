import type { ReactNode } from 'react';
import type {
  TimelineResponse,
  PersonalEventResponse,
  TimelineDetail,
  PersonalEventDetail,
  TabType,
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

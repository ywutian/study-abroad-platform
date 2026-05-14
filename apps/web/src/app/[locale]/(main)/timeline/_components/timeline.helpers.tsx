import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Trophy,
  FileText,
  Target,
  BookOpen,
  Briefcase,
  Users,
  ClipboardList,
  GraduationCap,
} from 'lucide-react';
import { daysUntilDate } from './timeline-view-model';

export function formatDate(
  dateStr: string | undefined,
  formatter: { dateTime: (date: Date, style: string) => string }
): string {
  if (!dateStr) return '-';
  return formatter.dateTime(new Date(dateStr), 'medium');
}

export function getDaysUntil(dateStr?: string): number | null {
  return daysUntilDate(dateStr);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatDaysUntil(
  days: number | null,
  t: (key: string, values?: any) => string
): string {
  if (days === null) return '';
  if (days < 0) return t('daysAgo', { days: Math.abs(days) });
  if (days === 0) return t('today');
  if (days === 1) return t('tomorrow');
  return t('daysLeft', { days });
}

export function getStatusBadge(status: string, t: (key: string) => string): ReactNode {
  switch (status) {
    case 'OVERDUE':
      return <Badge variant="destructive">{t('statuses.overdue')}</Badge>;
    case 'SUBMITTED':
      return <Badge variant="success">{t('statuses.submitted')}</Badge>;
    case 'IN_PROGRESS':
      return <Badge variant="warning">{t('statuses.inProgress')}</Badge>;
    case 'ACCEPTED':
      return <Badge variant="solid-success">{t('statuses.accepted')}</Badge>;
    case 'REJECTED':
      return <Badge variant="destructive">{t('statuses.rejected')}</Badge>;
    case 'WAITLISTED':
      return <Badge variant="purple">{t('statuses.waitlisted')}</Badge>;
    case 'WITHDRAWN':
      return <Badge variant="secondary">{t('statuses.withdrawn')}</Badge>;
    case 'COMPLETED':
      return <Badge variant="success">{t('statuses.completed')}</Badge>;
    case 'CANCELLED':
      return <Badge variant="secondary">{t('statuses.cancelled')}</Badge>;
    case 'NOT_STARTED':
      return <Badge variant="outline">{t('statuses.notStarted')}</Badge>;
    default:
      return <Badge variant="outline">{t('statuses.notStarted')}</Badge>;
  }
}

export function getRoundBadge(round: string): ReactNode {
  const colors: Record<string, string> = {
    ED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    ED2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    EA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    REA: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    RD: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Rolling: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${colors[round] || colors.RD}`}>
      {round}
    </span>
  );
}

export function getCategoryIcon(category: string): ReactNode {
  switch (category) {
    case 'TEST':
      return <FileText className="h-4 w-4" />;
    case 'COMPETITION':
      return <Trophy className="h-4 w-4" />;
    case 'SUMMER_PROGRAM':
      return <BookOpen className="h-4 w-4" />;
    case 'INTERNSHIP':
      return <Briefcase className="h-4 w-4" />;
    case 'ACTIVITY':
      return <Users className="h-4 w-4" />;
    case 'MATERIAL':
      return <ClipboardList className="h-4 w-4" />;
    case 'FINANCIAL_AID':
      return <Target className="h-4 w-4" />;
    case 'APPLICATION':
      return <GraduationCap className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
  }
}

export function getCategoryLabel(category: string, t: (key: string) => string): string {
  const key = `personalEvents.categories.${category}`;
  try {
    return t(key);
  } catch {
    return category;
  }
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    COMPETITION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    TEST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    SUMMER_PROGRAM: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    INTERNSHIP: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    ACTIVITY: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    MATERIAL: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return colors[category] || colors.OTHER;
}

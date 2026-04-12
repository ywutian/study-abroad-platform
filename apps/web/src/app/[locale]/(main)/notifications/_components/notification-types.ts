import {
  Bell,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  UserPlus,
  MessageSquare,
  Heart,
  Award,
  BadgeCheck,
  Coins,
  Calendar,
} from 'lucide-react';

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  relatedId?: string;
  relatedType?: string;
  read: boolean;
  createdAt: string;
}

export interface GroupedNotifications {
  today: Notification[];
  yesterday: Notification[];
  earlier: Notification[];
}

// Notification icon mapping
export const notificationIcons: Record<string, React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  system: Bell,
  NEW_FOLLOWER: UserPlus,
  FOLLOW_ACCEPTED: UserPlus,
  NEW_MESSAGE: MessageSquare,
  CASE_HELPFUL: Heart,
  ESSAY_COMMENT: MessageSquare,
  POST_REPLY: MessageSquare,
  POST_LIKE: Heart,
  VERIFICATION_APPROVED: BadgeCheck,
  VERIFICATION_REJECTED: XCircle,
  POINTS_EARNED: Coins,
  LEVEL_UP: Award,
  DEADLINE_REMINDER: Calendar,
  PROFILE_INCOMPLETE: AlertTriangle,
};

// Notification color mapping
export const notificationColors: Record<string, string> = {
  info: 'text-blue-500 bg-blue-500/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  error: 'text-destructive bg-destructive/10',
  system: 'text-primary bg-primary/10',
  NEW_FOLLOWER: 'text-blue-500 bg-blue-500/10',
  FOLLOW_ACCEPTED: 'text-blue-500 bg-blue-500/10',
  NEW_MESSAGE: 'text-indigo-500 bg-indigo-500/10',
  CASE_HELPFUL: 'text-pink-500 bg-pink-500/10',
  ESSAY_COMMENT: 'text-primary bg-primary/10',
  POST_REPLY: 'text-cyan-500 bg-cyan-500/10',
  POST_LIKE: 'text-pink-500 bg-pink-500/10',
  VERIFICATION_APPROVED: 'text-emerald-500 bg-emerald-500/10',
  VERIFICATION_REJECTED: 'text-red-500 bg-red-500/10',
  POINTS_EARNED: 'text-amber-500 bg-amber-500/10',
  LEVEL_UP: 'text-orange-500 bg-orange-500/10',
  DEADLINE_REMINDER: 'text-red-500 bg-red-500/10',
  PROFILE_INCOMPLETE: 'text-yellow-500 bg-yellow-500/10',
};

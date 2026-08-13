export enum NotificationType {
  // 社交类
  NEW_FOLLOWER = 'NEW_FOLLOWER',
  FOLLOW_ACCEPTED = 'FOLLOW_ACCEPTED',
  NEW_MESSAGE = 'NEW_MESSAGE',

  // 内容类
  CASE_HELPFUL = 'CASE_HELPFUL',
  ESSAY_COMMENT = 'ESSAY_COMMENT',
  POST_REPLY = 'POST_REPLY',
  POST_LIKE = 'POST_LIKE',

  // 系统类
  VERIFICATION_APPROVED = 'VERIFICATION_APPROVED',
  VERIFICATION_REJECTED = 'VERIFICATION_REJECTED',
  POINTS_EARNED = 'POINTS_EARNED',
  LEVEL_UP = 'LEVEL_UP',

  // 提醒类
  DEADLINE_REMINDER = 'DEADLINE_REMINDER',
  PROFILE_INCOMPLETE = 'PROFILE_INCOMPLETE',

  // 审核类
  CASE_REVIEW_APPROVED = 'CASE_REVIEW_APPROVED',
  CASE_REVIEW_REJECTED = 'CASE_REVIEW_REJECTED',

  // 文书题目
  NEW_ESSAY_PROMPTS = 'NEW_ESSAY_PROMPTS',

  // 管理员广播
  SYSTEM_BROADCAST = 'SYSTEM_BROADCAST',
}

export interface Notification {
  id: string;
  type: NotificationType;
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

// Report & Moderation

export enum ReportTargetType {
  USER = 'USER',
  MESSAGE = 'MESSAGE',
  CASE = 'CASE',
  REVIEW = 'REVIEW',
  POST = 'POST',
  COMMENT = 'COMMENT',
  RECRUITMENT_CARD = 'RECRUITMENT_CARD',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  RESOLVED = 'RESOLVED',
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  detail?: string;
  status: ReportStatus;
  createdAt: Date;
}

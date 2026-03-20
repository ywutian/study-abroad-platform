/**
 * Typed permission constants for @RequirePermission() decorator.
 * Must match the values stored in the RolePermission table.
 */
export const Permission = {
  // Case management
  CASE_CREATE: 'case:create',
  CASE_REVIEW: 'case:review',
  CASE_DELETE: 'case:delete',

  // Essay management
  ESSAY_MANAGE: 'essay:manage',

  // School management
  SCHOOL_EDIT: 'school:edit',
  SCHOOL_REVIEW: 'school:review',

  // User management
  USER_VIEW: 'user:view',
  USER_MANAGE: 'user:manage',
  USER_DELETE: 'user:delete',
  USER_BAN: 'user:ban',

  // Content moderation
  CONTENT_MODERATE: 'content:moderate',

  // Data operations
  DATA_EXPORT: 'data:export',
  DATA_HEALTH: 'data:health',
  DATA_SYNC: 'data:sync',

  // System administration
  SYSTEM_SETTINGS: 'system:settings',
  SYSTEM_ROLES: 'system:roles',
  SYSTEM_CALIBRATION: 'system:calibration',

  // AI configuration
  AI_CONFIG: 'ai:config',

  // Audit
  AUDIT_VIEW: 'audit:view',

  // Notifications
  NOTIFICATION_BROADCAST: 'notification:broadcast',
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

/**
 * Default permissions per role. Used by backfill scripts and as reference.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionType[]> = {
  OPERATOR: [
    Permission.CASE_CREATE,
    Permission.CASE_REVIEW,
    Permission.ESSAY_MANAGE,
    Permission.SCHOOL_EDIT,
    Permission.USER_VIEW,
    Permission.DATA_HEALTH,
  ],
  ADMIN: [
    Permission.CASE_CREATE,
    Permission.CASE_REVIEW,
    Permission.CASE_DELETE,
    Permission.ESSAY_MANAGE,
    Permission.SCHOOL_EDIT,
    Permission.SCHOOL_REVIEW,
    Permission.USER_VIEW,
    Permission.USER_MANAGE,
    Permission.USER_DELETE,
    Permission.USER_BAN,
    Permission.CONTENT_MODERATE,
    Permission.DATA_EXPORT,
    Permission.DATA_HEALTH,
    Permission.DATA_SYNC,
    Permission.SYSTEM_CALIBRATION,
    Permission.AI_CONFIG,
    Permission.AUDIT_VIEW,
    Permission.NOTIFICATION_BROADCAST,
  ],
};

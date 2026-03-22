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

  // Payment
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_MANAGE: 'payment:manage',

  // Verification
  VERIFICATION_REVIEW: 'verification:review',

  // Calendar & timeline
  CALENDAR_MANAGE: 'calendar:manage',

  // High school
  HIGHSCHOOL_MANAGE: 'highschool:manage',

  // Dashboard
  DASHBOARD_FULL: 'dashboard:full',
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

/**
 * Default permissions per role. Used by backfill scripts and as reference.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionType[]> = {
  OPERATOR: [
    // Case & essay
    Permission.CASE_CREATE,
    Permission.CASE_REVIEW,
    Permission.ESSAY_MANAGE,
    // School & data
    Permission.SCHOOL_EDIT,
    Permission.SCHOOL_REVIEW,
    Permission.DATA_HEALTH,
    Permission.HIGHSCHOOL_MANAGE,
    Permission.CALENDAR_MANAGE,
    // Content & users
    Permission.USER_VIEW,
    Permission.CONTENT_MODERATE,
    Permission.VERIFICATION_REVIEW,
    // Read-only access
    Permission.PAYMENT_VIEW,
    Permission.AUDIT_VIEW,
  ],
  ADMIN: [
    // All OPERATOR permissions
    Permission.CASE_CREATE,
    Permission.CASE_REVIEW,
    Permission.ESSAY_MANAGE,
    Permission.SCHOOL_EDIT,
    Permission.SCHOOL_REVIEW,
    Permission.DATA_HEALTH,
    Permission.HIGHSCHOOL_MANAGE,
    Permission.CALENDAR_MANAGE,
    Permission.USER_VIEW,
    Permission.CONTENT_MODERATE,
    Permission.VERIFICATION_REVIEW,
    Permission.PAYMENT_VIEW,
    Permission.AUDIT_VIEW,
    // Admin-only
    Permission.CASE_DELETE,
    Permission.USER_MANAGE,
    Permission.USER_DELETE,
    Permission.USER_BAN,
    Permission.DATA_EXPORT,
    Permission.DATA_SYNC,
    Permission.NOTIFICATION_BROADCAST,
    Permission.SYSTEM_CALIBRATION,
    Permission.AI_CONFIG,
    Permission.PAYMENT_MANAGE,
    Permission.DASHBOARD_FULL,
  ],
};

/**
 * Permission presets for common job functions (UI convenience only).
 * Used by invite flow to quickly assign permissions to new operators.
 */
export const PERMISSION_PRESETS = {
  DATA_OPS: {
    name: '数据运营',
    permissions: [
      Permission.CASE_CREATE,
      Permission.CASE_REVIEW,
      Permission.ESSAY_MANAGE,
      Permission.SCHOOL_EDIT,
      Permission.SCHOOL_REVIEW,
      Permission.DATA_HEALTH,
      Permission.HIGHSCHOOL_MANAGE,
      Permission.CALENDAR_MANAGE,
    ],
  },
  CONTENT_MOD: {
    name: '内容审核',
    permissions: [
      Permission.CONTENT_MODERATE,
      Permission.CASE_REVIEW,
      Permission.USER_VIEW,
      Permission.AUDIT_VIEW,
    ],
  },
  USER_OPS: {
    name: '用户运营',
    permissions: [
      Permission.USER_VIEW,
      Permission.VERIFICATION_REVIEW,
      Permission.PAYMENT_VIEW,
      Permission.AUDIT_VIEW,
      Permission.NOTIFICATION_BROADCAST,
    ],
  },
  TECH_OPS: {
    name: '技术运营',
    permissions: [
      Permission.AI_CONFIG,
      Permission.SYSTEM_CALIBRATION,
      Permission.DATA_SYNC,
      Permission.DATA_HEALTH,
      Permission.AUDIT_VIEW,
    ],
  },
  INTERN: {
    name: '实习生',
    permissions: [
      Permission.CASE_CREATE,
      Permission.SCHOOL_EDIT,
      Permission.DATA_HEALTH,
    ],
  },
} as const;

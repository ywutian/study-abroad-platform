import type { Ionicons } from '@expo/vector-icons';

// ── Constants ──────────────────────────────────────────────

export const ROUND_VARIANTS: Record<string, 'error' | 'default' | 'secondary' | 'success'> = {
  ED: 'error',
  ED2: 'error',
  EA: 'default',
  REA: 'default',
  RD: 'secondary',
  ROLLING: 'success',
};
export const STATUS_VARIANTS: Record<
  string,
  'secondary' | 'default' | 'success' | 'error' | 'warning'
> = {
  NOT_STARTED: 'secondary',
  IN_PROGRESS: 'default',
  SUBMITTED: 'default',
  ACCEPTED: 'success',
  REJECTED: 'error',
  WAITLISTED: 'warning',
  WITHDRAWN: 'secondary',
};
export const TASK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  ESSAY: 'document-text-outline',
  DOCUMENT: 'folder-outline',
  TEST: 'school-outline',
  INTERVIEW: 'people-outline',
  RECOMMENDATION: 'mail-outline',
  OTHER: 'ellipsis-horizontal',
};

// ── Helpers ────────────────────────────────────────────────

export const getDaysLeft = (d?: Date | string) => {
  if (!d) return null;
  const target = new Date(d);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
};
export const fmtDate = (d?: Date | string) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

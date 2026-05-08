export type FullUiLocale = 'en' | 'zh';
export type FullUiRole = 'guest' | 'user' | 'admin';
export type FullUiViewportName = 'desktop' | 'mobile' | 'wide';
export type FullUiControlMode = 'standard' | 'forms' | 'read-only';

export interface FullUiSurfaceRoute {
  name: string;
  pattern: string;
  path: string;
  paths?: Partial<Record<FullUiLocale, string>>;
  role: FullUiRole;
  critical?: boolean;
  viewports?: FullUiViewportName[];
  controlMode?: FullUiControlMode;
  notes?: string;
}

export const FULL_UI_LOCALES: FullUiLocale[] = ['en', 'zh'];

export const FULL_UI_VIEWPORTS: Record<
  FullUiViewportName,
  { width: number; height: number; isMobile?: boolean }
> = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 900, isMobile: true },
  wide: { width: 2048, height: 1200 },
};

export const DEFAULT_FULL_UI_VIEWPORTS: FullUiViewportName[] = ['desktop', 'mobile'];

const CRITICAL_VIEWPORTS: FullUiViewportName[] = ['desktop', 'mobile', 'wide'];

export const FULL_UI_SURFACE_ROUTES: FullUiSurfaceRoute[] = [
  {
    name: 'Landing',
    pattern: '/',
    path: '/',
    role: 'guest',
    critical: true,
    viewports: CRITICAL_VIEWPORTS,
  },
  { name: 'About', pattern: '/about', path: '/about', role: 'guest', critical: true },
  { name: 'Assessment', pattern: '/assessment', path: '/assessment', role: 'user' },
  { name: 'Cases', pattern: '/cases', path: '/cases', role: 'guest', critical: true },
  {
    name: 'Case detail',
    pattern: '/cases/[id]',
    path: '/cases/e2e-case',
    role: 'guest',
    critical: true,
  },
  {
    name: 'Essay case detail',
    pattern: '/cases/essays/[id]',
    path: '/cases/essays/e2e-essay',
    role: 'guest',
  },
  { name: 'Forum', pattern: '/forum', path: '/forum', role: 'guest' },
  { name: 'Hall', pattern: '/hall', path: '/hall', role: 'guest' },
  { name: 'Help', pattern: '/help', path: '/help', role: 'guest', critical: true },
  { name: 'Privacy', pattern: '/privacy', path: '/privacy', role: 'guest' },
  { name: 'Ranking', pattern: '/ranking', path: '/ranking', role: 'guest' },
  { name: 'Schools', pattern: '/schools', path: '/schools', role: 'guest', critical: true },
  {
    name: 'School compare',
    pattern: '/schools/compare',
    path: '/schools/compare?schools=e2e-mit,e2e-stanford',
    role: 'guest',
    critical: true,
  },
  {
    name: 'School detail',
    pattern: '/schools/[id]',
    path: '/schools/e2e-mit',
    role: 'guest',
    critical: true,
  },
  { name: 'Terms', pattern: '/terms', path: '/terms', role: 'guest' },

  {
    name: 'Forgot password',
    pattern: '/forgot-password',
    path: '/forgot-password',
    role: 'guest',
    controlMode: 'forms',
  },
  {
    name: 'Login',
    pattern: '/login',
    path: '/login',
    role: 'guest',
    critical: true,
    controlMode: 'forms',
  },
  {
    name: 'Register',
    pattern: '/register',
    path: '/register',
    role: 'guest',
    critical: true,
    controlMode: 'forms',
  },
  {
    name: 'Register invite',
    pattern: '/register/invite',
    path: '/register/invite?token=e2e-invite',
    role: 'guest',
    controlMode: 'forms',
  },
  {
    name: 'Reset password',
    pattern: '/reset-password',
    path: '/reset-password?token=e2e-reset',
    role: 'guest',
    controlMode: 'forms',
  },
  {
    name: 'Verify email',
    pattern: '/verify-email',
    path: '/verify-email?email=e2e%40example.com',
    role: 'guest',
    controlMode: 'forms',
  },
  {
    name: 'Verify email callback',
    pattern: '/verify-email/callback',
    path: '/verify-email/callback?token=e2e-token',
    role: 'guest',
    controlMode: 'forms',
  },

  {
    name: 'Application analysis QA',
    pattern: '/qa/application-analysis/[caseId]',
    path: '/qa/application-analysis/001-uc-berkeley-blind-en',
    paths: {
      en: '/qa/application-analysis/001-uc-berkeley-blind-en',
      zh: '/qa/application-analysis/002-no-target-schools-zh',
    },
    role: 'user',
  },
  { name: 'AI', pattern: '/ai', path: '/ai', role: 'user' },
  { name: 'Chat', pattern: '/chat', path: '/chat', role: 'user' },
  { name: 'Dashboard', pattern: '/dashboard', path: '/dashboard', role: 'user', critical: true },
  { name: 'Essays', pattern: '/essays', path: '/essays', role: 'user', critical: true },
  { name: 'Followers', pattern: '/followers', path: '/followers', role: 'user' },
  { name: 'Notifications', pattern: '/notifications', path: '/notifications', role: 'user' },
  { name: 'Prediction', pattern: '/prediction', path: '/prediction', role: 'user', critical: true },
  { name: 'Profile', pattern: '/profile', path: '/profile', role: 'user', critical: true },
  { name: 'Referral', pattern: '/referral', path: '/referral', role: 'user' },
  { name: 'Resume', pattern: '/resume', path: '/resume', role: 'user' },
  {
    name: 'Resume detail',
    pattern: '/resume/[id]',
    path: '/resume/e2e-resume',
    role: 'user',
  },
  { name: 'Settings', pattern: '/settings', path: '/settings', role: 'user', critical: true },
  {
    name: 'Security settings',
    pattern: '/settings/security',
    path: '/settings/security',
    role: 'user',
    critical: true,
  },
  {
    name: 'Subscription settings',
    pattern: '/settings/subscription',
    path: '/settings/subscription',
    role: 'user',
  },
  { name: 'Teams', pattern: '/teams', path: '/teams', role: 'user' },
  { name: 'Create team', pattern: '/teams/create', path: '/teams/create', role: 'user' },
  {
    name: 'Join team',
    pattern: '/teams/join',
    path: '/teams/join?code=LUMNI-E2E',
    role: 'user',
    controlMode: 'forms',
  },
  { name: 'Team detail', pattern: '/teams/[id]', path: '/teams/e2e-team', role: 'user' },
  {
    name: 'Team settings',
    pattern: '/teams/[id]/settings',
    path: '/teams/e2e-team/settings',
    role: 'user',
    controlMode: 'forms',
  },
  { name: 'Timeline', pattern: '/timeline', path: '/timeline', role: 'user' },
  { name: 'Uncommon App', pattern: '/uncommon-app', path: '/uncommon-app', role: 'user' },
  { name: 'Vault', pattern: '/vault', path: '/vault', role: 'user' },

  { name: 'Admin', pattern: '/admin', path: '/admin', role: 'admin', critical: true },
  {
    name: 'Admin activity templates',
    pattern: '/admin/activity-templates',
    path: '/admin/activity-templates',
    role: 'admin',
  },
  {
    name: 'Admin AI operations',
    pattern: '/admin/ai-operations',
    path: '/admin/ai-operations',
    role: 'admin',
  },
  {
    name: 'Admin application analysis workflow',
    pattern: '/admin/application-analysis-workflow',
    path: '/admin/application-analysis-workflow',
    role: 'admin',
  },
  {
    name: 'Admin audit logs',
    pattern: '/admin/audit-logs',
    path: '/admin/audit-logs',
    role: 'admin',
  },
  { name: 'Admin calendar', pattern: '/admin/calendar', path: '/admin/calendar', role: 'admin' },
  {
    name: 'Admin calibrations',
    pattern: '/admin/calibrations',
    path: '/admin/calibrations',
    role: 'admin',
  },
  { name: 'Admin CDS bands', pattern: '/admin/cds-bands', path: '/admin/cds-bands', role: 'admin' },
  {
    name: 'Admin data coverage',
    pattern: '/admin/data-coverage',
    path: '/admin/data-coverage',
    role: 'admin',
  },
  {
    name: 'Admin data quality',
    pattern: '/admin/data-quality',
    path: '/admin/data-quality',
    role: 'admin',
  },
  {
    name: 'Admin data review',
    pattern: '/admin/data-review',
    path: '/admin/data-review',
    role: 'admin',
  },
  { name: 'Admin dev tools', pattern: '/admin/dev-tools', path: '/admin/dev-tools', role: 'admin' },
  { name: 'Admin essays', pattern: '/admin/essays', path: '/admin/essays', role: 'admin' },
  {
    name: 'Admin feature flags',
    pattern: '/admin/feature-flags',
    path: '/admin/feature-flags',
    role: 'admin',
  },
  {
    name: 'Admin high schools',
    pattern: '/admin/high-schools',
    path: '/admin/high-schools',
    role: 'admin',
  },
  { name: 'Admin memory', pattern: '/admin/memory', path: '/admin/memory', role: 'admin' },
  {
    name: 'Admin moderation',
    pattern: '/admin/moderation',
    path: '/admin/moderation',
    role: 'admin',
  },
  { name: 'Admin payments', pattern: '/admin/payments', path: '/admin/payments', role: 'admin' },
  { name: 'Admin points', pattern: '/admin/points', path: '/admin/points', role: 'admin' },
  {
    name: 'Admin prediction feedback',
    pattern: '/admin/prediction-feedback',
    path: '/admin/prediction-feedback',
    role: 'admin',
  },
  {
    name: 'Admin prediction health',
    pattern: '/admin/prediction-health',
    path: '/admin/prediction-health',
    role: 'admin',
  },
  { name: 'Admin schools', pattern: '/admin/schools', path: '/admin/schools', role: 'admin' },
  { name: 'Admin settings', pattern: '/admin/settings', path: '/admin/settings', role: 'admin' },
  { name: 'Admin team', pattern: '/admin/team', path: '/admin/team', role: 'admin' },
  {
    name: 'Admin theme styles',
    pattern: '/admin/theme-styles',
    path: '/admin/theme-styles',
    role: 'admin',
  },
  { name: 'Admin users', pattern: '/admin/users', path: '/admin/users', role: 'admin' },
  {
    name: 'Admin user detail',
    pattern: '/admin/users/[id]',
    path: '/admin/users/e2e-user',
    role: 'admin',
  },
  {
    name: 'Admin verifications',
    pattern: '/admin/verifications',
    path: '/admin/verifications',
    role: 'admin',
  },
];

export const CRITICAL_FULL_UI_PATTERNS = new Set(
  FULL_UI_SURFACE_ROUTES.filter((route) => route.critical).map((route) => route.pattern)
);

export function getRouteViewports(route: FullUiSurfaceRoute): FullUiViewportName[] {
  return route.viewports ?? (route.critical ? CRITICAL_VIEWPORTS : DEFAULT_FULL_UI_VIEWPORTS);
}

export function surfaceSlug(route: FullUiSurfaceRoute): string {
  return route.pattern
    .replace(/^\//, 'root-')
    .replace(/\[(.+?)\]/g, '$1')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

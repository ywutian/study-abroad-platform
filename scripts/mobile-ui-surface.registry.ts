export type MobileUiRole = 'guest' | 'user' | 'admin';
export type MobileUiSurfaceState = 'navigable' | 'contextual';

export interface MobileUiSurfaceRoute {
  name: string;
  pattern: string;
  path: string;
  role: MobileUiRole;
  state: MobileUiSurfaceState;
}

/**
 * Deliberate, reviewable inventory of every user-facing Expo Router page.
 *
 * This is intentionally not generated from the file tree: the closure gate
 * compares it with the discovered routes so a newly scaffolded screen cannot
 * silently become an unreviewed product surface.
 */
export const MOBILE_UI_SURFACE_ROUTES: MobileUiSurfaceRoute[] = [
  { name: 'Home', pattern: '/', path: '/', role: 'user', state: 'navigable' },
  {
    name: 'Forgot password',
    pattern: '/forgot-password',
    path: '/forgot-password',
    role: 'guest',
    state: 'navigable',
  },
  { name: 'Login', pattern: '/login', path: '/login', role: 'guest', state: 'navigable' },
  {
    name: 'Register',
    pattern: '/register',
    path: '/register',
    role: 'guest',
    state: 'navigable',
  },
  { name: 'AI chat', pattern: '/ai', path: '/ai', role: 'user', state: 'navigable' },
  { name: 'Cases', pattern: '/cases', path: '/cases', role: 'user', state: 'navigable' },
  { name: 'More', pattern: '/more', path: '/more', role: 'user', state: 'navigable' },
  { name: 'Profile', pattern: '/profile', path: '/profile', role: 'user', state: 'navigable' },
  { name: 'Schools', pattern: '/schools', path: '/schools', role: 'user', state: 'navigable' },
  { name: 'Admin', pattern: '/admin', path: '/admin', role: 'admin', state: 'navigable' },
  {
    name: 'Assessment',
    pattern: '/assessment',
    path: '/assessment',
    role: 'user',
    state: 'navigable',
  },
  {
    name: 'Case detail',
    pattern: '/case/:id',
    path: '/case/e2e-case',
    role: 'user',
    state: 'contextual',
  },
  {
    name: 'Chat detail',
    pattern: '/chat/:id',
    path: '/chat/e2e-chat',
    role: 'user',
    state: 'contextual',
  },
  {
    name: 'Essay gallery',
    pattern: '/essay-gallery',
    path: '/essay-gallery',
    role: 'user',
    state: 'navigable',
  },
  {
    name: 'Essay detail',
    pattern: '/essay/:id',
    path: '/essay/e2e-essay',
    role: 'user',
    state: 'contextual',
  },
  { name: 'Essays', pattern: '/essays', path: '/essays', role: 'user', state: 'navigable' },
  {
    name: 'Find college',
    pattern: '/find-college',
    path: '/find-college',
    role: 'user',
    state: 'navigable',
  },
  {
    name: 'Followers',
    pattern: '/followers',
    path: '/followers',
    role: 'user',
    state: 'navigable',
  },
  { name: 'Forum', pattern: '/forum', path: '/forum', role: 'user', state: 'navigable' },
  {
    name: 'Forum detail',
    pattern: '/forum/:id',
    path: '/forum/e2e-post',
    role: 'user',
    state: 'contextual',
  },
  { name: 'Hall', pattern: '/hall', path: '/hall', role: 'user', state: 'navigable' },
  {
    name: 'Notifications',
    pattern: '/notifications',
    path: '/notifications',
    role: 'user',
    state: 'navigable',
  },
  {
    name: 'Prediction',
    pattern: '/prediction',
    path: '/prediction',
    role: 'user',
    state: 'navigable',
  },
  {
    name: 'Profile activities',
    pattern: '/profile/activities',
    path: '/profile/activities',
    role: 'user',
    state: 'contextual',
  },
  {
    name: 'Profile analysis',
    pattern: '/profile/analysis',
    path: '/profile/analysis',
    role: 'user',
    state: 'contextual',
  },
  {
    name: 'Profile awards',
    pattern: '/profile/awards',
    path: '/profile/awards',
    role: 'user',
    state: 'contextual',
  },
  {
    name: 'Profile basic',
    pattern: '/profile/basic',
    path: '/profile/basic',
    role: 'user',
    state: 'contextual',
  },
  {
    name: 'Profile education',
    pattern: '/profile/education',
    path: '/profile/education',
    role: 'user',
    state: 'contextual',
  },
  {
    name: 'Profile essays',
    pattern: '/profile/essays',
    path: '/profile/essays',
    role: 'user',
    state: 'contextual',
  },
  {
    name: 'Profile export',
    pattern: '/profile/export',
    path: '/profile/export',
    role: 'user',
    state: 'contextual',
  },
  {
    name: 'Profile scores',
    pattern: '/profile/scores',
    path: '/profile/scores',
    role: 'user',
    state: 'contextual',
  },
  { name: 'Ranking', pattern: '/ranking', path: '/ranking', role: 'user', state: 'navigable' },
  {
    name: 'Recommendation',
    pattern: '/recommendation',
    path: '/recommendation',
    role: 'user',
    state: 'navigable',
  },
  {
    name: 'Referral',
    pattern: '/referral',
    path: '/referral',
    role: 'user',
    state: 'navigable',
  },
  { name: 'Resume', pattern: '/resume', path: '/resume', role: 'user', state: 'navigable' },
  {
    name: 'School detail',
    pattern: '/school/:id',
    path: '/school/e2e-school',
    role: 'user',
    state: 'contextual',
  },
  {
    name: 'Security',
    pattern: '/security',
    path: '/security',
    role: 'user',
    state: 'navigable',
  },
  {
    name: 'Settings',
    pattern: '/settings',
    path: '/settings',
    role: 'user',
    state: 'navigable',
  },
  {
    name: 'Language settings',
    pattern: '/settings/language',
    path: '/settings/language',
    role: 'user',
    state: 'contextual',
  },
  {
    name: 'Theme settings',
    pattern: '/settings/theme',
    path: '/settings/theme',
    role: 'user',
    state: 'contextual',
  },
  { name: 'Swipe', pattern: '/swipe', path: '/swipe', role: 'user', state: 'navigable' },
  { name: 'Teams', pattern: '/teams', path: '/teams', role: 'user', state: 'navigable' },
  {
    name: 'Timeline',
    pattern: '/timeline',
    path: '/timeline',
    role: 'user',
    state: 'navigable',
  },
  {
    name: 'Application workspace',
    pattern: '/uncommon-app',
    path: '/uncommon-app',
    role: 'user',
    state: 'navigable',
  },
  { name: 'Vault', pattern: '/vault', path: '/vault', role: 'user', state: 'navigable' },
  {
    name: 'Verification',
    pattern: '/verification',
    path: '/verification',
    role: 'user',
    state: 'navigable',
  },
];

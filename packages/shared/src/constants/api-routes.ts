/**
 * Shared API route prefixes — Single Source of Truth
 *
 * All backend controllers use these prefixes. Web and Mobile clients
 * MUST import from here instead of hardcoding route strings.
 *
 * Generated from backend @Controller() decorators.
 * When a controller prefix changes, update HERE and all consumers auto-sync.
 */

// ─── Route Prefixes ──────────────────────────────────────────────────────────
// Each key maps to a backend @Controller('prefix') decorator.
// ALL prefixes use plural nouns (NestJS convention in this project).

export const API_ROUTES = {
  // Auth & Users
  AUTH: '/auth',
  USERS: '/users',
  PROFILES: '/profiles',

  // Schools & Lists
  SCHOOLS: '/schools',
  HIGH_SCHOOLS: '/high-schools',
  SCHOOL_LISTS: '/school-lists',
  RANKINGS: '/rankings',

  // Applications & Cases
  CASES: '/cases',
  PREDICTIONS: '/predictions',
  RECOMMENDATIONS: '/recommendations',
  ASSESSMENTS: '/assessments',

  // Content & Social
  FORUMS: '/forums',
  HALLS: '/halls',
  CHATS: '/chats',
  TEAMS: '/teams',
  PEER_REVIEWS: '/peer-reviews',

  // Essays & AI
  ESSAY_AI: '/essay-ai',
  ESSAY_PROMPTS: '/essay-prompts',
  AI_AGENT: '/ai-agent',
  AI: '/ai',

  // Platform
  TIMELINES: '/timelines',
  NOTIFICATIONS: '/notifications',
  SUBSCRIPTIONS: '/subscriptions',
  RESUMES: '/resumes',
  VERIFICATIONS: '/verifications',
  VAULTS: '/vaults',
  POINTS: '/points',
  SETTINGS: '/settings',
  HEALTH: '/health',
} as const;

export type ApiRoutePrefix = (typeof API_ROUTES)[keyof typeof API_ROUTES];

// ─── Common Sub-Route Helpers ────────────────────────────────────────────────
// Typed helpers for frequently used endpoints to avoid string concatenation.

export const profileRoutes = {
  me: () => `${API_ROUTES.PROFILES}/me`,
  testScores: () => `${API_ROUTES.PROFILES}/me/test-scores`,
  testScore: (id: string) => `${API_ROUTES.PROFILES}/me/test-scores/${id}`,
  activities: () => `${API_ROUTES.PROFILES}/me/activities`,
  activity: (id: string) => `${API_ROUTES.PROFILES}/me/activities/${id}`,
  awards: () => `${API_ROUTES.PROFILES}/me/awards`,
  award: (id: string) => `${API_ROUTES.PROFILES}/me/awards/${id}`,
  recommendationLetters: () => `${API_ROUTES.PROFILES}/me/recommendation-letters`,
  recommendationLetter: (id: string) => `${API_ROUTES.PROFILES}/me/recommendation-letters/${id}`,
};

export const forumRoutes = {
  posts: () => `${API_ROUTES.FORUMS}/posts`,
  post: (id: string) => `${API_ROUTES.FORUMS}/posts/${id}`,
  postLike: (id: string) => `${API_ROUTES.FORUMS}/posts/${id}/like`,
  postApply: (id: string) => `${API_ROUTES.FORUMS}/posts/${id}/apply`,
  postReport: (id: string) => `${API_ROUTES.FORUMS}/posts/${id}/report`,
  comments: (postId: string) => `${API_ROUTES.FORUMS}/posts/${postId}/comments`,
};

export const hallRoutes = {
  lists: () => `${API_ROUTES.HALLS}/lists`,
  listVote: (id: string) => `${API_ROUTES.HALLS}/lists/${id}/vote`,
  reviews: () => `${API_ROUTES.HALLS}/reviews`,
  reviewReact: (id: string) => `${API_ROUTES.HALLS}/reviews/${id}/react`,
  verified: () => `${API_ROUTES.HALLS}/verified`,
  swipe: () => `${API_ROUTES.HALLS}/swipe`,
};

export const chatRoutes = {
  conversations: () => `${API_ROUTES.CHATS}/conversations`,
  messages: (conversationId: string) => `${API_ROUTES.CHATS}/messages/${conversationId}`,
  follow: (userId: string) => `${API_ROUTES.CHATS}/follow/${userId}`,
  block: (userId: string) => `${API_ROUTES.CHATS}/block/${userId}`,
  unblock: (userId: string) => `${API_ROUTES.CHATS}/unblock/${userId}`,
};

export const predictionRoutes = {
  predict: () => API_ROUTES.PREDICTIONS,
  history: () => `${API_ROUTES.PREDICTIONS}/history`,
  report: (id: string) => `${API_ROUTES.PREDICTIONS}/${id}/report`,
};

export const recommendationRoutes = {
  generate: () => API_ROUTES.RECOMMENDATIONS,
  history: () => `${API_ROUTES.RECOMMENDATIONS}/history`,
  preflight: () => `${API_ROUTES.RECOMMENDATIONS}/preflight`,
};

export const assessmentRoutes = {
  start: (type: string) => `${API_ROUTES.ASSESSMENTS}/${type}`,
  submit: (type: string) => `${API_ROUTES.ASSESSMENTS}/${type}/submit`,
  results: () => `${API_ROUTES.ASSESSMENTS}/results`,
};

export const subscriptionRoutes = {
  plans: () => `${API_ROUTES.SUBSCRIPTIONS}/plans`,
  current: () => API_ROUTES.SUBSCRIPTIONS,
  invoices: () => `${API_ROUTES.SUBSCRIPTIONS}/invoices`,
  subscribe: () => API_ROUTES.SUBSCRIPTIONS,
  cancel: () => API_ROUTES.SUBSCRIPTIONS,
};

export const timelineRoutes = {
  mine: () => `${API_ROUTES.TIMELINES}/mine`,
  personal: () => `${API_ROUTES.TIMELINES}/personal`,
  global: () => `${API_ROUTES.TIMELINES}/global`,
  tasks: () => `${API_ROUTES.TIMELINES}/tasks`,
  taskToggle: (id: string) => `${API_ROUTES.TIMELINES}/tasks/${id}/toggle`,
};

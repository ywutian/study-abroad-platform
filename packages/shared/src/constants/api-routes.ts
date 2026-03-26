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

  // Admin
  ADMIN: '/admin',
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
  conversation: (id: string) => `${API_ROUTES.CHATS}/conversations/${id}`,
  conversationMessages: (id: string) => `${API_ROUTES.CHATS}/conversations/${id}/messages`,
  message: (messageId: string) => `${API_ROUTES.CHATS}/messages/${messageId}`,
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
  submit: () => API_ROUTES.ASSESSMENTS,
  results: () => `${API_ROUTES.ASSESSMENTS}/results`,
};

export const subscriptionRoutes = {
  plans: () => `${API_ROUTES.SUBSCRIPTIONS}/plans`,
  current: () => `${API_ROUTES.SUBSCRIPTIONS}/me`,
  invoices: () => `${API_ROUTES.SUBSCRIPTIONS}/billing-history`,
  subscribe: () => `${API_ROUTES.SUBSCRIPTIONS}/subscribe`,
  cancel: () => `${API_ROUTES.SUBSCRIPTIONS}/cancel`,
};

export const timelineRoutes = {
  mine: () => `${API_ROUTES.TIMELINES}/mine`,
  personal: () => `${API_ROUTES.TIMELINES}/personal`,
  global: () => `${API_ROUTES.TIMELINES}/global`,
  tasks: () => `${API_ROUTES.TIMELINES}/tasks`,
  taskToggle: (id: string) => `${API_ROUTES.TIMELINES}/tasks/${id}/toggle`,
};

export const authRoutes = {
  login: () => `${API_ROUTES.AUTH}/login`,
  register: () => `${API_ROUTES.AUTH}/register`,
  refresh: () => `${API_ROUTES.AUTH}/refresh`,
  logout: () => `${API_ROUTES.AUTH}/logout`,
  verifyEmail: () => `${API_ROUTES.AUTH}/verify-email`,
  changePassword: () => `${API_ROUTES.AUTH}/change-password`,
  forgotPassword: () => `${API_ROUTES.AUTH}/forgot-password`,
  resetPassword: () => `${API_ROUTES.AUTH}/reset-password`,
  resendVerification: () => `${API_ROUTES.AUTH}/resend-verification`,
};

export const essayAiRoutes = {
  review: () => `${API_ROUTES.ESSAY_AI}/review`,
  polish: () => `${API_ROUTES.ESSAY_AI}/polish`,
  brainstorm: () => `${API_ROUTES.ESSAY_AI}/brainstorm`,
  continueWriting: () => `${API_ROUTES.ESSAY_AI}/continue-writing`,
  generateOpening: () => `${API_ROUTES.ESSAY_AI}/generate-opening`,
  rewriteParagraph: () => `${API_ROUTES.ESSAY_AI}/rewrite-paragraph`,
  gallery: () => `${API_ROUTES.ESSAY_AI}/gallery`,
};

export const resumeRoutes = {
  list: () => API_ROUTES.RESUMES,
  byId: (id: string) => `${API_ROUTES.RESUMES}/${id}`,
  duplicate: (id: string) => `${API_ROUTES.RESUMES}/${id}/duplicate`,
  sections: (resumeId: string) => `${API_ROUTES.RESUMES}/${resumeId}/sections`,
  section: (resumeId: string, sectionId: string) =>
    `${API_ROUTES.RESUMES}/${resumeId}/sections/${sectionId}`,
  importProfile: (resumeId: string) => `${API_ROUTES.RESUMES}/${resumeId}/import-profile`,
  snapshots: (resumeId: string) => `${API_ROUTES.RESUMES}/${resumeId}/snapshots`,
  aiReview: (id: string) => `${API_ROUTES.RESUMES}/${id}/ai/review`,
  aiOptimize: (id: string) => `${API_ROUTES.RESUMES}/${id}/ai/optimize-bullets`,
  aiSuggest: (id: string) => `${API_ROUTES.RESUMES}/${id}/ai/suggest`,
};

export const schoolRoutes = {
  list: () => API_ROUTES.SCHOOLS,
  byId: (id: string) => `${API_ROUTES.SCHOOLS}/${id}`,
};

export const highSchoolRoutes = {
  list: () => API_ROUTES.HIGH_SCHOOLS,
  suggest: () => `${API_ROUTES.HIGH_SCHOOLS}/suggest`,
};

export const schoolListRoutes = {
  list: () => API_ROUTES.SCHOOL_LISTS,
  byId: (id: string) => `${API_ROUTES.SCHOOL_LISTS}/${id}`,
};

export const caseRoutes = {
  list: () => API_ROUTES.CASES,
  byId: (id: string) => `${API_ROUTES.CASES}/${id}`,
};

export const notificationRoutes = {
  list: () => API_ROUTES.NOTIFICATIONS,
  byId: (id: string) => `${API_ROUTES.NOTIFICATIONS}/${id}`,
  markRead: (id: string) => `${API_ROUTES.NOTIFICATIONS}/${id}/read`,
  readAll: () => `${API_ROUTES.NOTIFICATIONS}/read-all`,
};

export const verificationRoutes = {
  submit: () => API_ROUTES.VERIFICATIONS,
  my: () => `${API_ROUTES.VERIFICATIONS}/my`,
  history: () => `${API_ROUTES.VERIFICATIONS}/history`,
  status: () => `${API_ROUTES.VERIFICATIONS}/status`,
  review: (id: string) => `${API_ROUTES.VERIFICATIONS}/${id}/review`,
};

export const peerReviewRoutes = {
  request: (targetUserId: string) => `${API_ROUTES.PEER_REVIEWS}/request/${targetUserId}`,
  submit: (reviewId: string) => `${API_ROUTES.PEER_REVIEWS}/${reviewId}/submit`,
};

export const teamRoutes = {
  list: () => API_ROUTES.TEAMS,
  byId: (id: string) => `${API_ROUTES.TEAMS}/${id}`,
  join: (id: string) => `${API_ROUTES.TEAMS}/${id}/join`,
  leave: (id: string) => `${API_ROUTES.TEAMS}/${id}/leave`,
};

export const userRoutes = {
  me: () => `${API_ROUTES.USERS}/me`,
};

export const essayPromptRoutes = {
  bySchool: (schoolId: string) => `${API_ROUTES.ESSAY_PROMPTS}/by-school/${schoolId}`,
};

export const settingsRoutes = {
  list: () => API_ROUTES.SETTINGS,
  byKey: (key: string) => `${API_ROUTES.SETTINGS}/${key}`,
};

export const rankingRoutes = {
  list: () => API_ROUTES.RANKINGS,
};

export const adminFeatureFlagRoutes = {
  list: () => `${API_ROUTES.ADMIN}/feature-flags`,
  byId: (id: string) => `${API_ROUTES.ADMIN}/feature-flags/${id}`,
  invalidateCache: (id: string) => `${API_ROUTES.ADMIN}/feature-flags/${id}/invalidate-cache`,
};

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
  byId: (id: string) => `${API_ROUTES.PROFILES}/${id}`,
  onboarding: () => `${API_ROUTES.PROFILES}/onboarding`,
  aiAnalysis: () => `${API_ROUTES.PROFILES}/me/ai-analysis`,
  aiAnalysisFeedback: () => `${API_ROUTES.PROFILES}/me/ai-analysis/feedback`,
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
  verifiedRanking: () => `${API_ROUTES.HALLS}/verified-ranking`,
  swipe: () => `${API_ROUTES.HALLS}/swipe`,
  publicProfiles: () => `${API_ROUTES.HALLS}/public-profiles`,
};

export const chatRoutes = {
  conversations: () => `${API_ROUTES.CHATS}/conversations`,
  conversation: (id: string) => `${API_ROUTES.CHATS}/conversations/${id}`,
  conversationMessages: (id: string) => `${API_ROUTES.CHATS}/conversations/${id}/messages`,
  conversationRead: (id: string) => `${API_ROUTES.CHATS}/conversations/${id}/read`,
  conversationPin: (id: string) => `${API_ROUTES.CHATS}/conversations/${id}/pin`,
  conversationUpload: (id: string) => `${API_ROUTES.CHATS}/conversations/${id}/upload`,
  message: (messageId: string) => `${API_ROUTES.CHATS}/messages/${messageId}`,
  follow: (userId: string) => `${API_ROUTES.CHATS}/follow/${userId}`,
  block: (userId: string) => `${API_ROUTES.CHATS}/block/${userId}`,
  report: () => `${API_ROUTES.CHATS}/report`,
  followers: () => `${API_ROUTES.CHATS}/followers`,
  following: () => `${API_ROUTES.CHATS}/following`,
  blocked: () => `${API_ROUTES.CHATS}/blocked`,
  unreadCount: () => `${API_ROUTES.CHATS}/unread-count`,
  recommendations: () => `${API_ROUTES.CHATS}/recommendations`,
};

export const predictionRoutes = {
  predict: () => API_ROUTES.PREDICTIONS,
  history: () => `${API_ROUTES.PREDICTIONS}/history`,
  result: (schoolId: string) => `${API_ROUTES.PREDICTIONS}/${schoolId}/result`,
  report: (schoolId: string) => `${API_ROUTES.PREDICTIONS}/${schoolId}/result`,
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
  overview: () => `${API_ROUTES.TIMELINES}/overview`,
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
  activityDescription: () => `${API_ROUTES.ESSAY_AI}/activity-description`,
  gallery: () => `${API_ROUTES.ESSAY_AI}/gallery`,
  galleryItem: (id: string) => `${API_ROUTES.ESSAY_AI}/gallery/${id}`,
  galleryAnalyze: (id: string) => `${API_ROUTES.ESSAY_AI}/gallery/${id}/analyze`,
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
  countries: () => `${API_ROUTES.SCHOOLS}/countries`,
  communityRatingSummary: (id: string) => `${API_ROUTES.SCHOOLS}/${id}/community-ratings/summary`,
  communityRatingMe: (id: string) => `${API_ROUTES.SCHOOLS}/${id}/community-ratings/me`,
  logoSuggestion: (id: string) => `${API_ROUTES.SCHOOLS}/${id}/logo-suggestion`,
  scrapeAll: () => `${API_ROUTES.SCHOOLS}/scrape/all`,
  ucIds: () => `${API_ROUTES.SCHOOLS}/uc-ids`,
  aiRecommend: () => `${API_ROUTES.SCHOOLS}/ai/recommend`,
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
  unreadCount: () => `${API_ROUTES.NOTIFICATIONS}/unread-count`,
  byId: (id: string) => `${API_ROUTES.NOTIFICATIONS}/${id}`,
  delete: (id: string) => `${API_ROUTES.NOTIFICATIONS}/${id}`,
  deleteAll: () => API_ROUTES.NOTIFICATIONS,
  pushToken: () => `${API_ROUTES.NOTIFICATIONS}/push-token`,
  markRead: (id: string) => `${API_ROUTES.NOTIFICATIONS}/${id}/read`,
  readAll: () => `${API_ROUTES.NOTIFICATIONS}/read-all`,
};

export const verificationRoutes = {
  submit: () => API_ROUTES.VERIFICATIONS,
  my: () => `${API_ROUTES.VERIFICATIONS}/my`,
  history: () => `${API_ROUTES.VERIFICATIONS}/history`,
  status: () => `${API_ROUTES.VERIFICATIONS}/status`,
  stats: () => `${API_ROUTES.VERIFICATIONS}/stats`,
  pending: () => `${API_ROUTES.VERIFICATIONS}/pending`,
  byId: (id: string) => `${API_ROUTES.VERIFICATIONS}/${id}`,
  review: (id: string) => `${API_ROUTES.VERIFICATIONS}/${id}/review`,
};

export const peerReviewRoutes = {
  request: (targetUserId: string) => `${API_ROUTES.PEER_REVIEWS}/request/${targetUserId}`,
  submit: (reviewId: string) => `${API_ROUTES.PEER_REVIEWS}/${reviewId}/submit`,
};

export const teamRoutes = {
  list: () => API_ROUTES.TEAMS,
  byId: (id: string) => `${API_ROUTES.TEAMS}/${id}`,
  invite: (id: string) => `${API_ROUTES.TEAMS}/${id}/invite`,
  joinByToken: () => `${API_ROUTES.TEAMS}/join`,
  join: (id: string) => `${API_ROUTES.TEAMS}/${id}/join`,
  leave: (id: string) => `${API_ROUTES.TEAMS}/${id}/leave`,
  recruitmentContexts: () => `${API_ROUTES.TEAMS}/recruitment-contexts`,
  recruitmentContextsBySourceTypeAndCompetitionId: (params: {
    sourceType?: string | null;
    competitionId?: string | null;
  }) => {
    const query = new URLSearchParams();
    if (params.sourceType) query.set('sourceType', params.sourceType);
    if (params.competitionId) query.set('competitionId', params.competitionId);
    const queryString = query.toString();
    return queryString
      ? `${teamRoutes.recruitmentContexts()}?${queryString}`
      : teamRoutes.recruitmentContexts();
  },
  communityContexts: () => `${API_ROUTES.TEAMS}/community-contexts`,
  communityContextById: (id: string) => `${API_ROUTES.TEAMS}/community-contexts/${id}`,
  communityContextPublish: (id: string) => `${API_ROUTES.TEAMS}/community-contexts/${id}/publish`,
  matchPools: () => `${API_ROUTES.TEAMS}/match-pools`,
  matchPoolById: (id: string) => `${API_ROUTES.TEAMS}/match-pools/${id}`,
  recruitments: () => `${API_ROUTES.TEAMS}/recruitments`,
  myRecruitments: () => `${API_ROUTES.TEAMS}/recruitments/me`,
  recruitmentDeck: () => `${API_ROUTES.TEAMS}/recruitments/deck`,
  recruitmentDeckPreview: () => `${API_ROUTES.TEAMS}/recruitments/deck/preview`,
  recruitmentById: (id: string) => `${API_ROUTES.TEAMS}/recruitments/${id}`,
  recruitmentMemberProfile: (id: string) => `${API_ROUTES.TEAMS}/recruitments/${id}/members/me`,
  recruitmentPublish: (id: string) => `${API_ROUTES.TEAMS}/recruitments/${id}/publish`,
  recruitmentClose: (id: string) => `${API_ROUTES.TEAMS}/recruitments/${id}/close`,
  recruitmentSwipe: (id: string) => `${API_ROUTES.TEAMS}/recruitments/${id}/swipes`,
  matches: () => `${API_ROUTES.TEAMS}/matches`,
  matchInviteMembers: (id: string) => `${API_ROUTES.TEAMS}/matches/${id}/invite-members`,
};

export const userRoutes = {
  me: () => `${API_ROUTES.USERS}/me`,
  dashboard: () => `${API_ROUTES.USERS}/me/dashboard`,
  referral: () => `${API_ROUTES.USERS}/me/referral`,
  referrals: () => `${API_ROUTES.USERS}/me/referrals`,
};

export const essayPromptRoutes = {
  bySchool: (schoolId: string) => `${API_ROUTES.ESSAY_PROMPTS}/by-school/${schoolId}`,
};

export const settingsRoutes = {
  list: () => API_ROUTES.SETTINGS,
  byKey: (key: string) => `${API_ROUTES.SETTINGS}/${key}`,
  byCategory: (category: string) => `${API_ROUTES.SETTINGS}/category/${category}`,
};

export const rankingRoutes = {
  list: () => API_ROUTES.RANKINGS,
};

export const healthRoutes = {
  check: () => API_ROUTES.HEALTH,
  detailed: () => `${API_ROUTES.HEALTH}/detailed`,
  live: () => `${API_ROUTES.HEALTH}/live`,
  ready: () => `${API_ROUTES.HEALTH}/ready`,
};

export const pointsRoutes = {
  summary: () => `${API_ROUTES.USERS}/me/points/summary`,
  history: () => `${API_ROUTES.USERS}/me/points/history`,
  rules: () => `${API_ROUTES.USERS}/me/points/rules`,
};

export const adminFeatureFlagRoutes = {
  list: () => `${API_ROUTES.ADMIN}/feature-flags`,
  byId: (id: string) => `${API_ROUTES.ADMIN}/feature-flags/${id}`,
  invalidateCache: (id: string) => `${API_ROUTES.ADMIN}/feature-flags/${id}/invalidate-cache`,
};

export const adminRoutes = {
  // Stats & Dashboard
  stats: () => `${API_ROUTES.ADMIN}/stats`,
  statsTrends: () => `${API_ROUTES.ADMIN}/stats/trends`,

  // Users
  users: () => `${API_ROUTES.ADMIN}/users`,
  userById: (id: string) => `${API_ROUTES.ADMIN}/users/${id}`,
  userRole: (userId: string) => `${API_ROUTES.ADMIN}/users/${userId}/role`,
  userBan: (userId: string) => `${API_ROUTES.ADMIN}/users/${userId}/ban`,
  userUnban: (userId: string) => `${API_ROUTES.ADMIN}/users/${userId}/unban`,
  userRoleAssign: (userId: string) => `${API_ROUTES.ADMIN}/roles/users/${userId}/role`,

  // Roles & Permissions
  myPermissions: () => `${API_ROUTES.ADMIN}/roles/my-permissions`,
  operators: () => `${API_ROUTES.ADMIN}/roles/operators`,
  operatorStats: (operatorId: string) => `${API_ROUTES.ADMIN}/roles/operators/${operatorId}/stats`,
  operatorInvite: () => `${API_ROUTES.ADMIN}/roles/operators/invite`,
  invites: () => `${API_ROUTES.ADMIN}/roles/invites`,
  permissions: () => `${API_ROUTES.ADMIN}/roles/permissions`,
  usersSearch: () => `${API_ROUTES.ADMIN}/roles/users/search`,
  usersPromote: () => `${API_ROUTES.ADMIN}/roles/users/promote`,
  userPermissions: (userId: string) => `${API_ROUTES.ADMIN}/roles/users/${userId}/permissions`,

  // Audit Logs
  auditLogs: () => `${API_ROUTES.ADMIN}/audit-logs`,

  // Reports
  reports: () => `${API_ROUTES.ADMIN}/reports`,
  reportById: (id: string) => `${API_ROUTES.ADMIN}/reports/${id}`,
  reportClaim: (id: string) => `${API_ROUTES.ADMIN}/reports/${id}/claim`,
  reportRelease: (id: string) => `${API_ROUTES.ADMIN}/reports/${id}/release`,

  // Moderation
  moderationStatistics: () => `${API_ROUTES.ADMIN}/moderation/statistics`,
  forumsPostDelete: (id: string) => `${API_ROUTES.ADMIN}/forums/posts/${id}`,
  forumsPostPin: (postId: string) => `${API_ROUTES.ADMIN}/forums/posts/${postId}/pin`,
  forumsPostLock: (postId: string) => `${API_ROUTES.ADMIN}/forums/posts/${postId}/lock`,
  matchPools: () => `${API_ROUTES.ADMIN}/match-pools`,
  matchPoolById: (id: string) => `${API_ROUTES.ADMIN}/match-pools/${id}`,
  matchPoolEntryById: (id: string) => `${API_ROUTES.ADMIN}/match-pools/entries/${id}`,
  communityContexts: () => `${API_ROUTES.ADMIN}/community-contexts`,
  communityContextReview: (id: string) => `${API_ROUTES.ADMIN}/community-contexts/${id}/review`,
  communityContextPromote: (id: string) => `${API_ROUTES.ADMIN}/community-contexts/${id}/promote`,
  forumsPostsBatch: () => `${API_ROUTES.ADMIN}/forums/posts/batch`,
  forumsCommentDelete: (id: string) => `${API_ROUTES.ADMIN}/forums/comments/${id}`,
  chatsMessageDelete: (id: string) => `${API_ROUTES.ADMIN}/chats/messages/${id}`,
  reviewById: (id: string) => `${API_ROUTES.ADMIN}/reviews/${id}`,
  reviewHide: (id: string) => `${API_ROUTES.ADMIN}/reviews/${id}/hide`,
  reviewUnhide: (id: string) => `${API_ROUTES.ADMIN}/reviews/${id}/unhide`,

  // Payments
  payments: () => `${API_ROUTES.ADMIN}/payments`,
  paymentsStats: () => `${API_ROUTES.ADMIN}/payments/stats`,
  paymentRefund: (paymentId: string) => `${API_ROUTES.ADMIN}/payments/${paymentId}/refund`,
  paymentUserSubscription: (userId: string) =>
    `${API_ROUTES.ADMIN}/payments/users/${userId}/subscription`,

  // Points
  pointsConfig: () => `${API_ROUTES.ADMIN}/points/config`,
  pointsToggle: () => `${API_ROUTES.ADMIN}/points/toggle`,
  pointsActions: () => `${API_ROUTES.ADMIN}/points/actions`,
  pointsReset: () => `${API_ROUTES.ADMIN}/points/reset`,

  // Data Review
  reviewStats: () => `${API_ROUTES.ADMIN}/review/stats`,
  reviewPendingCases: () => `${API_ROUTES.ADMIN}/review/pending-cases`,
  reviewQueue: () => `${API_ROUTES.ADMIN}/review/queue`,
  reviewApprove: (id: string) => `${API_ROUTES.ADMIN}/review/${id}/approve`,
  reviewReject: (id: string) => `${API_ROUTES.ADMIN}/review/${id}/reject`,
  reviewEditAndApprove: (id: string) => `${API_ROUTES.ADMIN}/review/${id}/edit-and-approve`,
  reviewBatches: () => `${API_ROUTES.ADMIN}/review/batches`,
  reviewBatchRollback: (batchId: string) =>
    `${API_ROUTES.ADMIN}/review/batches/${batchId}/rollback`,

  // Data Review - Case Review
  reviewCaseApprove: (id: string) => `${API_ROUTES.ADMIN}/review/cases/${id}/approve`,
  reviewCaseReject: (id: string) => `${API_ROUTES.ADMIN}/review/cases/${id}/reject`,
  reviewBatch: () => `${API_ROUTES.ADMIN}/review/batch`,

  // Cases
  casesBatchImport: () => `${API_ROUTES.ADMIN}/cases/batch-import`,
  casesBatchVerify: () => `${API_ROUTES.ADMIN}/cases/batch-verify`,
  casesPendingEssays: () => `${API_ROUTES.ADMIN}/cases/pending-essays`,
  casesStats: () => `${API_ROUTES.ADMIN}/cases/stats`,
  caseReviewEssay: (id: string) => `${API_ROUTES.ADMIN}/cases/${id}/review-essay`,

  // Essay Prompts
  essayPrompts: () => `${API_ROUTES.ADMIN}/essay-prompts`,
  essayPromptsBatchImport: () => `${API_ROUTES.ADMIN}/essay-prompts/batch-import`,
  essayPromptsBatchVerify: () => `${API_ROUTES.ADMIN}/essay-prompts/batch-verify`,
  essayPromptsStats: () => `${API_ROUTES.ADMIN}/essay-prompts/stats`,
  essayPromptVerify: (id: string) => `${API_ROUTES.ADMIN}/essay-prompts/${id}/verify`,

  // Essay Scraper
  essayScraperCoverage: () => `${API_ROUTES.ADMIN}/essay-scraper/dashboard/coverage`,
  essayScraperFreshness: () => `${API_ROUTES.ADMIN}/essay-scraper/dashboard/freshness`,
  essayScraperPipelineRuns: () => `${API_ROUTES.ADMIN}/essay-scraper/pipeline/runs`,
  essayScraperPipelineStart: () => `${API_ROUTES.ADMIN}/essay-scraper/pipeline/start`,
  essayScraperTestScrape: () => `${API_ROUTES.ADMIN}/essay-scraper/test-scrape`,
  essayScraperScrapeAll: () => `${API_ROUTES.ADMIN}/essay-scraper/scrape-all`,
  essayScraperScrapeSchool: () => `${API_ROUTES.ADMIN}/essay-scraper/scrape`,
  essayScraperConfirmSave: () => `${API_ROUTES.ADMIN}/essay-scraper/confirm-save`,

  // High Schools
  highSchools: () => `${API_ROUTES.ADMIN}/high-schools`,
  highSchoolById: (id: string) => `${API_ROUTES.ADMIN}/high-schools/${id}`,
  highSchoolsBatchImport: () => `${API_ROUTES.ADMIN}/high-schools/batch-import`,
  highSchoolsReviewNeeded: () => `${API_ROUTES.ADMIN}/high-schools/review-needed`,
  highSchoolsSuggestions: () => `${API_ROUTES.ADMIN}/high-schools/suggestions`,
  highSchoolsSuggestionApprove: (id: string) =>
    `${API_ROUTES.ADMIN}/high-schools/suggestions/${id}/approve`,
  highSchoolsSuggestionReject: (id: string) =>
    `${API_ROUTES.ADMIN}/high-schools/suggestions/${id}/reject`,

  // Data Sync
  dataSyncJobs: () => `${API_ROUTES.ADMIN}/data-sync/jobs`,
  dataSyncTrigger: () => `${API_ROUTES.ADMIN}/data-sync/trigger`,

  // Activity Templates
  activityTemplates: () => `${API_ROUTES.ADMIN}/activity-templates`,
  activityTemplateById: (id: string) => `${API_ROUTES.ADMIN}/activity-templates/${id}`,

  // School Deadlines
  schoolDeadlines: () => `${API_ROUTES.ADMIN}/school-deadlines`,
  schoolDeadlineById: (id: string) => `${API_ROUTES.ADMIN}/school-deadlines/${id}`,

  // Global Events
  globalEvents: () => `${API_ROUTES.ADMIN}/global-events`,
  globalEventById: (id: string) => `${API_ROUTES.ADMIN}/global-events/${id}`,

  // Calibrations
  calibrations: () => `${API_ROUTES.ADMIN}/calibrations`,
  calibrationById: (id: string) => `${API_ROUTES.ADMIN}/calibrations/${id}`,
  calibrationsBulk: () => `${API_ROUTES.ADMIN}/calibrations/bulk`,
  calibrationsStats: () => `${API_ROUTES.ADMIN}/calibrations/stats`,
  calibrationsSuggestions: () => `${API_ROUTES.ADMIN}/calibrations/suggestions`,
  calibrationsPlattStatus: () => `${API_ROUTES.ADMIN}/calibrations/platt-status`,
  calibrationsRetrain: () => `${API_ROUTES.ADMIN}/calibrations/retrain`,

  // Prediction diagnostic (real-case ingest)
  predictionsDiagIngestCases: () => `${API_ROUTES.ADMIN}/predictions/diag/ingest-cases`,
  predictionsDiagRealCasesTemplate: () =>
    `${API_ROUTES.ADMIN}/predictions/diag/real-cases-template`,
  predictionsBenchmarkProfiles: () => `${API_ROUTES.ADMIN}/predictions/benchmark/profiles`,
  predictionsBenchmarkSources: () => `${API_ROUTES.ADMIN}/predictions/benchmark/sources`,
  predictionsBenchmarkSourceSession: (key: string) =>
    `${API_ROUTES.ADMIN}/predictions/benchmark/sources/${key}/session`,
  predictionsBenchmarkRuns: () => `${API_ROUTES.ADMIN}/predictions/benchmark/runs`,
  predictionsBenchmarkRunById: (id: string) =>
    `${API_ROUTES.ADMIN}/predictions/benchmark/runs/${id}`,
  predictionsBenchmarkRunReport: (id: string) =>
    `${API_ROUTES.ADMIN}/predictions/benchmark/runs/${id}/report`,
  predictionsDistillationOverview: () => `${API_ROUTES.ADMIN}/predictions/distillation/overview`,
  predictionsDistillationDaily: () => `${API_ROUTES.ADMIN}/predictions/distillation/daily`,
  predictionsDistillationSchools: () => `${API_ROUTES.ADMIN}/predictions/distillation/schools`,
  predictionsDistillationRaw: () => `${API_ROUTES.ADMIN}/predictions/distillation/raw`,
  predictionsDistillationRollupsBackfill: () =>
    `${API_ROUTES.ADMIN}/predictions/distillation/rollups/backfill`,

  predictionWorkflowObservations: () => `${API_ROUTES.ADMIN}/prediction-workflow/observations`,
  predictionWorkflowObservationReview: (id: string) =>
    `${API_ROUTES.ADMIN}/prediction-workflow/observations/${id}/review`,
  predictionWorkflowSignalsBuild: () => `${API_ROUTES.ADMIN}/prediction-workflow/signals/build`,
  predictionWorkflowSignals: () => `${API_ROUTES.ADMIN}/prediction-workflow/signals`,
  predictionWorkflowPolicies: () => `${API_ROUTES.ADMIN}/prediction-workflow/policies`,
  predictionWorkflowPolicyCandidate: (id: string) =>
    `${API_ROUTES.ADMIN}/prediction-workflow/policies/${id}/candidate`,
  predictionWorkflowPolicyShadow: (id: string) =>
    `${API_ROUTES.ADMIN}/prediction-workflow/policies/${id}/shadow`,
  predictionWorkflowPolicyShadowRefresh: (id: string) =>
    `${API_ROUTES.ADMIN}/prediction-workflow/policies/${id}/shadow-refresh`,
  predictionWorkflowPolicyGates: (id: string) =>
    `${API_ROUTES.ADMIN}/prediction-workflow/policies/${id}/gates`,
  predictionWorkflowPolicyShadowMetrics: (id: string) =>
    `${API_ROUTES.ADMIN}/prediction-workflow/policies/${id}/shadow-metrics`,
  predictionWorkflowPolicyActivate: (id: string) =>
    `${API_ROUTES.ADMIN}/prediction-workflow/policies/${id}/activate`,
  predictionWorkflowPolicyRollback: () =>
    `${API_ROUTES.ADMIN}/prediction-workflow/policies/rollback`,
  predictionWorkflowOutcomes: () => `${API_ROUTES.ADMIN}/prediction-workflow/outcomes`,
  predictionWorkflowOutcomeReview: (id: string) =>
    `${API_ROUTES.ADMIN}/prediction-workflow/outcomes/${id}/review`,
  predictionWorkflowAuthorityStats: () => `${API_ROUTES.ADMIN}/prediction-workflow/authority-stats`,
  predictionWorkflowDataInventory: () => `${API_ROUTES.ADMIN}/prediction-workflow/data-inventory`,
  predictionWorkflowTrainingReadiness: () =>
    `${API_ROUTES.ADMIN}/prediction-workflow/training-readiness`,
  predictionWorkflowCasesNormalizeLegacy: () =>
    `${API_ROUTES.ADMIN}/prediction-workflow/cases/normalize-legacy`,
  predictionWorkflowCohortPriorsBackfill: () =>
    `${API_ROUTES.ADMIN}/prediction-workflow/cohort-priors/backfill`,
  // CDS bands + case-aggregate backfill live under the distillation
  // controller (different prefix), but exposed here so the same admin UI
  // can call them alongside the prediction-workflow ops.
  predictionDistillationCdsBandsLoadFixture: () =>
    `${API_ROUTES.ADMIN}/predictions/distillation/cds-bands/load-fixture`,
  predictionDistillationCaseAggregatesBackfill: () =>
    `${API_ROUTES.ADMIN}/predictions/distillation/case-aggregates/backfill`,
  // Synthetic prediction with shadow-distillation enabled — admin diagnostic
  // for verifying which teachers fire on a given mock profile. No DB writes.
  predictionDistillationDryRun: () => `${API_ROUTES.ADMIN}/predictions/distillation/dry-run`,
  applicationAnalysisWorkflowEvidence: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/evidence`,
  applicationAnalysisWorkflowEvidenceReview: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/evidence/${id}/review`,
  applicationAnalysisWorkflowPolicies: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/policies`,
  applicationAnalysisWorkflowPolicyCandidate: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/policies/${id}/candidate`,
  applicationAnalysisWorkflowPolicyShadow: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/policies/${id}/shadow`,
  applicationAnalysisWorkflowPolicyShadowRefresh: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/policies/${id}/shadow-refresh`,
  applicationAnalysisWorkflowPolicyGates: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/policies/${id}/gates`,
  applicationAnalysisWorkflowPolicyActivate: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/policies/${id}/activate`,
  applicationAnalysisWorkflowPolicyRollback: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/policies/rollback`,
  applicationAnalysisWorkflowEvaluations: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/evaluations`,
  applicationAnalysisWorkflowReplays: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/replays`,
  applicationAnalysisWorkflowExperiments: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments`,
  applicationAnalysisWorkflowExperimentSweep: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments/sweep`,
  applicationAnalysisWorkflowExperimentShadow: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments/${id}/shadow`,
  applicationAnalysisWorkflowExperimentCanary: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments/${id}/canary`,
  applicationAnalysisWorkflowExperimentEvaluate: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments/${id}/evaluate`,
  applicationAnalysisWorkflowExperimentGates: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments/${id}/gates`,
  applicationAnalysisWorkflowExperimentActivate: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments/${id}/activate`,
  applicationAnalysisWorkflowExperimentRetire: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments/${id}/retire`,
  applicationAnalysisWorkflowExperimentConfig: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments/${id}/config`,
  applicationAnalysisWorkflowExperimentEvaluations: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiment-evaluations`,
  applicationAnalysisWorkflowExperimentSweeps: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiment-sweeps`,
  applicationAnalysisWorkflowExperimentIncidents: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiment-incidents`,
  applicationAnalysisWorkflowExperimentIncidentAcknowledge: (id: string) =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiment-incidents/${id}/acknowledge`,
  applicationAnalysisWorkflowExperimentFeedback: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiment-feedback`,
  applicationAnalysisWorkflowRecoursePreview: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments/recourse-preview`,
  applicationAnalysisWorkflowUncertaintyPreview: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments/uncertainty-preview`,
  applicationAnalysisWorkflowFairnessReport: () =>
    `${API_ROUTES.ADMIN}/application-analysis-workflow/experiments/fairness-report`,

  // Schools (under /schools/admin prefix)
  schoolsLogoFillStatus: () => `${API_ROUTES.SCHOOLS}/admin/logo-fill-status`,
  schoolsDataQuality: () => `${API_ROUTES.SCHOOLS}/admin/data-quality`,
  schoolsFillLogosByDomain: () => `${API_ROUTES.SCHOOLS}/admin/fill-logos-by-domain`,
  schoolsCommunityRatings: (schoolId: string) =>
    `${API_ROUTES.SCHOOLS}/admin/community-ratings/${schoolId}`,
  schoolsCommunityRatingHide: (ratingId: string) =>
    `${API_ROUTES.SCHOOLS}/admin/community-ratings/${ratingId}/hide`,
  schoolsCommunityRatingRestore: (ratingId: string) =>
    `${API_ROUTES.SCHOOLS}/admin/community-ratings/${ratingId}/restore`,
};

export const adminAiAgentRoutes = {
  // Health & Config
  health: () => `${API_ROUTES.ADMIN}/ai-agent/health`,
  config: () => `${API_ROUTES.ADMIN}/ai-agent/config`,
  configQuota: () => `${API_ROUTES.ADMIN}/ai-agent/config/quota`,
  configLlm: () => `${API_ROUTES.ADMIN}/ai-agent/config/llm`,

  // Agents
  agents: () => `${API_ROUTES.ADMIN}/ai-agent/agents`,
  agentById: (type: string) => `${API_ROUTES.ADMIN}/ai-agent/agents/${type}`,
  agentToggle: (type: string) => `${API_ROUTES.ADMIN}/ai-agent/agents/${type}/toggle`,

  // Features
  featureToggle: (feature: string) => `${API_ROUTES.ADMIN}/ai-agent/features/${feature}`,

  // Security Events
  securityEventResolve: (id: string) =>
    `${API_ROUTES.ADMIN}/ai-agent/security-events/${id}/resolve`,

  // Circuit Breakers
  circuitBreakers: () => `${API_ROUTES.ADMIN}/ai-agent/circuit-breakers`,
  circuitBreakerReset: (service: string) =>
    `${API_ROUTES.ADMIN}/ai-agent/circuit-breakers/${service}`,

  // Metrics
  metrics: () => `${API_ROUTES.ADMIN}/ai-agent/metrics`,
  metricsDaily: () => `${API_ROUTES.ADMIN}/ai-agent/metrics/daily`,

  // Traces
  traces: (tab: string) => `${API_ROUTES.ADMIN}/ai-agent/traces/${tab}`,

  // LLM Calls
  llmCalls: () => `${API_ROUTES.ADMIN}/ai-agent/llm-calls`,

  // User AI
  userUsage: (userId: string) => `${API_ROUTES.ADMIN}/ai-agent/users/${userId}/usage`,
  userRateLimit: (userId: string) => `${API_ROUTES.ADMIN}/ai-agent/users/${userId}/rate-limit`,

  // Memory
  memoryById: (id: string) => `${API_ROUTES.ADMIN}/ai-agent/memory/${id}`,
  memoryStats: () => `${API_ROUTES.ADMIN}/ai-agent/memory/stats`,
  memoryBrowse: () => `${API_ROUTES.ADMIN}/ai-agent/memory/browse`,
  memoryEntities: () => `${API_ROUTES.ADMIN}/ai-agent/memory/entities`,
  memoryConversations: () => `${API_ROUTES.ADMIN}/ai-agent/memory/conversations`,
  memoryConversationMessages: (convId: string) =>
    `${API_ROUTES.ADMIN}/ai-agent/memory/conversations/${convId}/messages`,
  memoryUserStats: (userId: string) => `${API_ROUTES.ADMIN}/ai-agent/memory/users/${userId}/stats`,
  memoryDecayConfig: () => `${API_ROUTES.ADMIN}/ai-agent/memory/decay/config`,
  memoryDecayStats: () => `${API_ROUTES.ADMIN}/ai-agent/memory/decay/stats`,
  memoryDecayTrigger: () => `${API_ROUTES.ADMIN}/ai-agent/memory/decay/trigger`,
};

// Core feature components
export { FeatureCard, StatCard, CTACard } from './feature-card';

// Case components
export { CaseCard } from './case-card';
export { SubmitCaseDialog } from './submit-case-dialog';

// Form components
export { ActivityForm } from './activity-form';
export { AwardForm } from './award-form';
export { EducationForm } from './education-form';
export { TestScoreForm } from './test-score-form';

// Selector components
export { ProfileSelector } from './profile-selector';
export { SchoolSelector } from './school-selector';

// UI components
export { ProbabilityRing } from './probability-ring';
export { MilestoneCelebration } from './milestone-celebration';
export { OnboardingGuide } from './onboarding-guide';
export { CreateListDialog } from './create-list-dialog';

// Dashboard components
export * from './dashboard';

// Chat components
export * from './chat';

// Essay AI components
export * from './essay-ai';

// Essay Gallery components
export * from './essay-gallery';

// Agent chat components
export * from './agent-chat';

// Points components
export * from './points';

// Followers components
export * from './followers';

// Resume components
export * from './resume';

// Verification components
export * from './verification';

// Profile components
export { ProfileAIAnalysis } from './profile/ProfileAIAnalysis';

// Admin components
export { EssayPromptManager } from './admin/essay-prompt-manager';
export { EssayCaseReviewManager } from './admin/essay-case-review-manager';
export { BulkImportDialog } from './admin/bulk-import-dialog';
export { EssayPipelineDashboard } from './admin/essay-pipeline-dashboard';

// Schools components
export { AdvancedSchoolFilter } from './schools/AdvancedSchoolFilter';
export type { SchoolFilters } from './schools/AdvancedSchoolFilter';
export { SchoolRecommendation } from './schools/SchoolRecommendation';

// Feedback components
export { FeedbackWidget } from './feedback/feedback-widget';

// Help components
export { HelpCenter } from './help/help-center';

// Search components
export { GlobalSearch } from './search/global-search';

// Notifications components
export { NotificationCenter } from './notifications/notification-center';

// Onboarding components
export { TourProvider } from './onboarding/tour-provider';
export { WelcomeDialog } from './onboarding/welcome-dialog';

// Export components
export { DataExportDialog } from './export/data-export';

// Hall components
export {
  SwipeCard,
  SwipeStack,
  BadgeDisplay,
  BadgeProgress,
  StatsPanel,
  DailyChallenge,
  LeaderboardList,
  ModuleSelector,
  ReviewModuleCard,
  SwipeReviewMode,
  SwipeResultOverlay,
  // Tab components (from hall/page.tsx refactor)
  TinderTab,
  ReviewTab,
  RankingTab,
  ListsTab,
} from './hall';
export type { SwipeCaseData, SwipeBadge } from './hall';

// Landing page components
export * from './landing';

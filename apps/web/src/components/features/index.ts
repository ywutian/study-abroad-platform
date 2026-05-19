// AI error boundary
export { AIErrorBoundary } from './ai-error-boundary';

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

// Dashboard page now uses page-local _components instead of a shared
// features/dashboard barrel. Removed 2026-05 alongside the rebuild that
// merged DashboardStats / DeadlineReminder / RecentActivity into the new
// CommandCenter / WorkspaceHub / Activity components.

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

// Teams components
export { TeamCard } from './teams/TeamCard';
export type { TeamCardData } from './teams/TeamCard';

// Schools components
export { AdvancedSchoolFilter } from './schools/AdvancedSchoolFilter';
export type { SchoolFilters } from './schools/school-filters';
export { SchoolLogo } from './schools/SchoolLogo';
export type { SchoolLogoProps } from './schools/SchoolLogo';
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
  ModuleSelector,
  ReviewModuleCard,
  SwipeResultOverlay,
  // Tab components (from hall/page.tsx refactor)
  TinderTab,
  ReviewTab,
  RankingTab,
  ListsTab,
} from './hall';
export type { SwipeCaseData } from './hall';

// Landing page components
export * from './landing';

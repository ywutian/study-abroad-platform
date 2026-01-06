// 功能组件导出

// 新手引导
export { TourProvider, useTour, TOURS, welcomeTourSteps } from './onboarding/tour-provider';
export { WelcomeDialog, ResetWelcomeButton } from './onboarding/welcome-dialog';

// 通知系统
export { NotificationCenter } from './notifications/notification-center';

// 全局搜索
export { GlobalSearch, SearchTrigger } from './search/global-search';

// 帮助中心
export { HelpCenter } from './help/help-center';

// 用户反馈
export { FeedbackWidget, QuickFeedbackButton } from './feedback/feedback-widget';

// 数据导出
export { DataExportDialog, QuickExportButton } from './export/data-export';

// 个人资料表单
export { TestScoreForm } from './test-score-form';
export { ActivityForm } from './activity-form';
export { AwardForm } from './award-form';
export { EducationForm } from './education-form';

// 选择器
export { SchoolSelector } from './school-selector';
export { ProfileSelector } from './profile-selector';

// 案例相关
export { CaseCard } from './case-card';
export { SubmitCaseDialog } from './submit-case-dialog';
export { CreateListDialog } from './create-list-dialog';

// 展示组件
export { FeatureCard } from './feature-card';
export { StatCard } from './stat-card';
export { ProbabilityRing } from './probability-ring';

// AI 聊天
export * from './agent-chat';

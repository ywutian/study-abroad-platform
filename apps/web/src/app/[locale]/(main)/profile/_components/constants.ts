import {
  User,
  Globe,
  BarChart,
  GraduationCap,
  BookOpen,
  Award,
  Target,
  Shield,
  Check,
} from 'lucide-react';
import type { TabConfig } from './types';

export const GRADES = [
  { value: 'FRESHMAN', labelKey: 'profile.grades.freshman' },
  { value: 'SOPHOMORE', labelKey: 'profile.grades.sophomore' },
  { value: 'JUNIOR', labelKey: 'profile.grades.junior' },
  { value: 'SENIOR', labelKey: 'profile.grades.senior' },
  { value: 'GAP_YEAR', labelKey: 'profile.grades.gapYear' },
];

export const BUDGET_TIERS = [
  { value: 'LOW', labelKey: 'profile.budgetTiers.low' },
  { value: 'MEDIUM', labelKey: 'profile.budgetTiers.medium' },
  { value: 'HIGH', labelKey: 'profile.budgetTiers.high' },
  { value: 'UNLIMITED', labelKey: 'profile.budgetTiers.unlimited' },
];

export const VISIBILITY_OPTIONS = [
  {
    value: 'PRIVATE',
    labelKey: 'profile.visibilityOptions.private',
    descKey: 'profile.visibilityDesc.private',
    icon: Shield,
  },
  {
    value: 'ANONYMOUS',
    labelKey: 'profile.visibilityOptions.anonymous',
    descKey: 'profile.visibilityDesc.anonymous',
    icon: User,
  },
  {
    value: 'VERIFIED_ONLY',
    labelKey: 'profile.visibilityOptions.verifiedOnly',
    descKey: 'profile.visibilityDesc.verifiedOnly',
    icon: Check,
  },
];

export const EDUCATION_SYSTEMS = [
  { value: 'AP', labelKey: 'profile.demographics.educationSystems.AP' },
  { value: 'IB', labelKey: 'profile.demographics.educationSystems.IB' },
  { value: 'A_LEVEL', labelKey: 'profile.demographics.educationSystems.A_LEVEL' },
  { value: 'GAOKAO', labelKey: 'profile.demographics.educationSystems.GAOKAO' },
  { value: 'CANADIAN', labelKey: 'profile.demographics.educationSystems.CANADIAN' },
  { value: 'AUSTRALIAN', labelKey: 'profile.demographics.educationSystems.AUSTRALIAN' },
  { value: 'OTHER', labelKey: 'profile.demographics.educationSystems.OTHER' },
];

export const COMMON_COUNTRIES = [
  { value: 'US', labelKey: 'profile.demographics.countries.US' },
  { value: 'CN', labelKey: 'profile.demographics.countries.CN' },
  { value: 'IN', labelKey: 'profile.demographics.countries.IN' },
  { value: 'KR', labelKey: 'profile.demographics.countries.KR' },
  { value: 'JP', labelKey: 'profile.demographics.countries.JP' },
  { value: 'TW', labelKey: 'profile.demographics.countries.TW' },
  { value: 'HK', labelKey: 'profile.demographics.countries.HK' },
  { value: 'SG', labelKey: 'profile.demographics.countries.SG' },
  { value: 'GB', labelKey: 'profile.demographics.countries.GB' },
  { value: 'CA', labelKey: 'profile.demographics.countries.CA' },
  { value: 'AU', labelKey: 'profile.demographics.countries.AU' },
  { value: 'OTHER', labelKey: 'profile.demographics.countries.OTHER' },
];

export const TAB_CONFIG: TabConfig[] = [
  { value: 'basic', labelKey: 'profile.steps.basic', icon: User, color: 'bg-primary' },
  {
    value: 'demographics',
    labelKey: 'profile.steps.demographics',
    icon: Globe,
    color: 'from-teal-500 to-cyan-500',
  },
  { value: 'scores', labelKey: 'profile.steps.scores', icon: BarChart, color: 'bg-primary' },
  { value: 'gpa', labelKey: 'profile.steps.gpa', icon: GraduationCap, color: 'bg-success' },
  {
    value: 'activities',
    labelKey: 'profile.steps.activities',
    icon: BookOpen,
    color: 'bg-warning',
  },
  {
    value: 'awards',
    labelKey: 'profile.steps.awards',
    icon: Award,
    color: 'from-yellow-500 to-orange-500',
  },
  { value: 'targets', labelKey: 'profile.steps.targets', icon: Target, color: 'bg-destructive' },
  {
    value: 'privacy',
    labelKey: 'profile.steps.privacy',
    icon: Shield,
    color: 'from-muted-foreground to-muted-foreground',
  },
];

export const ACTIVITY_CATEGORY_KEYS: Record<string, string> = {
  ACADEMIC: 'profile.activityCategories.academic',
  ARTS: 'profile.activityCategories.arts',
  ATHLETICS: 'profile.activityCategories.athletics',
  COMMUNITY_SERVICE: 'profile.activityCategories.communityService',
  LEADERSHIP: 'profile.activityCategories.leadership',
  WORK: 'profile.activityCategories.work',
  RESEARCH: 'profile.activityCategories.research',
  INTERNSHIP: 'profile.activityCategories.internship',
  CLUB: 'profile.activityCategories.club',
  HOBBY: 'profile.activityCategories.hobby',
  OTHER: 'profile.activityCategories.other',
};

export const TIER_BADGE_CONFIG: Record<number, { label: string; className: string }> = {
  1: {
    label: 'T1',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  2: {
    label: 'T2',
    className: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground',
  },
  3: {
    label: 'T3',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
  4: {
    label: 'T4',
    className: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground',
  },
};

export const AWARD_LEVEL_KEYS: Record<string, string> = {
  SCHOOL: 'profile.awardLevels.school',
  REGIONAL: 'profile.awardLevels.regional',
  STATE: 'profile.awardLevels.state',
  NATIONAL: 'profile.awardLevels.national',
  INTERNATIONAL: 'profile.awardLevels.international',
};

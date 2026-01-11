import { StyleSheet, Font } from '@react-pdf/renderer';

// 注册字体 - 使用 Google Fonts
Font.register({
  family: 'Noto Sans SC',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYxNbPzS5HE.ttf',
      fontWeight: 700,
    },
  ],
});

// 颜色定义
export const colors = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  text: '#1f2937',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  background: '#f9fafb',
  success: '#10b981',
  warning: '#f59e0b',
  white: '#ffffff',
};

// 基础样式
export const baseStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Noto Sans SC',
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },
  header: {
    marginBottom: 20,
    borderBottom: `2px solid ${colors.primary}`,
    paddingBottom: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: 700,
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
    flexDirection: 'row',
    gap: 8,
  },
  subtitleItem: {
    marginRight: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: colors.primary,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottom: `1px solid ${colors.border}`,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 6,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  label: {
    width: 80,
    fontWeight: 700,
    color: colors.textMuted,
  },
  value: {
    flex: 1,
  },
  listItem: {
    marginBottom: 10,
    paddingLeft: 12,
  },
  listItemTitle: {
    fontWeight: 700,
    fontSize: 11,
    marginBottom: 2,
  },
  listItemSubtitle: {
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 2,
  },
  listItemDescription: {
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: 1.4,
  },
  badge: {
    backgroundColor: colors.background,
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 8,
    color: colors.textMuted,
    marginLeft: 6,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flexBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    marginBottom: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: colors.textMuted,
    borderTop: `1px solid ${colors.border}`,
    paddingTop: 10,
  },
});

// 专业模板样式
export const professionalStyles = StyleSheet.create({
  page: {
    ...baseStyles.page,
    padding: 30,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 8,
    backgroundColor: colors.primary,
  },
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `3px solid ${colors.primary}`,
  },
  name: {
    fontSize: 28,
    fontWeight: 700,
    color: colors.text,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.white,
    backgroundColor: colors.primary,
    padding: '6px 12px',
    marginBottom: 12,
    marginLeft: -30,
    paddingLeft: 42,
  },
  scoreCard: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreType: {
    fontWeight: 700,
    fontSize: 11,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.primary,
  },
  activityCard: {
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderLeft: `3px solid ${colors.secondary}`,
  },
  awardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 8,
  },
  awardBullet: {
    width: 6,
    height: 6,
    backgroundColor: colors.warning,
    borderRadius: 3,
    marginRight: 8,
  },
});

// 类型定义
export interface ResumeData {
  basic: {
    name?: string;
    grade?: string;
    school?: string;
    targetMajor?: string;
  };
  academics: {
    gpa?: number;
    gpaScale?: number;
    testScores: Array<{
      type: string;
      score: number;
      subScores?: Record<string, number>;
    }>;
  };
  activities: Array<{
    name: string;
    category: string;
    role: string;
    description?: string;
    hoursPerWeek?: number;
    weeksPerYear?: number;
    isOngoing?: boolean;
  }>;
  awards: Array<{
    name: string;
    level: string;
    year?: number;
    description?: string;
  }>;
  targetSchools?: string[];
}

export interface ResumeExportOptions {
  template: 'basic' | 'professional';
  language: 'zh' | 'en';
  includeModules: {
    basic: boolean;
    academics: boolean;
    activities: boolean;
    awards: boolean;
    targetSchools: boolean;
  };
  anonymize: boolean;
}

// 翻译映射
export const translations = {
  zh: {
    applicant: '申请者',
    grade: '年级',
    school: '学校',
    targetMajor: '目标专业',
    academics: '学术成绩',
    gpa: 'GPA',
    testScores: '标化成绩',
    activities: '活动经历',
    awards: '获奖情况',
    targetSchools: '目标学校',
    hoursPerWeek: '小时/周',
    weeksPerYear: '周/年',
    ongoing: '进行中',
    generatedBy: '由留学申请平台生成',
    levels: {
      SCHOOL: '校级',
      REGIONAL: '地区级',
      STATE: '省/州级',
      NATIONAL: '国家级',
      INTERNATIONAL: '国际级',
    },
    categories: {
      ACADEMIC: '学术',
      ARTS: '艺术',
      ATHLETICS: '体育',
      COMMUNITY_SERVICE: '社区服务',
      LEADERSHIP: '领导力',
      WORK: '工作',
      RESEARCH: '研究',
      OTHER: '其他',
    },
    grades: {
      FRESHMAN: '高一',
      SOPHOMORE: '高二',
      JUNIOR: '高三',
      SENIOR: '大一',
      GAP_YEAR: '间隔年',
    },
  },
  en: {
    applicant: 'Applicant',
    grade: 'Grade',
    school: 'School',
    targetMajor: 'Intended Major',
    academics: 'Academic Profile',
    gpa: 'GPA',
    testScores: 'Test Scores',
    activities: 'Extracurricular Activities',
    awards: 'Honors & Awards',
    targetSchools: 'Target Schools',
    hoursPerWeek: 'hrs/week',
    weeksPerYear: 'weeks/year',
    ongoing: 'Ongoing',
    generatedBy: 'Generated by Study Abroad Platform',
    levels: {
      SCHOOL: 'School',
      REGIONAL: 'Regional',
      STATE: 'State',
      NATIONAL: 'National',
      INTERNATIONAL: 'International',
    },
    categories: {
      ACADEMIC: 'Academic',
      ARTS: 'Arts',
      ATHLETICS: 'Athletics',
      COMMUNITY_SERVICE: 'Community Service',
      LEADERSHIP: 'Leadership',
      WORK: 'Work',
      RESEARCH: 'Research',
      OTHER: 'Other',
    },
    grades: {
      FRESHMAN: 'Freshman',
      SOPHOMORE: 'Sophomore',
      JUNIOR: 'Junior',
      SENIOR: 'Senior',
      GAP_YEAR: 'Gap Year',
    },
  },
};




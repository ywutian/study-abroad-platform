/**
 * CSV templates for batch data import.
 * Each template provides column definitions and sample data in both EN and ZH.
 */

export interface CsvColumnDef {
  key: string;
  headerEn: string;
  headerZh: string;
  required: boolean;
}

// ============================================
// Case CSV Template
// ============================================

export const CASE_CSV_COLUMNS: CsvColumnDef[] = [
  {
    key: 'school_name',
    headerEn: 'School Name',
    headerZh: '学校名称',
    required: true,
  },
  { key: 'year', headerEn: 'Year', headerZh: '申请年份', required: true },
  { key: 'result', headerEn: 'Result', headerZh: '结果', required: true },
  { key: 'round', headerEn: 'Round', headerZh: '轮次', required: false },
  { key: 'major', headerEn: 'Major', headerZh: '专业', required: false },
  { key: 'gpa', headerEn: 'GPA', headerZh: 'GPA', required: false },
  {
    key: 'gpa_scale',
    headerEn: 'GPA Scale',
    headerZh: 'GPA满分',
    required: false,
  },
  { key: 'sat', headerEn: 'SAT', headerZh: 'SAT', required: false },
  { key: 'act', headerEn: 'ACT', headerZh: 'ACT', required: false },
  { key: 'toefl', headerEn: 'TOEFL', headerZh: 'TOEFL', required: false },
  { key: 'ielts', headerEn: 'IELTS', headerZh: 'IELTS', required: false },
  {
    key: 'ap_count',
    headerEn: 'AP Count',
    headerZh: 'AP数量',
    required: false,
  },
  {
    key: 'activities',
    headerEn: 'Activities (semicolon separated)',
    headerZh: '活动（分号分隔）',
    required: false,
  },
  {
    key: 'awards',
    headerEn: 'Awards (semicolon separated)',
    headerZh: '奖项（分号分隔）',
    required: false,
  },
  {
    key: 'ap_subjects',
    headerEn: 'AP Subjects (semicolon separated)',
    headerZh: 'AP科目（分号分隔）',
    required: false,
  },
  {
    key: 'ib_score',
    headerEn: 'IB Score',
    headerZh: 'IB总分',
    required: false,
  },
  {
    key: 'ib_predicted',
    headerEn: 'IB Predicted',
    headerZh: 'IB预估分',
    required: false,
  },
  {
    key: 'high_school_type',
    headerEn: 'High School Type',
    headerZh: '高中类型',
    required: false,
  },
  {
    key: 'curriculum',
    headerEn: 'Curriculum',
    headerZh: '课程体系',
    required: false,
  },
  {
    key: 'demographic_tags',
    headerEn: 'Demographics (semicolon separated)',
    headerZh: '人口标签（分号分隔）',
    required: false,
  },
  {
    key: 'financial_aid',
    headerEn: 'Financial Aid',
    headerZh: '经济资助',
    required: false,
  },
  {
    key: 'enrollment_status',
    headerEn: 'Enrollment Status',
    headerZh: '入学状态',
    required: false,
  },
  {
    key: 'narrative',
    headerEn: 'Narrative',
    headerZh: '申请故事',
    required: false,
  },
  {
    key: 'tags',
    headerEn: 'Tags (semicolon separated)',
    headerZh: '标签（分号分隔）',
    required: false,
  },
  {
    key: 'essay_type',
    headerEn: 'Essay Type',
    headerZh: '文书类型',
    required: false,
  },
  {
    key: 'essay_prompt',
    headerEn: 'Essay Prompt',
    headerZh: '文书题目',
    required: false,
  },
  {
    key: 'essay_content',
    headerEn: 'Essay Content',
    headerZh: '文书内容',
    required: false,
  },
  {
    key: 'source_url',
    headerEn: 'Source URL',
    headerZh: '来源链接',
    required: false,
  },
];

export const CASE_CSV_SAMPLE_ROWS = [
  {
    school_name: 'MIT',
    year: '2026',
    result: 'ADMITTED',
    round: 'EA',
    major: 'Computer Science',
    gpa: '3.95',
    gpa_scale: '4',
    sat: '1560',
    act: '',
    toefl: '115',
    ielts: '',
    ap_count: '12',
    activities:
      'Research - MIT PRIMES;Competition - USACO Platinum;Club - Robotics Club President',
    awards: 'USAMO Qualifier;Intel ISEF Finalist',
    tags: 'strong_research;stem',
    essay_type: 'COMMON_APP',
    essay_prompt: 'Prompt 4',
    essay_content: '',
    source_url: '',
  },
  {
    school_name: 'Stanford University',
    year: '2026',
    result: 'REJECTED',
    round: 'REA',
    major: 'Economics',
    gpa: '3.8-3.9',
    gpa_scale: '4',
    sat: '1500-1550',
    act: '',
    toefl: '',
    ielts: '7.5',
    ap_count: '8',
    activities:
      'Startup - Co-founded EdTech company;Community Service - Tutoring Program',
    awards: 'National Merit Semifinalist',
    tags: 'entrepreneur;international',
    essay_type: '',
    essay_prompt: '',
    essay_content: '',
    source_url: '',
  },
];

// ============================================
// School CSV Template
// ============================================

export const SCHOOL_CSV_COLUMNS: CsvColumnDef[] = [
  {
    key: 'name',
    headerEn: 'School Name',
    headerZh: '学校名称',
    required: true,
  },
  {
    key: 'name_zh',
    headerEn: 'Chinese Name',
    headerZh: '中文名',
    required: false,
  },
  {
    key: 'us_news_rank',
    headerEn: 'US News Rank',
    headerZh: 'US News排名',
    required: false,
  },
  {
    key: 'acceptance_rate',
    headerEn: 'Acceptance Rate (%)',
    headerZh: '录取率(%)',
    required: false,
  },
  {
    key: 'tuition',
    headerEn: 'Tuition (USD)',
    headerZh: '学费(美元)',
    required: false,
  },
  {
    key: 'sat_avg',
    headerEn: 'SAT Average',
    headerZh: 'SAT均分',
    required: false,
  },
  {
    key: 'sat_25',
    headerEn: 'SAT 25th',
    headerZh: 'SAT 25分位',
    required: false,
  },
  {
    key: 'sat_75',
    headerEn: 'SAT 75th',
    headerZh: 'SAT 75分位',
    required: false,
  },
  {
    key: 'act_avg',
    headerEn: 'ACT Average',
    headerZh: 'ACT均分',
    required: false,
  },
  {
    key: 'graduation_rate',
    headerEn: 'Graduation Rate (%)',
    headerZh: '毕业率(%)',
    required: false,
  },
  {
    key: 'test_optional',
    headerEn: 'Test Optional',
    headerZh: '可选标化',
    required: false,
  },
  {
    key: 'application_fee',
    headerEn: 'Application Fee (USD)',
    headerZh: '申请费(美元)',
    required: false,
  },
  { key: 'state', headerEn: 'State', headerZh: '州', required: false },
  { key: 'city', headerEn: 'City', headerZh: '城市', required: false },
];

// ============================================
// Essay Prompt CSV Template
// ============================================

export const ESSAY_CSV_COLUMNS: CsvColumnDef[] = [
  {
    key: 'school_name',
    headerEn: 'School Name',
    headerZh: '学校名称',
    required: true,
  },
  { key: 'year', headerEn: 'Year', headerZh: '年份', required: true },
  { key: 'type', headerEn: 'Type', headerZh: '类型', required: true },
  { key: 'prompt', headerEn: 'Prompt', headerZh: '题目', required: true },
  {
    key: 'prompt_zh',
    headerEn: 'Prompt (Chinese)',
    headerZh: '题目(中文)',
    required: false,
  },
  {
    key: 'word_limit',
    headerEn: 'Word Limit',
    headerZh: '字数限制',
    required: false,
  },
  {
    key: 'is_required',
    headerEn: 'Required',
    headerZh: '是否必填',
    required: false,
  },
  {
    key: 'sort_order',
    headerEn: 'Sort Order',
    headerZh: '排序',
    required: false,
  },
  {
    key: 'source_url',
    headerEn: 'Source URL',
    headerZh: '来源链接',
    required: false,
  },
];

// ============================================
// Helper: Generate CSV string from template
// ============================================

export function generateCsvTemplate(
  columns: CsvColumnDef[],
  sampleRows: Record<string, string>[] = [],
  locale: 'en' | 'zh' = 'en',
): string {
  const headers = columns.map((c) =>
    locale === 'zh' ? c.headerZh : c.headerEn,
  );
  const lines = [headers.join(',')];

  for (const row of sampleRows) {
    const values = columns.map((c) => {
      const val = row[c.key] ?? '';
      // Escape CSV: wrap in quotes if contains comma/newline/quote
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

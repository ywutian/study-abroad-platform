/**
 * 预测 Prompt 构建器 (i18n-aware)
 */

export interface ProfileInput {
  gpa?: number;
  gpaScale?: number;
  grade?: string;
  currentSchoolType?: string;
  targetMajor?: string;
  highSchoolName?: string;
  highSchoolTier?: number;
  highSchoolType?: string;
  highSchoolLocation?: string;
  isInternational?: boolean;
  nationality?: string;
  educationSystem?: string;
  needsFinancialAid?: boolean;
  majorCompetitiveness?: {
    name: string;
    level: number;
    schoolEstimate?: number;
  };
  testScores: Array<{
    type: string;
    score: number;
    subScores?: Record<string, number>;
  }>;
  activities: Array<{
    name?: string;
    category: string;
    role: string;
    description?: string;
    hoursPerWeek?: number;
    weeksPerYear?: number;
  }>;
  awards: Array<{
    level: string;
    name?: string;
    tier?: number;
    competitionName?: string;
  }>;
}

export interface SchoolInput {
  id: string;
  name: string;
  nameZh?: string;
  acceptanceRate?: number;
  intlAcceptanceRate?: number;
  intlStudentPct?: number;
  needBlindInternational?: boolean;
  satAvg?: number;
  sat25?: number;
  sat75?: number;
  actAvg?: number;
  act25?: number;
  act75?: number;
  usNewsRank?: number;
  graduationRate?: number;
  retentionRate?: number;
  studentFacultyRatio?: number;
  percentNeedMet?: number;
  averageNetPrice?: number;
  testOptional?: boolean;
  hasEarlyDecision?: boolean;
}

/**
 * 格式化标化成绩
 */
function formatTestScores(
  scores: ProfileInput['testScores'],
  isZh: boolean,
): string {
  if (!scores || scores.length === 0) return isZh ? '未提供' : 'Not provided';

  return scores
    .map((s) => {
      let result = `${s.type}: ${s.score}`;
      if (s.subScores && Object.keys(s.subScores).length > 0) {
        const subs = Object.entries(s.subScores)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        result += ` (${subs})`;
      }
      return result;
    })
    .join('; ');
}

/**
 * 格式化获奖情况
 */
function formatAwards(awards: ProfileInput['awards'], isZh: boolean): string {
  if (!awards || awards.length === 0) return isZh ? '无' : 'None';

  const TIER_LABELS: Record<number, string> = {
    5: 'Elite',
    4: 'National',
    3: 'Notable',
    2: 'Regional',
    1: 'Entry',
  };

  const lines = awards.slice(0, 10).map((a) => {
    let line = `- ${a.name || a.level}`;
    if (a.competitionName) line += ` (${a.competitionName})`;
    line += ` | ${isZh ? '级别' : 'Level'}: ${a.level}`;
    if (a.tier) line += ` | Tier ${a.tier} (${TIER_LABELS[a.tier] || ''})`;
    return line;
  });

  const header = isZh
    ? `共${awards.length}项奖项:`
    : `${awards.length} awards:`;
  return header + '\n' + lines.join('\n');
}

/**
 * 格式化活动情况 — 包含描述和时间投入以供 AI 评估
 */
function formatActivities(
  activities: ProfileInput['activities'],
  isZh: boolean,
): string {
  if (!activities || activities.length === 0) return isZh ? '无' : 'None';

  const lines = activities.slice(0, 10).map((a) => {
    let line = `- ${a.name || a.category} (${a.category})`;
    if (a.role) line += ` | ${isZh ? '角色' : 'Role'}: ${a.role}`;
    if ((a as any).description)
      line += ` | ${(a as any).description.slice(0, 120)}`;
    if (a.hoursPerWeek && a.weeksPerYear) {
      line += ` | ${a.hoursPerWeek}h/${isZh ? '周' : 'wk'}, ${a.weeksPerYear}${isZh ? '周/年' : 'wk/yr'}`;
    }
    return line;
  });

  const header = isZh
    ? `共${activities.length}项活动:`
    : `${activities.length} activities:`;
  return header + '\n' + lines.join('\n');
}

/**
 * 构建预测 Prompt
 */
export function buildPredictionPrompt(
  profile: ProfileInput,
  school: SchoolInput,
  locale = 'zh',
): string {
  const isZh = locale === 'zh';
  const gpaText = profile.gpa
    ? `${profile.gpa}/${profile.gpaScale || 4.0}`
    : isZh
      ? '未提供'
      : 'Not provided';

  const schoolName = isZh
    ? school.nameZh || school.name
    : school.name || school.nameZh;
  const unknown = isZh ? '未知' : 'Unknown';

  if (isZh) {
    return `你是一位资深的美国大学招生顾问，拥有20年经验，对各大学录取标准有深入了解。请根据以下学生档案和目标学校数据，进行专业的录取概率预测。请用中文回复所有文本字段（factors的name、detail、improvement，suggestions等）。

## 学生档案
- GPA: ${gpaText}
- 年级: ${profile.grade || unknown}${profile.highSchoolName ? `\n- 高中背景: ${profile.highSchoolName}${profile.highSchoolTier ? ` (Tier ${profile.highSchoolTier}${profile.highSchoolType ? `, ${profile.highSchoolType}` : ''}${profile.highSchoolLocation ? `, ${profile.highSchoolLocation}` : ''})` : ' (用户自填)'}` : ''}
- 标化成绩: ${formatTestScores(profile.testScores, true)}
- 目标专业: ${profile.targetMajor || '未确定'}${profile.majorCompetitiveness ? `（该校竞争度: ${profile.majorCompetitiveness.level}/5${profile.majorCompetitiveness.schoolEstimate ? `，预估专业录取率 ~${profile.majorCompetitiveness.schoolEstimate}%` : ''}）` : ''}
- 活动经历: ${formatActivities(profile.activities, true)}
- 获奖情况: ${formatAwards(profile.awards, true)}${profile.isInternational ? `\n- 申请者身份: 国际生${profile.nationality ? `（${profile.nationality}）` : ''}${profile.educationSystem ? `，${profile.educationSystem}体系` : ''}${profile.needsFinancialAid ? '，需要助学金' : ''}` : ''}

## 目标学校: ${schoolName}
- US News 排名: ${school.usNewsRank ? `#${school.usNewsRank}` : unknown}
- 录取率: ${school.acceptanceRate ? `${school.acceptanceRate}%` : unknown}${school.intlAcceptanceRate ? `\n- 国际生录取率: ${school.intlAcceptanceRate}%` : ''}${school.intlStudentPct ? `\n- 国际生比例: ${school.intlStudentPct}%` : ''}${school.needBlindInternational ? '\n- Need-Blind政策: 对国际生Need-Blind' : ''}
- 毕业率: ${school.graduationRate ? `${school.graduationRate}%` : unknown}
- 平均 SAT: ${school.satAvg || unknown}${school.sat25 && school.sat75 ? ` (25th-75th: ${school.sat25}-${school.sat75})` : ''}
- 平均 ACT: ${school.actAvg || unknown}${school.act25 && school.act75 ? ` (25th-75th: ${school.act25}-${school.act75})` : ''}${school.retentionRate ? `\n- 新生留存率: ${school.retentionRate}%` : ''}${school.studentFacultyRatio ? `\n- 师生比: ${school.studentFacultyRatio}:1` : ''}${school.percentNeedMet ? `\n- 助学金满足率: ${school.percentNeedMet}%` : ''}${school.averageNetPrice ? `\n- 平均净费用: $${school.averageNetPrice.toLocaleString()}` : ''}${school.testOptional === true ? '\n- 标化政策: Test Optional' : ''}${school.hasEarlyDecision ? '\n- 提前决定: 有ED轮次' : ''}

## 分析要求
1. 综合评估学生竞争力与学校录取标准的匹配度
2. 考虑标化成绩、GPA、活动、奖项等多维度因素
3. 给出具体、可操作的改进建议
4. **关键**: probability 必须基于该校的录取率和学生竞争力综合计算，不同学校应有明显差异
   - 录取率 < 10% 的顶尖学校（如 MIT、Stanford），即使学生优秀，probability 通常在 0.05-0.25 之间
   - 录取率 10%-30% 的选择性学校，probability 通常在 0.15-0.50 之间
   - 录取率 > 30% 的学校，probability 通常在 0.30-0.80 之间
   - 缺少标化成绩会显著降低竞争力（降低 10-20 个百分点）
   - 缺少课外活动和奖项也会降低竞争力

## 返回格式（严格 JSON）
{
  "probability": <0到1之间的小数，根据学校录取率和学生实力计算>,
  "confidence": "<low|medium|high>",
  "tier": "<reach|match|safety>",
  "factors": [
    {
      "name": "因素名称（中文）",
      "impact": "<positive|neutral|negative>",
      "weight": <0到1之间>,
      "detail": "具体分析说明（中文）",
      "improvement": "改进建议或null（中文）"
    }
  ],
  "suggestions": [
    "建议1（中文）",
    "建议2（中文）"
  ],
  "comparison": {
    "gpaPercentile": <0-100的整数>,
    "testScorePercentile": <0-100的整数>,
    "activityStrength": "<strong|average|weak>"
  }
}

注意事项：
- probability: 0-1 之间的小数，表示录取概率。必须根据该校录取率合理推算，不同学校差异应明显
- confidence: low/medium/high，根据数据完整度判断（缺少标化/活动数据时应为 low）
- tier: reach(冲刺)/match(匹配)/safety(保底)
- factors: 3-5个关键因素，weight 之和应接近1。对缺失的数据（如未提供标化成绩）也要作为 negative 因素分析
- **所有文本字段必须用中文**
- 只返回 JSON，不要其他内容`;
  }

  // English prompt
  return `You are an expert US college admissions consultant with 20 years of experience. Based on the following student profile and target school data, provide a professional admission probability prediction. Respond entirely in English for all text fields.

## Student Profile
- GPA: ${gpaText}
- Grade: ${profile.grade || unknown}${profile.highSchoolName ? `\n- High School: ${profile.highSchoolName}${profile.highSchoolTier ? ` (Tier ${profile.highSchoolTier}${profile.highSchoolType ? `, ${profile.highSchoolType}` : ''}${profile.highSchoolLocation ? `, ${profile.highSchoolLocation}` : ''})` : ' (user-provided)'}` : ''}
- Test Scores: ${formatTestScores(profile.testScores, false)}
- Target Major: ${profile.targetMajor || 'Undecided'}${profile.majorCompetitiveness ? ` (competitiveness at this school: ${profile.majorCompetitiveness.level}/5${profile.majorCompetitiveness.schoolEstimate ? `, estimated major acceptance ~${profile.majorCompetitiveness.schoolEstimate}%` : ''})` : ''}
- Activities: ${formatActivities(profile.activities, false)}
- Awards: ${formatAwards(profile.awards, false)}${profile.isInternational ? `\n- Applicant Status: International student${profile.nationality ? ` (${profile.nationality})` : ''}${profile.educationSystem ? `, ${profile.educationSystem} curriculum` : ''}${profile.needsFinancialAid ? ', needs financial aid' : ''}` : ''}

## Target School: ${schoolName}
- US News Rank: ${school.usNewsRank ? `#${school.usNewsRank}` : unknown}
- Acceptance Rate: ${school.acceptanceRate ? `${school.acceptanceRate}%` : unknown}${school.intlAcceptanceRate ? `\n- International Acceptance Rate: ${school.intlAcceptanceRate}%` : ''}${school.intlStudentPct ? `\n- International Student %: ${school.intlStudentPct}%` : ''}${school.needBlindInternational ? '\n- Need-Blind for International Students: Yes' : ''}
- Graduation Rate: ${school.graduationRate ? `${school.graduationRate}%` : unknown}
- Average SAT: ${school.satAvg || unknown}${school.sat25 && school.sat75 ? ` (25th-75th: ${school.sat25}-${school.sat75})` : ''}
- Average ACT: ${school.actAvg || unknown}${school.act25 && school.act75 ? ` (25th-75th: ${school.act25}-${school.act75})` : ''}${school.retentionRate ? `\n- Retention Rate: ${school.retentionRate}%` : ''}${school.studentFacultyRatio ? `\n- Student-Faculty Ratio: ${school.studentFacultyRatio}:1` : ''}${school.percentNeedMet ? `\n- % Need Met: ${school.percentNeedMet}%` : ''}${school.averageNetPrice ? `\n- Avg Net Price: $${school.averageNetPrice.toLocaleString()}` : ''}${school.testOptional === true ? '\n- Test Policy: Test Optional' : ''}${school.hasEarlyDecision ? '\n- Early Decision: Available' : ''}

## Analysis Requirements
1. Evaluate the student's competitiveness against the school's admission standards
2. Consider test scores, GPA, activities, and awards holistically
3. Provide specific, actionable improvement suggestions
4. **CRITICAL**: Probability must reflect the school's acceptance rate and student competitiveness. Different schools must show significant variation:
   - Top schools with <10% acceptance (e.g., MIT, Stanford): probability typically 0.05-0.25 even for strong students
   - Selective schools with 10%-30% acceptance: typically 0.15-0.50
   - Schools with >30% acceptance: typically 0.30-0.80
   - Missing test scores significantly reduce competitiveness (10-20 percentage points)
   - Missing extracurriculars and awards also lower competitiveness

## Response Format (strict JSON)
{
  "probability": <decimal between 0 and 1>,
  "confidence": "<low|medium|high>",
  "tier": "<reach|match|safety>",
  "factors": [
    {
      "name": "Factor name (English)",
      "impact": "<positive|neutral|negative>",
      "weight": <decimal between 0 and 1>,
      "detail": "Detailed analysis (English)",
      "improvement": "Improvement suggestion or null (English)"
    }
  ],
  "suggestions": [
    "Suggestion 1 (English)",
    "Suggestion 2 (English)"
  ],
  "comparison": {
    "gpaPercentile": <integer 0-100>,
    "testScorePercentile": <integer 0-100>,
    "activityStrength": "<strong|average|weak>"
  }
}

Notes:
- probability: decimal between 0-1. Must vary significantly based on school acceptance rate
- confidence: low/medium/high, based on data completeness (low when missing test scores/activities)
- tier: reach/match/safety
- factors: 3-5 key factors, weights should sum close to 1. Treat missing data (e.g., no test scores) as a negative factor
- **All text fields must be in English**
- Return JSON only, no other content`;
}

/**
 * 构建批量预测的简化 Prompt（用于降低 token 消耗）
 */
export function buildBatchPredictionPrompt(
  profile: ProfileInput,
  schools: SchoolInput[],
  locale = 'zh',
): string {
  const isZh = locale === 'zh';
  const gpaText = profile.gpa
    ? `${profile.gpa}/${profile.gpaScale || 4.0}`
    : isZh
      ? '未提供'
      : 'N/A';

  const schoolsList = schools
    .map((s) => {
      const name = isZh ? s.nameZh || s.name : s.name || s.nameZh;
      const rank = s.usNewsRank ? `#${s.usNewsRank}` : isZh ? '未知' : 'N/A';
      const rate =
        s.acceptanceRate != null
          ? `${s.acceptanceRate}%`
          : isZh
            ? '未知'
            : 'N/A';
      return isZh
        ? `- ${name} (排名: ${rank}, 录取率: ${rate})`
        : `- ${name} (Rank: ${rank}, Acceptance: ${rate})`;
    })
    .join('\n');

  if (isZh) {
    return `你是资深美国大学招生顾问。根据学生档案，快速评估多所学校的录取概率。请用中文回复。

## 学生档案
- GPA: ${gpaText}${profile.highSchoolName ? `\n- 高中: ${profile.highSchoolName}${profile.highSchoolTier ? ` (Tier ${profile.highSchoolTier})` : ''}` : ''}
- 标化: ${formatTestScores(profile.testScores, true)}
- 活动: ${profile.activities?.length || 0}项
- 奖项: ${profile.awards?.length || 0}项

## 目标学校
${schoolsList}

为每所学校返回JSON数组，格式：
[
  {
    "schoolId": "xxx",
    "probability": 0.35,
    "tier": "reach",
    "mainFactor": "GPA竞争力强",
    "suggestion": "一条关键建议（中文）"
  }
]

只返回JSON数组。`;
  }

  return `You are an expert US college admissions consultant. Based on the student profile, quickly evaluate admission probability for multiple schools. Respond in English.

## Student Profile
- GPA: ${gpaText}${profile.highSchoolName ? `\n- High School: ${profile.highSchoolName}${profile.highSchoolTier ? ` (Tier ${profile.highSchoolTier})` : ''}` : ''}
- Test Scores: ${formatTestScores(profile.testScores, false)}
- Activities: ${profile.activities?.length || 0}
- Awards: ${profile.awards?.length || 0}

## Target Schools
${schoolsList}

Return a JSON array for each school:
[
  {
    "schoolId": "xxx",
    "probability": 0.35,
    "tier": "reach",
    "mainFactor": "Strong GPA",
    "suggestion": "One key suggestion (English)"
  }
]

Return JSON array only.`;
}

/**
 * 稳定的 system prompt（纯静态，不含用户数据）
 * 用于与 seed 配合保证确定性输出
 */
export function buildStableSystemPrompt(locale = 'zh'): string {
  if (locale === 'zh') {
    return `你是一位资深的美国大学招生顾问，拥有20年经验。请根据提供的学生档案和学校数据，进行专业的录取概率预测。请用中文回复所有文本字段。

返回格式（严格 JSON）:
{
  "probability": <0到1之间的小数>,
  "confidence": "<low|medium|high>",
  "tier": "<reach|match|safety>",
  "factors": [{ "name": "因素名称", "impact": "<positive|neutral|negative>", "weight": <0-1>, "detail": "分析", "improvement": "建议或null" }],
  "suggestions": ["建议1", "建议2"],
  "comparison": { "gpaPercentile": <0-100>, "testScorePercentile": <0-100>, "activityStrength": "<strong|average|weak>" }
}

关键规则:
- probability 必须基于学校录取率和学生竞争力综合计算
- 录取率 < 10%: probability 通常 0.05-0.25
- 录取率 10%-30%: probability 通常 0.15-0.50
- 录取率 > 30%: probability 通常 0.30-0.80
- 缺少标化成绩降低 10-20 个百分点
- factors 的 weight 之和应接近1
- 只返回 JSON，不要其他内容`;
  }

  return `You are an expert US college admissions consultant with 20 years of experience. Based on the provided student profile and school data, provide a professional admission probability prediction. Respond entirely in English.

Response format (strict JSON):
{
  "probability": <decimal 0-1>,
  "confidence": "<low|medium|high>",
  "tier": "<reach|match|safety>",
  "factors": [{ "name": "Factor", "impact": "<positive|neutral|negative>", "weight": <0-1>, "detail": "Analysis", "improvement": "Suggestion or null" }],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "comparison": { "gpaPercentile": <0-100>, "testScorePercentile": <0-100>, "activityStrength": "<strong|average|weak>" }
}

Key rules:
- Probability must reflect school acceptance rate and student competitiveness
- <10% acceptance: probability typically 0.05-0.25
- 10%-30% acceptance: typically 0.15-0.50
- >30% acceptance: typically 0.30-0.80
- Missing test scores reduce by 10-20 percentage points
- Factor weights should sum close to 1
- Return JSON only, no other content`;
}

/**
 * 易变的用户上下文（记忆洞察等）
 * 作为 user message 的一部分，不影响 seed 确定性
 */
export function buildVolatileUserContext(
  memoryInsights: string[],
  locale = 'zh',
): string {
  if (!memoryInsights || memoryInsights.length === 0) return '';

  const isZh = locale === 'zh';
  const header = isZh
    ? '## 历史记忆上下文（参考）'
    : '## Historical Memory Context (Reference)';
  const items = memoryInsights.map((m) => `- ${m}`).join('\n');
  return `\n\n${header}\n${items}`;
}

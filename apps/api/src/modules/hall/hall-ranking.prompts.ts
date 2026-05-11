export interface RankingAnalysisPromptInput {
  schoolName: string;
  gpa: string;
  satScore: string;
  actScore: string;
  toeflScore: string;
  activityCount: number;
  awardCount: number;
  nationalAwardCount: number;
  internationalAwardCount: number;
  academicScore: string;
  activityScore: string;
  awardScore: string;
  overallScore: string;
  rank: number;
  total: number;
  percentile: number;
  usNewsRank: string;
  acceptanceRate: string;
}

export function buildRankingAnalysisSystemPrompt(locale: string): string {
  if (locale === 'zh') {
    return `你是一位资深美本申请顾问。请基于提供的数据分析学生在目标学校的竞争力。

规则：
1. analysis、strengths、improvements 必须用中文
2. 学校官方名称、GPA/SAT/ACT/TOEFL、US News 等术语保持原文
3. 不要发明未提供的学生经历、学校政策、录取概率或排名数据
4. competitivePosition 只能是 strong、moderate 或 challenging
5. 只输出 JSON，不要其他内容

输出 JSON 格式：
{
  "analysis": "综合分析（2-3句话）",
  "strengths": ["优势1", "优势2"],
  "improvements": ["改进建议1", "改进建议2"],
  "competitivePosition": "strong|moderate|challenging"
}`;
  }

  return `You are a senior US college admissions consultant. Analyze the student's competitiveness at the target school based only on the provided data.

Rules:
1. Write analysis, strengths, and improvements in English
2. Preserve official school names and terms such as GPA/SAT/ACT/TOEFL and US News
3. Do not invent student experiences, school policies, admission probabilities, or ranking data
4. competitivePosition must be strong, moderate, or challenging
5. Output JSON only, no extra text

Output JSON format:
{
  "analysis": "Comprehensive analysis (2-3 sentences)",
  "strengths": ["Strength 1", "Strength 2"],
  "improvements": ["Improvement suggestion 1", "Improvement suggestion 2"],
  "competitivePosition": "strong|moderate|challenging"
}`;
}

export function buildRankingAnalysisUserPrompt(
  locale: string,
  input: RankingAnalysisPromptInput,
): string {
  if (locale === 'zh') {
    return `## 学生数据
- GPA: ${input.gpa}
- SAT: ${input.satScore}
- ACT: ${input.actScore}
- TOEFL: ${input.toeflScore}
- 活动数量: ${input.activityCount}
- 奖项数量: ${input.awardCount}（国家级 ${input.nationalAwardCount}，国际级 ${input.internationalAwardCount}）

## 评分结果
- 学术分: ${input.academicScore}/100
- 活动分: ${input.activityScore}/100
- 奖项分: ${input.awardScore}/100
- 综合分: ${input.overallScore}/100

## 排名
- 排名: ${input.rank}/${input.total}
- 百分位: 前 ${input.percentile}%

## 学校信息
- 学校: ${input.schoolName}
- US News legacy 回退排名: #${input.usNewsRank}
- 录取率: ${input.acceptanceRate}`;
  }

  return `## Student Data
- GPA: ${input.gpa}
- SAT: ${input.satScore}
- ACT: ${input.actScore}
- TOEFL: ${input.toeflScore}
- Activities: ${input.activityCount}
- Awards: ${input.awardCount} (National: ${input.nationalAwardCount}, International: ${input.internationalAwardCount})

## Score Breakdown
- Academic: ${input.academicScore}/100
- Activities: ${input.activityScore}/100
- Awards: ${input.awardScore}/100
- Overall: ${input.overallScore}/100

## Ranking
- Rank: ${input.rank}/${input.total}
- Percentile: Top ${input.percentile}%

## School Info
- School: ${input.schoolName}
- US News legacy fallback rank: #${input.usNewsRank}
- Acceptance Rate: ${input.acceptanceRate}`;
}

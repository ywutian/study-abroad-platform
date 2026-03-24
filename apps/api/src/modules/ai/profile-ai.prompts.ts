import type { ProfileAnalysisRequest } from './ai.types';

export function buildProfileAnalysisSystemPrompt(locale: string): string {
  const isZh = locale === 'zh';

  return isZh
    ? `你是资深美本申请顾问,请对学生档案进行详细评估。

## 评分标准 (1-10分)
- 🟢 green (7-10): 该维度是申请亮点,无需改进
- 🟡 yellow (4-6): 可接受但有明显提升空间
- 🔴 red (1-3): 需要重点改进的短板

## 评估维度

### 1. academic (学术背景)
- GPA 3.9+ unweighted = green
- GPA 3.7-3.89 = yellow
- GPA <3.7 或无数据 = red
- 考虑课程难度(AP/IB数量)

### 2. testScores (标化成绩)
- SAT 1550+ 或 ACT 35+ = green
- SAT 1450-1549 或 ACT 32-34 = yellow
- 无成绩或较低 = red
- TOEFL 110+ = 加分项

### 3. activities (课外活动)
- 有深度+影响力+一致性 = green
- 有活动但缺乏亮点 = yellow
- 活动少/无领导力 = red

### 4. awards (奖项荣誉)
- 国家级/国际级奖项 = green
- 州级/地区级奖项 = yellow
- 校级或无奖项 = red

## 竞争力等级
- top10: 适合冲刺藤校/Top10
- top30: 适合申请Top30
- top50: 适合申请Top50
- top100: 适合申请Top100
- other: 需要更多提升

## 输出格式 (严格JSON)
{
  "sections": {
    "academic": { "status": "green|yellow|red", "score": 1-10, "feedback": "具体评价（中文）", "highlights": ["亮点1"], "improvements": ["改进点1"] },
    "testScores": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] },
    "activities": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] },
    "awards": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] }
  },
  "overallScore": 0-100,
  "tier": "top10|top30|top50|top100|other",
  "suggestions": {
    "majors": ["推荐专业1", "推荐专业2"],
    "competitions": ["推荐竞赛1"],
    "activities": ["推荐活动1"],
    "summerPrograms": ["推荐夏校/项目1"],
    "timeline": ["现在到申请前的规划建议"]
  },
  "summary": "100字总结（中文）"
}

所有文本字段必须用中文。请严格按照JSON格式输出,不要添加其他内容。`
    : `You are an expert US college admissions consultant. Provide a detailed evaluation of the student profile.

## Scoring Criteria (1-10)
- 🟢 green (7-10): This dimension is a strength, no improvement needed
- 🟡 yellow (4-6): Acceptable but room for improvement
- 🔴 red (1-3): Needs significant improvement

## Evaluation Dimensions

### 1. academic (Academic Background)
- GPA 3.9+ unweighted = green
- GPA 3.7-3.89 = yellow
- GPA <3.7 or no data = red
- Consider course rigor (AP/IB count)

### 2. testScores (Standardized Tests)
- SAT 1550+ or ACT 35+ = green
- SAT 1450-1549 or ACT 32-34 = yellow
- No scores or low scores = red
- TOEFL 110+ = bonus

### 3. activities (Extracurricular Activities)
- Depth + impact + consistency = green
- Some activities but lacking highlights = yellow
- Few activities / no leadership = red

### 4. awards (Awards & Honors)
- National/international awards = green
- State/regional awards = yellow
- School-level or none = red

## Competitiveness Tiers
- top10: Competitive for Ivy League/Top 10
- top30: Competitive for Top 30
- top50: Competitive for Top 50
- top100: Competitive for Top 100
- other: Needs more improvement

## Output Format (strict JSON)
{
  "sections": {
    "academic": { "status": "green|yellow|red", "score": 1-10, "feedback": "Detailed feedback (English)", "highlights": ["Highlight 1"], "improvements": ["Improvement 1"] },
    "testScores": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] },
    "activities": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] },
    "awards": { "status": "...", "score": ..., "feedback": "...", "highlights": [], "improvements": [] }
  },
  "overallScore": 0-100,
  "tier": "top10|top30|top50|top100|other",
  "suggestions": {
    "majors": ["Recommended Major 1", "Major 2"],
    "competitions": ["Recommended Competition 1"],
    "activities": ["Recommended Activity 1"],
    "summerPrograms": ["Recommended Program 1"],
    "timeline": ["Planning advice from now to application"]
  },
  "summary": "100-word summary (English)"
}

All text fields must be in English. Return strict JSON only, no other content.`;
}

export function buildProfileAnalysisUserPrompt(
  request: ProfileAnalysisRequest,
  locale: string,
): string {
  const isZh = locale === 'zh';
  const parts: string[] = [
    isZh ? '请分析以下学生档案:\n' : 'Analyze the following student profile:\n',
  ];

  if (request.gpa) {
    parts.push(isZh ? `【学术背景】` : `[Academic Background]`);
    parts.push(`- GPA: ${request.gpa}/${request.gpaScale || 4.0}`);
  } else {
    parts.push(
      isZh ? `【学术背景】未提供GPA` : `[Academic Background] GPA not provided`,
    );
  }

  parts.push(isZh ? `\n【标化成绩】` : `\n[Test Scores]`);
  if (request.testScores?.length) {
    request.testScores.forEach((s) => {
      parts.push(`- ${s.type}: ${s.score}`);
    });
  } else {
    parts.push(isZh ? `- 未提供标化成绩` : `- No test scores provided`);
  }

  parts.push(isZh ? `\n【课外活动】` : `\n[Extracurricular Activities]`);
  parts.push(
    isZh
      ? '(注: 知名项目如RSI/TASP/Science Olympiad等权重更高；未知活动按描述和投入评估)'
      : '(Note: Well-known programs like RSI/TASP/Science Olympiad carry higher weight; unknown activities evaluated by description and commitment)',
  );
  if (request.activities?.length) {
    request.activities.forEach((a, i) => {
      let line = `${i + 1}. ${a.name} - ${a.role} (${a.category})`;
      if (a.description) line += ` | ${a.description.slice(0, 200)}`;
      if (a.hoursPerWeek && a.weeksPerYear) {
        line += ` | ${a.hoursPerWeek}h/${isZh ? '周' : 'wk'}, ${a.weeksPerYear}${isZh ? '周/年' : 'wk/yr'}`;
      }
      if (a.tier) line += ` | Tier ${a.tier}`;
      parts.push(line);
    });
  } else {
    parts.push(isZh ? `- 未填写活动` : `- No activities listed`);
  }

  parts.push(isZh ? `\n【奖项荣誉】` : `\n[Awards & Honors]`);
  if (request.awards?.length) {
    request.awards.forEach((a, i) => {
      let line = `${i + 1}. ${a.name} (${a.level})`;
      if (a.competitionName) line += ` — ${a.competitionName}`;
      if (a.tier) line += ` [Tier ${a.tier}]`;
      parts.push(line);
    });
  } else {
    parts.push(isZh ? `- 未填写奖项` : `- No awards listed`);
  }

  if (request.targetMajor) {
    parts.push(
      isZh
        ? `\n【目标专业】${request.targetMajor}`
        : `\n[Target Major] ${request.targetMajor}`,
    );
  }

  return parts.join('\n');
}

/**
 * Build system prompt for activity description refinement
 */
export function buildActivityRefineSystemPrompt(locale: string): string {
  if (locale === 'zh') {
    return `你是美国大学申请活动描述精简专家。你的任务是将活动描述精简到150字符以内，同时保留最关键的成就和影响。

规则：
1. 输出必须≤150字符（英文）
2. 使用主动语态和动作动词开头
3. 量化成就（数字、百分比、人数）
4. 去除冗余形容词和背景信息
5. 保留最有竞争力的信息
6. 输出纯英文（Common App要求）

返回 JSON 格式：
{"refined": "精简后的描述", "tips": "给用户的优化建议"}`;
  }

  return `You are an expert at refining college application activity descriptions to fit within the 150-character Common App limit while maximizing impact.

Rules:
1. Output MUST be ≤150 characters
2. Start with strong action verbs
3. Quantify achievements (numbers, percentages, people impacted)
4. Remove filler words, adjectives, and background context
5. Keep the most competitive information
6. Output in English (Common App requirement)

Return JSON format:
{"refined": "the refined description", "tips": "optimization advice for the user"}`;
}

/**
 * Build user prompt for activity description refinement
 */
export function buildActivityRefineUserPrompt(
  activityName: string,
  role: string,
  description: string,
  locale: string,
): string {
  return `Activity: ${activityName}
Role: ${role}
Original description (${description.length} chars):
${description}

${locale === 'zh' ? '请精简到150字符以内，返回JSON。' : 'Refine to ≤150 characters. Return JSON.'}`;
}

/**
 * Build system prompt for generating Common App activity description from detailed description
 */
export function buildGenerateCommonAppSystemPrompt(locale: string): string {
  if (locale === 'zh') {
    return `你是美国大学申请活动描述撰写专家。根据用户提供的详细活动描述，生成一段适合 Common App 的精炼英文描述，控制在150字符以内。

规则：
1. 输出必须≤150个英文字符（含空格和标点）
2. 使用主动语态，以动作动词开头
3. 量化成就（数字、百分比、影响人数）
4. 突出最有竞争力和最独特的信息
5. 去除冗余背景和形容词
6. 输出纯英文（Common App 要求）
7. 确保描述完整、可独立理解
8. 只使用用户提供的信息，不要编造任何成就、数字或事实

只返回以下 JSON 格式，不要添加任何解释或额外文本：
{"commonAppDescription": "生成的Common App描述"}`;
  }

  return `You are an expert college application counselor specializing in writing impactful Common App activity descriptions. Generate a concise, compelling description (≤150 characters) from the detailed activity information provided.

Rules:
1. Output MUST be ≤150 characters including spaces and punctuation
2. Use active voice, start with strong action verbs
3. Quantify achievements (numbers, percentages, people impacted)
4. Highlight the most competitive and unique information
5. Remove filler words, adjectives, and background context
6. Output in English (Common App requirement)
7. Ensure the description is self-contained and understandable
8. Use ONLY information provided by the user. Do NOT fabricate achievements, numbers, or facts.

Return ONLY the JSON below. Do not include any explanation or additional text.
{"commonAppDescription": "the generated Common App description"}`;
}

/**
 * Build user prompt for generating Common App activity description
 */
export function buildGenerateCommonAppUserPrompt(
  activityName: string,
  role: string,
  description: string,
  locale: string,
): string {
  const lines = [`Activity: ${activityName}`];
  if (role) lines.push(`Role: ${role}`);
  lines.push(`Detailed description (${description.length} chars):`);
  lines.push(description);
  lines.push('');
  lines.push(
    locale === 'zh'
      ? '请生成一段≤150字符的 Common App 活动描述，返回JSON。'
      : 'Generate a ≤150 character Common App activity description. Return JSON.',
  );
  return lines.join('\n');
}

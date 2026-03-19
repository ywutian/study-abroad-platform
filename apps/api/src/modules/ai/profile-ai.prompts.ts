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

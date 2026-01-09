/**
 * 预测 Prompt 构建器
 */

export interface ProfileInput {
  gpa?: number;
  gpaScale?: number;
  grade?: string;
  currentSchoolType?: string;
  targetMajor?: string;
  testScores: Array<{
    type: string;
    score: number;
    subScores?: Record<string, number>;
  }>;
  activities: Array<{
    category: string;
    role: string;
    hoursPerWeek?: number;
    weeksPerYear?: number;
  }>;
  awards: Array<{
    level: string;
    name?: string;
  }>;
}

export interface SchoolInput {
  id: string;
  name: string;
  nameZh?: string;
  acceptanceRate?: number;
  satAvg?: number;
  actAvg?: number;
  usNewsRank?: number;
}

/**
 * 格式化标化成绩
 */
function formatTestScores(scores: ProfileInput['testScores']): string {
  if (!scores || scores.length === 0) return '未提供';
  
  return scores.map(s => {
    let result = `${s.type}: ${s.score}`;
    if (s.subScores && Object.keys(s.subScores).length > 0) {
      const subs = Object.entries(s.subScores).map(([k, v]) => `${k}: ${v}`).join(', ');
      result += ` (${subs})`;
    }
    return result;
  }).join('; ');
}

/**
 * 格式化获奖情况
 */
function formatAwards(awards: ProfileInput['awards']): string {
  if (!awards || awards.length === 0) return '无';
  
  const levelCounts: Record<string, number> = {};
  awards.forEach(a => {
    levelCounts[a.level] = (levelCounts[a.level] || 0) + 1;
  });
  
  return Object.entries(levelCounts)
    .map(([level, count]) => `${level}: ${count}项`)
    .join(', ');
}

/**
 * 格式化活动情况
 */
function formatActivities(activities: ProfileInput['activities']): string {
  if (!activities || activities.length === 0) return '无';
  
  const categoryCounts: Record<string, number> = {};
  let totalHours = 0;
  
  activities.forEach(a => {
    categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
    if (a.hoursPerWeek && a.weeksPerYear) {
      totalHours += a.hoursPerWeek * a.weeksPerYear;
    }
  });
  
  const categories = Object.entries(categoryCounts)
    .map(([cat, count]) => `${cat}: ${count}项`)
    .join(', ');
    
  return `共${activities.length}项活动 (${categories})${totalHours > 0 ? `，约${totalHours}小时` : ''}`;
}

/**
 * 构建预测 Prompt
 */
export function buildPredictionPrompt(profile: ProfileInput, school: SchoolInput): string {
  const gpaText = profile.gpa 
    ? `${profile.gpa}/${profile.gpaScale || 4.0}` 
    : '未提供';

  return `你是一位资深的美国大学招生顾问，拥有20年经验，对各大学录取标准有深入了解。请根据以下学生档案和目标学校数据，进行专业的录取概率预测。

## 学生档案
- GPA: ${gpaText}
- 年级: ${profile.grade || '未知'}
- 标化成绩: ${formatTestScores(profile.testScores)}
- 目标专业: ${profile.targetMajor || '未确定'}
- 活动经历: ${formatActivities(profile.activities)}
- 获奖情况: ${formatAwards(profile.awards)}

## 目标学校: ${school.nameZh || school.name}
- US News 排名: ${school.usNewsRank ? `#${school.usNewsRank}` : '未知'}
- 录取率: ${school.acceptanceRate ? `${school.acceptanceRate}%` : '未知'}
- 平均 SAT: ${school.satAvg || '未知'}
- 平均 ACT: ${school.actAvg || '未知'}

## 分析要求
1. 综合评估学生竞争力与学校录取标准的匹配度
2. 考虑标化成绩、GPA、活动、奖项等多维度因素
3. 给出具体、可操作的改进建议

## 返回格式（严格 JSON）
{
  "probability": 0.35,
  "confidence": "medium",
  "tier": "reach",
  "factors": [
    {
      "name": "GPA",
      "impact": "positive",
      "weight": 0.3,
      "detail": "具体分析...",
      "improvement": null
    },
    {
      "name": "标化成绩",
      "impact": "negative",
      "weight": 0.25,
      "detail": "具体分析...",
      "improvement": "具体建议..."
    }
  ],
  "suggestions": [
    "建议1",
    "建议2"
  ],
  "comparison": {
    "gpaPercentile": 75,
    "testScorePercentile": 50,
    "activityStrength": "average"
  }
}

注意事项：
- probability: 0-1 之间的小数，表示录取概率
- confidence: low/medium/high，根据数据完整度判断
- tier: reach(冲刺)/match(匹配)/safety(保底)
- factors: 3-5个关键因素，weight 之和应接近1
- 只返回 JSON，不要其他内容`;
}

/**
 * 构建批量预测的简化 Prompt（用于降低 token 消耗）
 */
export function buildBatchPredictionPrompt(profile: ProfileInput, schools: SchoolInput[]): string {
  const gpaText = profile.gpa 
    ? `${profile.gpa}/${profile.gpaScale || 4.0}` 
    : '未提供';

  const schoolsList = schools.map(s => 
    `- ${s.nameZh || s.name} (排名: ${s.usNewsRank || '未知'}, 录取率: ${s.acceptanceRate || '未知'}%)`
  ).join('\n');

  return `你是资深美国大学招生顾问。根据学生档案，快速评估多所学校的录取概率。

## 学生档案
- GPA: ${gpaText}
- 标化: ${formatTestScores(profile.testScores)}
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
    "suggestion": "一条关键建议"
  }
]

只返回JSON数组。`;
}




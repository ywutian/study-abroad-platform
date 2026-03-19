/**
 * Essay AI prompt constants.
 *
 * Shared between reviewEssay/reviewEssayDirect and brainstormIdeas/brainstormDirect
 * to eliminate duplication.
 */

// ── Review prompts ──────────────────────────────────────────

export const ESSAY_REVIEW_SYSTEM_ZH = `你是一位顶尖大学招生官，请从招生官视角评估以下文书。

请从以下维度评分(1-10)并给出详细点评：
1. clarity (主题清晰度): 文章主旨是否明确，读者能否快速理解你想表达什么
2. uniqueness (个人特色): 是否展现了独特的个人经历、观点或视角
3. storytelling (故事性): 叙事是否引人入胜，有没有让人印象深刻的细节
4. fit (学校契合度): 是否展现了与目标学校价值观、文化的契合
5. language (语言表达): 语法、用词、句式是否恰当有力

返回JSON格式：
{
  "overallScore": 7.5,
  "scores": { "clarity": 8, "uniqueness": 7, "storytelling": 8, "fit": 7, "language": 8 },
  "strengths": ["亮点1", "亮点2"],
  "weaknesses": ["不足1", "不足2"],
  "suggestions": ["建议1", "建议2"],
  "verdict": "总体评价（50-100字）"
}

所有文本字段必须用中文。`;

export const ESSAY_REVIEW_SYSTEM_EN = `You are a top university admissions officer. Evaluate the following essay from an admissions perspective.

Score each dimension (1-10) and provide detailed feedback:
1. clarity: Is the thesis clear? Can the reader quickly understand your message?
2. uniqueness: Does it showcase unique personal experiences, viewpoints, or perspectives?
3. storytelling: Is the narrative engaging? Are there memorable details?
4. fit: Does it demonstrate alignment with the target school's values and culture?
5. language: Are grammar, word choice, and sentence structure effective?

Return JSON format:
{
  "overallScore": 7.5,
  "scores": { "clarity": 8, "uniqueness": 7, "storytelling": 8, "fit": 7, "language": 8 },
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "verdict": "Overall verdict (50-100 words)"
}

All text fields must be in English.`;

/**
 * Build the review system prompt with optional school context.
 */
export function buildReviewSystemPrompt(
  locale: string,
  schoolContext?: { name: string; details: string },
  major?: string,
): string {
  const isZh = locale === 'zh';
  const base = isZh ? ESSAY_REVIEW_SYSTEM_ZH : ESSAY_REVIEW_SYSTEM_EN;

  const contextLines: string[] = [];
  if (schoolContext) {
    contextLines.push(
      isZh
        ? `目标学校：${schoolContext.name}${schoolContext.details}`
        : `Target school: ${schoolContext.name}${schoolContext.details}`,
    );
  }
  if (major) {
    contextLines.push(isZh ? `目标专业：${major}` : `Target major: ${major}`);
  }

  if (contextLines.length === 0) return base;

  // Insert school/major context after the first line
  const lines = base.split('\n');
  return [lines[0], '', ...contextLines, '', ...lines.slice(1)].join('\n');
}

// ── Brainstorm prompts ──────────────────────────────────────

export const ESSAY_BRAINSTORM_SYSTEM_ZH = `你是一位资深留学文书顾问，擅长帮助学生挖掘独特的故事和角度。

根据提供的题目和背景，生成5-8个具体、有深度的写作角度。每个想法要：
1. 具体可执行，不是泛泛的建议
2. 有独特性，能让文书脱颖而出
3. 与学生背景相关联

返回JSON格式：
{
  "ideas": [
    {
      "title": "想法标题（简短有力）",
      "description": "详细说明",
      "suitableFor": "适合什么类型的题目/学校"
    }
  ],
  "overallAdvice": "整体写作建议（100字内）"
}

所有文本字段必须用中文。`;

export const ESSAY_BRAINSTORM_SYSTEM_EN = `You are an expert college essay consultant who excels at helping students discover unique stories and angles.

Based on the prompt and background, generate 5-8 specific, insightful writing angles. Each idea should:
1. Be specific and actionable, not generic advice
2. Be unique enough to make the essay stand out
3. Connect to the student's background

Return JSON format:
{
  "ideas": [
    {
      "title": "Idea title (concise and powerful)",
      "description": "Detailed explanation",
      "suitableFor": "What type of prompt/school this suits"
    }
  ],
  "overallAdvice": "Overall writing advice (under 100 words)"
}

All text fields must be in English.`;

/**
 * Build the brainstorm system prompt with optional school context.
 */
export function buildBrainstormSystemPrompt(
  locale: string,
  schoolContext?: { name: string; details: string },
  major?: string,
): string {
  const isZh = locale === 'zh';
  const base = isZh ? ESSAY_BRAINSTORM_SYSTEM_ZH : ESSAY_BRAINSTORM_SYSTEM_EN;

  const contextLines: string[] = [];
  if (schoolContext) {
    contextLines.push(
      isZh
        ? `目标学校：${schoolContext.name}${schoolContext.details}`
        : `Target school: ${schoolContext.name}${schoolContext.details}`,
    );
  }
  if (major) {
    contextLines.push(isZh ? `目标专业：${major}` : `Target major: ${major}`);
  }

  if (contextLines.length === 0) return base;

  const lines = base.split('\n');
  return [lines[0], '', ...contextLines, '', ...lines.slice(1)].join('\n');
}

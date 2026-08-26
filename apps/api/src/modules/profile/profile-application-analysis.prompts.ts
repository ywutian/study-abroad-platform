const SYNTHESIS_SCHEMA = `{
  "summary": "string",
  "portfolioAnalysis": {
    "verdict": "string",
    "reasons": ["string"],
    "riskBoundaries": ["string"]
  },
  "targetSchoolInsights": [
    {
      "schoolId": "string",
      "whyThisIsHard": ["string"],
      "compensatingStrengths": ["string"],
      "topGaps": ["string"],
      "nextActions": ["string"],
      "hardStopRisks": ["string"]
    }
  ],
  "actionPlan": {
    "now": ["string"],
    "next90Days": ["string"],
    "beforeSubmission": ["string"]
  },
  "recommendedPrograms": {
    "majors": ["string"],
    "competitions": ["string"],
    "activities": ["string"],
    "summerPrograms": ["string"],
    "timeline": ["string"]
  }
}`;

export function buildApplicationAnalysisSystemPrompt(locale: string): string {
  const isZh = locale === 'zh';

  return isZh
    ? `你是资深美本申请顾问。你只负责把已给出的证据整理成顾问式申请分析，不得发明新的概率、tier、排名或录取规则。

强制规则：
1. 概率、学校难度、round 信息只能来自输入 evidence。
2. 不得引用或推断历史个案，也不得把品牌名气当作“命运判断”。
3. 不得把国籍、助学金、first-gen、legacy 变成价值判断；这些只可作为申请约束与策略背景。
4. 每条学校级判断都必须基于给定 evidence；证据不足时明确写 unknown 或提醒先补数据。
5. 建议必须具体、分阶段、可执行，避免空泛鼓励。
6. 不要输出 markdown，不要输出解释文字，只输出 JSON。

输出 JSON schema：
${SYNTHESIS_SCHEMA}`
    : `You are a senior US college admissions consultant. Your job is to synthesize the supplied evidence into a strategy memo. Do not invent new probabilities, tiers, rankings, or admissions rules.

Hard rules:
1. Probability, school difficulty, and round context must come only from the supplied evidence.
2. Do not cite or infer historical individual cases, and do not treat brand prestige as destiny.
3. Nationality, aid status, first-gen, and legacy are context constraints, not value judgments.
4. Every school-level claim must be grounded in provided evidence. If evidence is insufficient, say unknown or ask for missing inputs.
5. Recommendations must be concrete, phased, and actionable. Avoid generic encouragement.
6. Do not output markdown or extra commentary. Return JSON only.

Output JSON schema:
${SYNTHESIS_SCHEMA}`;
}

export function buildApplicationAnalysisUserPrompt(
  evidence: Record<string, unknown>,
  locale: string,
): string {
  const isZh = locale === 'zh';

  return `${isZh ? '请基于以下证据生成结构化申请分析。' : 'Generate a structured application analysis from the evidence below.'}

${isZh ? '证据 JSON：' : 'Evidence JSON:'}
${JSON.stringify(evidence)}
`;
}

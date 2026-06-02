const SCHOOL_ANALYST_SCHEMA = `{
  "summary": "string",
  "whyThisIsHard": ["string"],
  "compensatingStrengths": ["string"],
  "topGaps": ["string"],
  "nextActions": ["string"],
  "historicalSignals": ["string"],
  "hardStopRisks": ["string"],
  "recourse": {
    "goal": "string",
    "recommendedChanges": [
      {
        "action": "string",
        "rationale": "string",
        "effort": "low|medium|high",
        "timeHorizon": "now|next90Days|beforeSubmission",
        "blockedBy": ["string"]
      }
    ],
    "estimatedDirection": "upside|stabilize|mixed",
    "constraints": ["string"],
    "whyNotGuaranteed": "string"
  },
  "uncertainty": {
    "intervalLabel": "tight|balanced|wide",
    "reasons": ["string"]
  },
  "evidenceIds": ["string"],
  "unknowns": ["string"]
}`;

const PORTFOLIO_SCHEMA = `{
  "verdict": "string",
  "balance": "balanced|reachHeavy|safetyHeavy|undermatch|insufficient",
  "keyReasons": ["string"],
  "riskBoundaries": ["string"],
  "actionPlan": {
    "now": ["string"],
    "next90Days": ["string"],
    "beforeSubmission": ["string"]
  },
  "unknowns": ["string"]
}`;

export function buildSchoolAnalystSystemPrompt(locale: string): string {
  const isZh = locale === 'zh';

  return isZh
    ? `你是申请分析工作流中的学校分析器。你只能基于给定的 profileSummary、prediction、policyCard、historicalSignals 做学校级判断。

硬性规则：
1. 不得发明新的学校政策、截止日期、录取概率、round 规则。
2. 每条学校级判断都必须能被给定 evidenceIds 支撑。
3. 若 policyCard 或 prediction 缺信息，必须把 unknown 写进 unknowns，而不是自行猜测。
4. evidenceIds 只能从输入允许的 evidenceIds 中选择。
5. 只输出 JSON，不要输出 markdown 或解释文字。

输出 schema：
${SCHOOL_ANALYST_SCHEMA}`
    : `You are the school-level analyst inside an application-analysis workflow. You may only reason from the supplied profileSummary, prediction, policyCard, and historicalSignals.

Hard rules:
1. Do not invent school policies, deadlines, probabilities, or round rules.
2. Every school-level claim must be supportable by the supplied evidenceIds.
3. If policyCard or prediction data is missing, write unknowns instead of guessing.
4. evidenceIds must be chosen only from the allowed evidenceIds in the input.
5. Return JSON only. No markdown or extra explanation.

Output schema:
${SCHOOL_ANALYST_SCHEMA}`;
}

export function buildSchoolAnalystUserPrompt(
  input: Record<string, unknown>,
  locale: string,
): string {
  const isZh = locale === 'zh';

  return `${isZh ? '请基于以下学校输入生成学校级分析。' : 'Generate a school-level analysis from the input below.'}

${isZh ? '输入 JSON：' : 'Input JSON:'}
${JSON.stringify(input)}`;
}

export function buildPortfolioSystemPrompt(locale: string): string {
  const isZh = locale === 'zh';

  return isZh
    ? `你是申请分析工作流中的组合层汇总器。你只能消费 schools[]、profileSummary、fallbackPortfolioSummary、fallbackActionPlan。

硬性规则：
1. 不得读取原始 evidence，也不得发明新的学校事实。
2. verdict、keyReasons、riskBoundaries、actionPlan 必须和 schools[] 保持一致。
3. 若信息不足，使用 unknowns，而不是生成强结论。
4. 只输出 JSON。

输出 schema：
${PORTFOLIO_SCHEMA}`
    : `You are the portfolio-level synthesizer inside an application-analysis workflow. You may only consume schools[], profileSummary, fallbackPortfolioSummary, and fallbackActionPlan.

Hard rules:
1. Do not read raw evidence and do not invent new school facts.
2. verdict, keyReasons, riskBoundaries, and actionPlan must stay consistent with schools[].
3. If information is insufficient, use unknowns instead of strong unsupported conclusions.
4. Return JSON only.

Output schema:
${PORTFOLIO_SCHEMA}`;
}

export function buildPortfolioUserPrompt(
  input: Record<string, unknown>,
  locale: string,
): string {
  const isZh = locale === 'zh';

  return `${isZh ? '请基于以下输入生成组合层申请分析。' : 'Generate the portfolio-level analysis from the input below.'}

${isZh ? '输入 JSON：' : 'Input JSON:'}
${JSON.stringify(input)}`;
}

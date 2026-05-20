import type { AdmissionResult } from '@prisma/client';

/**
 * Versioned prompt for the essay-debate feature (Phase 2 V1 PR2).
 *
 * Bump `DEBATE_PROMPT_VERSION` whenever you change the system prompt,
 * the JSON output schema, or the user-prompt packing rules. The version
 * is included in every persisted turn's `tokensUsed` audit blob so we can
 * later filter dogfood transcripts by the prompt revision they ran under.
 *
 * Red-team verdict baked in here:
 *  - Output schema has `rebuttal` + `evidence[]` + `openQuestion`, NEVER
 *    a `concedes` field. The model is allowed to update its judgement
 *    inline ("I should revise that…") but it must do so in prose with
 *    grounded evidence, not as a structured capitulation field.
 *  - The system prompt explicitly tells the model NOT to fall back to
 *    "you might be right" sycophancy when it has no evidence.
 *  - Evidence quotes MUST be verbatim substrings of context — the
 *    backend enforces this; the prompt also warns the model.
 */
export const DEBATE_PROMPT_VERSION = 'v1';

/**
 * Context object the backend assembles per turn. The 6 classes ((1)..(6))
 * map onto the classes documented in `CONTEXT_AUDIT.md`. Each may be null
 * — the prompt builder must tolerate missing pieces without crashing.
 */
export interface DebateContextPayload {
  school: {
    name: string;
    nameZh?: string | null;
    usNewsRank?: number | null;
    acceptanceRate?: number | null;
  } | null;
  profile: {
    gpa?: number | null;
    gpaScale?: number | null;
    satRange?: string | null;
    actRange?: string | null;
    targetMajor?: string | null;
    topActivities?: string[];
    topAward?: string | null;
  } | null;
  essay: {
    fullText: string;
    paragraphs: string[]; // pre-split, so the prompt can reference indices
    wordCount: number;
    targetedParagraphIndex: number | null;
  };
  prompt: string | null;
  result: {
    result: AdmissionResult;
    year: number;
    round: string | null;
  } | null;
  /**
   * The original AI paragraph commentary the user is arguing against.
   * Only the targeted paragraph's commentary is included — the rest is
   * truncation overhead for no signal.
   */
  priorCommentary: {
    paragraphIndex: number;
    score: number;
    status: string;
    comment: string;
    highlights: string[];
    suggestions: string[];
  } | null;
  /**
   * Previous turns from the same debate session. Capped to last 6 entries
   * (3 round-trips) so the prompt stays in budget even for long debates.
   */
  debateHistory: Array<{
    role: 'user' | 'ai';
    text: string;
  }>;
}

/**
 * System prompt — locale-aware. Frames the model as a feedback assistant
 * defending its prior paragraph commentary, NOT a friendly cheerleader.
 */
export function buildDebateSystemPrompt(locale: 'zh' | 'en'): string {
  if (locale === 'en') {
    return [
      `You are an essay feedback assistant. A student is challenging a piece of paragraph-level feedback you (or a peer assistant) gave them earlier. Your job is to respond with a grounded rebuttal — NOT to capitulate to social pressure, NOT to validate them out of politeness.`,
      ``,
      `Rules you MUST follow:`,
      `  1. Every claim in your rebuttal must be backed by a verbatim quote from the essay text, the prior paragraph commentary, the applicant profile, or the school context provided. Never invent quotes.`,
      `  2. If the student raises a point you hadn't considered and they are right, say so plainly in your rebuttal text — e.g. "You're right that I missed X — here's how my assessment shifts." Do NOT use a separate "concedes" field.`,
      `  3. If the student's argument has no evidentiary support OR contradicts the essay text, hold your ground and explain why. Quote the contradicting passage.`,
      `  4. Be concrete. Vague phrases like "I see your perspective" or "fair point" without evidence are forbidden.`,
      `  5. End with one open question that pushes the student to think harder about their argument — never a rhetorical question, never agreement-seeking.`,
      ``,
      `Output JSON ONLY, matching this schema exactly:`,
      `{`,
      `  "rebuttal": string (max 600 chars),`,
      `  "evidence": [`,
      `    { "quote": string, "source": "essay" | "prior_commentary" | "profile" | "school", "paragraphIndex"?: number }`,
      `  ],`,
      `  "openQuestion": string (max 200 chars)`,
      `}`,
      ``,
      `Do NOT include any field named "concedes". Do NOT wrap the JSON in markdown fences. Do NOT include surrounding prose.`,
      ``,
      `Prompt version: ${DEBATE_PROMPT_VERSION}`,
    ].join('\n');
  }

  return [
    `你是一个 essay 反馈助手。用户正在挑战你（或同类助手）之前对他文书某段的评价。你的职责是给出一个有依据的反驳——绝不因为社交压力而妥协，也不能为了讨好用户而空泛地认同他。`,
    ``,
    `必须遵守的规则：`,
    `  1. 反驳中的每一个论点都必须有来自 essay 原文、之前的段评、申请人 profile、或学校信息中的**原文片段**作为证据。绝不编造引用。`,
    `  2. 如果用户提出了一个你之前没考虑到的点并且确实有道理，请在 rebuttal 正文里明确说明——例如「你说得对，我之前忽略了 X——我的判断应该修正为……」。不要使用单独的 "concedes" 字段。`,
    `  3. 如果用户的论点没有证据支撑、或者与 essay 原文矛盾，请坚持你的判断并解释原因，并引用矛盾的段落。`,
    `  4. 必须具体。空话如「我理解你的观点」「你说得有道理」如果没有证据支持，禁止使用。`,
    `  5. 在结尾抛出一个能推动用户更深入思考的开放性问题，不能是修辞问句，不能是寻求认同的问句。`,
    ``,
    `只输出 JSON，严格匹配以下 schema：`,
    `{`,
    `  "rebuttal": string (最多 600 字符),`,
    `  "evidence": [`,
    `    { "quote": string, "source": "essay" | "prior_commentary" | "profile" | "school", "paragraphIndex"?: number }`,
    `  ],`,
    `  "openQuestion": string (最多 200 字符)`,
    `}`,
    ``,
    `不要包含名为 "concedes" 的字段。不要把 JSON 包在 markdown 代码块里。不要在 JSON 前后加任何说明文字。`,
    ``,
    `Prompt version: ${DEBATE_PROMPT_VERSION}`,
  ].join('\n');
}

/**
 * Pack the 6 context classes + the user challenge into one user-role
 * message. Token budget target: ~6,000 input tokens worst case.
 *
 * We truncate aggressively:
 *  - Only the targeted paragraph + ±1 neighbours of the essay are sent
 *    when `paragraphIndex` is set. Otherwise the full essay.
 *  - Profile → GPA + top 3 activities + top award only.
 *  - debateHistory → last 6 entries already capped by the loader.
 */
export function buildDebateUserPrompt(
  ctx: DebateContextPayload,
  userText: string,
  locale: 'zh' | 'en',
): string {
  const lines: string[] = [];
  const L = locale === 'zh';

  // ── Class 1: school ────────────────────────────────────────────────
  if (ctx.school) {
    const rank = ctx.school.usNewsRank
      ? ` (USNews #${ctx.school.usNewsRank})`
      : '';
    // `acceptanceRate` on School is stored as a percentage (0..100), not
    // a fraction. We just format with one decimal place.
    const ar =
      ctx.school.acceptanceRate != null
        ? L
          ? ` · 录取率 ${ctx.school.acceptanceRate.toFixed(1)}%`
          : ` · admit rate ${ctx.school.acceptanceRate.toFixed(1)}%`
        : '';
    lines.push(L ? '[学校]' : '[School]');
    lines.push(
      `${ctx.school.name}${ctx.school.nameZh ? ` / ${ctx.school.nameZh}` : ''}${rank}${ar}`,
    );
    lines.push('');
  }

  // ── Class 5: result (admit / reject etc) ───────────────────────────
  if (ctx.result) {
    lines.push(L ? '[录取结果]' : '[Result]');
    lines.push(
      `${ctx.result.result} · ${ctx.result.year}${ctx.result.round ? ` · ${ctx.result.round}` : ''}`,
    );
    lines.push('');
  }

  // ── Class 2: profile snapshot ──────────────────────────────────────
  if (ctx.profile) {
    lines.push(L ? '[申请人画像]' : '[Applicant Profile]');
    const p = ctx.profile;
    if (p.gpa != null)
      lines.push(`GPA: ${p.gpa}${p.gpaScale ? `/${p.gpaScale}` : ''}`);
    if (p.satRange) lines.push(`SAT: ${p.satRange}`);
    if (p.actRange) lines.push(`ACT: ${p.actRange}`);
    if (p.targetMajor)
      lines.push(
        L ? `目标专业: ${p.targetMajor}` : `Target major: ${p.targetMajor}`,
      );
    if (p.topActivities && p.topActivities.length > 0) {
      lines.push(L ? '主要活动:' : 'Top activities:');
      p.topActivities.slice(0, 3).forEach((a) => lines.push(`  - ${a}`));
    }
    if (p.topAward)
      lines.push(L ? `代表性奖项: ${p.topAward}` : `Top award: ${p.topAward}`);
    lines.push('');
  }

  // ── Class 4: original prompt ───────────────────────────────────────
  if (ctx.prompt) {
    lines.push(L ? '[文书题目]' : '[Essay Prompt]');
    // Truncate prompt to first 600 chars — most are far shorter.
    lines.push(
      ctx.prompt.length > 600 ? `${ctx.prompt.slice(0, 600)}…` : ctx.prompt,
    );
    lines.push('');
  }

  // ── Class 3: essay text ────────────────────────────────────────────
  lines.push(L ? '[文书原文]' : '[Essay]');
  const targetIdx = ctx.essay.targetedParagraphIndex;
  if (targetIdx != null && ctx.essay.paragraphs.length > 5) {
    const start = Math.max(0, targetIdx - 1);
    const end = Math.min(ctx.essay.paragraphs.length, targetIdx + 2);
    if (start > 0)
      lines.push(L ? '…(前文略)' : '…(earlier paragraphs omitted)');
    for (let i = start; i < end; i++) {
      lines.push(`【段落 ${i}】${ctx.essay.paragraphs[i]}`);
      lines.push('');
    }
    if (end < ctx.essay.paragraphs.length) {
      lines.push(L ? '…(后文略)' : '…(later paragraphs omitted)');
      lines.push('');
    }
  } else {
    ctx.essay.paragraphs.forEach((p, i) => {
      lines.push(`【段落 ${i}】${p}`);
      lines.push('');
    });
  }

  // ── Class 6: prior AI paragraph commentary ─────────────────────────
  if (ctx.priorCommentary) {
    const pc = ctx.priorCommentary;
    lines.push(
      L ? '[你之前对这段的评价]' : '[Your prior commentary on this paragraph]',
    );
    lines.push(
      `${L ? '段落' : 'Paragraph'} ${pc.paragraphIndex} · ${pc.score}/10 · ${pc.status}`,
    );
    lines.push(pc.comment);
    if (pc.highlights.length > 0) {
      lines.push((L ? '亮点: ' : 'Highlights: ') + pc.highlights.join(', '));
    }
    if (pc.suggestions.length > 0) {
      lines.push((L ? '建议: ' : 'Suggestions: ') + pc.suggestions.join('; '));
    }
    lines.push('');
  }

  // ── Prior debate turns (when continuing a session) ─────────────────
  if (ctx.debateHistory.length > 0) {
    lines.push(L ? '[本次对话历史]' : '[Conversation so far]');
    for (const turn of ctx.debateHistory) {
      const prefix =
        turn.role === 'user'
          ? L
            ? '用户:'
            : 'User:'
          : L
            ? '助手:'
            : 'Assistant:';
      lines.push(`${prefix} ${turn.text}`);
    }
    lines.push('');
  }

  // ── The challenge ──────────────────────────────────────────────────
  lines.push(L ? '[用户当前的反驳]' : "[User's current challenge]");
  if (targetIdx != null) {
    lines.push(
      L
        ? `（针对段落 ${targetIdx}）${userText}`
        : `(re: paragraph ${targetIdx}) ${userText}`,
    );
  } else {
    lines.push(userText);
  }
  lines.push('');
  lines.push(
    L
      ? '请给出 JSON 格式的反驳。记住：每条 evidence.quote 必须是上面任何一段的**原文片段**，否则会被剔除。'
      : 'Reply with the JSON rebuttal. Reminder: every evidence.quote must be a VERBATIM substring of the text above; fabricated quotes will be stripped.',
  );

  return lines.join('\n');
}

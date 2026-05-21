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
export const DEBATE_PROMPT_VERSION = 'v4';

/**
 * Concession-opening phrases banned by the v2 prompt (PR6).
 *
 * Driven by PR5's 5-agent 100-eval signal: rebuttals that lead with one of
 * these phrases were consistently flagged SYCOPHANTIC by 3+ raters even
 * when the body of the rebuttal eventually defended the original judgment.
 * The schema-level ban (PR2 removed the `concedes` field) wasn't enough —
 * the model still does sycophancy 2.0 in prose.
 *
 * Exported so the spec can assert the system prompt embeds the full list,
 * and so PR7's eval pipeline can post-hoc score adherence.
 */
export const BANNED_OPENING_PHRASES = [
  '你说得对',
  'I see your point',
  '我之前忽略了',
  'Your observation is fair',
  '我之前把它看成... 过于保守了',
  "that's a fair point",
  '你的挑战有道理',
  '我理解你的观点',
] as const;

/**
 * Templated rebuttal openers banned by the v3 prompt (PR8).
 *
 * Driven by PR7's v2 re-eval signal: with the v2 sycophancy ban in place,
 * the model fell back into 6 stock structural openers (Eric flagged 17/20
 * v2 turns used one). They don't read sycophantic but they read
 * mechanical — Eric: "全部以模板开头", Sarah: "如果AI认为...8 条". The
 * fix is to require concrete subject as the first clause, not a stock
 * frame. Any opener matching these templates triggers the eval pipeline's
 * "template fatigue" warning (post-hoc, non-blocking).
 */
export const BANNED_OPENING_TEMPLATES = [
  '如果AI认为',
  '如果 AI 认为',
  '最值得商榷的',
  '之前评估里',
  '针对之前评估',
  '争议点应放在',
  '我最不同意',
  '我最不认同',
] as const;

/**
 * Structural hedge patterns banned by the v4 prompt (PR9).
 *
 * Driven by PR8 v3 re-eval (Mrs. Liu's 2 SYCOPHANTIC flags):
 *   - cmpf418ns (UC Berkeley): "真正可商榷的不是 X 而是 Y"
 *   - cmpf41cin (Stanford):    "说 X 可以，但 Y"
 *
 * These escaped HARD RULE 4's literal-phrase regex ("成立一部分 / 有道理但若")
 * but are functionally identical: front-pivot concession + soft-counter. Liu
 * (the parent-trust persona) is the most sensitive to "被敷衍感", and she's
 * also the persona most predictive of real-user churn — these patterns are
 * higher-priority bans than the literal v3 set.
 *
 * Detected by post-hoc service warning, NOT blocking. Hard-blocking these
 * would risk over-correcting back into v3's GENERIC template trap (Wei's
 * meta-template-fatigue signal). The prompt instructs the model to avoid;
 * runtime audit logs the rate.
 */
export const BANNED_HEDGE_PATTERNS = [
  '真正可商榷的不是',
  '说.{1,4}可以，但',
  '说.{1,4}可以但',
  '不否认',
  '部分成立但',
] as const;

/**
 * Opener-archetype examples shown to the model in v4 (PR9) to fix Wei's
 * meta-template-fatigue finding. The v3 prompt required quote-first openers
 * but the model converged on a single structural template:
 *   "X" 这一判断不成立 / 过窄 / 过严
 *
 * Wei flagged 20/20 v3 turns used this exact frame. The fix is to enumerate
 * 4 acceptable syntactic alternates so the model rotates. The constraint
 * (quote-first or concrete-subject-first) is unchanged; we just give the
 * model multiple ways to satisfy it.
 *
 * Each example illustrates a DIFFERENT linguistic structure:
 *  1. quote + judgement adjective ("X" 这一判断 [adj])
 *  2. quote + reading reframe (关于 "X"，更准确的读法是...)
 *  3. quote + paragraph anchor (段落 N 的 "X" 实际上...)
 *  4. quote + tradeoff inversion ("X" 不是 Y 的弱点而是优势)
 */
export const OPENER_ARCHETYPES_ZH = [
  '"X" 这一判断过窄了/低估了 …',
  '关于 "X"，更准确的读法是 …',
  '段落 N 的 "X" 实际上完成了 …',
  '"X" 不是 Y 的弱点而是 Y 的优势 …',
] as const;
export const OPENER_ARCHETYPES_EN = [
  '"X" understates / misreads ...',
  'A more accurate reading of "X" is ...',
  'The "X" in paragraph N actually accomplishes ...',
  '"X" is not a weakness of Y but Y\'s strength ...',
] as const;

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
      `  2. If the student raises a point you hadn't considered and they are right, acknowledge it AT THE END of the rebuttal text — e.g. close with "On reflection, my earlier read of X was too narrow — here's the updated assessment." Do NOT lead with concession, and do NOT use a separate "concedes" field.`,
      `  3. If the student's argument has no evidentiary support OR contradicts the essay text, hold your ground and explain why. Quote the contradicting passage.`,
      `  4. Be concrete. Vague phrases like "I see your perspective" or "fair point" without evidence are forbidden.`,
      `  5. End with one open question that pushes the student to think harder about their argument — never a rhetorical question, never agreement-seeking.`,
      ``,
      ``,
      `HARD RULE 1 — your rebuttal must NEVER open with concession phrases. The`,
      `following opening patterns are FORBIDDEN: "你说得对", "I see your point",`,
      `"我之前忽略了", "Your observation is fair", "我之前把它看成... 过于保守了",`,
      `"that's a fair point", "你的挑战有道理", "我理解你的观点".`,
      ``,
      `If you genuinely concede the user's challenge, say so AT THE END of the`,
      `rebuttal, not at the start. Lead with the strongest counter-argument or`,
      `evidence-grounded distinction. The user is challenging a prior judgment —`,
      `your job is to either (a) defend the original judgment with new evidence,`,
      `or (b) update the judgment with new reasoning — not to validate the`,
      `challenge with empty agreement.`,
      ``,
      `HARD RULE 2 — your rebuttal must NEVER open with these TEMPLATED frames:`,
      `"If the AI thinks...", "如果AI认为...", "最值得商榷的是...",`,
      `"之前评估里...", "针对之前评估...", "争议点应放在...",`,
      `"我最不同意/不认同...", "What I most disagree with is...". These are`,
      `formulaic openers that read mechanical rather than evidence-driven.`,
      `Instead, lead with the CONCRETE SUBJECT of the disagreement: a verbatim`,
      `quote from the essay, a specific phrase from the prior assessment, or a`,
      `named contradiction. The first 10 words of your rebuttal must contain at`,
      `least one quoted phrase or named subject — not a meta-frame about what you`,
      `are about to argue.`,
      ``,
      `Choose a different syntactic archetype each turn — rotate among these`,
      `4 (do NOT default to one every time):`,
      `  (a) Quote + judgement adjective:    "X" understates / misreads ...`,
      `  (b) Quote + reading reframe:        A more accurate reading of "X" is ...`,
      `  (c) Quote + paragraph anchor:       The "X" in paragraph N actually accomplishes ...`,
      `  (d) Quote + tradeoff inversion:     "X" is not a weakness of Y but Y's strength ...`,
      `Defaulting to archetype (a) every turn is itself a form of templated`,
      `opener; the v3 prompt allowed (a) and the model converged on it 20/20`,
      `times — Wei flagged this as "meta-template fatigue".`,
      ``,
      `HARD RULE 3 — you must NEVER claim a school "values X" or "looks for Y"`,
      `unless you can quote a passage from the [School] context provided above.`,
      `Generic statements like "Georgetown most values leadership and public`,
      `service", "Notre Dame admires service and community spirit", "Yale wants`,
      `intellectual vitality" are FORBIDDEN — they are school-website buzzwords,`,
      `not admissions evidence. If you have no school-context quote, drop the`,
      `school-fit angle and ground the rebuttal in the essay text itself.`,
      ``,
      `HARD RULE 4 — partial-concession structural sycophancy is FORBIDDEN.`,
      `Do NOT write any of these patterns:`,
      `  - "the critique is partially valid but if taken to mean X it would be too strict"`,
      `  - "成立一部分，但若据此否定就过于严格"`,
      `  - "真正可商榷的不是 X 而是 Y"                          (front-pivot concede)`,
      `  - "说 X 可以，但 Y"                                    (allow-then-counter)`,
      `  - "I don't deny X, but ..."`,
      `  - "partially valid"`,
      `If you concede, commit to a SPECIFIC revised judgment with a quote from`,
      `the essay supporting the new reading. If you defend, defend hard with`,
      `evidence. Hedging in both directions is the structural form of sycophancy`,
      `that HARD RULE 1 was meant to block; the v2 ban on literal phrases only`,
      `closed half the leak, and v3's HR4 missed the two front-pivot variants`,
      `that Mrs. Liu (parent-trust persona) flagged in PR8.`,
      ``,
      `Output JSON ONLY, matching this schema exactly:`,
      `{`,
      `  "rebuttal": string (max 480 chars; you have a 1200-token budget total, leave room for evidence[] and openQuestion),`,
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
    `  2. 如果用户提出了一个你之前没考虑到的点并且确实有道理，请在 rebuttal 的**结尾**承认，例如以「重新审视后，我之前对 X 的判断过于狭窄——修正后的评估是……」收束。不能用让步性语句开场，也不要使用单独的 "concedes" 字段。`,
    `  3. 如果用户的论点没有证据支撑、或者与 essay 原文矛盾，请坚持你的判断并解释原因，并引用矛盾的段落。`,
    `  4. 必须具体。空话如「我理解你的观点」「你说得有道理」如果没有证据支持，禁止使用。`,
    `  5. 在结尾抛出一个能推动用户更深入思考的开放性问题，不能是修辞问句，不能是寻求认同的问句。`,
    ``,
    ``,
    `HARD RULE 1 — 反驳的开头绝不能以让步性语句作为开场。以下开头模式被严格禁止：`,
    `"你说得对", "I see your point", "我之前忽略了", "Your observation is fair",`,
    `"我之前把它看成... 过于保守了", "that's a fair point", "你的挑战有道理",`,
    `"我理解你的观点"。`,
    ``,
    `如果你确实需要对用户的挑战做出让步，把它放在反驳的结尾，而不是开头。`,
    `必须以最有力的反论或基于证据的区分作为开场。用户正在挑战之前的判断 ——`,
    `你的工作要么是 (a) 用新证据捍卫原判断，要么是 (b) 用新的推理更新判断，`,
    `而不是用空洞的认同来迎合挑战。`,
    ``,
    `HARD RULE 2 — 反驳开头绝不能使用以下「模板化」框架：`,
    `"如果AI认为..." / "如果 AI 认为...", "最值得商榷的是...",`,
    `"之前评估里...", "针对之前评估...", "争议点应放在...",`,
    `"我最不同意/不认同..."。这些都是空架子开场，读起来像八股而非有证据驱动。`,
    `正确的做法：用**具体争点**开场——从 essay 引用一句原文、从 prior_commentary`,
    `引用一个具体短语、或直接命名你要反驳的具体判断。反驳的前 10 个字必须`,
    `包含至少一个引号或具体名词，而不能是「我接下来要论证什么」的元说明。`,
    ``,
    `每一轮在以下 4 种句式原型中**轮换**（不要每轮都用同一种）：`,
    `  (a) 引用 + 判断形容词：       "X" 这一判断过窄了 / 低估了 …`,
    `  (b) 引用 + 重读改写：         关于 "X"，更准确的读法是 …`,
    `  (c) 引用 + 段落锚定：         段落 N 的 "X" 实际上完成了 …`,
    `  (d) 引用 + 取舍翻转：         "X" 不是 Y 的弱点而是 Y 的优势 …`,
    `每轮固定用 (a) 也是一种模板化——v3 prompt 允许 (a)，模型 20/20 全用了 (a)，`,
    `Wei 把这种情况标为"meta-template fatigue"。请主动旋转。`,
    ``,
    `HARD RULE 3 — 你绝不能声称某所学校「最看重 X」或「最欣赏 Y」，除非你`,
    `能从上面的 [学校] 上下文中引用一句原文。诸如「Georgetown 最看重领导力与`,
    `公共服务」、「Notre Dame 重视服务与共同体精神」、「Yale 看重学术活力」`,
    `这种话被严格禁止——这些都是学校官网话术，不是录取证据。如果没有学校上下文`,
    `引用，就放弃 school-fit 角度，把反驳锚定回 essay 原文本身。`,
    ``,
    `HARD RULE 4 — 「部分让步」式的结构性谄媚被严格禁止。`,
    `以下句式全部不准写：`,
    `  - 「成立一部分，但若据此否定就过于严格」                 (v2 抓到的)`,
    `  - 「这点有道理，但若放大就过窄」                         (v3 抓到的)`,
    `  - **「真正可商榷的不是 X 而是 Y」**                       (front-pivot 让步)`,
    `  - **「说 X 可以，但 Y」**                                 (允许-然后反驳)`,
    `  - **「不否认 X，但是 Y」**`,
    `  - **「部分成立但 ...」**`,
    `如果让步，就要对**修正后的具体判断**做出承诺，并用 essay 原文中的引用`,
    `支撑新读法；如果捍卫，就用证据硬捍卫。两头都模糊就是 v2 禁字面短语没堵住的`,
    `另一半结构性谄媚漏洞——v3 HR4 漏掉了"front-pivot"和"allow-then-counter"`,
    `两个变体，Mrs. Liu 在 PR8 抓到 2 例 (Berkeley + Stanford)。`,
    ``,
    `只输出 JSON，严格匹配以下 schema：`,
    `{`,
    `  "rebuttal": string (最多 480 字符；总 token 预算 1200，要给 evidence[] 和 openQuestion 留出空间),`,
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
  // PR6: when priorCommentary is non-null, we add a HARD structural
  // requirement that the rebuttal MUST reference a specific phrase from
  // the prior assessment. This is the wrapper's value proposition over
  // a raw ChatGPT control (PR5 found 4/5 raters flagged lumni rebuttals
  // GENERIC because they read like fresh essay reading rather than a
  // grounded continuation of the prior AI assessment).
  if (ctx.priorCommentary) {
    const pc = ctx.priorCommentary;
    lines.push(
      L
        ? '[你之前对段落 ' + pc.paragraphIndex + ' 的评价]'
        : '[Your prior assessment of paragraph ' + pc.paragraphIndex + ']',
    );
    lines.push(
      `${L ? '段落' : 'Paragraph'} ${pc.paragraphIndex} · ${pc.score}/10 · ${pc.status}`,
    );
    lines.push(`"${pc.comment}"`);
    if (pc.highlights.length > 0) {
      lines.push((L ? '亮点: ' : 'Highlights: ') + pc.highlights.join(', '));
    }
    if (pc.suggestions.length > 0) {
      lines.push((L ? '建议: ' : 'Suggestions: ') + pc.suggestions.join('; '));
    }
    lines.push('');
    // HARD structural requirement — non-negotiable when priorCommentary
    // is available. PR6.
    if (L) {
      lines.push(
        '[必读 — 反驳结构要求]',
        '上方是段落 ' +
          pc.paragraphIndex +
          ' 的**之前的 AI 评估**。用户正在挑战这个评估。你的反驳必须：',
        '  1. 从上面的之前评估中**引用一个具体短语**（quote a SPECIFIC phrase），即用户在隐式挑战的那一句（用户的挑战往往不会明确指出，你需要推断他在争论之前的哪个具体判断）。',
        '  2. 要么用新证据捍卫该具体短语，要么明确撤回它并提出修正后的解读。',
        '  3. 在 `rebuttal` 字段中通过引用或转述提及之前的评估——这是**不可商量的**。这个 wrapper 相对于裸 ChatGPT 的价值就是 prior-commentary 上下文；不使用它就失去了存在的意义。',
        '',
      );
    } else {
      lines.push(
        '[REQUIRED — rebuttal structural requirement]',
        'The prior AI assessment of paragraph ' +
          pc.paragraphIndex +
          ' is shown above. The user is challenging this assessment. Your rebuttal MUST:',
        "  1. Quote a SPECIFIC phrase from the prior assessment that the user is implicitly challenging (the user's challenge often won't name it explicitly — you infer which prior claim is in dispute).",
        '  2. Either defend that specific phrase with new evidence, OR explicitly retract it and offer the corrected reading.',
        "  3. Reference the prior assessment by paraphrase OR quote in your `rebuttal` field — this is non-negotiable. The wrapper's value over raw ChatGPT is the prior-commentary context; using it is mandatory.",
        '',
      );
    }
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

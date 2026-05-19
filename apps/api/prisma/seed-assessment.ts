#!/usr/bin/env tsx
/**
 * seed-assessment.ts — bilingual question banks for the 3 Assessment types.
 *
 * Upserts one `Assessment` row per `AssessmentType` (MBTI / HOLLAND / STRENGTH).
 * The unique key is `Assessment.type`, so this script is fully idempotent — a
 * second run re-writes the same payloads and never produces duplicate-key
 * errors. Fully offline (no network, no external files).
 *
 * `questions` JSON shape — matches what `assessment.service.ts` consumes:
 *   - MBTI / STRENGTH items:  { id, text, textZh, dimension, direction }
 *     (Likert-scored — the service applies LIKERT_OPTIONS at read time)
 *   - HOLLAND items:          { id, text, textZh, type, options[] }
 *     (each option: { value, text, textZh })
 *
 * The MBTI/HOLLAND banks here intentionally mirror the in-code definitions in
 * `src/modules/assessment/data/` so the persisted Assessment row and the
 * service's compiled question set agree. STRENGTH has no in-code definition;
 * it ships an original strengths self-assessment using the same Likert shape.
 *
 * NOTE: the live service (`getAssessment`) currently reads MBTI/HOLLAND from
 * the in-code `data/` modules, not from this row. This row is the canonical
 * DB-side record (used by `Assessment` joins, admin tooling, and any future
 * DB-backed reads) and keeps the model non-empty. STRENGTH is DB-only today.
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx prisma/seed-assessment.ts
 */
import { AssessmentType, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** A Likert-scored item (MBTI / STRENGTH). */
interface LikertItem {
  id: string;
  text: string;
  textZh: string;
  /** Scoring bucket — MBTI dichotomy or STRENGTH aptitude domain. */
  dimension: string;
  /** '+' = high score favours the first pole, '-' = favours the second. */
  direction: '+' | '-';
}

/** A RIASEC interest item (HOLLAND) with its own option scale. */
interface HollandItem {
  id: string;
  text: string;
  textZh: string;
  type: 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
  options: { value: string; text: string; textZh: string }[];
}

/** Shared 5-point agree/disagree scale for HOLLAND items. */
const HOLLAND_OPTIONS: HollandItem['options'] = [
  { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
  { value: '4', text: 'Agree', textZh: '同意' },
  { value: '3', text: 'Neutral', textZh: '中立' },
  { value: '2', text: 'Disagree', textZh: '不同意' },
  { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
];

// ───────────────────────── MBTI (Jungian type) ─────────────────────────
// 24 original items — 6 per dichotomy (3 '+' + 3 '-'). Covers E/I, S/N,
// T/F, J/P. Original wording, not the proprietary MBTI® instrument.
const MBTI_QUESTIONS: LikertItem[] = [
  // E/I — Extraversion vs Introversion
  {
    id: 'ei01',
    text: 'Meeting new people at an event leaves me feeling recharged.',
    textZh: '在活动中认识新朋友会让我感到充满活力。',
    dimension: 'EI',
    direction: '+',
  },
  {
    id: 'ei02',
    text: 'I happily speak up first in a group discussion.',
    textZh: '在小组讨论中，我乐于第一个发言。',
    dimension: 'EI',
    direction: '+',
  },
  {
    id: 'ei03',
    text: 'I think best when I can talk an idea through out loud.',
    textZh: '当我能把想法说出来时，思考得最清楚。',
    dimension: 'EI',
    direction: '+',
  },
  {
    id: 'ei04',
    text: 'After a busy social weekend I crave a quiet day alone.',
    textZh: '社交繁忙的周末后，我渴望独自安静一天。',
    dimension: 'EI',
    direction: '-',
  },
  {
    id: 'ei05',
    text: 'I prefer one deep conversation over many short ones.',
    textZh: '比起许多简短交谈，我更喜欢一次深入的对话。',
    dimension: 'EI',
    direction: '-',
  },
  {
    id: 'ei06',
    text: 'I usually rehearse my thoughts before saying them aloud.',
    textZh: '我通常会在心里先想好，再说出来。',
    dimension: 'EI',
    direction: '-',
  },
  // S/N — Sensing vs Intuition
  {
    id: 'sn01',
    text: 'I trust concrete facts more than hunches about the future.',
    textZh: '比起对未来的预感，我更信任具体的事实。',
    dimension: 'SN',
    direction: '+',
  },
  {
    id: 'sn02',
    text: 'I like clear, step-by-step instructions when learning a task.',
    textZh: '学习新任务时，我喜欢清晰的分步说明。',
    dimension: 'SN',
    direction: '+',
  },
  {
    id: 'sn03',
    text: 'I notice small practical details others overlook.',
    textZh: '我会注意到他人忽略的实际细节。',
    dimension: 'SN',
    direction: '+',
  },
  {
    id: 'sn04',
    text: 'I enjoy imagining how things could be different in the future.',
    textZh: '我喜欢想象事物在未来可能变得不同。',
    dimension: 'SN',
    direction: '-',
  },
  {
    id: 'sn05',
    text: 'I am drawn to abstract theories and big-picture patterns.',
    textZh: '我对抽象理论和整体规律很感兴趣。',
    dimension: 'SN',
    direction: '-',
  },
  {
    id: 'sn06',
    text: 'I often connect unrelated ideas into something new.',
    textZh: '我常把毫不相关的想法联结成新的东西。',
    dimension: 'SN',
    direction: '-',
  },
  // T/F — Thinking vs Feeling
  {
    id: 'tf01',
    text: 'I decide important matters with logic rather than emotion.',
    textZh: '处理重要事务时，我用逻辑而非情感来决定。',
    dimension: 'TF',
    direction: '+',
  },
  {
    id: 'tf02',
    text: 'I value a fair rule even when it feels harsh to someone.',
    textZh: '即使某条规则对某人显得严苛，我仍重视其公平性。',
    dimension: 'TF',
    direction: '+',
  },
  {
    id: 'tf03',
    text: 'I would rather be accurate than tactful when giving feedback.',
    textZh: '给反馈时，我宁愿准确也不愿一味委婉。',
    dimension: 'TF',
    direction: '+',
  },
  {
    id: 'tf04',
    text: 'I weigh how a decision will affect people’s feelings.',
    textZh: '我会衡量一个决定会如何影响他人的感受。',
    dimension: 'TF',
    direction: '-',
  },
  {
    id: 'tf05',
    text: 'Keeping group harmony matters a lot to me.',
    textZh: '维持团体的和谐对我来说很重要。',
    dimension: 'TF',
    direction: '-',
  },
  {
    id: 'tf06',
    text: 'I judge choices by my personal values as much as by logic.',
    textZh: '我用个人价值观与逻辑同等地衡量选择。',
    dimension: 'TF',
    direction: '-',
  },
  // J/P — Judging vs Perceiving
  {
    id: 'jp01',
    text: 'I like to settle plans early and stick to a schedule.',
    textZh: '我喜欢及早定好计划并按时间表执行。',
    dimension: 'JP',
    direction: '+',
  },
  {
    id: 'jp02',
    text: 'A tidy, organized workspace helps me focus.',
    textZh: '整洁有序的工作环境能帮助我集中注意力。',
    dimension: 'JP',
    direction: '+',
  },
  {
    id: 'jp03',
    text: 'I feel uneasy when a decision is left open-ended.',
    textZh: '当一个决定悬而未决时，我会感到不安。',
    dimension: 'JP',
    direction: '+',
  },
  {
    id: 'jp04',
    text: 'I like keeping my options open instead of committing early.',
    textZh: '我喜欢保持选择开放，而不是过早做出承诺。',
    dimension: 'JP',
    direction: '-',
  },
  {
    id: 'jp05',
    text: 'I adapt easily when plans change at the last minute.',
    textZh: '当计划临时改变时，我能轻松适应。',
    dimension: 'JP',
    direction: '-',
  },
  {
    id: 'jp06',
    text: 'I often do my best work in a burst near the deadline.',
    textZh: '我常在接近截止日期时爆发出最佳状态。',
    dimension: 'JP',
    direction: '-',
  },
];

// ───────────────────── HOLLAND (RIASEC interests) ──────────────────────
// 36 items — 6 per RIASEC type. Each carries its own option scale.
const HOLLAND_RAW: {
  id: string;
  type: HollandItem['type'];
  text: string;
  textZh: string;
}[] = [
  // R — Realistic
  {
    id: 'r1',
    type: 'R',
    text: 'I enjoy building, repairing, or assembling things with my hands.',
    textZh: '我喜欢动手搭建、修理或组装东西。',
  },
  {
    id: 'r2',
    type: 'R',
    text: 'I would like a job that involves working outdoors.',
    textZh: '我希望从事一份需要在户外工作的工作。',
  },
  {
    id: 'r3',
    type: 'R',
    text: 'I like operating tools, machines, or equipment.',
    textZh: '我喜欢操作工具、机器或设备。',
  },
  {
    id: 'r4',
    type: 'R',
    text: 'I prefer tasks with a clear, physical, finished result.',
    textZh: '我喜欢有明确、实体、可完成成果的任务。',
  },
  {
    id: 'r5',
    type: 'R',
    text: 'I enjoy hands-on activities more than reading about them.',
    textZh: '比起阅读，我更喜欢亲自动手去做。',
  },
  {
    id: 'r6',
    type: 'R',
    text: 'I am interested in how mechanical or electronic systems work.',
    textZh: '我对机械或电子系统如何运作很感兴趣。',
  },
  // I — Investigative
  {
    id: 'i1',
    type: 'I',
    text: 'I like solving complex problems and puzzles.',
    textZh: '我喜欢解决复杂的问题和谜题。',
  },
  {
    id: 'i2',
    type: 'I',
    text: 'I enjoy doing experiments and analyzing the results.',
    textZh: '我喜欢做实验并分析结果。',
  },
  {
    id: 'i3',
    type: 'I',
    text: 'I am curious about why things happen the way they do.',
    textZh: '我对事情为何如此发生感到好奇。',
  },
  {
    id: 'i4',
    type: 'I',
    text: 'I like reading scientific or research-based articles.',
    textZh: '我喜欢阅读科学或研究类的文章。',
  },
  {
    id: 'i5',
    type: 'I',
    text: 'I enjoy working with data, theories, and abstract ideas.',
    textZh: '我喜欢处理数据、理论和抽象概念。',
  },
  {
    id: 'i6',
    type: 'I',
    text: 'I would like a career focused on discovery and research.',
    textZh: '我希望从事以探索和研究为核心的职业。',
  },
  // A — Artistic
  {
    id: 'a1',
    type: 'A',
    text: 'I enjoy expressing myself through art, music, or writing.',
    textZh: '我喜欢通过艺术、音乐或写作来表达自己。',
  },
  {
    id: 'a2',
    type: 'A',
    text: 'I like work that lets me be original and creative.',
    textZh: '我喜欢能让我发挥原创性和创造力的工作。',
  },
  {
    id: 'a3',
    type: 'A',
    text: 'I prefer flexible, unstructured tasks over rigid routines.',
    textZh: '比起刻板的常规，我更喜欢灵活、不拘形式的任务。',
  },
  {
    id: 'a4',
    type: 'A',
    text: 'I enjoy designing, performing, or producing creative work.',
    textZh: '我喜欢设计、表演或创作具有创意的作品。',
  },
  {
    id: 'a5',
    type: 'A',
    text: 'I appreciate beauty, style, and aesthetics in my surroundings.',
    textZh: '我欣赏周围环境中的美感、风格和审美。',
  },
  {
    id: 'a6',
    type: 'A',
    text: 'I would like a career in the arts, media, or design.',
    textZh: '我希望从事艺术、媒体或设计领域的职业。',
  },
  // S — Social
  {
    id: 's1',
    type: 'S',
    text: 'I enjoy helping people learn, grow, or solve their problems.',
    textZh: '我喜欢帮助他人学习、成长或解决问题。',
  },
  {
    id: 's2',
    type: 'S',
    text: 'I like teaching, mentoring, or counseling others.',
    textZh: '我喜欢教导、指导或辅导他人。',
  },
  {
    id: 's3',
    type: 'S',
    text: 'I find it rewarding to care for or support others.',
    textZh: '照顾或支持他人让我感到有意义。',
  },
  {
    id: 's4',
    type: 'S',
    text: 'I work well in teams and enjoy cooperating with people.',
    textZh: '我在团队中表现良好，喜欢与人合作。',
  },
  {
    id: 's5',
    type: 'S',
    text: 'I am good at understanding how other people feel.',
    textZh: '我善于理解他人的感受。',
  },
  {
    id: 's6',
    type: 'S',
    text: 'I would like a job centered on serving the community.',
    textZh: '我希望从事以服务社区为核心的工作。',
  },
  // E — Enterprising
  {
    id: 'e1',
    type: 'E',
    text: 'I enjoy leading a team and persuading others toward a goal.',
    textZh: '我喜欢带领团队并说服他人朝目标前进。',
  },
  {
    id: 'e2',
    type: 'E',
    text: 'I like setting ambitious goals and competing to reach them.',
    textZh: '我喜欢设定宏大目标并通过竞争去实现。',
  },
  {
    id: 'e3',
    type: 'E',
    text: 'I am comfortable taking risks to start something new.',
    textZh: '为了开创新事物，我愿意承担风险。',
  },
  {
    id: 'e4',
    type: 'E',
    text: 'I enjoy negotiating, selling, or pitching ideas.',
    textZh: '我喜欢谈判、销售或推介想法。',
  },
  {
    id: 'e5',
    type: 'E',
    text: 'I would like to run my own business or organization.',
    textZh: '我希望经营自己的企业或组织。',
  },
  {
    id: 'e6',
    type: 'E',
    text: 'I like making decisions that influence other people.',
    textZh: '我喜欢做出能影响他人的决定。',
  },
  // C — Conventional
  {
    id: 'c1',
    type: 'C',
    text: 'I enjoy organizing information and keeping accurate records.',
    textZh: '我喜欢整理信息并保持准确的记录。',
  },
  {
    id: 'c2',
    type: 'C',
    text: 'I like clear procedures and well-defined responsibilities.',
    textZh: '我喜欢清晰的流程和明确的职责。',
  },
  {
    id: 'c3',
    type: 'C',
    text: 'I am careful, detail-oriented, and reliable with deadlines.',
    textZh: '我细心、注重细节，并能可靠地遵守期限。',
  },
  {
    id: 'c4',
    type: 'C',
    text: 'I enjoy working with numbers, budgets, or spreadsheets.',
    textZh: '我喜欢处理数字、预算或电子表格。',
  },
  {
    id: 'c5',
    type: 'C',
    text: 'I prefer a stable, predictable work routine.',
    textZh: '我喜欢稳定、可预测的工作节奏。',
  },
  {
    id: 'c6',
    type: 'C',
    text: 'I would like a structured office or administrative role.',
    textZh: '我希望从事结构化的办公室或行政工作。',
  },
];

const HOLLAND_QUESTIONS: HollandItem[] = HOLLAND_RAW.map((q) => ({
  ...q,
  options: HOLLAND_OPTIONS,
}));

// ──────────────── STRENGTH (strengths / aptitude self-test) ─────────────
// 28 original Likert items across 7 aptitude domains (4 each, 2 '+' / 2 '-').
// Domains: ANALYTICAL, COMMUNICATION, LEADERSHIP, CREATIVITY, EXECUTION,
// RESILIENCE, COLLABORATION.
const STRENGTH_QUESTIONS: LikertItem[] = [
  // ANALYTICAL
  {
    id: 'an01',
    text: 'I quickly spot patterns and logical flaws in arguments.',
    textZh: '我能迅速发现论证中的规律和逻辑漏洞。',
    dimension: 'ANALYTICAL',
    direction: '+',
  },
  {
    id: 'an02',
    text: 'I enjoy breaking a hard problem into smaller pieces.',
    textZh: '我喜欢把难题拆解成更小的部分。',
    dimension: 'ANALYTICAL',
    direction: '+',
  },
  {
    id: 'an03',
    text: 'I tend to make decisions on instinct without analysis.',
    textZh: '我倾向于凭直觉做决定，而不加分析。',
    dimension: 'ANALYTICAL',
    direction: '-',
  },
  {
    id: 'an04',
    text: 'I lose interest when a task requires careful reasoning.',
    textZh: '当任务需要缜密推理时，我会失去兴趣。',
    dimension: 'ANALYTICAL',
    direction: '-',
  },
  // COMMUNICATION
  {
    id: 'co01',
    text: 'I can explain complex ideas clearly to different audiences.',
    textZh: '我能把复杂的想法清晰地讲给不同的听众。',
    dimension: 'COMMUNICATION',
    direction: '+',
  },
  {
    id: 'co02',
    text: 'People often say I write and speak persuasively.',
    textZh: '别人常说我写作和表达很有说服力。',
    dimension: 'COMMUNICATION',
    direction: '+',
  },
  {
    id: 'co03',
    text: 'I struggle to put my thoughts into words for others.',
    textZh: '我很难把自己的想法用语言表达给他人。',
    dimension: 'COMMUNICATION',
    direction: '-',
  },
  {
    id: 'co04',
    text: 'I avoid presenting or speaking in front of a group.',
    textZh: '我会回避在众人面前演讲或发言。',
    dimension: 'COMMUNICATION',
    direction: '-',
  },
  // LEADERSHIP
  {
    id: 'le01',
    text: 'I naturally take responsibility when a group needs direction.',
    textZh: '当团队需要方向时，我会自然地承担起责任。',
    dimension: 'LEADERSHIP',
    direction: '+',
  },
  {
    id: 'le02',
    text: 'I can motivate others to commit to a shared goal.',
    textZh: '我能激励他人为共同目标全力以赴。',
    dimension: 'LEADERSHIP',
    direction: '+',
  },
  {
    id: 'le03',
    text: 'I prefer to follow rather than guide a team.',
    textZh: '比起带领团队，我更愿意跟随。',
    dimension: 'LEADERSHIP',
    direction: '-',
  },
  {
    id: 'le04',
    text: 'I feel uncomfortable making decisions for other people.',
    textZh: '替他人做决定会让我感到不自在。',
    dimension: 'LEADERSHIP',
    direction: '-',
  },
  // CREATIVITY
  {
    id: 'cr01',
    text: 'I often come up with original ideas and approaches.',
    textZh: '我常能想出原创的点子和做法。',
    dimension: 'CREATIVITY',
    direction: '+',
  },
  {
    id: 'cr02',
    text: 'I enjoy imagining new possibilities others have not considered.',
    textZh: '我喜欢设想他人尚未考虑到的新可能。',
    dimension: 'CREATIVITY',
    direction: '+',
  },
  {
    id: 'cr03',
    text: 'I prefer proven methods over experimenting with new ones.',
    textZh: '比起尝试新方法，我更偏好已验证的做法。',
    dimension: 'CREATIVITY',
    direction: '-',
  },
  {
    id: 'cr04',
    text: 'I find open-ended, imaginative tasks frustrating.',
    textZh: '开放式、需要想象力的任务让我感到沮丧。',
    dimension: 'CREATIVITY',
    direction: '-',
  },
  // EXECUTION
  {
    id: 'ex01',
    text: 'I reliably finish what I start, even when it gets tedious.',
    textZh: '即使任务变得枯燥，我也能可靠地善始善终。',
    dimension: 'EXECUTION',
    direction: '+',
  },
  {
    id: 'ex02',
    text: 'I plan my time well and meet deadlines consistently.',
    textZh: '我善于规划时间并能持续按期完成任务。',
    dimension: 'EXECUTION',
    direction: '+',
  },
  {
    id: 'ex03',
    text: 'I often leave projects unfinished when motivation fades.',
    textZh: '当动力减退时，我常常半途而废。',
    dimension: 'EXECUTION',
    direction: '-',
  },
  {
    id: 'ex04',
    text: 'I procrastinate until tasks become urgent.',
    textZh: '我会拖延，直到任务变得紧迫。',
    dimension: 'EXECUTION',
    direction: '-',
  },
  // RESILIENCE
  {
    id: 're01',
    text: 'I bounce back quickly after a setback or failure.',
    textZh: '遭遇挫折或失败后，我能很快重新振作。',
    dimension: 'RESILIENCE',
    direction: '+',
  },
  {
    id: 're02',
    text: 'I stay calm and focused under pressure.',
    textZh: '在压力之下，我能保持冷静和专注。',
    dimension: 'RESILIENCE',
    direction: '+',
  },
  {
    id: 're03',
    text: 'Criticism tends to discourage me for a long time.',
    textZh: '批评往往会让我长时间感到气馁。',
    dimension: 'RESILIENCE',
    direction: '-',
  },
  {
    id: 're04',
    text: 'I find it hard to recover after things go wrong.',
    textZh: '当事情出错后，我很难恢复过来。',
    dimension: 'RESILIENCE',
    direction: '-',
  },
  // COLLABORATION
  {
    id: 'cl01',
    text: 'I work well with others and value their contributions.',
    textZh: '我善于与他人合作，并重视他们的贡献。',
    dimension: 'COLLABORATION',
    direction: '+',
  },
  {
    id: 'cl02',
    text: 'I willingly share credit and support my teammates.',
    textZh: '我乐于分享荣誉并支持我的队友。',
    dimension: 'COLLABORATION',
    direction: '+',
  },
  {
    id: 'cl03',
    text: 'I get more done working alone than in a team.',
    textZh: '我独自工作比在团队中完成得更多。',
    dimension: 'COLLABORATION',
    direction: '-',
  },
  {
    id: 'cl04',
    text: 'I find it hard to compromise with others on a plan.',
    textZh: '我很难在计划上与他人妥协。',
    dimension: 'COLLABORATION',
    direction: '-',
  },
];

interface AssessmentSeed {
  type: AssessmentType;
  title: string;
  titleZh: string;
  questions: unknown[];
}

const ASSESSMENTS: AssessmentSeed[] = [
  {
    type: AssessmentType.MBTI,
    title: 'Jungian Type Personality Test',
    titleZh: '荣格类型性格测试',
    questions: MBTI_QUESTIONS,
  },
  {
    type: AssessmentType.HOLLAND,
    title: 'Holland Career Interest Test',
    titleZh: '霍兰德职业兴趣测试',
    questions: HOLLAND_QUESTIONS,
  },
  {
    type: AssessmentType.STRENGTH,
    title: 'Strengths & Aptitude Self-Assessment',
    titleZh: '优势与能力倾向自评',
    questions: STRENGTH_QUESTIONS,
  },
];

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function main() {
  console.log('\n🧭 Seeding Assessment question banks');
  console.log('='.repeat(60));

  for (const seed of ASSESSMENTS) {
    const questions = toJson(seed.questions);
    const result = await prisma.assessment.upsert({
      where: { type: seed.type },
      create: {
        type: seed.type,
        title: seed.title,
        titleZh: seed.titleZh,
        questions,
      },
      update: {
        title: seed.title,
        titleZh: seed.titleZh,
        questions,
      },
    });
    console.log(
      `✅ ${seed.type.padEnd(8)} — ${seed.questions.length} questions (${result.id})`,
    );
  }

  const total = await prisma.assessment.count();
  console.log('='.repeat(60));
  console.log(`📊 Assessment rows: ${total}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('✗ seed-assessment failed:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

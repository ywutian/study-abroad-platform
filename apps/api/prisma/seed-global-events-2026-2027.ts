/**
 * Seed GlobalEvent rows for the 2026-2027 application cycle.
 *
 * Covers:
 *   - Common App opening
 *   - FAFSA / CSS Profile opening
 *   - SAT 7 test dates (2026-08 → 2027-06)
 *   - ACT 7 test dates (2026-09 → 2027-07)
 *   - AP exam windows (May 2027 + late testing)
 *   - IB Diploma May 2027 exam period
 *   - TOEFL / IELTS year-round availability markers
 *   - UC application window milestones
 *   - National Decision Day
 *
 * All entries are upserted on (title, year). Idempotent. Sourced from
 * official platform pages on 2026-05-14.
 *
 * Run standalone:
 *   npx tsx apps/api/prisma/seed-global-events-2026-2027.ts
 */

import { GlobalEventCategory, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CYCLE_YEAR = 2027;

interface EventSeed {
  title: string;
  titleZh?: string;
  category: GlobalEventCategory;
  eventDate: string; // ISO YYYY-MM-DD
  registrationDeadline?: string;
  description?: string;
  descriptionZh?: string;
  url: string;
  year: number;
  isRecurring?: boolean;
}

export const GLOBAL_EVENT_SEEDS_2026_2027: ReadonlyArray<EventSeed> = [
  // ── Application platforms ─────────────────────────────────────────────
  {
    title: 'Common App opens for 2026-2027 cycle',
    titleZh: 'Common App 2026-2027 申请季开放',
    category: GlobalEventCategory.APPLICATION,
    eventDate: '2026-08-01',
    description:
      'Common Application opens for fall-2027 first-year applicants. Essay prompts unchanged from 2025-2026.',
    descriptionZh:
      'Common Application 对 2027 fall 入学申请者开放，文书 prompts 与 2025-2026 一致',
    url: 'https://www.commonapp.org/blog/reminder-common-app-system-refresh-2/',
    year: CYCLE_YEAR,
  },
  {
    title: 'UC Application opens',
    titleZh: 'UC 加州大学申请系统开放',
    category: GlobalEventCategory.APPLICATION,
    eventDate: '2026-08-01',
    description:
      'University of California application opens for first-year applicants.',
    descriptionZh: '加州大学系统申请通道开放',
    url: 'https://admission.universityofcalifornia.edu/apply-now.html',
    year: CYCLE_YEAR,
  },
  {
    title: 'UC Application submission window opens',
    titleZh: 'UC 加州大学申请提交窗口开放',
    category: GlobalEventCategory.APPLICATION,
    eventDate: '2026-10-01',
    url: 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/dates-and-deadlines.html',
    year: CYCLE_YEAR,
  },
  {
    title: 'UC Application deadline (all campuses)',
    titleZh: 'UC 加州大学申请截止（所有校区）',
    category: GlobalEventCategory.APPLICATION,
    eventDate: '2026-12-01',
    description: '11:59 PM Pacific Time across all 9 UC campuses.',
    descriptionZh: '加州大学申请统一截止日（太平洋时间 23:59）',
    url: 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/dates-and-deadlines.html',
    year: CYCLE_YEAR,
  },
  {
    title: "National College Decision Day (Candidate's Reply Date)",
    titleZh: '全美录取决定日（学生回复截止）',
    category: GlobalEventCategory.APPLICATION,
    eventDate: '2027-05-01',
    description:
      'NACAC standard: admitted students must commit by May 1 (or the next business day).',
    descriptionZh: 'NACAC 行业惯例：被录取学生需在 5/1 前缴纳定金确认入学',
    url: 'https://www.nacacnet.org/',
    year: CYCLE_YEAR,
  },

  // ── Financial Aid ─────────────────────────────────────────────────────
  {
    title: 'FAFSA opens for 2026-2027 cycle',
    titleZh: 'FAFSA 2026-2027 申请季开放',
    category: GlobalEventCategory.FINANCIAL_AID,
    eventDate: '2025-09-24',
    description:
      'U.S. Department of Education launched the 2026-2027 FAFSA early (2025-09-24); federal deadline 2027-06-30.',
    descriptionZh:
      '美国教育部于 2025-09-24 提前启动 2026-2027 FAFSA，是 FAFSA 项目史上最早开放；联邦截止日 2027-06-30',
    url: 'https://studentaid.gov/announcements-events/fafsa-support',
    year: CYCLE_YEAR,
  },
  {
    title: 'CSS Profile opens for 2026-2027 cycle',
    titleZh: 'CSS Profile 2026-2027 申请季开放',
    category: GlobalEventCategory.FINANCIAL_AID,
    eventDate: '2025-10-01',
    description:
      'College Board CSS Profile opens. Per-school deadlines vary (ED/EA typically mid-November, RD typically Feb-Mar).',
    descriptionZh:
      'CSS Profile 开放。各校截止日不同，ED/EA 通常 11 月中，RD 通常 2-3 月',
    url: 'https://cssprofile.collegeboard.org/',
    year: CYCLE_YEAR,
  },

  // ── SAT (7 dates, 2026-08 → 2027-06) ──────────────────────────────────
  ...[
    '2026-08-22',
    '2026-10-03',
    '2026-11-07',
    '2026-12-05',
    '2027-03-06',
    '2027-05-01',
    '2027-06-05',
  ].map((d) => ({
    title: `SAT — ${d}`,
    titleZh: `SAT 考试 ${d}`,
    category: GlobalEventCategory.TEST,
    eventDate: d,
    url: 'https://satsuite.collegeboard.org/sat/dates-deadlines',
    year: Number(d.slice(0, 4)),
    isRecurring: false,
  })),

  // ── ACT (7 dates, 2026-09 → 2027-07) ──────────────────────────────────
  ...[
    { d: '2026-09-19', tag: 'CONFIRMED' },
    { d: '2026-10-24', tag: 'TENTATIVE_BASED_ON_PRIOR_YEAR' },
    { d: '2026-12-12', tag: 'CONFIRMED' },
    { d: '2027-02-27', tag: 'CONFIRMED' },
    { d: '2027-04-10', tag: 'CONFIRMED' },
    { d: '2027-06-12', tag: 'CONFIRMED' },
    { d: '2027-07-10', tag: 'CONFIRMED' },
  ].map(({ d }) => ({
    title: `ACT — ${d}`,
    titleZh: `ACT 考试 ${d}`,
    category: GlobalEventCategory.TEST,
    eventDate: d,
    url: 'https://www.act.org/content/act/en/products-and-services/the-act/registration/test-dates.html',
    year: Number(d.slice(0, 4)),
    isRecurring: false,
  })),

  // ── AP (May 2027) — two-week window starts; we record the start of each ──
  {
    title: 'AP Exams Week 1 starts',
    titleZh: 'AP 考试第一周开始',
    category: GlobalEventCategory.TEST,
    eventDate: '2027-05-03',
    description:
      'May 2027 AP Exam Week 1 typically runs Mon-Fri. Late testing window typically May 19-23.',
    descriptionZh: '2027 年 5 月 AP 考试第一周（周一至周五）',
    url: 'https://apstudents.collegeboard.org/exam-dates',
    year: 2027,
  },
  {
    title: 'AP Exams Week 2 starts',
    titleZh: 'AP 考试第二周开始',
    category: GlobalEventCategory.TEST,
    eventDate: '2027-05-10',
    url: 'https://apstudents.collegeboard.org/exam-dates',
    year: 2027,
  },

  // ── IB Diploma May 2027 ───────────────────────────────────────────────
  {
    title: 'IB Diploma May 2027 exam period starts',
    titleZh: 'IB 文凭课程 2027 年 5 月考试期开始',
    category: GlobalEventCategory.TEST,
    eventDate: '2027-04-26',
    description:
      'IB Diploma Programme global exam period runs 2027-04-26 to 2027-05-21. May 1 is the only global holiday.',
    descriptionZh:
      'IB 文凭课程 2027 年 5 月全球考试期，4-26 至 5-21；5 月 1 日为唯一全球假日',
    url: 'https://ibo.org/programmes/diploma-programme/assessment-and-exams/exam-schedule/',
    year: 2027,
  },

  // ── TOEFL / IELTS year-round markers (single event per platform) ──────
  {
    title: 'TOEFL iBT — year-round availability for 2026-2027 cycle',
    titleZh: 'TOEFL iBT 全年开放（2026-2027 申请季）',
    category: GlobalEventCategory.TEST,
    eventDate: '2026-08-01',
    description:
      'ETS offers 170+ test-center dates plus Home Edition 24/7. The redesigned TOEFL iBT launched 2026-01-21.',
    descriptionZh:
      'ETS 全年提供 170+ 考点日期 + 24/7 Home Edition；2026-01-21 起启用新版 TOEFL iBT',
    url: 'https://www.ets.org/toefl/test-takers/ibt/schedule.html',
    year: CYCLE_YEAR,
  },
  {
    title: 'IELTS — year-round availability for 2026-2027 cycle',
    titleZh: 'IELTS 全年开放（2026-2027 申请季）',
    category: GlobalEventCategory.TEST,
    eventDate: '2026-08-01',
    description:
      'Computer-delivered IELTS available almost daily; paper-based typically 4 sessions per month.',
    descriptionZh: '机考 IELTS 几乎每天开放；纸质 IELTS 通常每月 4 场',
    url: 'https://www.ielts.org/book-a-test/find-a-test-location-and-dates',
    year: CYCLE_YEAR,
  },
];

export async function seedGlobalEvents20262027(
  prismaClient: PrismaClient = prisma,
): Promise<{ upserted: number }> {
  let upserted = 0;

  for (const ev of GLOBAL_EVENT_SEEDS_2026_2027) {
    // No natural unique constraint on (title, year), so we manually look up.
    const existing = await prismaClient.globalEvent.findFirst({
      where: { title: ev.title, year: ev.year },
      select: { id: true },
    });

    const data = {
      title: ev.title,
      titleZh: ev.titleZh ?? null,
      category: ev.category,
      eventDate: new Date(`${ev.eventDate}T00:00:00Z`),
      registrationDeadline: ev.registrationDeadline
        ? new Date(`${ev.registrationDeadline}T00:00:00Z`)
        : null,
      description: ev.description ?? null,
      descriptionZh: ev.descriptionZh ?? null,
      url: ev.url,
      year: ev.year,
      isRecurring: ev.isRecurring ?? false,
      isActive: true,
    };

    if (existing) {
      await prismaClient.globalEvent.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prismaClient.globalEvent.create({ data });
    }
    upserted++;
  }

  return { upserted };
}

async function main() {
  console.log(
    `🌐 Seeding GlobalEvent rows for the ${CYCLE_YEAR - 1}-${CYCLE_YEAR} application cycle...\n`,
  );
  const { upserted } = await seedGlobalEvents20262027();
  console.log(`✅ Upserted ${upserted} global event row(s)`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

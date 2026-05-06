/**
 * Maps free-text major inputs to canonical CIP codes.
 * CIP = Classification of Instructional Programs (US Dept of Education).
 *
 * IMPORTANT: Codes are stored as 6-digit dotted format (e.g. "11.0101")
 * to match the SchoolProgram.cipCode column populated from College
 * Scorecard / CDS Section J. The 4-digit format used here historically
 * caused all SchoolProgram lookups to silently return 0 rows — keeping
 * data-driven major rates dormant. Fixed: 2026-05.
 *
 * Coverage in DB (top entries by school count):
 *   14.0101 Engineering    234 schools
 *   11.0101 Computer Sci   233
 *   26.0101 Biology        231
 *   51.3801 Nursing        223
 *   50.0701 Fine Arts      222
 *   52.0201 Business       222
 *   42.0101 Psychology     222
 */

export const MAJOR_ALIASES: Record<string, string> = {
  // 11.0101 — Computer Science (most-covered competitive major)
  'computer science': '11.0101',
  cs: '11.0101',
  'comp sci': '11.0101',
  compsci: '11.0101',
  '计算机科学': '11.0101',
  '计算机': '11.0101',

  // 14.0101 — Engineering, General
  engineering: '14.0101',
  'general engineering': '14.0101',
  '工程': '14.0101',

  // 14.1001 / 14.0901 — Electrical / Computer Engineering
  // (Most schools roll these up under 14.0101 in our DB; fall back)
  'electrical engineering': '14.0101',
  ece: '14.0101',
  ee: '14.0101',
  '电子工程': '14.0101',
  '电气工程': '14.0101',
  'computer engineering': '14.0101',

  // 14.1901 — Mechanical Engineering (rolled into 14.0101 in DB)
  'mechanical engineering': '14.0101',
  'mech eng': '14.0101',
  '机械工程': '14.0101',

  // 14.0501 — Biomedical Engineering (rolled into 14.0101)
  'biomedical engineering': '14.0101',
  bme: '14.0101',
  '生物医学工程': '14.0101',

  // 14.0701 — Chemical Engineering (rolled into 14.0101)
  'chemical engineering': '14.0101',
  '化学工程': '14.0101',

  // 52.0201 — Business Administration
  business: '52.0201',
  'business administration': '52.0201',
  '商科': '52.0201',
  '商业': '52.0201',
  '工商管理': '52.0201',
  finance: '52.0201',
  '金融': '52.0201',

  // 45.0601 — Economics (closest in DB is 45.0101 Social Sciences)
  economics: '45.0101',
  econ: '45.0101',
  '经济学': '45.0101',
  '经济': '45.0101',

  // 26.0101 — Biology / Life Sciences
  biology: '26.0101',
  bio: '26.0101',
  '生物': '26.0101',
  '生物学': '26.0101',

  // 51.3801 — Nursing
  nursing: '51.3801',
  '护理': '51.3801',

  // 27.0101 — Mathematics / Physical Sciences (covers Math + Physics in DB)
  physics: '27.0101',
  '物理': '27.0101',
  '物理学': '27.0101',
  mathematics: '27.0101',
  math: '27.0101',
  '数学': '27.0101',

  // 42.0101 — Psychology
  psychology: '42.0101',
  psych: '42.0101',
  '心理学': '42.0101',

  // 45.0101 — Social Sciences (Political Science, History, etc.)
  'political science': '45.0101',
  'poli sci': '45.0101',
  '政治学': '45.0101',

  // 09.0401 — Communications / Journalism (not heavily seeded; falls back)
  communications: '09.0401',
  journalism: '09.0401',
  '传媒': '09.0401',
  '新闻': '09.0401',

  // 51.2201 — Public Health
  'pre-med': '51.2201',
  premed: '51.2201',
  '医学预科': '51.2201',
  'public health': '51.2201',
  '公共卫生': '51.2201',

  // 11.0101 — Data Science (rolled into CS in our DB)
  'data science': '11.0101',
  '数据科学': '11.0101',

  // 11.0101 — Information Technology (rolled into CS)
  'information technology': '11.0101',
  '信息技术': '11.0101',

  // 24.0101 — Liberal Arts / Humanities (covers History, English, Lit)
  history: '24.0101',
  '历史': '24.0101',
  '历史学': '24.0101',
  english: '24.0101',
  literature: '24.0101',
  '英语': '24.0101',
  '文学': '24.0101',

  // 27.0101 — Chemistry (rolled into Math/Physical Sciences in DB)
  chemistry: '27.0101',
  chem: '27.0101',
  '化学': '27.0101',

  // 04.0901 — Architecture
  architecture: '04.0901',
  '建筑': '04.0901',
  '建筑学': '04.0901',

  // 13.0101 — Education
  education: '13.0101',
  '教育': '13.0101',
  '教育学': '13.0101',

  // 50.0701 — Fine and Studio Arts
  'fine arts': '50.0701',
  art: '50.0701',
  '艺术': '50.0701',
  '美术': '50.0701',
};

/** CIP code → canonical English + Chinese names */
export const CIP_NAMES: Record<string, { en: string; zh: string }> = {
  '11.0101': { en: 'Computer Science', zh: '计算机科学' },
  '14.0101': { en: 'Engineering', zh: '工程' },
  '52.0201': { en: 'Business Administration', zh: '商科' },
  '45.0101': { en: 'Social Sciences / Economics', zh: '社会科学' },
  '26.0101': { en: 'Biology', zh: '生物学' },
  '51.3801': { en: 'Nursing', zh: '护理' },
  '27.0101': { en: 'Math / Physical Sciences', zh: '数学与物理科学' },
  '42.0101': { en: 'Psychology', zh: '心理学' },
  '24.0101': { en: 'Liberal Arts / Humanities', zh: '人文与文科' },
  '09.0401': { en: 'Communications', zh: '传媒' },
  '51.2201': { en: 'Public Health / Pre-Med', zh: '公共卫生与医学预科' },
  '04.0901': { en: 'Architecture', zh: '建筑学' },
  '13.0101': { en: 'Education', zh: '教育学' },
  '50.0701': { en: 'Fine Arts', zh: '美术' },
};

/**
 * Resolve free-text major input to a 6-digit dotted CIP code (e.g. "11.0101").
 * Returns null if no match found.
 *
 * The output format matches School.programs[].cipCode in the DB so callers
 * can `prisma.schoolProgram.findFirst({ where: { schoolId, cipCode } })`.
 */
export function resolveMajorToCip(targetMajor: string): string | null {
  const normalized = targetMajor.trim().toLowerCase();
  if (!normalized) return null;

  // Exact match
  if (MAJOR_ALIASES[normalized]) return MAJOR_ALIASES[normalized];

  // Substring match: check if input contains an alias or alias contains input
  for (const [alias, cip] of Object.entries(MAJOR_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) return cip;
  }

  return null;
}

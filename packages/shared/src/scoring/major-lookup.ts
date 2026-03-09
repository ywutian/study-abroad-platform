/**
 * Maps free-text major inputs to canonical CIP codes.
 * CIP = Classification of Instructional Programs (US Dept of Education).
 */

export const MAJOR_ALIASES: Record<string, string> = {
  // CIP 1107 - Computer Science
  'computer science': '1107',
  cs: '1107',
  'comp sci': '1107',
  compsci: '1107',
  '\u8BA1\u7B97\u673A\u79D1\u5B66': '1107',
  '\u8BA1\u7B97\u673A': '1107',

  // CIP 1401 - Engineering (General)
  engineering: '1401',
  'general engineering': '1401',
  '\u5DE5\u7A0B': '1401',

  // CIP 1410 - Electrical / Computer Engineering
  'electrical engineering': '1410',
  ece: '1410',
  ee: '1410',
  '\u7535\u5B50\u5DE5\u7A0B': '1410',
  '\u7535\u6C14\u5DE5\u7A0B': '1410',
  'computer engineering': '1410',

  // CIP 1419 - Mechanical Engineering
  'mechanical engineering': '1419',
  'mech eng': '1419',
  '\u673A\u68B0\u5DE5\u7A0B': '1419',

  // CIP 1409 - Biomedical Engineering
  'biomedical engineering': '1409',
  bme: '1409',
  '\u751F\u7269\u533B\u5B66\u5DE5\u7A0B': '1409',

  // CIP 1408 - Chemical Engineering
  'chemical engineering': '1408',
  '\u5316\u5B66\u5DE5\u7A0B': '1408',

  // CIP 5202 - Business
  business: '5202',
  'business administration': '5202',
  '\u5546\u79D1': '5202',
  '\u5546\u4E1A': '5202',
  '\u5DE5\u5546\u7BA1\u7406': '5202',
  finance: '5202',
  '\u91D1\u878D': '5202',

  // CIP 4501 - Economics
  economics: '4501',
  econ: '4501',
  '\u7ECF\u6D4E\u5B66': '4501',
  '\u7ECF\u6D4E': '4501',

  // CIP 2601 - Biology
  biology: '2601',
  bio: '2601',
  '\u751F\u7269': '2601',
  '\u751F\u7269\u5B66': '2601',

  // CIP 5110 - Nursing
  nursing: '5110',
  '\u62A4\u7406': '5110',

  // CIP 4002 - Physics
  physics: '4002',
  '\u7269\u7406': '4002',
  '\u7269\u7406\u5B66': '4002',

  // CIP 2701 - Mathematics
  mathematics: '2701',
  math: '2701',
  '\u6570\u5B66': '2701',

  // CIP 4201 - Psychology
  psychology: '4201',
  psych: '4201',
  '\u5FC3\u7406\u5B66': '4201',

  // CIP 2305 - Political Science
  'political science': '2305',
  'poli sci': '2305',
  '\u653F\u6CBB\u5B66': '2305',

  // CIP 0904 - Communications / Journalism
  communications: '0904',
  journalism: '0904',
  '\u4F20\u5A92': '0904',
  '\u65B0\u95FB': '0904',

  // CIP 5003 - Pre-Med / Health
  'pre-med': '5003',
  premed: '5003',
  '\u533B\u5B66\u9884\u79D1': '5003',

  // CIP 5004 - Data Science
  'data science': '5004',
  '\u6570\u636E\u79D1\u5B66': '5004',

  // CIP 1101 - Information Technology
  'information technology': '1101',
  '\u4FE1\u606F\u6280\u672F': '1101',

  // CIP 2304 - History
  history: '2304',
  '\u5386\u53F2': '2304',
  '\u5386\u53F2\u5B66': '2304',

  // CIP 2302 - English / Literature
  english: '2302',
  literature: '2302',
  '\u82F1\u8BED': '2302',
  '\u6587\u5B66': '2302',

  // CIP 4005 - Chemistry
  chemistry: '4005',
  chem: '4005',
  '\u5316\u5B66': '4005',

  // CIP 0401 - Architecture
  architecture: '0401',
  '\u5EFA\u7B51': '0401',
  '\u5EFA\u7B51\u5B66': '0401',

  // CIP 5003 - Public Health
  'public health': '5003',
  '\u516C\u5171\u5353\u751F': '5003',

  // CIP 1301 - Education
  education: '1301',
  '\u6559\u80B2': '1301',
  '\u6559\u80B2\u5B66': '1301',

  // CIP 5001 - Arts
  'fine arts': '5001',
  art: '5001',
  '\u827A\u672F': '5001',
  '\u7F8E\u672F': '5001',
};

/** CIP code → canonical English + Chinese names */
export const CIP_NAMES: Record<string, { en: string; zh: string }> = {
  '1107': { en: 'Computer Science', zh: '\u8BA1\u7B97\u673A\u79D1\u5B66' },
  '1401': { en: 'Engineering', zh: '\u5DE5\u7A0B' },
  '1410': { en: 'Electrical Engineering', zh: '\u7535\u5B50\u5DE5\u7A0B' },
  '1419': { en: 'Mechanical Engineering', zh: '\u673A\u68B0\u5DE5\u7A0B' },
  '1409': { en: 'Biomedical Engineering', zh: '\u751F\u7269\u533B\u5B66\u5DE5\u7A0B' },
  '1408': { en: 'Chemical Engineering', zh: '\u5316\u5B66\u5DE5\u7A0B' },
  '5202': { en: 'Business', zh: '\u5546\u79D1' },
  '4501': { en: 'Economics', zh: '\u7ECF\u6D4E\u5B66' },
  '2601': { en: 'Biology', zh: '\u751F\u7269\u5B66' },
  '5110': { en: 'Nursing', zh: '\u62A4\u7406' },
  '4002': { en: 'Physics', zh: '\u7269\u7406\u5B66' },
  '2701': { en: 'Mathematics', zh: '\u6570\u5B66' },
  '4201': { en: 'Psychology', zh: '\u5FC3\u7406\u5B66' },
  '2305': { en: 'Political Science', zh: '\u653F\u6CBB\u5B66' },
  '0904': { en: 'Communications', zh: '\u4F20\u5A92' },
  '5003': { en: 'Pre-Med / Health', zh: '\u533B\u5B66\u9884\u79D1' },
  '5004': { en: 'Data Science', zh: '\u6570\u636E\u79D1\u5B66' },
  '1101': { en: 'Information Technology', zh: '\u4FE1\u606F\u6280\u672F' },
  '2304': { en: 'History', zh: '\u5386\u53F2\u5B66' },
  '2302': { en: 'English / Literature', zh: '\u6587\u5B66' },
  '4005': { en: 'Chemistry', zh: '\u5316\u5B66' },
  '0401': { en: 'Architecture', zh: '\u5EFA\u7B51\u5B66' },
  '1301': { en: 'Education', zh: '\u6559\u80B2\u5B66' },
  '5001': { en: 'Fine Arts', zh: '\u7F8E\u672F' },
};

/**
 * Resolve free-text major input to a 4-digit CIP code.
 * Returns null if no match found.
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

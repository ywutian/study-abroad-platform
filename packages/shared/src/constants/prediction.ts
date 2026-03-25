/**
 * Major classification constants and utilities for personalized prediction suggestions.
 *
 * Shared between backend (suggestion generation) and frontend (suggestion categorization).
 * Adding a program here automatically makes it categorizable in the frontend SuggestionsPanel.
 */

export type MajorCategory =
  | 'STEM'
  | 'CS'
  | 'HUMANITIES'
  | 'BUSINESS'
  | 'ARTS'
  | 'SOCIAL_SCIENCE'
  | 'PRE_MED'
  | 'ENGINEERING'
  | 'GENERAL';

export interface ProgramEntry {
  name: string;
  zh: string;
}

export const MAJOR_CATEGORY_PROGRAMS: Record<
  MajorCategory,
  { summer: ProgramEntry[]; competition: ProgramEntry[] }
> = {
  STEM: {
    summer: [
      { name: 'RSI', zh: '研究科学学院' }, // verified 2026-03
      { name: 'Clark Scholars', zh: 'Clark Scholars' }, // verified 2026-03
      { name: 'SSTP', zh: 'SSTP' }, // verified 2026-03
    ],
    competition: [
      { name: 'USAMO', zh: 'USAMO' },
      { name: 'USAPhO', zh: 'USAPhO' },
      { name: 'USABO', zh: 'USABO' },
      { name: 'Science Olympiad', zh: '科学奥林匹克' },
    ],
  },
  CS: {
    summer: [
      { name: 'MITES', zh: 'MIT MITES' }, // verified 2026-03
      { name: 'Google CSSI', zh: 'Google CSSI' }, // verified 2026-03
      { name: 'COSMOS', zh: 'COSMOS' }, // verified 2026-03
    ],
    competition: [
      { name: 'USACO', zh: 'USACO' },
      { name: 'ACSL', zh: 'ACSL' },
    ],
  },
  HUMANITIES: {
    summer: [
      { name: 'TASP', zh: 'TASP (Telluride)' }, // verified 2026-03
      { name: 'YYGS', zh: '耶鲁全球青年学者' }, // verified 2026-03
      { name: 'Iowa Young Writers', zh: 'Iowa 青年作家工坊' }, // verified 2026-03
    ],
    competition: [
      { name: 'Scholastic Art & Writing', zh: 'Scholastic 写作奖' },
      { name: 'John Locke Essay', zh: 'John Locke 论文竞赛' },
      { name: 'Concord Review', zh: 'Concord Review' },
    ],
  },
  BUSINESS: {
    summer: [
      { name: 'LaunchX', zh: 'LaunchX 创业项目' }, // verified 2026-03
      { name: 'Wharton LBW', zh: 'Wharton 领导力项目' }, // verified 2026-03
    ],
    competition: [
      { name: 'DECA', zh: 'DECA' },
      { name: 'FBLA', zh: 'FBLA' },
      { name: 'Diamond Challenge', zh: 'Diamond Challenge' },
    ],
  },
  ARTS: {
    summer: [
      { name: 'Interlochen', zh: 'Interlochen 艺术营' }, // verified 2026-03
      { name: 'RISD Pre-College', zh: 'RISD 预科' }, // verified 2026-03
    ],
    competition: [
      { name: 'Scholastic Art Awards', zh: 'Scholastic 艺术奖' },
      { name: 'YoungArts', zh: 'YoungArts' },
    ],
  },
  SOCIAL_SCIENCE: {
    summer: [
      { name: 'YYGS', zh: '耶鲁全球青年学者' }, // verified 2026-03
      { name: 'SSHI', zh: 'Stanford 人文学院暑期' }, // verified 2026-03
    ],
    competition: [
      { name: 'National History Day', zh: 'National History Day' },
      { name: 'We The People', zh: 'We The People' },
      { name: 'John Locke Essay', zh: 'John Locke 论文竞赛' },
    ],
  },
  PRE_MED: {
    summer: [
      { name: 'NIH SIP', zh: 'NIH 暑期实习' }, // verified 2026-03
      { name: 'SSTP', zh: 'SSTP' }, // verified 2026-03
    ],
    competition: [
      { name: 'USABO', zh: 'USABO' },
      { name: 'Science Olympiad', zh: '科学奥林匹克' },
      { name: 'HOSA', zh: 'HOSA' },
    ],
  },
  ENGINEERING: {
    summer: [
      { name: 'MITES', zh: 'MIT MITES' }, // verified 2026-03
      { name: 'COSMOS', zh: 'COSMOS' }, // verified 2026-03
    ],
    competition: [
      { name: 'Science Olympiad', zh: '科学奥林匹克' },
      { name: 'FIRST Robotics', zh: 'FIRST 机器人' },
    ],
  },
  GENERAL: {
    summer: [
      { name: 'YYGS', zh: '耶鲁全球青年学者' },
      { name: 'MITES', zh: 'MIT MITES' },
      { name: 'MOSTEC', zh: 'MIT MOSTEC' },
    ],
    competition: [
      { name: 'Science Olympiad', zh: '科学奥林匹克' },
      { name: 'Scholastic Art & Writing', zh: 'Scholastic 写作奖' },
    ],
  },
};

const MAJOR_KEYWORDS: Record<MajorCategory, string[]> = {
  CS: ['computer', 'software', 'computing', 'informatics', 'data science', 'cyber'],
  ENGINEERING: ['engineering', 'mechanical', 'electrical', 'civil', 'aerospace', 'biomedical eng'],
  STEM: ['math', 'physics', 'chemistry', 'biology', 'science', 'statistics', 'astronomy'],
  PRE_MED: ['pre-med', 'premed', 'medicine', 'neuroscience', 'public health', 'nursing'],
  BUSINESS: [
    'business',
    'econ',
    'finance',
    'accounting',
    'marketing',
    'management',
    'entrepreneurship',
  ],
  HUMANITIES: [
    'english',
    'philosophy',
    'history',
    'literature',
    'classics',
    'writing',
    'linguistics',
    'religion',
  ],
  SOCIAL_SCIENCE: [
    'psychology',
    'sociology',
    'political',
    'anthropology',
    'international relations',
    'social',
  ],
  ARTS: ['art', 'music', 'theater', 'theatre', 'film', 'dance', 'design', 'architecture'],
  GENERAL: [],
};

/**
 * Classify a target major string into a MajorCategory via keyword matching.
 */
export function classifyMajor(targetMajor?: string): MajorCategory {
  if (!targetMajor) return 'GENERAL';
  const lower = targetMajor.toLowerCase();

  // Check each category (CS before STEM to avoid false-positive on "science")
  const orderedCategories: MajorCategory[] = [
    'CS',
    'PRE_MED',
    'ENGINEERING',
    'BUSINESS',
    'ARTS',
    'HUMANITIES',
    'SOCIAL_SCIENCE',
    'STEM',
  ];

  for (const category of orderedCategories) {
    if (MAJOR_KEYWORDS[category].some((kw) => lower.includes(kw))) {
      return category;
    }
  }

  return 'GENERAL';
}

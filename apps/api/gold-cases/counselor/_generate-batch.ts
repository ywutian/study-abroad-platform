#!/usr/bin/env tsx
/**
 * One-shot generator for the remaining counselor gold cases.
 *
 * Used during PR-3 to bootstrap 25 cases efficiently. The generated JSON
 * files are then HAND-REVIEWED + committed (not regenerated). This file
 * stays in the repo as documentation of the initial batch's source-of-truth
 * but is NOT run in CI — the JSON files are the canonical truth.
 *
 * If we need to expand beyond the initial 30 cases, prefer hand-writing new
 * JSON files (matches the application-analysis governance pattern).
 */

import { writeFileSync } from 'fs';
import { join, resolve } from 'path';
import type { CounselorGoldCase } from './schema';

const OUT_DIR = resolve(__dirname, 'cases');

const cases: CounselorGoldCase[] = [
  // === UC system continued (cases 6-10) ===
  {
    id: '006-ucla-strong-oos-rd',
    description: 'UC Los Angeles — strong OOS applicant, RD',
    rationale:
      'UCLA anchor 0.09; OOS UC × 0.5; strong stats × 1.3; final ~0.06. Above floor.',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      highSchoolLocation: 'TX',
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1500 }],
    },
    schoolName: 'University of California, Los Angeles',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.03, 0.12],
    tags: ['uc-system', 'tier-2-algorithmic'],
  },
  {
    id: '007-ucsd-strong-ca-instate-rd',
    description: 'UC San Diego — strong CA in-state applicant, RD',
    rationale:
      'UCSD anchor ~0.24. Strong stats × 1.3; in-state UC × 1.8 = 2.34× → cap 2.5× = 0.6. Range reflects strong CA applicant.',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.85,
      gpaScale: 4,
      highSchoolLocation: 'CA',
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1480 }],
    },
    schoolName: 'University of California, San Diego',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.3, 0.65],
    tags: ['uc-system', 'tier-2-algorithmic'],
  },
  {
    id: '008-ucsb-strong-ca-instate-rd',
    description: 'UC Santa Barbara — strong CA in-state applicant, RD',
    rationale: 'UCSB anchor ~0.26. Similar to UCSD; in-state advantage strong.',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.85,
      gpaScale: 4,
      highSchoolLocation: 'CA',
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1450 }],
    },
    schoolName: 'University of California, Santa Barbara',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.3, 0.65],
    tags: ['uc-system', 'tier-2-algorithmic'],
  },
  {
    id: '009-ucm-average-ca-instate-rd',
    description:
      'UC Merced — average CA in-state applicant (3.5 GPA, no SAT), RD',
    rationale:
      'UCM anchor ~0.88. Average stats (3.5 GPA, no SAT) → GPA ×0.85, no test mod (test-optional). In-state ×1.8 = ~1.34× anchor; clamped near anchor. Range [0.55, 0.92].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.5,
      gpaScale: 4,
      highSchoolLocation: 'CA',
      isInternational: false,
      nationality: 'US',
      testScores: [],
    },
    schoolName: 'University of California, Merced',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.55, 0.95],
    tags: ['uc-system', 'tier-2-algorithmic', 'edge-case'],
  },
  {
    id: '010-ucb-average-ca-instate-rd',
    description:
      'UC Berkeley — average CA in-state applicant (3.6 GPA, 1300 SAT), RD',
    rationale:
      'UCB anchor 0.11. Average stats (1300 below 25th percentile 1330) → GPA ×0.85; test ×0.5; in-state UC ×1.8. Combined 0.77× anchor → ~0.085. Above floor 0.033. Range [0.04, 0.15].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.6,
      gpaScale: 4,
      highSchoolLocation: 'CA',
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1300 }],
    },
    schoolName: 'University of California, Berkeley',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.04, 0.2],
    tags: ['uc-system', 'tier-2-algorithmic'],
  },

  // === T20 privates (cases 11-20) ===
  {
    id: '011-mit-very-strong-rd-cs',
    description: 'MIT — very strong applicant (4.0/1580), RD, CS',
    rationale:
      'MIT anchor ~0.04. Strong stats × 1.5 (test); private school no geo. Combined ~0.06; cap 2.5× = 0.10. Range [0.03, 0.10].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 4.0,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      targetMajor: 'computer-science',
      testScores: [{ type: 'SAT', score: 1580 }],
    },
    schoolName: 'Massachusetts Institute of Technology',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.03, 0.12],
    tags: ['t20-private', 'tier-2-algorithmic'],
  },
  {
    id: '012-stanford-very-strong-rd-cs',
    description: 'Stanford — very strong RD applicant, CS major',
    rationale:
      'Stanford anchor ~0.04. Very strong stats × 1.5; CS at top schools × 0.5 (more selective). Combined ~0.03 — clamped at floor 0.012 (if anchor × 0.3). Range [0.02, 0.08].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 4.0,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      targetMajor: 'computer-science',
      testScores: [{ type: 'SAT', score: 1570 }],
    },
    schoolName: 'Stanford University',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.02, 0.1],
    tags: ['t20-private', 'tier-2-algorithmic'],
  },
  {
    id: '013-harvard-very-strong-rd',
    description: 'Harvard — very strong RD applicant',
    rationale:
      'Harvard anchor ~0.04. Very strong stats; need-blind for intl but applicant is US. Range [0.03, 0.10].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 4.0,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1570 }],
    },
    schoolName: 'Harvard University',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.02, 0.1],
    tags: ['t20-private', 'tier-2-algorithmic'],
  },
  {
    id: '014-princeton-very-strong-rd',
    description: 'Princeton — very strong RD applicant',
    rationale: 'Princeton anchor ~0.04. Cap 2.5× = 0.10.',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 4.0,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1580 }],
    },
    schoolName: 'Princeton University',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.02, 0.1],
    tags: ['t20-private', 'tier-2-algorithmic'],
  },
  {
    id: '015-penn-very-strong-rd',
    description: 'Penn — very strong RD applicant (no legacy)',
    rationale:
      'Penn anchor ~0.07. Strong stats × 1.5. Combined ~0.10 — under cap (0.175). Range [0.05, 0.15].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.95,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1530 }],
    },
    schoolName: 'University of Pennsylvania',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.04, 0.18],
    tags: ['t20-private', 'tier-2-algorithmic'],
  },
  {
    id: '016-northwestern-strong-rd',
    description: 'Northwestern — strong RD applicant',
    rationale: 'Northwestern anchor ~0.07. Strong stats. Range [0.05, 0.15].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1500 }],
    },
    schoolName: 'Northwestern University',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.04, 0.18],
    tags: ['t20-private', 'tier-2-algorithmic'],
  },
  {
    id: '017-duke-strong-rd',
    description: 'Duke — strong RD applicant',
    rationale: 'Duke anchor ~0.06. Strong stats × 1.3. Range [0.04, 0.15].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.95,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1530 }],
    },
    schoolName: 'Duke University',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.03, 0.16],
    tags: ['t20-private', 'tier-2-algorithmic'],
  },
  {
    id: '018-cornell-strong-rd-cs',
    description: 'Cornell — strong RD applicant, CS major',
    rationale:
      'Cornell anchor ~0.07. Strong stats; CS at top schools × 0.5. Range [0.04, 0.13].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      targetMajor: 'computer-science',
      testScores: [{ type: 'SAT', score: 1500 }],
    },
    schoolName: 'Cornell University',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.03, 0.16],
    tags: ['t20-private', 'tier-2-algorithmic'],
  },
  {
    id: '019-vanderbilt-strong-rd',
    description: 'Vanderbilt — strong RD applicant',
    rationale: 'Vanderbilt anchor ~0.07. Range [0.05, 0.15].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1510 }],
    },
    schoolName: 'Vanderbilt University',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.04, 0.18],
    tags: ['t20-private', 'tier-2-algorithmic'],
  },
  {
    id: '020-mit-average-rd',
    description: 'MIT — average applicant (3.7 GPA, 1450 SAT), RD',
    rationale:
      'MIT anchor ~0.04. Average stats (1450 below sat25=1520) → test ×0.5. Combined ~0.02 — at floor. Range [0.012, 0.05].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.7,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1450 }],
    },
    schoolName: 'Massachusetts Institute of Technology',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.01, 0.06],
    tags: ['t20-private', 'tier-2-algorithmic'],
  },

  // === Hook cases (21-25) ===
  {
    id: '021-penn-ed-legacy-very-strong',
    description: 'Penn ED + legacy + very strong — capped',
    rationale:
      'Penn anchor 0.07. ED ×2.5 + legacy ×3.0 + strong stats ×1.5 = 11.25× → clamped to 2.5× anchor = 0.175. This case explicitly verifies the cap activates.',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.95,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      isLegacy: true,
      legacySchools: ['University of Pennsylvania'],
      testScores: [{ type: 'SAT', score: 1530 }],
    },
    schoolName: 'University of Pennsylvania',
    applicationRound: 'ED',
    expectedProbabilityRange: [0.1, 0.2],
    tags: ['t20-private', 'hook-legacy'],
  },
  {
    id: '022-harvard-first-gen-strong-rd',
    description: 'Harvard + first-gen + strong RD',
    rationale:
      'Harvard anchor 0.04. First-gen ×1.4 + strong stats ×1.5 → ~0.08. Within cap (0.10). Range [0.04, 0.10].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      isFirstGen: true,
      testScores: [{ type: 'SAT', score: 1530 }],
    },
    schoolName: 'Harvard University',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.03, 0.12],
    tags: ['t20-private', 'hook-first-gen'],
  },
  {
    id: '023-stanford-athlete-strong-rd',
    description: 'Stanford + recruited athlete + strong RD',
    rationale:
      'Stanford anchor 0.04. Athlete ×4.0 + strong stats ×1.3. Combined 5.2× → clamped 2.5× = 0.10. Range [0.05, 0.12].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.85,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      recruitedAthlete: true,
      testScores: [{ type: 'SAT', score: 1480 }],
    },
    schoolName: 'Stanford University',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.04, 0.15],
    tags: ['t20-private', 'hook-athlete'],
  },
  {
    id: '024-ucb-urm-strong-ca-instate-rd',
    description: 'UCB + URM + strong CA in-state RD',
    rationale:
      'UCB anchor 0.11. URM ×1.5 (Berkeley is below 30% acceptance, treated as need-blind-style holistic); strong stats ×1.3; in-state UC ×1.8. Combined ~3.5× → cap 2.5× = 0.275.',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      highSchoolLocation: 'CA',
      isInternational: false,
      nationality: 'US',
      urmStatus: 'HISPANIC',
      testScores: [{ type: 'SAT', score: 1500 }],
    },
    schoolName: 'University of California, Berkeley',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.15, 0.3],
    tags: ['uc-system', 'hook-urm'],
  },
  {
    id: '025-yale-rea-very-strong',
    description: 'Yale REA + very strong applicant',
    rationale:
      'Yale anchor ~0.05. REA ×1.5 + strong stats ×1.5 = 2.25× → ~0.11. Within cap (0.125).',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.95,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1560 }],
    },
    schoolName: 'Yale University',
    applicationRound: 'REA',
    expectedProbabilityRange: [0.04, 0.15],
    tags: ['t20-private', 'tier-2-algorithmic'],
  },

  // === International (26-30) ===
  {
    id: '026-mit-china-intl-very-strong-rd',
    description: 'MIT + China intl + very strong RD',
    rationale:
      'MIT anchor 0.04. Intl need-blind (MIT is need-blind for intl) ×0.7; strong stats ×1.5. Combined ~0.04. Range [0.02, 0.08].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 4.0,
      gpaScale: 4,
      isInternational: true,
      nationality: 'CN',
      testScores: [{ type: 'SAT', score: 1570 }],
    },
    schoolName: 'Massachusetts Institute of Technology',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.02, 0.1],
    tags: ['t20-private', 'international'],
  },
  {
    id: '027-nyu-china-intl-strong-rd',
    description: 'NYU + China intl + strong RD',
    rationale:
      'NYU anchor ~0.12. Intl need-aware ×0.4; strong stats ×1.3. Combined ~0.06. Above floor 0.036.',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.85,
      gpaScale: 4,
      isInternational: true,
      nationality: 'CN',
      testScores: [{ type: 'SAT', score: 1500 }],
    },
    schoolName: 'New York University',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.03, 0.1],
    tags: ['t20-private', 'international'],
  },
  {
    id: '028-ucm-china-intl-strong-rd',
    description: 'UCM + China intl + strong RD (no in-state, OOS)',
    rationale:
      'UCM anchor 0.88. Intl need-aware ×0.4; OOS UC ×0.5; strong stats ×1.5. Combined ~0.26 — above floor 0.26. Range [0.20, 0.50].',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      isInternational: true,
      nationality: 'CN',
      testScores: [{ type: 'SAT', score: 1500 }],
    },
    schoolName: 'University of California, Merced',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.2, 0.55],
    tags: ['uc-system', 'international'],
  },
  {
    id: '029-stanford-china-intl-very-strong-rd-cs',
    description: 'Stanford + China intl + very strong RD CS',
    rationale:
      'Stanford anchor 0.04. Need-blind for intl (Stanford is) ×0.7; CS top school ×0.5; strong stats ×1.5. Combined ~0.022 — at floor 0.012.',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 4.0,
      gpaScale: 4,
      isInternational: true,
      nationality: 'CN',
      targetMajor: 'computer-science',
      testScores: [{ type: 'SAT', score: 1580 }],
    },
    schoolName: 'Stanford University',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.012, 0.07],
    tags: ['t20-private', 'international'],
  },
  {
    id: '030-mit-weak-applicant-rd',
    description: 'Edge case: weak applicant at MIT — floor test',
    rationale:
      'MIT anchor 0.04. Weak stats (3.5/1300 — below 25th 1520) → GPA ×0.5; test ×0.3. Combined 0.6× anchor = 0.024 — at floor 0.012. Tests floor activation.',
    lastReviewedAt: '2026-04-26',
    profile: {
      gpa: 3.5,
      gpaScale: 4,
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1300 }],
    },
    schoolName: 'Massachusetts Institute of Technology',
    applicationRound: 'RD',
    expectedProbabilityRange: [0.01, 0.05],
    tags: ['t20-private', 'edge-case'],
  },
];

for (const c of cases) {
  const filename = `${c.id}.json`;
  writeFileSync(join(OUT_DIR, filename), JSON.stringify(c, null, 2) + '\n');
  console.log(`✓ ${filename}`);
}
console.log(`\n${cases.length} cases generated.`);

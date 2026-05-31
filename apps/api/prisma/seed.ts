import { PrismaClient } from '@prisma/client';
import {
  batchUpsertSchools,
  SeedSchoolData,
} from '../scripts/lib/seed-helpers';
import { buildUnifiedCollegeCatalog } from '../scripts/lib/college-catalog';
import { backfillSchoolLogos } from '../scripts/lib/school-logo-backfill';
import {
  LEGACY_PREDICTION_POLICY_DESCRIPTION,
  LEGACY_PREDICTION_POLICY_KEY,
  LEGACY_PREDICTION_POLICY_NAME,
  LEGACY_PREDICTION_POLICY_VERSION,
} from '../src/modules/prediction/prediction-policy.constants';
import { seedCompetitions } from './seed-competitions';
import { seedDeadlines20262027 } from './seed-deadlines-2026-2027';
import { seedEdEaRates } from './seed-ed-ea-rates';
import { seedGlobalEvents20262027 } from './seed-global-events-2026-2027';
import { seedGpaDistributions } from './seed-gpa-distributions';
import { seedLacGpaTerminal } from './seed-lac-gpa-terminal';
import { seedIntlAcceptanceRates } from './seed-intl-acceptance-rates';
import { correctIntlRates } from './seed-intl-rate-correction';
import { correctRoundRateScaleErrors } from './seed-round-rate-correction';
import { applyAuditCorrections } from './seed-audit-corrections-2026-05-31';
import { seedIntlSchools } from './seed-intl-schools';
import { seedTeamData } from './seed-teams';

const prisma = new PrismaClient();

async function ensureLegacyPredictionPolicyVersion() {
  await prisma.predictionPolicyVersion.upsert({
    where: { id: LEGACY_PREDICTION_POLICY_VERSION },
    update: {},
    create: {
      id: LEGACY_PREDICTION_POLICY_VERSION,
      policyKey: LEGACY_PREDICTION_POLICY_KEY,
      version: LEGACY_PREDICTION_POLICY_VERSION,
      name: LEGACY_PREDICTION_POLICY_NAME,
      status: 'RETIRED',
      description: LEGACY_PREDICTION_POLICY_DESCRIPTION,
      notes: '[seed:legacy-policy-lineage]',
      retiredAt: new Date(),
    },
  });
}

// Top 50 US Universities seed data — with IPEDS IDs, test scores, and comprehensive metrics
// scorecardId/ipedsId are real IPEDS UNITID values from https://nces.ed.gov/ipeds/
const schools = [
  {
    name: 'Princeton University',
    nameZh: '普林斯顿大学',
    state: 'NJ',
    city: 'Princeton',
    usNewsRank: 1,
    acceptanceRate: 5.8,
    tuition: 59710,
    avgSalary: 95000,
    scorecardId: '186131',
    ipedsId: '186131',
    isPrivate: true,
    satAvg: 1540,
    sat25: 1510,
    sat75: 1570,
    actAvg: 35,
    act25: 34,
    act75: 36,
    graduationRate: 97,
    retentionRate: 98,
    totalEnrollment: 8478,
    studentFacultyRatio: 5,
    testingPolicy: 'OPTIONAL',
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.princeton.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Massachusetts Institute of Technology',
    nameZh: '麻省理工学院',
    state: 'MA',
    city: 'Cambridge',
    usNewsRank: 2,
    acceptanceRate: 4.0,
    tuition: 60156,
    avgSalary: 115000,
    scorecardId: '166683',
    ipedsId: '166683',
    isPrivate: true,
    satAvg: 1560,
    sat25: 1530,
    sat75: 1580,
    actAvg: 36,
    act25: 35,
    act75: 36,
    graduationRate: 95,
    retentionRate: 99,
    totalEnrollment: 11858,
    studentFacultyRatio: 3,
    testingPolicy: 'REQUIRED',
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.mit.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Harvard University',
    nameZh: '哈佛大学',
    state: 'MA',
    city: 'Cambridge',
    usNewsRank: 3,
    acceptanceRate: 3.4,
    tuition: 59076,
    avgSalary: 95000,
    scorecardId: '166027',
    ipedsId: '166027',
    isPrivate: true,
    satAvg: 1550,
    sat25: 1480,
    sat75: 1580,
    actAvg: 35,
    act25: 34,
    act75: 36,
    graduationRate: 98,
    retentionRate: 97,
    totalEnrollment: 30631,
    studentFacultyRatio: 6,
    testingPolicy: 'REQUIRED',
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.harvard.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Stanford University',
    nameZh: '斯坦福大学',
    state: 'CA',
    city: 'Stanford',
    usNewsRank: 3,
    acceptanceRate: 3.7,
    tuition: 62484,
    avgSalary: 105000,
    scorecardId: '243744',
    ipedsId: '243744',
    isPrivate: true,
    satAvg: 1550,
    sat25: 1510,
    sat75: 1570,
    actAvg: 35,
    act25: 34,
    act75: 36,
    graduationRate: 95,
    retentionRate: 98,
    totalEnrollment: 17680,
    studentFacultyRatio: 5,
    testingPolicy: 'REQUIRED',
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.stanford.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Yale University',
    nameZh: '耶鲁大学',
    state: 'CT',
    city: 'New Haven',
    usNewsRank: 5,
    acceptanceRate: 4.6,
    tuition: 64700,
    avgSalary: 90000,
    scorecardId: '130794',
    ipedsId: '130794',
    isPrivate: true,
    satAvg: 1540,
    sat25: 1500,
    sat75: 1570,
    actAvg: 35,
    act25: 34,
    act75: 36,
    graduationRate: 97,
    retentionRate: 99,
    totalEnrollment: 14776,
    studentFacultyRatio: 6,
    testingPolicy: 'REQUIRED',
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.yale.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Pennsylvania',
    nameZh: '宾夕法尼亚大学',
    state: 'PA',
    city: 'Philadelphia',
    usNewsRank: 6,
    acceptanceRate: 5.9,
    tuition: 66104,
    avgSalary: 95000,
    scorecardId: '215062',
    ipedsId: '215062',
    isPrivate: true,
    satAvg: 1530,
    sat25: 1500,
    sat75: 1570,
    actAvg: 35,
    act25: 34,
    act75: 35,
    graduationRate: 96,
    retentionRate: 98,
    totalEnrollment: 28306,
    studentFacultyRatio: 6,
    testingPolicy: 'REQUIRED',
    testOptional: false,
    hasEarlyDecision: true,
    website: 'https://www.upenn.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'California Institute of Technology',
    nameZh: '加州理工学院',
    state: 'CA',
    city: 'Pasadena',
    usNewsRank: 7,
    acceptanceRate: 2.7,
    tuition: 63471,
    avgSalary: 110000,
    scorecardId: '110404',
    ipedsId: '110404',
    isPrivate: true,
    satAvg: 1570,
    sat25: 1550,
    sat75: 1580,
    actAvg: 36,
    act25: 36,
    act75: 36,
    graduationRate: 94,
    retentionRate: 98,
    totalEnrollment: 2397,
    studentFacultyRatio: 3,
    testingPolicy: 'OPTIONAL',
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.caltech.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Duke University',
    nameZh: '杜克大学',
    state: 'NC',
    city: 'Durham',
    usNewsRank: 7,
    acceptanceRate: 6.0,
    tuition: 66172,
    avgSalary: 88000,
    scorecardId: '198419',
    ipedsId: '198419',
    isPrivate: true,
    satAvg: 1530,
    sat25: 1500,
    sat75: 1570,
    actAvg: 35,
    act25: 34,
    act75: 36,
    graduationRate: 96,
    retentionRate: 98,
    totalEnrollment: 17620,
    studentFacultyRatio: 6,
    testingPolicy: 'REQUIRED',
    testOptional: false,
    hasEarlyDecision: true,
    website: 'https://www.duke.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Brown University',
    nameZh: '布朗大学',
    state: 'RI',
    city: 'Providence',
    usNewsRank: 9,
    acceptanceRate: 5.1,
    tuition: 67458,
    avgSalary: 80000,
    scorecardId: '217156',
    ipedsId: '217156',
    isPrivate: true,
    satAvg: 1530,
    sat25: 1490,
    sat75: 1560,
    actAvg: 35,
    act25: 34,
    act75: 36,
    graduationRate: 96,
    retentionRate: 98,
    totalEnrollment: 11083,
    studentFacultyRatio: 6,
    testingPolicy: 'REQUIRED',
    testOptional: false,
    hasEarlyDecision: true,
    website: 'https://www.brown.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Johns Hopkins University',
    nameZh: '约翰霍普金斯大学',
    state: 'MD',
    city: 'Baltimore',
    usNewsRank: 9,
    acceptanceRate: 6.5,
    tuition: 63340,
    avgSalary: 85000,
    scorecardId: '162928',
    ipedsId: '162928',
    isPrivate: true,
    satAvg: 1530,
    sat25: 1500,
    sat75: 1560,
    actAvg: 35,
    act25: 34,
    act75: 36,
    graduationRate: 94,
    retentionRate: 97,
    totalEnrollment: 29405,
    studentFacultyRatio: 7,
    testOptional: false,
    hasEarlyDecision: true,
    website: 'https://www.jhu.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Northwestern University',
    nameZh: '西北大学',
    state: 'IL',
    city: 'Evanston',
    usNewsRank: 9,
    acceptanceRate: 7.0,
    tuition: 65997,
    avgSalary: 82000,
    scorecardId: '147767',
    ipedsId: '147767',
    isPrivate: true,
    satAvg: 1530,
    sat25: 1490,
    sat75: 1560,
    actAvg: 35,
    act25: 34,
    act75: 35,
    graduationRate: 95,
    retentionRate: 97,
    totalEnrollment: 23419,
    studentFacultyRatio: 6,
    testOptional: false,
    hasEarlyDecision: true,
    website: 'https://www.northwestern.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Columbia University',
    nameZh: '哥伦比亚大学',
    state: 'NY',
    city: 'New York',
    usNewsRank: 12,
    acceptanceRate: 3.9,
    tuition: 68400,
    avgSalary: 90000,
    scorecardId: '190150',
    ipedsId: '190150',
    isPrivate: true,
    satAvg: 1540,
    sat25: 1500,
    sat75: 1570,
    actAvg: 35,
    act25: 34,
    act75: 36,
    graduationRate: 95,
    retentionRate: 99,
    totalEnrollment: 36649,
    studentFacultyRatio: 6,
    testingPolicy: 'OPTIONAL',
    testOptional: true,
    hasEarlyDecision: true,
    website: 'https://www.columbia.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Cornell University',
    nameZh: '康奈尔大学',
    state: 'NY',
    city: 'Ithaca',
    usNewsRank: 12,
    acceptanceRate: 7.3,
    tuition: 66014,
    avgSalary: 85000,
    scorecardId: '190415',
    ipedsId: '190415',
    isPrivate: true,
    satAvg: 1520,
    sat25: 1470,
    sat75: 1560,
    actAvg: 34,
    act25: 34,
    act75: 35,
    graduationRate: 95,
    retentionRate: 97,
    totalEnrollment: 25898,
    studentFacultyRatio: 9,
    testingPolicy: 'REQUIRED',
    testOptional: false,
    hasEarlyDecision: true,
    website: 'https://www.cornell.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Chicago',
    nameZh: '芝加哥大学',
    state: 'IL',
    city: 'Chicago',
    usNewsRank: 12,
    acceptanceRate: 5.4,
    tuition: 66939,
    avgSalary: 88000,
    scorecardId: '144050',
    ipedsId: '144050',
    isPrivate: true,
    satAvg: 1540,
    sat25: 1510,
    sat75: 1570,
    actAvg: 35,
    act25: 35,
    act75: 36,
    graduationRate: 95,
    retentionRate: 99,
    totalEnrollment: 18452,
    studentFacultyRatio: 5,
    testOptional: true,
    hasEarlyDecision: true,
    website: 'https://www.uchicago.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of California, Berkeley',
    nameZh: '加州大学伯克利分校',
    state: 'CA',
    city: 'Berkeley',
    usNewsRank: 15,
    acceptanceRate: 11.6,
    tuition: 44066,
    avgSalary: 95000,
    scorecardId: '110635',
    ipedsId: '110635',
    isPrivate: false,
    satAvg: 1440,
    sat25: 1370,
    sat75: 1520,
    actAvg: 33,
    act25: 31,
    act75: 35,
    graduationRate: 93,
    retentionRate: 97,
    totalEnrollment: 45057,
    studentFacultyRatio: 20,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.berkeley.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of California, Los Angeles',
    nameZh: '加州大学洛杉矶分校',
    state: 'CA',
    city: 'Los Angeles',
    usNewsRank: 15,
    acceptanceRate: 8.6,
    tuition: 44830,
    avgSalary: 80000,
    scorecardId: '110662',
    ipedsId: '110662',
    isPrivate: false,
    satAvg: 1440,
    sat25: 1360,
    sat75: 1530,
    actAvg: 33,
    act25: 31,
    act75: 35,
    graduationRate: 92,
    retentionRate: 97,
    totalEnrollment: 46116,
    studentFacultyRatio: 18,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.ucla.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Rice University',
    nameZh: '莱斯大学',
    state: 'TX',
    city: 'Houston',
    usNewsRank: 17,
    acceptanceRate: 7.7,
    tuition: 58128,
    avgSalary: 85000,
    scorecardId: '227757',
    ipedsId: '227757',
    isPrivate: true,
    satAvg: 1530,
    sat25: 1500,
    sat75: 1560,
    actAvg: 35,
    act25: 34,
    act75: 36,
    graduationRate: 93,
    retentionRate: 97,
    totalEnrollment: 8285,
    studentFacultyRatio: 6,
    testOptional: false,
    hasEarlyDecision: true,
    website: 'https://www.rice.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Dartmouth College',
    nameZh: '达特茅斯学院',
    state: 'NH',
    city: 'Hanover',
    usNewsRank: 18,
    acceptanceRate: 6.2,
    tuition: 65511,
    avgSalary: 85000,
    scorecardId: '182670',
    ipedsId: '182670',
    isPrivate: true,
    satAvg: 1530,
    sat25: 1490,
    sat75: 1560,
    actAvg: 35,
    act25: 34,
    act75: 35,
    graduationRate: 95,
    retentionRate: 97,
    totalEnrollment: 6834,
    studentFacultyRatio: 7,
    testingPolicy: 'REQUIRED',
    testOptional: false,
    hasEarlyDecision: true,
    website: 'https://www.dartmouth.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Vanderbilt University',
    nameZh: '范德堡大学',
    state: 'TN',
    city: 'Nashville',
    usNewsRank: 18,
    acceptanceRate: 5.6,
    tuition: 63946,
    avgSalary: 78000,
    scorecardId: '221999',
    ipedsId: '221999',
    isPrivate: true,
    satAvg: 1520,
    sat25: 1490,
    sat75: 1560,
    actAvg: 35,
    act25: 34,
    act75: 36,
    graduationRate: 94,
    retentionRate: 97,
    totalEnrollment: 13710,
    studentFacultyRatio: 7,
    testOptional: false,
    hasEarlyDecision: true,
    website: 'https://www.vanderbilt.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Notre Dame',
    nameZh: '圣母大学',
    state: 'IN',
    city: 'Notre Dame',
    usNewsRank: 20,
    acceptanceRate: 12.9,
    tuition: 62693,
    avgSalary: 80000,
    scorecardId: '152080',
    ipedsId: '152080',
    isPrivate: true,
    satAvg: 1490,
    sat25: 1440,
    sat75: 1540,
    actAvg: 34,
    act25: 33,
    act75: 35,
    graduationRate: 96,
    retentionRate: 98,
    totalEnrollment: 13139,
    studentFacultyRatio: 10,
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.nd.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Michigan, Ann Arbor',
    nameZh: '密歇根大学安娜堡分校',
    state: 'MI',
    city: 'Ann Arbor',
    usNewsRank: 21,
    acceptanceRate: 17.7,
    tuition: 57273,
    avgSalary: 82000,
    scorecardId: '170976',
    ipedsId: '170976',
    isPrivate: false,
    satAvg: 1470,
    sat25: 1400,
    sat75: 1540,
    actAvg: 34,
    act25: 33,
    act75: 35,
    graduationRate: 93,
    retentionRate: 97,
    totalEnrollment: 48090,
    studentFacultyRatio: 15,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://umich.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Georgetown University',
    nameZh: '乔治城大学',
    state: 'DC',
    city: 'Washington',
    usNewsRank: 22,
    acceptanceRate: 12.0,
    tuition: 65082,
    avgSalary: 80000,
    scorecardId: '131469',
    ipedsId: '131469',
    isPrivate: true,
    satAvg: 1480,
    sat25: 1420,
    sat75: 1540,
    actAvg: 34,
    act25: 33,
    act75: 35,
    graduationRate: 95,
    retentionRate: 97,
    totalEnrollment: 20038,
    studentFacultyRatio: 11,
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.georgetown.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of North Carolina at Chapel Hill',
    nameZh: '北卡罗来纳大学教堂山分校',
    state: 'NC',
    city: 'Chapel Hill',
    usNewsRank: 22,
    acceptanceRate: 16.8,
    tuition: 39338,
    avgSalary: 72000,
    scorecardId: '199120',
    ipedsId: '199120',
    isPrivate: false,
    satAvg: 1420,
    sat25: 1360,
    sat75: 1490,
    actAvg: 32,
    act25: 31,
    act75: 34,
    graduationRate: 91,
    retentionRate: 96,
    totalEnrollment: 32852,
    studentFacultyRatio: 15,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.unc.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Carnegie Mellon University',
    nameZh: '卡内基梅隆大学',
    state: 'PA',
    city: 'Pittsburgh',
    usNewsRank: 24,
    acceptanceRate: 11.0,
    tuition: 63829,
    avgSalary: 105000,
    scorecardId: '211440',
    ipedsId: '211440',
    isPrivate: true,
    satAvg: 1520,
    sat25: 1490,
    sat75: 1560,
    actAvg: 35,
    act25: 34,
    act75: 36,
    graduationRate: 92,
    retentionRate: 97,
    totalEnrollment: 16811,
    studentFacultyRatio: 10,
    testOptional: false,
    hasEarlyDecision: true,
    website: 'https://www.cmu.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Emory University',
    nameZh: '埃默里大学',
    state: 'GA',
    city: 'Atlanta',
    usNewsRank: 24,
    acceptanceRate: 11.4,
    tuition: 60774,
    avgSalary: 75000,
    scorecardId: '139658',
    ipedsId: '139658',
    isPrivate: true,
    satAvg: 1480,
    sat25: 1430,
    sat75: 1530,
    actAvg: 34,
    act25: 33,
    act75: 35,
    graduationRate: 91,
    retentionRate: 96,
    totalEnrollment: 15451,
    studentFacultyRatio: 9,
    testOptional: true,
    hasEarlyDecision: true,
    website: 'https://www.emory.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Virginia',
    nameZh: '弗吉尼亚大学',
    state: 'VA',
    city: 'Charlottesville',
    usNewsRank: 24,
    acceptanceRate: 18.6,
    tuition: 58950,
    avgSalary: 78000,
    scorecardId: '234076',
    ipedsId: '234076',
    isPrivate: false,
    satAvg: 1430,
    sat25: 1370,
    sat75: 1500,
    actAvg: 33,
    act25: 32,
    act75: 35,
    graduationRate: 94,
    retentionRate: 97,
    totalEnrollment: 26351,
    studentFacultyRatio: 15,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.virginia.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Washington University in St. Louis',
    nameZh: '圣路易斯华盛顿大学',
    state: 'MO',
    city: 'St. Louis',
    usNewsRank: 24,
    acceptanceRate: 11.0,
    tuition: 63373,
    avgSalary: 78000,
    scorecardId: '179867',
    ipedsId: '179867',
    isPrivate: true,
    satAvg: 1520,
    sat25: 1490,
    sat75: 1560,
    actAvg: 35,
    act25: 34,
    act75: 35,
    graduationRate: 94,
    retentionRate: 97,
    totalEnrollment: 16201,
    studentFacultyRatio: 7,
    testOptional: true,
    hasEarlyDecision: true,
    website: 'https://wustl.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of California, Davis',
    nameZh: '加州大学戴维斯分校',
    state: 'CA',
    city: 'Davis',
    usNewsRank: 28,
    acceptanceRate: 37.3,
    tuition: 44408,
    avgSalary: 72000,
    scorecardId: '110644',
    ipedsId: '110644',
    isPrivate: false,
    satAvg: 1310,
    sat25: 1210,
    sat75: 1420,
    actAvg: 30,
    act25: 27,
    act75: 33,
    graduationRate: 86,
    retentionRate: 93,
    totalEnrollment: 40031,
    studentFacultyRatio: 20,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.ucdavis.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of California, San Diego',
    nameZh: '加州大学圣地亚哥分校',
    state: 'CA',
    city: 'La Jolla',
    usNewsRank: 28,
    acceptanceRate: 24.7,
    tuition: 44487,
    avgSalary: 78000,
    scorecardId: '110680',
    ipedsId: '110680',
    isPrivate: false,
    satAvg: 1390,
    sat25: 1310,
    sat75: 1490,
    actAvg: 32,
    act25: 30,
    act75: 34,
    graduationRate: 88,
    retentionRate: 94,
    totalEnrollment: 42875,
    studentFacultyRatio: 19,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://ucsd.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Florida',
    nameZh: '佛罗里达大学',
    state: 'FL',
    city: 'Gainesville',
    usNewsRank: 28,
    acceptanceRate: 23.1,
    tuition: 28658,
    avgSalary: 68000,
    scorecardId: '134130',
    ipedsId: '134130',
    isPrivate: false,
    satAvg: 1380,
    sat25: 1310,
    sat75: 1460,
    actAvg: 31,
    act25: 29,
    act75: 33,
    graduationRate: 90,
    retentionRate: 96,
    totalEnrollment: 55781,
    studentFacultyRatio: 17,
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.ufl.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Southern California',
    nameZh: '南加州大学',
    state: 'CA',
    city: 'Los Angeles',
    usNewsRank: 28,
    acceptanceRate: 9.9,
    tuition: 67005,
    avgSalary: 82000,
    scorecardId: '123961',
    ipedsId: '123961',
    isPrivate: true,
    satAvg: 1490,
    sat25: 1440,
    sat75: 1540,
    actAvg: 34,
    act25: 33,
    act75: 35,
    graduationRate: 92,
    retentionRate: 96,
    totalEnrollment: 49500,
    studentFacultyRatio: 9,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.usc.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Texas at Austin',
    nameZh: '德克萨斯大学奥斯汀分校',
    state: 'TX',
    city: 'Austin',
    usNewsRank: 32,
    acceptanceRate: 31.2,
    tuition: 41070,
    avgSalary: 78000,
    scorecardId: '228778',
    ipedsId: '228778',
    isPrivate: false,
    satAvg: 1360,
    sat25: 1280,
    sat75: 1450,
    actAvg: 31,
    act25: 29,
    act75: 33,
    graduationRate: 87,
    retentionRate: 95,
    totalEnrollment: 53082,
    studentFacultyRatio: 17,
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.utexas.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Georgia Institute of Technology',
    nameZh: '佐治亚理工学院',
    state: 'GA',
    city: 'Atlanta',
    usNewsRank: 33,
    acceptanceRate: 17.1,
    tuition: 33794,
    avgSalary: 90000,
    scorecardId: '139755',
    ipedsId: '139755',
    isPrivate: false,
    satAvg: 1460,
    sat25: 1400,
    sat75: 1530,
    actAvg: 34,
    act25: 33,
    act75: 35,
    graduationRate: 91,
    retentionRate: 97,
    totalEnrollment: 44592,
    studentFacultyRatio: 22,
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.gatech.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of California, Irvine',
    nameZh: '加州大学尔湾分校',
    state: 'CA',
    city: 'Irvine',
    usNewsRank: 33,
    acceptanceRate: 21.0,
    tuition: 43709,
    avgSalary: 72000,
    scorecardId: '110653',
    ipedsId: '110653',
    isPrivate: false,
    satAvg: 1340,
    sat25: 1250,
    sat75: 1430,
    actAvg: 30,
    act25: 28,
    act75: 33,
    graduationRate: 85,
    retentionRate: 94,
    totalEnrollment: 36303,
    studentFacultyRatio: 18,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://uci.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'New York University',
    nameZh: '纽约大学',
    state: 'NY',
    city: 'New York',
    usNewsRank: 35,
    acceptanceRate: 12.2,
    tuition: 60438,
    avgSalary: 78000,
    scorecardId: '193900',
    ipedsId: '193900',
    isPrivate: true,
    satAvg: 1480,
    sat25: 1430,
    sat75: 1540,
    actAvg: 34,
    act25: 33,
    act75: 35,
    graduationRate: 87,
    retentionRate: 95,
    totalEnrollment: 59144,
    studentFacultyRatio: 9,
    testOptional: true,
    hasEarlyDecision: true,
    website: 'https://www.nyu.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of California, Santa Barbara',
    nameZh: '加州大学圣塔芭芭拉分校',
    state: 'CA',
    city: 'Santa Barbara',
    usNewsRank: 35,
    acceptanceRate: 25.9,
    tuition: 44196,
    avgSalary: 70000,
    scorecardId: '110705',
    ipedsId: '110705',
    isPrivate: false,
    satAvg: 1370,
    sat25: 1290,
    sat75: 1460,
    actAvg: 31,
    act25: 29,
    act75: 34,
    graduationRate: 83,
    retentionRate: 93,
    totalEnrollment: 26179,
    studentFacultyRatio: 17,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.ucsb.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Illinois Urbana-Champaign',
    nameZh: '伊利诺伊大学厄巴纳-香槟分校',
    state: 'IL',
    city: 'Champaign',
    usNewsRank: 35,
    acceptanceRate: 44.8,
    tuition: 36068,
    avgSalary: 80000,
    scorecardId: '145637',
    ipedsId: '145637',
    isPrivate: false,
    satAvg: 1390,
    sat25: 1320,
    sat75: 1470,
    actAvg: 32,
    act25: 30,
    act75: 34,
    graduationRate: 87,
    retentionRate: 94,
    totalEnrollment: 56607,
    studentFacultyRatio: 20,
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://illinois.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Wisconsin-Madison',
    nameZh: '威斯康星大学麦迪逊分校',
    state: 'WI',
    city: 'Madison',
    usNewsRank: 35,
    acceptanceRate: 49.2,
    tuition: 40603,
    avgSalary: 72000,
    scorecardId: '240444',
    ipedsId: '240444',
    isPrivate: false,
    satAvg: 1370,
    sat25: 1310,
    sat75: 1440,
    actAvg: 31,
    act25: 29,
    act75: 33,
    graduationRate: 89,
    retentionRate: 95,
    totalEnrollment: 49066,
    studentFacultyRatio: 17,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.wisc.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Boston College',
    nameZh: '波士顿学院',
    state: 'MA',
    city: 'Chestnut Hill',
    usNewsRank: 39,
    acceptanceRate: 16.4,
    tuition: 66884,
    avgSalary: 75000,
    scorecardId: '164924',
    ipedsId: '164924',
    isPrivate: true,
    satAvg: 1460,
    sat25: 1410,
    sat75: 1510,
    actAvg: 34,
    act25: 33,
    act75: 35,
    graduationRate: 93,
    retentionRate: 95,
    totalEnrollment: 15061,
    studentFacultyRatio: 12,
    testOptional: true,
    hasEarlyDecision: true,
    website: 'https://www.bc.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Rutgers University-New Brunswick',
    nameZh: '罗格斯大学新布朗斯维克分校',
    state: 'NJ',
    city: 'New Brunswick',
    usNewsRank: 40,
    acceptanceRate: 66.1,
    tuition: 35636,
    avgSalary: 72000,
    scorecardId: '186380',
    ipedsId: '186380',
    isPrivate: false,
    satAvg: 1310,
    sat25: 1230,
    sat75: 1390,
    actAvg: 30,
    act25: 28,
    act75: 32,
    graduationRate: 83,
    retentionRate: 93,
    totalEnrollment: 50637,
    studentFacultyRatio: 16,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.rutgers.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Tufts University',
    nameZh: '塔夫茨大学',
    state: 'MA',
    city: 'Medford',
    usNewsRank: 40,
    acceptanceRate: 9.5,
    tuition: 67844,
    avgSalary: 78000,
    scorecardId: '168148',
    ipedsId: '168148',
    isPrivate: true,
    satAvg: 1490,
    sat25: 1450,
    sat75: 1540,
    actAvg: 34,
    act25: 33,
    act75: 35,
    graduationRate: 93,
    retentionRate: 96,
    totalEnrollment: 13029,
    studentFacultyRatio: 9,
    testOptional: true,
    hasEarlyDecision: true,
    website: 'https://www.tufts.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Washington',
    nameZh: '华盛顿大学',
    state: 'WA',
    city: 'Seattle',
    usNewsRank: 40,
    acceptanceRate: 47.8,
    tuition: 41997,
    avgSalary: 82000,
    scorecardId: '236948',
    ipedsId: '236948',
    isPrivate: false,
    satAvg: 1370,
    sat25: 1290,
    sat75: 1460,
    actAvg: 31,
    act25: 29,
    act75: 33,
    graduationRate: 84,
    retentionRate: 93,
    totalEnrollment: 61468,
    studentFacultyRatio: 21,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.washington.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Boston University',
    nameZh: '波士顿大学',
    state: 'MA',
    city: 'Boston',
    usNewsRank: 43,
    acceptanceRate: 14.4,
    tuition: 65168,
    avgSalary: 72000,
    scorecardId: '164988',
    ipedsId: '164988',
    isPrivate: true,
    satAvg: 1450,
    sat25: 1390,
    sat75: 1510,
    actAvg: 33,
    act25: 32,
    act75: 34,
    graduationRate: 89,
    retentionRate: 94,
    totalEnrollment: 37110,
    studentFacultyRatio: 11,
    testOptional: true,
    hasEarlyDecision: true,
    website: 'https://www.bu.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Ohio State University',
    nameZh: '俄亥俄州立大学',
    state: 'OH',
    city: 'Columbus',
    usNewsRank: 43,
    acceptanceRate: 52.6,
    tuition: 36722,
    avgSalary: 70000,
    scorecardId: '204796',
    ipedsId: '204796',
    isPrivate: false,
    satAvg: 1330,
    sat25: 1260,
    sat75: 1410,
    actAvg: 30,
    act25: 28,
    act75: 32,
    graduationRate: 84,
    retentionRate: 94,
    totalEnrollment: 61369,
    studentFacultyRatio: 19,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.osu.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Purdue University',
    nameZh: '普渡大学',
    state: 'IN',
    city: 'West Lafayette',
    usNewsRank: 43,
    acceptanceRate: 53.4,
    tuition: 28794,
    avgSalary: 78000,
    scorecardId: '153658',
    ipedsId: '153658',
    isPrivate: false,
    satAvg: 1320,
    sat25: 1230,
    sat75: 1410,
    actAvg: 30,
    act25: 28,
    act75: 33,
    graduationRate: 83,
    retentionRate: 92,
    totalEnrollment: 52211,
    studentFacultyRatio: 14,
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.purdue.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Maryland, College Park',
    nameZh: '马里兰大学帕克分校',
    state: 'MD',
    city: 'College Park',
    usNewsRank: 46,
    acceptanceRate: 44.5,
    tuition: 41426,
    avgSalary: 78000,
    scorecardId: '163286',
    ipedsId: '163286',
    isPrivate: false,
    satAvg: 1380,
    sat25: 1310,
    sat75: 1460,
    actAvg: 32,
    act25: 30,
    act75: 34,
    graduationRate: 88,
    retentionRate: 95,
    totalEnrollment: 41200,
    studentFacultyRatio: 18,
    testOptional: true,
    hasEarlyDecision: false,
    website: 'https://www.umd.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Lehigh University',
    nameZh: '里海大学',
    state: 'PA',
    city: 'Bethlehem',
    usNewsRank: 47,
    acceptanceRate: 37.0,
    tuition: 64380,
    avgSalary: 80000,
    scorecardId: '213543',
    ipedsId: '213543',
    isPrivate: true,
    satAvg: 1380,
    sat25: 1320,
    sat75: 1440,
    actAvg: 32,
    act25: 31,
    act75: 34,
    graduationRate: 89,
    retentionRate: 94,
    totalEnrollment: 7652,
    studentFacultyRatio: 10,
    testOptional: true,
    hasEarlyDecision: true,
    website: 'https://www1.lehigh.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Texas A&M University',
    nameZh: '德州农工大学',
    state: 'TX',
    city: 'College Station',
    usNewsRank: 47,
    acceptanceRate: 63.0,
    tuition: 40607,
    avgSalary: 72000,
    scorecardId: '228723',
    ipedsId: '228723',
    isPrivate: false,
    satAvg: 1270,
    sat25: 1190,
    sat75: 1360,
    actAvg: 29,
    act25: 26,
    act75: 31,
    graduationRate: 83,
    retentionRate: 93,
    totalEnrollment: 74829,
    studentFacultyRatio: 19,
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.tamu.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'University of Georgia',
    nameZh: '佐治亚大学',
    state: 'GA',
    city: 'Athens',
    usNewsRank: 47,
    acceptanceRate: 42.8,
    tuition: 33818,
    avgSalary: 65000,
    scorecardId: '139959',
    ipedsId: '139959',
    isPrivate: false,
    satAvg: 1310,
    sat25: 1250,
    sat75: 1380,
    actAvg: 30,
    act25: 28,
    act75: 32,
    graduationRate: 87,
    retentionRate: 95,
    totalEnrollment: 40607,
    studentFacultyRatio: 17,
    testOptional: false,
    hasEarlyDecision: false,
    website: 'https://www.uga.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
  {
    name: 'Wake Forest University',
    nameZh: '维克森林大学',
    state: 'NC',
    city: 'Winston-Salem',
    usNewsRank: 47,
    acceptanceRate: 21.4,
    tuition: 64758,
    avgSalary: 70000,
    scorecardId: '199847',
    ipedsId: '199847',
    isPrivate: true,
    satAvg: 1420,
    sat25: 1360,
    sat75: 1480,
    actAvg: 33,
    act25: 31,
    act75: 34,
    graduationRate: 90,
    retentionRate: 94,
    totalEnrollment: 9091,
    studentFacultyRatio: 10,
    testOptional: true,
    hasEarlyDecision: true,
    website: 'https://www.wfu.edu',
    metadata: {
      provenance: {
        acceptanceRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        satAvg: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
        tuition: { source: 'IPEDS', at: '2025-08-15' },
        graduationRate: { source: 'IPEDS', at: '2025-08-15' },
        retentionRate: { source: 'COLLEGE_SCORECARD', at: '2025-09-01' },
      },
    },
  },
];

// Admission requirements & essay counts for Top 50 schools
// Source: College official admissions pages (2025-2026 cycle)
const requirementsData: Record<
  string,
  { toeflMin?: number; ieltsMin?: number; essayCount?: number }
> = {
  'Princeton University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 4 },
  'Massachusetts Institute of Technology': {
    toeflMin: 100,
    ieltsMin: 7.0,
    essayCount: 5,
  },
  'Harvard University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 5 },
  'Stanford University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 3 },
  'Yale University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 4 },
  'University of Pennsylvania': { toeflMin: 100, ieltsMin: 7.0, essayCount: 3 },
  'California Institute of Technology': {
    toeflMin: 100,
    ieltsMin: 7.0,
    essayCount: 4,
  },
  'Duke University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 2 },
  'Brown University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 3 },
  'Johns Hopkins University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 2 },
  'Northwestern University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 2 },
  'Columbia University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 4 },
  'Cornell University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 2 },
  'University of Chicago': { toeflMin: 100, ieltsMin: 7.0, essayCount: 3 },
  'University of California, Berkeley': {
    toeflMin: 80,
    ieltsMin: 6.5,
    essayCount: 4,
  },
  'University of California, Los Angeles': {
    toeflMin: 80,
    ieltsMin: 6.5,
    essayCount: 4,
  },
  'Rice University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 3 },
  'Dartmouth College': { toeflMin: 100, ieltsMin: 7.0, essayCount: 3 },
  'Vanderbilt University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 2 },
  'University of Notre Dame': { toeflMin: 100, ieltsMin: 7.0, essayCount: 3 },
  'University of Michigan, Ann Arbor': {
    toeflMin: 100,
    ieltsMin: 7.0,
    essayCount: 2,
  },
  'Georgetown University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 3 },
  'University of North Carolina at Chapel Hill': {
    toeflMin: 100,
    ieltsMin: 7.0,
    essayCount: 2,
  },
  'Carnegie Mellon University': { toeflMin: 102, ieltsMin: 7.5, essayCount: 3 },
  'Emory University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 2 },
  'University of Virginia': { toeflMin: 90, ieltsMin: 7.0, essayCount: 2 },
  'Washington University in St. Louis': {
    toeflMin: 100,
    ieltsMin: 7.0,
    essayCount: 2,
  },
  'University of California, Davis': {
    toeflMin: 80,
    ieltsMin: 6.5,
    essayCount: 4,
  },
  'University of California, San Diego': {
    toeflMin: 83,
    ieltsMin: 7.0,
    essayCount: 4,
  },
  'University of Florida': { toeflMin: 80, ieltsMin: 6.0, essayCount: 1 },
  'University of Southern California': {
    toeflMin: 100,
    ieltsMin: 7.0,
    essayCount: 2,
  },
  'University of Texas at Austin': {
    toeflMin: 79,
    ieltsMin: 6.5,
    essayCount: 3,
  },
  'Georgia Institute of Technology': {
    toeflMin: 90,
    ieltsMin: 7.0,
    essayCount: 2,
  },
  'University of California, Irvine': {
    toeflMin: 80,
    ieltsMin: 6.5,
    essayCount: 4,
  },
  'New York University': { toeflMin: 100, ieltsMin: 7.5, essayCount: 2 },
  'University of California, Santa Barbara': {
    toeflMin: 80,
    ieltsMin: 6.5,
    essayCount: 4,
  },
  'University of Illinois Urbana-Champaign': {
    toeflMin: 80,
    ieltsMin: 6.5,
    essayCount: 1,
  },
  'University of Wisconsin-Madison': {
    toeflMin: 80,
    ieltsMin: 6.5,
    essayCount: 2,
  },
  'Boston College': { toeflMin: 100, ieltsMin: 7.5, essayCount: 2 },
  'Rutgers University-New Brunswick': {
    toeflMin: 79,
    ieltsMin: 7.0,
    essayCount: 1,
  },
  'Tufts University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 3 },
  'University of Washington': { toeflMin: 76, ieltsMin: 6.0, essayCount: 2 },
  'Boston University': { toeflMin: 90, ieltsMin: 7.0, essayCount: 2 },
  'Ohio State University': { toeflMin: 79, ieltsMin: 6.5, essayCount: 1 },
  'Purdue University': { toeflMin: 80, ieltsMin: 6.5, essayCount: 1 },
  'University of Maryland, College Park': {
    toeflMin: 100,
    ieltsMin: 7.0,
    essayCount: 2,
  },
  'Lehigh University': { toeflMin: 90, ieltsMin: 7.0, essayCount: 1 },
  'Texas A&M University': { toeflMin: 80, ieltsMin: 6.0, essayCount: 2 },
  'University of Georgia': { toeflMin: 80, ieltsMin: 6.5, essayCount: 1 },
  'Wake Forest University': { toeflMin: 100, ieltsMin: 7.0, essayCount: 2 },
};

// Merge requirements into each school's metadata (with provenance tracking)
const baseCollegeSchools = schools.map((s) => {
  const reqs = requirementsData[s.name];
  if (!reqs) return s;
  const existingMeta = (s.metadata ?? {}) as Record<string, unknown>;
  const existingProv =
    (existingMeta.provenance as Record<string, unknown>) || {};
  return {
    ...s,
    metadata: {
      ...existingMeta,
      requirements: {
        ...(reqs.toeflMin !== undefined ? { toeflMin: reqs.toeflMin } : {}),
        ...(reqs.ieltsMin !== undefined ? { ieltsMin: reqs.ieltsMin } : {}),
      },
      ...(reqs.essayCount !== undefined ? { essayCount: reqs.essayCount } : {}),
      provenance: {
        ...existingProv,
        ...(reqs.toeflMin !== undefined
          ? { toeflMin: { source: 'SEED', at: '2026-03-25' } }
          : {}),
        ...(reqs.ieltsMin !== undefined
          ? { ieltsMin: { source: 'SEED', at: '2026-03-25' } }
          : {}),
        ...(reqs.essayCount !== undefined
          ? { essayCount: { source: 'SEED', at: '2026-03-25' } }
          : {}),
      },
    },
  };
});

export async function main() {
  console.log('🌱 Starting database seed...');
  await ensureLegacyPredictionPolicyVersion();
  console.log('  ✅ Ensured legacy prediction policy lineage');

  const unifiedCollegeCatalog = buildUnifiedCollegeCatalog(
    baseCollegeSchools as SeedSchoolData[],
  );

  // Upsert schools using shared helper (idempotent)
  await batchUpsertSchools(
    prisma,
    unifiedCollegeCatalog,
    'Unified college catalog',
  );

  const logoBackfillResult = await backfillSchoolLogos({
    prisma,
    limit: Math.max(unifiedCollegeCatalog.length, 500),
    logoDevToken: process.env.LOGO_DEV_TOKEN,
  });
  console.log(
    `  ✅ Logo backfill complete (${logoBackfillResult.filled} filled, ${logoBackfillResult.failed} failed, ${logoBackfillResult.skipped} skipped, source=${logoBackfillResult.source})`,
  );

  // Create demo user (optional)
  const demoUserExists = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
  });

  if (!demoUserExists) {
    console.log('👤 Creating demo user...');
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash('Demo123!', 10);

    await prisma.user.create({
      data: {
        email: 'demo@example.com',
        passwordHash,
        emailVerified: true,
        locale: 'zh',
        profile: {
          create: {
            grade: 'JUNIOR',
            gpa: 3.85,
            gpaScale: 4.0,
            targetMajor: 'Computer Science',
            budgetTier: 'HIGH',
            visibility: 'ANONYMOUS',
          },
        },
      },
    });
    console.log(
      '✅ Demo user created (email: demo@example.com, password: Demo123!)',
    );
  }

  // Create admin user
  const adminUserExists = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });

  if (!adminUserExists) {
    console.log('👑 Creating admin user...');
    const bcrypt = await import('bcrypt');
    const adminPasswordHash = await bcrypt.hash('Admin123!', 10);

    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: adminPasswordHash,
        emailVerified: true,
        role: 'SUPER_ADMIN',
        locale: 'zh',
      },
    });
    console.log(
      '✅ Admin user created (email: admin@example.com, password: Admin123!)',
    );
  }

  // ========== Chat Test Users & Data ==========
  await seedChatTestData();

  // ========== Competition Reference Data ==========
  await seedCompetitions(prisma);

  // ========== Team & Recruitment Data ==========
  await seedTeamData(prisma);

  // ========== International Financial Aid Policy ==========
  // Seeds the verified need-blind-for-intl list (10 schools) and the
  // verified need-aware list (16 schools). Schools not in either list
  // keep needBlindInternational = null (unreviewed) so the counselor
  // engine uses a midpoint penalty.
  // See: ADR-0020, docs/PREDICTION_ACCURACY_STRATEGY.md.
  const intlPolicy = await seedIntlSchools(prisma);
  console.log(
    `  ✅ Intl FA policy: ${intlPolicy.needBlindCount} need-blind, ${intlPolicy.needAwareCount} need-aware`,
  );

  // ========== International Acceptance Rates ==========
  // Seeds intlAcceptanceRate for 23 HIGH/MEDIUM-confidence schools from
  // public CDS / IR / admissions stats pages. Idempotent.
  const intlRates = await seedIntlAcceptanceRates(prisma);
  console.log(
    `  ✅ Intl acceptance rates: ${intlRates.updated} rows seeded` +
      (intlRates.notFound.length > 0
        ? `, ${intlRates.notFound.length} schools not yet in DB`
        : ''),
  );

  // ========== ED / EA Acceptance Rates ==========
  const edEaRates = await seedEdEaRates(prisma);
  console.log(
    `  ✅ ED/EA rates: ${edEaRates.updated} rows seeded` +
      (edEaRates.notFound.length > 0
        ? `, ${edEaRates.notFound.length} schools not yet in DB`
        : ''),
  );

  // ========== intlAcceptanceRate data-quality correction ==========
  // Null contaminated intl rates (enrollment-% / overall-rate leaks) so the
  // counselor intlMultiplier never emits a wrong boost. Runs after all intl
  // writers; enforced by scripts/audit-intl-rate-quality.ts. See
  // docs/PREDICTION_DATA_DRIVEN_STRATEGY_2026-05-30.md.
  const intlCorrection = await correctIntlRates(prisma);
  console.log(
    `  ✅ Intl-rate correction: ${intlCorrection.nulled.length} contaminated value(s) nulled`,
  );

  // ========== round-rate scale-error correction ==========
  // Null implausibly-tiny (<1%) ED/EA/ED2 rates (scale errors) so the
  // roundMultiplier doesn't silently drop to neutral. Enforced by
  // scripts/audit-prediction-data-integrity.ts.
  const roundCorrection = await correctRoundRateScaleErrors(prisma);
  console.log(
    `  ✅ Round-rate correction: ${roundCorrection.nulled.length} scale-error school(s) nulled`,
  );

  // ========== intelligent data-audit corrections (2026-05-31) ==========
  // Corrects stale anchors / mislabeled fields found by the 41-agent CDS/IPEDS
  // verification that the invariant gates can't catch. Runs after all rate
  // seeds so it overrides their stale values.
  const auditCorrections = await applyAuditCorrections(prisma);
  console.log(
    `  ✅ Audit corrections: ${auditCorrections.updated} school field-set(s) applied`,
  );

  // ========== GPA Distributions (CDS Section C9) ==========
  const gpaDists = await seedGpaDistributions(prisma);
  console.log(
    `  ✅ GPA distributions: ${gpaDists.updated} rows seeded` +
      (gpaDists.notFound.length > 0
        ? `, ${gpaDists.notFound.length} schools not yet in DB`
        : ''),
  );

  // ========== LAC GPA "intentionally not reported" markers ==========
  // 7 elite LACs deliberately suppress CDS Section C11 — see
  // seed-lac-gpa-terminal.ts header for the policy explanation.
  const lacGpa = await seedLacGpaTerminal(prisma);
  console.log(
    `  ✅ LAC GPA terminal markers: ${lacGpa.updated} school(s)` +
      (lacGpa.notFound.length > 0
        ? `, ${lacGpa.notFound.length} schools not in DB`
        : ''),
  );

  // ========== 2026-2027 Application Cycle Deadlines ==========
  const deadlines = await seedDeadlines20262027(prisma);
  console.log(
    `  ✅ 2026-2027 deadlines: ${deadlines.upserted} rows seeded` +
      (deadlines.notFound.length > 0
        ? `, ${deadlines.notFound.length} schools not in DB`
        : ''),
  );

  // ========== 2026-2027 Global Events ==========
  const events = await seedGlobalEvents20262027(prisma);
  console.log(`  ✅ 2026-2027 global events: ${events.upserted} rows seeded`);

  // ========== Feature Flags ==========
  await seedFeatureFlags();

  console.log('🎉 Seed completed!');
}

/**
 * Idempotent feature flag seed. New flags get created at safe defaults
 * (counselor mode at 0% so it doesn't auto-engage on a fresh deploy);
 * existing flags' rules/state are preserved (admin manages via /admin/feature-flags).
 */
async function seedFeatureFlags() {
  const flags: Array<{
    key: string;
    description: string;
    enabled: boolean;
    rules: any;
  }> = [
    {
      key: 'prediction-counselor-mode-v1',
      description:
        'Cold-start counselor engine: deterministic CDS-anchored prediction. When enabled for a user, served prediction = counselor output (anchor × 8 modifiers); legacy fusion+distillation runs in parallel and is captured in servedTrace.shadow for retrospective comparison.',
      enabled: true,
      rules: { percentage: 0 },
    },
    // closure-v2: research-only pipelines. Both default OFF and MUST stay off
    // for served traffic until the ADR-0020 bar is met (≥500 verified outcomes
    // per subgroup + subgroup-conditioned calibration design). See
    // docs/adr/0020-addendum-research-pipeline.md. The counselor engine reads
    // SchoolCohortRoundPrior / SchoolRelationshipSignal only when these are on.
    {
      key: 'prediction-cohort-priors',
      description:
        'closure-v2 research pipeline. When ON, the counselor engine consumes SchoolCohortRoundPrior (cohort-level admit rates aggregated from verified AdmissionCase outcomes). Default OFF — flipping it on for served traffic requires a new ADR per ADR-0020.',
      enabled: false,
      rules: { percentage: 0 },
    },
    {
      key: 'prediction-feeder-signals',
      description:
        'closure-v2 research pipeline. When ON, the counselor engine consumes SchoolRelationshipSignal (high-school → college feeder admit patterns). Default OFF — flipping it on for served traffic requires a new ADR per ADR-0020.',
      enabled: false,
      rules: { percentage: 0 },
    },
    {
      // Phase 2 V1 PR3 — Essay Debate feature flag.
      // Default OFF (`enabled=true` + `percentage: 0`). After Day-7 the
      // ops team flips this to `{ percentage: 10 }` for canary rollout
      // — but only if `scripts/debate-eval-gate.ts` exits 0. Frontend
      // EssayDetailPanel reads via useFeatureFlag('essay_debate_enabled').
      key: 'essay_debate_enabled',
      description:
        'Phase 2 V1 essay-debate feature. When ON, gallery essays surface a "不同意，告诉我为什么" button that opens EssayDebateDialog. Default OFF (percentage: 0); flip to 10% canary after debate-eval-gate.ts passes (Day 7 of the 7-day plan).',
      enabled: true,
      rules: { percentage: 0 },
    },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      // create-only: don't clobber admin's manual percentage tuning
      create: {
        key: flag.key,
        description: flag.description,
        enabled: flag.enabled,
        rules: flag.rules,
      },
      update: {},
    });
  }
  console.log(`✅ Seeded ${flags.length} feature flag(s)`);
}

async function seedChatTestData() {
  // Check if already seeded
  const exists = await prisma.user.findUnique({
    where: { email: 'xiaoming@test.com' },
  });
  if (exists) {
    console.log('⏭️  Chat test users already exist, skipping...');
    return;
  }

  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('Test123!', 10);

  console.log('💬 Creating chat test users...');

  // Get demo user
  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
  });
  if (!demoUser) {
    console.log('⚠️  Demo user not found, skipping chat seed');
    return;
  }

  // Get/update admin user (add profile if missing)
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
    include: { profile: true },
  });
  if (adminUser && !adminUser.profile) {
    await prisma.profile.create({
      data: {
        userId: adminUser.id,
        nickname: '平台管理员',
        bio: '留学平台官方管理员',
        visibility: 'PUBLIC',
      },
    });
  }

  // --- 1. VERIFIED + mutual follow (can chat normally) ---
  const xiaoming = await prisma.user.create({
    data: {
      email: 'xiaoming@test.com',
      passwordHash,
      emailVerified: true,
      role: 'VERIFIED',
      locale: 'zh',
      profile: {
        create: {
          nickname: '小明同学',
          bio: '目标 Top 20，CS 方向',
          grade: 'JUNIOR',
          gpa: 3.92,
          gpaScale: 4.0,
          targetMajor: 'Computer Science',
          currentSchool: '北京四中',
          budgetTier: 'HIGH',
          visibility: 'PUBLIC',
          regionPref: ['US'],
        },
      },
    },
  });
  console.log('  ✅ 小明同学 (VERIFIED, mutual follow)');

  const lisa = await prisma.user.create({
    data: {
      email: 'lisa@test.com',
      passwordHash,
      emailVerified: true,
      role: 'VERIFIED',
      locale: 'zh',
      profile: {
        create: {
          nickname: '学姐Lisa',
          bio: '已拿到 Stanford offer，乐意分享经验',
          grade: 'SENIOR',
          gpa: 3.88,
          gpaScale: 4.0,
          targetMajor: 'Data Science',
          currentSchool: '上海中学',
          budgetTier: 'UNLIMITED',
          visibility: 'PUBLIC',
          regionPref: ['US', 'UK'],
        },
      },
    },
  });
  console.log('  ✅ 学姐Lisa (VERIFIED, mutual follow)');

  // --- 2. USER (unverified) + mutual follow (can reply but not initiate) ---
  const wenshu = await prisma.user.create({
    data: {
      email: 'wenshu@test.com',
      passwordHash,
      emailVerified: true,
      role: 'USER',
      locale: 'zh',
      profile: {
        create: {
          nickname: '文书达人',
          bio: 'Common App 文书写作达人',
          grade: 'JUNIOR',
          gpa: 3.75,
          gpaScale: 4.0,
          targetMajor: 'Economics',
          currentSchool: '深圳外国语学校',
          budgetTier: 'MEDIUM',
          visibility: 'PUBLIC',
          regionPref: ['US', 'CA'],
        },
      },
    },
  });
  console.log('  ✅ 文书达人 (USER, mutual follow - cannot initiate)');

  // --- 3. VERIFIED + one-way follow (demo → her, she didn't follow back) ---
  const toefl = await prisma.user.create({
    data: {
      email: 'toefl@test.com',
      passwordHash,
      emailVerified: true,
      role: 'VERIFIED',
      locale: 'zh',
      profile: {
        create: {
          nickname: '托福学霸',
          bio: '托福115 / SAT 1560，标化一把过',
          grade: 'SOPHOMORE',
          gpa: 3.95,
          gpaScale: 4.0,
          targetMajor: 'Biology',
          currentSchool: '南京外国语学校',
          budgetTier: 'HIGH',
          visibility: 'PUBLIC',
          regionPref: ['US'],
        },
      },
    },
  });
  console.log('  ✅ 托福学霸 (VERIFIED, one-way: demo→her)');

  // --- 4. VERIFIED + one-way follow (she → demo, demo didn't follow back) ---
  const planner = await prisma.user.create({
    data: {
      email: 'planner@test.com',
      passwordHash,
      emailVerified: true,
      role: 'VERIFIED',
      locale: 'zh',
      profile: {
        create: {
          nickname: '留学规划师',
          bio: '帮大家选校选专业',
          grade: 'GAP_YEAR',
          gpa: 3.6,
          gpaScale: 4.0,
          targetMajor: 'Psychology',
          currentSchool: '成都七中',
          budgetTier: 'LOW',
          visibility: 'PUBLIC',
          regionPref: ['US', 'UK', 'CA'],
        },
      },
    },
  });
  console.log('  ✅ 留学规划师 (VERIFIED, one-way: her→demo)');

  // --- 5. VERIFIED + mutual follow + blocked by demo ---
  const blocked = await prisma.user.create({
    data: {
      email: 'blocked@test.com',
      passwordHash,
      emailVerified: true,
      role: 'VERIFIED',
      locale: 'zh',
      profile: {
        create: {
          nickname: '被拉黑的人',
          bio: '测试拉黑场景',
          grade: 'JUNIOR',
          gpa: 3.5,
          gpaScale: 4.0,
          targetMajor: 'Business',
          currentSchool: '广州外国语学校',
          budgetTier: 'MEDIUM',
          visibility: 'PUBLIC',
          regionPref: ['US'],
        },
      },
    },
  });
  console.log('  ✅ 被拉黑的人 (VERIFIED, mutual follow + blocked)');

  // ========== Create Follow Relationships ==========
  console.log('🔗 Creating follow relationships...');

  // Mutual follows: demo ↔ xiaoming, lisa, wenshu, blocked, admin
  const mutualFollowTargets = [xiaoming.id, lisa.id, wenshu.id, blocked.id];
  if (adminUser) mutualFollowTargets.push(adminUser.id);

  for (const targetId of mutualFollowTargets) {
    await prisma.follow.createMany({
      data: [
        { followerId: demoUser.id, followingId: targetId },
        { followerId: targetId, followingId: demoUser.id },
      ],
      skipDuplicates: true,
    });
  }
  console.log('  ✅ Mutual follows created');

  // One-way: demo → toefl (demo follows her, she doesn't follow back)
  await prisma.follow.create({
    data: { followerId: demoUser.id, followingId: toefl.id },
  });
  console.log('  ✅ One-way follow: demo → 托福学霸');

  // One-way: planner → demo (she follows demo, demo doesn't follow back)
  await prisma.follow.create({
    data: { followerId: planner.id, followingId: demoUser.id },
  });
  console.log('  ✅ One-way follow: 留学规划师 → demo');

  // Block: demo blocks blocked user
  await prisma.block.create({
    data: { blockerId: demoUser.id, blockedId: blocked.id },
  });
  console.log('  ✅ Block: demo → 被拉黑的人');

  // ========== Create Conversations & Messages ==========
  console.log('💬 Creating conversations and messages...');

  const now = new Date();
  const hours = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const mins = (base: Date, m: number) =>
    new Date(base.getTime() + m * 60 * 1000);

  // --- Conversation 1: demo ↔ xiaoming (CS school selection, 3 days ago) ---
  const conv1Start = hours(72);
  const conv1 = await prisma.conversation.create({
    data: {
      createdAt: conv1Start,
      updatedAt: mins(conv1Start, 25),
      participants: {
        create: [{ userId: demoUser.id }, { userId: xiaoming.id }],
      },
    },
  });

  const conv1Messages = [
    {
      senderId: xiaoming.id,
      content: '你好！看到你也是申CS的，GPA多少呀？',
      offset: 0,
    },
    { senderId: demoUser.id, content: '3.85，你呢？', offset: 3 },
    {
      senderId: xiaoming.id,
      content: '我3.92，在纠结 CMU 和 Berkeley，你有什么看法吗？',
      offset: 5,
    },
    {
      senderId: demoUser.id,
      content:
        'CMU 的 SCS 很强，CS 专排第一。但 Berkeley 综合排名更高，地理位置也好',
      offset: 8,
    },
    {
      senderId: xiaoming.id,
      content: '对，我也在想这个问题。你标化怎么样？',
      offset: 15,
    },
    {
      senderId: demoUser.id,
      content: '托福110，SAT还在准备中，争取1550+',
      offset: 25,
    },
  ];
  for (const msg of conv1Messages) {
    await prisma.message.create({
      data: {
        conversationId: conv1.id,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: mins(conv1Start, msg.offset),
      },
    });
  }
  console.log('  ✅ Conversation 1: demo ↔ 小明同学 (6 messages)');

  // --- Conversation 2: demo ↔ lisa (Stanford experience, 2 days ago) ---
  const conv2Start = hours(48);
  const conv2 = await prisma.conversation.create({
    data: {
      createdAt: conv2Start,
      updatedAt: mins(conv2Start, 20),
      participants: {
        create: [{ userId: demoUser.id }, { userId: lisa.id }],
      },
    },
  });

  const conv2Messages = [
    {
      senderId: lisa.id,
      content:
        '学弟/学妹你好，我去年拿到 Stanford 的 offer 了！看到你也在申CS，有什么想问的吗？',
      offset: 0,
    },
    {
      senderId: demoUser.id,
      content: '太厉害了！可以分享一下经验吗？特别是文书方面',
      offset: 4,
    },
    {
      senderId: lisa.id,
      content:
        '当然可以。文书最重要，一定要有独特的个人故事。招生官每天看上千篇，要让人记住你',
      offset: 7,
    },
    {
      senderId: lisa.id,
      content: '我建议暑假就开始写初稿，反复修改。我前后改了大概15版',
      offset: 8,
    },
    {
      senderId: demoUser.id,
      content: '谢谢学姐！文书主题怎么选呢？我怕写得太普通',
      offset: 20,
    },
  ];
  for (const msg of conv2Messages) {
    await prisma.message.create({
      data: {
        conversationId: conv2.id,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: mins(conv2Start, msg.offset),
      },
    });
  }
  console.log('  ✅ Conversation 2: demo ↔ 学姐Lisa (5 messages)');

  // --- Conversation 3: demo ↔ wenshu (essay advice, 1 day ago) ---
  // Note: wenshu is USER role, conversation initiated "by demo" side
  const conv3Start = hours(24);
  const conv3 = await prisma.conversation.create({
    data: {
      createdAt: conv3Start,
      updatedAt: mins(conv3Start, 18),
      participants: {
        create: [{ userId: demoUser.id }, { userId: wenshu.id }],
      },
    },
  });

  const conv3Messages = [
    {
      senderId: demoUser.id,
      content: '你好，看到你的bio说文书写得不错？能交流一下吗',
      offset: 0,
    },
    {
      senderId: wenshu.id,
      content: '是的！我帮好几个同学改过 Common App 文书，你是要申哪个方向？',
      offset: 5,
    },
    {
      senderId: demoUser.id,
      content: 'CS方向，能给点建议吗？我还没确定主题',
      offset: 10,
    },
    {
      senderId: wenshu.id,
      content:
        '建议写一个具体的小故事，别写太大的主题。比如一个项目经历带给你的成长，比"我热爱科技"有说服力多了',
      offset: 18,
    },
  ];
  for (const msg of conv3Messages) {
    await prisma.message.create({
      data: {
        conversationId: conv3.id,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: mins(conv3Start, msg.offset),
      },
    });
  }
  console.log('  ✅ Conversation 3: demo ↔ 文书达人 (4 messages, USER role)');

  // --- Conversation 4: demo ↔ admin (platform welcome, 1 hour ago) ---
  if (adminUser) {
    const conv4Start = hours(1);
    const conv4 = await prisma.conversation.create({
      data: {
        createdAt: conv4Start,
        updatedAt: mins(conv4Start, 6),
        participants: {
          create: [{ userId: demoUser.id }, { userId: adminUser.id }],
        },
      },
    });

    const conv4Messages = [
      {
        senderId: adminUser.id,
        content: '欢迎使用留学平台！有任何问题可以随时联系我',
        offset: 0,
      },
      {
        senderId: demoUser.id,
        content: '谢谢！请问怎么进行身份认证？',
        offset: 3,
      },
      {
        senderId: adminUser.id,
        content:
          '在设置页面提交认证材料（学生证或在读证明），我们会在48小时内审核完成',
        offset: 6,
      },
    ];
    for (const msg of conv4Messages) {
      await prisma.message.create({
        data: {
          conversationId: conv4.id,
          senderId: msg.senderId,
          content: msg.content,
          createdAt: mins(conv4Start, msg.offset),
        },
      });
    }
    console.log('  ✅ Conversation 4: demo ↔ admin (3 messages)');
  }

  console.log('');
  console.log('📋 Chat test data summary:');
  console.log(
    '  Conversations with messages: demo ↔ 小明, Lisa, 文书达人, admin',
  );
  console.log(
    '  One-way follow (no chat):    demo → 托福学霸, 留学规划师 → demo',
  );
  console.log('  Blocked (no chat):           demo blocked 被拉黑的人');
  console.log('');
  console.log('  All test user password: Test123!');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

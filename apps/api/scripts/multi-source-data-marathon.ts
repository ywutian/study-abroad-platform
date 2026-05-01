#!/usr/bin/env tsx
/*
 * Full-field multi-source school data marathon.
 *
 * This script deliberately treats "found a URL" as unfinished work. A field is
 * terminal only when it has a usable value with provenance, or a verified
 * terminal reason with queries/candidates recorded in the ledger.
 */
import 'dotenv/config';

import { Prisma, PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

type Lane =
  | 'admissions'
  | 'academic'
  | 'program'
  | 'policy'
  | 'costAid'
  | 'outcomes'
  | 'campus'
  | 'rankingsQuality';

type SourceFamily =
  | 'OFFICIAL_SCHOOL'
  | 'GOVERNMENT'
  | 'STATE_SYSTEM'
  | 'SECONDARY_AGGREGATOR'
  | 'MANUAL_ADMIN'
  | 'HEURISTIC';

type Destination = 'schoolScalar' | 'schoolJson' | 'relation' | 'metadata';

type FieldKey =
  | 'acceptanceRate'
  | 'intlAcceptanceRate'
  | 'oosAcceptanceRate'
  | 'transferAcceptanceRate'
  | 'edAcceptanceRate'
  | 'eaAcceptanceRate'
  | 'hasEarlyDecision'
  | 'sat25'
  | 'sat75'
  | 'satAvg'
  | 'act25'
  | 'act75'
  | 'actAvg'
  | 'gpaDistribution'
  | 'gpaProfile'
  | 'classRankDistribution'
  | 'cdsAdmitBands'
  | 'programRates'
  | 'programEarnings'
  | 'testOptional'
  | 'testingPolicy'
  | 'applicationFee'
  | 'feeWaiverAvailable'
  | 'acceptsCommonApp'
  | 'acceptsCoalition'
  | 'deadlines'
  | 'tuition'
  | 'roomAndBoard'
  | 'averageAidPackage'
  | 'averageNetPrice'
  | 'percentNeedMet'
  | 'graduationRate'
  | 'retentionRate'
  | 'salary6YrPostGrad'
  | 'loanDefaultRate'
  | 'monthlyLoanPayment'
  | 'totalEnrollment'
  | 'studentFacultyRatio'
  | 'intlStudentPct'
  | 'countriesRepresented'
  | 'studentOrgsCount'
  | 'usNewsRank'
  | 'qsRank'
  | 'nicheOverallGrade'
  | 'nicheSafetyGrade'
  | 'nicheLifeGrade'
  | 'nicheFoodGrade'
  | 'rankings';

type Status =
  | 'PENDING'
  | 'UNKNOWN'
  | 'SOURCE_FOUND'
  | 'EXTRACTION_READY'
  | 'TERMINAL_CANDIDATE'
  | 'SUSPICIOUS'
  | 'MANUAL_REVIEW'
  | 'VERIFIED_REAL'
  | 'VERIFIED_SECONDARY'
  | 'OFFICIAL_REAL_LEGACY'
  | 'HEURISTIC_FILL'
  | 'PERMANENT_HEURISTIC'
  | 'NO_PUBLIC_SOURCE'
  | 'NO_PUBLIC_ROUND_RATE'
  | 'NO_PUBLIC_GPA_DISTRIBUTION'
  | 'NO_PUBLIC_PROGRAM_DATA'
  | 'NO_PUBLIC_C9_CROSSTAB'
  | 'OFFICIAL_BLANK_SECTION'
  | 'OFFICIAL_BLOCKED'
  | 'NOT_APPLICABLE';

const OPEN_STATUSES = new Set<Status>([
  'PENDING',
  'UNKNOWN',
  'SOURCE_FOUND',
  'EXTRACTION_READY',
  'TERMINAL_CANDIDATE',
  'SUSPICIOUS',
  'MANUAL_REVIEW',
]);

const TODAY = new Date().toISOString().slice(0, 10);
const API_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(API_ROOT, 'scripts', 'cds-data');
const REPORT_DIR = path.join(API_ROOT, 'scripts', 'coverage-reports');
const DEFAULT_LEDGER = path.join(
  DATA_DIR,
  `multi-source-exhaustion-ledger-${TODAY}.json`,
);
const DEFAULT_REPORT = path.join(
  REPORT_DIR,
  `multi-source-coverage-report-${TODAY}.json`,
);
const DEFAULT_MATRIX_REPORT = path.join(
  REPORT_DIR,
  `field-source-matrix-${TODAY}.json`,
);

interface FieldPolicy {
  key: FieldKey;
  lane: Lane;
  label: string;
  destination: Destination;
  scalarField?: keyof Prisma.SchoolUpdateInput;
  requiredSourceFamilies: SourceFamily[];
  allowSecondary: boolean;
  allowHeuristic: boolean;
  strictRealOnly?: boolean;
  percent?: boolean;
  integer?: boolean;
  boolean?: boolean;
  enum?: boolean;
  terminalStatus: Status;
  searchHints: string[];
  officialTerms: string[];
  secondaryDomains?: string[];
  governmentDomains?: string[];
}

interface Candidate {
  title: string;
  url: string;
  snippet: string;
  score: number;
  source: 'history' | 'tavily' | 'probe';
  stage: number;
  stageKind: string;
  accepted: boolean;
  rejectReason?: string;
}

interface SearchPlan {
  stage: number;
  kind: string;
  query: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  expectedSourceFamily: SourceFamily;
}

interface ExtractedValue {
  value: unknown;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceFamily: SourceFamily;
  formula?: string;
  notes?: string;
}

interface LedgerEntry {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolNameNorm: string;
  aliases: string[];
  website: string | null;
  rootDomain: string | null;
  state: string | null;
  acceptanceRate: number | null;
  usNewsRank: number | null;
  field: FieldKey;
  lane: Lane;
  sourceFamily: SourceFamily;
  status: Status;
  currentValue: unknown;
  currentSource?: string | null;
  queries: SearchPlan[];
  candidates: Candidate[];
  selectedUrl?: string | null;
  attempts: number;
  failureReason?: string | null;
  terminalReason?: string | null;
  extracted?: ExtractedValue | null;
  searchedAt?: string | null;
  verifiedAt?: string | null;
  updatedAt: string;
}

interface Ledger {
  _meta: {
    version: 10;
    startedAt: string;
    lastRunAt: string;
    rounds: number;
    generatedBy: string;
    hardGates: HardGates;
  };
  entries: Record<string, LedgerEntry>;
  events: Array<{
    at: string;
    entryId: string;
    school: string;
    field: FieldKey;
    action: string;
    result: string;
  }>;
  summary: Summary;
}

interface Summary {
  total: number;
  open: number;
  byStatus: Record<string, number>;
  byLane: Record<string, { total: number; open: number }>;
  byField: Record<
    string,
    {
      total: number;
      open: number;
      real: number;
      secondary: number;
      heuristic: number;
      terminal: number;
    }
  >;
  changedValues: number;
}

interface HardGates {
  pass: boolean;
  open: number;
  PENDING: number;
  UNKNOWN: number;
  SOURCE_FOUND: number;
  EXTRACTION_READY: number;
  SUSPICIOUS: number;
  MANUAL_REVIEW: number;
  TERMINAL_CANDIDATE: number;
}

interface CliOptions {
  dryRun: boolean;
  search: boolean;
  consume: boolean;
  apply: boolean;
  resume: boolean;
  reset: boolean;
  adjudicateSuspicious: boolean;
  runBackfill: boolean;
  ledgerPath: string;
  reportPath: string;
  matrixPath: string;
  fields?: Set<FieldKey>;
  lanes?: Set<Lane>;
  limit: number;
  maxRounds: number;
  maxSearches: number;
  maxResults: number;
  tavilyKeys: number;
  delayMs: number;
  timeoutMs: number;
}

const FIELD_MATRIX: FieldPolicy[] = [
  admissionsField(
    'acceptanceRate',
    'Overall admit rate',
    'acceptanceRate',
    'NO_PUBLIC_SOURCE',
    ['admit rate', 'admissions statistics', 'common data set C1'],
    { allowSecondary: false },
  ),
  admissionsField(
    'intlAcceptanceRate',
    'International admit rate',
    'intlAcceptanceRate',
    'NO_PUBLIC_SOURCE',
    [
      'international applicants admitted',
      'nonresident alien admitted',
      'CDS C1 international',
    ],
    { allowSecondary: false },
  ),
  admissionsField(
    'oosAcceptanceRate',
    'Out-of-state admit rate',
    'oosAcceptanceRate',
    'NO_PUBLIC_SOURCE',
    [
      'out of state applicants admitted',
      'nonresident admitted',
      'CDS C1 out-of-state',
    ],
    { allowSecondary: false },
  ),
  admissionsField(
    'transferAcceptanceRate',
    'Transfer admit rate',
    'transferAcceptanceRate',
    'NO_PUBLIC_SOURCE',
    ['transfer applicants admitted', 'Common Data Set D2'],
    { allowSecondary: false },
  ),
  admissionsField(
    'edAcceptanceRate',
    'Early Decision admit rate',
    'edAcceptanceRate',
    'NO_PUBLIC_ROUND_RATE',
    [
      'early decision admit rate',
      'ED I ED II admitted applicants',
      'Common Data Set C21',
    ],
    { allowSecondary: true, secondaryDomains: ['collegetransitions.com'] },
  ),
  admissionsField(
    'eaAcceptanceRate',
    'Early Action admit rate',
    'eaAcceptanceRate',
    'NO_PUBLIC_ROUND_RATE',
    [
      'early action admit rate',
      'EA admitted applicants',
      'Common Data Set C21',
    ],
    { allowSecondary: true, secondaryDomains: ['collegetransitions.com'] },
  ),
  booleanField(
    'hasEarlyDecision',
    'Has Early Decision',
    'admissions',
    'hasEarlyDecision',
    'NOT_APPLICABLE',
    ['early decision deadline', 'early decision plan'],
  ),

  academicField(
    'sat25',
    'SAT 25th percentile',
    'sat25',
    ['SAT middle 50', 'SAT 25th percentile', 'admitted student profile SAT'],
    { allowSecondary: true },
  ),
  academicField(
    'sat75',
    'SAT 75th percentile',
    'sat75',
    ['SAT middle 50', 'SAT 75th percentile', 'admitted student profile SAT'],
    { allowSecondary: true },
  ),
  academicField(
    'satAvg',
    'SAT average',
    'satAvg',
    ['average SAT score', 'SAT average'],
    { allowSecondary: true },
  ),
  academicField(
    'act25',
    'ACT 25th percentile',
    'act25',
    ['ACT middle 50', 'ACT 25th percentile'],
    { allowSecondary: true },
  ),
  academicField(
    'act75',
    'ACT 75th percentile',
    'act75',
    ['ACT middle 50', 'ACT 75th percentile'],
    { allowSecondary: true },
  ),
  academicField(
    'actAvg',
    'ACT average',
    'actAvg',
    ['average ACT score', 'ACT average'],
    { allowSecondary: true },
  ),
  jsonField(
    'gpaDistribution',
    'GPA distribution',
    'academic',
    'gpaDistribution',
    'NO_PUBLIC_GPA_DISTRIBUTION',
    [
      'Common Data Set C11 GPA distribution',
      'percentage had GPA',
      'freshman GPA distribution',
    ],
    { strictRealOnly: true },
  ),
  metadataField(
    'gpaProfile',
    'GPA profile / average / middle 50',
    'academic',
    'NO_PUBLIC_SOURCE',
    ['average GPA admitted students', 'middle 50 GPA', 'freshman profile GPA'],
    true,
  ),
  metadataField(
    'classRankDistribution',
    'Class rank distribution',
    'academic',
    'NO_PUBLIC_SOURCE',
    [
      'Common Data Set C10 class rank',
      'top tenth class rank',
      'class rank distribution',
    ],
    false,
  ),
  relationField(
    'cdsAdmitBands',
    'CDS GPA/test admit-rate cells',
    'academic',
    'NO_PUBLIC_C9_CROSSTAB',
    [
      'Common Data Set C9 admit rate by GPA SAT',
      'GPA test score admit rate table',
      'UC freshman admission by GPA',
    ],
    false,
  ),

  relationField(
    'programRates',
    'Program / college / major admit rates',
    'program',
    'NO_PUBLIC_PROGRAM_DATA',
    [
      'admission by major applicants admitted',
      'program admit rate',
      'college admit rate by school',
    ],
    false,
  ),
  relationField(
    'programEarnings',
    'Program earnings',
    'program',
    'NO_PUBLIC_SOURCE',
    [
      'program earnings CIP',
      'median earnings by major',
      'College Scorecard field of study earnings',
    ],
    true,
  ),

  booleanField(
    'testOptional',
    'Test optional policy',
    'policy',
    'testOptional',
    'NO_PUBLIC_SOURCE',
    ['test optional admissions policy', 'SAT ACT optional'],
  ),
  enumMetadataField(
    'testingPolicy',
    'Testing policy enum',
    'policy',
    'NO_PUBLIC_SOURCE',
    ['testing policy SAT ACT required optional blind'],
  ),
  integerField(
    'applicationFee',
    'Application fee',
    'policy',
    'applicationFee',
    'NO_PUBLIC_SOURCE',
    ['application fee first-year undergraduate'],
  ),
  booleanField(
    'feeWaiverAvailable',
    'Fee waiver available',
    'policy',
    'feeWaiverAvailable',
    'NO_PUBLIC_SOURCE',
    ['application fee waiver available'],
  ),
  booleanField(
    'acceptsCommonApp',
    'Accepts Common App',
    'policy',
    'acceptsCommonApp',
    'NO_PUBLIC_SOURCE',
    ['Common Application accepted apply'],
  ),
  booleanField(
    'acceptsCoalition',
    'Accepts Coalition App',
    'policy',
    'acceptsCoalition',
    'NO_PUBLIC_SOURCE',
    ['Coalition Application accepted apply'],
  ),
  relationField(
    'deadlines',
    'Application deadlines',
    'policy',
    'NO_PUBLIC_SOURCE',
    ['first-year application deadlines ED EA RD', 'apply deadlines'],
    true,
  ),

  integerField('tuition', 'Tuition', 'costAid', 'tuition', 'NO_PUBLIC_SOURCE', [
    'tuition and fees undergraduate',
  ]),
  integerField(
    'roomAndBoard',
    'Room and board',
    'costAid',
    'roomAndBoard',
    'NO_PUBLIC_SOURCE',
    ['room and board cost undergraduate'],
  ),
  integerField(
    'averageAidPackage',
    'Average aid package',
    'costAid',
    'averageAidPackage',
    'NO_PUBLIC_SOURCE',
    ['average financial aid package'],
  ),
  integerField(
    'averageNetPrice',
    'Average net price',
    'costAid',
    'averageNetPrice',
    'NO_PUBLIC_SOURCE',
    ['average net price'],
  ),
  percentField(
    'percentNeedMet',
    'Percent need met',
    'costAid',
    'percentNeedMet',
    'NO_PUBLIC_SOURCE',
    ['percent need met financial aid'],
  ),

  percentField(
    'graduationRate',
    'Graduation rate',
    'outcomes',
    'graduationRate',
    'NO_PUBLIC_SOURCE',
    ['graduation rate'],
  ),
  percentField(
    'retentionRate',
    'Retention rate',
    'outcomes',
    'retentionRate',
    'NO_PUBLIC_SOURCE',
    ['first year retention rate'],
  ),
  integerField(
    'salary6YrPostGrad',
    'Salary six years after graduation',
    'outcomes',
    'salary6YrPostGrad',
    'NO_PUBLIC_SOURCE',
    ['salary after graduation six years'],
  ),
  percentField(
    'loanDefaultRate',
    'Loan default rate',
    'outcomes',
    'loanDefaultRate',
    'NO_PUBLIC_SOURCE',
    ['loan default rate'],
  ),
  integerField(
    'monthlyLoanPayment',
    'Monthly loan payment',
    'outcomes',
    'monthlyLoanPayment',
    'NO_PUBLIC_SOURCE',
    ['median monthly loan payment'],
  ),

  integerField(
    'totalEnrollment',
    'Total enrollment',
    'campus',
    'totalEnrollment',
    'NO_PUBLIC_SOURCE',
    ['total undergraduate enrollment'],
  ),
  integerField(
    'studentFacultyRatio',
    'Student faculty ratio',
    'campus',
    'studentFacultyRatio',
    'NO_PUBLIC_SOURCE',
    ['student faculty ratio'],
  ),
  percentField(
    'intlStudentPct',
    'International student percentage',
    'campus',
    'intlStudentPct',
    'NO_PUBLIC_SOURCE',
    ['international student percentage'],
  ),
  integerField(
    'countriesRepresented',
    'Countries represented',
    'campus',
    'countriesRepresented',
    'NO_PUBLIC_SOURCE',
    ['countries represented international students'],
  ),
  integerField(
    'studentOrgsCount',
    'Student organizations count',
    'campus',
    'studentOrgsCount',
    'NO_PUBLIC_SOURCE',
    ['student organizations clubs count'],
  ),

  integerField(
    'usNewsRank',
    'US News rank',
    'rankingsQuality',
    'usNewsRank',
    'NO_PUBLIC_SOURCE',
    ['US News ranking national universities'],
  ),
  integerField(
    'qsRank',
    'QS rank',
    'rankingsQuality',
    'qsRank',
    'NO_PUBLIC_SOURCE',
    ['QS World University Rankings'],
  ),
  textField(
    'nicheOverallGrade',
    'Niche overall grade',
    'rankingsQuality',
    'nicheOverallGrade',
    'NO_PUBLIC_SOURCE',
    ['Niche overall grade'],
  ),
  textField(
    'nicheSafetyGrade',
    'Niche safety grade',
    'rankingsQuality',
    'nicheSafetyGrade',
    'NO_PUBLIC_SOURCE',
    ['Niche safety grade'],
  ),
  textField(
    'nicheLifeGrade',
    'Niche life grade',
    'rankingsQuality',
    'nicheLifeGrade',
    'NO_PUBLIC_SOURCE',
    ['Niche student life grade'],
  ),
  textField(
    'nicheFoodGrade',
    'Niche food grade',
    'rankingsQuality',
    'nicheFoodGrade',
    'NO_PUBLIC_SOURCE',
    ['Niche campus food grade'],
  ),
  relationField(
    'rankings',
    'Ranking records',
    'rankingsQuality',
    'NO_PUBLIC_SOURCE',
    ['ranking Forbes THE QS US News'],
    true,
  ),
];

function admissionsField(
  key: FieldKey,
  label: string,
  scalarField: keyof Prisma.SchoolUpdateInput,
  terminalStatus: Status,
  searchHints: string[],
  options: Partial<FieldPolicy> = {},
): FieldPolicy {
  return {
    key,
    lane: 'admissions',
    label,
    destination: 'schoolScalar',
    scalarField,
    requiredSourceFamilies: ['OFFICIAL_SCHOOL', 'GOVERNMENT', 'STATE_SYSTEM'],
    allowSecondary: options.allowSecondary ?? false,
    allowHeuristic: true,
    percent: true,
    terminalStatus,
    searchHints,
    officialTerms: [
      'admit',
      'admission',
      'applicant',
      'admitted',
      'common data set',
      'class profile',
    ],
    secondaryDomains: options.secondaryDomains ?? ['collegetransitions.com'],
    governmentDomains: ['nces.ed.gov', 'collegescorecard.ed.gov'],
    ...options,
  };
}

function academicField(
  key: FieldKey,
  label: string,
  scalarField: keyof Prisma.SchoolUpdateInput,
  searchHints: string[],
  options: Partial<FieldPolicy> = {},
): FieldPolicy {
  return {
    key,
    lane: 'academic',
    label,
    destination: 'schoolScalar',
    scalarField,
    requiredSourceFamilies: ['OFFICIAL_SCHOOL', 'GOVERNMENT', 'STATE_SYSTEM'],
    allowSecondary: options.allowSecondary ?? true,
    allowHeuristic: true,
    integer: true,
    terminalStatus: 'NO_PUBLIC_SOURCE',
    searchHints,
    officialTerms: [
      'sat',
      'act',
      'middle 50',
      'freshman profile',
      'admitted student',
    ],
    secondaryDomains: ['bigfuture.collegeboard.org', 'appily.com', 'niche.com'],
    governmentDomains: ['nces.ed.gov', 'collegescorecard.ed.gov'],
    ...options,
  };
}

function percentField(
  key: FieldKey,
  label: string,
  lane: Lane,
  scalarField: keyof Prisma.SchoolUpdateInput,
  terminalStatus: Status,
  searchHints: string[],
): FieldPolicy {
  return {
    key,
    lane,
    label,
    destination: 'schoolScalar',
    scalarField,
    requiredSourceFamilies: ['OFFICIAL_SCHOOL', 'GOVERNMENT', 'STATE_SYSTEM'],
    allowSecondary: true,
    allowHeuristic: true,
    percent: true,
    terminalStatus,
    searchHints,
    officialTerms: searchHints,
    secondaryDomains: ['bigfuture.collegeboard.org', 'appily.com', 'niche.com'],
    governmentDomains: ['nces.ed.gov', 'collegescorecard.ed.gov'],
  };
}

function integerField(
  key: FieldKey,
  label: string,
  lane: Lane,
  scalarField: keyof Prisma.SchoolUpdateInput,
  terminalStatus: Status,
  searchHints: string[],
): FieldPolicy {
  return {
    key,
    lane,
    label,
    destination: 'schoolScalar',
    scalarField,
    requiredSourceFamilies: ['OFFICIAL_SCHOOL', 'GOVERNMENT', 'STATE_SYSTEM'],
    allowSecondary: true,
    allowHeuristic: true,
    integer: true,
    terminalStatus,
    searchHints,
    officialTerms: searchHints,
    secondaryDomains: [
      'bigfuture.collegeboard.org',
      'appily.com',
      'niche.com',
      'usnews.com',
    ],
    governmentDomains: ['nces.ed.gov', 'collegescorecard.ed.gov'],
  };
}

function booleanField(
  key: FieldKey,
  label: string,
  lane: Lane,
  scalarField: keyof Prisma.SchoolUpdateInput,
  terminalStatus: Status,
  searchHints: string[],
): FieldPolicy {
  return {
    key,
    lane,
    label,
    destination: 'schoolScalar',
    scalarField,
    requiredSourceFamilies: ['OFFICIAL_SCHOOL'],
    allowSecondary: true,
    allowHeuristic: false,
    boolean: true,
    terminalStatus,
    searchHints,
    officialTerms: searchHints,
    secondaryDomains: [
      'bigfuture.collegeboard.org',
      'commonapp.org',
      'collegeboard.org',
    ],
  };
}

function textField(
  key: FieldKey,
  label: string,
  lane: Lane,
  scalarField: keyof Prisma.SchoolUpdateInput,
  terminalStatus: Status,
  searchHints: string[],
): FieldPolicy {
  return {
    key,
    lane,
    label,
    destination: 'schoolScalar',
    scalarField,
    requiredSourceFamilies: ['SECONDARY_AGGREGATOR'],
    allowSecondary: true,
    allowHeuristic: false,
    terminalStatus,
    searchHints,
    officialTerms: searchHints,
    secondaryDomains: ['niche.com'],
  };
}

function jsonField(
  key: FieldKey,
  label: string,
  lane: Lane,
  scalarField: keyof Prisma.SchoolUpdateInput,
  terminalStatus: Status,
  searchHints: string[],
  options: Partial<FieldPolicy> = {},
): FieldPolicy {
  return {
    key,
    lane,
    label,
    destination: 'schoolJson',
    scalarField,
    requiredSourceFamilies: ['OFFICIAL_SCHOOL', 'STATE_SYSTEM'],
    allowSecondary: false,
    allowHeuristic: false,
    strictRealOnly: true,
    terminalStatus,
    searchHints,
    officialTerms: [
      'common data set',
      'gpa',
      'distribution',
      'percent',
      'class profile',
    ],
    ...options,
  };
}

function metadataField(
  key: FieldKey,
  label: string,
  lane: Lane,
  terminalStatus: Status,
  searchHints: string[],
  allowSecondary: boolean,
): FieldPolicy {
  return {
    key,
    lane,
    label,
    destination: 'metadata',
    requiredSourceFamilies: ['OFFICIAL_SCHOOL', 'STATE_SYSTEM'],
    allowSecondary,
    allowHeuristic: false,
    terminalStatus,
    searchHints,
    officialTerms: searchHints,
    secondaryDomains: allowSecondary
      ? ['bigfuture.collegeboard.org', 'appily.com', 'niche.com']
      : [],
  };
}

function enumMetadataField(
  key: FieldKey,
  label: string,
  lane: Lane,
  terminalStatus: Status,
  searchHints: string[],
): FieldPolicy {
  return {
    key,
    lane,
    label,
    destination: 'metadata',
    requiredSourceFamilies: ['OFFICIAL_SCHOOL'],
    allowSecondary: true,
    allowHeuristic: false,
    enum: true,
    terminalStatus,
    searchHints,
    officialTerms: searchHints,
    secondaryDomains: ['bigfuture.collegeboard.org', 'collegeboard.org'],
  };
}

function relationField(
  key: FieldKey,
  label: string,
  lane: Lane,
  terminalStatus: Status,
  searchHints: string[],
  allowSecondary = false,
): FieldPolicy {
  return {
    key,
    lane,
    label,
    destination: 'relation',
    requiredSourceFamilies: ['OFFICIAL_SCHOOL', 'STATE_SYSTEM', 'GOVERNMENT'],
    allowSecondary,
    allowHeuristic: key === 'programEarnings',
    strictRealOnly: key === 'programRates' || key === 'cdsAdmitBands',
    terminalStatus,
    searchHints,
    officialTerms: searchHints,
    secondaryDomains: allowSecondary
      ? ['collegetransitions.com', 'bigfuture.collegeboard.org', 'appily.com']
      : [],
    governmentDomains: ['nces.ed.gov', 'collegescorecard.ed.gov'],
  };
}

class TavilyClient {
  private keyIndex = 0;
  private exhausted = new Set<number>();

  constructor(
    private readonly keys: string[],
    private readonly maxResults: number,
    private readonly timeoutMs: number,
  ) {}

  get enabled() {
    return this.keys.length > 0;
  }

  async search(plan: SearchPlan): Promise<Candidate[]> {
    const key = this.nextKey();
    if (!key) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          api_key: key.value,
          query: plan.query,
          include_domains: plan.includeDomains?.length
            ? plan.includeDomains
            : undefined,
          exclude_domains: plan.excludeDomains?.length
            ? plan.excludeDomains
            : undefined,
          max_results: this.maxResults,
          search_depth: 'advanced',
          include_answer: false,
          include_raw_content: false,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        if (this.isQuotaError(res.status, text)) this.exhausted.add(key.index);
        return [];
      }
      const data = JSON.parse(text) as {
        results?: Array<{
          title?: string;
          url?: string;
          content?: string;
          score?: number;
        }>;
      };
      return (data.results ?? [])
        .filter((result) => result.url)
        .map((result, index) => ({
          title: result.title ?? '',
          url: normalizeUrl(result.url ?? ''),
          snippet: result.content?.slice(0, 900) ?? '',
          score:
            typeof result.score === 'number'
              ? Math.round(result.score * 100)
              : Math.max(0, 80 - index * 5),
          source: 'tavily' as const,
          stage: plan.stage,
          stageKind: plan.kind,
          accepted: false,
        }));
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  private nextKey() {
    for (let offset = 0; offset < this.keys.length; offset++) {
      const index = (this.keyIndex + offset) % this.keys.length;
      if (!this.exhausted.has(index)) {
        this.keyIndex = (index + 1) % this.keys.length;
        return { value: this.keys[index], index };
      }
    }
    return null;
  }

  private isQuotaError(status: number, body: string) {
    return (
      status === 429 ||
      status === 432 ||
      /usage limit|quota|rate.?limit/i.test(body)
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureDirs();

  const policies = FIELD_MATRIX.filter((policy) => {
    if (options.fields && !options.fields.has(policy.key)) return false;
    if (options.lanes && !options.lanes.has(policy.lane)) return false;
    return true;
  });

  let ledger =
    options.resume && existsSync(options.ledgerPath) && !options.reset
      ? loadLedger(options.ledgerPath)
      : await buildInitialLedger(policies, options.limit);

  let changedValues = 0;
  if (options.search && options.consume) {
    const tavily = new TavilyClient(
      loadTavilyKeys(options.tavilyKeys),
      options.maxResults,
      options.timeoutMs,
    );
    for (let round = 0; round < options.maxRounds; round++) {
      const beforeOpen = summarize(ledger).open;
      ledger = await runRounds(
        ledger,
        policies,
        { ...options, maxRounds: 1 },
        tavily,
      );
      consumeWork(ledger, policies, options);
      if (options.adjudicateSuspicious) adjudicateSuspicious(ledger);
      if (options.apply)
        changedValues += await applyLedger(ledger, policies, options);
      ledger.summary = summarize(ledger);
      ledger._meta.hardGates = hardGates(ledger);
      if (ledger._meta.hardGates.pass) break;
      if (
        summarize(ledger).open === beforeOpen &&
        !hasSearchableOpenEntries(ledger)
      )
        break;
    }
  } else {
    if (options.search) {
      const tavily = new TavilyClient(
        loadTavilyKeys(options.tavilyKeys),
        options.maxResults,
        options.timeoutMs,
      );
      ledger = await runRounds(ledger, policies, options, tavily);
    }

    if (options.consume) {
      consumeWork(ledger, policies, options);
    }

    if (options.adjudicateSuspicious) {
      adjudicateSuspicious(ledger);
    }

    if (options.apply) {
      changedValues = await applyLedger(ledger, policies, options);
    }
  }

  ledger.summary = summarize(ledger);
  ledger.summary.changedValues = changedValues;
  ledger._meta.lastRunAt = new Date().toISOString();
  ledger._meta.hardGates = hardGates(ledger);

  writeFileSync(options.ledgerPath, JSON.stringify(ledger, null, 2));
  writeFileSync(
    options.reportPath,
    JSON.stringify(buildReport(ledger, policies), null, 2),
  );
  writeFileSync(options.matrixPath, JSON.stringify(policies, null, 2));

  if (options.runBackfill && changedValues > 0 && !options.dryRun) {
    await runCounselorBackfill();
  }

  printSummary(ledger, options);
}

async function buildInitialLedger(
  policies: FieldPolicy[],
  limit: number,
): Promise<Ledger> {
  const schools = await prisma.school.findMany({
    where: { country: { in: ['US', 'United States'] } },
    orderBy: [{ usNewsRank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    take: limit > 0 ? limit : undefined,
    select: {
      id: true,
      name: true,
      nameNorm: true,
      aliases: true,
      website: true,
      state: true,
      acceptanceRate: true,
      usNewsRank: true,
      metadata: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      transferAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      hasEarlyDecision: true,
      sat25: true,
      sat75: true,
      satAvg: true,
      act25: true,
      act75: true,
      actAvg: true,
      gpaDistribution: true,
      testOptional: true,
      testingPolicy: true,
      applicationFee: true,
      feeWaiverAvailable: true,
      acceptsCommonApp: true,
      acceptsCoalition: true,
      tuition: true,
      roomAndBoard: true,
      averageAidPackage: true,
      averageNetPrice: true,
      percentNeedMet: true,
      graduationRate: true,
      retentionRate: true,
      salary6YrPostGrad: true,
      loanDefaultRate: true,
      monthlyLoanPayment: true,
      totalEnrollment: true,
      studentFacultyRatio: true,
      intlStudentPct: true,
      countriesRepresented: true,
      studentOrgsCount: true,
      usNewsRank: true,
      qsRank: true,
      nicheOverallGrade: true,
      nicheSafetyGrade: true,
      nicheLifeGrade: true,
      nicheFoodGrade: true,
      _count: {
        select: {
          cdsAdmitBands: true,
          programs: true,
          deadlines: true,
          rankings: true,
        },
      },
    },
  });

  const programEarningSchoolIds = new Set(
    (
      await prisma.schoolProgram.findMany({
        where: { medianEarnings: { not: null } },
        select: { schoolId: true },
        distinct: ['schoolId'],
      })
    ).map((row) => row.schoolId),
  );

  const ledger: Ledger = {
    _meta: {
      version: 10,
      startedAt: new Date().toISOString(),
      lastRunAt: new Date().toISOString(),
      rounds: 0,
      generatedBy: 'multi-source-data-marathon',
      hardGates: {
        pass: false,
        open: 0,
        PENDING: 0,
        UNKNOWN: 0,
        SOURCE_FOUND: 0,
        EXTRACTION_READY: 0,
        SUSPICIOUS: 0,
        MANUAL_REVIEW: 0,
        TERMINAL_CANDIDATE: 0,
      },
    },
    entries: {},
    events: [],
    summary: emptySummary(),
  };

  for (const school of schools) {
    const rootDomain = rootDomainOf(school.website);
    for (const policy of policies) {
      const currentValue = currentValueFor(
        school,
        policy,
        programEarningSchoolIds,
      );
      const provenance = provenanceFor(school.metadata, policy.key);
      const status = initialStatus(currentValue, provenance, policy);
      const entry: LedgerEntry = {
        id: `${school.id}:${policy.key}:${primarySourceFamily(policy)}`,
        schoolId: school.id,
        schoolName: school.name,
        schoolNameNorm: school.nameNorm,
        aliases: school.aliases ?? [],
        website: school.website,
        rootDomain,
        state: school.state,
        acceptanceRate: decimalToNumber(school.acceptanceRate),
        usNewsRank: school.usNewsRank,
        field: policy.key,
        lane: policy.lane,
        sourceFamily: primarySourceFamily(policy),
        status,
        currentValue,
        currentSource:
          typeof provenance?.source === 'string' ? provenance.source : null,
        queries: [],
        candidates: [],
        selectedUrl:
          typeof provenance?.sourceUrl === 'string'
            ? provenance.sourceUrl
            : null,
        attempts:
          typeof provenance?.attempts === 'number' ? provenance.attempts : 0,
        failureReason: null,
        terminalReason:
          typeof provenance?.reason === 'string' ? provenance.reason : null,
        extracted: null,
        searchedAt: null,
        verifiedAt:
          typeof provenance?.verifiedAt === 'string'
            ? provenance.verifiedAt
            : null,
        updatedAt: new Date().toISOString(),
      };
      entry.queries = planQueries(entry, policy);
      ledger.entries[entry.id] = entry;
    }
  }

  ledger.summary = summarize(ledger);
  ledger._meta.hardGates = hardGates(ledger);
  return ledger;
}

async function runRounds(
  ledger: Ledger,
  policies: FieldPolicy[],
  options: CliOptions,
  tavily: TavilyClient,
) {
  const policyByKey = new Map(policies.map((policy) => [policy.key, policy]));
  let searchesUsed = 0;
  for (let round = 0; round < options.maxRounds; round++) {
    const openEntries = Object.values(ledger.entries)
      .filter((entry) => OPEN_STATUSES.has(entry.status))
      .filter(
        (entry) =>
          entry.status !== 'SOURCE_FOUND' &&
          entry.status !== 'EXTRACTION_READY' &&
          entry.status !== 'SUSPICIOUS',
      )
      .sort(compareEntryPriority);

    if (openEntries.length === 0) break;
    let changedThisRound = 0;
    for (const entry of openEntries) {
      if (searchesUsed >= options.maxSearches) break;
      const policy = policyByKey.get(entry.field);
      if (!policy) continue;

      const historyCandidates = findHistoryCandidates(entry, policy);
      const scoredHistory = scoreCandidates(entry, policy, historyCandidates);
      if (scoredHistory.some((candidate) => candidate.accepted)) {
        entry.candidates.push(
          ...mergeCandidates(entry.candidates, scoredHistory),
        );
        promoteSourceFound(entry, 'history');
        changedThisRound++;
        continue;
      }

      if (!tavily.enabled) {
        promoteTerminalCandidate(
          entry,
          policy,
          'NO_TAVILY_KEYS',
          'No Tavily keys configured and Stage 0 history produced no candidate.',
        );
        changedThisRound++;
        continue;
      }

      const nextPlan = nextUntriedPlan(entry);
      if (!nextPlan) {
        promoteTerminalCandidate(
          entry,
          policy,
          'SEARCH_EXHAUSTED',
          'All search stages returned no trusted candidate.',
        );
        changedThisRound++;
        continue;
      }

      const rawCandidates = await tavily.search(nextPlan);
      searchesUsed++;
      entry.attempts += 1;
      entry.queries = markPlanTried(entry.queries, nextPlan);
      const scored = scoreCandidates(entry, policy, rawCandidates);
      entry.candidates.push(...mergeCandidates(entry.candidates, scored));
      entry.searchedAt = new Date().toISOString();
      entry.updatedAt = new Date().toISOString();

      if (scored.some((candidate) => candidate.accepted)) {
        promoteSourceFound(entry, 'tavily');
      } else if (entry.attempts >= entry.queries.length) {
        promoteTerminalCandidate(
          entry,
          policy,
          'NO_TRUSTED_CANDIDATE',
          'Tavily returned no trusted source after all field-specific stages.',
        );
      }

      ledger.events.push({
        at: new Date().toISOString(),
        entryId: entry.id,
        school: entry.schoolName,
        field: entry.field,
        action: 'search',
        result: entry.status,
      });
      changedThisRound++;
      if (options.delayMs > 0) await sleep(options.delayMs);
    }
    ledger._meta.rounds += 1;
    if (changedThisRound === 0 || searchesUsed >= options.maxSearches) break;
  }
  return ledger;
}

function consumeWork(
  ledger: Ledger,
  policies: FieldPolicy[],
  options: CliOptions,
) {
  const policyByKey = new Map(policies.map((policy) => [policy.key, policy]));
  for (const entry of Object.values(ledger.entries)) {
    const policy = policyByKey.get(entry.field);
    if (!policy) continue;
    if (entry.status !== 'SOURCE_FOUND') continue;

    const best = bestCandidate(entry);
    if (!best) {
      promoteTerminalCandidate(
        entry,
        policy,
        'SOURCE_LOST',
        'Entry was SOURCE_FOUND but no accepted candidate remained in ledger.',
      );
      continue;
    }

    const extracted = extractFromCandidate(entry, policy, best);
    if (extracted) {
      entry.extracted = extracted;
      entry.status = 'EXTRACTION_READY';
      entry.selectedUrl = best.url;
      entry.failureReason = null;
      entry.updatedAt = new Date().toISOString();
      ledger.events.push({
        at: new Date().toISOString(),
        entryId: entry.id,
        school: entry.schoolName,
        field: entry.field,
        action: 'consume',
        result: 'EXTRACTION_READY',
      });
      continue;
    }

    if (policy.strictRealOnly) {
      promoteTerminalCandidate(
        entry,
        policy,
        'NO_MACHINE_VERIFIABLE_STRUCTURED_VALUE',
        `${policy.label} requires official structured values; candidate was not machine-verifiable. URL: ${best.url}`,
      );
      continue;
    }

    if (options.adjudicateSuspicious) {
      promoteTerminalCandidate(
        entry,
        policy,
        'UNSTRUCTURED_VALUE_NOT_EXTRACTED',
        `Trusted source was found but no reliable value could be extracted from snippets; requires manual curation before writing a number. URL: ${best.url}`,
      );
    } else {
      entry.status = 'SUSPICIOUS';
      entry.failureReason =
        'Trusted source found but extractor did not produce a validated value.';
      entry.selectedUrl = best.url;
      entry.updatedAt = new Date().toISOString();
    }
  }
}

function adjudicateSuspicious(ledger: Ledger) {
  for (const entry of Object.values(ledger.entries)) {
    if (entry.status !== 'SUSPICIOUS') continue;
    entry.status = terminalForField(entry.field);
    entry.terminalReason =
      entry.failureReason ??
      'Suspicious source could not be machine-validated; terminalized pending future manual/admin curated import.';
    entry.verifiedAt = new Date().toISOString();
    entry.updatedAt = new Date().toISOString();
  }
}

async function applyLedger(
  ledger: Ledger,
  policies: FieldPolicy[],
  options: CliOptions,
) {
  if (options.dryRun) return 0;
  const policyByKey = new Map(policies.map((policy) => [policy.key, policy]));
  let changedValues = 0;

  for (const entry of Object.values(ledger.entries)) {
    const policy = policyByKey.get(entry.field);
    if (!policy) continue;

    if (entry.status === 'EXTRACTION_READY' && entry.extracted) {
      const applied = await applyExtractedValue(entry, policy);
      if (applied) {
        changedValues++;
        entry.status =
          entry.extracted.sourceFamily === 'SECONDARY_AGGREGATOR'
            ? 'VERIFIED_SECONDARY'
            : 'VERIFIED_REAL';
        entry.verifiedAt = new Date().toISOString();
        entry.updatedAt = new Date().toISOString();
      }
      continue;
    }

    if (entry.status === 'TERMINAL_CANDIDATE') {
      await writeTerminalProvenance(entry, policy);
      entry.status = terminalForField(entry.field);
      entry.verifiedAt = new Date().toISOString();
      entry.updatedAt = new Date().toISOString();
    }
  }

  return changedValues;
}

async function applyExtractedValue(entry: LedgerEntry, policy: FieldPolicy) {
  const metadataPatch = buildProvenancePatch(entry, {
    source: entry.extracted?.sourceFamily ?? entry.sourceFamily,
    tier:
      entry.extracted?.sourceFamily === 'SECONDARY_AGGREGATOR'
        ? 'VERIFIED_SECONDARY'
        : 'VERIFIED_REAL',
    value: entry.extracted?.value,
    formula: entry.extracted?.formula,
    notes: entry.extracted?.notes,
  });

  if (policy.destination === 'schoolScalar' && policy.scalarField) {
    const data: Prisma.SchoolUpdateInput = {
      metadata: await mergedMetadata(entry.schoolId, metadataPatch),
    };
    const converted = convertValueForPolicy(entry.extracted?.value, policy);
    if (converted !== undefined) {
      (data as Record<string, unknown>)[String(policy.scalarField)] = converted;
    }
    await prisma.school.update({ where: { id: entry.schoolId }, data });
    return converted !== undefined;
  }

  if (policy.destination === 'schoolJson' && policy.scalarField) {
    await prisma.school.update({
      where: { id: entry.schoolId },
      data: {
        [String(policy.scalarField)]: entry.extracted
          ?.value as Prisma.InputJsonValue,
        metadata: await mergedMetadata(entry.schoolId, metadataPatch),
      } as Prisma.SchoolUpdateInput,
    });
    return true;
  }

  await prisma.school.update({
    where: { id: entry.schoolId },
    data: { metadata: await mergedMetadata(entry.schoolId, metadataPatch) },
  });
  return false;
}

async function writeTerminalProvenance(
  entry: LedgerEntry,
  policy: FieldPolicy,
) {
  const patch = buildProvenancePatch(entry, {
    source: 'TERMINAL',
    tier: terminalForField(entry.field),
    reason:
      entry.terminalReason ?? entry.failureReason ?? 'No public source found.',
    policyLabel: policy.label,
  });
  await prisma.school.update({
    where: { id: entry.schoolId },
    data: {
      metadata: await mergedMetadata(entry.schoolId, patch),
    },
  });
}

async function mergedMetadata(
  schoolId: string,
  patch: Prisma.JsonObject,
): Promise<Prisma.JsonObject> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { metadata: true },
  });
  return deepMerge(asJsonObject(school?.metadata) ?? {}, patch);
}

function deepMerge(
  base: Prisma.JsonObject,
  patch: Prisma.JsonObject,
): Prisma.JsonObject {
  const output: Prisma.JsonObject = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const existing = asJsonObject(output[key]);
    const incoming = asJsonObject(value);
    output[key] =
      existing && incoming
        ? deepMerge(existing, incoming)
        : (value as Prisma.JsonValue);
  }
  return output;
}

function buildProvenancePatch(
  entry: LedgerEntry,
  extra: Record<string, unknown>,
): Prisma.JsonObject {
  const searchedQueries = entry.queries.map((query) => ({
    stage: query.stage,
    kind: query.kind,
    query: query.query,
    includeDomains: query.includeDomains,
  }));
  const candidates = entry.candidates.slice(0, 10).map((candidate) => ({
    title: candidate.title,
    url: candidate.url,
    score: candidate.score,
    accepted: candidate.accepted,
    rejectReason: candidate.rejectReason,
    source: candidate.source,
    stage: candidate.stage,
  }));
  return {
    provenance: {
      [entry.field]: {
        ...extra,
        realDataStatus: extra.tier,
        sourceUrl: entry.selectedUrl ?? bestCandidate(entry)?.url ?? null,
        searchedQueries,
        candidates,
        attempts: entry.attempts,
        verifiedAt: new Date().toISOString(),
        generatedBy: 'multi-source-data-marathon',
      },
    },
  };
}

function extractFromCandidate(
  entry: LedgerEntry,
  policy: FieldPolicy,
  candidate: Candidate,
): ExtractedValue | null {
  const text = `${candidate.title}\n${candidate.snippet}`;
  const sourceFamily = inferSourceFamily(candidate.url, entry, policy);
  if (!isSourceAllowed(sourceFamily, policy)) return null;

  if (policy.boolean) {
    const value = extractBoolean(policy.key, text);
    if (value !== null)
      return {
        value,
        confidence: 'MEDIUM',
        sourceFamily,
        notes: 'Snippet boolean extraction.',
      };
  }

  if (policy.integer) {
    const value = extractInteger(policy.key, text);
    if (value !== null)
      return {
        value,
        confidence: 'LOW',
        sourceFamily,
        notes: 'Snippet integer extraction.',
      };
  }

  if (policy.percent) {
    const value = extractPercent(policy.key, text);
    if (value !== null)
      return {
        value,
        confidence: 'LOW',
        sourceFamily,
        notes: 'Snippet percent extraction.',
      };
  }

  if (policy.enum && policy.key === 'testingPolicy') {
    const value = extractTestingPolicy(text);
    if (value)
      return {
        value,
        confidence: 'MEDIUM',
        sourceFamily,
        notes: 'Snippet testing policy extraction.',
      };
  }

  if (policy.key.startsWith('niche')) {
    const grade = extractNicheGrade(text);
    if (grade)
      return {
        value: grade,
        confidence: 'LOW',
        sourceFamily,
        notes: 'Snippet Niche grade extraction.',
      };
  }

  if (policy.key === 'gpaProfile') {
    const profile = extractGpaProfile(text);
    if (profile)
      return {
        value: profile,
        confidence: 'LOW',
        sourceFamily,
        notes: 'Stored separately from gpaDistribution.',
      };
  }

  return null;
}

function extractBoolean(field: FieldKey, text: string) {
  const lower = text.toLowerCase();
  if (field === 'testOptional') {
    if (
      /test[-\s]?blind|does not consider sat|does not consider act/.test(lower)
    )
      return false;
    if (
      /test[-\s]?optional|sat\/act optional|act or sat scores are optional/.test(
        lower,
      )
    )
      return true;
    if (
      /test scores are required|sat or act required|requires sat|requires act/.test(
        lower,
      )
    )
      return false;
  }
  if (field === 'hasEarlyDecision')
    return /early decision|ed i|ed ii/.test(lower);
  if (field === 'feeWaiverAvailable')
    return /fee waiver|waive.*application fee|application fee.*waiver/.test(
      lower,
    );
  if (field === 'acceptsCommonApp')
    return /common app|common application/.test(lower);
  if (field === 'acceptsCoalition')
    return /coalition application|coalition app/.test(lower);
  return null;
}

function extractTestingPolicy(text: string) {
  const lower = text.toLowerCase();
  if (/test[-\s]?blind|does not consider sat|does not consider act/.test(lower))
    return 'BLIND';
  if (/test[-\s]?optional|sat\/act optional/.test(lower)) return 'OPTIONAL';
  if (
    /test scores are required|sat or act required|requires sat|requires act/.test(
      lower,
    )
  )
    return 'REQUIRED';
  return null;
}

function extractInteger(field: FieldKey, text: string) {
  if (field === 'sat25' || field === 'sat75' || field === 'satAvg') {
    const range = matchRange(text, /sat/i, 400, 1600);
    if (range)
      return field === 'sat25'
        ? range.low
        : field === 'sat75'
          ? range.high
          : Math.round((range.low + range.high) / 2);
  }
  if (field === 'act25' || field === 'act75' || field === 'actAvg') {
    const range = matchRange(text, /act/i, 1, 36);
    if (range)
      return field === 'act25'
        ? range.low
        : field === 'act75'
          ? range.high
          : Math.round((range.low + range.high) / 2);
  }
  if (field === 'applicationFee' || field === 'monthlyLoanPayment') {
    return matchMoney(
      text,
      field === 'applicationFee' ? /application fee/i : /monthly loan/i,
      1,
      500,
    );
  }
  if (
    field === 'tuition' ||
    field === 'roomAndBoard' ||
    field === 'averageAidPackage' ||
    field === 'averageNetPrice'
  ) {
    return matchMoney(text, moneyContext(field), 1000, 100000);
  }
  if (field === 'salary6YrPostGrad')
    return matchMoney(text, /salary|earnings/i, 10000, 300000);
  if (field === 'studentFacultyRatio') {
    const match =
      text.match(
        /student[-\s]?faculty ratio[^0-9]{0,30}(\d{1,2})\s*[:/]\s*1/i,
      ) ?? text.match(/(\d{1,2})\s*[:/]\s*1[^.]{0,40}student[-\s]?faculty/i);
    if (match) return Number(match[1]);
  }
  if (field === 'countriesRepresented')
    return matchNearNumber(text, /countries represented|countries/i, 1, 250);
  if (field === 'studentOrgsCount')
    return matchNearNumber(
      text,
      /student organizations|clubs and organizations|student clubs/i,
      1,
      2000,
    );
  if (field === 'totalEnrollment')
    return matchNearNumber(text, /enrollment|students/i, 100, 200000);
  if (field === 'usNewsRank' || field === 'qsRank')
    return matchNearNumber(text, /rank|ranking/i, 1, 1000);
  return null;
}

function extractPercent(field: FieldKey, text: string) {
  const context: RegExp =
    field === 'edAcceptanceRate'
      ? /early decision|ed i|ed ii/i
      : field === 'eaAcceptanceRate'
        ? /early action|rea|scea/i
        : field === 'intlAcceptanceRate'
          ? /international|nonresident alien/i
          : field === 'oosAcceptanceRate'
            ? /out[-\s]?of[-\s]?state|nonresident/i
            : field === 'transferAcceptanceRate'
              ? /transfer/i
              : field === 'intlStudentPct'
                ? /international students|international enrollment/i
                : field === 'loanDefaultRate'
                  ? /loan default/i
                  : field === 'percentNeedMet'
                    ? /need met|demonstrated need/i
                    : field === 'graduationRate'
                      ? /graduation/i
                      : field === 'retentionRate'
                        ? /retention/i
                        : /admit|acceptance|rate/i;
  return matchPercent(text, context);
}

function matchRange(text: string, context: RegExp, min: number, max: number) {
  const compact = text.replace(/,/g, '');
  const rangeRegex = /(\d{1,4})\s*(?:-|to|–|—)\s*(\d{1,4})/gi;
  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(compact))) {
    const window = compact.slice(
      Math.max(0, match.index - 80),
      match.index + 120,
    );
    if (!context.test(window)) continue;
    context.lastIndex = 0;
    const low = Number(match[1]);
    const high = Number(match[2]);
    if (low >= min && high <= max && low <= high) return { low, high };
  }
  return null;
}

function matchMoney(text: string, context: RegExp, min: number, max: number) {
  const moneyRegex = /\$?\s*(\d{1,3}(?:,\d{3})+|\d{4,6})/gi;
  let match: RegExpExecArray | null;
  while ((match = moneyRegex.exec(text))) {
    const window = text.slice(Math.max(0, match.index - 80), match.index + 120);
    if (!context.test(window)) continue;
    context.lastIndex = 0;
    const value = Number(match[1].replace(/,/g, ''));
    if (value >= min && value <= max) return value;
  }
  return null;
}

function matchNearNumber(
  text: string,
  context: RegExp,
  min: number,
  max: number,
) {
  const numberRegex = /(\d{1,3}(?:,\d{3})+|\d{1,6})/gi;
  let match: RegExpExecArray | null;
  while ((match = numberRegex.exec(text))) {
    const window = text.slice(Math.max(0, match.index - 80), match.index + 120);
    if (!context.test(window)) continue;
    context.lastIndex = 0;
    const value = Number(match[1].replace(/,/g, ''));
    if (value >= min && value <= max) return value;
  }
  return null;
}

function matchPercent(text: string, context: RegExp) {
  const percentRegex = /(\d{1,2}(?:\.\d+)?|100(?:\.0+)?)\s*%/g;
  let match: RegExpExecArray | null;
  while ((match = percentRegex.exec(text))) {
    const window = text.slice(
      Math.max(0, match.index - 100),
      match.index + 120,
    );
    if (!context.test(window)) continue;
    context.lastIndex = 0;
    const value = Number(match[1]);
    if (value >= 0 && value <= 100) return value;
  }
  return null;
}

function moneyContext(field: FieldKey) {
  if (field === 'tuition') return /tuition|fees/i;
  if (field === 'roomAndBoard') return /room|board|housing|meal/i;
  if (field === 'averageAidPackage') return /aid package|financial aid/i;
  return /net price/i;
}

function extractNicheGrade(text: string) {
  const match = text.match(/\b(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F)\b/);
  return match?.[1] ?? null;
}

function extractGpaProfile(text: string) {
  const average = text.match(/average gpa[^0-9]{0,30}([0-4](?:\.\d{1,2})?)/i);
  const middle = text.match(
    /gpa[^0-9]{0,30}([0-4](?:\.\d{1,2})?)\s*(?:-|to|–|—)\s*([0-4](?:\.\d{1,2})?)/i,
  );
  if (!average && !middle) return null;
  return {
    averageGpa: average ? Number(average[1]) : undefined,
    middle50: middle ? [Number(middle[1]), Number(middle[2])] : undefined,
  };
}

function scoreCandidates(
  entry: LedgerEntry,
  policy: FieldPolicy,
  candidates: Candidate[],
) {
  return candidates.map((candidate) => {
    const scored = { ...candidate };
    const text =
      `${candidate.title} ${candidate.url} ${candidate.snippet}`.toLowerCase();
    const host = hostOf(candidate.url);
    const sourceFamily = inferSourceFamily(candidate.url, entry, policy);
    let score = candidate.score;

    const falsePositive = falsePositiveReason(text, policy);
    if (falsePositive) {
      scored.accepted = false;
      scored.rejectReason = falsePositive;
      scored.score = Math.max(0, score - 70);
      return scored;
    }

    if (sourceFamily === 'OFFICIAL_SCHOOL') score += 35;
    if (sourceFamily === 'GOVERNMENT' || sourceFamily === 'STATE_SYSTEM')
      score += 30;
    if (sourceFamily === 'SECONDARY_AGGREGATOR')
      score += policy.allowSecondary ? 12 : -50;
    if (/\.pdf($|\?)/i.test(candidate.url)) score += 15;
    if (
      /common[-_\s]?data[-_\s]?set|cds[_-]?20|institutional[-_\s]?research|oir|ir\./i.test(
        text,
      )
    )
      score += 15;
    for (const term of policy.officialTerms) {
      if (text.includes(term.toLowerCase().replace(/"/g, ''))) score += 8;
    }
    if (entry.rootDomain && host.endsWith(entry.rootDomain)) score += 25;
    if (schoolNameMatches(entry, text)) score += 15;
    if (!isSourceAllowed(sourceFamily, policy)) score -= 60;

    const accepted =
      score >= 70 &&
      isSourceAllowed(sourceFamily, policy) &&
      fieldSignalPresent(policy, text);
    scored.score = score;
    scored.accepted = accepted;
    scored.rejectReason = accepted
      ? undefined
      : 'below trust/field-signal threshold';
    return scored;
  });
}

function falsePositiveReason(text: string, policy: FieldPolicy) {
  const hardRejects = [
    ['law school', 'law school result'],
    ['mba', 'MBA/graduate result'],
    ['graduate admissions', 'graduate admissions result'],
    ['medical school', 'medical school result'],
    ['admitted students checklist', 'admitted-students checklist'],
    ['requirements checklist', 'requirements checklist'],
    ['reddit.com', 'forum/social source'],
    ['college confidential', 'forum/social source'],
    ['blog.prepscholar', 'third-party blog source'],
  ] as const;
  for (const [needle, reason] of hardRejects) {
    if (text.includes(needle)) return reason;
  }
  if (
    policy.key === 'programRates' &&
    /(minimum|threshold|requirement|portfolio|prerequisite)/i.test(text)
  ) {
    return 'program requirement/threshold, not admit-rate data';
  }
  if (
    policy.key === 'cdsAdmitBands' &&
    /(gpa distribution|sat range|middle 50)/i.test(text) &&
    !/(admit rate|admission rate|accepted|admitted)/i.test(text)
  ) {
    return 'marginal profile table, not C9 admit-rate cross-tab';
  }
  return null;
}

function fieldSignalPresent(policy: FieldPolicy, text: string) {
  if (policy.key === 'cdsAdmitBands')
    return /(admit rate|admission rate|admitted|accepted).*(gpa|sat|act|test)|((gpa|sat|act|test).*(admit rate|admission rate|admitted|accepted))/i.test(
      text,
    );
  if (policy.key === 'programRates')
    return /(applicants|applications).*(admitted|admits|admit rate).*(major|program|college|school|discipline)|((major|program|college|school|discipline).*(admit rate|admitted|applicants))/i.test(
      text,
    );
  if (policy.key === 'gpaDistribution')
    return /(gpa).*(distribution|percent|percentage)|((percent|percentage).*(gpa))/i.test(
      text,
    );
  if (policy.key === 'edAcceptanceRate')
    return /(early decision|ed i|ed ii).*(admit|accepted|admitted|rate|applicants)/i.test(
      text,
    );
  if (policy.key === 'eaAcceptanceRate')
    return /(early action|rea|scea).*(admit|accepted|admitted|rate|applicants)/i.test(
      text,
    );
  return policy.searchHints.some((hint) =>
    text.includes(hint.toLowerCase().split(/\s+/)[0]),
  );
}

function inferSourceFamily(
  url: string,
  entry: LedgerEntry,
  policy: FieldPolicy,
): SourceFamily {
  const host = hostOf(url);
  if (
    entry.rootDomain &&
    (host === entry.rootDomain || host.endsWith(`.${entry.rootDomain}`))
  )
    return 'OFFICIAL_SCHOOL';
  if (/nces\.ed\.gov|collegescorecard\.ed\.gov|ed\.gov/.test(host))
    return 'GOVERNMENT';
  if (
    /universityofcalifornia\.edu|calstate\.edu|suny\.edu|unc\.edu|utsystem\.edu|flbog\.edu|usg\.edu/.test(
      host,
    )
  )
    return 'STATE_SYSTEM';
  if (
    policy.secondaryDomains?.some(
      (domain) => host.endsWith(domain) || host.includes(domain),
    )
  )
    return 'SECONDARY_AGGREGATOR';
  if (
    /bigfuture\.collegeboard\.org|appily\.com|niche\.com|collegetransitions\.com|usnews\.com|forbes\.com|topuniversities\.com|timeshighereducation\.com/.test(
      host,
    )
  )
    return 'SECONDARY_AGGREGATOR';
  return 'OFFICIAL_SCHOOL';
}

function isSourceAllowed(sourceFamily: SourceFamily, policy: FieldPolicy) {
  if (sourceFamily === 'SECONDARY_AGGREGATOR') return policy.allowSecondary;
  if (sourceFamily === 'HEURISTIC') return policy.allowHeuristic;
  return policy.requiredSourceFamilies.includes(sourceFamily);
}

function planQueries(entry: LedgerEntry, policy: FieldPolicy): SearchPlan[] {
  const school = `"${entry.schoolName}"`;
  const aliases = entry.aliases
    .slice(0, 2)
    .map((alias) => `"${alias}"`)
    .join(' OR ');
  const root = entry.rootDomain ? [entry.rootDomain] : undefined;
  const source = primarySourceFamily(policy);
  const fieldPhrase = policy.searchHints[0] ?? policy.label;
  const plans: SearchPlan[] = [];

  if (root) {
    plans.push({
      stage: 1,
      kind: 'official-root-field',
      query: `${school} "${fieldPhrase}"`,
      includeDomains: root,
      expectedSourceFamily: 'OFFICIAL_SCHOOL',
    });
    plans.push({
      stage: 2,
      kind: 'official-root-institutional-research',
      query: `${school} "institutional research" OR "common data set" OR "factbook" ${policy.searchHints
        .slice(0, 2)
        .map((hint) => `"${hint}"`)
        .join(' OR ')}`,
      includeDomains: root,
      expectedSourceFamily: 'OFFICIAL_SCHOOL',
    });
  }

  plans.push({
    stage: 3,
    kind: 'field-specific-global-official',
    query: `${school} ${aliases ? `OR ${aliases}` : ''} ${policy.searchHints.map((hint) => `"${hint}"`).join(' OR ')}`,
    excludeDomains: ['reddit.com', 'collegeconfidential.com', 'quora.com'],
    expectedSourceFamily: source,
  });

  if (policy.governmentDomains?.length) {
    plans.push({
      stage: 4,
      kind: 'government-public-dataset',
      query: `${school} ${policy.searchHints
        .slice(0, 2)
        .map((hint) => `"${hint}"`)
        .join(' ')}`,
      includeDomains: policy.governmentDomains,
      expectedSourceFamily: 'GOVERNMENT',
    });
  }

  if (policy.allowSecondary && policy.secondaryDomains?.length) {
    plans.push({
      stage: 5,
      kind: 'allowed-secondary',
      query: `${school} ${policy.searchHints
        .slice(0, 2)
        .map((hint) => `"${hint}"`)
        .join(' ')}`,
      includeDomains: policy.secondaryDomains,
      expectedSourceFamily: 'SECONDARY_AGGREGATOR',
    });
  }

  return plans;
}

function findHistoryCandidates(
  entry: LedgerEntry,
  policy: FieldPolicy,
): Candidate[] {
  const candidates: Candidate[] = [];
  if (!existsSync(DATA_DIR)) return candidates;
  const files = readdirSync(DATA_DIR)
    .filter((file) => file.endsWith('.json'))
    .slice(0, 250);
  const names = [
    entry.schoolNameNorm,
    entry.schoolName.toLowerCase(),
    ...entry.aliases.map((alias) => alias.toLowerCase()),
  ].filter(Boolean);
  for (const file of files) {
    const fullPath = path.join(DATA_DIR, file);
    let text = '';
    try {
      text = readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }
    const lower = text.toLowerCase();
    if (!names.some((name) => lower.includes(name))) continue;
    const urls = [...text.matchAll(/https?:\/\/[^"'\s)]+/g)].map((match) =>
      normalizeUrl(match[0]),
    );
    for (const url of urls.slice(0, 5)) {
      candidates.push({
        title: `Historical source from ${file}`,
        url,
        snippet: `${file} contains ${entry.schoolName} and ${policy.label}`,
        score: 65,
        source: 'history',
        stage: 0,
        stageKind: 'historical-registry-batch',
        accepted: false,
      });
    }
  }
  return candidates;
}

function nextUntriedPlan(entry: LedgerEntry) {
  const tried = new Set(
    entry.candidates
      .filter((candidate) => candidate.source === 'tavily')
      .map((candidate) => `${candidate.stage}:${candidate.stageKind}`),
  );
  return entry.queries.find(
    (query) => !tried.has(`${query.stage}:${query.kind}`),
  );
}

function markPlanTried(plans: SearchPlan[], plan: SearchPlan) {
  return plans.map((item) =>
    item.stage === plan.stage && item.kind === plan.kind ? { ...item } : item,
  );
}

function promoteSourceFound(entry: LedgerEntry, source: string) {
  const best = bestCandidate(entry);
  entry.status = 'SOURCE_FOUND';
  entry.selectedUrl = best?.url ?? entry.selectedUrl ?? null;
  entry.failureReason = null;
  entry.updatedAt = new Date().toISOString();
  entry.terminalReason = null;
  entry.currentSource = source;
}

function promoteTerminalCandidate(
  entry: LedgerEntry,
  policy: FieldPolicy,
  reasonCode: string,
  reason: string,
) {
  entry.status = 'TERMINAL_CANDIDATE';
  entry.failureReason = reasonCode;
  entry.terminalReason = reason;
  entry.updatedAt = new Date().toISOString();
}

function bestCandidate(entry: LedgerEntry) {
  return (
    entry.candidates
      .filter((candidate) => candidate.accepted)
      .sort((a, b) => b.score - a.score)[0] ?? null
  );
}

function mergeCandidates(existing: Candidate[], incoming: Candidate[]) {
  const seen = new Set(existing.map((candidate) => candidate.url));
  return incoming.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

function currentValueFor(
  school: Record<string, any>,
  policy: FieldPolicy,
  programEarningSchoolIds: Set<string>,
) {
  if (policy.key === 'cdsAdmitBands') return school._count?.cdsAdmitBands ?? 0;
  if (policy.key === 'programRates') return school._count?.programs ?? 0;
  if (policy.key === 'programEarnings')
    return programEarningSchoolIds.has(school.id) ? true : null;
  if (policy.key === 'deadlines') return school._count?.deadlines ?? 0;
  if (policy.key === 'rankings') return school._count?.rankings ?? 0;
  if (policy.key === 'gpaProfile' || policy.key === 'classRankDistribution') {
    const metadata = asJsonObject(school.metadata);
    return (
      metadata?.[policy.key] ??
      asJsonObject(metadata?.provenance)?.[policy.key] ??
      null
    );
  }
  return school[policy.key] ?? null;
}

function provenanceFor(metadata: unknown, field: FieldKey) {
  const json = asJsonObject(metadata);
  const provenance = asJsonObject(json?.provenance);
  return asJsonObject(provenance?.[field]);
}

function initialStatus(
  currentValue: unknown,
  provenance: Prisma.JsonObject | null,
  policy: FieldPolicy,
): Status {
  const explicit =
    stringStatus(provenance?.realDataStatus) ??
    stringStatus(provenance?.status) ??
    stringStatus(provenance?.tier);
  if (explicit) return explicit;

  if (hasValue(currentValue, policy)) {
    const source = String(provenance?.source ?? '').toUpperCase();
    const tier = String(provenance?.tier ?? '').toUpperCase();
    if (
      source.includes('HEURISTIC') ||
      tier.includes('HEURISTIC') ||
      tier.includes('INFERRED')
    )
      return 'HEURISTIC_FILL';
    if (source.includes('SECONDARY') || tier.includes('SECONDARY'))
      return 'VERIFIED_SECONDARY';
    if (
      source.includes('OFFICIAL') ||
      source.includes('CDS') ||
      source.includes('IPEDS') ||
      source.includes('SCORECARD')
    )
      return 'VERIFIED_REAL';
    return 'OFFICIAL_REAL_LEGACY';
  }

  if (policy.allowHeuristic) {
    const source = String(provenance?.source ?? '').toUpperCase();
    if (source.includes('HEURISTIC')) return 'HEURISTIC_FILL';
  }

  return 'PENDING';
}

function hasValue(value: unknown, policy: FieldPolicy) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') {
    if (policy.destination === 'relation') return value > 0;
    return Number.isFinite(value);
  }
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string')
    return value.trim().length > 0 && value !== 'UNKNOWN';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.length > 0;
    return Object.keys(value as object).length > 0;
  }
  return true;
}

function stringStatus(value: unknown): Status | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toUpperCase();
  const statuses: Status[] = [
    'PENDING',
    'UNKNOWN',
    'SOURCE_FOUND',
    'EXTRACTION_READY',
    'TERMINAL_CANDIDATE',
    'SUSPICIOUS',
    'MANUAL_REVIEW',
    'VERIFIED_REAL',
    'VERIFIED_SECONDARY',
    'OFFICIAL_REAL_LEGACY',
    'HEURISTIC_FILL',
    'PERMANENT_HEURISTIC',
    'NO_PUBLIC_SOURCE',
    'NO_PUBLIC_ROUND_RATE',
    'NO_PUBLIC_GPA_DISTRIBUTION',
    'NO_PUBLIC_PROGRAM_DATA',
    'NO_PUBLIC_C9_CROSSTAB',
    'OFFICIAL_BLANK_SECTION',
    'OFFICIAL_BLOCKED',
    'NOT_APPLICABLE',
  ];
  return statuses.find((status) => status === normalized) ?? null;
}

function terminalForField(field: FieldKey): Status {
  if (field === 'programRates') return 'NO_PUBLIC_PROGRAM_DATA';
  if (field === 'cdsAdmitBands') return 'NO_PUBLIC_C9_CROSSTAB';
  if (field === 'gpaDistribution') return 'NO_PUBLIC_GPA_DISTRIBUTION';
  if (field === 'edAcceptanceRate' || field === 'eaAcceptanceRate')
    return 'NO_PUBLIC_ROUND_RATE';
  return 'NO_PUBLIC_SOURCE';
}

function primarySourceFamily(policy: FieldPolicy) {
  return policy.requiredSourceFamilies[0] ?? 'OFFICIAL_SCHOOL';
}

function convertValueForPolicy(value: unknown, policy: FieldPolicy) {
  if (value === null || value === undefined) return undefined;
  if (policy.boolean) return Boolean(value);
  if (policy.integer) return Math.round(Number(value));
  if (policy.percent) return new Prisma.Decimal(Number(value));
  if (policy.enum && policy.key === 'testingPolicy') return undefined;
  return value as any;
}

function summarize(ledger: Ledger): Summary {
  const summary = emptySummary();
  for (const entry of Object.values(ledger.entries)) {
    summary.total += 1;
    summary.byStatus[entry.status] = (summary.byStatus[entry.status] ?? 0) + 1;
    const lane = summary.byLane[entry.lane] ?? { total: 0, open: 0 };
    lane.total += 1;
    const field = summary.byField[entry.field] ?? {
      total: 0,
      open: 0,
      real: 0,
      secondary: 0,
      heuristic: 0,
      terminal: 0,
    };
    field.total += 1;
    if (OPEN_STATUSES.has(entry.status)) {
      summary.open += 1;
      lane.open += 1;
      field.open += 1;
    } else if (
      entry.status === 'VERIFIED_REAL' ||
      entry.status === 'OFFICIAL_REAL_LEGACY'
    ) {
      field.real += 1;
    } else if (entry.status === 'VERIFIED_SECONDARY') {
      field.secondary += 1;
    } else if (
      entry.status === 'HEURISTIC_FILL' ||
      entry.status === 'PERMANENT_HEURISTIC'
    ) {
      field.heuristic += 1;
    } else {
      field.terminal += 1;
    }
    summary.byLane[entry.lane] = lane;
    summary.byField[entry.field] = field;
  }
  return summary;
}

function emptySummary(): Summary {
  return {
    total: 0,
    open: 0,
    byStatus: {},
    byLane: {},
    byField: {},
    changedValues: 0,
  };
}

function hardGates(ledger: Ledger): HardGates {
  const byStatus = ledger.summary.byStatus;
  const gates = {
    pass: false,
    open: ledger.summary.open,
    PENDING: byStatus.PENDING ?? 0,
    UNKNOWN: byStatus.UNKNOWN ?? 0,
    SOURCE_FOUND: byStatus.SOURCE_FOUND ?? 0,
    EXTRACTION_READY: byStatus.EXTRACTION_READY ?? 0,
    SUSPICIOUS: byStatus.SUSPICIOUS ?? 0,
    MANUAL_REVIEW: byStatus.MANUAL_REVIEW ?? 0,
    TERMINAL_CANDIDATE: byStatus.TERMINAL_CANDIDATE ?? 0,
  };
  gates.pass =
    gates.open === 0 &&
    gates.PENDING === 0 &&
    gates.UNKNOWN === 0 &&
    gates.SOURCE_FOUND === 0 &&
    gates.EXTRACTION_READY === 0 &&
    gates.SUSPICIOUS === 0 &&
    gates.MANUAL_REVIEW === 0 &&
    gates.TERMINAL_CANDIDATE === 0;
  return gates;
}

function hasSearchableOpenEntries(ledger: Ledger) {
  return Object.values(ledger.entries).some(
    (entry) =>
      OPEN_STATUSES.has(entry.status) &&
      ![
        'SOURCE_FOUND',
        'EXTRACTION_READY',
        'SUSPICIOUS',
        'TERMINAL_CANDIDATE',
      ].includes(entry.status),
  );
}

function buildReport(ledger: Ledger, policies: FieldPolicy[]) {
  return {
    generatedAt: new Date().toISOString(),
    hardGates: ledger._meta.hardGates,
    summary: ledger.summary,
    lanes: ledger.summary.byLane,
    fields: ledger.summary.byField,
    policies: policies.map((policy) => ({
      key: policy.key,
      lane: policy.lane,
      label: policy.label,
      destination: policy.destination,
      allowSecondary: policy.allowSecondary,
      allowHeuristic: policy.allowHeuristic,
      strictRealOnly: policy.strictRealOnly ?? false,
      sourceFamilies: policy.requiredSourceFamilies,
    })),
  };
}

function printSummary(ledger: Ledger, options: CliOptions) {
  const gates = ledger._meta.hardGates;
  console.log('\nMulti-source data marathon');
  console.log('──────────────────────────');
  console.log(`ledger: ${options.ledgerPath}`);
  console.log(`report: ${options.reportPath}`);
  console.log(`total entries: ${ledger.summary.total}`);
  console.log(`open: ${ledger.summary.open}`);
  console.log(`hard gates: ${gates.pass ? 'PASS' : 'FAIL'}`);
  console.log(
    `PENDING=${gates.PENDING} UNKNOWN=${gates.UNKNOWN} SOURCE_FOUND=${gates.SOURCE_FOUND} EXTRACTION_READY=${gates.EXTRACTION_READY} SUSPICIOUS=${gates.SUSPICIOUS} MANUAL_REVIEW=${gates.MANUAL_REVIEW} TERMINAL_CANDIDATE=${gates.TERMINAL_CANDIDATE}`,
  );
  console.log('\nTop open fields:');
  Object.entries(ledger.summary.byField)
    .filter(([, value]) => value.open > 0)
    .sort((a, b) => b[1].open - a[1].open)
    .slice(0, 12)
    .forEach(([field, value]) => {
      console.log(`- ${field}: open ${value.open}/${value.total}`);
    });
}

function compareEntryPriority(a: LedgerEntry, b: LedgerEntry) {
  const laneWeight: Record<Lane, number> = {
    admissions: 0,
    academic: 1,
    program: 2,
    policy: 3,
    costAid: 4,
    outcomes: 5,
    campus: 6,
    rankingsQuality: 7,
  };
  const arA = a.acceptanceRate ?? 999;
  const arB = b.acceptanceRate ?? 999;
  return (
    laneWeight[a.lane] - laneWeight[b.lane] ||
    arA - arB ||
    (a.usNewsRank ?? 9999) - (b.usNewsRank ?? 9999)
  );
}

function schoolNameMatches(entry: LedgerEntry, text: string) {
  if (text.includes(entry.schoolName.toLowerCase())) return true;
  if (
    entry.aliases.some((alias) => alias && text.includes(alias.toLowerCase()))
  )
    return true;
  const acronymValue = acronym(entry.schoolName);
  return acronymValue.length > 1 && text.includes(acronymValue.toLowerCase());
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function rootDomainOf(url: string | null) {
  if (!url) return null;
  const host = hostOf(url);
  if (!host) return null;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  return parts.slice(-2).join('.');
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function acronym(name: string) {
  return name
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(
      (part) => /^[A-Z]/.test(part) && !['The', 'Of', 'And'].includes(part),
    )
    .map((part) => part[0])
    .join('');
}

function asJsonObject(value: unknown): Prisma.JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Prisma.JsonObject;
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof value.toNumber === 'function'
  )
    return value.toNumber();
  return Number(value);
}

function loadLedger(filePath: string): Ledger {
  return JSON.parse(readFileSync(filePath, 'utf8')) as Ledger;
}

function ensureDirs() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(REPORT_DIR, { recursive: true });
}

function loadTavilyKeys(limit: number) {
  const keys: string[] = [];
  const packed = process.env.TAVILY_API_KEYS;
  if (packed)
    keys.push(
      ...packed
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean),
    );
  if (process.env.TAVILY_API_KEY) keys.push(process.env.TAVILY_API_KEY);
  for (let index = 1; index <= 99; index++) {
    const key = process.env[`TAVILY_API_KEY_${index}`];
    if (key) keys.push(key);
  }
  return [...new Set(keys)].slice(0, Math.max(1, limit));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCounselorBackfill() {
  try {
    execFileSync(
      'pnpm',
      [
        '--filter',
        'api',
        'exec',
        'tsx',
        'scripts/run-counselor-backfill.ts',
        '--live',
        '--force-recompute',
        '--batch-size',
        '1000',
      ],
      {
        cwd: path.resolve(API_ROOT, '..', '..'),
        stdio: 'inherit',
      },
    );
  } catch {
    console.warn(
      'Counselor backfill command failed; run the admin endpoint manually.',
    );
  }
}

function parseArgs(argv: string[]): CliOptions {
  const get = (name: string, fallback?: string) => {
    const index = argv.indexOf(name);
    if (index >= 0 && argv[index + 1]) return argv[index + 1];
    const inline = argv.find((arg) => arg.startsWith(`${name}=`));
    return inline ? inline.slice(name.length + 1) : fallback;
  };
  const set = <T extends string>(name: string) => {
    const value = get(name);
    if (!value) return undefined;
    return new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ) as Set<T>;
  };
  return {
    dryRun: argv.includes('--dry-run'),
    search: argv.includes('--search'),
    consume: argv.includes('--consume') || argv.includes('--consume-worklists'),
    apply: argv.includes('--apply'),
    resume: argv.includes('--resume'),
    reset: argv.includes('--reset'),
    adjudicateSuspicious: argv.includes('--adjudicate-suspicious'),
    runBackfill: argv.includes('--run-backfill'),
    ledgerPath: path.resolve(get('--ledger', DEFAULT_LEDGER) ?? DEFAULT_LEDGER),
    reportPath: path.resolve(get('--report', DEFAULT_REPORT) ?? DEFAULT_REPORT),
    matrixPath: path.resolve(
      get('--matrix-report', DEFAULT_MATRIX_REPORT) ?? DEFAULT_MATRIX_REPORT,
    ),
    fields: set<FieldKey>('--fields'),
    lanes: set<Lane>('--lanes'),
    limit: Number(get('--limit', '240')),
    maxRounds: Number(get('--max-rounds', '1')),
    maxSearches: Number(get('--max-searches', '200')),
    maxResults: Number(get('--max-results', '6')),
    tavilyKeys: Number(get('--tavily-keys', '19')),
    delayMs: Number(get('--delay-ms', '250')),
    timeoutMs: Number(get('--timeout-ms', '20000')),
  };
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

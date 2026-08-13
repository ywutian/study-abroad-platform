import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { isValidNicheGrade } from '@study-abroad/shared/scoring';
import { normalizeSchoolProvenance } from '@study-abroad/shared/utils';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DataSource,
  type MergeableField,
  SchoolDataMerger,
} from './school-data-merger';
import { toRecord } from './school-provenance.helpers';
import { AppilyScrapeService } from './scrapers/appily.scraper';
import { BigFutureScrapeService } from './scrapers/bigfuture.scraper';

/** Keeps upstream ingestion failures distinct from request-validation failures. */
class CampusLifeIngestionError extends Error {
  override readonly name = 'CampusLifeIngestionError';
}

const NICHE_CAMPUS_FIELDS = [
  'nicheOverallGrade',
  'nicheSafetyGrade',
  'nicheLifeGrade',
  'nicheFoodGrade',
] as const satisfies readonly MergeableField[];

type NicheCampusField = (typeof NICHE_CAMPUS_FIELDS)[number];

const TERMINAL_REAL_DATA_STATUSES = new Set([
  'OFFICIAL_BLANK',
  'OFFICIAL_BLOCKED',
  'NO_PUBLIC_REAL_DATA',
  'MANUAL_REVIEW',
]);

export interface TavilySearchResult {
  url: string;
  content: string;
}

export interface CampusLifeIngestionOptions {
  dryRun?: boolean;
  limit?: number;
  onlyMissing?: boolean;
}

export interface CampusLifeIngestionResult {
  dryRun: boolean;
  onlyMissing: boolean;
  limit: number;
  appily: {
    scraped: number;
    updated: number;
    failed: number;
    skipped: number;
    dryRun: boolean;
  };
  bigFuture: {
    scraped: number;
    updated: number;
    failed: number;
    skipped: number;
    dryRun: boolean;
  };
  tavily: {
    scanned: number;
    updatedFields: number;
    terminalMarked: number;
    skipped: number;
    failed: number;
    errors: string[];
  };
}

type NicheCandidate = {
  id: string;
  name: string;
  metadata: unknown;
} & Partial<Record<NicheCampusField, string | null>>;

const GRADE_RE = /(?<![A-Z])([ABCDF][+-]?)(?![A-Z+-])/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractGradeNearKeywords(
  text: string,
  keywords: readonly string[],
): string | null {
  const lower = text.toLowerCase();

  for (const keyword of keywords) {
    const index = lower.indexOf(keyword.toLowerCase());
    if (index === -1) continue;

    const window = text.slice(Math.max(0, index - 200), index + 220);
    const matches = [...window.matchAll(GRADE_RE)];
    for (const match of matches) {
      const grade = match[1].toUpperCase();
      if (isValidNicheGrade(grade)) return grade;
    }
  }

  return null;
}

function extractGradeBroad(
  text: string,
  keywords: readonly string[],
): string | null {
  for (const keyword of keywords) {
    const afterKeyword = new RegExp(
      `${escapeRegExp(keyword)}[^A-Z]{0,30}([ABCDF][+-]?)`,
      'i',
    );
    const afterMatch = text.match(afterKeyword);
    if (afterMatch && isValidNicheGrade(afterMatch[1])) {
      return afterMatch[1].toUpperCase();
    }

    const beforeKeyword = new RegExp(
      `grade\\s+([ABCDF][+-]?)\\.?\\s*${escapeRegExp(keyword)}`,
      'i',
    );
    const beforeMatch = text.match(beforeKeyword);
    if (beforeMatch && isValidNicheGrade(beforeMatch[1])) {
      return beforeMatch[1].toUpperCase();
    }
  }

  return null;
}

function extractGrade(
  text: string,
  keywords: readonly string[],
): string | null {
  return (
    extractGradeBroad(text, keywords) ??
    extractGradeNearKeywords(text, keywords)
  );
}

export function extractNicheCampusGradesFromTavilyResults(
  results: readonly TavilySearchResult[],
): Partial<Record<NicheCampusField, string>> {
  const nicheResults = results.filter((result) =>
    result.url.toLowerCase().includes('niche.com/colleges/'),
  );
  const combined = nicheResults.map((result) => result.content).join('\n');

  const extracted: Partial<Record<NicheCampusField, string>> = {};
  const overall = extractGrade(combined, [
    'overall niche grade',
    'overall grade',
    'niche grade',
    'overall:',
  ]);
  const safety = extractGrade(combined, [
    'safety grade',
    'campus safety',
    'crime & safety',
    'safety:',
  ]);
  const life = extractGrade(combined, [
    'student life grade',
    'student life',
    'campus life',
    'life:',
  ]);
  const food = extractGrade(combined, [
    'food grade',
    'campus food',
    'dining',
    'food:',
  ]);

  if (overall) extracted.nicheOverallGrade = overall;
  if (safety) extracted.nicheSafetyGrade = safety;
  if (life) extracted.nicheLifeGrade = life;
  if (food) extracted.nicheFoodGrade = food;

  return extracted;
}

export function loadTavilyKeys(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const keys: string[] = [];
  if (env.TAVILY_API_KEY) keys.push(env.TAVILY_API_KEY);

  for (let index = 1; index <= 99; index++) {
    const key = env[`TAVILY_API_KEY_${index}`];
    if (key) keys.push(key);
  }

  return [...new Set(keys)];
}

async function tavilySearch(
  query: string,
  apiKey: string,
): Promise<TavilySearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      search_depth: 'advanced',
      include_domains: ['niche.com'],
    }),
  });

  if (!response.ok) {
    throw new CampusLifeIngestionError(
      `Tavily search failed with HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    results?: Array<{ url?: string; content?: string }>;
  };
  const results = (data.results ?? [])
    .filter((result) => typeof result.url === 'string')
    .map((result) => ({
      url: result.url as string,
      content: result.content ?? '',
    }));

  results.sort((left, right) => {
    const leftMain = /\/colleges\/[^/]+\/?$/.test(left.url) ? 0 : 1;
    const rightMain = /\/colleges\/[^/]+\/?$/.test(right.url) ? 0 : 1;
    return leftMain - rightMain;
  });

  return results;
}

function nextTavilyKey(keys: readonly string[], index: number): string {
  return keys[index % keys.length];
}

function isTerminalProvenance(value: unknown): boolean {
  const provenance = normalizeSchoolProvenance({ campus: value }).campus;
  if (!provenance) return false;
  if (provenance.tier === 'UNAVAILABLE') return true;
  return provenance.realDataStatus
    ? TERMINAL_REAL_DATA_STATUSES.has(provenance.realDataStatus)
    : false;
}

@Injectable()
export class CampusLifeIngestionService {
  private readonly logger = new Logger(CampusLifeIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly merger: SchoolDataMerger,
    private readonly appilyScrapeService: AppilyScrapeService,
    private readonly bigFutureScrapeService: BigFutureScrapeService,
  ) {}

  async ingest(
    options: CampusLifeIngestionOptions = {},
    actorUserId?: string,
  ): Promise<CampusLifeIngestionResult> {
    const dryRun = options.dryRun ?? true;
    const onlyMissing = options.onlyMissing ?? true;
    const limit = Math.min(options.limit ?? 200, 500);

    const appily = await this.appilyScrapeService.scrapeSchools(
      limit,
      actorUserId,
      {
        dryRun,
        onlyMissingCampusLife: onlyMissing,
      },
    );
    const bigFuture = await this.bigFutureScrapeService.scrapeSchools(
      limit,
      actorUserId,
      {
        dryRun,
        onlyMissingCampusLife: onlyMissing,
      },
    );

    const tavily = await this.ingestNicheGrades({
      dryRun,
      onlyMissing,
      limit,
    });

    return {
      dryRun,
      onlyMissing,
      limit,
      appily,
      bigFuture,
      tavily,
    };
  }

  private async ingestNicheGrades(options: {
    dryRun: boolean;
    onlyMissing: boolean;
    limit: number;
  }): Promise<CampusLifeIngestionResult['tavily']> {
    const schools = await this.findNicheCandidates(
      options.limit,
      options.onlyMissing,
    );

    if (options.dryRun) {
      return {
        scanned: schools.length,
        updatedFields: 0,
        terminalMarked: 0,
        skipped: schools.length,
        failed: 0,
        errors: [],
      };
    }

    const keys = loadTavilyKeys();
    if (keys.length === 0) {
      return {
        scanned: schools.length,
        updatedFields: 0,
        terminalMarked: 0,
        skipped: schools.length,
        failed: schools.length,
        errors: [
          'No TAVILY_API_KEY configured; Niche search was not attempted.',
        ],
      };
    }

    let keyIndex = 0;
    let updatedFields = 0;
    let terminalMarked = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const school of schools) {
      const fieldsToResolve = this.getFieldsToResolve(
        school,
        options.onlyMissing,
      );
      if (fieldsToResolve.length === 0) {
        skipped++;
        continue;
      }

      try {
        const key = nextTavilyKey(keys, keyIndex++);
        const results = await tavilySearch(
          `"${school.name}" Niche grades overall safety student life food`,
          key,
        );
        const extracted = extractNicheCampusGradesFromTavilyResults(results);
        const sourceUrl = results.find((result) =>
          result.url.toLowerCase().includes('niche.com/colleges/'),
        )?.url;
        const incoming: Partial<Record<MergeableField, unknown>> = {};

        for (const field of fieldsToResolve) {
          const value = extracted[field];
          if (value) incoming[field] = value;
        }

        if (Object.keys(incoming).length > 0) {
          const mergeResult = await this.merger.merge(
            school.id,
            incoming,
            DataSource.NICHE_TAVILY,
            {
              sourceUrl,
              extractionMethod: 'TAVILY_SEARCH_SNIPPET',
              confidence: 0.75,
              notes:
                'Niche campus-life grade extracted from Tavily indexed search snippets; use as lifestyle fit signal only.',
            },
          );
          updatedFields += mergeResult.updatedFields.length;
        }

        const unresolvedFields = fieldsToResolve.filter(
          (field) => incoming[field] == null,
        );
        if (unresolvedFields.length > 0) {
          const terminalResult = await this.merger.markFieldsUnavailable(
            school.id,
            unresolvedFields,
            'NO_PUBLIC_REAL_DATA:TAVILY_NICHE',
            {
              sourceUrl,
              extractionMethod: 'TAVILY_SEARCH_SNIPPET',
              reason:
                'No matching Niche campus-life grade was found in Tavily indexed search results.',
            },
          );
          terminalMarked += terminalResult.markedFields.length;
        }
      } catch (error) {
        failed++;
        const message =
          error instanceof Error ? error.message : 'Unknown Tavily error';
        errors.push(`${school.name}: ${message}`);
        this.logger.warn(
          `Campus life ingestion failed for ${school.name}`,
          error,
        );
      }
    }

    return {
      scanned: schools.length,
      updatedFields,
      terminalMarked,
      skipped,
      failed,
      errors,
    };
  }

  private async findNicheCandidates(
    limit: number,
    onlyMissing: boolean,
  ): Promise<NicheCandidate[]> {
    const where: Prisma.SchoolWhereInput = {
      country: 'US',
      ...(onlyMissing
        ? {
            OR: NICHE_CAMPUS_FIELDS.map((field) => ({ [field]: null })),
          }
        : {}),
    };

    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    return this.prisma.school.findMany({
      where,
      select: {
        id: true,
        name: true,
        metadata: true,
        nicheOverallGrade: true,
        nicheSafetyGrade: true,
        nicheLifeGrade: true,
        nicheFoodGrade: true,
      },
      take: limit,
      orderBy: { usNewsRank: { sort: 'asc', nulls: 'last' } },
    });
  }

  private getFieldsToResolve(
    school: NicheCandidate,
    onlyMissing: boolean,
  ): NicheCampusField[] {
    const provenance = normalizeSchoolProvenance(
      toRecord(school.metadata).provenance,
    );

    return NICHE_CAMPUS_FIELDS.filter((field) => {
      if (!onlyMissing) return true;
      const value = school[field];
      if (value) return false;
      return !isTerminalProvenance(provenance[field]);
    });
  }
}

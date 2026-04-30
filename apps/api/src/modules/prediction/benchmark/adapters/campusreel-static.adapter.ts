import { Injectable } from '@nestjs/common';
import { load } from 'cheerio';
import type { BenchmarkProfileInput } from '@study-abroad/shared';
import type {
  StaticTeacher,
  StaticTeacherBucket,
  StaticTeacherEvaluation,
  StaticTeacherHarvestResult,
  StaticTeacherLookupJson,
  StaticTeacherSchoolRef,
} from '../static-teacher.interface';

const SAT_BUCKETS = [1400, 1200, 1100] as const;
const GPA_BUCKETS = [3.9, 3.5, 3.2, 3.0, 2.5] as const;

const MANUAL_CAMPUSREEL_SLUGS: Record<string, string> = {
  'massachusetts institute of technology':
    'massachusetts-institute-of-technology-mit',
  'university of california-los angeles':
    'university-of-california-los-angeles-ucla',
  'university of california-berkeley':
    'university-of-california-berkeley-uc-berkeley',
  'carnegie mellon university': 'carnegie-mellon-university-cmu',
};

type ProbabilityToken = {
  probability: number;
  rawProbability: string;
  confidence: 'low' | 'medium';
};

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function normalizeSchoolKey(name: string): string {
  return normalizeWhitespace(name).toLowerCase();
}

function slugifySchoolName(name: string): string {
  return normalizeSchoolKey(name)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractMetadataSlug(
  metadata?: Record<string, unknown> | null,
): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const slugs = metadata.slugs;
  if (!slugs || typeof slugs !== 'object' || Array.isArray(slugs)) return null;
  const campusreel = (slugs as Record<string, unknown>).campusreel;
  if (typeof campusreel !== 'string') return null;
  const trimmed = campusreel.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveCampusReelSlug(
  school: StaticTeacherSchoolRef,
): string | null {
  const metadataSlug = extractMetadataSlug(school.metadata);
  if (metadataSlug) return metadataSlug;

  const manual = MANUAL_CAMPUSREEL_SLUGS[normalizeSchoolKey(school.name)];
  if (manual) return manual;

  const generated = slugifySchoolName(school.name);
  return generated.length > 0 ? generated : null;
}

export function normalizeProbabilityToken(token: string): ProbabilityToken {
  const compact = token.replace(/\s+/g, '');
  const thresholdMatch = compact.match(/^<(\d+(?:\.\d+)?)$/);
  if (thresholdMatch) {
    const threshold = Number(thresholdMatch[1]);
    return {
      probability: threshold / 200,
      rawProbability: compact,
      confidence: 'low',
    };
  }

  const numeric = Number(compact);
  if (!Number.isFinite(numeric)) {
    throw new Error(
      `CampusReel static parser: invalid probability token "${token}"`,
    );
  }

  return {
    probability: numeric / 100,
    rawProbability: compact,
    confidence: 'medium',
  };
}

function buildBucket(
  axis: 'SAT' | 'GPA',
  bucketValue: number,
  token: ProbabilityToken,
): StaticTeacherBucket {
  const key =
    axis === 'SAT'
      ? `SAT_${Math.round(bucketValue)}`
      : `GPA_${bucketValue.toFixed(1).replace('.', '_')}`;

  return {
    key,
    bucketValue,
    probability: token.probability,
    rawProbability: token.rawProbability,
    confidence: token.confidence,
  };
}

function tryMatchProbability(
  text: string,
  axisLabel: string,
  bucketValue: number,
): ProbabilityToken | null {
  const bucketPattern =
    axisLabel === 'SAT'
      ? `${Math.round(bucketValue)}`
      : bucketValue.toFixed(1).replace('.', '\\.');

  const patterns = [
    new RegExp(
      `${axisLabel}(?:\\s+score)?(?:\\s+of)?\\s*${bucketPattern}[^%]{0,160}?((?:<\\s*)?\\d{1,2}(?:\\.\\d+)?)\\s*%`,
      'i',
    ),
    new RegExp(
      `((?:<\\s*)?\\d{1,2}(?:\\.\\d+)?)\\s*%[^%]{0,160}?${axisLabel}(?:\\s+score)?(?:\\s+of)?\\s*${bucketPattern}`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return normalizeProbabilityToken(match[1]);
    }
  }

  return null;
}

export function parseCampusReelStaticHtml(
  html: string,
  sourceUrl?: string,
): StaticTeacherLookupJson {
  const $ = load(html);
  const normalizedText = normalizeWhitespace($('body').text());

  const sat = SAT_BUCKETS.map((bucketValue) => {
    const matched = tryMatchProbability(normalizedText, 'SAT', bucketValue);
    if (!matched) {
      throw new Error(
        `CampusReel static parser: missing SAT bucket ${bucketValue} in source text`,
      );
    }
    return buildBucket('SAT', bucketValue, matched);
  });

  const gpa = GPA_BUCKETS.map((bucketValue) => {
    const matched = tryMatchProbability(normalizedText, 'GPA', bucketValue);
    if (!matched) {
      throw new Error(
        `CampusReel static parser: missing GPA bucket ${bucketValue} in source text`,
      );
    }
    return buildBucket('GPA', bucketValue, matched);
  });

  return {
    sat,
    gpa,
    sourceUrl,
    harvestedAt: new Date().toISOString(),
  };
}

function findNearestBucket(
  buckets: StaticTeacherBucket[],
  value: number | undefined,
): StaticTeacherEvaluation['satMatch'] | undefined {
  if (value == null || !Number.isFinite(value) || buckets.length === 0) {
    return undefined;
  }

  let best: StaticTeacherBucket | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const bucket of buckets) {
    const distance = Math.abs(bucket.bucketValue - value);
    if (distance < bestDistance) {
      best = bucket;
      bestDistance = distance;
    }
  }

  if (!best) return undefined;

  return {
    key: best.key,
    bucketValue: best.bucketValue,
    probability: best.probability,
    confidence: best.confidence,
    distance: bestDistance,
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function resolveConfidence(
  satMatch?: StaticTeacherEvaluation['satMatch'],
  gpaMatch?: StaticTeacherEvaluation['gpaMatch'],
): 'low' | 'medium' | 'high' {
  const matches = [satMatch, gpaMatch].filter(Boolean);
  if (matches.length === 0) return 'low';
  if (matches.some((match) => match?.confidence === 'low')) return 'low';
  return matches.length === 2 ? 'high' : 'medium';
}

@Injectable()
export class CampusReelStaticAdapter implements StaticTeacher {
  readonly key = 'campusreel-static';
  readonly label = 'CampusReel Static Teacher';
  readonly baseUrl = 'https://www.campusreel.org';
  readonly defaultEnabled = false;
  readonly supportsNumericProbability = true;

  resolveSlug(school: StaticTeacherSchoolRef): string | null {
    return resolveCampusReelSlug(school);
  }

  async harvestSchool(
    school: StaticTeacherSchoolRef,
  ): Promise<StaticTeacherHarvestResult> {
    const slug = this.resolveSlug(school);
    if (!slug) {
      throw new Error(
        `CampusReel static harvest: could not resolve slug for ${school.name}`,
      );
    }

    const sourceUrl = `${this.baseUrl}/college-acceptance-calculator/chance-of-getting-into-${slug}`;
    const response = await fetch(sourceUrl, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; LumniDistillation/1.0; +https://example.com)',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(
        `CampusReel static harvest: ${response.status} ${response.statusText} for ${sourceUrl}`,
      );
    }

    const html = await response.text();
    return {
      slug,
      lookupJson: parseCampusReelStaticHtml(html, sourceUrl),
    };
  }

  evaluateProfile(
    profile: BenchmarkProfileInput,
    school: StaticTeacherSchoolRef,
    lookupJson: StaticTeacherLookupJson,
  ): StaticTeacherEvaluation | null {
    const satScore = profile.testScores.find(
      (score) => score.type === 'SAT',
    )?.score;
    const gpa = profile.gpa;

    const satMatch = findNearestBucket(lookupJson.sat, satScore);
    const gpaMatch = findNearestBucket(lookupJson.gpa, gpa);

    const probabilities = [satMatch?.probability, gpaMatch?.probability].filter(
      (value): value is number => typeof value === 'number',
    );

    if (probabilities.length === 0) {
      return null;
    }

    return {
      probability: average(probabilities),
      confidence: resolveConfidence(satMatch, gpaMatch),
      satMatch,
      gpaMatch,
      rawPayload: {
        schoolId: school.id,
        schoolName: school.name,
        satMatch,
        gpaMatch,
        sourceUrl: lookupJson.sourceUrl,
      },
    };
  }
}

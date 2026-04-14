import { PrismaClient } from '@prisma/client';
import {
  getSchoolFaviconUrl,
  getSchoolLogoDevUrl,
  isValidSchoolLogoUrl,
} from '../../src/common/utils/school-logo.util';
import { buildFieldProvenanceRecord } from '../../src/modules/school/school-provenance.helpers';
import { writeSchoolUpdate } from '../../src/modules/school/school-write.service';

const DELAY_MS = 100;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 250;

export type LogoBackfillSource = 'logo.dev' | 'favicon';

export interface BackfillSchoolLogosOptions {
  prisma: PrismaClient;
  limit?: number;
  dryRun?: boolean;
  overwrite?: boolean;
  source?: LogoBackfillSource;
  logoDevToken?: string | null;
}

export function buildPreferredSchoolLogoUrl(
  website: string | null | undefined,
  logoDevToken?: string | null,
  source?: LogoBackfillSource,
): { logoUrl: string | null; source: LogoBackfillSource } {
  if (source === 'favicon') {
    return {
      logoUrl: getSchoolFaviconUrl(website),
      source: 'favicon',
    };
  }

  const logoDevUrl = getSchoolLogoDevUrl(website, logoDevToken);
  if (logoDevUrl) {
    return { logoUrl: logoDevUrl, source: 'logo.dev' };
  }

  return {
    logoUrl: getSchoolFaviconUrl(website),
    source: 'favicon',
  };
}

async function updateWithRetry(
  prisma: PrismaClient,
  id: string,
  logoUrl: string,
  existingMetadata: unknown,
  dryRun: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (dryRun) return { ok: true };

  let lastError: string | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await writeSchoolUpdate(prisma as any, id, {
        fields: { logoUrl },
        provenance: buildFieldProvenanceRecord(['logoUrl'], {
          source: 'SCRAPER',
          fetchedAt: new Date().toISOString(),
        }),
        existingMetadata,
      });
      return { ok: true };
    } catch (error) {
      lastError = (error as Error).message;
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  return { ok: false, error: lastError };
}

export async function backfillSchoolLogos({
  prisma,
  limit = 2000,
  dryRun = false,
  overwrite = false,
  source,
  logoDevToken,
}: BackfillSchoolLogosOptions): Promise<{
  filled: number;
  failed: number;
  skipped: number;
  totalCandidates: number;
  source: LogoBackfillSource;
}> {
  const schools = await prisma.school.findMany({
    where: { website: { not: null } },
    select: {
      id: true,
      name: true,
      website: true,
      logoUrl: true,
      metadata: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
  });

  const candidates = schools
    .filter((school) => overwrite || !isValidSchoolLogoUrl(school.logoUrl))
    .slice(0, Math.max(1, limit));

  let filled = 0;
  let failed = 0;
  let skipped = 0;
  let usedSource: LogoBackfillSource = source ?? 'favicon';

  for (const school of candidates) {
    const { logoUrl, source: resolvedSource } = buildPreferredSchoolLogoUrl(
      school.website,
      logoDevToken,
      source,
    );
    usedSource = resolvedSource;

    if (!logoUrl) {
      skipped++;
      continue;
    }

    const result = await updateWithRetry(
      prisma,
      school.id,
      logoUrl,
      school.metadata,
      dryRun,
    );
    if (result.ok) {
      filled++;
    } else {
      failed++;
    }

    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  return {
    filled,
    failed,
    skipped,
    totalCandidates: candidates.length,
    source: usedSource,
  };
}

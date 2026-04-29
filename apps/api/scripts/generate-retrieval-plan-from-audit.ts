#!/usr/bin/env tsx
/**
 * Builds retrieval-plan-{date}.json from coverage audit + known-no-cds + DB heuristic flags.
 * Aligns with CDS mining plan: planVersion, buckets, discover defaults, nextChunk.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const today = new Date().toISOString().slice(0, 10);
  return {
    audit:
      get('audit') ??
      path.join(
        process.cwd(),
        'scripts',
        'coverage-reports',
        `coverage-${today}.json`,
      ),
    out:
      get('out') ??
      path.join(
        process.cwd(),
        'scripts',
        'cds-data',
        `retrieval-plan-${today}.json`,
      ),
    chunkSize: Number(get('chunk-size') ?? 30),
    tavilyKeyBudget: Number(get('tavily-key-budget') ?? 15),
  };
}

function isHeuristicIntl(meta: unknown): boolean {
  const m = meta as {
    provenance?: Record<string, { source?: string; tier?: string }>;
  } | null;
  const p = m?.provenance?.intlAcceptanceRate;
  return (
    p?.tier === 'INFERRED' ||
    Boolean(p?.source?.toUpperCase().includes('HEURISTIC'))
  );
}

async function main() {
  const args = parseArgs();
  const audit = JSON.parse(fs.readFileSync(args.audit, 'utf8')) as {
    generatedAt?: string;
    totals?: Record<string, number>;
    items?: { heuristicFields?: string[] }[];
  };

  const knownPath = path.join(
    process.cwd(),
    'scripts',
    'cds-data',
    'known-no-cds.json',
  );
  const known = JSON.parse(fs.readFileSync(knownPath, 'utf8')) as {
    schools: { schoolNameNorm: string; reason?: string }[];
  };
  const skip = new Set(
    known.schools.map((s) => s.schoolNameNorm.toLowerCase()),
  );

  const prisma = new PrismaClient();
  const schools = await prisma.school.findMany({
    where: {
      country: { in: ['US', 'United States', 'United States of America'] },
    },
    select: {
      id: true,
      name: true,
      nameNorm: true,
      usNewsRank: true,
      website: true,
      intlAcceptanceRate: true,
      metadata: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { nameNorm: 'asc' }],
  });

  const targets = schools.filter(
    (s) =>
      s.intlAcceptanceRate != null &&
      isHeuristicIntl(s.metadata) &&
      !skip.has(s.nameNorm.toLowerCase()),
  );

  const nextChunkIds = targets.slice(0, args.chunkSize).map((s) => s.id);

  const heuristicIntlFromAudit =
    audit.items?.filter((i) =>
      (i.heuristicFields ?? []).includes('intlAcceptanceRate'),
    ).length ?? 0;

  const plan = {
    _meta: {
      generatedAt: new Date().toISOString(),
      tavilyKeyBudget: args.tavilyKeyBudget,
      primaryField: 'intlAcceptanceRate',
      assumptions:
        'Prioritize probe_ir + direct URLs before Tavily; chunk discover (~30) then replan from registry metrics.',
      auditInput: path.relative(process.cwd(), args.audit),
      heuristicIntlAuditCount: heuristicIntlFromAudit,
      heuristicIntlAfterKnownNoCds: targets.length,
    },
    planVersion: 1,
    supersedes: null as string | null,
    replanHistory: [] as Array<Record<string, unknown>>,
    status: 'active',
    zeroQuotaFirst: true,
    orderedSteps: [
      'merge_known_no_cds_json_into_probe_and_discover',
      'probe_ir_cds_urls',
      'direct_pdf_xlsx_where_plan_notes',
      'tavily_multistage_chunks',
      'extract_import_audit',
    ],
    buckets: [
      {
        name: 'heuristic_intl_not_in_known_no_cds',
        rationale:
          'US schools with intlAcceptanceRate still heuristic; excludes known-no-cds list.',
        schoolIds: targets.map((s) => s.id),
        tactics: ['probe_ir', 'direct_ir_url', 'tavily_multistage'],
        notes: `Ordered by usNewsRank asc; ${targets.length} schools after skip list.`,
      },
    ],
    discover: {
      missingField: 'intlAcceptanceRate',
      missingOnly: true,
      maxStages: 4,
      maxResults: 8,
      limit: args.chunkSize,
      delayMs: 250,
      engine: 'tavily',
      tavilyKeyLimit: args.tavilyKeyBudget,
    },
    abortRules: {
      consecutiveNoSelectedUrl: 8,
      consecutiveC1BlankAfterDownload: 5,
      stopWhenAllTavilyKeysExhausted: true,
    },
    postZeroQuota: {
      replanRequired: true,
      promptForAi:
        'After probe: paste registry _meta (selectedUrls count) + failures sample; revise discover.limit / maxStages / nextChunk.schoolIds.',
    },
    nextChunk: {
      schoolIds: nextChunkIds,
      discoverOverrides: {
        limit: nextChunkIds.length,
      },
    },
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        out: args.out,
        targets: targets.length,
        nextChunk: nextChunkIds.length,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

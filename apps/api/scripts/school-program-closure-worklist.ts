#!/usr/bin/env tsx
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type Severity = 'critical' | 'warning' | 'info';
type Bucket =
  | 'trusted-usable'
  | 'missing-coverage'
  | 'missing-provenance'
  | 'needs-review'
  | 'terminal';
type WorklistAction =
  | 'trusted-closed'
  | 'terminal-accepted'
  | 'source-search'
  | 'source-evidence-review'
  | 'heuristic-review'
  | 'unsupported-rate-review';

interface Args {
  out: string;
  limit: number;
  includeClosed: boolean;
}

interface WorklistRow {
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  programId: string | null;
  gap: string;
  bucket: Bucket;
  action: WorklistAction;
  severity: Severity;
  route: string;
  details: Record<string, unknown>;
}

const API_ROOT = detectApiRoot();
const TERMINAL_STATUSES = new Set([
  'TERMINAL',
  'NO_PUBLIC_PROGRAM_DATA',
  'NO_PUBLIC_REAL_DATA',
  'UPSTREAM_NOT_PUBLISHED',
  'OFFICIAL_BLANK_FIELD',
]);

function detectApiRoot() {
  if (path.basename(process.cwd()) === 'api') return process.cwd();
  const candidate = path.join(process.cwd(), 'apps', 'api');
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  return process.cwd();
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const inline = argv.find((arg) => arg.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    out: path.resolve(
      API_ROOT,
      get(
        '--out',
        path.join(
          API_ROOT,
          'scripts',
          'closure-reports',
          `school-program-worklist-${stamp}.json`,
        ),
      )!,
    ),
    limit: Number(get('--limit', '500')),
    includeClosed: argv.includes('--include-closed'),
  };
}

async function main() {
  const args = parseArgs();
  const prisma = new PrismaClient();
  try {
    const schools = await prisma.school.findMany({
      where: {
        country: { in: ['US', 'United States', 'United States of America'] },
      },
      orderBy: [
        { usNewsRank: { sort: 'asc', nulls: 'last' } },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        usNewsRank: true,
        metadata: true,
        programs: {
          orderBy: [{ cipCode: 'asc' }, { programName: 'asc' }],
          select: {
            id: true,
            cipCode: true,
            programName: true,
            competitiveness: true,
            acceptanceRateEstimate: true,
            medianEarnings: true,
            updatedAt: true,
          },
        },
      },
    });

    const rows = schools.flatMap(classifySchoolPrograms);
    const orderedRows = rows
      .filter(
        (row) =>
          args.includeClosed ||
          !['trusted-closed', 'terminal-accepted'].includes(row.action),
      )
      .sort(compareRows);
    const limitedRows = orderedRows.slice(0, args.limit);
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only',
      limits: {
        requested: args.limit,
        emittedRows: limitedRows.length,
        totalOpenRows: orderedRows.length,
      },
      summary: {
        schools: schools.length,
        schoolsWithPrograms: schools.filter((school) => school.programs.length)
          .length,
        programs: schools.reduce(
          (total, school) => total + school.programs.length,
          0,
        ),
        byAction: countBy(orderedRows, (row) => row.action),
        byGap: countBy(orderedRows, (row) => row.gap),
        bySeverity: countBy(orderedRows, (row) => row.severity),
      },
      nextCampaigns: rankCampaigns(orderedRows),
      rows: limitedRows,
    };
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`School program closure worklist: ${args.out}`);
    console.log(
      `Rows: ${limitedRows.length}/${orderedRows.length}; schools=${schools.length}; programs=${report.summary.programs}`,
    );
    for (const campaign of report.nextCampaigns.slice(0, 6)) {
      console.log(
        `- ${campaign.action}/${campaign.gap}: count=${campaign.count} severity=${campaign.maxSeverity}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function classifySchoolPrograms(school: any): WorklistRow[] {
  const provenance = programProvenance(school.metadata);
  const isTerminal = TERMINAL_STATUSES.has(
    stringOrEmpty(provenance.realDataStatus ?? provenance.status),
  );
  const sourceUrl = stringOrNull(provenance.sourceUrl);
  const source = stringOrNull(provenance.source);
  const rows: WorklistRow[] = [];
  if (school.programs.length === 0) {
    rows.push(
      schoolRow(
        school,
        null,
        isTerminal
          ? 'program.terminal_no_public_data'
          : 'program.coverage_missing',
        isTerminal ? 'terminal' : 'missing-coverage',
        isTerminal ? 'terminal-accepted' : 'source-search',
        isTerminal ? 'info' : 'warning',
        { provenance },
      ),
    );
    return rows;
  }
  if (!sourceUrl) {
    rows.push(
      schoolRow(
        school,
        null,
        'program.provenance_source_url_missing',
        'missing-provenance',
        'source-evidence-review',
        'warning',
        { programCount: school.programs.length, provenance },
      ),
    );
  }
  for (const program of school.programs) {
    const hasExactRate = program.acceptanceRateEstimate !== null;
    if (hasExactRate && !sourceUrl) {
      rows.push(
        schoolRow(
          school,
          program,
          'program.exact_rate_without_source',
          'missing-provenance',
          'unsupported-rate-review',
          'critical',
          { provenance },
        ),
      );
    } else if (!hasExactRate && program.competitiveness === 3 && !source) {
      rows.push(
        schoolRow(
          school,
          program,
          'program.heuristic_default_competitiveness',
          'needs-review',
          'heuristic-review',
          'info',
          { provenance },
        ),
      );
    }
  }
  if (rows.length === 0) {
    rows.push(
      schoolRow(
        school,
        school.programs[0],
        'program.trusted_or_terminal',
        'trusted-usable',
        'trusted-closed',
        'info',
        { programCount: school.programs.length, provenance },
      ),
    );
  }
  return rows;
}

function schoolRow(
  school: any,
  program: any | null,
  gap: string,
  bucket: Bucket,
  action: WorklistAction,
  severity: Severity,
  details: Record<string, unknown>,
): WorklistRow {
  return {
    schoolId: school.id,
    schoolName: school.name,
    usNewsRank: school.usNewsRank,
    programId: program?.id ?? null,
    gap,
    bucket,
    action,
    severity,
    route: program
      ? `/admin/schools/${school.id}/programs/${program.id}`
      : `/admin/schools/${school.id}/programs`,
    details: {
      ...details,
      cipCode: program?.cipCode,
      programName: program?.programName,
      competitiveness: program?.competitiveness,
      acceptanceRateEstimate:
        program?.acceptanceRateEstimate === null ||
        program?.acceptanceRateEstimate === undefined
          ? null
          : Number(program.acceptanceRateEstimate),
      medianEarnings: program?.medianEarnings,
      updatedAt: program?.updatedAt?.toISOString?.() ?? null,
    },
  };
}

function programProvenance(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {};
  const meta = metadata as Record<string, any>;
  const provenance = meta.provenance;
  if (!provenance || typeof provenance !== 'object') return {};
  const programRates = provenance.programRates;
  return programRates && typeof programRates === 'object' ? programRates : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function countBy<T extends string>(
  rows: WorklistRow[],
  getKey: (row: WorklistRow) => T,
): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function rankCampaigns(rows: WorklistRow[]) {
  const grouped = new Map<string, WorklistRow[]>();
  for (const row of rows) {
    const key = `${row.action}:${row.gap}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return Array.from(grouped.entries())
    .map(([key, group]) => {
      const [action, gap] = key.split(':');
      return {
        action,
        gap,
        count: group.length,
        score: group.reduce(
          (sum, row) => sum + severityWeight(row.severity),
          0,
        ),
        maxSeverity: maxSeverity(group),
        sampleSchoolIds: group.slice(0, 5).map((row) => row.schoolId),
      };
    })
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 12);
}

function compareRows(a: WorklistRow, b: WorklistRow): number {
  return (
    severityWeight(b.severity) - severityWeight(a.severity) ||
    a.schoolName.localeCompare(b.schoolName) ||
    a.gap.localeCompare(b.gap)
  );
}

function maxSeverity(rows: WorklistRow[]): Severity {
  if (rows.some((row) => row.severity === 'critical')) return 'critical';
  if (rows.some((row) => row.severity === 'warning')) return 'warning';
  return 'info';
}

function severityWeight(severity: Severity): number {
  if (severity === 'critical') return 5;
  if (severity === 'warning') return 3;
  return 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

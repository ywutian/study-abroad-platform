#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeSchoolName } from '@study-abroad/shared';
import {
  buildFieldProvenanceRecord,
  deepMergeRecords,
  toRecord,
} from '../src/modules/school/school-provenance.helpers';

type Row = Record<string, string>;

function loadDotEnv() {
  for (const file of [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/api/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match || process.env[match[1]] != null) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);
  return {
    input: get('input') ?? get('file'),
    hd: get('hd'),
    out: get('out'),
    base: get('base') ?? process.env.API_BASE,
    token: get('token') ?? process.env.ADMIN_JWT,
    cycleYear: Number(get('cycle-year') ?? new Date().getFullYear()),
    live: has('live'),
    directDb: has('direct-db'),
    actorUserId:
      get('actor-user-id') ??
      process.env.ADMIN_USER_ID ??
      'system-ipeds-import',
  };
}

export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(current);
      current = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((cell) => cell.trim()));
  if (!header) return [];
  const keys = header.map((h) => h.trim().replace(/^\uFEFF/, ''));
  return body.map((cells) =>
    Object.fromEntries(
      keys.map((key, index) => [key, cells[index]?.trim() ?? '']),
    ),
  );
}

export function attachInstitutionNames(rows: Row[], hdRows: Row[]): Row[] {
  const namesByUnitid = new Map<string, string>();
  for (const row of hdRows) {
    const unitid = first(row, ['unitid', 'UNITID']);
    const name = first(row, ['INSTNM', 'Institution']);
    if (unitid && name) namesByUnitid.set(unitid, name);
  }
  return rows.map((row) => {
    if (first(row, ['schoolNameNorm', 'nameNorm', 'Institution', 'INSTNM'])) {
      return row;
    }
    const unitid = first(row, ['unitid', 'UNITID']);
    const name = unitid ? namesByUnitid.get(unitid) : undefined;
    return name ? { ...row, INSTNM: name } : row;
  });
}

function first(row: Row, keys: string[]): string | undefined {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && direct !== '') return direct;
    const found = Object.keys(row).find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase(),
    );
    if (found && row[found]) return row[found];
  }
  return undefined;
}

function num(value: string | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value.replace(/[%,$]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function firstNum(row: Row, keys: string[]): number | undefined {
  return num(first(row, keys));
}

function sum(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left == null || right == null) return undefined;
  return left + right;
}

function pct(
  numerator: number | undefined,
  denominator: number | undefined,
): number | undefined {
  if (numerator == null || denominator == null || denominator <= 0)
    return undefined;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function hasColumn(rows: Row[], keys: string[]): boolean {
  return rows.some((row) =>
    keys.some((key) =>
      Object.keys(row).some(
        (candidate) => candidate.toLowerCase() === key.toLowerCase(),
      ),
    ),
  );
}

function buildEfRaceEnrollmentPayloadRows(rows: Row[]) {
  const preferred = new Map<string, any>();
  const fallback = new Map<string, any>();

  for (const row of rows) {
    const unitid = first(row, ['unitid', 'UNITID']);
    if (!unitid) continue;
    const efalevel = num(first(row, ['EFALEVEL', 'efalevel']));
    const total = num(first(row, ['EFTOTLT', 'eftotlt']));
    const intl = num(first(row, ['EFNRALT', 'efnralt']));
    if (total == null || total <= 0 || intl == null) continue;

    const payload = {
      unitid,
      schoolNameNorm: first(row, [
        'schoolNameNorm',
        'nameNorm',
        'Institution',
        'INSTNM',
      ])
        ? normalizeSchoolName(
            first(row, [
              'schoolNameNorm',
              'nameNorm',
              'Institution',
              'INSTNM',
            ]) as string,
          )
        : undefined,
      totalEnrollment: total,
      intlStudentPct: pct(intl, total),
    };

    if (efalevel === 2) preferred.set(unitid, payload);
    if (efalevel === 1) fallback.set(unitid, payload);
  }

  return Array.from(new Map([...fallback, ...preferred]).values()).filter(
    (row: any) => row.intlStudentPct != null,
  );
}

function buildEfResidencePayloadRows(rows: Row[]) {
  const grouped = new Map<
    string,
    {
      unitid: string;
      schoolNameNorm?: string;
      total?: number;
      international?: number;
    }
  >();

  for (const row of rows) {
    const unitid = first(row, ['unitid', 'UNITID']);
    if (!unitid) continue;
    const state = num(first(row, ['EFCSTATE', 'efcstate']));
    const count = num(first(row, ['EFRES01', 'efres01']));
    if (state == null || count == null) continue;
    const group =
      grouped.get(unitid) ??
      ({
        unitid,
        schoolNameNorm: first(row, [
          'schoolNameNorm',
          'nameNorm',
          'Institution',
          'INSTNM',
        ])
          ? normalizeSchoolName(
              first(row, [
                'schoolNameNorm',
                'nameNorm',
                'Institution',
                'INSTNM',
              ]) as string,
            )
          : undefined,
      } satisfies {
        unitid: string;
        schoolNameNorm?: string;
        total?: number;
        international?: number;
      });

    if (state === 99) group.total = count;
    if (state === 90) group.international = count;
    grouped.set(unitid, group);
  }

  return Array.from(grouped.values())
    .map((row) => ({
      unitid: row.unitid,
      schoolNameNorm: row.schoolNameNorm,
      intlStudentPct: pct(row.international, row.total),
    }))
    .filter((row) => row.intlStudentPct != null);
}

export function buildPayloadRows(rows: Row[]) {
  if (
    hasColumn(rows, ['EFALEVEL']) &&
    hasColumn(rows, ['EFTOTLT']) &&
    hasColumn(rows, ['EFNRALT'])
  ) {
    return buildEfRaceEnrollmentPayloadRows(rows);
  }

  if (hasColumn(rows, ['EFCSTATE']) && hasColumn(rows, ['EFRES01'])) {
    return buildEfResidencePayloadRows(rows);
  }

  return rows
    .map((row) => {
      const unitid = first(row, ['unitid', 'UNITID']);
      if (!unitid) return null;
      const schoolName = first(row, [
        'schoolNameNorm',
        'nameNorm',
        'Institution',
        'INSTNM',
      ]);
      const applicants = num(
        first(row, ['number_applied', 'applicants', 'APPLCN']),
      );
      const admitted = num(
        first(row, ['number_admitted', 'admitted', 'ADMSSN']),
      );
      const intlApplicants = num(
        first(row, ['intl_applicants', 'international_applicants']),
      );
      const intlAdmitted = num(
        first(row, ['intl_admitted', 'international_admitted']),
      );
      const oosApplicants = num(
        first(row, ['oos_applicants', 'out_of_state_applicants']),
      );
      const oosAdmitted = num(
        first(row, ['oos_admitted', 'out_of_state_admitted']),
      );
      const totalEnrollment = num(
        first(row, ['totalEnrollment', 'total_enrollment', 'EFTOTLT']),
      );
      const intlEnrollment = num(first(row, ['EFNRALT', 'intl_enrollment']));
      const studentCount = firstNum(row, [
        'studentCount',
        'student_count',
        'UGDS',
        'EFTOTLT',
      ]);
      const tuition = firstNum(row, [
        'tuition',
        'tuition_in_state',
        'tuition_out_state',
        'TUITION2',
        'TUITION3',
        'CHG2AY2',
        'CHG2AY3',
        'chg2ay3',
      ]);
      const avgSalary = firstNum(row, [
        'avgSalary',
        'avg_salary',
        'MD_EARN_WNE_P10',
        'EARN_MDN_HI_2YR',
      ]);
      const graduationRate = firstNum(row, [
        'graduationRate',
        'graduation_rate',
        'GRRTTOT',
        'DRVGR2024_GRRTTOT',
        'C150_4',
      ]);
      const retentionRate = firstNum(row, [
        'retentionRate',
        'retention_rate',
        'RET_FT4',
        'RET_FTL4',
        'RET_PCF',
      ]);
      const studentFacultyRatio = firstNum(row, [
        'studentFacultyRatio',
        'student_faculty_ratio',
        'STUFACR',
      ]);
      const percentNeedMet = firstNum(row, [
        'percentNeedMet',
        'percent_need_met',
        'PCT_NEED_MET',
      ]);
      const averageAidPackage = firstNum(row, [
        'averageAidPackage',
        'average_aid_package',
        'AVG_AWARD',
        'ANYAIDM',
      ]);
      const averageNetPrice = firstNum(row, [
        'averageNetPrice',
        'average_net_price',
        'NPT4_PUB',
        'NPT4_PRIV',
        'NPT4_048_PUB',
        'NPT4_048_PRIV',
      ]);
      const roomAndBoard = firstNum(row, [
        'roomAndBoard',
        'room_and_board',
        'RMBRDAMT',
        'ROOMBOARD',
      ]);
      const applicationFee = firstNum(row, [
        'applicationFee',
        'application_fee',
        'APPLFEEU',
        'APPFEE',
      ]);
      const salary6YrPostGrad = firstNum(row, [
        'salary6YrPostGrad',
        'salary_6yr_post_grad',
        'MD_EARN_WNE_P6',
      ]);
      const loanDefaultRate = firstNum(row, [
        'loanDefaultRate',
        'loan_default_rate',
        'CDR3',
      ]);
      const monthlyLoanPayment = firstNum(row, [
        'monthlyLoanPayment',
        'monthly_loan_payment',
        'DEBT_MDN_SUPP',
      ]);
      const sat25 =
        num(first(row, ['sat25', 'sat_25'])) ??
        sum(num(first(row, ['SATVR25'])), num(first(row, ['SATMT25'])));
      const satAvg =
        num(first(row, ['satAvg', 'sat_avg'])) ??
        sum(num(first(row, ['SATVR50'])), num(first(row, ['SATMT50'])));
      const sat75 =
        num(first(row, ['sat75', 'sat_75'])) ??
        sum(num(first(row, ['SATVR75'])), num(first(row, ['SATMT75'])));
      return {
        unitid,
        schoolNameNorm: schoolName
          ? normalizeSchoolName(schoolName)
          : undefined,
        acceptanceRate:
          num(first(row, ['acceptanceRate', 'admit_rate'])) ??
          pct(admitted, applicants),
        intlAcceptanceRate:
          num(first(row, ['intlAcceptanceRate', 'intl_admit_rate'])) ??
          pct(intlAdmitted, intlApplicants),
        oosAcceptanceRate:
          num(first(row, ['oosAcceptanceRate', 'oos_admit_rate'])) ??
          pct(oosAdmitted, oosApplicants),
        intlStudentPct:
          num(
            first(row, [
              'intlStudentPct',
              'intl_student_pct',
              'international_student_pct',
            ]),
          ) ?? pct(intlEnrollment, totalEnrollment),
        totalEnrollment,
        studentCount,
        tuition,
        avgSalary,
        graduationRate,
        retentionRate,
        studentFacultyRatio,
        percentNeedMet,
        averageAidPackage,
        averageNetPrice,
        roomAndBoard,
        applicationFee,
        salary6YrPostGrad,
        loanDefaultRate,
        monthlyLoanPayment,
        sat25,
        satAvg,
        sat75,
        act25:
          num(first(row, ['act25', 'act_25'])) ?? num(first(row, ['ACTCM25'])),
        actAvg:
          num(first(row, ['actAvg', 'act_avg'])) ??
          num(first(row, ['ACTCM50'])),
        act75:
          num(first(row, ['act75', 'act_75'])) ?? num(first(row, ['ACTCM75'])),
      };
    })
    .filter(Boolean)
    .filter((row: any) =>
      [
        'acceptanceRate',
        'intlAcceptanceRate',
        'oosAcceptanceRate',
        'intlStudentPct',
        'totalEnrollment',
        'studentCount',
        'tuition',
        'avgSalary',
        'graduationRate',
        'retentionRate',
        'studentFacultyRatio',
        'percentNeedMet',
        'averageAidPackage',
        'averageNetPrice',
        'roomAndBoard',
        'applicationFee',
        'salary6YrPostGrad',
        'loanDefaultRate',
        'monthlyLoanPayment',
        'sat25',
        'satAvg',
        'sat75',
        'act25',
        'actAvg',
        'act75',
      ].some((field) => row[field] != null),
    );
}

function readInputText(input: string): string {
  if (input.toLowerCase().endsWith('.zip')) {
    return execFileSync('unzip', ['-p', input], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  }
  return fs.readFileSync(input, 'utf8');
}

function normalizePercent(input: number | undefined | null): number | null {
  if (input == null || !Number.isFinite(input) || input < 0) return null;
  const percent = input < 1 ? input * 100 : input;
  return Math.round(percent * 100) / 100;
}

function sourceUrlForInput(input: string, cycleYear: number): string {
  const file = path.basename(input).toUpperCase();
  const family = /^ADM/.test(file)
    ? `ADM${cycleYear}`
    : /^EF/.test(file)
      ? (file.match(/^EF\d{4}[A-Z]?/)?.[0] ?? `EF${cycleYear}`)
      : /^IC/.test(file)
        ? `IC${cycleYear}`
        : /^SFA/.test(file)
          ? `SFA${cycleYear}`
          : /^GR/.test(file)
            ? `GR${cycleYear}`
            : /^OM/.test(file)
              ? `OM${cycleYear}`
              : /^DRVADM/.test(file)
                ? `DRVADM${cycleYear}`
                : null;
  if (!family) return 'https://nces.ed.gov/ipeds/use-the-data';
  return `https://nces.ed.gov/ipeds/datacenter/data/${family}.zip`;
}

async function applyDirectDb(
  rows: any[],
  opts: {
    dryRun: boolean;
    cycleYear: number;
    actorUserId: string;
    input: string;
  },
) {
  const prisma = new PrismaClient();
  const startedAt = Date.now();
  const result = {
    dryRun: opts.dryRun,
    scanned: rows.length,
    updated: 0,
    skippedNoChange: 0,
    notFound: [] as Array<{
      rowIndex: number;
      unitid?: string;
      schoolNameNorm?: string;
    }>,
    changes: [] as Array<{
      schoolId: string;
      schoolName: string;
      changedFields: string[];
      before: Record<string, number | null>;
      after: Record<string, number>;
    }>,
    durationMs: 0,
  };

  try {
    const unitids = rows.map((row) => row.unitid).filter(Boolean);
    const norms = rows.map((row) => row.schoolNameNorm).filter(Boolean);
    if (unitids.length === 0 && norms.length === 0) return result;
    const schools = await prisma.school.findMany({
      where: {
        OR: [
          unitids.length ? { ipedsId: { in: unitids } } : {},
          norms.length ? { nameNorm: { in: norms } } : {},
        ].filter((item) => Object.keys(item).length > 0),
      },
      select: {
        id: true,
        name: true,
        nameNorm: true,
        ipedsId: true,
        acceptanceRate: true,
        intlAcceptanceRate: true,
        oosAcceptanceRate: true,
        intlStudentPct: true,
        totalEnrollment: true,
        studentCount: true,
        tuition: true,
        avgSalary: true,
        graduationRate: true,
        retentionRate: true,
        studentFacultyRatio: true,
        percentNeedMet: true,
        averageAidPackage: true,
        averageNetPrice: true,
        roomAndBoard: true,
        applicationFee: true,
        salary6YrPostGrad: true,
        loanDefaultRate: true,
        monthlyLoanPayment: true,
        sat25: true,
        satAvg: true,
        sat75: true,
        act25: true,
        actAvg: true,
        act75: true,
        metadata: true,
      },
    });
    const byUnitid = new Map(schools.map((school) => [school.ipedsId, school]));
    const byName = new Map(schools.map((school) => [school.nameNorm, school]));
    const rateFields = [
      'acceptanceRate',
      'intlAcceptanceRate',
      'oosAcceptanceRate',
    ] as const;
    const percentPointFields = ['intlStudentPct'] as const;
    const decimalPercentFields = [
      'graduationRate',
      'retentionRate',
      'percentNeedMet',
      'loanDefaultRate',
    ] as const;
    const integerFields = [
      'totalEnrollment',
      'studentCount',
      'tuition',
      'avgSalary',
      'studentFacultyRatio',
      'averageAidPackage',
      'averageNetPrice',
      'roomAndBoard',
      'applicationFee',
      'salary6YrPostGrad',
      'monthlyLoanPayment',
      'sat25',
      'satAvg',
      'sat75',
      'act25',
      'actAvg',
      'act75',
    ] as const;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const school =
        byUnitid.get(row.unitid) ??
        (row.schoolNameNorm ? byName.get(row.schoolNameNorm) : undefined);
      if (!school) {
        result.notFound.push({
          rowIndex: index,
          unitid: row.unitid,
          schoolNameNorm: row.schoolNameNorm,
        });
        continue;
      }

      const updates: Record<string, Prisma.Decimal | number> = {};
      const before: Record<string, number | null> = {};
      const after: Record<string, number> = {};
      const changedFields: string[] = [];

      for (const field of rateFields) {
        const normalized = normalizePercent(row[field]);
        if (normalized == null) continue;
        const currentDecimal = school[field] as Prisma.Decimal | null;
        const current = currentDecimal ? currentDecimal.toNumber() : null;
        before[field] = current;
        if (current != null && Math.abs(current - normalized) < 0.005) continue;
        updates[field] = new Prisma.Decimal(normalized);
        after[field] = normalized;
        changedFields.push(field);
      }

      for (const field of percentPointFields) {
        const raw = row[field];
        if (raw == null || !Number.isFinite(raw) || raw < 0) continue;
        const next = Math.round(raw * 100) / 100;
        const currentDecimal = school[field] as Prisma.Decimal | null;
        const current = currentDecimal ? currentDecimal.toNumber() : null;
        before[field] = current;
        if (current != null && Math.abs(current - next) < 0.005) continue;
        updates[field] = new Prisma.Decimal(next);
        after[field] = next;
        changedFields.push(field);
      }

      for (const field of decimalPercentFields) {
        const normalized = normalizePercent(row[field]);
        if (normalized == null) continue;
        const currentDecimal = school[field] as Prisma.Decimal | null;
        const current = currentDecimal ? currentDecimal.toNumber() : null;
        before[field] = current;
        if (current != null && Math.abs(current - normalized) < 0.005) continue;
        updates[field] = new Prisma.Decimal(normalized);
        after[field] = normalized;
        changedFields.push(field);
      }

      for (const field of integerFields) {
        const raw = row[field];
        if (raw == null || !Number.isFinite(raw)) continue;
        const next = Math.round(raw);
        const current = school[field] as number | null;
        before[field] = current ?? null;
        if (current === next) continue;
        updates[field] = next;
        after[field] = next;
        changedFields.push(field);
      }

      result.changes.push({
        schoolId: school.id,
        schoolName: school.name,
        changedFields,
        before,
        after,
      });

      if (changedFields.length === 0) {
        result.skippedNoChange += 1;
        continue;
      }
      result.updated += 1;
      if (opts.dryRun) continue;

      const metadata = toRecord(school.metadata);
      const nextMetadata = deepMergeRecords(metadata, {
        provenance: deepMergeRecords(
          toRecord(metadata.provenance),
          buildFieldProvenanceRecord(changedFields, {
            source: `IPEDS_CSV:${opts.cycleYear}:unitid-${row.unitid}`,
            sourceUrl: sourceUrlForInput(opts.input, opts.cycleYear),
            cycleYear: opts.cycleYear,
            verifiedBy: opts.actorUserId,
            confidence: 0.95,
            notes:
              'Official IPEDS CSV import via scripts/import-ipeds-csv.ts --direct-db.',
          }),
        ),
      });

      await prisma.school.update({
        where: { id: school.id },
        data: {
          ...updates,
          metadata: nextMetadata as Prisma.InputJsonValue,
        },
      });
    }
  } finally {
    result.durationMs = Date.now() - startedAt;
    await prisma.$disconnect();
  }

  return result;
}

async function main() {
  loadDotEnv();
  const opts = parseArgs();
  if (!opts.input) throw new Error('--input CSV file is required');
  const text = readInputText(opts.input);
  const csvRows = parseCsv(text);
  const rows = buildPayloadRows(
    opts.hd
      ? attachInstitutionNames(csvRows, parseCsv(readInputText(opts.hd)))
      : csvRows,
  );
  const payload = {
    dryRun: !opts.live,
    cycleYear: opts.cycleYear,
    rows,
  };

  const out =
    opts.out ??
    path.join(
      process.cwd(),
      'scripts/coverage-reports',
      `ipeds-import-${opts.cycleYear}.json`,
    );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Built ${rows.length} IPEDS rows from ${opts.input}`);
  console.log(`Payload: ${out}`);

  if (opts.directDb) {
    const result = await applyDirectDb(rows, {
      dryRun: !opts.live,
      cycleYear: opts.cycleYear,
      actorUserId: opts.actorUserId,
      input: opts.input,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!opts.base || !opts.token) {
    console.log('No --base/--token supplied; payload written only.');
    return;
  }

  const res = await fetch(
    `${opts.base.replace(/\/$/, '')}/api/v1/admin/schools/import/ipeds-csv`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opts.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
  const body = await res.text();
  if (!res.ok)
    throw new Error(`POST failed ${res.status}: ${body.slice(0, 500)}`);
  console.log(body);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

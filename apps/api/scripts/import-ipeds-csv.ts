#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as path from 'node:path';

type Row = Record<string, string>;

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);
  return {
    input: get('input'),
    out: get('out'),
    base: get('base') ?? process.env.API_BASE,
    token: get('token') ?? process.env.ADMIN_JWT,
    cycleYear: Number(get('cycle-year') ?? new Date().getFullYear()),
    live: has('live'),
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
  const keys = header.map((h) => h.trim());
  return body.map((cells) =>
    Object.fromEntries(
      keys.map((key, index) => [key, cells[index]?.trim() ?? '']),
    ),
  );
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

function pct(
  numerator: number | undefined,
  denominator: number | undefined,
): number | undefined {
  if (numerator == null || denominator == null || denominator <= 0)
    return undefined;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export function buildPayloadRows(rows: Row[]) {
  return rows
    .map((row) => {
      const unitid = first(row, ['unitid', 'UNITID']);
      if (!unitid) return null;
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
      return {
        unitid,
        acceptanceRate:
          num(first(row, ['acceptanceRate', 'admit_rate'])) ??
          pct(admitted, applicants),
        intlAcceptanceRate:
          num(first(row, ['intlAcceptanceRate', 'intl_admit_rate'])) ??
          pct(intlAdmitted, intlApplicants),
        oosAcceptanceRate:
          num(first(row, ['oosAcceptanceRate', 'oos_admit_rate'])) ??
          pct(oosAdmitted, oosApplicants),
        sat25: num(first(row, ['sat25', 'sat_25'])),
        satAvg: num(first(row, ['satAvg', 'sat_avg'])),
        sat75: num(first(row, ['sat75', 'sat_75'])),
        act25: num(first(row, ['act25', 'act_25'])),
        act75: num(first(row, ['act75', 'act_75'])),
      };
    })
    .filter(Boolean)
    .filter((row: any) =>
      [
        'acceptanceRate',
        'intlAcceptanceRate',
        'oosAcceptanceRate',
        'sat25',
        'satAvg',
        'sat75',
        'act25',
        'act75',
      ].some((field) => row[field] != null),
    );
}

async function main() {
  const opts = parseArgs();
  if (!opts.input) throw new Error('--input CSV file is required');
  const text = fs.readFileSync(opts.input, 'utf8');
  const rows = buildPayloadRows(parseCsv(text));
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

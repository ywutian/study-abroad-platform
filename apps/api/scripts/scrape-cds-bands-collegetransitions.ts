import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as cheerio from 'cheerio';
import type { CdsBandInputRow } from '../src/modules/prediction/distillation/cds-bands-ingestion.service';

type CliOptions = {
  url: string;
  schoolId?: string;
  schoolNameNorm?: string;
  cycleYear: number;
  source?: string;
  out?: string;
};

const GPA_BANDS = [
  {
    label: '3.75-4.00',
    re: /(3\.75|3\.8|3\.9|4\.0|3\.7\s*[-–]\s*4|3\.75\s*[-–]\s*4)/i,
  },
  { label: '3.50-3.74', re: /(3\.5\s*[-–]\s*3\.7|3\.50\s*[-–]\s*3\.74)/i },
  { label: '3.25-3.49', re: /(3\.25\s*[-–]\s*3\.49|3\.3\s*[-–]\s*3\.4)/i },
  { label: '3.00-3.24', re: /(3\.0\s*[-–]\s*3\.24|3\.00\s*[-–]\s*3\.24)/i },
  { label: '<3.00', re: /(<\s*3\.0|below\s*3\.0|under\s*3\.0)/i },
];

const SAT_BANDS = [
  { label: '1500-1600', re: /(1500\s*[-–]\s*1600|15\d\d)/i },
  { label: '1400-1499', re: /(1400\s*[-–]\s*1499|14\d\d)/i },
  { label: '1300-1399', re: /(1300\s*[-–]\s*1399|13\d\d)/i },
  { label: '<1300', re: /(<\s*1300|below\s*1300|under\s*1300)/i },
];

const ACT_BANDS = [
  { label: '34-36', re: /(34\s*[-–]\s*36|3[4-6])/i },
  { label: '31-33', re: /(31\s*[-–]\s*33|3[1-3])/i },
  { label: '28-30', re: /(28\s*[-–]\s*30|2[8-9]|30)/i },
  { label: '<28', re: /(<\s*28|below\s*28|under\s*28)/i },
];

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const url = get('url');
  const cycleYear = Number(get('cycle-year') ?? new Date().getFullYear());
  if (!url) {
    throw new Error(
      'Usage: pnpm --filter api exec tsx scripts/scrape-cds-bands-collegetransitions.ts --url <url> --school-name-norm <name> --cycle-year 2024 [--out file.json]',
    );
  }
  return {
    url,
    schoolId: get('school-id'),
    schoolNameNorm: get('school-name-norm'),
    cycleYear,
    source: get('source'),
    out: get('out'),
  };
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseRate(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (match) return Number(match[1]) / 100;
  const decimal = text.match(/\b(0\.\d+)\b/);
  if (decimal) return Number(decimal[1]);
  return null;
}

function resolveGpaBand(text: string): string | null {
  return GPA_BANDS.find((band) => band.re.test(text))?.label ?? null;
}

function resolveTestBand(
  text: string,
): { testType: string; testBand: string } | null {
  const sat = SAT_BANDS.find((band) => band.re.test(text));
  if (sat) return { testType: 'SAT', testBand: sat.label };
  const act = ACT_BANDS.find((band) => band.re.test(text));
  if (act) return { testType: 'ACT', testBand: act.label };
  return null;
}

function extractRows(html: string, options: CliOptions): CdsBandInputRow[] {
  const $ = cheerio.load(html);
  const rows: CdsBandInputRow[] = [];
  const source =
    options.source ?? `collegetransitions:${new URL(options.url).pathname}`;

  $('table').each((_tableIndex, table) => {
    $(table)
      .find('tr')
      .each((_rowIndex, row) => {
        const cells = $(row)
          .find('th,td')
          .map((_cellIndex, cell) => normalizeWhitespace($(cell).text()))
          .get()
          .filter(Boolean);
        if (cells.length < 2) return;

        const rowText = cells.join(' | ');
        const admitRate = parseRate(rowText);
        if (admitRate == null) return;

        const gpaBand = resolveGpaBand(rowText);
        const testBand = resolveTestBand(rowText);
        if (!gpaBand && !testBand) return;

        rows.push({
          schoolId: options.schoolId,
          schoolNameNorm: options.schoolNameNorm,
          gpaBand: gpaBand ?? '3.75-4.00',
          testType: testBand?.testType ?? 'GPA_ONLY',
          testBand: testBand?.testBand ?? 'ANY',
          admitRate,
          sampleCount: null,
          cycleYear: options.cycleYear,
          source,
          sourceUrl: options.url,
        });
      });
  });

  const deduped = new Map<string, CdsBandInputRow>();
  for (const row of rows) {
    const key = `${row.schoolId ?? row.schoolNameNorm}:${row.gpaBand}:${row.testType}:${row.testBand}:${row.cycleYear}`;
    deduped.set(key, row);
  }
  return Array.from(deduped.values());
}

async function main() {
  const options = parseArgs();
  const response = await fetch(options.url, {
    headers: {
      'user-agent':
        'study-abroad-platform-cds-curation/1.0 (admin data verification)',
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status}: ${response.statusText}`);
  }
  const html = await response.text();
  const rows = extractRows(html, options);
  const output = {
    dryRun: true,
    sourceUrl: options.url,
    generatedAt: new Date().toISOString(),
    rows,
  };
  const outPath =
    options.out ??
    path.join(
      process.cwd(),
      'scripts/cds-bands/output',
      `${options.schoolNameNorm ?? options.schoolId ?? 'cds-band-scrape'}.json`,
    );
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${rows.length} candidate rows to ${outPath}`);
  if (rows.length === 0) {
    console.warn(
      'No rows detected. This scraper is intentionally conservative; verify the page or extract the CDS C9 table manually.',
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

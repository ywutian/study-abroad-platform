import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import * as cheerio from 'cheerio';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';
import { runWithCronLock } from '../../common/redis/cron-lock.util';

const DEADLINE_REFRESH_LOCK_KEY = 'deadline-refresh:cron-lock';

/**
 * DeadlineRefreshScheduler — keeps `SchoolDeadline` rows in sync with the
 * official school admissions pages after the August "schools refresh their
 * calendars" event.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * BACKGROUND
 * ──────────────────────────────────────────────────────────────────────────
 * `seed-deadlines-2026-2027.ts` seeds 50 schools, but 41 of them are marked
 * `WEB_RESEARCH_2026-05:TENTATIVE_BASED_ON_PRIOR_YEAR` because most schools
 * don't publish the new cycle's dates until August. The August refresh is
 * an annual industry pattern.
 *
 * This scheduler addresses that timing gap in two ways:
 *
 *   1. Every Sunday at 02:00 (a low-traffic window) it scans for rows in
 *      the TENTATIVE state and fetches the source page. A best-effort
 *      date extractor looks for ED/EA/RD deadline candidates in the page
 *      text. When the extracted date matches the stored date, the row
 *      gets auto-confirmed. When it differs, the row is flagged into the
 *      AuditLog as `DEADLINE_NEEDS_REVIEW` so an operator can decide.
 *
 *   2. The extraction is intentionally conservative — we only auto-confirm,
 *      never auto-change. Human review remains the gate for any *change*
 *      in the value. This matches the no-sample-era principle: machines
 *      catch the gap, humans approve the write.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * RELATED
 * ──────────────────────────────────────────────────────────────────────────
 * - apps/api/prisma/seed-deadlines-2026-2027.ts — initial seed
 * - apps/api/src/modules/admin/admin-school-data-health.service.ts —
 *   the admin dashboard surfaces the AuditLog flags as actionable rows
 */

const TENTATIVE_SOURCE_MARKER = 'TENTATIVE_BASED_ON_PRIOR_YEAR';
const AUTO_CONFIRMED_PREFIX = 'AUTO_REFRESH_CONFIRMED';
const NEEDS_REVIEW_PREFIX = 'AUTO_REFRESH_NEEDS_REVIEW';

// Round → keyword patterns we search for on each school's admission page.
// Order matters: SCEA/REA are specific variants that should be matched
// before the generic EA/ED fallback.
const ROUND_KEYWORDS: Array<{ round: string; patterns: RegExp[] }> = [
  {
    round: 'SCEA',
    patterns: [/single[-\s]?choice early action/i, /single[-\s]?choice ea/i],
  },
  {
    round: 'REA',
    patterns: [/restrictive early action/i, /restrictive ea/i],
  },
  {
    round: 'ED2',
    patterns: [/early decision\s*(?:ii|2)\b/i, /\bed\s*(?:ii|2)\b/i],
  },
  // ED matches "Early Decision" or "ED deadline". ED2/SCEA/REA are matched
  // independently above; a page that says "Early Decision II ... Nov 3" will
  // also match this pattern, but the ED row's `applicationDeadline` is set
  // separately, so any cross-talk only matters when a school publishes ED
  // but no ED2 — in which case we'd correctly pick up the ED date.
  { round: 'ED', patterns: [/early decision\b/i, /\bed\s*deadline\b/i] },
  { round: 'EA', patterns: [/early action\b/i, /\bea\s*deadline/i] },
  { round: 'RD', patterns: [/regular decision/i, /\brd\s*deadline/i] },
  { round: 'ROLLING', patterns: [/rolling admission/i, /rolling\s*deadline/i] },
];

// Date formats we recognize in admission-page copy.
// Examples covered:
//   "November 1, 2026", "Nov 1, 2026", "11/1/2026", "2026-11-01"
const DATE_PATTERNS: Array<{
  pattern: RegExp;
  parse: (m: RegExpMatchArray) => Date | null;
}> = [
  {
    // "November 1, 2026" or "Nov. 1 2026"
    pattern:
      /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i,
    parse: (m) => {
      const monthMap: Record<string, number> = {
        january: 1,
        february: 2,
        march: 3,
        april: 4,
        may: 5,
        june: 6,
        july: 7,
        august: 8,
        september: 9,
        october: 10,
        november: 11,
        december: 12,
        jan: 1,
        feb: 2,
        mar: 3,
        apr: 4,
        jun: 6,
        jul: 7,
        aug: 8,
        sep: 9,
        sept: 9,
        oct: 10,
        nov: 11,
        dec: 12,
      };
      const month = monthMap[m[1].toLowerCase()];
      const day = Number(m[2]);
      const year = Number(m[3]);
      if (!month || !day || !year) return null;
      return new Date(Date.UTC(year, month - 1, day, 23, 59, 0));
    },
  },
  {
    // "11/1/2026" or "11-1-2026"
    pattern: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/,
    parse: (m) => {
      const month = Number(m[1]);
      const day = Number(m[2]);
      const year = Number(m[3]);
      if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        year < 2020 ||
        year > 2030
      ) {
        return null;
      }
      return new Date(Date.UTC(year, month - 1, day, 23, 59, 0));
    },
  },
  {
    // "2026-11-01"
    pattern: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,
    parse: (m) => {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        year < 2020 ||
        year > 2030
      ) {
        return null;
      }
      return new Date(Date.UTC(year, month - 1, day, 23, 59, 0));
    },
  },
];

interface DeadlineExtraction {
  round: string;
  extractedDate: Date | null;
  context: string; // surrounding text snippet for audit logging
}

@Injectable()
export class DeadlineRefreshScheduler {
  private readonly logger = new Logger(DeadlineRefreshScheduler.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private redis?: RedisService,
  ) {}

  /**
   * Every Sunday at 02:00 UTC. The August refresh wave happens 2026-08-01
   * → 2026-09-15 for most schools, so weekly granularity is plenty.
   */
  @Cron('0 2 * * 0')
  async refreshTentativeDeadlines() {
    // Single-flight across replicas: otherwise every Cloud Run instance fetches
    // each tentative school's page (N× outbound HTTP) and writes duplicate
    // DEADLINE_NEEDS_REVIEW audit rows.
    const ran = await runWithCronLock(
      this.redis,
      DEADLINE_REFRESH_LOCK_KEY,
      REDIS_TTL.DEADLINE_REFRESH_CRON_LOCK,
      () => this.runRefresh(),
      this.logger,
    );
  }

  private async runRefresh() {
    const startedAt = Date.now();
    this.logger.log('📅 Running tentative-deadline refresh sweep...');

    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    const tentative = await this.prisma.schoolDeadline.findMany({
      where: {
        source: { contains: TENTATIVE_SOURCE_MARKER },
      },
      include: {
        school: { select: { id: true, name: true } },
      },
    });

    if (tentative.length === 0) {
      this.logger.log('✓ No tentative deadlines to refresh.');
      return;
    }

    this.logger.log(`Found ${tentative.length} tentative deadline row(s).`);

    let confirmed = 0;
    let needsReview = 0;
    let fetchErrors = 0;
    let noExtraction = 0;

    // Group rows by sourceUrl extracted from notes — one HTTP fetch per
    // unique URL across the run.
    const bySourceUrl = new Map<string, typeof tentative>();
    for (const row of tentative) {
      const url = extractSourceUrl(row.notes);
      if (!url) {
        noExtraction++;
        continue;
      }
      const arr = bySourceUrl.get(url) ?? [];
      arr.push(row);
      bySourceUrl.set(url, arr);
    }

    for (const [url, rows] of bySourceUrl) {
      try {
        const extracted = await this.fetchAndExtract(url);
        for (const row of rows) {
          const match = extracted.find((e) => e.round === row.round);
          if (!match || !match.extractedDate) {
            noExtraction++;
            continue;
          }
          const currentISO = row.applicationDeadline.toISOString().slice(0, 10);
          const newISO = match.extractedDate.toISOString().slice(0, 10);

          if (currentISO === newISO) {
            // Same value → safe to auto-confirm. We update only the
            // `source` column so downstream provenance reflects the new
            // trust level.
            // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
            await this.prisma.schoolDeadline.update({
              where: { id: row.id },
              data: {
                source: `${AUTO_CONFIRMED_PREFIX}:${new Date().toISOString().slice(0, 10)}:${url}`,
              },
            });
            confirmed++;
          } else {
            // Different value → never auto-write. Flag for admin review.
            await this.flagForReview(
              row.id,
              row.school.name,
              currentISO,
              newISO,
              match,
            );
            needsReview++;
          }
        }
      } catch (err) {
        fetchErrors++;
        this.logger.warn(
          `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `✅ Refresh sweep complete in ${durationMs}ms. ` +
        `confirmed=${confirmed} needsReview=${needsReview} ` +
        `fetchErrors=${fetchErrors} noExtraction=${noExtraction}`,
    );
  }

  /**
   * Fetch an admission page and extract one candidate (round, date) for each
   * known round. Pure HTML parsing — no LLM in the loop, intentionally
   * conservative.
   */
  private async fetchAndExtract(url: string): Promise<DeadlineExtraction[]> {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'StudyAbroadPlatform/1.0 (+https://example.com/bot) DeadlineRefresh',
      },
      // Don't follow forever
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    const results: DeadlineExtraction[] = [];
    for (const { round, patterns } of ROUND_KEYWORDS) {
      const match = patterns.map((p) => p.exec(text)).find((m) => m != null);
      if (!match) continue;

      // Look for the nearest date in a 200-char window after the match.
      const windowStart = match.index ?? 0;
      const windowEnd = Math.min(windowStart + 250, text.length);
      const window = text.slice(windowStart, windowEnd);

      let extractedDate: Date | null = null;
      for (const { pattern, parse } of DATE_PATTERNS) {
        const dm = pattern.exec(window);
        if (dm) {
          extractedDate = parse(dm);
          if (extractedDate) break;
        }
      }

      results.push({
        round,
        extractedDate,
        context: window.slice(0, 120),
      });
    }
    return results;
  }

  private async flagForReview(
    deadlineId: string,
    schoolName: string,
    currentISO: string,
    newISO: string,
    extraction: DeadlineExtraction,
  ): Promise<void> {
    // Mark the row source so the admin data-health dashboard surfaces it.
    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    await this.prisma.schoolDeadline.update({
      where: { id: deadlineId },
      data: {
        source: `${NEEDS_REVIEW_PREFIX}:current=${currentISO}:extracted=${newISO}:${new Date().toISOString().slice(0, 10)}`,
        notes:
          `[NEEDS_REVIEW ${new Date().toISOString().slice(0, 10)}] ` +
          `Auto-extracted ${newISO} differs from stored ${currentISO}. ` +
          `Context: "${extraction.context}"`,
      },
    });

    // Audit log entry — visible to admin dashboards via standard channels.
    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    await this.prisma.auditLog.create({
      data: {
        action: 'DEADLINE_NEEDS_REVIEW',
        resource: 'SchoolDeadline',
        resourceId: deadlineId,
        metadata: {
          schoolName,
          round: extraction.round,
          currentDate: currentISO,
          extractedDate: newISO,
          context: extraction.context,
        },
      },
    });
  }
}

/**
 * SchoolDeadline.notes is free-text but our seed convention is
 * `[optional prefix] | source: <url>`. Extract the URL when present.
 */
function extractSourceUrl(notes: string | null): string | null {
  if (!notes) return null;
  const match = /source:\s*(https?:\/\/\S+)/i.exec(notes);
  return match ? match[1] : null;
}

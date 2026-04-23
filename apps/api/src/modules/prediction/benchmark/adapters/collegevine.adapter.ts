import { Injectable, Logger } from '@nestjs/common';
import type { BenchmarkProfileInput } from '@study-abroad/shared';
import type { Page, Response } from 'playwright';
import type {
  CompetitorPredictionResult,
  CompetitorSchoolRef,
  RegisteredCompetitorAdapter,
} from './competitor-adapter.interface';
import {
  type CollegeVineHubRow,
  parseCollegeVineHubChancesPayload,
} from './collegevine-hub-data';

const pageState = new WeakMap<
  Page,
  {
    ordered: CollegeVineHubRow[];
    byKey: Map<string, CollegeVineHubRow>;
  }
>();

function isChancesFinancialsResponse(response: Response): boolean {
  const url = response.url();
  return (
    /\/schools\/hub\/data\/chances-and-financials/i.test(url) &&
    response.status() === 200
  );
}

@Injectable()
export class CollegeVineAdapter implements RegisteredCompetitorAdapter {
  private readonly logger = new Logger(CollegeVineAdapter.name);

  readonly key = 'collegevine';
  readonly label = 'CollegeVine';
  readonly baseUrl = 'https://www.collegevine.com/schools/hub';
  readonly defaultEnabled = false;
  readonly requiresSession = true;
  readonly supportsNumericProbability = true;

  /**
   * Reloads the hub and captures `/schools/hub/data/chances-and-financials`.
   * Ensure the logged-in account has a completed chancing profile and a non-empty school list.
   * Benchmark `profileJson` is not auto-synced into CollegeVine in v1 — align manually on collegevine.com.
   */
  async applyProfile(
    page: Page,
    profile: BenchmarkProfileInput,
  ): Promise<void> {
    this.logger.log(
      `CollegeVine hub: using session (GPA in benchmark profile=${profile.gpa ?? 'n/a'} — CV profile must match manually).`,
    );

    const responsePromise = page.waitForResponse(isChancesFinancialsResponse, {
      timeout: 120_000,
    });

    await page.reload({ waitUntil: 'domcontentloaded' });

    let response: Response;
    try {
      response = await responsePromise;
    } catch {
      throw new Error(
        'CollegeVine: timed out waiting for chances-and-financials (check login session and that /schools/hub loads).',
      );
    }

    const ct = (response.headers()['content-type'] ?? '').toLowerCase();
    if (!ct.includes('application/json')) {
      throw new Error(
        'CollegeVine: chances endpoint did not return JSON — session may be expired or the hub layout changed.',
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('CollegeVine: failed to parse chances JSON response.');
    }

    const rows = parseCollegeVineHubChancesPayload(payload);
    if (rows.length === 0) {
      throw new Error(
        'CollegeVine: no schools found in chances payload. Add schools to your hub list and complete your chancing profile on collegevine.com.',
      );
    }

    const byKey = new Map<string, CollegeVineHubRow>();
    for (const row of rows) {
      byKey.set(row.schoolKey, row);
    }
    pageState.set(page, { ordered: rows, byKey });

    this.logger.log(
      `CollegeVine hub: parsed ${rows.length} school rows from chances payload.`,
    );
  }

  async *iterateSchools(page: Page): AsyncIterable<CompetitorSchoolRef> {
    const state = pageState.get(page);
    if (!state) {
      throw new Error(
        'CollegeVine: internal state missing — applyProfile did not run.',
      );
    }
    for (const row of state.ordered) {
      yield {
        schoolKey: row.schoolKey,
        rawName: row.rawName,
        externalId: row.externalId,
      };
    }
  }

  async fetchPrediction(
    page: Page,
    school: CompetitorSchoolRef,
  ): Promise<CompetitorPredictionResult> {
    const state = pageState.get(page);
    if (!state) {
      throw new Error(
        'CollegeVine: internal state missing — applyProfile did not run.',
      );
    }
    const row = state.byKey.get(school.schoolKey);
    if (!row) {
      throw new Error(
        `CollegeVine: school ${school.schoolKey} not found in parsed hub data.`,
      );
    }

    return {
      probability: row.probability,
      tierLabel: row.tierLabel,
      rawPayload: {
        externalId: row.externalId,
        rawName: row.rawName,
        extractedProbability: row.probability ?? null,
        extractedTier: row.tierLabel ?? null,
        rawRow: row.rawRow,
      },
    };
  }
}

import type { BenchmarkProfileInput } from '@study-abroad/shared';
import type { Page } from 'playwright';

export interface CompetitorSchoolRef {
  schoolKey: string;
  rawName: string;
  externalId?: string;
}

export interface CompetitorPredictionResult {
  probability?: number;
  tierLabel?: string;
  rawPayload: unknown;
}

export interface CompetitorAdapter {
  key: string;
  label: string;
  baseUrl: string;
  applyProfile(page: Page, profile: BenchmarkProfileInput): Promise<void>;
  iterateSchools(page: Page): AsyncIterable<CompetitorSchoolRef>;
  fetchPrediction(
    page: Page,
    school: CompetitorSchoolRef,
  ): Promise<CompetitorPredictionResult>;
}

export interface RegisteredCompetitorAdapter extends CompetitorAdapter {
  defaultEnabled?: boolean;
  requiresSession?: boolean;
  supportsNumericProbability?: boolean;
}

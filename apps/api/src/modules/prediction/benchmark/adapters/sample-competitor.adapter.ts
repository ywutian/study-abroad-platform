import { Injectable } from '@nestjs/common';
import type { BenchmarkProfileInput } from '@study-abroad/shared';
import type { Page } from 'playwright';
import type {
  CompetitorPredictionResult,
  CompetitorSchoolRef,
  RegisteredCompetitorAdapter,
} from './competitor-adapter.interface';

@Injectable()
export class SampleCompetitorAdapter implements RegisteredCompetitorAdapter {
  readonly key = 'sample-competitor';
  readonly label = 'Sample Competitor (Placeholder)';
  readonly baseUrl = 'https://example.com/competitor';
  readonly defaultEnabled = false;
  readonly requiresSession = true;
  readonly supportsNumericProbability = true;

  async applyProfile(
    _page: Page,
    _profile: BenchmarkProfileInput,
  ): Promise<void> {
    throw new Error(
      'Sample competitor adapter is a placeholder. Provide real selectors and URL before use.',
    );
  }

  // eslint-disable-next-line require-yield
  async *iterateSchools(_page: Page): AsyncIterable<CompetitorSchoolRef> {
    return;
  }

  async fetchPrediction(
    _page: Page,
    _school: CompetitorSchoolRef,
  ): Promise<CompetitorPredictionResult> {
    throw new Error(
      'Sample competitor adapter is a placeholder. Provide real selectors and URL before use.',
    );
  }
}

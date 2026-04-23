import { Injectable } from '@nestjs/common';
import type { BenchmarkProfileInput } from '@study-abroad/shared';
import type { Page } from 'playwright';
import type {
  CompetitorSchoolRef,
  RegisteredCompetitorAdapter,
} from './competitor-adapter.interface';

const MOCK_SCHOOLS: Array<
  CompetitorSchoolRef & {
    probability?: number;
    tierLabel?: string;
  }
> = [
  {
    schoolKey: 'harvard',
    rawName: 'Harvard University',
    externalId: 'mock-1',
    probability: 0.09,
    tierLabel: 'reach',
  },
  {
    schoolKey: 'mit',
    rawName: 'Massachusetts Institute of Technology',
    externalId: 'mock-2',
    probability: 0.13,
    tierLabel: 'reach',
  },
  {
    schoolKey: 'umich',
    rawName: 'University of Michigan',
    externalId: 'mock-3',
    tierLabel: 'match',
  },
  {
    schoolKey: 'imaginary-tech',
    rawName: 'Imaginary Institute of Technology',
    externalId: 'mock-4',
    probability: 0.44,
    tierLabel: 'match',
  },
];

@Injectable()
export class MockCompetitorAdapter implements RegisteredCompetitorAdapter {
  readonly key = 'mock';
  readonly label = 'Mock Competitor';
  readonly baseUrl = 'https://mock-competitor.local';
  readonly defaultEnabled = true;
  readonly requiresSession = false;
  readonly supportsNumericProbability = true;

  async applyProfile(
    _page: Page,
    _profile: BenchmarkProfileInput,
  ): Promise<void> {
    return;
  }

  async *iterateSchools(_page: Page): AsyncIterable<CompetitorSchoolRef> {
    for (const item of MOCK_SCHOOLS) {
      yield {
        schoolKey: item.schoolKey,
        rawName: item.rawName,
        externalId: item.externalId,
      };
    }
  }

  async fetchPrediction(_page: Page, school: CompetitorSchoolRef) {
    const found = MOCK_SCHOOLS.find(
      (item) => item.schoolKey === school.schoolKey,
    );
    if (!found) {
      throw new Error(`Mock competitor school ${school.schoolKey} not found`);
    }

    return {
      probability: found.probability,
      tierLabel: found.tierLabel,
      rawPayload: {
        externalId: found.externalId,
        schoolKey: found.schoolKey,
        displayedProbability: found.probability ?? null,
        displayedTier: found.tierLabel ?? null,
      },
    };
  }
}

import type { ApplicationAnalysisRenderFixture } from '../types/application-analysis-render';
import { applicationAnalysisRenderFixtureData } from './application-analysis-render.data';

export const applicationAnalysisRenderFixtures =
  applicationAnalysisRenderFixtureData as ApplicationAnalysisRenderFixture[];

export function getApplicationAnalysisRenderFixture(caseId: string) {
  return applicationAnalysisRenderFixtures.find((fixture) => fixture.caseId === caseId) ?? null;
}

export function getApplicationAnalysisRenderFixturesByTag(tag: string) {
  return applicationAnalysisRenderFixtures.filter((fixture) => fixture.tags.includes(tag));
}

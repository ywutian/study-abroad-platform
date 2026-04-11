import { describe, expect, it } from 'vitest';
import { buildSchoolAiContext } from './school-ai-context';

describe('buildSchoolAiContext', () => {
  const school = {
    id: 'school-1',
    name: 'Stanford University',
    nameZh: '斯坦福大学',
    country: 'US',
    usNewsRank: 3,
    acceptanceRate: 4.3,
    intlAcceptanceRate: 2.1,
    intlStudentPct: 12.5,
    needBlindInternational: false,
    graduationRate: 95,
    satAvg: 1520,
    sat25: 1490,
    sat75: 1560,
  };

  it('includes latestOutcomeLabel when a current prediction exists', () => {
    const context = buildSchoolAiContext({
      school,
      schoolId: 'school-1',
      locale: 'en',
      predictionData: {
        current: {
          probability: 0.41,
          tier: 'match',
          confidence: 'high',
          source: 'served',
          modelVersion: 'v3-enterprise',
          roundContext: 'ED',
          latestOutcomeLabel: {
            id: 'label-1',
            result: 'ADMITTED',
            status: 'COUNSELOR_VERIFIED',
            reportedAt: '2026-04-10T00:00:00.000Z',
          },
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
        history: [],
        school: {
          id: 'school-1',
          name: 'Stanford University',
        },
      },
    });

    expect(context).toEqual(
      expect.objectContaining({
        type: 'prediction-results',
        results: [
          expect.objectContaining({
            schoolId: 'school-1',
            schoolName: 'Stanford University',
            latestOutcomeLabel: expect.objectContaining({
              result: 'ADMITTED',
              status: 'COUNSELOR_VERIFIED',
            }),
          }),
        ],
      })
    );
  });

  it('falls back to selected-schools context when no prediction exists', () => {
    const context = buildSchoolAiContext({
      school,
      schoolId: 'school-1',
      locale: 'en',
    });

    expect(context).toEqual({
      type: 'selected-schools',
      source: 'school_detail',
      schools: [
        {
          id: 'school-1',
          name: 'Stanford University',
          nameZh: '斯坦福大学',
          usNewsRank: 3,
          acceptanceRate: 4.3,
        },
      ],
    });
  });
});

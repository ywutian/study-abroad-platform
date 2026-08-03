import {
  VERIFICATION_PROOF_TYPE,
  caseRoutes,
  normalizeApplicationAnalysis,
  vaultRoutes,
  verificationRoutes,
  type AIAnalysisResult,
  type PredictionDashboardData,
} from '@study-abroad/shared';
import { mapDashboardToPredictions } from '../prediction/prediction-mapper';
import {
  MAX_VERIFICATION_FILE_SIZE,
  validateVerificationFile,
} from '../verification/verification-file';
import { summarizeResumeSection } from '../resume/resume-preview';

describe('client closure contracts', () => {
  it('uses exact canonical route helpers', () => {
    expect(caseRoutes.mine()).toBe('/cases/me');
    expect(verificationRoutes.submit()).toBe('/verifications');
    expect(vaultRoutes.generatePassword()).toBe('/vaults/generate-password');
    expect(VERIFICATION_PROOF_TYPE.OFFER_LETTER).toBe('offer_letter');
  });

  it('preserves prediction factors, suggestions and public explanation', () => {
    const prediction = {
      schoolId: 's1',
      school: { id: 's1', name: 'School' },
      probability: 0.4,
      confidence: 'high',
      tier: 'match',
      updatedAt: '2026-01-01',
      factors: [{ name: 'GPA', impact: 'positive', detail: 'Strong' }],
      suggestions: ['Keep grades stable'],
      publicExplanation: {
        headline: 'Competitive',
        reasons: ['Strong GPA'],
        dataSupportLabel: 'Verified data',
        dataSupportLevel: 'strong',
        caveats: [],
        source: 'rules',
      },
    } as PredictionDashboardData['predictions'][number];
    const mapped = mapDashboardToPredictions(
      {
        totalSchools: 1,
        tierDistribution: { reach: 0, match: 1, safety: 0 },
        avgProbability: 0.4,
        confidenceBreakdown: { low: 0, medium: 0, high: 1 },
        predictions: [prediction],
      },
      false
    )[0];
    expect(mapped.factors).toHaveLength(1);
    expect(mapped.suggestions).toEqual(['Keep grades stable']);
    expect(mapped.publicExplanation?.headline).toBe('Competitive');
  });

  it('prefers top-level analysis fields over divergent legacy fields', () => {
    const analysis = {
      overallVerdict: 'NEW',
      schoolCards: [{ schoolId: 'new' }],
      topReasons: ['new reason'],
      topRisks: ['new risk'],
      nextActions: ['new action'],
      evidenceSummary: [],
      confidenceSummary: { level: 'high', summary: 'new confidence', signals: [] },
      freshnessSummary: { status: 'fresh', summary: 'new freshness', generatedAt: '2026-01-01' },
      portfolioSummary: {
        verdict: 'OLD',
        keyReasons: ['old'],
        riskBoundaries: ['old'],
        balance: 'balanced',
      },
      schools: [{ schoolId: 'old' }],
      actionPlan: { now: ['old'], next90Days: [], beforeSubmission: [] },
    } as unknown as AIAnalysisResult;
    const normalized = normalizeApplicationAnalysis(analysis);
    expect(normalized.overallVerdict).toBe('NEW');
    expect(normalized.schoolCards[0].schoolId).toBe('new');
    expect(normalized.nextActions).toEqual(['new action']);
  });

  it('rejects unsupported, unknown-size and oversized verification files', () => {
    expect(validateVerificationFile({ name: 'proof.exe', size: 10 })).toEqual({
      error: 'invalid_type',
    });
    expect(validateVerificationFile({ name: 'proof.pdf' })).toEqual({ error: 'missing_size' });
    expect(
      validateVerificationFile({ name: 'proof.pdf', size: MAX_VERIFICATION_FILE_SIZE + 1 })
    ).toEqual({ error: 'too_large' });
    expect(
      validateVerificationFile({ name: 'proof.JPG', size: MAX_VERIFICATION_FILE_SIZE })
    ).toEqual({
      mimeType: 'image/jpeg',
    });
  });

  it('builds a bounded mobile resume section preview from nested content', () => {
    expect(
      summarizeResumeSection({
        items: [
          { school: 'Example University', degree: 'BSc' },
          { school: 'Second University', degree: 'MSc' },
          { school: 'Hidden by limit' },
        ],
      })
    ).toEqual(['Example University', 'BSc', 'Second University', 'MSc']);
  });
});

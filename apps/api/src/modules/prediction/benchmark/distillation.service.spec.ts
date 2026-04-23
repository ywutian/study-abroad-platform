import {
  DistillationService,
  type TeacherSignal,
} from './distillation.service';

function makeSignal(
  sourceKey: string,
  probability: number,
  weight: number,
): TeacherSignal {
  return {
    sourceKey,
    sourceLabel: sourceKey,
    probability,
    weight,
    confidence: 'medium',
    kind: 'profile',
    rawPayload: {},
  };
}

describe('DistillationService', () => {
  const prisma = {
    school: { findMany: jest.fn() },
    staticTeacherSnapshot: { upsert: jest.fn() },
  };
  const staticTeacherRegistry = {
    getTeacherOrThrow: jest.fn(),
    getSourceOrThrow: jest.fn(),
    ensureSourcesSynced: jest.fn(),
  };

  let service: DistillationService;

  beforeEach(() => {
    service = new DistillationService(
      prisma as never,
      staticTeacherRegistry as never,
    );
    jest.clearAllMocks();
  });

  it('computes the exact weighted teacher ensemble', () => {
    const decision = service.computeBlendDecision(0.3, [
      makeSignal('collegevine', 0.6, 0.6),
      makeSignal('campusreel-static', 0.62, 0.3),
    ]);

    expect(decision.teacherEnsemble).toBeCloseTo(0.6066666667, 6);
    expect(decision.effectiveW).toBeCloseTo(0.2, 6);
    expect(decision.blendedPrePlatt).toBeCloseTo(0.3613333333, 6);
  });

  it('applies the single-teacher cap when only one teacher is available', () => {
    const decision = service.computeBlendDecision(
      0.3,
      [makeSignal('campusreel-static', 0.8, 0.3)],
      0.8,
    );

    expect(decision.disagreementFactor).toBe(1);
    expect(decision.effectiveW).toBe(0.4);
    expect(decision.blendedPrePlatt).toBeCloseTo(0.5, 6);
  });

  it('collapses the blend weight when teacher disagreement exceeds the zero-weight MAE', () => {
    const decision = service.computeBlendDecision(0.33, [
      makeSignal('collegevine', 0.2, 0.6),
      makeSignal('campusreel-static', 0.5, 0.3),
    ]);

    expect(decision.pairwiseMae).toBeCloseTo(0.3, 6);
    expect(decision.disagreementFactor).toBe(0);
    expect(decision.effectiveW).toBe(0);
    expect(decision.blendedPrePlatt).toBeCloseTo(0.33, 6);
  });

  it('returns the original probability unchanged when no teacher data exists', () => {
    const decision = service.computeBlendDecision(0.33, []);

    expect(decision.hasSignal).toBe(false);
    expect(decision.teacherEnsemble).toBeNull();
    expect(decision.effectiveW).toBe(0);
    expect(decision.blendedPrePlatt).toBe(0.33);
  });

  it('computes both pre-Platt and post-Platt dry-run candidates', () => {
    const diagnostics = service.buildBlendDiagnostics(0.35, 0.4, [
      makeSignal('collegevine', 0.6, 0.6),
      makeSignal('campusreel-static', 0.62, 0.3),
    ]);

    expect(diagnostics.candidateServedPrePlatt).toBeCloseTo(0.4013333333, 6);
    expect(diagnostics.candidateServedPostPlatt).toBeCloseTo(0.4413333333, 6);
    expect(diagnostics.deltaServedPrePlatt).toBeCloseTo(0.0013333333, 6);
    expect(diagnostics.deltaServedPostPlatt).toBeCloseTo(0.0413333333, 6);
  });

  it('persists a failed static-teacher harvest as a failed snapshot row', async () => {
    prisma.school.findMany.mockResolvedValue([
      {
        id: 'school-1',
        name: 'Example University',
        metadata: null,
      },
    ]);
    staticTeacherRegistry.getSourceOrThrow.mockResolvedValue({
      id: 'source-1',
      key: 'campusreel-static',
    });
    staticTeacherRegistry.getTeacherOrThrow.mockReturnValue({
      key: 'campusreel-static',
      resolveSlug: jest.fn().mockReturnValue('example-university'),
      harvestSchool: jest.fn().mockRejectedValue(new Error('404 Not Found')),
    });

    const result = await service.harvestStaticTeacherSnapshots({
      sourceKey: 'campusreel-static',
      top: 1,
    });

    expect(result.failedCount).toBe(1);
    expect(prisma.staticTeacherSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: 'FAILED',
          errorMsg: '404 Not Found',
        }),
        create: expect.objectContaining({
          status: 'FAILED',
          errorMsg: '404 Not Found',
        }),
      }),
    );
  });
});

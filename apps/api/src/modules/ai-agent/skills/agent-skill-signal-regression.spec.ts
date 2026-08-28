import { AgentSkillSignalCollector } from './agent-skill-signal-collector.service';

function store(size: number) {
  const rows = Array.from({ length: size }, (_, i) => ({
    id: `synthetic-${i}`,
    agentType: 'school',
    skillVersionId: 'v1',
    outcome: 'FAILED',
    payload: { failure: { errorCode: 'TOOL_TIMEOUT' } },
    createdAt: new Date(),
    skillSignalConsumedAt: null as Date | null,
  }));
  let count = 0;
  const tx = {
    agentEvaluationTrace: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        rows.find((r) => r.id === where.id),
      ),
      updateMany: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row || row.skillSignalConsumedAt) return { count: 0 };
        row.skillSignalConsumedAt = new Date();
        return { count: 1 };
      }),
    },
    agentSkillSignal: {
      upsert: jest.fn(async () => {
        count++;
        return {};
      }),
    },
  };
  const prisma = {
    agentEvaluationTrace: {
      findMany: jest.fn(async () =>
        rows.filter((r) => !r.skillSignalConsumedAt).slice(0, 1000),
      ),
    },
    $transaction: jest.fn(async (fn: (db: typeof tx) => Promise<number>) => {
      const oldCount = count;
      const oldMarkers = rows.map((r) => r.skillSignalConsumedAt);
      try {
        return await fn(tx);
      } catch (error) {
        count = oldCount;
        rows.forEach((r, i) => (r.skillSignalConsumedAt = oldMarkers[i]));
        throw error;
      }
    }),
  };
  return { rows, tx, prisma, count: () => count };
}

describe('Skill signal replay regression', () => {
  it('does not recount 501 unchanged traces on a second collection', async () => {
    const db = store(501);
    const service = new AgentSkillSignalCollector(db.prisma as never);
    expect(await service.collectSignals()).toBe(501);
    expect(await service.collectSignals()).toBe(0);
    expect(db.count()).toBe(501);
  });

  it('makes bounded progress beyond 1000 rows and survives a new service instance', async () => {
    const db = store(1501);
    expect(
      await new AgentSkillSignalCollector(db.prisma as never).collectSignals(),
    ).toBe(1000);
    expect(
      await new AgentSkillSignalCollector(db.prisma as never).collectSignals(),
    ).toBe(501);
    expect(
      await new AgentSkillSignalCollector(db.prisma as never).collectSignals(),
    ).toBe(0);
    expect(db.count()).toBe(1501);
    expect(db.prisma.agentEvaluationTrace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ skillSignalConsumedAt: null }),
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 1000,
      }),
    );
  });

  it('rolls back the claim after a failed counter write and permits retry', async () => {
    const db = store(1);
    db.tx.agentSkillSignal.upsert.mockRejectedValueOnce(
      new Error('synthetic-db-failure'),
    );
    const service = new AgentSkillSignalCollector(db.prisma as never);
    await expect(service.collectSignals()).rejects.toThrow(
      'synthetic-db-failure',
    );
    expect(db.rows[0].skillSignalConsumedAt).toBeNull();
    expect(db.count()).toBe(0);
    expect(await service.collectSignals()).toBe(1);
    expect(await service.collectSignals()).toBe(0);
  });

  it('does not increment when another transaction already claimed the trace', async () => {
    const db = store(1);
    db.tx.agentEvaluationTrace.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(
      await new AgentSkillSignalCollector(db.prisma as never).collectSignals(),
    ).toBe(0);
    expect(db.tx.agentSkillSignal.upsert).not.toHaveBeenCalled();
  });
});

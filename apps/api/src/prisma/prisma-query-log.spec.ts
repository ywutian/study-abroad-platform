import { formatPrismaQueryLog } from './prisma-query-log';

describe('Memory/vector SQL log privacy', () => {
  it.each([
    'SELECT content FROM "Memory" WHERE id=$1',
    'SELECT * FROM public.memory',
    'SELECT embedding <=> $1::vector FROM fixture',
    'SELECT * FROM agent_route_embeddings',
    'SELECT * FROM "AgentRouteEmbedding"',
  ])('redacts query and parameters for %s', (query) => {
    for (const slow of [true, false]) {
      const text = formatPrismaQueryLog(
        { duration: 250, query, params: 'PRIVATE_CONTENT_AND_VECTOR' },
        slow,
      );
      expect(text).toContain('250ms');
      expect(text).toContain('redacted');
      expect(text).not.toContain(query);
      expect(text).not.toContain('PRIVATE_CONTENT_AND_VECTOR');
    }
  });
  it('keeps non-memory query diagnostics unchanged', () => {
    const event = { duration: 250, query: 'SELECT 1', params: '[]' };
    expect(formatPrismaQueryLog(event, true)).toBe(
      '[SLOW QUERY] 250ms | SELECT 1 | params: []',
    );
    expect(formatPrismaQueryLog(event, false)).toBe('[QUERY] 250ms | SELECT 1');
  });
});

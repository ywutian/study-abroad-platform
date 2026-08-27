/** Memory text/vectors must not reappear through the generic SQL logger. */
export function formatPrismaQueryLog(
  event: {
    duration: number;
    query: string;
    params: string;
  },
  slow: boolean,
): string {
  const prefix = slow ? 'SLOW QUERY' : 'QUERY';
  if (
    /\b(memory|agent_route_embeddings|AgentRouteEmbedding|vector)\b/i.test(
      event.query,
    )
  ) {
    return `[${prefix}] ${event.duration}ms | memory/vector query redacted`;
  }
  return `[${prefix}] ${event.duration}ms | ${event.query}${slow ? ` | params: ${event.params}` : ''}`;
}

import {
  EMBEDDING_EVIDENCE_CHECKS,
  verifyEmbeddingMemory,
} from '../../../../scripts/ai-agent-embedding-acceptance-support';

describe('Embedding acceptance runner closure', () => {
  const options = () => ({
    apiBase: 'https://synthetic.invalid/api/v1',
    adminToken: 'synthetic-admin',
    targetUserId: 'synthetic-a',
    emit: jest.fn(),
  });
  const result = () =>
    Object.fromEntries(EMBEDDING_EVIDENCE_CHECKS.map((key) => [key, true]));
  const response = (payload: unknown, status = 200) =>
    new Response(JSON.stringify({ data: payload }), { status });
  afterEach(() => jest.restoreAllMocks());
  it('passes only after every check and second-account cleanup', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response({
          accessToken: 'synthetic-token',
          user: { id: 'synthetic-b' },
        }),
      )
      .mockResolvedValueOnce(
        response({ ...result(), private: 'must-not-emit' }),
      )
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({}));
    const input = options();
    expect(await verifyEmbeddingMemory(input)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(input.emit.mock.calls)).not.toContain(
      'must-not-emit',
    );
    expect(input.emit).toHaveBeenCalledWith(
      expect.objectContaining({ isolationAccountCleaned: true, pass: true }),
    );
  });
  it('still deletes the account when AI-data cleanup fails', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response({
          accessToken: 'synthetic-token',
          user: { id: 'synthetic-b' },
        }),
      )
      .mockResolvedValueOnce(response(result()))
      .mockRejectedValueOnce(new Error('PRIVATE_ERROR'))
      .mockResolvedValueOnce(response({}));
    const input = options();
    expect(await verifyEmbeddingMemory(input)).toBe(false);
    expect(fetchMock.mock.calls[3][0]).toBe(
      'https://synthetic.invalid/api/v1/users/me',
    );
    expect(JSON.stringify(input.emit.mock.calls)).not.toContain(
      'PRIVATE_ERROR',
    );
  });
  it('cleans the second account when the acceptance endpoint fails', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response({
          accessToken: 'synthetic-token',
          user: { id: 'synthetic-b' },
        }),
      )
      .mockResolvedValueOnce(response({ message: 'PRIVATE_RESPONSE' }, 500))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({}));
    const input = options();
    expect(await verifyEmbeddingMemory(input)).toBe(false);
    expect(input.emit).toHaveBeenCalledWith(
      expect.objectContaining({ isolationAccountCleaned: true, pass: false }),
    );
  });
  it.each(EMBEDDING_EVIDENCE_CHECKS)(
    'rejects missing %s despite aggregate pass=true',
    async (key) => {
      const evidence = result();
      delete evidence[key];
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          response({
            accessToken: 'synthetic-token',
            user: { id: 'synthetic-b' },
          }),
        )
        .mockResolvedValueOnce(response({ ...evidence, pass: true }))
        .mockResolvedValueOnce(response({}))
        .mockResolvedValueOnce(response({}));
      expect(await verifyEmbeddingMemory(options())).toBe(false);
    },
  );
});

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'https://www.lumniedu.com',
    NEXT_PUBLIC_API_URL: 'https://api.example.com',
  },
}));

const { default: sitemap } = await import('./sitemap');

/** One page of the `{ success, data: { items, totalPages } }` envelope. */
function page(ids: string[], totalPages: number) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        items: ids.map((id) => ({ id, updatedAt: '2026-07-01T00:00:00.000Z' })),
        totalPages,
      },
    }),
  };
}

const schoolUrls = (e: Awaited<ReturnType<typeof sitemap>>) =>
  e.map((x) => x.url).filter((u) => /\/schools\/[^/]+$/.test(u));

afterEach(() => vi.unstubAllGlobals());

describe('sitemap — school detail pages', () => {
  it('paginates until totalPages and emits every school in both locales', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(['a', 'b'], 2))
      .mockResolvedValueOnce(page(['c'], 2));
    vi.stubGlobal('fetch', fetchMock);

    const urls = schoolUrls(await sitemap());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urls).toEqual([
      'https://www.lumniedu.com/en/schools/a',
      'https://www.lumniedu.com/zh/schools/a',
      'https://www.lumniedu.com/en/schools/b',
      'https://www.lumniedu.com/zh/schools/b',
      'https://www.lumniedu.com/en/schools/c',
      'https://www.lumniedu.com/zh/schools/c',
    ]);
  });

  it('keeps the static routes when the API is down — a sitemap must never fail the build', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const entries = await sitemap();

    expect(schoolUrls(entries)).toEqual([]);
    expect(entries.map((e) => e.url)).toContain('https://www.lumniedu.com/zh');
  });

  it('stops instead of looping to MAX_PAGES when totalPages goes missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { items: [{ id: 'a' }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sitemap();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to now when a school has no updatedAt (never emits Invalid Date)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { items: [{ id: 'a' }], totalPages: 1 } }),
      })
    );

    const entry = (await sitemap()).find((e) => e.url.endsWith('/en/schools/a'));

    expect(Number.isNaN(new Date(entry!.lastModified as Date).getTime())).toBe(false);
  });
});

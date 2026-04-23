import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BenchmarkTab } from './benchmark-tab';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (values?.count !== undefined) {
      return `${key}:${values.count}`;
    }
    return key;
  },
  useLocale: () => 'en',
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn((endpoint: string) => {
      if (endpoint.endsWith('/profiles')) return Promise.resolve([]);
      if (endpoint.endsWith('/sources')) {
        return Promise.resolve([
          {
            id: 'source-1',
            key: 'mock',
            label: 'Mock Competitor',
            baseUrl: 'https://mock-competitor.local',
            enabled: true,
            hasSession: false,
            supportsNumericProbability: true,
          },
        ]);
      }
      if (endpoint.endsWith('/runs')) return Promise.resolve([]);
      return Promise.resolve(null);
    }),
    post: vi.fn(),
    upload: vi.fn(),
  },
}));

vi.mock('@/lib/api/api-error', () => ({
  ApiError: class ApiError extends Error {
    displayMessage?: string;
  },
}));

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return actual;
});

describe('BenchmarkTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the external benchmark intro and source section', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BenchmarkTab />
      </QueryClientProvider>
    );

    expect(screen.getByText('introTitle')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('sourceTitle')).toBeInTheDocument();
    });
  });
});

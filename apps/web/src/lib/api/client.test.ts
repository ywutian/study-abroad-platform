import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the auth store before importing client
vi.mock('@/stores/auth', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      accessToken: 'test-token',
      refreshAccessToken: vi.fn().mockResolvedValue(true),
    })),
    subscribe: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// We need to test the ApiClient class behavior by importing after mocks
import { apiClient } from './client';
import { useAuthStore as _useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApiClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET requests', () => {
    it('sends GET request with auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ data: { id: 1 } })),
      });

      const result = await apiClient.get('/schools');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/schools',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual({ id: 1 });
    });

    it('appends query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ data: [] })),
      });

      await apiClient.get('/schools', {
        params: { page: 1, limit: 10, search: undefined },
      });

      // undefined params should be filtered out
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('limit=10');
      expect(calledUrl).not.toContain('search');
    });
  });

  describe('POST requests', () => {
    it('sends POST request with JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ data: { id: 1 } })),
      });

      const payload = { email: 'test@test.com', password: 'pass123' };
      await apiClient.post('/auth/register', payload);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
    });
  });

  describe('Error handling', () => {
    it('shows toast for 403 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Forbidden' }),
      });

      await expect(apiClient.get('/admin/users')).rejects.toThrow('Forbidden');
      expect(toast.error).toHaveBeenCalled();
    });

    it('shows toast for 500 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal Server Error' }),
      });

      await expect(apiClient.get('/schools')).rejects.toThrow();
      expect(toast.error).toHaveBeenCalled();
    });

    it('does not show toast for 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Not Found' }),
      });

      await expect(apiClient.get('/schools/999')).rejects.toThrow('Not Found');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('handles empty response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      });

      const result = await apiClient.delete('/schools/1');
      expect(result).toEqual({});
    });
  });

  describe('Auth endpoint detection', () => {
    it('does not send Authorization header for auth endpoints', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ data: { accessToken: 'tok' } })),
      });

      await apiClient.post('/auth/login', { email: 'a@b.c', password: '12345678' });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('Response format handling', () => {
    it('unwraps { data: ... } response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true, data: { name: 'MIT' } })),
      });

      const result = await apiClient.get('/schools/1');
      expect(result).toEqual({ name: 'MIT' });
    });

    it('returns full response if no data field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ name: 'MIT' })),
      });

      const result = await apiClient.get('/schools/1');
      expect(result).toEqual({ name: 'MIT' });
    });
  });

  describe('PUT and PATCH', () => {
    it('sends PUT request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ data: 'ok' })),
      });

      await apiClient.put('/profile', { name: 'Test' });

      expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
    });

    it('sends PATCH request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ data: 'ok' })),
      });

      await apiClient.patch('/profile', { name: 'Test' });

      expect(mockFetch.mock.calls[0][1].method).toBe('PATCH');
    });
  });

  // 2026-05 Phase 5 #42: transient-failure retry with exponential backoff.
  // Default policy: GET/HEAD/OPTIONS retry up to 2 times; mutating methods
  // (POST/PUT/PATCH/DELETE) do NOT retry by default to avoid duplicate
  // writes on transient failures. Caller can opt in via `retries: N`.
  describe('Retry policy (Phase 5 #42)', () => {
    it('retries GET on network TypeError up to 2 times by default', async () => {
      const networkError = new TypeError('Failed to fetch');
      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ data: 'recovered' })),
        });

      const result = await apiClient.get('/schools');
      expect(result).toBe('recovered');
      expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('retries GET on 503 Service Unavailable', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ message: 'Service Unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ data: 'recovered' })),
        });

      const result = await apiClient.get('/schools');
      expect(result).toBe('recovered');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does NOT retry GET on 400 Bad Request (not transient)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Bad input' }),
      });

      await expect(apiClient.get('/schools')).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1); // no retry
    });

    it('does NOT retry POST by default (idempotency safety)', async () => {
      const networkError = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValue(networkError);

      await expect(apiClient.post('/applications', { foo: 'bar' })).rejects.toThrow();
      // Mutations default to 0 retries to avoid duplicate writes — only
      // the initial attempt should fire.
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries POST when caller explicitly opts in via retries: 2', async () => {
      const networkError = new TypeError('Failed to fetch');
      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ data: 'ok' })),
        });

      const result = await apiClient.post('/idempotent-thing', { foo: 'bar' }, { retries: 2 });
      expect(result).toBe('ok');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws the last error after exhausting retries', async () => {
      const networkError = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValue(networkError);

      await expect(apiClient.get('/schools')).rejects.toThrow(/fetch/);
      expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });
});

/**
 * Tests for the API client at src/lib/api/client.ts
 *
 * Covers: GET, POST, PUT, PATCH, DELETE requests, auth token attachment,
 * query params, error handling (network, 401, non-ok), token refresh,
 * response unwrapping, timeout, base URL, and skipAuth.
 */

// --------------- mocks ---------------
// Must be declared before any import that triggers the module

jest.mock('@/lib/storage/secure-store', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveTokens: jest.fn(),
  clearAuthData: jest.fn(),
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
}));

import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearAuthData,
} from '@/lib/storage/secure-store';

// --------------- helpers ---------------

/**
 * Build a minimal Response-like object that satisfies what ApiClient reads.
 */
function mockResponse(
  body: unknown,
  { status = 200, ok = true }: { status?: number; ok?: boolean } = {}
): Response {
  const text = body === '' ? '' : JSON.stringify(body);
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(text),
    headers: new Headers(),
    redirected: false,
    statusText: ok ? 'OK' : 'Error',
    type: 'basic' as ResponseType,
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    bytes: jest.fn(),
  } as unknown as Response;
}

// --------------- setup ---------------

const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no token stored
  (getAccessToken as jest.Mock).mockResolvedValue(null);
  (getRefreshToken as jest.Mock).mockResolvedValue(null);
  // Provide a well-behaved fetch by default (each test can override)
  global.fetch = jest.fn().mockResolvedValue(mockResponse({ success: true, data: { id: 1 } }));
});

afterAll(() => {
  global.fetch = originalFetch;
});

// We import the *singleton* instance. Because the module caches it, every test
// shares it. That is intentional -- it mirrors production usage.
// The module reads EXPO_PUBLIC_API_URL at import time; we rely on the default
// fallback (http://localhost:3002).
import { apiClient } from '@/lib/api/client';

const BASE = 'http://localhost:3002/api/v1';

// ======================================================================
// Tests
// ======================================================================

describe('ApiClient', () => {
  // ----- Base URL -----
  describe('base URL', () => {
    it('prepends the base URL and API version prefix to every request', async () => {
      await apiClient.get('/schools');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(`${BASE}/schools`);
    });
  });

  // ----- GET -----
  describe('GET requests', () => {
    it('sends a GET request and returns unwrapped data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockResponse({ success: true, data: { name: 'MIT' } })
      );

      const result = await apiClient.get('/schools/1');

      expect(result).toEqual({ name: 'MIT' });
      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.method).toBe('GET');
    });

    it('returns the whole body when there is no .data wrapper', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse({ name: 'MIT' }));

      const result = await apiClient.get('/schools/1');

      expect(result).toEqual({ name: 'MIT' });
    });

    it('appends query params to the URL', async () => {
      await apiClient.get('/schools', { params: { page: 1, limit: 10 } });

      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('page=1');
      expect(url).toContain('limit=10');
    });

    it('omits undefined params', async () => {
      await apiClient.get('/schools', {
        params: { page: 1, search: undefined },
      });

      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('page=1');
      expect(url).not.toContain('search');
    });

    it('returns empty object for empty response body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockResponse('', { status: 204, ok: true })
      );

      const result = await apiClient.get('/empty');

      expect(result).toEqual({});
    });
  });

  // ----- POST -----
  describe('POST requests', () => {
    it('sends a POST request with JSON body', async () => {
      const payload = { email: 'a@b.com', password: 'secret' };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockResponse({ success: true, data: { accessToken: 'tok' } })
      );

      const result = await apiClient.post('/auth/login', payload);

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify(payload));
      expect(result).toEqual({ accessToken: 'tok' });
    });

    it('sends a POST without body when data is undefined', async () => {
      await apiClient.post('/auth/logout');

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.method).toBe('POST');
      expect(init.body).toBeUndefined();
    });
  });

  // ----- PUT -----
  describe('PUT requests', () => {
    it('sends a PUT request with JSON body', async () => {
      const payload = { name: 'Updated' };

      await apiClient.put('/profile', payload);

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.method).toBe('PUT');
      expect(init.body).toBe(JSON.stringify(payload));
    });
  });

  // ----- PATCH -----
  describe('PATCH requests', () => {
    it('sends a PATCH request with JSON body', async () => {
      const payload = { grade: '12' };

      await apiClient.patch('/profile', payload);

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(JSON.stringify(payload));
    });
  });

  // ----- DELETE -----
  describe('DELETE requests', () => {
    it('sends a DELETE request', async () => {
      await apiClient.delete('/cases/1');

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(`${BASE}/cases/1`);
      expect(init.method).toBe('DELETE');
    });
  });

  // ----- Auth token -----
  describe('auth token handling', () => {
    it('attaches Bearer token when an access token exists', async () => {
      (getAccessToken as jest.Mock).mockResolvedValue('my-token');

      await apiClient.get('/profile');

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.headers['Authorization']).toBe('Bearer my-token');
    });

    it('does NOT attach token when no access token is stored', async () => {
      (getAccessToken as jest.Mock).mockResolvedValue(null);

      await apiClient.get('/public');

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.headers['Authorization']).toBeUndefined();
    });

    it('does NOT attach token when skipAuth is true', async () => {
      (getAccessToken as jest.Mock).mockResolvedValue('my-token');

      await apiClient.get('/public', { skipAuth: true });

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.headers['Authorization']).toBeUndefined();
    });
  });

  // ----- Content-Type header -----
  describe('headers', () => {
    it('sets Content-Type to application/json by default', async () => {
      await apiClient.get('/anything');

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.headers['Content-Type']).toBe('application/json');
    });
  });

  // ----- Error handling -----
  describe('error handling', () => {
    it('throws with the server error message on non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockResponse({ message: 'Validation failed' }, { status: 400, ok: false })
      );

      await expect(apiClient.get('/bad')).rejects.toThrow('Validation failed');
    });

    it('throws with a generic HTTP status when server body has no message', async () => {
      const resp = {
        ...mockResponse({}, { status: 500, ok: false }),
        // json rejects to simulate unreadable body
        json: jest.fn().mockRejectedValue(new Error('not json')),
      } as unknown as Response;

      (global.fetch as jest.Mock).mockResolvedValueOnce(resp);

      await expect(apiClient.get('/fail')).rejects.toThrow('HTTP 500');
    });

    it('throws "Session expired" when 401 and token refresh fails', async () => {
      (getAccessToken as jest.Mock).mockResolvedValue('expired-token');
      (getRefreshToken as jest.Mock).mockResolvedValue(null); // no refresh token

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockResponse({ message: 'Unauthorized' }, { status: 401, ok: false })
      );

      await expect(apiClient.get('/protected')).rejects.toThrow('Session expired');
    });

    it('retries the request after a successful token refresh on 401', async () => {
      (getAccessToken as jest.Mock)
        .mockResolvedValueOnce('expired-token') // first attempt
        .mockResolvedValueOnce('new-token'); // retry after refresh

      (getRefreshToken as jest.Mock).mockResolvedValue('valid-refresh');

      // 1st call: the original request returns 401
      // 2nd call: the refresh endpoint succeeds
      // 3rd call: the retried original request succeeds
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          mockResponse({ message: 'Unauthorized' }, { status: 401, ok: false })
        )
        .mockResolvedValueOnce(
          mockResponse({
            data: { accessToken: 'new-token', refreshToken: 'new-refresh' },
          })
        )
        .mockResolvedValueOnce(mockResponse({ success: true, data: { id: 42 } }));

      const result = await apiClient.get('/protected');

      expect(result).toEqual({ id: 42 });
      expect(saveTokens).toHaveBeenCalledWith('new-token', 'new-refresh');
      // Original + refresh + retry = 3 fetches
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('calls onRefreshFailed and clears auth when refresh endpoint returns non-ok', async () => {
      const onRefreshFailed = jest.fn();
      apiClient.setOnRefreshFailed(onRefreshFailed);

      (getAccessToken as jest.Mock).mockResolvedValue('expired-token');
      (getRefreshToken as jest.Mock).mockResolvedValue('bad-refresh');

      // 1st call: original returns 401
      // 2nd call: refresh endpoint fails
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          mockResponse({ message: 'Unauthorized' }, { status: 401, ok: false })
        )
        .mockResolvedValueOnce(mockResponse({ message: 'Invalid' }, { status: 401, ok: false }));

      await expect(apiClient.get('/protected')).rejects.toThrow('Session expired');
      expect(clearAuthData).toHaveBeenCalled();
      expect(onRefreshFailed).toHaveBeenCalled();

      // Clean up callback
      apiClient.setOnRefreshFailed(() => {});
    });

    it('throws timeout error when request exceeds timeout', async () => {
      // We simulate AbortError being thrown
      (global.fetch as jest.Mock).mockImplementationOnce(() => {
        const err = new DOMException('The operation was aborted.', 'AbortError');
        return Promise.reject(err);
      });

      // Use a very short timeout to trigger quickly
      await expect(apiClient.get('/slow', { timeout: 1, retries: 0 })).rejects.toThrow(
        'The operation was aborted'
      );
    });
  });

  // ----- Retry logic -----
  describe('retry logic', () => {
    it('retries on network errors up to the retries count', async () => {
      const networkErr = new Error('Network request failed');

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(networkErr) // 1st attempt
        .mockRejectedValueOnce(networkErr) // 1st retry
        .mockResolvedValueOnce(
          // 2nd retry succeeds (if retries=2)
          mockResponse({ success: true, data: 'ok' })
        );

      // With retries=2, there should be 3 total attempts: initial + 2 retries
      // But the retry logic only retries if the error message includes 'Network'
      // and i < retries. The loop runs from 0..retries (inclusive), so retries=1
      // means up to 2 attempts.
      // With retries=2, it tries 3 times total.
      const result = await apiClient.get('/flaky', { retries: 2 });

      expect(result).toBe('ok');
      // 3 fetch calls (from the outer loop) * 1 makeRequest each
      // Note: each outer loop calls makeRequest which calls getAccessToken + fetch
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('throws after exhausting all retries on network error', async () => {
      const networkErr = new Error('Network request failed');

      (global.fetch as jest.Mock).mockRejectedValue(networkErr);

      await expect(apiClient.get('/down', { retries: 1 })).rejects.toThrow(
        'Network request failed'
      );
    });

    it('does NOT retry on non-network errors', async () => {
      // A server error (non-ok) is not a "Network" error, so no retry
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse({ message: 'Bad request' }, { status: 400, ok: false })
      );

      await expect(apiClient.get('/bad', { retries: 3 })).rejects.toThrow('Bad request');

      // Only called once -- no retries
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});

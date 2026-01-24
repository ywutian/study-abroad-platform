import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister, MAX_CACHE_AGE_MS } from '@/lib/query-persister';
import type { PersistedClient } from '@tanstack/react-query-persist-client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

function createMockPersistedClient(overrides: Partial<PersistedClient> = {}): PersistedClient {
  return {
    timestamp: Date.now(),
    buster: '',
    clientState: {
      queries: [],
      mutations: [],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createAsyncStoragePersister', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Return shape
  // -----------------------------------------------------------------------

  it('returns an object with persistClient, restoreClient, and removeClient', () => {
    const persister = createAsyncStoragePersister();

    expect(persister).toBeDefined();
    expect(typeof persister.persistClient).toBe('function');
    expect(typeof persister.restoreClient).toBe('function');
    expect(typeof persister.removeClient).toBe('function');
  });

  // -----------------------------------------------------------------------
  // MAX_CACHE_AGE_MS export
  // -----------------------------------------------------------------------

  it('exports MAX_CACHE_AGE_MS as 24 hours in milliseconds', () => {
    expect(MAX_CACHE_AGE_MS).toBe(1000 * 60 * 60 * 24);
  });

  // -----------------------------------------------------------------------
  // persistClient
  // -----------------------------------------------------------------------

  describe('persistClient', () => {
    it('calls AsyncStorage.setItem with the cache key and serialized client', async () => {
      const persister = createAsyncStoragePersister();
      const mockClient = createMockPersistedClient();

      await persister.persistClient(mockClient);

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(CACHE_KEY, JSON.stringify(mockClient));
    });

    it('serializes client state including queries and mutations', async () => {
      const persister = createAsyncStoragePersister();
      const mockClient = createMockPersistedClient({
        clientState: {
          queries: [
            {
              queryKey: ['users'],
              queryHash: '["users"]',
              state: {
                data: [{ id: '1', name: 'Alice' }],
                dataUpdateCount: 1,
                dataUpdatedAt: Date.now(),
                error: null,
                errorUpdateCount: 0,
                errorUpdatedAt: 0,
                fetchFailureCount: 0,
                fetchFailureReason: null,
                fetchMeta: null,
                isInvalidated: false,
                status: 'success',
                fetchStatus: 'idle',
              },
            },
          ],
          mutations: [],
        },
      });

      await persister.persistClient(mockClient);

      const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const serialized = JSON.parse(callArgs[1]);
      expect(serialized.clientState.queries).toHaveLength(1);
      expect(serialized.clientState.queries[0].queryKey).toEqual(['users']);
    });

    it('handles errors gracefully without throwing', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));

      const persister = createAsyncStoragePersister();
      const mockClient = createMockPersistedClient();

      // Should not throw
      await expect(persister.persistClient(mockClient)).resolves.toBeUndefined();
    });

    it('logs a warning when persistence fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Disk error'));

      const persister = createAsyncStoragePersister();
      await persister.persistClient(createMockPersistedClient());

      expect(warnSpy).toHaveBeenCalledWith(
        '[QueryPersister] Failed to persist cache:',
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // restoreClient
  // -----------------------------------------------------------------------

  describe('restoreClient', () => {
    it('calls AsyncStorage.getItem with the cache key', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const persister = createAsyncStoragePersister();
      await persister.restoreClient();

      expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('returns parsed PersistedClient when data exists', async () => {
      const mockClient = createMockPersistedClient();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockClient));

      const persister = createAsyncStoragePersister();
      const restored = await persister.restoreClient();

      expect(restored).toEqual(mockClient);
    });

    it('returns undefined when no data is stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const persister = createAsyncStoragePersister();
      const restored = await persister.restoreClient();

      expect(restored).toBeUndefined();
    });

    it('returns undefined when stored data is an empty string', async () => {
      // AsyncStorage.getItem returning empty string — JSON.parse("") throws,
      // which is caught by the try/catch
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('');

      const persister = createAsyncStoragePersister();
      const restored = await persister.restoreClient();

      // Empty string is falsy, so the !raw check catches this before parsing
      expect(restored).toBeUndefined();
    });

    it('handles JSON parse errors gracefully and returns undefined', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('not-valid-json{{{');

      const persister = createAsyncStoragePersister();
      const restored = await persister.restoreClient();

      expect(restored).toBeUndefined();
    });

    it('handles AsyncStorage read errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      const persister = createAsyncStoragePersister();
      const restored = await persister.restoreClient();

      expect(restored).toBeUndefined();
    });

    it('logs a warning when restore fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Read error'));

      const persister = createAsyncStoragePersister();
      await persister.restoreClient();

      expect(warnSpy).toHaveBeenCalledWith(
        '[QueryPersister] Failed to restore cache:',
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // removeClient
  // -----------------------------------------------------------------------

  describe('removeClient', () => {
    it('calls AsyncStorage.removeItem with the cache key', async () => {
      const persister = createAsyncStoragePersister();
      await persister.removeClient();

      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('handles errors gracefully without throwing', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Cannot delete'));

      const persister = createAsyncStoragePersister();

      await expect(persister.removeClient()).resolves.toBeUndefined();
    });

    it('logs a warning when removal fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Delete error'));

      const persister = createAsyncStoragePersister();
      await persister.removeClient();

      expect(warnSpy).toHaveBeenCalledWith(
        '[QueryPersister] Failed to remove cache:',
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // Multiple persister instances
  // -----------------------------------------------------------------------

  it('each call to createAsyncStoragePersister returns an independent instance', () => {
    const persister1 = createAsyncStoragePersister();
    const persister2 = createAsyncStoragePersister();

    expect(persister1).not.toBe(persister2);
    expect(persister1.persistClient).not.toBe(persister2.persistClient);
  });
});

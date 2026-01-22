/**
 * React Query AsyncStorage persister
 *
 * Saves the query cache to AsyncStorage so queries survive app restarts.
 * Only queries with `gcTime > 0` (the default) will be persisted.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

/**
 * Maximum age of the persisted cache (24 hours).
 * After this time the entire cache is discarded on the next cold start.
 */
export const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 24; // 24 h

/**
 * Creates an AsyncStorage-backed persister for React Query.
 */
export function createAsyncStoragePersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(client));
      } catch (error) {
        console.warn('[QueryPersister] Failed to persist cache:', error);
      }
    },

    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (!raw) return undefined;
        return JSON.parse(raw) as PersistedClient;
      } catch (error) {
        console.warn('[QueryPersister] Failed to restore cache:', error);
        return undefined;
      }
    },

    removeClient: async () => {
      try {
        await AsyncStorage.removeItem(CACHE_KEY);
      } catch (error) {
        console.warn('[QueryPersister] Failed to remove cache:', error);
      }
    },
  };
}

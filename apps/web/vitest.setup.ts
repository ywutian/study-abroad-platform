import '@testing-library/jest-dom/vitest';

// localStorage mock — some test environments don't expose .clear() on the
// global localStorage; wire a minimal in-memory store so use-hero-visual
// tests (and similar) can call .clear() / .getItem() / .setItem() reliably.
if (
  typeof globalThis.localStorage === 'undefined' ||
  typeof globalThis.localStorage.clear !== 'function'
) {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

// Mock next-intl navigation (uses next/navigation internally which doesn't resolve in Vitest)
vi.mock('@/lib/i18n/navigation', () => ({
  Link: 'a',
  redirect: vi.fn(),
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  getPathname: vi.fn(),
}));

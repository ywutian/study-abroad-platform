import '@testing-library/jest-dom/vitest';

// Mock next-intl navigation (uses next/navigation internally which doesn't resolve in Vitest)
vi.mock('@/lib/i18n/navigation', () => ({
  Link: 'a',
  redirect: vi.fn(),
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  getPathname: vi.fn(),
}));

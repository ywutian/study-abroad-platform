import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './page';
import enMessages from '@/messages/en.json';
import zhMessages from '@/messages/zh.json';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/stores';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  usePathname: vi.fn(() => '/'),
}));

vi.mock('@/stores', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">theme</button>,
}));

describe('HomePage', () => {
  beforeAll(() => {
    class MockIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
    }

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      value: MockIntersectionObserver,
    });
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      writable: true,
      value: MockIntersectionObserver,
    });
  });

  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({ user: null } as never);
  });

  function renderHome(locale: 'zh' | 'en') {
    vi.mocked(useParams).mockReturnValue({ locale } as never);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider
          locale={locale}
          messages={locale === 'zh' ? zhMessages : enMessages}
        >
          <HomePage />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
  }

  it('renders the redesigned Chinese homepage with mapped CTA links', () => {
    const home = zhMessages.home;
    renderHome('zh');

    expect(screen.getByText(home.hero.headline[0])).toBeInTheDocument();
    expect(screen.getByText(home.hero.headline[1])).toBeInTheDocument();
    expect(screen.getByText(home.features.title)).toBeInTheDocument();
    expect(screen.getByText(home.how.title)).toBeInTheDocument();

    expect(
      screen
        .getAllByRole('link', { name: home.hero.primaryCta })
        .some((link) => link.getAttribute('href') === '/register')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.cta.secondary })
        .some((link) => link.getAttribute('href') === '/help')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.nav.product })
        .some((link) => link.getAttribute('href') === '#features')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.nav.pricing })
        .some((link) => link.getAttribute('href') === '#cta')
    ).toBe(true);
  }, 30_000);

  it('renders the English homepage copy and route mapping', () => {
    const home = enMessages.home;
    renderHome('en');

    expect(screen.getByText(home.hero.headline[0])).toBeInTheDocument();
    expect(screen.getByText(home.hero.headline[1])).toBeInTheDocument();
    expect(screen.getByText(home.features.title)).toBeInTheDocument();
    expect(screen.getByText(home.how.title)).toBeInTheDocument();

    expect(
      screen
        .getAllByRole('link', { name: home.hero.primaryCta })
        .some((link) => link.getAttribute('href') === '/register')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.cta.secondary })
        .some((link) => link.getAttribute('href') === '/help')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.nav.product })
        .some((link) => link.getAttribute('href') === '#features')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.nav.community })
        .some((link) => link.getAttribute('href') === '/teams')
    ).toBe(true);
  }, 30_000);
});

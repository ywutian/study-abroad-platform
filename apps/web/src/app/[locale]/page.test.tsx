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

  function expectCardsToRegister(titles: string[]) {
    const links = screen.getAllByRole('link');

    titles.forEach((title) => {
      expect(
        links.some(
          (link) => link.textContent?.includes(title) && link.getAttribute('href') === '/register'
        )
      ).toBe(true);
    });
  }

  it('renders the redesigned Chinese homepage with mapped CTA links', () => {
    const home = zhMessages.home;
    renderHome('zh');

    expect(screen.getByText(home.hero.headline[0])).toBeInTheDocument();
    expect(screen.getByText(home.hero.headline[1])).toBeInTheDocument();
    expect(screen.getByText(home.features.title)).toBeInTheDocument();
    expect(screen.getByText(home.how.title)).toBeInTheDocument();
    home.how.steps.forEach((step) => {
      expect(screen.getByText(step.title)).toBeInTheDocument();
    });

    expect(
      screen
        .getAllByRole('link', { name: home.hero.primaryCta })
        .some((link) => link.getAttribute('href') === '/register')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.hero.secondaryCta })
        .some((link) => link.getAttribute('href') === '#workflow')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.cta.secondary })
        .some((link) => link.getAttribute('href') === '#community')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.nav.product })
        .some((link) => link.getAttribute('href') === '#features')
    ).toBe(true);
    expectCardsToRegister(home.features.items.map((item) => item.title));
    expectCardsToRegister(home.communityBoard.cards.map((card) => card.title));
    expect(
      screen
        .getAllByRole('link', { name: home.communityBoard.cta })
        .some((link) => link.getAttribute('href') === '/register')
    ).toBe(true);
    expect(screen.getByText(home.footer.description)).toBeInTheDocument();
    home.footer.columns
      .flatMap((column) => column.links)
      .forEach((footerLink) => {
        expect(
          screen
            .getAllByRole('link', { name: footerLink.label })
            .some((link) => link.getAttribute('href') === footerLink.href)
        ).toBe(true);
      });
  }, 30_000);

  it('renders the English homepage copy and route mapping', () => {
    const home = enMessages.home;
    renderHome('en');

    expect(screen.getByText(home.hero.headline[0])).toBeInTheDocument();
    expect(screen.getByText(home.hero.headline[1])).toBeInTheDocument();
    expect(screen.getByText(home.features.title)).toBeInTheDocument();
    expect(screen.getByText(home.how.title)).toBeInTheDocument();
    home.how.steps.forEach((step) => {
      expect(screen.getByText(step.title)).toBeInTheDocument();
    });

    expect(
      screen
        .getAllByRole('link', { name: home.hero.primaryCta })
        .some((link) => link.getAttribute('href') === '/register')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.hero.secondaryCta })
        .some((link) => link.getAttribute('href') === '#workflow')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.cta.secondary })
        .some((link) => link.getAttribute('href') === '#community')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.nav.product })
        .some((link) => link.getAttribute('href') === '#features')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: home.nav.community })
        .some((link) => link.getAttribute('href') === '#community')
    ).toBe(true);
    expectCardsToRegister(home.features.items.map((item) => item.title));
    expectCardsToRegister(home.communityBoard.cards.map((card) => card.title));
    expect(
      screen
        .getAllByRole('link', { name: home.communityBoard.cta })
        .some((link) => link.getAttribute('href') === '/register')
    ).toBe(true);
    expect(screen.getByText(home.footer.description)).toBeInTheDocument();
    home.footer.columns
      .flatMap((column) => column.links)
      .forEach((footerLink) => {
        expect(
          screen
            .getAllByRole('link', { name: footerLink.label })
            .some((link) => link.getAttribute('href') === footerLink.href)
        ).toBe(true);
      });
  }, 30_000);

  it('does not ship unverified marketing claims in either locale', () => {
    const prohibitedClaims = [
      '50,000+',
      '10,000+ \u7528\u6237\u597d\u8bc4',
      '10,000+ Positive Reviews',
      '2,000+ \u9662\u6821\u6570\u636e',
      '2,000+ schools',
      '85%',
      'Trusted by counselors at',
      '\u53d7\u4fe1\u4e8e\u4ee5\u4e0b\u5347\u5b66\u987e\u95ee',
      'studyabroad.com',
    ];

    [zhMessages, enMessages].forEach((messages) => {
      const marketingCopy = JSON.stringify({
        home: messages.home,
        about: messages.about,
        auth: messages.auth.layout,
        terms: messages.terms,
        privacy: messages.privacy,
      });

      prohibitedClaims.forEach((claim) => {
        expect(marketingCopy).not.toContain(claim);
      });
    });
  });
});

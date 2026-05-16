import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardEssayCoach } from './dashboard-essay-coach';
import type { DashboardEssayCoach as DashboardEssayCoachData } from '@study-abroad/shared';

// Stub i18n Link so it renders as a plain anchor in jsdom — avoids loading
// the real next/link runtime which depends on the next router context.
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const messages = {
  dashboard: {
    essayCoach: {
      title: 'Latest essay AI feedback',
      subtitle: '{type} · {date}',
      typeReview: 'Review',
      typePolish: 'Polish',
      fallbackSuggestion: 'Continue polishing — your last AI run is ready to revisit.',
      cta: 'Continue',
      ctaAriaLabel: 'Continue working on essay: {essayTitle}',
    },
  },
};

function renderCoach(data?: DashboardEssayCoachData | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DashboardEssayCoach data={data} />
    </NextIntlClientProvider>
  );
}

describe('DashboardEssayCoach', () => {
  // Pin "now" so date formatting is deterministic.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when data is undefined (no AI runs yet)', () => {
    const { container } = renderCoach(undefined);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when data is null (no AI runs yet)', () => {
    const { container } = renderCoach(null);
    expect(container.firstChild).toBeNull();
  });

  it('renders a review result with the first suggestion + essay title + CTA', () => {
    renderCoach({
      essayId: 'essay-stanford-why',
      essayTitle: 'Stanford Why Major',
      type: 'review',
      suggestion: 'Strengthen the second paragraph with a concrete research example.',
      createdAt: '2026-05-12T14:30:00.000Z',
    });

    expect(screen.getByText('Latest essay AI feedback')).toBeInTheDocument();
    expect(screen.getByText('Stanford Why Major')).toBeInTheDocument();
    expect(
      screen.getByText('Strengthen the second paragraph with a concrete research example.')
    ).toBeInTheDocument();
    // Subtitle interpolates {type} · {date}
    expect(screen.getByText(/Review/)).toBeInTheDocument();
    // CTA link points to the right essay
    const cta = screen.getByRole('link', {
      name: /Continue working on essay: Stanford Why Major/i,
    });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/essays?id=essay-stanford-why');
  });

  it('falls back to a generic suggestion for polish-type results (no suggestions JSON)', () => {
    renderCoach({
      essayId: 'essay-mit-cs',
      essayTitle: 'MIT CS Activity',
      type: 'polish',
      suggestion: null,
      createdAt: '2026-05-14T10:00:00.000Z',
    });

    expect(
      screen.getByText('Continue polishing — your last AI run is ready to revisit.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Polish/)).toBeInTheDocument();
  });

  it('encodes essayId safely in the CTA href', () => {
    renderCoach({
      essayId: 'essay/with/slashes & special',
      essayTitle: 'Edge Case Essay',
      type: 'review',
      suggestion: 'Some suggestion',
      createdAt: '2026-05-12T14:30:00.000Z',
    });
    const cta = screen.getByRole('link', { name: /Continue/i });
    expect(cta.getAttribute('href')).toBe(
      '/essays?id=' + encodeURIComponent('essay/with/slashes & special')
    );
  });

  it('passes the full suggestion via title attribute for hover tooltip', () => {
    const longSuggestion =
      'Lorem ipsum '.repeat(20) + 'This long suggestion gets truncated by line-clamp-2.';
    renderCoach({
      essayId: 'essay-a',
      essayTitle: 'Long Essay',
      type: 'review',
      suggestion: longSuggestion,
      createdAt: '2026-05-12T14:30:00.000Z',
    });
    // The <p> wrapping the suggestion has title={fullText} for hover tooltip
    const suggestionEl = screen.getByText(longSuggestion);
    expect(suggestionEl).toHaveAttribute('title', longSuggestion);
  });
});

import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardPipelineStrip } from './dashboard-pipeline-strip';
import type { DashboardWorkbench } from './dashboard-workbench-model';

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
    pipelineStrip: {
      title: 'Application pipeline',
      viewAll: 'View all →',
      celebrate: '🎉 {count} acceptance(s) — congratulations!',
      status: {
        submitted: 'Submitted',
        accepted: 'Accepted',
        rejected: 'Rejected',
        waitlisted: 'Waitlisted',
        withdrawn: 'Withdrawn',
      },
      relativeJustNow: 'just now',
      relativeMin: '{count} mins ago',
      relativeHour: '{count} hrs ago',
      relativeDay: '{count} days ago',
      relativeWeek: '{count} weeks ago',
      relativeMonth: '{count} months ago',
    },
  },
};

function renderStrip(pipeline?: NonNullable<DashboardWorkbench['pipeline']>) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DashboardPipelineStrip pipeline={pipeline} />
    </NextIntlClientProvider>
  );
}

const emptyDecisions: NonNullable<DashboardWorkbench['pipeline']>['recentDecisions'] = [];

const zeroPipeline: NonNullable<DashboardWorkbench['pipeline']> = {
  notStarted: 0,
  inProgress: 0,
  submitted: 0,
  accepted: 0,
  rejected: 0,
  waitlisted: 0,
  withdrawn: 0,
  recentDecisions: emptyDecisions,
};

describe('DashboardPipelineStrip', () => {
  // Pin "now" so formatRelativeTime is deterministic across runs.
  const NOW = new Date('2026-05-15T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when pipeline is undefined (frontend fallback case)', () => {
    const { container } = renderStrip(undefined);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no schools are past IN_PROGRESS', () => {
    // notStarted/inProgress > 0 should NOT trigger render — only post-IN_PROGRESS
    // material counts.
    const { container } = renderStrip({
      ...zeroPipeline,
      notStarted: 4,
      inProgress: 3,
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders pills only for non-zero post-IN_PROGRESS statuses', () => {
    renderStrip({
      ...zeroPipeline,
      submitted: 3,
      accepted: 1,
      // waitlisted/rejected/withdrawn stay 0 and should NOT appear
    });

    // Header always present when material exists
    expect(screen.getByText('Application pipeline')).toBeInTheDocument();
    // Visible pills
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    // Hidden pills (count = 0)
    expect(screen.queryByText('Waitlisted')).toBeNull();
    expect(screen.queryByText('Rejected')).toBeNull();
    expect(screen.queryByText('Withdrawn')).toBeNull();
  });

  it('omits the recent-decisions list when recentDecisions is empty even if pills render', () => {
    renderStrip({
      ...zeroPipeline,
      submitted: 2, // material to render the strip
    });

    // No <li> rows from the decision list
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('renders per-school decision rows with school + round + relative time', () => {
    // Decided 3 days ago (relative to pinned NOW)
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000);
    renderStrip({
      ...zeroPipeline,
      submitted: 1,
      accepted: 1,
      recentDecisions: [
        {
          id: 'd-1',
          schoolId: 'sch-stanford',
          schoolName: 'Stanford',
          round: 'EA',
          status: 'ACCEPTED',
          decidedAt: threeDaysAgo.toISOString(),
        },
      ],
    });

    const row = screen.getByRole('listitem');
    // School name + round inline
    expect(within(row).getByText('Stanford')).toBeInTheDocument();
    expect(within(row).getByText(/· EA/)).toBeInTheDocument();
    // Status text
    expect(within(row).getByText('Accepted')).toBeInTheDocument();
    // Relative time bucket: 3 days falls into relativeDay branch
    expect(within(row).getByText('3 days ago')).toBeInTheDocument();
  });

  it('shows celebratory copy when at least one acceptance exists', () => {
    renderStrip({
      ...zeroPipeline,
      accepted: 2,
      recentDecisions: emptyDecisions,
    });
    expect(screen.getByText(/2 acceptance/i)).toBeInTheDocument();
  });

  it('hides celebratory copy when accepted is 0 even if other decisions exist', () => {
    renderStrip({
      ...zeroPipeline,
      submitted: 5,
      rejected: 1,
      // accepted stays 0 — no celebrate footer
    });
    expect(screen.queryByText(/acceptance/i)).toBeNull();
    // But the strip itself renders (rejected > 0 is material)
    expect(screen.getByText('Application pipeline')).toBeInTheDocument();
  });

  // Sanity check the formatRelativeTime branches that aren't covered above.
  // Using small focused renders rather than enumerating every threshold to
  // keep the test file under the file-line budget.
  it('formats sub-minute decisions as "just now"', () => {
    const justNow = new Date(NOW.getTime() - 30 * 1000); // 30 seconds ago
    renderStrip({
      ...zeroPipeline,
      submitted: 1,
      recentDecisions: [
        {
          id: 'd-now',
          schoolId: 'sch-mit',
          schoolName: 'MIT',
          round: 'EA',
          status: 'SUBMITTED',
          decidedAt: justNow.toISOString(),
        },
      ],
    });
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('formats decisions older than 30 days as months', () => {
    const twoMonthsAgo = new Date(NOW.getTime() - 65 * 24 * 60 * 60 * 1000);
    renderStrip({
      ...zeroPipeline,
      submitted: 1,
      recentDecisions: [
        {
          id: 'd-old',
          schoolId: 'sch-yale',
          schoolName: 'Yale',
          round: 'RD',
          status: 'WAITLISTED',
          decidedAt: twoMonthsAgo.toISOString(),
        },
      ],
    });
    expect(screen.getByText('2 months ago')).toBeInTheDocument();
  });
});

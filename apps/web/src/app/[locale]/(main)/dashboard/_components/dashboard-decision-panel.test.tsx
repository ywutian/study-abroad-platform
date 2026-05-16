import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardDecisionPanel } from './dashboard-decision-panel';
import type { DashboardPipeline } from '@study-abroad/shared';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const messages = {
  dashboard: {
    decisionPanel: {
      title: 'Application decisions',
      viewAll: 'View all →',
      celebrate: '🎉 {count} {count, plural, one {acceptance} other {acceptances}}',
      status: {
        accepted: 'Accepted',
        waitlisted: 'Waitlisted',
        rejected: 'Rejected',
        withdrawn: 'Withdrawn',
      },
      rowAriaLabel: '{school} {round}: {status}',
      waitlistHint:
        '{count} {count, plural, one {school} other {schools}} on waitlist — consider sending a Letter of Continued Interest.',
    },
  },
};

function makePipeline(partial: Partial<DashboardPipeline>): DashboardPipeline {
  return {
    notStarted: 0,
    inProgress: 0,
    submitted: 0,
    accepted: 0,
    rejected: 0,
    waitlisted: 0,
    withdrawn: 0,
    recentDecisions: [],
    ...partial,
  };
}

function renderPanel(pipeline?: DashboardPipeline | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DashboardDecisionPanel pipeline={pipeline} />
    </NextIntlClientProvider>
  );
}

describe('DashboardDecisionPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when pipeline is undefined', () => {
    const { container } = renderPanel(undefined);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when pipeline is null', () => {
    const { container } = renderPanel(null);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when there are no decided schools (only NOT_STARTED / IN_PROGRESS / SUBMITTED)', () => {
    // Invariant I6: panel must NOT render unless ≥1 decided school
    const { container } = renderPanel(makePipeline({ notStarted: 3, inProgress: 2, submitted: 1 }));
    expect(container.firstChild).toBeNull();
  });

  it('renders stat tiles only for non-zero statuses', () => {
    renderPanel(
      makePipeline({
        accepted: 2,
        waitlisted: 1,
        // rejected/withdrawn intentionally 0 — should not render their tiles
      })
    );
    expect(screen.getByText('Application decisions')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('Waitlisted')).toBeInTheDocument();
    // Zero-count statuses don't get tiles
    expect(screen.queryByText('Rejected')).toBeNull();
    expect(screen.queryByText('Withdrawn')).toBeNull();
  });

  it('shows celebratory copy when accepted > 0', () => {
    renderPanel(makePipeline({ accepted: 3 }));
    expect(screen.getByText(/3 acceptances/i)).toBeInTheDocument();
  });

  it('hides celebratory copy when accepted is 0 but other decisions exist', () => {
    renderPanel(makePipeline({ rejected: 2, waitlisted: 1 }));
    expect(screen.queryByText(/acceptance/i)).toBeNull();
    // But the panel still renders (waitlisted/rejected are material)
    expect(screen.getByText('Application decisions')).toBeInTheDocument();
  });

  it('renders top 3 decision rows from recentDecisions, filtering out SUBMITTED', () => {
    const decidedAt = new Date('2026-05-10T14:30:00Z');
    renderPanel(
      makePipeline({
        accepted: 1,
        waitlisted: 1,
        rejected: 1,
        recentDecisions: [
          // SUBMITTED is correctly excluded (not a decision yet)
          {
            id: 'd-submitted',
            schoolId: 'sch-pending',
            schoolName: 'Pending School',
            round: 'RD',
            status: 'SUBMITTED',
            decidedAt: decidedAt.toISOString(),
          },
          {
            id: 'd-stan',
            schoolId: 'sch-stanford',
            schoolName: 'Stanford',
            round: 'EA',
            status: 'ACCEPTED',
            decidedAt: decidedAt.toISOString(),
          },
          {
            id: 'd-mit',
            schoolId: 'sch-mit',
            schoolName: 'MIT',
            round: 'EA',
            status: 'WAITLISTED',
            decidedAt: decidedAt.toISOString(),
          },
          {
            id: 'd-yale',
            schoolId: 'sch-yale',
            schoolName: 'Yale',
            round: 'RD',
            status: 'REJECTED',
            decidedAt: decidedAt.toISOString(),
          },
        ],
      })
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Stanford')).toBeInTheDocument();
    expect(within(rows[1]).getByText('MIT')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Yale')).toBeInTheDocument();
    // Pending (SUBMITTED) school does NOT appear in the rows
    expect(screen.queryByText('Pending School')).toBeNull();
  });

  it('shows waitlist coaching hint only when waitlisted > 0', () => {
    // With waitlist
    const { unmount } = renderPanel(makePipeline({ waitlisted: 2 }));
    expect(screen.getByText(/2 schools on waitlist/i)).toBeInTheDocument();
    unmount();

    // Without waitlist (only acceptance)
    renderPanel(makePipeline({ accepted: 1 }));
    expect(screen.queryByText(/waitlist/i)).toBeNull();
  });
});

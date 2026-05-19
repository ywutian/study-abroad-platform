import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import enMessages from '@/messages/en.json';
import { HallOnboarding } from './HallOnboarding';

/**
 * Regression guard for the `t(variable)` indirection bug: the step keys are
 * pulled from a const array, so `check-missing-keys.ts` (static, literal-only)
 * cannot validate them. next-intl renders a missing key as the literal key
 * path without throwing — only a render assertion proves the copy resolved.
 */

function renderOnboarding() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <HallOnboarding replayNonce={1} />
    </NextIntlClientProvider>
  );
}

// Real copy from messages/en.json → hall.onboarding.steps.*
// Hall §7 Decision B: the "You are in control" privacy step was removed.
const STEP_TITLES = [
  'Welcome to the Alumni Square',
  'Learn from real cases',
  'Verified admission data',
];

describe('HallOnboarding', () => {
  it('renders translated step copy, never raw i18n keys', () => {
    renderOnboarding();

    expect(screen.getByText(STEP_TITLES[0])).toBeInTheDocument();

    // Walk every step; assert real copy and that no raw key path leaks.
    for (let i = 1; i < STEP_TITLES.length; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText(STEP_TITLES[i])).toBeInTheDocument();
    }

    expect(screen.queryByText(/hall\.onboarding\./)).toBeNull();
    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();
  });

  it('allows stepping back', () => {
    renderOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(STEP_TITLES[1])).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText(STEP_TITLES[0])).toBeInTheDocument();
  });
});

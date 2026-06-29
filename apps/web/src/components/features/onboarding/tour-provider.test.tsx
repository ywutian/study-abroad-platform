import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { TourProvider, useTour } from './tour-provider';

/**
 * Regression for the /dashboard "Something went wrong" crash (React #185).
 *
 * The dashboard page runs an effect that registers a tour AND lists `startTour`
 * in its deps. Pre-fix, `registerTour` rebuilt the `tours` Map on every call, so
 * `startTour` (deps include `tours`) got a fresh identity each render → the
 * effect re-ran → registerTour → ∞ → "Maximum update depth exceeded".
 *
 * This reproduces that exact shape and asserts it settles.
 */
describe('TourProvider — no infinite render loop (React #185 regression)', () => {
  it('settles when an effect registers a tour and depends on startTour', () => {
    let renders = 0;

    function Consumer() {
      renders++;
      const { registerTour, startTour } = useTour();
      useEffect(() => {
        registerTour({ id: 'dashboard', steps: [] });
      }, [registerTour, startTour]);
      return null;
    }

    expect(() =>
      render(
        <NextIntlClientProvider locale="en" messages={{}}>
          <TourProvider>
            <Consumer />
          </TourProvider>
        </NextIntlClientProvider>
      )
    ).not.toThrow();

    // Pre-fix this blows past React's 50-update ceiling; post-fix it's a handful.
    expect(renders).toBeLessThan(10);
  });
});

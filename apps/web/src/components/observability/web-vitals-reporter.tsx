'use client';

import * as Sentry from '@sentry/nextjs';
import { useReportWebVitals } from 'next/web-vitals';

/**
 * 2026-05 Phase 4 follow-up: Web Vitals → Sentry reporter.
 *
 * Before this component, Lumni had **no client-side performance
 * telemetry** beyond ad-hoc network panel inspection. Sentry was
 * configured (sentry.client.config.ts) for error reporting only;
 * Core Web Vitals (LCP / INP / CLS / FCP / TTFB / FID) went
 * unmonitored, so we couldn't tell whether the dashboard refactor
 * actually improved perceived performance.
 *
 * This component uses Next.js's `useReportWebVitals` to receive each
 * metric as it's measured and forward it to Sentry as:
 *   1. A breadcrumb (for context in error events)
 *   2. A measurement on the active transaction (for tracing)
 *
 * Production-only: dev builds skip emission (matches Sentry config's
 * `enabled: NODE_ENV === 'production'`). Zero overhead in dev.
 *
 * Mounted once in the locale layout — the hook fires globally for the
 * entire app, no per-route wiring needed.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Skip in dev so we don't spam console / accidentally send.
    if (process.env.NODE_ENV !== 'production') return;

    const { id, name, value, rating, navigationType } = metric;

    // 1. Breadcrumb — gives Sentry error events a "vitals timeline"
    //    so when an error fires we can see if the page was already
    //    janky before it happened.
    Sentry.addBreadcrumb({
      category: 'web-vitals',
      message: `${name}: ${value.toFixed(2)} (${rating})`,
      level: rating === 'poor' ? 'warning' : 'info',
      data: { id, name, value, rating, navigationType },
    });

    // 2. Measurement on the active transaction — surfaces vitals in
    //    Sentry Performance under the right units. LCP/FCP/TTFB are
    //    ms-valued; CLS is unitless; INP/FID are ms.
    const unit: 'millisecond' | 'none' = name === 'CLS' ? 'none' : 'millisecond';
    const activeSpan = Sentry.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttribute(`web_vitals.${name.toLowerCase()}`, value);
      activeSpan.setAttribute(`web_vitals.${name.toLowerCase()}.rating`, rating);
    }
    // Some Sentry SDK versions also expose a top-level setMeasurement.
    // Guarded import via dynamic check keeps us forward-compatible.
    const sentryWithMeasurement = Sentry as typeof Sentry & {
      setMeasurement?: (key: string, value: number, unit: string) => void;
    };
    sentryWithMeasurement.setMeasurement?.(name, value, unit);
  });

  return null;
}

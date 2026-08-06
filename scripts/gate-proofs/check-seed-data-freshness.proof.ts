import { runGate, expectClean, expectFired } from './harness';

/**
 * Seed: ask the gate to evaluate a date far enough in the future that the
 * committed exam calendar no longer covers the planning horizon.
 *
 * Uses `--asof` rather than rewriting the JSON, because the thing being proven
 * is the TIME comparison — mutating the data would prove the parser works and
 * leave the actual expiry logic untested. It also means this proof keeps
 * working after the calendar is refreshed for a later season.
 */
export async function prove(): Promise<void> {
  expectClean(runGate('check-seed-data-freshness.ts'));

  // 2099 is past every date this repo will ever ship, so the gate must fire
  // regardless of which season's calendar is committed at the time.
  expectFired(runGate('check-seed-data-freshness.ts', ['--asof', '2099-01-01']), 'going stale');
}

import { expectClean, expectFired, runGate } from './harness';

const GATE = 'check-recurrence.ts';

export async function prove(): Promise<void> {
  expectClean(
    runGate(GATE, ['--strict', '--threshold=9999', '.github/workflows/ci.yml']),
    'a deliberately unreachable recurrence threshold'
  );
  expectFired(
    runGate(GATE, ['--strict', '--threshold=1', '.github/workflows/ci.yml']),
    'RECURRING bug class'
  );
}

import { expectFired, runGate, withPatchedFile } from './harness';

const GATE = 'apps/web/scripts/check-unused-keys.ts';

export async function prove(): Promise<void> {
  await withPatchedFile(
    'apps/web/src/messages/zh.json',
    (s) => {
      const data = JSON.parse(s) as Record<string, unknown>;
      data.__gateProofUnusedKey = 'unused-on-purpose';
      return `${JSON.stringify(data)}\n`;
    },
    () => expectFired(runGate(GATE, ['--strict']), '__gateProofUnusedKey')
  );
}

import { expectClean, expectFired, runGate, withPatchedFile } from './harness';

const GATE = 'check-drift.ts';

export async function prove(): Promise<void> {
  expectClean(runGate(GATE, ['--only=manifest-consistency']));

  await withPatchedFile(
    '.claude/manifests/agent-workflow.yml',
    (source) => source.replace('- id: study-abroad-expert', '- id: gate-proof-missing-agent'),
    () => expectFired(runGate(GATE, ['--only=manifest-consistency']), 'gate-proof-missing-agent')
  );
}

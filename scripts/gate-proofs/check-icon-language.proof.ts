import { expectClean, expectFired, runGate, withSeededViolation } from './harness';

const GATE = 'check-icon-language.ts';

export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withSeededViolation(
    'apps/web/src/__gate_proof_icon_language.tsx',
    "import { Sparkles } from 'lucide-react';\nexport const Seed = Sparkles;\n",
    () => expectFired(runGate(GATE), 'banned AI-feeling lucide icon')
  );
}

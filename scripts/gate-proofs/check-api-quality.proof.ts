import { expectClean, expectFired, runGate, withSeededViolation } from './harness';

const GATE = 'apps/api/scripts/check-api-quality.ts';
const CI = { env: { CI: 'true' } };

export async function prove(): Promise<void> {
  expectClean(runGate(GATE, [], CI));

  await withSeededViolation(
    'apps/api/src/modules/__gate_proof__/gate-proof.controller.ts',
    `import { Body, Controller, Post } from '@nestjs/common';

@Controller('gate-proof-quality')
export class GateProofQualityController {
  @Post()
  create(@Body() body: { title: string }) {
    return body;
  }
}
`,
    () => expectFired(runGate(GATE, [], CI), 'Inline @Body()')
  );
}

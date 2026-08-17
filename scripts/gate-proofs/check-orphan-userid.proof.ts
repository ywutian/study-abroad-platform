import { expectClean, expectFired, runGate, withPatchedFile } from './harness';

const GATE = 'check-orphan-userid.ts';
const SCHEMA = 'apps/api/prisma/schema.prisma';

const LEAK = `
model GateProofOrphanUserRows {
  id     String @id @default(cuid())
  userId String
  @@index([userId])
}
`;

export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withPatchedFile(
    SCHEMA,
    (s) => `${s}\n${LEAK}\n`,
    () => expectFired(runGate(GATE), 'GateProofOrphanUserRows')
  );
}

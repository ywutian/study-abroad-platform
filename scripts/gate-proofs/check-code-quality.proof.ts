import { expectClean, expectFired, runGate, withSeededViolation } from './harness';

const GATE = 'apps/web/scripts/check-code-quality.ts';
// The web quality script only exits 1 under --staged or CI. Proofs spawn a
// subprocess, so CI must be set explicitly or a seeded error prints and exits 0.
const CI = { env: { CI: 'true' } };

const FIXTURE = `import { useQuery } from '@tanstack/react-query';

export function GateProofKeepPreviousList({ page }: { page: number }) {
  const search = '';
  const a = useQuery({
    queryKey: ['gate-proof-items', { page, search }],
    queryFn: () => Promise.resolve([]),
    meta: { pageSize: 20 },
  });
  const b = useQuery({
    queryKey: ['gate-proof-other', { page, search }],
    queryFn: () => Promise.resolve([]),
    meta: { pageSize: 20 },
  });
  return [a, b];
}
`;

/**
 * Proof for `list-query-needs-keep-previous` in check-code-quality.ts.
 *
 * That rule sat at 42 findings, about a third wrong, so nobody read it. It is
 * now error-severity at a clean worklist — which is only a gate if a seeded
 * list query without keepPreviousData actually turns it red.
 */
export async function prove(): Promise<void> {
  expectClean(runGate(GATE, [], CI));

  await withSeededViolation('apps/web/src/components/__gate_proof_keep_previous.tsx', FIXTURE, () =>
    expectFired(runGate(GATE, [], CI), 'list-query-needs-keep-previous')
  );
}

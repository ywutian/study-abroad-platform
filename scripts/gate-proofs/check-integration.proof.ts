import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

/**
 * Proof for governance rule G4 (`user-data-isolation`), run through
 * `check-integration.ts`.
 *
 * This rule had no proof until 2026-08-06, and it had been quietly wrong in
 * BOTH directions for as long as it covered domain modules. It decided a
 * method's boundary by counting braces forward from the signature, and a
 * return or parameter type that spans lines and contains an object shape
 * balances to zero before the body brace is ever reached:
 *
 *   async listPendingDecisions(userId: string): Promise<
 *     { … }[]                    // ← real code, so stripping strings cannot help
 *   > {
 *
 *   private async applySectionContentUpdates(
 *     resumeId: string,
 *     updates: Array<{ id: string; content: … }>,   // ← same, on a parameter
 *   ) {
 *
 * Both methods were judged to end inside their own signature, so their queries
 * fell into a ±20-line fallback window. That produced:
 *
 *   - a FALSE POSITIVE in outcome.service.ts, where the window landed too far
 *     from the signature to see the `userId` parameter that scopes the method;
 *   - a FALSE NEGATIVE in resume.service.ts, where the window straddled into
 *     the NEXT method and borrowed ITS `userId`.
 *
 * The false positive is the more expensive of the two. A security rule that
 * cries wolf does not merely waste a reading — it teaches people to annotate
 * their way past it, and then the real finding gets annotated too.
 *
 * Both directions are seeded below, so neither can come back quietly.
 */
export async function prove(): Promise<void> {
  expectClean(runGate('check-integration.ts'));

  // 1. The gate still catches a genuinely unscoped query. Without this, every
  //    assertion below is satisfied by a rule that reports nothing at all.
  await withPatchedFile(
    'apps/api/src/modules/vault/vault.service.ts',
    (s) =>
      s.replace(
        /\n\}\s*$/,
        `
  async __gateProofUnscopedRead() {
    return this.prisma.vaultItem.findMany({ where: { category: 'seeded' } });
  }
}
`
      ),
    () => expectFired(runGate('check-integration.ts'), 'user-data-isolation')
  );

  // 2. FALSE-POSITIVE direction. `listPendingDecisions` takes `userId` on a
  //    signature whose return type spans ten lines. Strip its annotations and
  //    the rule must still see that parameter — if the brace matcher comes
  //    back, this method gets reported as a multi-tenant leak while being
  //    correctly scoped.
  await withPatchedFile(
    'apps/api/src/modules/prediction/outcome/outcome.service.ts',
    (s) => s.replace(/\/\/ governance: system-scope/g, '// (annotation removed by gate-proof)'),
    () =>
      expectClean(
        runGate('check-integration.ts'),
        'a correctly-scoped method whose return type spans lines (the false-positive regression)'
      )
  );

  // 3. FALSE-NEGATIVE direction. `applySectionContentUpdates` has no `userId`
  //    of its own — it is parent-scoped, and says so. Remove the annotation and
  //    the rule MUST flag it. Under the old matcher it stayed silent, because
  //    the fallback window reached forward into `buildProfileImportUpdates` and
  //    read that method's `userId` as if it were this one's.
  await withPatchedFile(
    'apps/api/src/modules/resume/resume.service.ts',
    (s) =>
      s.replace(
        '// governance: parent-scoped — both callers',
        '// (annotation removed by gate-proof) — both callers'
      ),
    () => expectFired(runGate('check-integration.ts'), 'user-data-isolation')
  );

  // 4. An annotation on the method header must count. It is where someone
  //    naturally writes one, and a window starting at the signature would read
  //    it as absent and flag the method anyway — an annotation that silently
  //    does nothing is worse than none, because the author believes the case is
  //    handled.
  await withPatchedFile(
    'apps/api/src/modules/vault/vault.service.ts',
    (s) =>
      s.replace(
        /\n\}\s*$/,
        `
  // governance: system-scope — seeded by the gate-proof; this annotation sits
  // above the signature, which is the placement being proven to count.
  async __gateProofAnnotatedAboveSignature() {
    return this.prisma.vaultItem.findMany({ where: { category: 'seeded' } });
  }
}
`
      ),
    () => expectClean(runGate('check-integration.ts'), 'a method annotated above its signature')
  );
}

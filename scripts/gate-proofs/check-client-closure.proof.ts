import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

const CTRL = 'apps/api/src/modules/timeline/timeline.controller.ts';
const GATE = 'check-client-closure.ts';

/**
 * Proof for `check-client-closure.ts` — the frontend↔backend closure check.
 *
 * It builds the backend inventory by regex, and both patterns require a string
 * literal. A decorator written any other way — `@Get(ROUTES.THING)`, a template
 * literal, a constant — matched neither, and the route simply never entered the
 * inventory. Probing on 2026-08-06 found `@Get(CONST)` passing silently.
 *
 * That is worse than an unchecked route, because the comparison then runs
 * against a SHORT inventory: a frontend call to that real, working endpoint
 * reads as a call to an endpoint the backend does not have, and the obvious
 * response is to "fix" the frontend. `@Controller` written that way loses every
 * route in the file at once — that one happened to be caught already, but
 * indirectly, via the closure mismatch rather than by anything saying why.
 *
 * All 64 controllers and 733 method decorators are literals today, so the check
 * starts at zero and cries wolf at nobody.
 */
export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withPatchedFile(
    CTRL,
    (s) => s.replace("@Get('global-events')", '@Get(GLOBAL_EVENTS_PATH)'),
    () => expectFired(runGate(GATE), 'absent from the backend inventory')
  );

  await withPatchedFile(
    CTRL,
    (s) => s.replace("@Controller('timelines')", '@Controller(TIMELINE_ROUTE)'),
    () => expectFired(runGate(GATE), 'EVERY route in this file')
  );

  await withPatchedFile(
    CTRL,
    (s) => s.replace('@Post(', '@Post(`${X}`) // '),
    () => expectFired(runGate(GATE), 'absent from the backend inventory')
  );
}

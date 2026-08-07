import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

const CTRL = 'apps/api/src/modules/timeline/timeline.controller.ts';
const WEB = 'apps/web/src/app/[locale]/(main)/timeline/page.tsx';
const GATE = 'check-api-routes.ts';

/**
 * Proof for `check-api-routes.ts`.
 *
 * Its client side is a real ts-morph resolver — template literals, identifiers,
 * conditionals, concatenation — and it is correct. Three "findings" against it
 * on 2026-08-06 were all **invalid seeds**: `/timelines/global-events` and
 * `/timelines/no-such-endpoint` are two segments, and the controller has
 * `@Get(':id')`, so both legitimately match a real route. The gate was right
 * every time. Seeds F and G below are the shapes that no `:param` can absorb,
 * which is what makes them able to fail.
 *
 * The one real defect was on the BACKEND side, and it did not hide — it lied.
 * `@Post(SUBSCRIBE_PATH)` left the route out of the inventory and the gate then
 * reported:
 *
 *   ❌ apps/web/…/timeline/page.tsx:388 — POST /timelines/personal-events/subscribe
 *      does not match any backend controller method.
 *   ❌ apps/mobile/src/app/timeline.tsx:247 — …
 *
 * Two files, two line numbers, pointing at working code and inviting someone to
 * delete a correct call. Under a controller that also has `@Get(':id')` the same
 * edit vanishes silently instead. Misdirected or silent — neither is the truth.
 */
export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  // The client resolver works: a path no route can absorb is caught.
  await withPatchedFile(
    WEB,
    (s) => s.replace('${API_ROUTES.TIMELINES}/global-events', '${API_ROUTES.TIMELINES}/a/b/c'),
    () => expectFired(runGate(GATE), 'does not match any backend controller method')
  );

  await withPatchedFile(
    WEB,
    (s) => s.replace('${API_ROUTES.TIMELINES}/global-events', '/not-a-module/global-events'),
    () => expectFired(runGate(GATE), 'does not match any backend controller method')
  );

  // Backend decorator the regexes cannot read. Before this was checked, seed 3
  // blamed two frontend files and seed 4 passed silently.
  await withPatchedFile(
    CTRL,
    (s) => s.replace("@Post('personal-events/subscribe')", '@Post(SUBSCRIBE_PATH)'),
    () => expectFired(runGate(GATE), 'cannot read')
  );

  await withPatchedFile(
    CTRL,
    (s) => s.replace("@Get('global-events')", '@Get(GLOBAL_EVENTS_PATH)'),
    () => expectFired(runGate(GATE), 'cannot read')
  );

  await withPatchedFile(
    CTRL,
    (s) => s.replace("@Controller('timelines')", '@Controller(TIMELINE_ROUTE)'),
    () => expectFired(runGate(GATE), 'EVERY route in this file')
  );
}

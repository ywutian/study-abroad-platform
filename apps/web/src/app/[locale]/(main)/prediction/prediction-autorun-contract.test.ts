import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * `?autorun=1` is a contract between three files, and breaking it is silent.
 *
 * `dashboard-setup-progress.tsx` and `onboarding/quick-experience.tsx` both
 * navigate to `/prediction?autorun=1` expecting an estimate to start on its
 * own. `prediction/page.tsx` honours that in two coupled places: the pre-fill
 * effect (which is now gated on the param and also sets `hasPreFilled`) and the
 * autorun effect (which early-returns on `!hasPreFilled`). Delete or re-gate
 * either one and both entry points land on a page that just sits there — no
 * error, no toast, nothing red.
 *
 * ponytail: a SOURCE-level assertion, not a render. Mounting an 854-line page
 * behind five data hooks to prove an effect did not fire is the more fragile
 * test, and the failure this guards against is deletion, which a grep sees
 * perfectly well. The user-visible half — that a plain visit starts empty — is
 * pinned properly by rendering the card in
 * `features/prediction/prediction-prefill-autorun.test.tsx`.
 *
 * If this test becomes annoying because the page was legitimately restructured,
 * the fix is to re-point it at the new shape, NOT to delete it: what it is
 * guarding still fails silently.
 */
const WEB_SRC = path.resolve(__dirname, '..', '..', '..', '..');

const read = (rel: string) => fs.readFileSync(path.join(WEB_SRC, rel), 'utf8');

describe('?autorun=1 contract', () => {
  const page = read('app/[locale]/(main)/prediction/page.tsx');

  it('the entry points still send the param this page reads', () => {
    const dashboard = read(
      'app/[locale]/(main)/dashboard/_components/dashboard-setup-progress.tsx'
    );
    const onboarding = read('components/features/onboarding/quick-experience.tsx');

    // If an entry point stops sending it, this page's carve-out is dead weight
    // and the pre-fill should go away with it — a deliberate decision, not a
    // drift. Failing here is the prompt to make it.
    expect(dashboard + onboarding).toContain('autorun=1');
  });

  it('the page still reads the param', () => {
    expect(page).toMatch(/searchParams\.get\('autorun'\)/);
  });

  it('the pre-fill is gated on it, and still sets the flag autorun depends on', () => {
    // Matches the GUARD, not merely the identifier. The first version of this
    // test asserted `/wantsAutoRun/` and stayed green when the guard was
    // deleted from the condition — the name survives in the `const` and in the
    // dependency array, so it proved nothing. Caught by seeding exactly that
    // edit; the weak assertion is why this comment exists.
    expect(page).toMatch(/if \(!wantsAutoRun \|\| hasPreFilled/);
    expect(page).toMatch(/setHasPreFilled\(true\)/);
  });

  it('the autorun effect still requires the pre-fill to have happened', () => {
    // This is the coupling itself. If `hasPreFilled` stops gating autorun, the
    // pre-fill carve-out has no reason to exist and should be removed with it.
    expect(page).toMatch(/if \(!hasPreFilled \|\| selectedSchools\.length === 0/);
  });
});

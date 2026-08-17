import { expectClean, expectFired, runGate, withPatchedFile } from './harness';

const GATE = 'apps/web/scripts/check-translation-keys.ts';

export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withPatchedFile(
    'apps/web/src/messages/en.json',
    (s) => {
      const data = JSON.parse(s) as { welcome: { prediction?: { title?: string } } };
      if (data.welcome?.prediction) delete data.welcome.prediction.title;
      return `${JSON.stringify(data)}\n`;
    },
    () => expectFired(runGate(GATE), 'welcome.prediction.title')
  );
}

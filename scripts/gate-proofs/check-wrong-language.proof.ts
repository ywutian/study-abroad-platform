import { expectClean, expectFired, runGate, withPatchedFile } from './harness';

const GATE = 'apps/web/scripts/check-wrong-language.ts';

export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withPatchedFile(
    'apps/web/src/messages/zh.json',
    (s) => {
      const data = JSON.parse(s) as { welcome: { prediction: { title: string } } };
      data.welcome.prediction.title = 'This is definitely english copy for the gate proof';
      return `${JSON.stringify(data)}\n`;
    },
    () => expectFired(runGate(GATE), 'appear to be English')
  );
}

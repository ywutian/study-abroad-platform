import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');

test('production Harness evidence captures only the direct runner stdout', () => {
  assert.match(
    workflow,
    /pnpm --filter api exec tsx scripts\/ai-agent-harness-acceptance\.ts --production \\\n+\s*> \/tmp\/harness-release-evidence\/runner\.jsonl/
  );
  assert.doesNotMatch(
    workflow,
    /pnpm harness:acceptance --production \\\n+\s*> \/tmp\/harness-release-evidence\/runner\.jsonl/
  );
});

import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export function runPrePromotionAcceptance({
  env = process.env,
  spawn = spawnSync,
  directory = '/tmp/harness-pre-promote',
} = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const artifact = `${directory}/harness-acceptance.json`;
  // Always retain a sanitized failure artifact, even if the child cannot start.
  writeFileSync(
    artifact,
    JSON.stringify({
      schemaVersion: 'ai-agent-harness-acceptance-v1',
      revision: env.HARNESS_EXPECTED_REVISION ?? '',
      records: [],
      pass: false,
      reasonCodes: ['HARNESS_PRE_PROMOTE_NOT_COMPLETED'],
    }) + '\n',
    { mode: 0o600 }
  );
  if (!env.HARNESS_ADMIN_PASSWORD || !env.HARNESS_EXPECTED_REVISION || !env.HARNESS_API_BASE)
    return 2;
  const runner = spawn(
    process.execPath,
    ['--import', 'tsx', 'apps/api/scripts/ai-agent-harness-acceptance.ts', '--production'],
    { env, encoding: 'utf8', timeout: 600000, maxBuffer: 1024 * 1024 }
  );
  // Only the validator may create uploadable evidence. Neither stdout nor stderr
  // from the unvalidated runner is forwarded into GitHub logs or artifacts.
  writeFileSync(`${directory}/runner.jsonl`, runner.stdout ?? '', { mode: 0o600 });
  const validator = spawn(
    process.execPath,
    ['scripts/ci/validate-harness-acceptance-evidence.mjs'],
    {
      env: {
        ...env,
        HARNESS_EVIDENCE_INPUT: `${directory}/runner.jsonl`,
        HARNESS_EVIDENCE_OUTPUT: artifact,
      },
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    }
  );
  return runner.status === 0 && !runner.error && validator.status === 0 && !validator.error ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runPrePromotionAcceptance();
    console.log(JSON.stringify({ gate: 'harness_pre_promote', passed: process.exitCode === 0 }));
  } catch {
    console.error('HARNESS_PRE_PROMOTE_FAILED');
    process.exitCode = 1;
  }
}

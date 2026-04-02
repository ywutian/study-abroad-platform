import path from 'node:path';

process.env.RUNTIME_AUDIT_ID ??= '2026-03-31';
process.env.RUNTIME_AUDIT_CONTEXT ??= '2026-03-31 runtime audit';
process.env.RUNTIME_EVIDENCE_ROOT ??= path.join('e2e-report', 'journeys-2026-03-31');

import('./runtime-journey-audit.ts').catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});

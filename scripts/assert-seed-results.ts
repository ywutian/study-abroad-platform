/**
 * Repo-root entry for post-seed result assertions.
 *
 * Lives next to `check-seed-pipeline-parity.ts` (which only proves the seed
 * *script* is in the image). This one proves the *rows* landed — but the DB
 * half needs Postgres, so it is NOT in `lint:all`.
 *
 *   pnpm exec tsx scripts/assert-seed-results.ts           # static, no DB
 *   pnpm exec tsx scripts/assert-seed-results.ts --db      # needs DATABASE_URL
 *
 * Deploy path: apps/api/migrate.sh runs the compiled
 * `prisma/check-seed-result-assertions.js --db` after seeds.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const api = path.resolve(__dirname, '../apps/api');
const result = spawnSync(
  'pnpm',
  ['exec', 'tsx', 'prisma/check-seed-result-assertions.ts', ...process.argv.slice(2)],
  { stdio: 'inherit', cwd: api }
);

process.exit(result.status === null ? 1 : result.status);

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type Step = {
  label: string;
  command: string;
  env?: NodeJS.ProcessEnv;
};

type Lane = {
  id: string;
  steps: Step[];
};

type StepResult = {
  label: string;
  command: string;
  durationMs: number;
};

type LaneResult = {
  id: string;
  durationMs: number;
  steps: StepResult[];
};

const ROOT = process.cwd();
const REPORT_ROOT = path.join(ROOT, 'verification-report', 'full-platform');
const DEFAULT_TEST_DB = 'study_abroad_test';

fs.mkdirSync(REPORT_ROOT, { recursive: true });

const baseEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, '--max-old-space-size=8192'].filter(Boolean).join(' '),
};

const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbPort = process.env.DB_PORT || '5433';
const redisPort = process.env.REDIS_PORT || '6379';
const redisPassword = process.env.REDIS_PASSWORD || 'redis_dev_password';
const testDatabaseName = process.env.TEST_DB_NAME || DEFAULT_TEST_DB;

const apiTestEnv: NodeJS.ProcessEnv = {
  ...baseEnv,
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ||
    `postgresql://${dbUser}:${dbPassword}@localhost:${dbPort}/${testDatabaseName}`,
  REDIS_URL: process.env.TEST_REDIS_URL || `redis://:${redisPassword}@localhost:${redisPort}`,
  JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-at-least-16-chars',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-16-chars',
  VAULT_ENCRYPTION_KEY:
    process.env.VAULT_ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:4100',
  SKIP_EMAIL_VERIFICATION: process.env.SKIP_EMAIL_VERIFICATION || 'true',
  METRICS_ENABLED: process.env.METRICS_ENABLED || 'false',
};

const playwrightEnv: NodeJS.ProcessEnv = {
  ...baseEnv,
  PLAYWRIGHT_OUTPUT_DIR: 'e2e-report/playwright',
};

const lanes: Lane[] = [
  {
    id: 'web-static',
    steps: [
      { label: 'web lint', command: 'pnpm --filter web lint' },
      { label: 'web i18n lint', command: 'pnpm --filter web lint:i18n' },
      { label: 'web english lint', command: 'pnpm --filter web lint:i18n-english' },
      { label: 'web typography lint', command: 'pnpm --filter web lint:typography' },
      { label: 'web unit tests', command: 'pnpm --filter web test' },
    ],
  },
  {
    id: 'web-build-e2e',
    steps: [
      { label: 'web build', command: 'pnpm --filter web build' },
      { label: 'web smoke e2e', command: 'pnpm test:e2e:web', env: playwrightEnv },
      {
        label: 'web full UI e2e',
        command: 'pnpm test:e2e:web:full-ui --reporter=line',
        env: playwrightEnv,
      },
    ],
  },
  {
    id: 'api-core',
    steps: [
      { label: 'api prisma generate', command: 'pnpm --filter api db:generate', env: apiTestEnv },
      {
        label: 'api typecheck',
        command: 'pnpm --filter api exec tsc --noEmit --project tsconfig.build.json',
        env: apiTestEnv,
      },
      { label: 'api build', command: 'pnpm --filter api build', env: apiTestEnv },
      { label: 'api coverage tests', command: 'pnpm --filter api test:cov', env: apiTestEnv },
    ],
  },
  {
    id: 'api-e2e',
    steps: [
      { label: 'docker db/redis up', command: 'docker compose up -d db redis' },
      {
        label: 'wait for postgres',
        command: `until docker compose exec -T db pg_isready -U ${dbUser}; do sleep 2; done`,
      },
      {
        label: 'create test database',
        command: `docker compose exec -T db psql -U ${dbUser} -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '${testDatabaseName}'" | grep -q 1 || docker compose exec -T db psql -U ${dbUser} -d postgres -c "CREATE DATABASE ${testDatabaseName}"`,
      },
      {
        label: 'enable pgvector extension',
        command: `docker compose exec -T db psql -U ${dbUser} -d ${testDatabaseName} -c "CREATE EXTENSION IF NOT EXISTS vector"`,
      },
      {
        label: 'api test schema push',
        command: 'pnpm --filter api exec prisma db push --accept-data-loss',
        env: apiTestEnv,
      },
      {
        label: 'api e2e tests',
        command: 'pnpm --filter api exec jest --config ./test/jest-e2e.json --runInBand',
        env: apiTestEnv,
      },
    ],
  },
  {
    id: 'mobile',
    steps: [
      { label: 'mobile lint', command: 'pnpm --filter study-abroad-mobile lint' },
      { label: 'mobile i18n lint', command: 'pnpm --filter study-abroad-mobile lint:i18n' },
      { label: 'mobile typecheck', command: 'pnpm --filter study-abroad-mobile typecheck' },
      { label: 'mobile tests', command: 'pnpm --filter study-abroad-mobile test' },
    ],
  },
  {
    id: 'shared-extension-root',
    steps: [
      { label: 'shared lint', command: 'pnpm --filter @study-abroad/shared lint' },
      { label: 'shared build', command: 'pnpm --filter @study-abroad/shared build' },
      {
        label: 'browser extension lint',
        command: 'pnpm --filter @study-abroad/browser-extension lint',
      },
      {
        label: 'browser extension build',
        command: 'pnpm --filter @study-abroad/browser-extension build',
      },
      { label: 'route lint', command: 'pnpm lint:routes' },
      { label: 'integration lint', command: 'pnpm lint:integration' },
      { label: 'drift lint', command: 'pnpm lint:drift' },
      { label: 'journey lint', command: 'pnpm lint:journeys' },
    ],
  },
];

function formatDuration(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function tailLog(logPath: string, lineCount = 80) {
  if (!fs.existsSync(logPath)) return '';
  const lines = fs.readFileSync(logPath, 'utf8').trimEnd().split('\n');
  return lines.slice(-lineCount).join('\n');
}

function runStep(laneId: string, step: Step, logPath: string): Promise<StepResult> {
  const startedAt = Date.now();
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const stream = fs.createWriteStream(logPath, { flags: 'a' });
  stream.write(`\n\n[${new Date().toISOString()}] ${step.label}\n$ ${step.command}\n\n`);

  return new Promise((resolve, reject) => {
    const child = spawn(step.command, {
      cwd: ROOT,
      env: step.env ?? baseEnv,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => stream.write(chunk));
    child.stderr.on('data', (chunk) => stream.write(chunk));
    child.on('error', (error) => {
      stream.end();
      reject(error);
    });
    child.on('exit', (code) => {
      const durationMs = Date.now() - startedAt;
      stream.write(
        `\n[${new Date().toISOString()}] exit=${code ?? 1} duration=${formatDuration(durationMs)}\n`
      );
      stream.end();
      if ((code ?? 1) === 0) {
        resolve({ label: step.label, command: step.command, durationMs });
        return;
      }
      const tail = tailLog(logPath);
      reject(
        new Error(
          [
            `[${laneId}] failed at "${step.label}" after ${formatDuration(durationMs)}`,
            `command: ${step.command}`,
            `log: ${path.relative(ROOT, logPath)}`,
            '',
            tail,
          ].join('\n')
        )
      );
    });
  });
}

async function runLane(lane: Lane): Promise<LaneResult> {
  const laneStartedAt = Date.now();
  const logPath = path.join(REPORT_ROOT, `${lane.id}.log`);
  fs.writeFileSync(logPath, `[${new Date().toISOString()}] lane=${lane.id}\n`);
  console.log(`[${lane.id}] start (${lane.steps.length} steps) -> ${path.relative(ROOT, logPath)}`);

  const steps: StepResult[] = [];
  for (const step of lane.steps) {
    console.log(`[${lane.id}] ${step.label}`);
    steps.push(await runStep(lane.id, step, logPath));
  }

  const durationMs = Date.now() - laneStartedAt;
  console.log(`[${lane.id}] passed in ${formatDuration(durationMs)}`);
  return { id: lane.id, durationMs, steps };
}

function selectedLanes() {
  const laneArg = process.argv.find((arg) => arg.startsWith('--lane='));
  if (!laneArg) return lanes;
  const selected = new Set(
    laneArg
      .slice('--lane='.length)
      .split(',')
      .map((id) => id.trim())
  );
  return lanes.filter((lane) => selected.has(lane.id));
}

async function main() {
  const startedAt = Date.now();
  const activeLanes = selectedLanes();
  if (activeLanes.length === 0) {
    throw new Error('No lanes selected. Use --lane=web-static,api-core,...');
  }

  console.log(
    `[verify:full-platform] running ${activeLanes.length} lanes: ${activeLanes
      .map((lane) => lane.id)
      .join(', ')}`
  );

  const settledResults = await Promise.allSettled(activeLanes.map((lane) => runLane(lane)));
  const failures = settledResults.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (failures.length > 0) {
    throw new Error(
      failures.map((failure) => String(failure.reason?.message ?? failure.reason)).join('\n\n')
    );
  }

  const results = settledResults.map(
    (result) => (result as PromiseFulfilledResult<LaneResult>).value
  );
  const durationMs = Date.now() - startedAt;
  const summaryPath = path.join(REPORT_ROOT, 'summary.json');
  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        durationMs,
        duration: formatDuration(durationMs),
        lanes: results,
      },
      null,
      2
    )}\n`
  );

  console.log(`[verify:full-platform] passed in ${formatDuration(durationMs)}`);
  console.log(`[verify:full-platform] summary -> ${path.relative(ROOT, summaryPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

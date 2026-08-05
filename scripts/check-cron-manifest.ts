/**
 * Cron manifest gate — keeps `.github/cron-jobs.json` a faithful mirror of the
 * `@Cron` decorators in `apps/api/src`.
 *
 * WHY: production runs `CRON_DRIVER=http` — no in-process timers; Cloud
 * Scheduler drives `POST /internal/cron/:name/run` for every job listed in the
 * manifest (`scripts/ci/sync-cloud-scheduler.mjs` upserts scheduler jobs from
 * it on each deploy). A `@Cron` added without regenerating the manifest would
 * run in dev and NEVER in production — silently, which is exactly the failure
 * mode (#553: a month of crons skipping with nothing red) this driver replaces.
 * This gate makes that impossible to land.
 *
 * The job-name derivation here MUST match `CronRegistryService` (explicit
 * `options.name`, else kebab-case `ClassName-methodName`). The deploy pipeline
 * additionally asserts the LIVE registry (`GET /internal/cron`) against this
 * manifest after every deploy, so even a drift between these two
 * implementations cannot survive a release unnoticed.
 *
 *   tsx scripts/check-cron-manifest.ts            # verify (lint:all, CI)
 *   tsx scripts/check-cron-manifest.ts --update   # regenerate the manifest
 */
import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import * as ts from 'typescript';

const ROOT = path.resolve(__dirname, '..');
const API_SRC = path.join(ROOT, 'apps', 'api', 'src');
const MANIFEST_PATH = path.join(ROOT, '.github', 'cron-jobs.json');

// Resolve CronExpression from the api workspace (pnpm does not hoist it to root).
const apiRequire = createRequire(path.join(ROOT, 'apps', 'api', 'package.json'));
const { CronExpression } = apiRequire('@nestjs/schedule') as {
  CronExpression: Record<string, string>;
};

interface ManifestJob {
  name: string;
  schedule: string;
  timeZone?: string;
  className: string;
  methodName: string;
  sourceFile: string;
}

/** Must stay identical to InternalCronController's JOB_NAME_PATTERN. */
const JOB_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,199}$/;

/** Must stay identical to CronRegistryService.deriveJobName. */
function deriveJobName(className: string, methodName: string): string {
  return `${className}-${methodName}`.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.d.ts')
    )
      out.push(full);
  }
  return out;
}

function fail(file: string, node: ts.Node, sourceFile: ts.SourceFile, msg: string): never {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  console.error(`❌ ${path.relative(ROOT, file)}:${line + 1} — ${msg}`);
  process.exit(1);
}

function resolveCronExpression(
  arg: ts.Expression,
  file: string,
  sourceFile: ts.SourceFile
): string {
  if (ts.isStringLiteralLike(arg)) return arg.text;
  if (
    ts.isPropertyAccessExpression(arg) &&
    ts.isIdentifier(arg.expression) &&
    arg.expression.text === 'CronExpression'
  ) {
    const value = CronExpression[arg.name.text];
    if (typeof value !== 'string') {
      fail(file, arg, sourceFile, `Unknown CronExpression.${arg.name.text}`);
    }
    return value;
  }
  return fail(
    file,
    arg,
    sourceFile,
    `@Cron schedule must be a string literal or CronExpression.* so Cloud Scheduler can mirror it — got: ${arg.getText(sourceFile)}`
  );
}

function extractJobs(): ManifestJob[] {
  const jobs = new Map<string, ManifestJob>();

  for (const file of walk(API_SRC).sort()) {
    const text = fs.readFileSync(file, 'utf8');
    if (!/@(Cron|Interval|Timeout)\(/.test(text)) continue;
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

    const visit = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node)) {
        for (const decorator of ts.getDecorators(node) ?? []) {
          const expr = decorator.expression;
          if (!ts.isCallExpression(expr)) continue;
          if (!ts.isIdentifier(expr.expression)) continue;

          // @Interval / @Timeout have no Cloud Scheduler mirror. Under
          // CRON_DRIVER=http the driver gate only turns off `cronJobs`, so
          // these would keep firing on a CPU-throttled instance — the very
          // thing this architecture removes — while being invisible to the
          // manifest, the deploy assert and the scheduler console. If you need
          // recurring replica-LOCAL work, use a plain unref'd setInterval and
          // say so (see RateLimiterService.onModuleInit).
          if (['Interval', 'Timeout'].includes(expr.expression.text)) {
            fail(
              file,
              expr,
              sourceFile,
              `@${expr.expression.text} is not supported: it keeps an in-process timer on a CPU-throttled ` +
                `service and never reaches Cloud Scheduler. Use @Cron (scheduled work) or an unref'd ` +
                `setInterval (replica-local work).`
            );
          }
          if (expr.expression.text !== 'Cron') continue;

          const classDecl = node.parent;
          if (!ts.isClassDeclaration(classDecl) || !classDecl.name) {
            fail(file, node, sourceFile, '@Cron on something that is not a named class method');
          }
          const className = classDecl.name.text;
          const methodName = ts.isIdentifier(node.name)
            ? node.name.text
            : fail(file, node, sourceFile, '@Cron method must have a plain identifier name');

          const schedule = resolveCronExpression(expr.arguments[0], file, sourceFile);
          if (schedule.trim().split(/\s+/).length !== 5) {
            fail(
              file,
              expr,
              sourceFile,
              `"${schedule}" is not a 5-field cron expression — Cloud Scheduler cannot express seconds`
            );
          }

          let name: string | undefined;
          let timeZone: string | undefined;
          const options = expr.arguments[1];
          if (options) {
            if (!ts.isObjectLiteralExpression(options)) {
              fail(file, options, sourceFile, '@Cron options must be an inline object literal');
            }
            for (const prop of options.properties) {
              if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
                fail(file, prop, sourceFile, '@Cron options must use plain literal properties');
              }
              const key = prop.name.text;
              if (key !== 'name' && key !== 'timeZone') {
                // `disabled`, `waitForCompletion`, `utcOffset`… have no Cloud
                // Scheduler mirror, so allowing them would make timer mode and
                // http mode behave differently. Support one when it is needed —
                // in BOTH this generator and the sync script — not before.
                fail(
                  file,
                  prop,
                  sourceFile,
                  `@Cron option "${key}" is not supported by the http cron driver`
                );
              }
              if (!ts.isStringLiteralLike(prop.initializer)) {
                fail(file, prop, sourceFile, `@Cron option "${key}" must be a string literal`);
              }
              if (key === 'name') name = prop.initializer.text;
              else timeZone = prop.initializer.text;
            }
          }

          const jobName = name ?? deriveJobName(className, methodName);
          // Same pattern the dispatcher enforces (InternalCronController's
          // JOB_NAME_PATTERN). Without this, an explicit `{ name: 'My_Job' }`
          // would be provisioned as a scheduler job, MATCH the live registry
          // (so the deploy assert passes — it compares names, not their
          // shape), and then 400 on every firing: runs in dev, never in prod,
          // silently. Also stops a leading `-` reaching gcloud as a flag.
          if (!JOB_NAME_PATTERN.test(jobName)) {
            fail(
              file,
              expr,
              sourceFile,
              `Cron job name "${jobName}" must match ${JOB_NAME_PATTERN} — the dispatcher rejects anything else`
            );
          }
          if (jobs.has(jobName)) {
            fail(file, expr, sourceFile, `Duplicate cron job name "${jobName}"`);
          }
          jobs.set(jobName, {
            name: jobName,
            schedule,
            ...(timeZone ? { timeZone } : {}),
            className,
            methodName,
            sourceFile: path.relative(ROOT, file),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return [...jobs.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function render(jobs: ManifestJob[]): string {
  return `${JSON.stringify(
    {
      _comment:
        'GENERATED — do not edit. Mirrors every @Cron in apps/api/src; scripts/ci/sync-cloud-scheduler.mjs provisions one Cloud Scheduler job per entry on deploy. Regenerate: pnpm lint:cron-manifest --update',
      jobs,
    },
    null,
    2
  )}\n`;
}

function main(): void {
  const update = process.argv.includes('--update');
  const expected = render(extractJobs());

  if (update) {
    fs.writeFileSync(MANIFEST_PATH, expected);
    console.log(`✅ Wrote ${path.relative(ROOT, MANIFEST_PATH)} (${extractJobs().length} jobs)`);
    return;
  }

  const actual = fs.existsSync(MANIFEST_PATH) ? fs.readFileSync(MANIFEST_PATH, 'utf8') : '';
  if (actual !== expected) {
    console.error(
      '❌ .github/cron-jobs.json is stale — the @Cron decorators in apps/api/src have changed.\n' +
        '   Under CRON_DRIVER=http (production) a job missing from this manifest NEVER runs.\n' +
        '   Fix: pnpm lint:cron-manifest --update  (then commit the manifest)'
    );
    process.exit(1);
  }
  console.log(`✅ cron manifest in sync (${extractJobs().length} jobs)`);
}

main();

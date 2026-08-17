/**
 * User-facing deletion copy may only promise what the purge job actually does.
 *
 * `DELETE /users/me` is a SOFT delete. `AccountPurgeService` is what makes it
 * real, and it acts only when `ACCOUNT_PURGE_ENABLED=true`. So a retention
 * period in the UI is a claim about a background job — one users act on when
 * deciding what to put in the product.
 *
 * Locale files are discovered on disk (web messages + mobile locales). A
 * handwritten path list is how mobile `en.json` sat outside the gate.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const CI = path.join(ROOT, '.github/workflows/ci.yml');

const WEB_KEYS = [
  ['settings', 'items', 'deleteAccountDesc'],
  ['settings', 'dialogs', 'deleteDesc'],
  ['security', 'dangerZoneDesc'],
];

const MOBILE_KEYS = [
  ['settings', 'deleteAccountConfirm'],
  ['security', 'deleteAccountWarning'],
];

const LOCALE_GROUPS: Array<{ dir: string; keys: string[][] }> = [
  { dir: 'apps/web/src/messages', keys: WEB_KEYS },
  { dir: 'apps/mobile/src/lib/i18n/locales', keys: MOBILE_KEYS },
];

function localeFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) {
    throw new Error(`${dir} is missing — deletion-promise cannot scan locales`);
  }
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(dir, f));
}

const ci = fs.readFileSync(CI, 'utf8');
const enabled = /ACCOUNT_PURGE_ENABLED=true/.test(ci);
const graceMatch = ci.match(/ACCOUNT_PURGE_GRACE_DAYS=(\d+)/);
if (!graceMatch) {
  console.error(
    '❌ ACCOUNT_PURGE_GRACE_DAYS is not stated in the production deploy line.\n' +
      '   Both purge flags are set explicitly on purpose — --set-env-vars replaces\n' +
      '   the whole set, so dropping one silently reverts it to its default.'
  );
  process.exit(1);
}
const graceDays = graceMatch[1];

const problems: string[] = [];
let promised = 0;
let filesScanned = 0;

for (const { dir, keys } of LOCALE_GROUPS) {
  const files = localeFiles(dir);
  if (files.length === 0) {
    problems.push(`${dir}: no locale JSON files found`);
    continue;
  }
  for (const file of files) {
    filesScanned++;
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    for (const keyPath of keys) {
      const value = keyPath.reduce<unknown>(
        (n, k) => (n as Record<string, unknown> | undefined)?.[k],
        data
      );
      if (typeof value !== 'string') {
        problems.push(
          `${file} → ${keyPath.join('.')}: missing (the list here is stale, or the key moved)`
        );
        continue;
      }
      const numbers = [...value.matchAll(/(\d+)\s*(?:天|days?)/g)].map((m) => m[1]);
      if (numbers.length === 0) {
        if (enabled) {
          problems.push(
            `${file} → ${keyPath.join('.')}: purge is ENABLED but this string promises no retention period.\n` +
              `     Users are told their identity is cleared and nothing about the data being removed.`
          );
        }
        continue;
      }
      promised++;
      if (!enabled) {
        problems.push(
          `${file} → ${keyPath.join('.')}: promises ${numbers[0]} days, but ACCOUNT_PURGE_ENABLED is FALSE.\n` +
            `     Nothing deletes anything. This is the exact defect AccountPurgeService was built to close.`
        );
      } else if (!numbers.includes(graceDays)) {
        problems.push(
          `${file} → ${keyPath.join('.')}: promises ${numbers.join('/')} days, ACCOUNT_PURGE_GRACE_DAYS is ${graceDays}.`
        );
      }
      const mentionsPayment = /payment|支付|financial|财务/.test(value);
      if (!mentionsPayment) {
        problems.push(
          `${file} → ${keyPath.join('.')}: deletion copy does not disclose that accounts with Payment rows are retained for financial records.`
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error('\n❌ Deletion copy does not match what the purge job does:\n');
  for (const p of problems) console.error(`   ${p}\n`);
  process.exitCode = 1;
} else {
  console.log(
    `✅ Deletion promise consistent: purge ${enabled ? `ENABLED, grace ${graceDays}d` : 'disabled'}, ` +
      `${promised} user-facing string(s) across ${filesScanned} locale file(s) agree.`
  );
}

/**
 * User-facing deletion copy may only promise what the purge job actually does.
 *
 * `DELETE /users/me` is a SOFT delete. `AccountPurgeService` is what makes it
 * real, and it acts only when `ACCOUNT_PURGE_ENABLED=true`. So a retention
 * period in the UI is a claim about a background job — one users act on when
 * deciding what to put in the product.
 *
 * Two ways that goes wrong, both silent:
 *   - copy promises "permanently deleted after N days" while the flag is off
 *     (a promise nothing keeps), or
 *   - copy says N and ACCOUNT_PURGE_GRACE_DAYS says something else
 *     (a promise kept on a different schedule than the one advertised).
 *
 * Neither breaks a test, renders red, or shows up in a log. This is the check.
 *
 * ponytail: reads the deploy workflow and the locale files directly. The flag
 * lives in ci.yml's --set-env-vars, which IS the production value — see the
 * account-deletion section of .claude/rules/security.md.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const CI = path.join(ROOT, '.github/workflows/ci.yml');

const LOCALES: Array<{ file: string; keys: string[][] }> = [
  {
    file: 'apps/web/src/messages/zh.json',
    keys: [
      ['settings', 'items', 'deleteAccountDesc'],
      ['settings', 'dialogs', 'deleteDesc'],
      ['security', 'dangerZoneDesc'],
    ],
  },
  {
    file: 'apps/web/src/messages/en.json',
    keys: [
      ['settings', 'items', 'deleteAccountDesc'],
      ['settings', 'dialogs', 'deleteDesc'],
      ['security', 'dangerZoneDesc'],
    ],
  },
  {
    file: 'apps/mobile/src/lib/i18n/locales/zh.json',
    keys: [
      ['settings', 'deleteAccountConfirm'],
      ['security', 'deleteAccountWarning'],
    ],
  },
];

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

for (const { file, keys } of LOCALES) {
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
    // Any standalone number in deletion copy is read as a retention period.
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
  }
}

if (problems.length > 0) {
  console.error('\n❌ Deletion copy does not match what the purge job does:\n');
  for (const p of problems) console.error(`   ${p}\n`);
  process.exitCode = 1;
} else {
  console.log(
    `✅ Deletion promise consistent: purge ${enabled ? `ENABLED, grace ${graceDays}d` : 'disabled'}, ` +
      `${promised} user-facing string(s) agree.`
  );
}

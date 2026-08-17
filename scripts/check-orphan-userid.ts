/**
 * userId columns without a User @relation do not cascade on hardDelete.
 *
 * Account purge used to leave Memory / AgentConversation / Entity rows behind
 * because they had a bare userId. This gate inventories schema.prisma and
 * fails when a new model grows a userId without a relation, unless it is on
 * the explicit retain allowlist (audit trails).
 *
 * Usage: tsx scripts/check-orphan-userid.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = path.join(ROOT, 'apps/api/prisma/schema.prisma');
const HARD_DELETE = path.join(ROOT, 'apps/api/src/modules/user/user.service.ts');

/** Rows that MUST survive hardDelete. Anything else with a bare userId is a leak. */
const RETAIN_ALLOWLIST = new Set(['AuditLog', 'AgentAuditLog', 'AgentSecurityEvent']);

/**
 * Bare userId models that hardDelete explicitly deleteMany's (no FK).
 * Must match `tx.<prismaDelegate>.deleteMany` in user.service.ts.
 */
const PURGED_IN_HARD_DELETE = new Set([
  'ApplicationAnalysisRun',
  'ApplicationAnalysisExposureRecord',
  'ApplicationAnalysisFeedbackRecord',
  'AgentConversation',
  'Memory',
  'Entity',
  'UserAIPreference',
  'AgentTokenUsage',
  'AgentQuota',
  'MemoryCompaction',
  'AgentTask',
  'ForumLike',
  'CaseSwipe',
  'GraphEntity',
  'EntityRelationship',
]);

function prismaDelegate(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function modelsWithUserId(schema: string): Array<{ name: string; hasUserRelation: boolean }> {
  const parts = schema.split(/^model /m).slice(1);
  const out: Array<{ name: string; hasUserRelation: boolean }> = [];
  for (const part of parts) {
    const name = part.split('{', 1)[0]?.trim().split(/\s+/)[0];
    if (!name) continue;
    const body = part.includes('{') ? part.slice(part.indexOf('{') + 1) : '';
    if (!/^\s+userId\b/m.test(body)) continue;
    const hasUserRelation = /^\s+user\s+User\??\s+/m.test(body);
    out.push({ name, hasUserRelation });
  }
  return out;
}

function main(): void {
  const schema = fs.readFileSync(SCHEMA, 'utf8');
  const hardDeleteSrc = fs.readFileSync(HARD_DELETE, 'utf8');
  const orphans = modelsWithUserId(schema).filter((m) => !m.hasUserRelation);
  const classified = new Set([...RETAIN_ALLOWLIST, ...PURGED_IN_HARD_DELETE]);
  const leaks = orphans.filter((m) => !classified.has(m.name));
  const extraAllow = [...RETAIN_ALLOWLIST].filter((n) => !orphans.some((m) => m.name === n));
  const extraPurged = [...PURGED_IN_HARD_DELETE].filter((n) => !orphans.some((m) => m.name === n));

  const errors: string[] = [];
  for (const m of leaks) {
    errors.push(
      `${m.name} has userId without User @relation and is neither retained nor listed in PURGED_IN_HARD_DELETE. ` +
        `Add the relation with onDelete: Cascade, deleteMany it in UserService.hardDelete and name it in PURGED_IN_HARD_DELETE, ` +
        `or name it in RETAIN_ALLOWLIST with a reason (AuditLog-style).`
    );
  }
  for (const name of extraAllow) {
    errors.push(
      `RETAIN_ALLOWLIST names ${name}, but that model has no bare userId in schema.prisma — allowlist drifted.`
    );
  }
  for (const name of extraPurged) {
    errors.push(
      `PURGED_IN_HARD_DELETE names ${name}, but that model has no bare userId in schema.prisma — list drifted.`
    );
  }
  for (const name of PURGED_IN_HARD_DELETE) {
    const delegate = prismaDelegate(name);
    const needle = `tx.${delegate}.deleteMany`;
    if (!hardDeleteSrc.includes(needle)) {
      errors.push(
        `${name} is listed as purged in hardDelete but ${needle} is missing from user.service.ts.`
      );
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Orphan userId inventory failed:\n');
    for (const e of errors) console.error(`   ${e}\n`);
    process.exit(1);
  }

  console.log(
    `✅ Orphan userId inventory: ${orphans.length} bare userId model(s), ` +
      `${RETAIN_ALLOWLIST.size} retained, ${PURGED_IN_HARD_DELETE.size} explicit hardDelete, 0 leaks.`
  );
}

main();

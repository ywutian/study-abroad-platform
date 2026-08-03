/**
 * G4: user-data-isolation — Detect Prisma queries missing userId filter in AI agent code.
 *
 * Scope: ai-agent/memory/ + ai-agent/core/
 * Severity: error (multi-tenant data isolation guard)
 *
 * A query passes if its context window contains `userId`, OR one of these
 * governance annotations (each documents WHY a direct userId filter is absent):
 *   // governance: userId validated   — raw query whose SQL filters userId
 *   // governance: parent-scoped      — scoped by a user-owned parent entity or
 *                                       a caller that validates userId
 *   // governance: admin-scope        — cross-user by design, endpoint-gated by
 *                                       @Roles(ADMIN)
 *   // governance: system-scope       — global/non-user data (e.g. routing table)
 *   // governance: batch-operation    — system maintenance batch over all users
 *   // governance: public-feed        — user-owned rows the owner published, and
 *                                       the query filters on that publication
 *                                       flag (visibility / isPublic / review
 *                                       status). NOT interchangeable with
 *                                       parent-scoped: the claim is "the owner
 *                                       chose to publish this", not "we checked
 *                                       who is asking". A public-feed query
 *                                       must carry the filter — if the filter
 *                                       goes missing the annotation is a lie,
 *                                       which is exactly how hall's
 *                                       getListById and ranking's findById
 *                                       shipped private rows on @Public()
 *                                       routes (fixed 2026-08-02, 52ebf249).
 *   // governance: aggregate-only    — reads many users' rows but emits only
 *                                       counts or derived statistics, with a
 *                                       de-identified select (no id, no
 *                                       userId, no free text). Use ONLY when
 *                                       the annotation also states the
 *                                       small-sample floor, or says outright
 *                                       that there is none: an aggregate over
 *                                       a thin enough slice re-identifies,
 *                                       and that risk is the whole reason
 *                                       this category is separate from
 *                                       system-scope. Not a licence to skip a
 *                                       visibility filter — say which filters
 *                                       ARE applied.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');

const SCAN_DIRS = [
  // ai-agent/memory + ai-agent/core were the rule's original two entries; the
  // whole module is covered from the eleventh batch below, which subsumes them.
  //
  // Extended 2026-08-02. The rule shipped covering ai-agent only — 58 of the
  // 1,312 Prisma calls in apps/api/src/modules, 4.4%. Every module holding
  // user-owned records was outside it, including vault, which stores
  // AES-256-encrypted credentials. The isolation discipline in those modules
  // is real (verifyOwnership / verifyProfileOwnership / parent-scoped reads);
  // nothing automated was checking it stayed that way.
  //
  // Added in order of what a leak would cost: vault (encrypted credentials),
  // profile (the largest surface — 182 Prisma calls), resume (documents).
  path.join(ROOT, 'apps/api/src/modules/vault'),
  path.join(ROOT, 'apps/api/src/modules/profile'),
  path.join(ROOT, 'apps/api/src/modules/resume'),
  // Second batch. Small enough that every flagged site was read individually
  // before being annotated — that reading is the point, not the annotation.
  path.join(ROOT, 'apps/api/src/modules/timeline'),
  path.join(ROOT, 'apps/api/src/modules/peer-review'),
  path.join(ROOT, 'apps/api/src/modules/school-list'),
  path.join(ROOT, 'apps/api/src/modules/verification'),
  // Third batch. forum's 22 sites are 12 moderation routes behind
  // @Roles(OPERATOR) + CONTENT_MODERATE, 3 board-config reads, and 7 scoped by
  // reporterId/authorId. chat's 14 turned up a real one — see report().
  path.join(ROOT, 'apps/api/src/modules/forum'),
  path.join(ROOT, 'apps/api/src/modules/chat'),
  // Fourth batch. case's 12 are all AdmissionCase and all correctly scoped:
  // 9 on the OPERATOR + CASE_REVIEW admin surface, 3 in findSimilar() behind a
  // visibility+reviewStatus filter — the first use of `public-feed`.
  path.join(ROOT, 'apps/api/src/modules/case'),
  // team's 11: 6 platform competition config, 3 private fetch-or-throw helpers
  // whose callers run ensureTeamRole/ensureTeamMember immediately after, and
  // discover() — which turned out to be steerable to PRIVATE (fixed below).
  path.join(ROOT, 'apps/api/src/modules/team'),
  // essay's 70: 46 are scraped school application questions and scraper
  // bookkeeping (no User relation), 12 on the @Roles(ADMIN) scraper
  // controller, and 12 gallery/counselor reads that spread CASE_PUBLIC_WHERE.
  path.join(ROOT, 'apps/api/src/modules/essay'),
  // essay-debate is a SEPARATE module from essay — easy to miss, and missing
  // it is how the unvalidated debate targets survived this long.
  path.join(ROOT, 'apps/api/src/modules/essay-debate'),
  // Sixth batch — the three small, entirely user-linked modules. 29 sites, no
  // findings: auth resolves every row from verified credentials or a bearer
  // token, user.service is generic building blocks whose controller always
  // passes @CurrentUser().id, and subscription's remaining writes are the
  // HMAC-verified gateway callback plus a read-only OPERATOR surface.
  path.join(ROOT, 'apps/api/src/modules/subscription'),
  path.join(ROOT, 'apps/api/src/modules/auth'),
  path.join(ROOT, 'apps/api/src/modules/user'),
  // Seventh batch — the six small remainders, 15 sites, no findings.
  // settings/recommendation/ai touch only platform tables; health's two are
  // `SELECT 1` probes; points' three are the operator fulfilment queue added
  // in 1cad4be3; ranking's one is the isPublic list beside the findById that
  // was fixed in 52ebf249.
  path.join(ROOT, 'apps/api/src/modules/settings'),
  path.join(ROOT, 'apps/api/src/modules/points'),
  path.join(ROOT, 'apps/api/src/modules/recommendation'),
  path.join(ROOT, 'apps/api/src/modules/health'),
  path.join(ROOT, 'apps/api/src/modules/ai'),
  path.join(ROOT, 'apps/api/src/modules/ranking'),
  // Eighth batch — prediction, 163 sites, no findings. 59 of them are the
  // OPERATOR-gated workflow surface, ~50 are school/CDS/IPEDS platform tables
  // and distillation teachers, the rest are offline sweeps or reads keyed by a
  // profileId the controller resolved from @CurrentUser(). Its historical
  // helpers are the first use of `aggregate-only`.
  path.join(ROOT, 'apps/api/src/modules/prediction'),
  // Ninth batch — admin (118) and school (77), no findings.
  //
  // admin is uniform: all 15 of its controllers carry a class-level
  // @Roles(OPERATOR | ADMIN | SUPER_ADMIN), none has an @Public() route and
  // none widens @Roles on a method, and no admin service is reachable from a
  // controller outside the module except AdminReviewService, which
  // case-admin.controller gates with @Roles(OPERATOR) + CASE_REVIEW. Checked
  // for method-level escapes specifically — a class-level sweep would not
  // have caught one.
  //
  // school is almost entirely published institution data (School,
  // SchoolMetric, HighSchool, media, deadlines, scrapers, IPEDS). Its two
  // exceptions are getSyncStatus (@Roles(ADMIN)) and the nightly high-school
  // calibration, which is aggregate-only with MIN_CASES = 10.
  path.join(ROOT, 'apps/api/src/modules/admin'),
  path.join(ROOT, 'apps/api/src/modules/school'),
  // Tenth batch — hall, the last of the modules known to be outstanding at the
  // time. Held out for six rounds because two of its sites were a product
  // question, not a code defect; see below for what was decided and what
  // deliberately was not.
  path.join(ROOT, 'apps/api/src/modules/hall'),
  // Eleventh batch — the three that the completeness claim had skipped.
  //
  // The list asserted "COVERAGE IS COMPLETE — every module under
  // apps/api/src/modules is scanned" while `assessment` and `notification` had
  // never been added, and `ai-agent` was still pinned to the two
  // subdirectories the rule originally shipped with — so `ai-agent/tools`,
  // `/admin`, `/infrastructure` and `/security` were outside it, which is 76
  // of the module's Prisma calls including the case and school tool surfaces.
  // A hand-maintained list cannot be evidence about itself: the claim is gone
  // and assertCoverage() reconciles the list against the filesystem instead,
  // so omitting a module now fails the rule rather than narrowing it silently.
  path.join(ROOT, 'apps/api/src/modules/assessment'),
  path.join(ROOT, 'apps/api/src/modules/notification'),
  path.join(ROOT, 'apps/api/src/modules/ai-agent'),
  //
  // hall's two dashboard endpoints were the last open item. They compose
  // VERIFIED_CASE_WHERE, which filters isVerified + approved review but NOT
  // `visibility`, on @Public() routes. Two separable questions were tangled
  // there, and only one of them was mine to answer:
  //
  //   1. May a PRIVATE case feed a public aggregate at all? A product call.
  //      hall.constants.ts documents the omission as deliberate. UNCHANGED —
  //      still yes, still needs an owner's decision if that is wrong.
  //   2. May that aggregate be thin enough to identify one person? A security
  //      question with an answer already in this codebase, twice: school's
  //      high-school calibration floors at MIN_CASES = 10, prediction's
  //      getCaseComparison at 5 admits / 3 rejects. hall floored its derived
  //      LABELS (MIN_YEAR_TOTAL for the difficulty signal, 5 for edTilt) while
  //      publishing the raw counts they came from at any size — so a
  //      `{ admitted: 1, total: 1 }` cell named one person's outcome to an
  //      unauthenticated visitor. FIXED: the same floors now suppress the data,
  //      not just its caption.
  //
  // The lesson worth keeping: a reliability GRADE is not a control. hall
  // already labelled small samples 'C' and shipped the exact numbers anyway.
];

// Prisma query methods that should include userId filtering
const PRISMA_METHODS = [
  'findMany',
  'findFirst',
  'findUnique',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'create',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
  'count',
  'aggregate',
];

const PRISMA_PATTERN = new RegExp(`this\\.prisma\\.\\w+\\.(${PRISMA_METHODS.join('|')})\\(`);

/**
 * The isolation primitives this codebase actually uses.
 *
 * The rule was written against ai-agent, where scoping is a literal `userId`
 * in the where-clause. Domain modules do it differently: fetch by id, include
 * the owner, then assert through a shared helper —
 *
 *   this.auth.verifyOwnership(
 *     await this.prisma.vaultItem.findUnique({ where: { id: itemId } }),
 *     userId, …);
 *
 * — and the assertion often sits well outside a ±10-line window from the query
 * it protects (vault.service.ts:138 verifies ~20 lines earlier, then updates).
 * Matching on a fixed line window reported those as leaks, which is how a gate
 * teaches people to annotate their way past it. Scope the search to the
 * enclosing method instead, and count the three helpers as scoping evidence.
 */
const OWNERSHIP_HELPERS = ['verifyOwnership', 'verifyProfileOwnership', 'verifyNestedOwnership'];

/**
 * Body of the class method containing `lineIndex`, found by brace matching
 * from the nearest preceding method signature. Falls back to a wide window
 * when no enclosing method is found (top-level code, odd formatting).
 */
function enclosingMethod(lines: string[], lineIndex: number): string {
  const SIG = /^ {2}(?:public |private |protected )?(?:async )?[a-zA-Z_]\w*\s*\(/;
  let start = -1;
  for (let i = lineIndex; i >= 0; i--) {
    if (SIG.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    return lines.slice(Math.max(0, lineIndex - 20), lineIndex + 20).join('\n');
  }
  let depth = 0;
  let started = false;
  let end = start;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        depth++;
        started = true;
      } else if (ch === '}') depth--;
    }
    end = i;
    if (started && depth === 0) break;
  }
  // If the query is somehow past the matched method, fall back to a window.
  if (lineIndex > end) {
    return lines.slice(Math.max(0, lineIndex - 20), lineIndex + 20).join('\n');
  }
  return lines.slice(start, end + 1).join('\n');
}

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      results.push(...getAllTsFiles(fullPath));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.e2e-spec.ts')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

const MODULES_ROOT = path.join(ROOT, 'apps/api/src/modules');

/**
 * Reconcile SCAN_DIRS against the filesystem.
 *
 * The list above spent several rounds asserting "COVERAGE IS COMPLETE — every
 * module under apps/api/src/modules is scanned" while three were missing:
 * `assessment` and `notification` had never been added, and `ai-agent` was
 * pinned to the two subdirectories the rule originally shipped with. A
 * hand-maintained list is not evidence about itself, and the claim was the
 * only thing standing between a reviewer and that gap.
 *
 * So the completeness claim is computed now, not written. Adding a module
 * without adding it here fails the rule rather than silently narrowing it.
 */
function assertCoverage(): GovernanceIssue[] {
  if (!fs.existsSync(MODULES_ROOT)) return [];

  const covered = new Set(
    SCAN_DIRS.filter((d) => path.dirname(d) === MODULES_ROOT).map((d) => path.basename(d))
  );

  return fs
    .readdirSync(MODULES_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !covered.has(e.name))
    .map((e) => ({
      rule: 'user-data-isolation',
      severity: 'error' as const,
      file: 'scripts/governance/rules/user-data-isolation.ts',
      line: 1,
      message:
        `Module "${e.name}" is not in SCAN_DIRS, so none of its Prisma calls are ` +
        `checked for user scoping. Add it (whole module, not a subdirectory) and ` +
        `read what it flags — the reading is the point, not the annotation.`,
    }));
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = assertCoverage();

  for (const dir of SCAN_DIRS) {
    for (const filePath of getAllTsFiles(dir)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comment-only lines (JSDoc, inline comments)
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          continue;
        }

        // Check for Prisma ORM calls
        if (PRISMA_PATTERN.test(line)) {
          // Scope to the enclosing method, not a fixed line window — see the
          // note on OWNERSHIP_HELPERS for why ±10 lines gave false leaks.
          const contextWindow = enclosingMethod(lines, i);
          if (
            !contextWindow.includes('userId') &&
            !OWNERSHIP_HELPERS.some((h) => contextWindow.includes(h)) &&
            !contextWindow.includes('// governance: batch-operation') &&
            !contextWindow.includes('// governance: system-scope') &&
            !contextWindow.includes('// governance: parent-scoped') &&
            !contextWindow.includes('// governance: admin-scope') &&
            !contextWindow.includes('// governance: public-feed') &&
            !contextWindow.includes('// governance: aggregate-only')
          ) {
            issues.push({
              rule: 'user-data-isolation',
              severity: 'error',
              message: `Prisma query without userId filter — potential multi-tenant data leak`,
              file: filePath,
              line: i + 1,
            });
          }
        }

        // Check for raw queries without userId governance comment.
        // Method-scoped for the same reason as the branch above, and more so
        // here: a tagged-template SQL block routinely runs 20+ lines, so a
        // ±5-line window could not even see the whole statement it was
        // judging. chat.service.ts's unread-count query filters on
        // `"senderId" != ${userId}` seven lines below the `$queryRaw`, and was
        // reported as unscoped.
        if (line.includes('$queryRaw') || line.includes('$executeRaw')) {
          const contextWindow = enclosingMethod(lines, i);
          if (
            !contextWindow.includes('userId') &&
            !contextWindow.includes('// governance: userId validated') &&
            !contextWindow.includes('// governance: batch-operation') &&
            !contextWindow.includes('// governance: system-scope') &&
            !contextWindow.includes('// governance: parent-scoped') &&
            !contextWindow.includes('// governance: admin-scope') &&
            !contextWindow.includes('// governance: public-feed') &&
            !contextWindow.includes('// governance: aggregate-only')
          ) {
            issues.push({
              rule: 'user-data-isolation',
              severity: 'error',
              message: `Raw query without userId filter or governance annotation`,
              file: filePath,
              line: i + 1,
            });
          }
        }
      }
    }
  }

  return issues;
}

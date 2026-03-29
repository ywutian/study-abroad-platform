/**
 * Governance CLI — Architecture rule enforcement for AI Agent module.
 *
 * Usage:
 *   npx tsx scripts/governance/index.ts --rule=optional-security
 *   npx tsx scripts/governance/index.ts --rules=optional-security,nl-endpoint-coverage
 *   npx tsx scripts/governance/index.ts --all
 *   npx tsx scripts/governance/index.ts --all --json
 *   npx tsx scripts/governance/index.ts --verify-project
 *
 * --json mode: stdout is a single JSON line, all other output goes to stderr.
 */

import type { GovernanceRuleId, GovernanceIssue, GovernanceResult, GovernanceRule } from './types';

import { run as optionalSecurity } from './rules/optional-security';
import { run as nlEndpointCoverage } from './rules/nl-endpoint-coverage';
import { run as configConsistency } from './rules/config-consistency';
import { run as userDataIsolation } from './rules/user-data-isolation';
import { run as deadProvider } from './rules/dead-provider';
import { run as sensitiveEndpointThrottle } from './rules/sensitive-endpoint-throttle';
import { run as controllerAuthCoverage } from './rules/controller-auth-coverage';
import { run as dtoValidationCompleteness } from './rules/dto-validation-completeness';

// ── Rule registry ──────────────────────────────────────────

const RULES: GovernanceRule[] = [
  { id: 'optional-security', run: optionalSecurity },
  { id: 'nl-endpoint-coverage', run: nlEndpointCoverage },
  { id: 'config-consistency', run: configConsistency },
  { id: 'user-data-isolation', run: userDataIsolation },
  { id: 'dead-provider', run: deadProvider },
  { id: 'sensitive-endpoint-throttle', run: sensitiveEndpointThrottle },
  { id: 'controller-auth-coverage', run: controllerAuthCoverage },
  { id: 'dto-validation-completeness', run: dtoValidationCompleteness },
];

const ALL_RULE_IDS = RULES.map((r) => r.id);

// ── CLI parsing ────────────────────────────────────────────

interface Options {
  rules: Set<GovernanceRuleId>;
  json: boolean;
  verifyProject: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const verifyProject = args.includes('--verify-project');
  let rules = new Set<GovernanceRuleId>();

  for (const arg of args) {
    if (arg.startsWith('--rule=')) {
      const id = arg.slice(7) as GovernanceRuleId;
      if (ALL_RULE_IDS.includes(id)) rules.add(id);
    }
    if (arg.startsWith('--rules=')) {
      const ids = arg.slice(8).split(',') as GovernanceRuleId[];
      for (const id of ids) {
        if (ALL_RULE_IDS.includes(id)) rules.add(id);
      }
    }
    if (arg === '--all') {
      rules = new Set(ALL_RULE_IDS);
    }
  }

  if (rules.size === 0 && !verifyProject) {
    rules = new Set(ALL_RULE_IDS);
  }

  return { rules, json, verifyProject };
}

// ── Verify project command ──────────────────────────────────

function handleVerifyProject(): void {
  const { createGovernanceProject } = require('./helpers/ts-morph-project');
  const project = createGovernanceProject();
  const files = project.getSourceFiles();
  const specs = files.filter((f: any) => f.getFilePath().includes('.spec.'));
  console.log(`Source files: ${files.length}`);
  console.log(`Spec file leaks: ${specs.length}`);
  if (specs.length > 0) {
    console.error('FAIL: spec files found in governance project');
    process.exit(1);
  }
  console.log('OK: no spec files in governance project');
}

// ── Output formatting ──────────────────────────────────────

const COLORS = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function printHuman(result: GovernanceResult): void {
  const { issues, summary } = result;

  if (issues.length === 0) {
    console.error(`${COLORS.green}✓ No governance issues found${COLORS.reset}`);
    return;
  }

  for (const issue of issues) {
    const color =
      issue.severity === 'error'
        ? COLORS.red
        : issue.severity === 'warning'
          ? COLORS.yellow
          : COLORS.gray;
    const loc = issue.file ? ` ${issue.file}${issue.line ? `:${issue.line}` : ''}` : '';
    console.error(
      `${color}[${issue.severity.toUpperCase()}]${COLORS.reset} [${issue.rule}]${loc}: ${issue.message}`
    );
  }

  console.error(
    `\n${COLORS.bold}Summary:${COLORS.reset} ${COLORS.red}${summary.errors} error(s)${COLORS.reset}, ${COLORS.yellow}${summary.warnings} warning(s)${COLORS.reset}, ${COLORS.gray}${summary.infos} info(s)${COLORS.reset}`
  );
}

// ── Main ───────────────────────────────────────────────────

function main(): void {
  const options = parseArgs();

  if (options.verifyProject) {
    handleVerifyProject();
    return;
  }

  const allIssues: GovernanceIssue[] = [];

  for (const rule of RULES) {
    if (!options.rules.has(rule.id)) continue;

    try {
      if (!options.json) {
        console.error(`Running rule: ${rule.id}...`);
      }
      const issues = rule.run();
      allIssues.push(...issues);
    } catch (err) {
      console.error(`Error running rule '${rule.id}':`, err);
    }
  }

  const summary = {
    errors: allIssues.filter((i) => i.severity === 'error').length,
    warnings: allIssues.filter((i) => i.severity === 'warning').length,
    infos: allIssues.filter((i) => i.severity === 'info').length,
  };

  const result: GovernanceResult = { issues: allIssues, summary };

  if (options.json) {
    // --json mode: stdout is ONLY the JSON, everything else on stderr
    console.log(JSON.stringify(result));
  } else {
    printHuman(result);
  }

  if (summary.errors > 0) {
    process.exit(1);
  }
}

main();

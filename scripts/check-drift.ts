/**
 * Documentation & architecture drift checker.
 * Verifies BRIEF.md accuracy, rules glob coverage, CLAUDE.md consistency,
 * and module boundary integrity.
 *
 * 5 rules across 3 domains:
 *   A. Documentation (brief-accuracy, claude-md-consistency)
 *   B. Rules (rules-glob-coverage)
 *   C. Architecture (module-boundary, coverage-trend)
 *
 * Usage:
 *   npx tsx scripts/check-drift.ts                        # All rules
 *   npx tsx scripts/check-drift.ts --domain=docs          # Documentation only
 *   npx tsx scripts/check-drift.ts --domain=rules         # Rules only
 *   npx tsx scripts/check-drift.ts --domain=arch          # Architecture only
 *   npx tsx scripts/check-drift.ts --verbose              # Include INFO-level
 *   npx tsx scripts/check-drift.ts --json                 # JSON output for CI
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Config ──────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const CLAUDE_MD = path.resolve(ROOT, 'CLAUDE.md');
const AGENTS_DIR = path.resolve(ROOT, '.claude/agents');
const SKILLS_DIR = path.resolve(ROOT, '.claude/skills');
const RULES_DIR = path.resolve(ROOT, '.claude/rules');
const API_MODULES_DIR = path.resolve(ROOT, 'apps/api/src/modules');
const WEB_FEATURES_DIR = path.resolve(ROOT, 'apps/web/src/components/features');

type Severity = 'error' | 'warning' | 'info';

interface Issue {
  rule: string;
  severity: Severity;
  file: string;
  message: string;
}

type RuleName =
  | 'brief-accuracy'
  | 'claude-md-consistency'
  | 'rules-glob-coverage'
  | 'module-boundary'
  | 'coverage-trend'
  | 'manifest-consistency';

const DOMAINS: Record<string, RuleName[]> = {
  docs: ['brief-accuracy', 'claude-md-consistency', 'manifest-consistency'],
  rules: ['rules-glob-coverage'],
  arch: ['module-boundary', 'coverage-trend'],
};

const ALL_RULES: RuleName[] = Object.values(DOMAINS).flat();

// ── CLI Parsing ─────────────────────────────────────────────

interface Options {
  only: Set<RuleName>;
  verbose: boolean;
  json: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let only = new Set<RuleName>();
  const verbose = args.includes('--verbose');
  const json = args.includes('--json');

  for (const arg of args) {
    if (arg.startsWith('--only=')) {
      const names = arg.slice(7).split(',') as RuleName[];
      only = new Set(names.filter((n) => ALL_RULES.includes(n)));
    }
    if (arg.startsWith('--domain=')) {
      const domains = arg.slice(9).split(',');
      for (const d of domains) {
        if (DOMAINS[d]) {
          for (const r of DOMAINS[d]) only.add(r);
        }
      }
    }
  }

  if (only.size === 0) only = new Set(ALL_RULES);
  return { only, verbose, json };
}

// ── Helpers ─────────────────────────────────────────────────

function readFile(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function rel(filePath: string): string {
  return path.relative(ROOT, filePath);
}

function getDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name);
}

function getFilesRecursive(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.next', '__tests__', '__mocks__', 'test'].includes(entry.name))
        continue;
      results.push(...getFilesRecursive(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Rule 1: brief-accuracy ─────────────────────────────────
// Check that BRIEF.md files reference files that actually exist

function checkBriefAccuracy(): Issue[] {
  const issues: Issue[] = [];

  const checkBriefDir = (baseDir: string, label: string) => {
    const modules = getDirs(baseDir);
    for (const mod of modules) {
      const briefPath = path.join(baseDir, mod, 'BRIEF.md');
      if (!fs.existsSync(briefPath)) {
        issues.push({
          rule: 'brief-accuracy',
          severity: 'warning',
          file: `${label}/${mod}/`,
          message: `Missing BRIEF.md`,
        });
        continue;
      }

      const content = readFile(briefPath);
      const modDir = path.join(baseDir, mod);
      const actualFiles = getFiles(modDir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

      // Check if BRIEF.md mentions files that don't exist
      const fileRefs = content.match(/`([a-z][\w.-]+\.(?:ts|tsx))`/g) || [];
      for (const ref of fileRefs) {
        const fileName = ref.replace(/`/g, '');
        // Check in module dir and dto/ subdir
        const existsInRoot = fs.existsSync(path.join(modDir, fileName));
        const existsInDto = fs.existsSync(path.join(modDir, 'dto', fileName));
        const existsInSubdirs = getDirs(modDir).some((sub) =>
          fs.existsSync(path.join(modDir, sub, fileName))
        );

        if (!existsInRoot && !existsInDto && !existsInSubdirs) {
          issues.push({
            rule: 'brief-accuracy',
            severity: 'warning',
            file: rel(briefPath),
            message: `References \`${fileName}\` but file not found in module`,
          });
        }
      }

      // Check for significant .ts files not mentioned in BRIEF
      const significantFiles = actualFiles.filter(
        (f) =>
          !f.endsWith('.spec.ts') &&
          !f.endsWith('.test.ts') &&
          f !== 'index.ts' &&
          !content.includes(f)
      );
      if (significantFiles.length > 3) {
        issues.push({
          rule: 'brief-accuracy',
          severity: 'info',
          file: rel(briefPath),
          message: `${significantFiles.length} .ts files not mentioned: ${significantFiles.slice(0, 3).join(', ')}...`,
        });
      }
    }
  };

  checkBriefDir(API_MODULES_DIR, 'apps/api/src/modules');
  checkBriefDir(WEB_FEATURES_DIR, 'apps/web/src/components/features');

  return issues;
}

// ── Rule 2: claude-md-consistency ──────────────────────────
// Verify CLAUDE.md references match actual files

function checkClaudeMdConsistency(): Issue[] {
  const issues: Issue[] = [];
  const content = readFile(CLAUDE_MD);

  // Check agent table matches actual agent files
  const agentFiles = fs.existsSync(AGENTS_DIR)
    ? getFiles(AGENTS_DIR).filter((f) => f.endsWith('.md'))
    : [];
  const agentTableRows = (content.match(/\| \d+\s+\|/g) || []).length;

  if (agentFiles.length !== agentTableRows) {
    issues.push({
      rule: 'claude-md-consistency',
      severity: 'error',
      file: 'CLAUDE.md',
      message: `Agent table has ${agentTableRows} rows but .claude/agents/ has ${agentFiles.length} files`,
    });
  }

  // Check rules index matches actual rule files
  const ruleFiles = fs.existsSync(RULES_DIR)
    ? getFiles(RULES_DIR).filter((f) => f.endsWith('.md'))
    : [];
  const ruleTableRows = (content.match(/`[a-z-]+\.md`\s+\|/g) || []).length;

  if (ruleFiles.length !== ruleTableRows) {
    issues.push({
      rule: 'claude-md-consistency',
      severity: 'error',
      file: 'CLAUDE.md',
      message: `Rules Index has ${ruleTableRows} rows but .claude/rules/ has ${ruleFiles.length} files`,
    });
  }

  // Check skills index matches actual skill files.
  // A skill that exists on disk but is missing from CLAUDE.md is effectively invisible —
  // this is the "registered in one place but not the place that makes it discoverable" class.
  const skillFiles = fs.existsSync(SKILLS_DIR)
    ? getFiles(SKILLS_DIR).filter((f) => f.endsWith('.md'))
    : [];
  const skillTableRows = (content.match(/\| `\/[a-z-]+`\s+\|/g) || []).length;

  if (skillFiles.length !== skillTableRows) {
    issues.push({
      rule: 'claude-md-consistency',
      severity: 'error',
      file: 'CLAUDE.md',
      message: `Skills table has ${skillTableRows} rows but .claude/skills/ has ${skillFiles.length} files`,
    });
  }

  // The prose count above the table ("N skills covering …") drifts silently otherwise.
  const proseCount = content.match(/^(\d+) skills covering/m);
  if (proseCount && Number(proseCount[1]) !== skillFiles.length) {
    issues.push({
      rule: 'claude-md-consistency',
      severity: 'error',
      file: 'CLAUDE.md',
      message: `Prose says "${proseCount[1]} skills" but .claude/skills/ has ${skillFiles.length} files`,
    });
  }

  // Check Context Routing doc paths exist (skip glob patterns with *)
  const docRefs = content.match(/`docs\/[^`]+`/g) || [];
  for (const ref of docRefs) {
    const docPath = ref.replace(/`/g, '');
    if (docPath.includes('*')) continue; // Skip glob patterns
    if (!fs.existsSync(path.resolve(ROOT, docPath))) {
      issues.push({
        rule: 'claude-md-consistency',
        severity: 'warning',
        file: 'CLAUDE.md',
        message: `Context Routing references \`${docPath}\` but file not found`,
      });
    }
  }

  return issues;
}

// ── Rule 3: rules-glob-coverage ────────────────────────────
// Verify rule files' glob patterns match existing directories

function checkRulesGlobCoverage(): Issue[] {
  const issues: Issue[] = [];

  const EXPECTED_GLOBS: Record<string, string[]> = {
    'backend.md': ['apps/api'],
    'frontend.md': ['apps/web'],
    'mobile.md': ['apps/mobile'],
    'ai-system.md': ['apps/api/src/modules/ai-agent', 'apps/api/src/modules/prediction'],
    'security.md': ['apps/api/src/modules/auth', 'apps/api/src/common/guards'],
    'testing.md': [], // Matches *.spec.ts — no dir to check
    'ci-cd.md': ['.github', '.husky'],
  };

  for (const [ruleFile, dirs] of Object.entries(EXPECTED_GLOBS)) {
    const rulePath = path.join(RULES_DIR, ruleFile);
    if (!fs.existsSync(rulePath)) {
      issues.push({
        rule: 'rules-glob-coverage',
        severity: 'error',
        file: `.claude/rules/${ruleFile}`,
        message: `Rule file expected but not found`,
      });
      continue;
    }

    for (const dir of dirs) {
      const fullDir = path.resolve(ROOT, dir);
      if (!fs.existsSync(fullDir)) {
        issues.push({
          rule: 'rules-glob-coverage',
          severity: 'warning',
          file: `.claude/rules/${ruleFile}`,
          message: `Glob target directory \`${dir}\` does not exist`,
        });
      }
    }
  }

  // Check for backend modules with ai/prediction/auth that might need rule coverage
  const aiRelatedModules = ['ai-agent', 'ai', 'prediction', 'essay'];
  const authRelatedModules = ['auth', 'vault'];
  const aiRuleContent = readFile(path.join(RULES_DIR, 'ai-system.md'));
  const securityRuleContent = readFile(path.join(RULES_DIR, 'security.md'));

  for (const mod of aiRelatedModules) {
    if (fs.existsSync(path.join(API_MODULES_DIR, mod)) && !aiRuleContent.includes(mod)) {
      issues.push({
        rule: 'rules-glob-coverage',
        severity: 'info',
        file: '.claude/rules/ai-system.md',
        message: `Module \`${mod}\` exists but is not referenced in ai-system rules`,
      });
    }
  }

  for (const mod of authRelatedModules) {
    if (fs.existsSync(path.join(API_MODULES_DIR, mod)) && !securityRuleContent.includes(mod)) {
      issues.push({
        rule: 'rules-glob-coverage',
        severity: 'info',
        file: '.claude/rules/security.md',
        message: `Module \`${mod}\` exists but is not referenced in security rules`,
      });
    }
  }

  return issues;
}

// ── Rule 4: module-boundary ────────────────────────────────
// Check for cross-module imports that bypass module system

function checkModuleBoundary(): Issue[] {
  const issues: Issue[] = [];
  const modules = getDirs(API_MODULES_DIR);

  for (const mod of modules) {
    const modDir = path.join(API_MODULES_DIR, mod);
    const files = getFilesRecursive(modDir);

    for (const file of files) {
      if (file.endsWith('.spec.ts') || file.endsWith('.test.ts')) continue;

      const content = readFile(file);
      const importLines =
        content.match(/import\s+.*from\s+['"](\.\.\/\.\.\/modules\/[^'"]+)['"]/g) || [];

      for (const imp of importLines) {
        const match = imp.match(/from\s+['"]\.\.\/\.\.\/modules\/([^/'"]+)/);
        if (match) {
          const importedModule = match[1];
          // Check if it's importing internal files (not the barrel export)
          const fullImportMatch = imp.match(/from\s+['"](\.\.\/\.\.\/modules\/[^'"]+)['"]/);
          if (fullImportMatch) {
            const importPath = fullImportMatch[1];
            // Importing from a specific file inside another module (not just the module root)
            const segments = importPath.replace('../../modules/', '').split('/');
            if (
              segments.length > 2 &&
              !importPath.endsWith('.module') &&
              !importPath.includes('/dto/')
            ) {
              issues.push({
                rule: 'module-boundary',
                severity: 'warning',
                file: rel(file),
                message: `Deep import into \`${importedModule}\` module: \`${importPath}\` — consider importing via module barrel`,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}

// ── Rule 5: coverage-trend ─────────────────────────────────
// Check that test files exist for services (lightweight coverage proxy)

function checkCoverageTrend(): Issue[] {
  const issues: Issue[] = [];
  const modules = getDirs(API_MODULES_DIR);

  let totalServices = 0;
  let testedServices = 0;

  for (const mod of modules) {
    const modDir = path.join(API_MODULES_DIR, mod);
    const files = getFiles(modDir);

    const serviceFiles = files.filter((f) => f.endsWith('.service.ts') && !f.endsWith('.spec.ts'));

    for (const svc of serviceFiles) {
      totalServices++;
      const specName = svc.replace('.ts', '.spec.ts');
      if (files.includes(specName)) {
        testedServices++;
      } else {
        issues.push({
          rule: 'coverage-trend',
          severity: 'info',
          file: `apps/api/src/modules/${mod}/${svc}`,
          message: `Service missing test file \`${specName}\``,
        });
      }
    }
  }

  // Report coverage ratio
  if (totalServices > 0) {
    const ratio = Math.round((testedServices / totalServices) * 100);
    if (ratio < 50) {
      issues.push({
        rule: 'coverage-trend',
        severity: 'warning',
        file: 'apps/api/src/modules/',
        message: `Service test coverage: ${testedServices}/${totalServices} (${ratio}%) — below 50% threshold`,
      });
    }
  }

  return issues;
}

// ── Rule 6: manifest-consistency ───────────────────────────
// Verify .claude/manifests/agent-workflow.yml is in sync with actual agent files

function checkManifestConsistency(): Issue[] {
  const issues: Issue[] = [];
  const manifestPath = path.resolve(ROOT, '.claude/manifests/agent-workflow.yml');

  if (!fs.existsSync(manifestPath)) {
    issues.push({
      rule: 'manifest-consistency',
      severity: 'error',
      file: '.claude/manifests/agent-workflow.yml',
      message: 'Manifest file missing — required by CLAUDE.md and skills',
    });
    return issues;
  }

  const manifest = readFile(manifestPath);

  // Extract agent IDs from manifest (`  - id: name`)
  const manifestAgentIds = new Set<string>();
  const idMatches = manifest.match(/^\s*-\s*id:\s*([a-z0-9-]+)/gm) || [];
  for (const m of idMatches) {
    const id = m.replace(/.*id:\s*/, '').trim();
    manifestAgentIds.add(id);
  }

  // Get actual agent file names (without .md extension)
  const actualAgentIds = new Set<string>();
  if (fs.existsSync(AGENTS_DIR)) {
    for (const f of getFiles(AGENTS_DIR)) {
      if (f.endsWith('.md')) {
        actualAgentIds.add(f.replace('.md', ''));
      }
    }
  }

  // Find agents in manifest but not on disk
  for (const id of manifestAgentIds) {
    if (!actualAgentIds.has(id)) {
      issues.push({
        rule: 'manifest-consistency',
        severity: 'error',
        file: '.claude/manifests/agent-workflow.yml',
        message: `Manifest references agent \`${id}\` but \`.claude/agents/${id}.md\` does not exist`,
      });
    }
  }

  // Find agents on disk but not in manifest
  for (const id of actualAgentIds) {
    if (!manifestAgentIds.has(id)) {
      issues.push({
        rule: 'manifest-consistency',
        severity: 'warning',
        file: `.claude/agents/${id}.md`,
        message: `Agent file exists but not declared in manifest \`.claude/manifests/agent-workflow.yml\``,
      });
    }
  }

  // Verify key sections exist
  const requiredSections = ['severity:', 'agents:', 'selection:', 'acceptance:'];
  for (const section of requiredSections) {
    if (!manifest.includes(section)) {
      issues.push({
        rule: 'manifest-consistency',
        severity: 'error',
        file: '.claude/manifests/agent-workflow.yml',
        message: `Missing required section: \`${section}\``,
      });
    }
  }

  return issues;
}

// ── Runner ──────────────────────────────────────────────────

const RULE_RUNNERS: Record<RuleName, () => Issue[]> = {
  'brief-accuracy': checkBriefAccuracy,
  'claude-md-consistency': checkClaudeMdConsistency,
  'rules-glob-coverage': checkRulesGlobCoverage,
  'module-boundary': checkModuleBoundary,
  'coverage-trend': checkCoverageTrend,
  'manifest-consistency': checkManifestConsistency,
};

function main() {
  const opts = parseArgs();
  const allIssues: Issue[] = [];

  for (const rule of opts.only) {
    const runner = RULE_RUNNERS[rule];
    if (!runner) {
      console.error(`Unknown rule: ${rule}`);
      continue;
    }
    const ruleIssues = runner();
    allIssues.push(...ruleIssues);
  }

  // Filter by verbosity
  const filtered = opts.verbose ? allIssues : allIssues.filter((i) => i.severity !== 'info');

  if (opts.json) {
    console.log(JSON.stringify({ issues: filtered, total: filtered.length }, null, 2));
    return;
  }

  // Print results
  const errors = filtered.filter((i) => i.severity === 'error');
  const warnings = filtered.filter((i) => i.severity === 'warning');
  const infos = filtered.filter((i) => i.severity === 'info');

  console.log('\n📋 Drift Check Report');
  console.log('═'.repeat(60));

  if (errors.length > 0) {
    console.log(`\n❌ ERRORS (${errors.length}):`);
    for (const e of errors) {
      console.log(`  [${e.rule}] ${e.file}: ${e.message}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`  [${w.rule}] ${w.file}: ${w.message}`);
    }
  }

  if (opts.verbose && infos.length > 0) {
    console.log(`\nℹ️  INFO (${infos.length}):`);
    for (const i of infos) {
      console.log(`  [${i.rule}] ${i.file}: ${i.message}`);
    }
  }

  const total = errors.length + warnings.length + (opts.verbose ? infos.length : 0);
  if (total === 0) {
    console.log('\n✅ No drift detected');
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(
    `Rules checked: ${opts.only.size} | Errors: ${errors.length} | Warnings: ${warnings.length}${opts.verbose ? ` | Info: ${infos.length}` : ''}`
  );

  // Exit with error code if there are errors
  if (errors.length > 0) {
    process.exit(1);
  }
}

main();

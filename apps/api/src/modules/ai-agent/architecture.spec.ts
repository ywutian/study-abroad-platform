/**
 * Architecture Governance Jest Tests
 *
 * Single source of truth: scripts/governance/ rules engine.
 * This spec calls the governance CLI via execSync and asserts 0 error-level issues.
 *
 * Error-level rules tested:
 *   - optional-security (G1): No @Optional on security-critical services
 *   - nl-endpoint-coverage (G2): All NL endpoints covered by security middleware
 *   - config-consistency (G3): No direct AGENT_CONFIGS reads outside validator
 *
 * Warning-level rules (G4, G5) are not asserted here.
 * aiSecurity health check assertion will be added in Batch 4.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Derive repo root from spec file location (5 levels up)
const REPO_ROOT = path.resolve(__dirname, '../../../../..');

// Validate repo root using monorepo marker file
const workspaceFile = path.join(REPO_ROOT, 'pnpm-workspace.yaml');
if (!fs.existsSync(workspaceFile)) {
  throw new Error(
    `REPO_ROOT validation failed: ${workspaceFile} not found. ` +
      `Resolved REPO_ROOT: ${REPO_ROOT}`,
  );
}

interface GovernanceResult {
  issues: Array<{
    rule: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    file?: string;
    line?: number;
  }>;
  summary: { errors: number; warnings: number; infos: number };
}

/**
 * Run governance rules via CLI.
 * Uses --json mode: stdout is pure JSON, stderr is inherited (transparent logs).
 */
function runGovernance(rules: string): GovernanceResult {
  try {
    const output = execSync(
      `npx tsx scripts/governance/index.ts --rules=${rules} --json`,
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'inherit'],
      },
    );
    return JSON.parse(output);
  } catch (err: any) {
    // CLI exits with code 1 when errors found, but still outputs JSON on stdout
    if (err.stdout) {
      return JSON.parse(err.stdout);
    }
    throw err;
  }
}

describe('Architecture Governance', () => {
  // Run all error-level rules in a single CLI call to reduce subprocess overhead (~2s)
  let result: GovernanceResult;

  beforeAll(() => {
    result = runGovernance(
      'optional-security,nl-endpoint-coverage,config-consistency',
    );
  });

  it('no @Optional on security-critical services (G1)', () => {
    const errors = result.issues.filter(
      (i) => i.rule === 'optional-security' && i.severity === 'error',
    );
    expect(errors).toEqual([]);
  });

  it('all NL endpoints covered by security middleware (G2)', () => {
    const errors = result.issues.filter(
      (i) => i.rule === 'nl-endpoint-coverage' && i.severity === 'error',
    );
    expect(errors).toEqual([]);
  });

  it('no direct AGENT_CONFIGS reads outside validator (G3)', () => {
    const errors = result.issues.filter(
      (i) => i.rule === 'config-consistency' && i.severity === 'error',
    );
    expect(errors).toEqual([]);
  });

  // Health endpoint contract assertion (Batch 4)
  it('health controller includes aiSecurity check', () => {
    const healthControllerPath = path.join(
      REPO_ROOT,
      'apps/api/src/modules/health/health.controller.ts',
    );
    const content = fs.readFileSync(healthControllerPath, 'utf-8');
    expect(content).toContain('aiSecurity');
  });
});

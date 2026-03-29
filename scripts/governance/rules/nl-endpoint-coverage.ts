/**
 * G2: nl-endpoint-coverage — Verify all NL endpoints are covered by security middleware/guards.
 *
 * HTTP: route must appear in AgentSecurityMiddleware.forRoutes(...)
 * WebSocket: gateway handler's security service must not be @Optional()
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyntaxKind } from 'ts-morph';
import { createGovernanceProject } from '../helpers/ts-morph-project';
import type { GovernanceIssue } from '../types';

const ROOT = path.resolve(__dirname, '../../..');

interface NlEndpointsConfig {
  http: Array<{ route: string; method: string; description: string }>;
  websocket: Array<{
    gateway: string;
    handler: string;
    securityService: string;
    description: string;
  }>;
}

export function run(): GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];

  // Load endpoint manifest
  const configPath = path.join(__dirname, '..', 'nl-endpoints.json');
  const config: NlEndpointsConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // ── HTTP: check forRoutes coverage ──
  const modulePath = path.join(ROOT, 'apps/api/src/modules/ai-agent/ai-agent.module.ts');
  const moduleContent = fs.readFileSync(modulePath, 'utf-8');

  for (const endpoint of config.http) {
    // Check if the route appears in a forRoutes() call with AgentSecurityMiddleware
    const routePattern = new RegExp(
      `AgentSecurityMiddleware[\\s\\S]*?\\.forRoutes\\([^)]*['"]${endpoint.route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`
    );
    if (!routePattern.test(moduleContent)) {
      issues.push({
        rule: 'nl-endpoint-coverage',
        severity: 'error',
        message: `HTTP NL endpoint '${endpoint.route}' (${endpoint.method}) not covered by AgentSecurityMiddleware.forRoutes()`,
        file: modulePath,
      });
    }
  }

  // ── WebSocket: check gateway constructor for non-Optional security service ──
  const project = createGovernanceProject();

  for (const wsEndpoint of config.websocket) {
    const gatewayFile = project
      .getSourceFiles()
      .find((sf) => sf.getClasses().some((c) => c.getName() === wsEndpoint.gateway));

    if (!gatewayFile) {
      issues.push({
        rule: 'nl-endpoint-coverage',
        severity: 'error',
        message: `WebSocket gateway class '${wsEndpoint.gateway}' not found`,
      });
      continue;
    }

    const gatewayCls = gatewayFile.getClasses().find((c) => c.getName() === wsEndpoint.gateway);
    if (!gatewayCls) continue;

    for (const ctor of gatewayCls.getConstructors()) {
      for (const param of ctor.getParameters()) {
        const paramType = param
          .getType()
          .getText()
          .replace(/^import\(.*?\)\./, '');
        if (paramType === wsEndpoint.securityService) {
          const hasOptional = param.getDecorators().some((d) => d.getName() === 'Optional');
          if (hasOptional) {
            issues.push({
              rule: 'nl-endpoint-coverage',
              severity: 'error',
              message: `WebSocket gateway '${wsEndpoint.gateway}' has @Optional() on ${wsEndpoint.securityService} — NL input not guaranteed to be security-checked`,
              file: gatewayFile.getFilePath(),
              line: param.getStartLineNumber(),
            });
          }
        }
      }
    }
  }

  return issues;
}

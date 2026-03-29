/**
 * Cross-layer integration checker.
 * Verifies end-to-end consistency across Prisma, Shared types, Backend, Frontend, and Mobile.
 *
 * 21 rules across 5 domains:
 *   A. Type consistency (enum-consistency, password-regex-sync, form-validation-sync)
 *   B. Route & API (route-helper-sync, hardcoded-api-routes, route-protection-audit, mobile-endpoint-consistency)
 *   C. AI system (ai-tool-registration, streaming-event-coverage, websocket-event-coverage)
 *   D. Backend & frontend integration (admin-guard-coverage, email-method-existence,
 *      module-dependency-check, stub-service-audit, cache-invalidation-audit, llm-json-import-check)
 *   E. Governance (governance-optional-security, governance-nl-endpoint-coverage,
 *      governance-config-consistency, governance-user-data-isolation, governance-dead-provider)
 *
 * Usage:
 *   npx tsx scripts/check-integration.ts                         # All 16 rules
 *   npx tsx scripts/check-integration.ts --only=enum-consistency # Specific rule(s)
 *   npx tsx scripts/check-integration.ts --domain=ai             # By domain
 *   npx tsx scripts/check-integration.ts --verbose               # Include INFO-level
 *   npx tsx scripts/check-integration.ts --json                  # JSON output for CI
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Config ──────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const PRISMA_SCHEMA = path.resolve(ROOT, 'apps/api/prisma/schema.prisma');
const SHARED_TYPES = path.resolve(ROOT, 'packages/shared/src/types/index.ts');
const API_ROUTES_FILE = path.resolve(ROOT, 'packages/shared/src/constants/api-routes.ts');
const PROXY_FILE = path.resolve(ROOT, 'apps/web/src/proxy.ts');
const EMAIL_SERVICE = path.resolve(ROOT, 'apps/api/src/common/email/email.service.ts');
const CONTROLLER_DIR = path.resolve(ROOT, 'apps/api/src/modules');
const WEB_SRC = path.resolve(ROOT, 'apps/web/src');
const MOBILE_SRC = path.resolve(ROOT, 'apps/mobile/src');
const AI_AGENT_DIR = path.resolve(ROOT, 'apps/api/src/modules/ai-agent');

type Severity = 'error' | 'warning' | 'info';

interface Issue {
  rule: string;
  severity: Severity;
  file: string;
  line?: number;
  message: string;
}

type RuleName =
  | 'enum-consistency'
  | 'password-regex-sync'
  | 'form-validation-sync'
  | 'route-helper-sync'
  | 'hardcoded-api-routes'
  | 'route-protection-audit'
  | 'mobile-endpoint-consistency'
  | 'ai-tool-registration'
  | 'streaming-event-coverage'
  | 'websocket-event-coverage'
  | 'admin-guard-coverage'
  | 'email-method-existence'
  | 'module-dependency-check'
  | 'stub-service-audit'
  | 'cache-invalidation-audit'
  | 'llm-json-import-check'
  | 'governance-optional-security'
  | 'governance-nl-endpoint-coverage'
  | 'governance-config-consistency'
  | 'governance-user-data-isolation'
  | 'governance-dead-provider';

const DOMAINS: Record<string, RuleName[]> = {
  types: ['enum-consistency', 'password-regex-sync', 'form-validation-sync'],
  routes: [
    'route-helper-sync',
    'hardcoded-api-routes',
    'route-protection-audit',
    'mobile-endpoint-consistency',
  ],
  ai: ['ai-tool-registration', 'streaming-event-coverage', 'websocket-event-coverage'],
  backend: [
    'admin-guard-coverage',
    'email-method-existence',
    'module-dependency-check',
    'stub-service-audit',
    'cache-invalidation-audit',
    'llm-json-import-check',
  ],
  governance: [
    'governance-optional-security',
    'governance-nl-endpoint-coverage',
    'governance-config-consistency',
    'governance-user-data-isolation',
    'governance-dead-provider',
  ],
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

function getAllFiles(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.next', '__tests__', '__mocks__', 'test'].includes(entry.name))
        continue;
      results.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function rel(filePath: string): string {
  return path.relative(ROOT, filePath);
}

function readFile(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function isTestFile(filePath: string): boolean {
  return /\.(spec|test)\.(ts|tsx)$/.test(filePath) || filePath.includes('__tests__');
}

// ── Rule 1: enum-consistency ────────────────────────────────

// Enums that MUST exist in shared types (used by frontend/mobile)
const REQUIRED_SHARED_ENUMS = [
  'Role',
  'Visibility',
  'AdmissionResult',
  'ApplicationStatus',
  'TestType',
  'ActivityCategory',
  'AwardLevel',
  'RecommendationLetterStatus',
  'VerificationStatus',
  'SubscriptionPlan',
  'MemoryType',
];

function checkEnumConsistency(): Issue[] {
  const issues: Issue[] = [];

  // Parse Prisma enums
  const prismaContent = readFile(PRISMA_SCHEMA);
  const prismaEnums = new Map<string, { values: string[]; line: number }>();
  const prismaEnumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = prismaEnumRegex.exec(prismaContent)) !== null) {
    const name = match[1];
    const values = match[2]
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim()) // Strip inline comments
      .filter((l) => l && !l.startsWith('//'));
    const line = prismaContent.substring(0, match.index).split('\n').length;
    prismaEnums.set(name, { values, line });
  }

  // Parse Shared enums
  const sharedContent = readFile(SHARED_TYPES);
  const sharedEnums = new Map<string, { values: string[]; line: number }>();
  const sharedEnumRegex = /export\s+enum\s+(\w+)\s*\{([^}]+)\}/g;

  while ((match = sharedEnumRegex.exec(sharedContent)) !== null) {
    const name = match[1];
    const values = match[2]
      .split('\n')
      .map((l) => l.trim().replace(/,\s*$/, ''))
      .filter((l) => l && !l.startsWith('//'))
      .map((l) => l.split('=')[0].trim());
    const line = sharedContent.substring(0, match.index).split('\n').length;
    sharedEnums.set(name, { values, line });
  }

  // Check required enums exist in shared
  for (const enumName of REQUIRED_SHARED_ENUMS) {
    if (prismaEnums.has(enumName) && !sharedEnums.has(enumName)) {
      issues.push({
        rule: 'enum-consistency',
        severity: 'error',
        file: rel(SHARED_TYPES),
        message: `Required enum '${enumName}' exists in Prisma but missing from shared types`,
      });
    }
  }

  // Check value consistency for matching enums
  for (const [name, prisma] of prismaEnums) {
    const shared = sharedEnums.get(name);
    if (!shared) continue; // Only check enums that exist in both

    const prismaSet = new Set(prisma.values);
    const sharedSet = new Set(shared.values);

    for (const v of prismaSet) {
      if (!sharedSet.has(v)) {
        issues.push({
          rule: 'enum-consistency',
          severity: 'error',
          file: rel(SHARED_TYPES),
          line: shared.line,
          message: `Enum '${name}' missing value '${v}' (exists in Prisma schema)`,
        });
      }
    }

    for (const v of sharedSet) {
      if (!prismaSet.has(v)) {
        issues.push({
          rule: 'enum-consistency',
          severity: 'warning',
          file: rel(SHARED_TYPES),
          line: shared.line,
          message: `Enum '${name}' has extra value '${v}' not in Prisma schema`,
        });
      }
    }
  }

  return issues;
}

// ── Rule 2: password-regex-sync ─────────────────────────────

function checkPasswordRegexSync(): Issue[] {
  const issues: Issue[] = [];

  // Extract backend @Matches regex from auth DTOs
  const authDtoDir = path.resolve(ROOT, 'apps/api/src/modules/auth/dto');
  const backendRegexes: string[] = [];

  if (fs.existsSync(authDtoDir)) {
    for (const file of getAllFiles(authDtoDir)) {
      const content = readFile(file);
      const matchesRegex = /@Matches\(\s*\/((?:[^/\\]|\\.)*)\//g;
      let m: RegExpExecArray | null;
      while ((m = matchesRegex.exec(content)) !== null) {
        backendRegexes.push(m[1]);
      }
    }
  }

  if (backendRegexes.length === 0) return issues;

  // Extract frontend password regexes
  const frontendFiles = [
    path.resolve(ROOT, 'apps/web/src/components/ui/password-strength.tsx'),
    ...getAllFiles(path.resolve(ROOT, 'apps/web/src/app/[locale]/(auth)')),
  ];

  const frontendRegexes: { file: string; line: number; regex: string }[] = [];
  for (const file of frontendFiles) {
    if (!fs.existsSync(file)) continue;
    const content = readFile(file);
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // Match .regex(/.../) patterns
      const regexMatch = /\.regex\(\s*\/((?:[^/\\]|\\.)*)\//g;
      let m: RegExpExecArray | null;
      while ((m = regexMatch.exec(lines[i])) !== null) {
        frontendRegexes.push({ file: rel(file), line: i + 1, regex: m[1] });
      }
    }
  }

  // Compare: check if backend regex appears in frontend
  for (const backendRe of backendRegexes) {
    const found = frontendRegexes.some((f) => f.regex === backendRe);
    if (!found && frontendRegexes.length > 0) {
      issues.push({
        rule: 'password-regex-sync',
        severity: 'error',
        file: rel(authDtoDir),
        message: `Backend password regex /${backendRe}/ not found in any frontend validation`,
      });
    }
  }

  return issues;
}

// ── Rule 3: form-validation-sync ────────────────────────────

function checkFormValidationSync(): Issue[] {
  const issues: Issue[] = [];

  // Extract backend DTO constraints
  const dtoFiles = getAllFiles(CONTROLLER_DIR).filter(
    (f) => f.includes('/dto/') && f.endsWith('.dto.ts')
  );
  const backendConstraints = new Map<
    string,
    { field: string; constraint: string; value: number; file: string }[]
  >();

  for (const file of dtoFiles) {
    const content = readFile(file);
    const lines = content.split('\n');
    let currentDecorators: { constraint: string; value: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Collect decorators
      const maxLenMatch = line.match(/@MaxLength\((\d+)\)/);
      if (maxLenMatch)
        currentDecorators.push({ constraint: 'maxLength', value: parseInt(maxLenMatch[1]) });
      const minMatch = line.match(/@Min\((\d+)\)/);
      if (minMatch) currentDecorators.push({ constraint: 'min', value: parseInt(minMatch[1]) });
      const maxMatch = line.match(/@Max\((\d+)\)/);
      if (maxMatch) currentDecorators.push({ constraint: 'max', value: parseInt(maxMatch[1]) });

      // Field declaration
      const fieldMatch = line.match(/^(\w+)\s*[?!]?\s*:/);
      if (fieldMatch && currentDecorators.length > 0) {
        const field = fieldMatch[1];
        const moduleName = path.basename(path.dirname(path.dirname(file)));
        if (!backendConstraints.has(moduleName)) backendConstraints.set(moduleName, []);
        for (const d of currentDecorators) {
          backendConstraints.get(moduleName)!.push({ field, ...d, file: rel(file) });
        }
        currentDecorators = [];
      }

      // Reset on empty line or non-decorator
      if (line === '' || (line.startsWith('export') && !line.startsWith('export class'))) {
        currentDecorators = [];
      }
    }
  }

  // Extract frontend Zod constraints
  const validationDir = path.resolve(ROOT, 'apps/web/src/lib/validations');
  const zodFiles = fs.existsSync(validationDir) ? getAllFiles(validationDir) : [];
  const frontendConstraints = new Map<
    string,
    { field: string; constraint: string; value: number; file: string }[]
  >();

  for (const file of zodFiles) {
    const content = readFile(file);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match: fieldName: z.string().max(200)
      const fieldMaxMatch = line.match(/(\w+)\s*:\s*z\.\w+\(\).*\.max\((\d+)/);
      if (fieldMaxMatch) {
        const moduleName = path.basename(file, '.ts');
        if (!frontendConstraints.has(moduleName)) frontendConstraints.set(moduleName, []);
        frontendConstraints.get(moduleName)!.push({
          field: fieldMaxMatch[1],
          constraint: 'maxLength',
          value: parseInt(fieldMaxMatch[2]),
          file: rel(file),
        });
      }
      const fieldMinMatch = line.match(/(\w+)\s*:\s*z\.\w+\(\).*\.min\((\d+)/);
      if (fieldMinMatch) {
        const moduleName = path.basename(file, '.ts');
        if (!frontendConstraints.has(moduleName)) frontendConstraints.set(moduleName, []);
        frontendConstraints.get(moduleName)!.push({
          field: fieldMinMatch[1],
          constraint: 'min',
          value: parseInt(fieldMinMatch[2]),
          file: rel(file),
        });
      }
    }
  }

  // Cross-match by field name — only within same module/domain
  // Map frontend validation files to relevant backend modules
  const FRONTEND_BACKEND_MAP: Record<string, string[]> = {
    timeline: ['timeline'],
    essay: ['essay'],
    profile: ['profile'],
    auth: ['auth'],
    school: ['school'],
    resume: ['resume'],
    forum: ['forum'],
    chat: ['chat'],
    team: ['team'],
    case: ['case'],
  };

  for (const [feModule, backendFields] of backendConstraints) {
    for (const bc of backendFields) {
      for (const [fModule, frontendFields] of frontendConstraints) {
        // Only match if modules are related
        const relatedBackends = FRONTEND_BACKEND_MAP[fModule] || [fModule];
        if (!relatedBackends.includes(feModule)) continue;

        for (const fc of frontendFields) {
          if (bc.field === fc.field && bc.constraint === fc.constraint && bc.value !== fc.value) {
            issues.push({
              rule: 'form-validation-sync',
              severity: 'warning',
              file: fc.file,
              message: `Field '${bc.field}' ${bc.constraint}: backend=${bc.value} (${bc.file}) vs frontend=${fc.value}`,
            });
          }
        }
      }
    }
  }

  return issues;
}

// ── Rule 4: route-helper-sync ───────────────────────────────

function checkRouteHelperSync(): Issue[] {
  const issues: Issue[] = [];
  const apiRoutesContent = readFile(API_ROUTES_FILE);

  // First, build a map of API_ROUTES constants
  const apiRoutesMap = new Map<string, string>();
  const routeConstRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
  const constBlock = apiRoutesContent.match(/API_ROUTES\s*=\s*\{([^}]+)\}/s);
  if (constBlock) {
    let m: RegExpExecArray | null;
    while ((m = routeConstRegex.exec(constBlock[1])) !== null) {
      apiRoutesMap.set(m[1], m[2]); // e.g., AUTH -> '/auth'
    }
  }

  // Extract helper paths: functionName: () => `${API_ROUTES.XXX}/sub/path`
  const helperPaths: { name: string; path: string; line: number }[] = [];
  const lines = apiRoutesContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match: name: (params) => `${API_ROUTES.XXX}/sub/path` or `${API_ROUTES.XXX}/sub/${id}`
    const helperMatch = line.match(/(\w+)\s*:\s*\([^)]*\)\s*=>\s*`([^`]+)`/);
    if (helperMatch) {
      // Resolve ${API_ROUTES.XXX} references
      let routePath = helperMatch[2];
      routePath = routePath.replace(/\$\{API_ROUTES\.(\w+)\}/g, (_, key) => {
        return apiRoutesMap.get(key) || `:unknown_${key}`;
      });
      // Replace remaining ${...} with :param (function parameters like ${id})
      routePath = routePath.replace(/\$\{[^}]+\}/g, ':param');
      helperPaths.push({ name: helperMatch[1], path: routePath, line: i + 1 });
      continue;
    }
    // Also match: name: () => API_ROUTES.XXX (no template literal, direct return)
    const directMatch = line.match(/(\w+)\s*:\s*\(\)\s*=>\s*API_ROUTES\.(\w+)/);
    if (directMatch) {
      const resolved = apiRoutesMap.get(directMatch[2]);
      if (resolved) {
        helperPaths.push({ name: directMatch[1], path: resolved, line: i + 1 });
      }
    }
  }

  // Extract controller endpoints
  const controllerFiles = getAllFiles(CONTROLLER_DIR, ['.controller.ts']);
  const controllerEndpoints = new Set<string>();

  for (const file of controllerFiles) {
    const content = readFile(file);
    // Get controller prefix
    const prefixMatch = content.match(/@Controller\(\s*['"]([^'"]*)['"]\s*\)/);
    if (!prefixMatch) continue;
    const prefix = prefixMatch[1];

    // Get method decorators
    const methodRegex = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"]([^'"]*?)['"])?\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = methodRegex.exec(content)) !== null) {
      const subPath = m[2] || '';
      const fullPath = `/${prefix}${subPath ? '/' + subPath : ''}`.replace(/\/+/g, '/');
      // Normalize :xxx params
      const normalized = fullPath.replace(/:\w+/g, ':param');
      controllerEndpoints.add(normalized);
    }
  }

  // Check helpers against endpoints
  for (const helper of helperPaths) {
    const normalizedHelper = helper.path.replace(/:\w+/g, ':param');
    // Check if any controller endpoint matches (with flexible param matching)
    const found = [...controllerEndpoints].some((ep) => {
      return (
        ep === normalizedHelper ||
        ep.startsWith(normalizedHelper + '/') ||
        normalizedHelper.startsWith(ep)
      );
    });

    if (!found) {
      issues.push({
        rule: 'route-helper-sync',
        severity: 'error',
        file: rel(API_ROUTES_FILE),
        line: helper.line,
        message: `Route helper '${helper.name}' generates path '${helper.path}' but no matching controller endpoint found`,
      });
    }
  }

  return issues;
}

// ── Rule 5: hardcoded-api-routes ────────────────────────────

function checkHardcodedApiRoutes(): Issue[] {
  const issues: Issue[] = [];
  const dirs = [WEB_SRC, MOBILE_SRC].filter(fs.existsSync);

  const API_CALL_PATTERN =
    /apiClient\.(?:get|post|put|patch|delete|upload)\s*(?:<[^>]*>)?\(\s*(['"`])(\/[^'"`]+)\1/g;

  for (const dir of dirs) {
    const files = getAllFiles(dir);
    for (const file of files) {
      if (isTestFile(file)) continue;
      const content = readFile(file);
      if (!content.includes('apiClient.')) continue;

      const fileLines = content.split('\n');
      for (let i = 0; i < fileLines.length; i++) {
        const line = fileLines[i];
        if (line.trim().startsWith('//')) continue;

        const regex = new RegExp(API_CALL_PATTERN.source, API_CALL_PATTERN.flags);
        let m: RegExpExecArray | null;
        while ((m = regex.exec(line)) !== null) {
          issues.push({
            rule: 'hardcoded-api-routes',
            severity: 'warning',
            file: rel(file),
            line: i + 1,
            message: `Hardcoded API path '${m[2]}' — use route helper from @study-abroad/shared`,
          });
        }
      }
    }
  }

  return issues;
}

// ── Rule 6: route-protection-audit ──────────────────────────

const PUBLIC_ROUTE_WHITELIST = [
  'forum',
  'schools',
  'ranking',
  'hall',
  'cases',
  'terms',
  'privacy',
  'about',
  'help',
  'referral',
  'teams', // /teams and /teams/[id] are public; /teams/create is protected
];

function checkRouteProtection(): Issue[] {
  const issues: Issue[] = [];

  // Extract PROTECTED_PATTERNS from proxy.ts
  const proxyContent = readFile(PROXY_FILE);
  const patternsMatch = proxyContent.match(/PROTECTED_PATTERNS\s*=\s*\[([^\]]+)\]/s);
  if (!patternsMatch) return issues;

  const protectedPatterns = [...patternsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);

  // Scan page.tsx files that use apiClient
  const mainDir = path.resolve(WEB_SRC, 'app/[locale]/(main)');
  if (!fs.existsSync(mainDir)) return issues;

  const pageFiles = getAllFiles(mainDir).filter((f) => f.endsWith('page.tsx'));

  for (const file of pageFiles) {
    const content = readFile(file);
    if (!content.includes('apiClient')) continue;

    // Extract route path from file path
    const relPath = path.relative(mainDir, file);
    const routeSegments = relPath
      .split(path.sep)
      .filter((s) => s !== 'page.tsx' && !s.startsWith('_'))
      .map((s) => s.replace(/\[.*?\]/g, ':param'));
    const routePath = '/' + routeSegments.join('/');

    // Check if covered by PROTECTED_PATTERNS
    const firstSegment = routeSegments[0]?.replace(':param', '') || '';
    if (PUBLIC_ROUTE_WHITELIST.includes(firstSegment)) continue;

    const isProtected = protectedPatterns.some((p) => routePath.startsWith(p));
    if (!isProtected) {
      issues.push({
        rule: 'route-protection-audit',
        severity: 'warning',
        file: rel(file),
        message: `Page '${routePath}' uses apiClient but not covered by PROTECTED_PATTERNS in proxy.ts`,
      });
    }
  }

  return issues;
}

// ── Rule 7: mobile-endpoint-consistency ─────────────────────

function checkMobileEndpointConsistency(): Issue[] {
  const issues: Issue[] = [];
  const mobileServicesDir = path.resolve(MOBILE_SRC, 'lib/api/services');
  if (!fs.existsSync(mobileServicesDir)) return issues;

  // Extract mobile API calls
  const mobileFiles = getAllFiles(mobileServicesDir);
  interface MobileCall {
    method: string;
    path: string;
    file: string;
    line: number;
  }
  const mobileCalls: MobileCall[] = [];

  for (const file of mobileFiles) {
    const content = readFile(file);
    const fileLines = content.split('\n');
    for (let i = 0; i < fileLines.length; i++) {
      const line = fileLines[i];
      const callMatch = line.match(
        /apiClient\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\(\s*['"`](\/[^'"`]+)['"`]/
      );
      if (callMatch) {
        mobileCalls.push({
          method: callMatch[1].toUpperCase(),
          path: callMatch[2].replace(/\$\{[^}]+\}/g, ':param'),
          file: rel(file),
          line: i + 1,
        });
      }
    }
  }

  // Extract controller endpoints with their methods
  const controllerFiles = getAllFiles(CONTROLLER_DIR, ['.controller.ts']);
  const controllerMethods = new Map<string, string>(); // normalized path -> HTTP method

  for (const file of controllerFiles) {
    const content = readFile(file);
    const prefixMatch = content.match(/@Controller\(\s*['"]([^'"]*)['"]\s*\)/);
    if (!prefixMatch) continue;
    const prefix = prefixMatch[1];

    const methodRegex = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"]([^'"]*?)['"])?\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = methodRegex.exec(content)) !== null) {
      const httpMethod = m[1].toUpperCase();
      const subPath = m[2] || '';
      const fullPath = `/${prefix}${subPath ? '/' + subPath : ''}`.replace(/\/+/g, '/');
      const normalized = fullPath.replace(/:\w+/g, ':param');
      controllerMethods.set(normalized, httpMethod);
    }
  }

  // Compare mobile calls with controller methods
  for (const call of mobileCalls) {
    const normalized = call.path.replace(/:\w+/g, ':param');
    const backendMethod = controllerMethods.get(normalized);
    if (backendMethod && backendMethod !== call.method) {
      issues.push({
        rule: 'mobile-endpoint-consistency',
        severity: 'warning',
        file: call.file,
        line: call.line,
        message: `Mobile uses ${call.method} for '${call.path}' but backend expects ${backendMethod}`,
      });
    }
  }

  return issues;
}

// ── Rule 8: ai-tool-registration ────────────────────────────

function checkAiToolRegistration(): Issue[] {
  const issues: Issue[] = [];

  // 1. Extract tool names from tools.config.ts
  const toolsConfigFile = path.resolve(AI_AGENT_DIR, 'config/tools.config.ts');
  const toolsContent = readFile(toolsConfigFile);
  const configToolNames = new Set<string>();
  const toolNameRegex = /name:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = toolNameRegex.exec(toolsContent)) !== null) {
    configToolNames.add(m[1]);
  }

  // 2. Extract allowedTools from agents.config.ts
  const agentsConfigFile = path.resolve(AI_AGENT_DIR, 'config/agents.config.ts');
  const agentsContent = readFile(agentsConfigFile);
  const agentToolRefs = new Map<string, string[]>();
  // Match agent blocks and their allowedTools
  const agentBlockRegex = /(\w+):\s*\{[^}]*?allowedTools:\s*\[([^\]]*)\]/gs;
  while ((m = agentBlockRegex.exec(agentsContent)) !== null) {
    const agentName = m[1];
    const tools = [...m[2].matchAll(/['"]([^'"]+)['"]/g)].map((t) => t[1]);
    agentToolRefs.set(agentName, tools);
  }

  // 3. Extract handler names from tool service files
  const toolsDir = path.resolve(AI_AGENT_DIR, 'tools');
  const handlerNames = new Set<string>();
  if (fs.existsSync(toolsDir)) {
    const toolFiles = getAllFiles(toolsDir).filter((f) => f.endsWith('.service.ts'));
    for (const file of toolFiles) {
      const content = readFile(file);
      // Match name: 'tool_name' inside getHandlers
      const handlerRegex = /name:\s*['"]([^'"]+)['"]/g;
      while ((m = handlerRegex.exec(content)) !== null) {
        handlerNames.add(m[1]);
      }
    }
  }

  // Check: agent references tool not in config
  for (const [agent, tools] of agentToolRefs) {
    for (const tool of tools) {
      if (tool === 'delegate_to_agent') continue; // Special built-in tool
      if (!configToolNames.has(tool)) {
        issues.push({
          rule: 'ai-tool-registration',
          severity: 'error',
          file: rel(agentsConfigFile),
          message: `Agent '${agent}' references tool '${tool}' not defined in tools.config.ts`,
        });
      }
    }
  }

  // Check: config defines tool but no handler
  for (const tool of configToolNames) {
    if (!handlerNames.has(tool)) {
      issues.push({
        rule: 'ai-tool-registration',
        severity: 'error',
        file: rel(toolsConfigFile),
        message: `Tool '${tool}' defined in config but no handler implementation found`,
      });
    }
  }

  // Check: handler exists but not in any agent (dead tool)
  const allAgentTools = new Set([...agentToolRefs.values()].flat());
  for (const handler of handlerNames) {
    if (!allAgentTools.has(handler) && !configToolNames.has(handler)) {
      // Only report if it's truly orphaned (not in config AND not in any agent)
      issues.push({
        rule: 'ai-tool-registration',
        severity: 'warning',
        file: rel(toolsDir),
        message: `Handler '${handler}' not referenced by any agent allowedTools`,
      });
    }
  }

  return issues;
}

// ── Rule 9: streaming-event-coverage ────────────────────────

function checkStreamingEventCoverage(): Issue[] {
  const issues: Issue[] = [];

  // Extract StreamEvent types from shared types
  const sharedContent = readFile(SHARED_TYPES);
  const streamEventTypes = new Set<string>();
  // Match: type: 'content' | 'tool_start' | ... or individual type fields
  const typeUnionMatch = sharedContent.match(/type:\s*['"](\w+)['"](?:\s*\|\s*['"](\w+)['"])*/g);
  if (typeUnionMatch) {
    for (const m of typeUnionMatch) {
      const types = [...m.matchAll(/['"](\w+)['"]/g)];
      for (const t of types) streamEventTypes.add(t[1]);
    }
  }

  // Also extract from StreamEvent interface/type if it's a discriminated union
  const streamEventBlock = sharedContent.match(
    /(?:interface|type)\s+StreamEvent[\s\S]*?(?=\nexport|\n\n)/
  );
  if (streamEventBlock) {
    const typeValues = [...streamEventBlock[0].matchAll(/type:\s*['"](\w+)['"]/g)];
    for (const t of typeValues) streamEventTypes.add(t[1]);
  }

  if (streamEventTypes.size === 0) return issues; // Can't analyze without type definitions

  // Extract frontend event handling
  const webFiles = getAllFiles(WEB_SRC);
  const handledEvents = new Set<string>();
  for (const file of webFiles) {
    const content = readFile(file);
    if (!content.includes('event.type') && !content.includes("event['type']")) continue;

    // Match: event.type === 'xxx' or case 'xxx':
    const eventChecks = [...content.matchAll(/event\.type\s*===?\s*['"](\w+)['"]/g)];
    for (const ec of eventChecks) handledEvents.add(ec[1]);
    const caseChecks = [...content.matchAll(/case\s+['"](\w+)['"]\s*:/g)];
    for (const cc of caseChecks) handledEvents.add(cc[1]);
  }

  // Compare
  for (const eventType of streamEventTypes) {
    if (!handledEvents.has(eventType)) {
      issues.push({
        rule: 'streaming-event-coverage',
        severity: 'warning',
        file: rel(SHARED_TYPES),
        message: `StreamEvent type '${eventType}' defined but not handled in frontend`,
      });
    }
  }

  return issues;
}

// ── Rule 10: websocket-event-coverage ───────────────────────

function checkWebSocketEventCoverage(): Issue[] {
  const issues: Issue[] = [];

  // Extract gateway emits
  const gatewayFile = path.resolve(CONTROLLER_DIR, 'chat/chat.gateway.ts');
  const gatewayContent = readFile(gatewayFile);
  const emittedEvents = new Set<string>();
  const emitRegex = /\.emit\(\s*['"](\w+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = emitRegex.exec(gatewayContent)) !== null) {
    emittedEvents.add(m[1]);
  }

  if (emittedEvents.size === 0) return issues;

  // Extract frontend listeners
  const listenedEvents = new Set<string>();
  const webFiles = getAllFiles(WEB_SRC);
  for (const file of webFiles) {
    const content = readFile(file);
    if (!content.includes('socket') && !content.includes('Socket')) continue;

    const onRegex = /\.on\(\s*['"](\w+)['"]/g;
    while ((m = onRegex.exec(content)) !== null) {
      listenedEvents.add(m[1]);
    }
  }

  // Compare
  for (const event of emittedEvents) {
    if (event === 'exception' || event === 'error') continue; // Framework events
    if (!listenedEvents.has(event)) {
      issues.push({
        rule: 'websocket-event-coverage',
        severity: 'warning',
        file: rel(gatewayFile),
        message: `Chat gateway emits '${event}' but no frontend listener found`,
      });
    }
  }

  return issues;
}

// ── Rule 11: admin-guard-coverage ───────────────────────────

function checkAdminGuardCoverage(): Issue[] {
  const issues: Issue[] = [];

  const controllerFiles = getAllFiles(CONTROLLER_DIR, ['.controller.ts']);
  for (const file of controllerFiles) {
    const content = readFile(file);
    const controllerMatch = content.match(/@Controller\(\s*['"]admin/);
    if (!controllerMatch) continue;

    // Check for class-level @Roles
    const hasRoles = /@Roles\s*\(/.test(content);
    if (!hasRoles) {
      issues.push({
        rule: 'admin-guard-coverage',
        severity: 'error',
        file: rel(file),
        message: `Admin controller missing @Roles() guard at class level`,
      });
    }
  }

  return issues;
}

// ── Rule 12: email-method-existence ─────────────────────────

function checkEmailMethodExistence(): Issue[] {
  const issues: Issue[] = [];

  // Extract EmailService methods
  const emailContent = readFile(EMAIL_SERVICE);
  const emailMethods = new Set<string>();
  const methodRegex = /(?:async\s+)?(\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  // Only capture methods that look like class methods (not constructors, not imports)
  const classBody = emailContent.match(/class\s+EmailService[\s\S]*$/);
  if (classBody) {
    while ((m = methodRegex.exec(classBody[0])) !== null) {
      const name = m[1];
      if (name !== 'constructor' && name !== 'class' && name !== 'EmailService') {
        emailMethods.add(name);
      }
    }
  }

  // Scan for emailService.xxx() calls
  const serviceFiles = getAllFiles(CONTROLLER_DIR).filter(
    (f) => f.endsWith('.service.ts') && !isTestFile(f)
  );

  for (const file of serviceFiles) {
    if (file === EMAIL_SERVICE) continue;
    const content = readFile(file);
    const callRegex = /(?:this\.)?emailService\.(\w+)\s*\(/g;
    const fileLines = content.split('\n');

    for (let i = 0; i < fileLines.length; i++) {
      const line = fileLines[i];
      while ((m = callRegex.exec(line)) !== null) {
        const methodName = m[1];
        if (!emailMethods.has(methodName)) {
          issues.push({
            rule: 'email-method-existence',
            severity: 'error',
            file: rel(file),
            line: i + 1,
            message: `Calls emailService.${methodName}() but method doesn't exist in EmailService`,
          });
        }
      }
      callRegex.lastIndex = 0;
    }
  }

  return issues;
}

// ── Rule 13: module-dependency-check ────────────────────────

// Modules that are @Global() and don't need explicit imports
const GLOBAL_MODULES = [
  'PrismaModule',
  'PrismaService',
  'RedisModule',
  'RedisService',
  'LLMProvidersModule',
  'LLMService',
  'ResilienceService',
  'TokenTrackerService',
  'AgentSecurityModule',
  'PromptGuardService',
  'ContentModerationService',
  'AuditService',
  'EmailModule',
  'EmailService',
  'StorageModule',
  'StorageService',
  'SentryModule',
  'SentryService',
  'LoggerModule',
  'CustomLoggerService',
  'AuthorizationModule',
  'AuthorizationService',
  'FeatureFlagModule',
  'FeatureFlagService',
  'AuditLogModule',
  'AuditLogService',
  'ConfigModule',
  'ConfigService',
  'EventEmitterModule',
  'EventEmitter2',
  'ScheduleModule',
  'ThrottlerModule',
  'SettingsModule',
  'SettingsService',
];

const GLOBAL_MODULE_SET = new Set(GLOBAL_MODULES);

function checkModuleDependency(): Issue[] {
  const issues: Issue[] = [];

  // Find all module files
  const moduleFiles = getAllFiles(CONTROLLER_DIR).filter(
    (f) => f.endsWith('.module.ts') && !isTestFile(f)
  );

  // Build module exports cache: ModuleClassName -> Set of exported service names
  const moduleExportsCache = new Map<string, Set<string>>();
  // Build module file lookup: ModuleClassName -> file path
  const moduleFileLookup = new Map<string, string>();

  for (const mf of moduleFiles) {
    const content = readFile(mf);
    const classMatch = content.match(/class\s+(\w+Module)/);
    if (!classMatch) continue;
    moduleFileLookup.set(classMatch[1], mf);

    const exportsMatch = content.match(/exports:\s*\[([^\]]*)\]/s);
    if (exportsMatch) {
      const exported = [...exportsMatch[1].matchAll(/(\w+)/g)].map((m) => m[1]);
      moduleExportsCache.set(classMatch[1], new Set(exported));
    }
  }

  for (const moduleFile of moduleFiles) {
    const moduleContent = readFile(moduleFile);
    const moduleDir = path.dirname(moduleFile);

    // Extract imports array from @Module decorator
    const importsMatch = moduleContent.match(/imports:\s*\[([^\]]*)\]/s);
    const importedModules = importsMatch
      ? [...importsMatch[1].matchAll(/(\w+Module)(?:\.for\w+\([^)]*\))?/g)].map((m) => m[1])
      : [];
    const importedSet = new Set(importedModules);

    // Build set of all services exported by imported modules
    const transitiveServices = new Set<string>();
    for (const mod of importedModules) {
      const exports = moduleExportsCache.get(mod);
      if (exports) {
        for (const e of exports) transitiveServices.add(e);
      }
    }

    // Find service files in same module directory
    const serviceFiles = getAllFiles(moduleDir).filter(
      (f) => f.endsWith('.service.ts') && !isTestFile(f)
    );

    for (const serviceFile of serviceFiles) {
      const serviceContent = readFile(serviceFile);

      // Extract constructor injections
      const constructorMatch = serviceContent.match(/constructor\s*\(([\s\S]*?)\)/);
      if (!constructorMatch) continue;

      const injections = constructorMatch[1].matchAll(
        /(?:private|protected|public)\s+(?:readonly\s+)?(\w+)\s*:\s*(\w+)/g
      );

      for (const injection of injections) {
        const serviceName = injection[2];

        // Skip global modules
        if (GLOBAL_MODULE_SET.has(serviceName)) continue;

        // Check if it's from the same module directory (including sub-dirs)
        const sameModule = getAllFiles(moduleDir).some((f) =>
          readFile(f).includes(`class ${serviceName}`)
        );
        if (sameModule) continue;

        // Check if service is explicitly listed in module's providers array
        const providersMatch = moduleContent.match(/providers:\s*\[([^\]]*)\]/s);
        if (providersMatch && providersMatch[1].includes(serviceName)) continue;

        // Check if service is exported by any imported module (transitive DI)
        if (transitiveServices.has(serviceName)) continue;

        // Try to determine which module provides this service
        // Convention: XxxService is provided by XxxModule
        const expectedModule = serviceName.replace(/Service$/, 'Module');

        // Check if the expected module is imported
        if (!importedSet.has(expectedModule) && !GLOBAL_MODULE_SET.has(expectedModule)) {
          // Verify the service actually exists elsewhere
          const allServiceFiles = getAllFiles(CONTROLLER_DIR);
          const serviceExists = allServiceFiles.some(
            (f) => !f.startsWith(moduleDir) && readFile(f).includes(`class ${serviceName}`)
          );

          if (serviceExists) {
            issues.push({
              rule: 'module-dependency-check',
              severity: 'error',
              file: rel(moduleFile),
              message: `Injects '${serviceName}' but '${expectedModule}' not in module imports`,
            });
          }
        }
      }
    }
  }

  return issues;
}

// ── Rule 14: stub-service-audit ─────────────────────────────

const STUB_PATTERNS = [
  {
    pattern: /new\s+Promise\s*\(\s*\(?\s*resolve\s*\)?\s*=>\s*setTimeout/g,
    label: 'setTimeout stub',
  },
  { pattern: /\/\/\s*TODO\b/gi, label: 'TODO comment' },
  { pattern: /\/\/\s*STUB\b/gi, label: 'STUB comment' },
  { pattern: /\/\/\s*MOCK\b/gi, label: 'MOCK comment' },
  { pattern: /\/\/\s*模拟/g, label: 'Mock comment (Chinese)' },
  { pattern: /\/\/\s*FIXME\b/gi, label: 'FIXME comment' },
];

function checkStubServiceAudit(): Issue[] {
  const issues: Issue[] = [];

  const serviceFiles = getAllFiles(CONTROLLER_DIR).filter(
    (f) => f.endsWith('.service.ts') && !isTestFile(f)
  );

  for (const file of serviceFiles) {
    const content = readFile(file);
    const fileLines = content.split('\n');

    for (let i = 0; i < fileLines.length; i++) {
      for (const { pattern, label } of STUB_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        if (regex.test(fileLines[i])) {
          issues.push({
            rule: 'stub-service-audit',
            severity: 'info',
            file: rel(file),
            line: i + 1,
            message: `${label}: ${fileLines[i].trim().substring(0, 80)}`,
          });
        }
      }
    }
  }

  return issues;
}

// ── Rule 15: cache-invalidation-audit ───────────────────────

function checkCacheInvalidation(): Issue[] {
  const issues: Issue[] = [];

  const webFiles = getAllFiles(WEB_SRC).filter((f) => !isTestFile(f));

  // AI endpoints that don't need cache invalidation
  const AI_PATHS = ['/ai-agent/', '/essay-ai/', '/ai/'];

  for (const file of webFiles) {
    const content = readFile(file);
    if (!content.includes('useMutation')) continue;

    // Find mutation blocks (simplified: look for useMutation with apiClient write methods)
    const lines = content.split('\n');
    let inMutation = false;
    let mutationStart = 0;
    let braceCount = 0;
    let mutationBlock = '';
    let isWriteMutation = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('useMutation')) {
        inMutation = true;
        mutationStart = i + 1;
        braceCount = 0;
        mutationBlock = '';
        isWriteMutation = false;
      }

      if (inMutation) {
        mutationBlock += line + '\n';
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;

        if (/apiClient\.(post|put|patch|delete)/.test(line)) {
          isWriteMutation = true;
          // Check if it's an AI endpoint
          if (AI_PATHS.some((p) => line.includes(p))) {
            isWriteMutation = false;
          }
        }

        if (braceCount <= 0 && mutationBlock.length > 10) {
          // End of mutation block
          if (isWriteMutation && !mutationBlock.includes('invalidateQueries')) {
            issues.push({
              rule: 'cache-invalidation-audit',
              severity: 'warning',
              file: rel(file),
              line: mutationStart,
              message: `useMutation with write operation but no invalidateQueries in onSuccess`,
            });
          }
          inMutation = false;
        }
      }
    }
  }

  return issues;
}

// ── Rule 16: llm-json-import-check ──────────────────────────

function checkLlmJsonImport(): Issue[] {
  const issues: Issue[] = [];

  const apiFiles = getAllFiles(path.resolve(ROOT, 'apps/api/src')).filter(
    (f) => !isTestFile(f) && f.endsWith('.ts')
  );

  for (const file of apiFiles) {
    const content = readFile(file);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('extractJsonFromLlm') && line.includes('import')) {
        if (line.includes('llm-json.helper') || line.includes('helpers/llm-json')) {
          issues.push({
            rule: 'llm-json-import-check',
            severity: 'warning',
            file: rel(file),
            line: i + 1,
            message: `Import extractJsonFromLlm from legacy path — use 'common/utils/llm-json.util'`,
          });
        }
      }
    }
  }

  return issues;
}

// ── Output ──────────────────────────────────────────────────

const COLORS = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
};

function severityColor(severity: Severity): string {
  switch (severity) {
    case 'error':
      return COLORS.red;
    case 'warning':
      return COLORS.yellow;
    case 'info':
      return COLORS.gray;
  }
}

function printResults(issues: Issue[], options: Options): void {
  if (options.json) {
    console.log(JSON.stringify({ issues, summary: getSummary(issues) }, null, 2));
    return;
  }

  const filtered = options.verbose ? issues : issues.filter((i) => i.severity !== 'info');

  if (filtered.length === 0) {
    console.log(`\n${COLORS.green}${COLORS.bold}✓ All integration checks passed${COLORS.reset}\n`);
    return;
  }

  // Group by rule
  const byRule = new Map<string, Issue[]>();
  for (const issue of filtered) {
    if (!byRule.has(issue.rule)) byRule.set(issue.rule, []);
    byRule.get(issue.rule)!.push(issue);
  }

  console.log(`\n${COLORS.bold}Integration Check Results${COLORS.reset}\n`);

  for (const [rule, ruleIssues] of byRule) {
    const severity = ruleIssues[0].severity;
    const color = severityColor(severity);
    console.log(
      `${color}${COLORS.bold}[${severity.toUpperCase()}] ${rule}${COLORS.reset} (${ruleIssues.length} issue${ruleIssues.length > 1 ? 's' : ''})`
    );

    for (const issue of ruleIssues) {
      const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      console.log(`  ${color}●${COLORS.reset} ${COLORS.cyan}${loc}${COLORS.reset}`);
      console.log(`    ${issue.message}`);
    }
    console.log();
  }

  const summary = getSummary(filtered);
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${COLORS.red}${summary.errors} error${summary.errors !== 1 ? 's' : ''}${COLORS.reset}, ${COLORS.yellow}${summary.warnings} warning${summary.warnings !== 1 ? 's' : ''}${COLORS.reset}, ${COLORS.gray}${summary.infos} info${COLORS.reset}\n`
  );
}

function getSummary(issues: Issue[]): { errors: number; warnings: number; infos: number } {
  return {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    infos: issues.filter((i) => i.severity === 'info').length,
  };
}

// ── Governance bridge ─────────────────────────────────────

import { execSync } from 'child_process';

function runGovernanceRule(governanceRuleId: string): Issue[] {
  try {
    const output = execSync(
      `npx tsx scripts/governance/index.ts --rule=${governanceRuleId} --json`,
      { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const result = JSON.parse(output);
    return (result.issues || []).map((i: any) => ({
      rule: `governance-${i.rule}` as RuleName,
      severity: i.severity as Severity,
      file: i.file ? rel(i.file) : 'scripts/governance',
      line: i.line,
      message: i.message,
    }));
  } catch (err: any) {
    // If the governance CLI exits with code 1, it still outputs JSON on stdout
    if (err.stdout) {
      try {
        const result = JSON.parse(err.stdout);
        return (result.issues || []).map((i: any) => ({
          rule: `governance-${i.rule}` as RuleName,
          severity: i.severity as Severity,
          file: i.file ? rel(i.file) : 'scripts/governance',
          line: i.line,
          message: i.message,
        }));
      } catch {
        // JSON parse failed
      }
    }
    return [
      {
        rule: `governance-${governanceRuleId}` as RuleName,
        severity: 'error' as Severity,
        file: 'scripts/governance',
        message: `Governance rule '${governanceRuleId}' failed to execute: ${err.message}`,
      },
    ];
  }
}

// ── Main ────────────────────────────────────────────────────

const RULE_MAP: Record<RuleName, () => Issue[]> = {
  'enum-consistency': checkEnumConsistency,
  'password-regex-sync': checkPasswordRegexSync,
  'form-validation-sync': checkFormValidationSync,
  'route-helper-sync': checkRouteHelperSync,
  'hardcoded-api-routes': checkHardcodedApiRoutes,
  'route-protection-audit': checkRouteProtection,
  'mobile-endpoint-consistency': checkMobileEndpointConsistency,
  'ai-tool-registration': checkAiToolRegistration,
  'streaming-event-coverage': checkStreamingEventCoverage,
  'websocket-event-coverage': checkWebSocketEventCoverage,
  'admin-guard-coverage': checkAdminGuardCoverage,
  'email-method-existence': checkEmailMethodExistence,
  'module-dependency-check': checkModuleDependency,
  'stub-service-audit': checkStubServiceAudit,
  'cache-invalidation-audit': checkCacheInvalidation,
  'llm-json-import-check': checkLlmJsonImport,
  'governance-optional-security': () => runGovernanceRule('optional-security'),
  'governance-nl-endpoint-coverage': () => runGovernanceRule('nl-endpoint-coverage'),
  'governance-config-consistency': () => runGovernanceRule('config-consistency'),
  'governance-user-data-isolation': () => runGovernanceRule('user-data-isolation'),
  'governance-dead-provider': () => runGovernanceRule('dead-provider'),
};

function main(): void {
  const options = parseArgs();
  const allIssues: Issue[] = [];

  for (const rule of options.only) {
    const checker = RULE_MAP[rule];
    if (checker) {
      try {
        const issues = checker();
        allIssues.push(...issues);
      } catch (err) {
        console.error(`${COLORS.red}Error running rule '${rule}':${COLORS.reset}`, err);
      }
    }
  }

  printResults(allIssues, options);

  // Exit with error if any ERROR-level issues found
  const hasErrors = allIssues.some((i) => i.severity === 'error');
  if (hasErrors) {
    process.exit(1);
  }
}

main();

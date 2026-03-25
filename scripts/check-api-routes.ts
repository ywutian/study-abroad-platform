/**
 * API route consistency checker.
 * Scans backend controllers for route prefixes, then verifies that all
 * client-side API calls (web + mobile) reference a valid controller prefix.
 *
 * Catches:
 *   - Frontend/mobile apiClient calls to paths whose prefix has no matching
 *     backend @Controller('prefix')
 *
 * Usage:
 *   npx tsx scripts/check-api-routes.ts           # Check all client files
 *   npx tsx scripts/check-api-routes.ts --staged   # Check staged client files only
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ──────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const CONTROLLER_DIR = path.resolve(ROOT, 'apps/api/src/modules');
const CLIENT_DIRS = [path.resolve(ROOT, 'apps/web/src'), path.resolve(ROOT, 'apps/mobile/src')];

const isCI = !!process.env.CI;
const stagedOnly = process.argv.includes('--staged');

// Known valid controller prefixes (verified from backend).
// This acts as a fallback in case controller scanning misses dynamic registrations.
const KNOWN_PREFIXES = new Set([
  'auth',
  'users',
  'profiles',
  'schools',
  'high-schools',
  'school-lists',
  'rankings',
  'cases',
  'predictions',
  'recommendations',
  'assessments',
  'forums',
  'halls',
  'chats',
  'teams',
  'peer-reviews',
  'essay-ai',
  'essay-prompts',
  'ai-agent',
  'timelines',
  'notifications',
  'subscriptions',
  'resumes',
  'verifications',
  'vaults',
  'points',
  'settings',
  'health',
  'admin',
]);

// Prefixes that are not backend API routes (navigation, static assets, etc.)
const IGNORED_PREFIXES = new Set([
  'api', // proxy prefix — the actual prefix is the segment after /api/
  'auth', // also used for frontend auth pages (e.g., /auth/login route)
  'images',
  'static',
  'favicon',
  '_next',
  'locales',
]);

// Files to skip entirely (test files, mocks, type definitions)
const SKIP_PATTERNS = [
  '.spec.ts',
  '.spec.tsx',
  '.test.ts',
  '.test.tsx',
  '.d.ts',
  '__tests__',
  '__mocks__',
  'node_modules',
  'dist',
  '.next',
];

interface Issue {
  file: string;
  line: number;
  path: string;
  prefix: string;
  message: string;
}

// ── Helpers ─────────────────────────────────────────────────

function getAllFiles(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        ['node_modules', 'dist', '.next', 'test', '__tests__', '__mocks__'].includes(entry.name)
      ) {
        continue;
      }
      results.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function getStagedClientFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: ROOT,
    });
    return output
      .split('\n')
      .filter((f) => {
        if (!f.endsWith('.ts') && !f.endsWith('.tsx')) return false;
        return f.startsWith('apps/web/src/') || f.startsWith('apps/mobile/src/');
      })
      .map((f) => path.resolve(ROOT, f));
  } catch {
    return [];
  }
}

function relativePath(filePath: string): string {
  return path.relative(ROOT, filePath);
}

function shouldSkipFile(filePath: string): boolean {
  return SKIP_PATTERNS.some((pattern) => filePath.includes(pattern));
}

// ── Controller Scanning ─────────────────────────────────────

/**
 * Scan all *.controller.ts files to extract @Controller('prefix') route prefixes.
 * Returns a Set of all discovered prefixes.
 */
function scanControllerPrefixes(): Set<string> {
  const prefixes = new Set<string>(KNOWN_PREFIXES);
  const controllerFiles = getAllFiles(CONTROLLER_DIR, ['.controller.ts']);
  const controllerRegex = /@Controller\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const filePath of controllerFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    let match: RegExpExecArray | null;

    while ((match = controllerRegex.exec(content)) !== null) {
      const fullPrefix = match[1];
      // Extract the first segment as the primary prefix
      // e.g., 'admin/ai-agent' -> 'admin'
      const firstSegment = fullPrefix.split('/')[0];
      prefixes.add(firstSegment);
      // Also add the full prefix for multi-segment matching
      prefixes.add(fullPrefix);
    }

    // Reset regex lastIndex for next file
    controllerRegex.lastIndex = 0;
  }

  return prefixes;
}

// ── Client Path Extraction ──────────────────────────────────

/**
 * Regex patterns to match apiClient method calls with path arguments.
 *
 * Matches:
 *   apiClient.get('/path...')
 *   apiClient.post('/path...')
 *   apiClient.get<Type>('/path...')
 *   apiClient.delete(`/path/${id}`)
 *   apiClient.put<Type>(`/path/${id}`)
 */
const API_CALL_PATTERNS = [
  // Single-quoted paths: apiClient.method('/path') or apiClient.method<T>('/path')
  /apiClient\.(?:get|post|put|patch|delete|upload)\s*(?:<[^>]*>)?\(\s*'(\/[^']+)'/g,
  // Double-quoted paths: apiClient.method("/path") or apiClient.method<T>("/path")
  /apiClient\.(?:get|post|put|patch|delete|upload)\s*(?:<[^>]*>)?\(\s*"(\/[^"]+)"/g,
  // Template literal paths: apiClient.method(`/path/${var}`) or apiClient.method<T>(`/path/${var}`)
  /apiClient\.(?:get|post|put|patch|delete|upload)\s*(?:<[^>]*>)?\(\s*`(\/[^`]+)`/g,
];

interface ExtractedPath {
  path: string;
  line: number;
}

/**
 * Extract API paths from a client source file.
 */
function extractApiPaths(content: string): ExtractedPath[] {
  const results: ExtractedPath[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    // Skip navigation/router calls (not API calls)
    if (/router\.(push|replace|navigate)\s*\(/.test(line)) continue;
    if (/href\s*[:=]/.test(line)) continue;

    for (const pattern of API_CALL_PATTERNS) {
      // Clone regex to avoid state issues
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const apiPath = match[1];
        // Clean template literal expressions: /schools/${id} -> /schools/__PARAM__
        // Strip query parameters: /notifications?limit=50 -> /notifications
        const cleanedPath = apiPath.replace(/\$\{[^}]*\}/g, '__PARAM__').replace(/\?.*$/, '');
        results.push({ path: cleanedPath, line: i + 1 });
      }
    }
  }

  return results;
}

/**
 * Extract the route prefix from an API path.
 * Handles /api/ proxy prefix stripping and /admin/ sub-routes.
 *
 * Examples:
 *   /schools/123        -> 'schools'
 *   /admin/users        -> 'admin'
 *   /api/schools/123    -> 'schools' (strips /api/ proxy prefix)
 *   /auth/login         -> 'auth'
 */
function extractPrefix(apiPath: string): string | null {
  // Remove leading slash and split
  const segments = apiPath.replace(/^\/+/, '').split('/').filter(Boolean);

  if (segments.length === 0) return null;

  // Strip /api/ proxy prefix if present
  let startIndex = 0;
  if (segments[0] === 'api') {
    startIndex = 1;
  }
  // Strip version prefix like /v1/
  if (segments[startIndex] && /^v\d+$/.test(segments[startIndex])) {
    startIndex++;
  }

  if (startIndex >= segments.length) return null;

  const prefix = segments[startIndex];

  // Clean up template literal params
  if (prefix === '__PARAM__') return null;

  return prefix;
}

// ── Main Check ──────────────────────────────────────────────

function checkClientFiles(clientFiles: string[], controllerPrefixes: Set<string>): Issue[] {
  const issues: Issue[] = [];

  for (const filePath of clientFiles) {
    if (!fs.existsSync(filePath)) continue;
    if (shouldSkipFile(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');

    // Skip files that don't contain apiClient calls
    if (!content.includes('apiClient.')) continue;

    const extracted = extractApiPaths(content);

    for (const { path: apiPath, line } of extracted) {
      const prefix = extractPrefix(apiPath);
      if (!prefix) continue;

      // Skip known non-API prefixes
      if (IGNORED_PREFIXES.has(prefix)) continue;

      if (!controllerPrefixes.has(prefix)) {
        issues.push({
          file: relativePath(filePath),
          line,
          path: apiPath,
          prefix,
          message: `API path '${apiPath}' has prefix '${prefix}' which does not match any backend @Controller() prefix.`,
        });
      }
    }
  }

  return issues;
}

// ── Entry Point ─────────────────────────────────────────────

function main() {
  console.log(
    stagedOnly ? '🔍 Checking staged client files...' : '🔍 Checking all client files...'
  );
  console.log('');

  // Step 1: Scan backend controllers
  const controllerPrefixes = scanControllerPrefixes();
  console.log(
    `📋 Found ${controllerPrefixes.size} controller prefixes: ${[...controllerPrefixes].sort().join(', ')}`
  );
  console.log('');

  // Step 2: Get client files to check
  let clientFiles: string[];
  if (stagedOnly) {
    clientFiles = getStagedClientFiles();
  } else {
    clientFiles = [];
    for (const dir of CLIENT_DIRS) {
      clientFiles.push(...getAllFiles(dir));
    }
  }

  if (clientFiles.length === 0) {
    console.log('No client files to check.');
    process.exit(0);
  }

  console.log(`📂 Scanning ${clientFiles.length} client file(s)...`);
  console.log('');

  // Step 3: Check client files
  const issues = checkClientFiles(clientFiles, controllerPrefixes);

  if (issues.length === 0) {
    console.log(
      '✅ API route consistency check passed! All client paths match backend controllers.'
    );
    process.exit(0);
  }

  // Step 4: Report issues
  console.log(`❌ route-prefix-mismatch (${issues.length} issue${issues.length > 1 ? 's' : ''}):`);
  for (const issue of issues.slice(0, 20)) {
    console.log(`   ${issue.file}:${issue.line} — ${issue.message}`);
  }
  if (issues.length > 20) {
    console.log(`   ... and ${issues.length - 20} more`);
  }
  console.log('');
  console.log(`Total: ${issues.length} error(s)`);
  console.log('');

  process.exit(1);
}

main();

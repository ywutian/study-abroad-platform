/**
 * Exact client/API route consistency gate.
 *
 * Unlike the previous prefix-only regex, this builds the backend's complete
 * HTTP method + path table and statically evaluates route helpers used by every
 * web/mobile api client call. Dynamic values normalize to `:param`.
 */
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CallExpression,
  Node,
  Project,
  SourceFile,
  SyntaxKind,
  type Expression,
  ts,
} from 'ts-morph';

const ROOT = path.resolve(__dirname, '..');
const CLIENT_ROOTS = ['apps/web/src', 'apps/mobile/src', 'packages/browser-extension/src'].map(
  (item) => path.join(ROOT, item)
);
const API_ROOT = path.join(ROOT, 'apps/api/src');
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'upload']);
const stagedOnly = process.argv.includes('--staged');

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
interface RouteIssue {
  file: string;
  line: number;
  message: string;
}

function walk(root: string, predicate: (file: string) => boolean): string[] {
  if (!fs.existsSync(root)) return [];
  const output: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.next', '__tests__', '__mocks__'].includes(entry.name)) {
        output.push(...walk(full, predicate));
      }
    } else if (predicate(full)) output.push(full);
  }
  return output;
}

export function normalizeRoute(value: string): string {
  const withoutQuery = value
    .split('?')[0]
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^.*\/api\/v1(?=\/)/, '');
  const normalized = withoutQuery
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/__PARAM__/g, ':param')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
  return normalized.startsWith('/') ? normalized || '/' : `/${normalized}`;
}

function normalizeBackendRoute(value: string): string {
  return normalizeRoute(value.replace(/(^|\/):[A-Za-z0-9_]+/g, '$1:param'));
}

/**
 * Route decorators these regexes cannot read.
 *
 * Both patterns require a string literal. `@Post(SUBSCRIBE_PATH)` matches
 * neither, so the route silently leaves the backend inventory — and this gate
 * then blames the CLIENT for it:
 *
 *   ❌ apps/web/…/timeline/page.tsx:388 — POST /timelines/personal-events/subscribe
 *      does not match any backend controller method.
 *   ❌ apps/mobile/src/app/timeline.tsx:247 — …
 *
 * Two files, two line numbers, pointing at working code. The backend route is
 * fine; the reader is sent to delete a correct call. Measured 2026-08-06 by
 * seeding exactly that.
 *
 * Note this only surfaces where no `:param` route can absorb the path — a
 * decorator under a controller that also has `@Get(':id')` disappears without a
 * murmur instead. Silent or misdirected, neither is the truth, so an unreadable
 * decorator is now its own error.
 *
 * All 64 controllers and 733 method decorators are literals today.
 */
export function unreadableDecorators(content: string, label: string): string[] {
  const problems: string[] = [];
  if (/@Controller\(/.test(content) && !/@Controller\(\s*['"][^'"]*['"]\s*\)/.test(content)) {
    problems.push(
      `${label} — @Controller() is not a string literal, so EVERY route in this file is absent ` +
        `from the backend inventory. Client calls to them will be reported as unmatched.`
    );
  }
  const all = content.match(/@(?:Get|Post|Put|Patch|Delete)\(/g)?.length ?? 0;
  const literal =
    content.match(/@(?:Get|Post|Put|Patch|Delete)\(\s*(?:['"][^'"]*['"])?\s*\)/g)?.length ?? 0;
  if (all > literal) {
    problems.push(
      `${label} — ${all - literal} route decorator(s) are not string literals, so those routes ` +
        `are absent from the backend inventory. A client call to one is reported against the ` +
        `CLIENT file, which is not where the problem is.`
    );
  }
  return problems;
}

/** Parse decorators without assuming one method per path. */
export function extractControllerRoutes(content: string): Set<string> {
  const routes = new Set<string>();
  const controller = content.match(/@Controller\(\s*['"]([^'"]*)['"]\s*\)/)?.[1];
  if (controller == null) return routes;
  const decorator = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"]([^'"]*)['"])?\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = decorator.exec(content))) {
    const method = match[1].toUpperCase() as HttpMethod;
    const suffix = match[2] ?? '';
    routes.add(`${method} ${normalizeBackendRoute(`${controller}/${suffix}`)}`);
  }
  return routes;
}

function buildBackendRoutes(): Set<string> {
  const routes = new Set<string>();
  const unreadable: string[] = [];
  for (const file of walk(API_ROOT, (item) => item.endsWith('.controller.ts'))) {
    const content = fs.readFileSync(file, 'utf8');
    unreadable.push(...unreadableDecorators(content, path.relative(ROOT, file)));
    for (const route of extractControllerRoutes(content)) routes.add(route);
  }
  if (unreadable.length > 0) {
    console.error('\n❌ Route decorators this check cannot read:\n');
    for (const u of unreadable) console.error('   ' + u);
    console.error(
      '\n   The backend inventory is short by those routes, so the mismatch this gate\n' +
        '   reports next would name the wrong file. Use a string literal.\n'
    );
    process.exit(1);
  }
  return routes;
}

type Bindings = Map<string, string[]>;

function definitionsFor(node: Node) {
  const target = Node.isPropertyAccessExpression(node) ? node.getNameNode() : node;
  if (!Node.isIdentifier(target)) return [];
  return target
    .getDefinitions()
    .map((definition) => definition.getDeclarationNode())
    .filter(Boolean) as Node[];
}

function combine(left: string[], right: string[]): string[] {
  const output: string[] = [];
  for (const a of left) for (const b of right) output.push(a + b);
  return output;
}

/** Recursively resolve literals, imported route helpers, aliases and local wrappers. */
export function evaluateRouteExpression(
  expression: Expression,
  bindings: Bindings = new Map(),
  seen = new Set<Node>()
): string[] {
  if (seen.has(expression)) return [];
  seen.add(expression);
  if (Node.isStringLiteral(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
    return [expression.getLiteralText()];
  }
  if (Node.isTemplateExpression(expression)) {
    let values = [expression.getHead().getLiteralText()];
    for (const span of expression.getTemplateSpans()) {
      const dynamic = evaluateRouteExpression(span.getExpression(), bindings, new Set(seen));
      values = combine(values, dynamic.length ? dynamic : [':param']);
      values = values.map((value) => value + span.getLiteral().getLiteralText());
    }
    return values;
  }
  if (Node.isParenthesizedExpression(expression) || Node.isAsExpression(expression)) {
    return evaluateRouteExpression(expression.getExpression(), bindings, seen);
  }
  if (Node.isConditionalExpression(expression)) {
    return [
      ...evaluateRouteExpression(expression.getWhenTrue(), bindings, new Set(seen)),
      ...evaluateRouteExpression(expression.getWhenFalse(), bindings, new Set(seen)),
    ];
  }
  if (
    Node.isBinaryExpression(expression) &&
    expression.getOperatorToken().getKind() === SyntaxKind.PlusToken
  ) {
    return combine(
      evaluateRouteExpression(expression.getLeft(), bindings, new Set(seen)),
      evaluateRouteExpression(expression.getRight(), bindings, new Set(seen))
    );
  }
  if (Node.isIdentifier(expression)) {
    const bound = bindings.get(expression.getText());
    if (bound) return bound;
    for (const declaration of definitionsFor(expression)) {
      if (Node.isVariableDeclaration(declaration) && declaration.getInitializer()) {
        return evaluateRouteExpression(
          declaration.getInitializerOrThrow(),
          bindings,
          new Set(seen)
        );
      }
      if (Node.isParameterDeclaration(declaration)) return [':param'];
      if (Node.isImportSpecifier(declaration)) {
        const symbol = expression.getSymbol()?.getAliasedSymbol();
        for (const item of symbol?.getDeclarations() ?? []) {
          if (Node.isVariableDeclaration(item) && item.getInitializer()) {
            return evaluateRouteExpression(item.getInitializerOrThrow(), bindings, new Set(seen));
          }
        }
      }
    }
    return [':param'];
  }
  if (Node.isPropertyAccessExpression(expression)) {
    for (const declaration of definitionsFor(expression)) {
      if (Node.isPropertyAssignment(declaration)) {
        return evaluateRouteExpression(declaration.getInitializer(), bindings, new Set(seen));
      }
      if (Node.isShorthandPropertyAssignment(declaration)) {
        const local = declaration.getLocalTargetSymbol()?.getDeclarations()[0];
        if (local && Node.isVariableDeclaration(local) && local.getInitializer()) {
          return evaluateRouteExpression(local.getInitializerOrThrow(), bindings, new Set(seen));
        }
      }
    }
    return [':param'];
  }
  if (Node.isCallExpression(expression)) {
    const callable = expression.getExpression();
    const args = expression.getArguments();
    const declarations = definitionsFor(callable);
    for (const declaration of declarations) {
      let fn: Node | undefined = declaration;
      if (Node.isPropertyAssignment(declaration)) fn = declaration.getInitializer();
      if (Node.isVariableDeclaration(declaration)) fn = declaration.getInitializer();
      if (
        fn &&
        (Node.isArrowFunction(fn) ||
          Node.isFunctionExpression(fn) ||
          Node.isFunctionDeclaration(fn) ||
          Node.isMethodDeclaration(fn))
      ) {
        const next = new Map(bindings);
        fn.getParameters().forEach((parameter, index) => {
          const argument = args[index];
          next.set(
            parameter.getName(),
            argument && Node.isExpression(argument)
              ? evaluateRouteExpression(argument, bindings, new Set(seen))
              : [':param']
          );
        });
        const body = fn.getBody();
        if (Node.isExpression(body)) return evaluateRouteExpression(body, next, new Set(seen));
        const returned = body?.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0]?.getExpression();
        if (returned) return evaluateRouteExpression(returned, next, new Set(seen));
      }
    }
    // Encoding/string conversion around a path parameter.
    if (
      Node.isIdentifier(callable) &&
      ['encodeURIComponent', 'String'].includes(callable.getText())
    ) {
      return args[0] && Node.isExpression(args[0])
        ? evaluateRouteExpression(args[0], bindings, new Set(seen))
        : [':param'];
    }
    return [];
  }
  return [];
}

function apiAliases(source: SourceFile): Set<string> {
  const names = new Set(['apiClient']);
  for (const declaration of source.getImportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (!specifier.includes('/lib/api') && specifier !== '@/lib/api') continue;
    for (const item of declaration.getNamedImports()) {
      if (item.getName() === 'apiClient')
        names.add(item.getAliasNode()?.getText() ?? item.getName());
    }
  }
  return names;
}

function callMethod(
  call: CallExpression,
  aliases: Set<string>
): { method: HttpMethod; argument: Expression } | null {
  const expression = call.getExpression();
  if (Node.isIdentifier(expression) && ['fetch', 'expoFetch'].includes(expression.getText())) {
    const argument = call.getArguments()[0];
    if (!argument || !Node.isExpression(argument)) return null;
    const options = call.getArguments()[1];
    let method: HttpMethod = 'GET';
    if (options && Node.isObjectLiteralExpression(options)) {
      const methodProperty = options.getProperty('method');
      if (methodProperty && Node.isPropertyAssignment(methodProperty)) {
        const initializer = methodProperty.getInitializer();
        if (initializer && Node.isStringLiteral(initializer)) {
          method = initializer.getLiteralText().toUpperCase() as HttpMethod;
        }
      }
    }
    return { method, argument };
  }
  if (!Node.isPropertyAccessExpression(expression)) return null;
  if (!aliases.has(expression.getExpression().getText())) return null;
  const name = expression.getName();
  if (!METHODS.has(name)) return null;
  const argument = call.getArguments()[0];
  if (!argument || !Node.isExpression(argument)) return null;
  return { method: (name === 'upload' ? 'POST' : name.toUpperCase()) as HttpMethod, argument };
}

function stagedFiles(): string[] {
  const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .filter((file) => /apps\/(web|mobile)\/src\/.*\.tsx?$/.test(file))
    .map((file) => path.join(ROOT, file));
}

function checkClientRoutes(project: Project, backend: Set<string>, files: string[]): RouteIssue[] {
  const issues: RouteIssue[] = [];
  for (const file of files) {
    const source = project.getSourceFile(file);
    if (!source) continue;
    const aliases = apiAliases(source);
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const apiCall = callMethod(call, aliases);
      if (!apiCall) continue;
      const line = call.getStartLineNumber();
      const sourceLines = source.getFullText().split('\n');
      const callContext = sourceLines.slice(line - 1, call.getEndLineNumber()).join('\n');
      if (callContext.includes('@route-lint-ignore')) continue;
      const evaluated = evaluateRouteExpression(apiCall.argument).map(normalizeRoute);
      if (evaluated.length === 0 || evaluated.every((route) => !route.startsWith('/'))) {
        issues.push({
          file: path.relative(ROOT, file),
          line,
          message: `Cannot statically resolve ${apiCall.method} route; use a shared route helper or add a documented @route-lint-ignore.`,
        });
        continue;
      }
      for (const route of new Set(evaluated)) {
        const key = `${apiCall.method} ${normalizeBackendRoute(route)}`;
        const [method, clientPath] = key.split(' ', 2);
        const clientSegments = clientPath.split('/').filter(Boolean);
        if (clientSegments.length > 0 && clientSegments.every((segment) => segment === ':param')) {
          issues.push({
            file: path.relative(ROOT, file),
            line,
            message: `Cannot prove ${apiCall.method} ${clientPath}; generic endpoint helpers require a documented @route-lint-ignore at the call site.`,
          });
          continue;
        }
        const compatible = [...backend].some((candidate) => {
          const [backendMethod, backendPath] = candidate.split(' ', 2);
          if (backendMethod !== method) return false;
          const backendSegments = backendPath.split('/').filter(Boolean);
          return (
            clientSegments.length === backendSegments.length &&
            clientSegments.every(
              (segment, index) =>
                segment === ':param' ||
                backendSegments[index] === ':param' ||
                segment === backendSegments[index]
            )
          );
        });
        if (!compatible) {
          issues.push({
            file: path.relative(ROOT, file),
            line,
            message: `${key} does not match any backend controller method.`,
          });
        }
      }
    }
  }
  return issues;
}

export function main() {
  if (process.argv.includes('--self-test')) {
    const routes = extractControllerRoutes(`
      @Controller('widgets') class C {
        @Get(':id') read() {}
        @Post(':id') write() {}
      }
    `);
    assert.deepEqual(routes, new Set(['GET /widgets/:param', 'POST /widgets/:param']));
    const fixture = new Project({ useInMemoryFileSystem: true }).createSourceFile(
      'fixture.ts',
      `
      const base = '/widgets';
      const routes = { byId: (id: string) => \`\${base}/\${id}\` };
      const wrapper = (id: string) => routes.byId(id);
      apiClient.get(wrapper(widgetId));
    `
    );
    const call = fixture
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((item) => item.getText().startsWith('apiClient.get'))!;
    assert.equal(
      normalizeRoute(evaluateRouteExpression(call.getArguments()[0] as Expression)[0]),
      '/widgets/:param'
    );
    assert.equal(normalizeRoute('/widgets/${id}?preview=1'), '/widgets/:param');
    const fixtureProject = new Project({ useInMemoryFileSystem: true });
    const validFixture = fixtureProject.createSourceFile(
      '/fixtures/valid.ts',
      `
        const base = '/widgets';
        const routes = { byId: (id: string) => \`\${base}/\${id}\` };
        const extractedHelper = (id: string) => routes.byId(id);
        apiClient.get(extractedHelper(widgetId));
        apiClient.post('/widgets', { name: 'valid' });
        fetch('https://api.example.test/api/v1/widgets/widget-1');
        fetch('/api/v1/widgets', { method: 'POST' });
      `
    );
    const invalidFixture = fixtureProject.createSourceFile(
      '/fixtures/invalid.ts',
      `
        apiClient.delete('/widgets');
        apiClient.get(\`/widgets/\${widgetId}/tasks\`);
        fetch('/api/v1/widgets', { method: 'DELETE' });
      `
    );
    const fixtureBackend = new Set(['GET /widgets/:param', 'POST /widgets']);
    assert.deepEqual(
      checkClientRoutes(fixtureProject, fixtureBackend, [validFixture.getFilePath()]),
      []
    );
    const rejected = checkClientRoutes(fixtureProject, fixtureBackend, [
      invalidFixture.getFilePath(),
    ]);
    assert.equal(rejected.length, 3);
    assert.ok(rejected.some((issue) => issue.message.includes('DELETE /widgets')));
    assert.ok(rejected.some((issue) => issue.message.includes('GET /widgets/:param/tasks')));
    console.log(
      '✅ Exact route gate fixtures passed (valid calls, wrong methods, wrong suffixes, multi-method, helper extraction, dynamic params, query normalization).'
    );
    return;
  }
  const backend = buildBackendRoutes();
  const project = new Project({
    compilerOptions: {
      baseUrl: ROOT,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      paths: {
        '@study-abroad/shared': ['packages/shared/src/index.ts'],
        '@study-abroad/shared/*': ['packages/shared/src/*'],
      },
    },
    skipFileDependencyResolution: false,
  });
  project.addSourceFilesAtPaths([
    path.join(ROOT, 'packages/shared/src/**/*.ts'),
    ...CLIENT_ROOTS.map((root) => path.join(root, '**/*.{ts,tsx}')),
  ]);
  const files = stagedOnly
    ? stagedFiles()
    : CLIENT_ROOTS.flatMap((root) =>
        walk(root, (file) => /\.tsx?$/.test(file) && !/\.(spec|test)\./.test(file))
      );
  const issues = checkClientRoutes(project, backend, files);
  console.log(
    `🔍 Exact route gate scanned ${files.length} client files against ${backend.size} backend method/path pairs.`
  );
  if (issues.length) {
    for (const issue of issues.slice(0, 80))
      console.error(`❌ ${issue.file}:${issue.line} — ${issue.message}`);
    if (issues.length > 80) console.error(`… and ${issues.length - 80} more`);
    process.exitCode = 1;
    return;
  }
  console.log(
    '✅ Every statically declared client API call matches an exact backend method + path.'
  );
}

if (require.main === module) main();

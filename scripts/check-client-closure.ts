import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FULL_UI_SURFACE_ROUTES } from '../e2e/full-ui-surface.registry';
import { CLIENT_CLOSURE_MANIFEST } from './client-closure-manifest';
import { MOBILE_UI_SURFACE_ROUTES } from './mobile-ui-surface.registry';
import { buildFullSurfaceRegistry } from './release-gate/full-surface-registry';

const ROOT = path.resolve(__dirname, '..');
const API_ROOT = path.join(ROOT, 'apps/api/src');

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function assertExactInventory(
  discovered: readonly string[],
  registered: readonly string[],
  label: string
) {
  const uniqueDiscovered = uniqueSorted(discovered);
  const uniqueRegistered = uniqueSorted(registered);
  assert.equal(
    uniqueRegistered.length,
    registered.length,
    `${label}: registry contains duplicate route patterns`
  );

  const missing = uniqueDiscovered.filter((route) => !uniqueRegistered.includes(route));
  const stale = uniqueRegistered.filter((route) => !uniqueDiscovered.includes(route));
  assert.deepEqual(
    { missing, stale },
    { missing: [], stale: [] },
    `${label}: route inventory drifted (missing = discovered but unregistered; stale = registered without a route file)`
  );
}

function assertConcretePath(pattern: string, concretePath: string, label: string) {
  assert.ok(
    pattern.startsWith('/') && concretePath.startsWith('/'),
    `${label}: paths must be absolute`
  );
  const patternSegments = pattern.split('/').filter(Boolean);
  const concreteSegments = concretePath.split('?')[0].split('/').filter(Boolean);
  assert.equal(
    concreteSegments.length,
    patternSegments.length,
    `${label}: concrete fixture path does not match route pattern`
  );
  patternSegments.forEach((segment, index) => {
    if (segment.startsWith(':') || /^\[.+\]$/.test(segment)) {
      assert.ok(
        concreteSegments[index],
        `${label}: dynamic segment ${segment} has no fixture value`
      );
      return;
    }
    assert.equal(
      concreteSegments[index],
      segment,
      `${label}: concrete fixture path does not match route pattern`
    );
  });
}

function publicWebRoute(route: string) {
  if (route === '/') return '/';
  return route.replace(/^\/:locale(?=\/|$)/, '') || '/';
}

function normalizedInventoryRoute(route: string) {
  return route
    .replace(/\[\.\.\.([^\]]+)\]/g, ':param*')
    .replace(/\[([^\]]+)\]/g, ':param')
    .replace(/:[A-Za-z0-9_]+\*?/g, ':param');
}

function runInventorySelfTest() {
  assert.doesNotThrow(() => assertExactInventory(['/a', '/b'], ['/b', '/a'], 'fixture'));
  assert.throws(() => assertExactInventory(['/a', '/new'], ['/a'], 'fixture'), /unregistered/);
  assert.throws(
    () => assertExactInventory(['/a'], ['/a', '/removed'], 'fixture'),
    /without a route file/
  );
  assert.throws(
    () => assertExactInventory(['/a'], ['/a', '/a'], 'fixture'),
    /duplicate route patterns/
  );
  assert.doesNotThrow(() => assertConcretePath('/item/:id', '/item/e2e-id', 'fixture'));
  assert.throws(
    () => assertConcretePath('/item/:id', '/item', 'fixture'),
    /does not match route pattern/
  );
  console.log('✅ Client route inventory fixture tests passed.');
}

if (process.argv.includes('--self-test')) {
  runInventorySelfTest();
  process.exit(0);
}

function normalizeRoute(value: string) {
  const normalized = value
    .split('?')[0]
    .replace(/(^|\/):[A-Za-z0-9_]+/g, '$1:param')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
  return normalized.startsWith('/') ? normalized || '/' : `/${normalized}`;
}

function walkFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(target);
    return [target];
  });
}

function backendOperations() {
  const operations = new Set<string>();
  for (const file of walkFiles(API_ROOT).filter((item) => item.endsWith('.controller.ts'))) {
    const content = fs.readFileSync(file, 'utf8');
    const controller = content.match(/@Controller\(\s*['"]([^'"]*)['"]\s*\)/)?.[1];
    if (controller == null) continue;
    const decorator = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"]([^'"]*)['"])?\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = decorator.exec(content))) {
      operations.add(
        `${match[1].toUpperCase()} ${normalizeRoute(`${controller}/${match[2] ?? ''}`)}`
      );
    }
  }
  return operations;
}

function operationMatchesBackend(operation: string, backend: Set<string>) {
  const [method, operationPath] = operation.split(' ', 2);
  const segments = operationPath.split('/').filter(Boolean);
  return [...backend].some((candidate) => {
    const [candidateMethod, candidatePath] = candidate.split(' ', 2);
    const candidateSegments = candidatePath.split('/').filter(Boolean);
    return (
      method === candidateMethod &&
      segments.length === candidateSegments.length &&
      segments.every(
        (segment, index) =>
          segment === ':param' ||
          candidateSegments[index] === ':param' ||
          segment === candidateSegments[index]
      )
    );
  });
}

const backend = backendOperations();
const fullSurfaceRegistry = buildFullSurfaceRegistry();
const WEB_NON_PRODUCT_ROUTES: Record<string, string> = {
  '/qa/application-analysis/[caseId]':
    'E2E-only visual fixture guarded by ENABLE_E2E_FIXTURES and 404 in production',
};
const discoveredWebRoutes = uniqueSorted(
  fullSurfaceRegistry.routeInventory.web.map((surface) =>
    normalizedInventoryRoute(publicWebRoute(surface.routeMetadata.routeTemplate))
  )
);
const registeredWebRoutes = FULL_UI_SURFACE_ROUTES.filter(
  (surface) => !WEB_NON_PRODUCT_ROUTES[surface.pattern]
).map((surface) => normalizedInventoryRoute(surface.pattern));
const discoveredMobileRoutes = fullSurfaceRegistry.routeInventory.mobile.map((surface) =>
  normalizedInventoryRoute(surface.routeMetadata.routeTemplate)
);
const registeredMobileRoutes = MOBILE_UI_SURFACE_ROUTES.map((surface) =>
  normalizedInventoryRoute(surface.pattern)
);

assertExactInventory(discoveredWebRoutes, registeredWebRoutes, 'web');
assertExactInventory(discoveredMobileRoutes, registeredMobileRoutes, 'mobile');

for (const route of Object.keys(WEB_NON_PRODUCT_ROUTES)) {
  assert.ok(
    FULL_UI_SURFACE_ROUTES.some((surface) => surface.pattern === route),
    `web non-product route waiver is stale: ${route}`
  );
}

for (const surface of FULL_UI_SURFACE_ROUTES) {
  assertConcretePath(surface.pattern, surface.path, `web ${surface.pattern}`);
  assert.ok(surface.name.trim(), `web ${surface.pattern}: missing name`);
  assert.ok(
    ['guest', 'user', 'admin'].includes(surface.role),
    `web ${surface.pattern}: invalid role`
  );
}

for (const surface of MOBILE_UI_SURFACE_ROUTES) {
  assertConcretePath(surface.pattern, surface.path, `mobile ${surface.pattern}`);
  assert.ok(surface.name.trim(), `mobile ${surface.pattern}: missing name`);
  assert.ok(
    ['guest', 'user', 'admin'].includes(surface.role),
    `mobile ${surface.pattern}: invalid role`
  );
  assert.ok(
    ['navigable', 'contextual'].includes(surface.state),
    `mobile ${surface.pattern}: invalid state`
  );
}

const WEB_CONTEXTUAL_ROUTES: Record<string, string> = {
  '/register/invite': 'invitation URL generated by an administrator',
  '/reset-password': 'tokenized link delivered by email',
  '/verify-email': 'post-registration email verification flow',
  '/verify-email/callback': 'tokenized callback delivered by email',
  '/teams/join': 'tokenized invitation link generated by a team owner',
};

for (const route of Object.keys(WEB_CONTEXTUAL_ROUTES)) {
  assert.ok(
    FULL_UI_SURFACE_ROUTES.some((surface) => surface.pattern === route),
    `web contextual waiver is stale: ${route}`
  );
}

function hasStaticEntry(platform: 'web' | 'mobile', route: string, sourcePath: string | undefined) {
  const root = path.join(ROOT, `apps/${platform}/src`);
  const leaf = route.split('/').filter(Boolean).at(-1);
  const dynamicToken = /(:[A-Za-z0-9_]+|\[[^\]]+\])/g;
  const dynamicParts = route
    .split(dynamicToken)
    .filter((part) => part && !/^(:[A-Za-z0-9_]+|\[[^\]]+\])$/.test(part));
  const dynamicPattern = dynamicToken.test(route)
    ? new RegExp(
        dynamicParts
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('[\\s\\S]{1,160}')
      )
    : null;
  return walk(root).some((file) => {
    const relativeFile = path.relative(ROOT, file).split(path.sep).join('/');
    if (relativeFile === sourcePath) return false;
    const content = fs.readFileSync(file, 'utf8');
    const hasLiteral = [`'${route}'`, `"${route}"`, `\`${route}\``].some((literal) =>
      content.includes(literal)
    );
    if (hasLiteral) return true;
    if (dynamicPattern?.test(content)) return true;
    return (
      platform === 'mobile' &&
      leaf != null &&
      (content.includes(`name="${leaf}"`) || content.includes(`name='${leaf}'`))
    );
  });
}

for (const surface of FULL_UI_SURFACE_ROUTES) {
  if (
    surface.pattern === '/' ||
    WEB_CONTEXTUAL_ROUTES[surface.pattern] ||
    WEB_NON_PRODUCT_ROUTES[surface.pattern]
  ) {
    continue;
  }
  const sourcePath = fullSurfaceRegistry.routeInventory.web.find(
    (route) => publicWebRoute(route.routeMetadata.routeTemplate) === surface.pattern
  )?.routeMetadata.sourcePath;
  assert.ok(
    hasStaticEntry('web', surface.pattern, sourcePath),
    `web ${surface.pattern}: no static navigation entry; add an entry or an explicit contextual reason`
  );
}

for (const surface of MOBILE_UI_SURFACE_ROUTES) {
  if (surface.pattern === '/') continue;
  const sourcePath = fullSurfaceRegistry.routeInventory.mobile.find(
    (route) => route.routeMetadata.routeTemplate === surface.pattern
  )?.routeMetadata.sourcePath;
  assert.ok(
    hasStaticEntry('mobile', surface.pattern, sourcePath),
    `mobile ${surface.pattern}: route has no static or contextual navigation entry`
  );
}

const routeInventory = {
  web: new Set(registeredWebRoutes),
  mobile: new Set(registeredMobileRoutes),
};

for (const surface of CLIENT_CLOSURE_MANIFEST) {
  const route = normalizedInventoryRoute(surface.route);
  if (surface.state === 'retired' || surface.state === 'hidden') {
    assert.ok(
      !routeInventory[surface.platform].has(route),
      `${surface.platform} ${surface.route}: retired/hidden route returned to the route inventory`
    );
  } else {
    assert.ok(
      routeInventory[surface.platform].has(route),
      `${surface.platform} ${surface.route}: closure surface is absent from the complete route inventory`
    );
  }
}

function routeFile(platform: 'web' | 'mobile', route: string) {
  const clean = route.replace(/^\//, '');
  if (platform === 'web') {
    return path.join(ROOT, 'apps/web/src/app/[locale]/(main)', clean, 'page.tsx');
  }
  const direct = path.join(ROOT, 'apps/mobile/src/app', `${clean}.tsx`);
  const index = path.join(ROOT, 'apps/mobile/src/app', clean, 'index.tsx');
  return fs.existsSync(direct) ? direct : index;
}

for (const surface of CLIENT_CLOSURE_MANIFEST) {
  assert.ok(
    fs.existsSync(path.join(ROOT, surface.contractTest)),
    `${surface.route}: missing contractTest`
  );
  if (surface.state === 'navigable') {
    assert.ok(surface.entries.length > 0, `${surface.route}: navigable surface has no entry`);
    assert.ok(
      surface.operations.length > 0,
      `${surface.route}: navigable surface has no API operation`
    );
    assert.ok(
      fs.existsSync(routeFile(surface.platform, surface.route)),
      `${surface.route}: route file missing`
    );
    for (const entry of surface.entries) {
      const file = path.join(ROOT, entry);
      assert.ok(fs.existsSync(file), `${surface.route}: entry file missing: ${entry}`);
      assert.ok(
        fs.readFileSync(file, 'utf8').includes(surface.route),
        `${surface.route}: entry does not link to route`
      );
    }
  }
  if (surface.state === 'retired' || surface.state === 'hidden') {
    assert.equal(
      surface.entries.length,
      0,
      `${surface.route}: retired/hidden surface still has entries`
    );
    assert.ok(
      !fs.existsSync(routeFile(surface.platform, surface.route)),
      `${surface.route}: retired route file still exists`
    );
  }
  for (const operation of surface.operations) {
    assert.ok(operation.path.startsWith('/'), `${surface.route}: operation path must be absolute`);
    const normalized = `${operation.method} ${normalizeRoute(operation.path)}`;
    assert.ok(
      operationMatchesBackend(normalized, backend),
      `${surface.route}: ${normalized} does not match a backend controller`
    );
  }
}

const forbiddenRuntimePatterns: Array<[string, string]> = [
  ['apps/mobile/src', '/points/balance'],
  ['apps/mobile/src', '/peer-reviews/available'],
  ['apps/mobile/src', '/auth/logout-all'],
  ['apps/mobile/src', '/${timelineId}/tasks'],
  ['apps/web/src', '/verifications/upload'],
  ['apps/web/src', '`/profile/${user.id}`'],
  ['apps/web/src', 'subscriptionRoutes'],
  ['apps/mobile/src', 'subscriptionRoutes'],
  ['apps/web/src', 'adminRoutes.paymentRefund'],
  ['apps/web/src', 'adminRoutes.paymentUserSubscription'],
];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(target);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [target] : [];
  });
}

for (const [relativeRoot, pattern] of forbiddenRuntimePatterns) {
  const matches = walk(path.join(ROOT, relativeRoot)).filter((file) =>
    fs.readFileSync(file, 'utf8').includes(pattern)
  );
  assert.deepEqual(
    matches,
    [],
    `retired/broken runtime pattern returned: ${pattern} in ${matches.join(', ')}`
  );
}

console.log(
  `✅ Complete route inventory passed for ${discoveredWebRoutes.length} Web and ${discoveredMobileRoutes.length} Mobile route patterns.`
);
console.log(
  `✅ Client closure manifest passed for ${CLIENT_CLOSURE_MANIFEST.length} critical surfaces.`
);

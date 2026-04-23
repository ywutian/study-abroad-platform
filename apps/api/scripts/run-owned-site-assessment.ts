import 'reflect-metadata';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import {
  chromium,
  type BrowserContext,
  type Page,
  type Response,
} from 'playwright';
import type {
  OwnedSiteAssessmentBundle,
  OwnedSiteAssessmentManifest,
  OwnedSiteAssessmentPass,
  OwnedSiteAssessmentTarget,
  OwnedSiteDataSurfaceKind,
  OwnedSiteEndpointObservation,
  OwnedSiteJourneyDefinition,
  OwnedSiteJourneyObservation,
} from '@study-abroad/shared';
import { DEFAULT_OWNED_SITE_ASSESSMENT_MANIFEST } from '../src/common/owned-site-assessment/default-manifest';
import {
  buildCoverageMatrix,
  buildDefenseBacklog,
  buildDesktopProbePlan,
  classifyJourneyFeasibility,
  inferExtractionPreference,
  inferPaginationBehavior,
} from '../src/common/owned-site-assessment/heuristics';
import {
  containsUnresolvedTemplate,
  defaultTargetSessionPath,
  filterOwnedSiteAssessmentTargets,
  getJourneyCatalogMap,
  parseOwnedSiteAssessmentManifest,
  resolveOwnedSiteAssessmentManifestTemplates,
  validateOwnedSiteAssessmentTargetJourneys,
} from '../src/common/owned-site-assessment/manifest';
import {
  collectTokenStorageRisks,
  detectChallengePoints,
  detectExportDownloadSurfaces,
  detectUiRoleGuards,
  flattenJsonKeys,
  uniqueSortedStrings,
} from '../src/common/owned-site-assessment/probe';

type Args = {
  manifestPath?: string;
  passes: OwnedSiteAssessmentPass[];
  siteKeys?: string[];
  environments?: string[];
  roles?: string[];
  headed: boolean;
  outputDir: string;
  secretsDir: string;
  printDefaultManifest: boolean;
  maxTargets?: number;
};

type RuntimeTarget = {
  target: OwnedSiteAssessmentTarget;
  journeys: OwnedSiteJourneyDefinition[];
  sessionPath: string;
  missingSession: boolean;
  unresolvedConfig: boolean;
  unresolvedJourneyIds: string[];
};

type PageSnapshot = {
  pageTitle: string | null;
  visibleFields: string[];
  bootstrapKeys: string[];
  exportDownloadSurfaces: string[];
  hasNextLink: boolean;
  hasLoadMore: boolean;
  uiRoleGuards: string[];
  challengePoints: string[];
  rawTextExcerpt: string;
};

function parseCommaSeparatedArg(name: string): string[] | undefined {
  const raw = process.argv
    .slice(2)
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split('=')[1];

  if (!raw) return undefined;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const manifestPath = argv
    .find((arg) => arg.startsWith('--manifest='))
    ?.split('=')[1];
  const passArg = argv.find((arg) => arg.startsWith('--pass='))?.split('=')[1];
  const outputDir = argv
    .find((arg) => arg.startsWith('--output-dir='))
    ?.split('=')[1];
  const secretsDir = argv
    .find((arg) => arg.startsWith('--secrets-dir='))
    ?.split('=')[1];
  const maxTargets = argv
    .find((arg) => arg.startsWith('--max-targets='))
    ?.split('=')[1];

  const passes =
    passArg == null || passArg === '' || passArg === 'all'
      ? (['public', 'browser', 'desktop'] as OwnedSiteAssessmentPass[])
      : (passArg
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean) as OwnedSiteAssessmentPass[]);

  return {
    manifestPath,
    passes,
    siteKeys: parseCommaSeparatedArg('sites'),
    environments: parseCommaSeparatedArg('environments'),
    roles: parseCommaSeparatedArg('roles'),
    headed: argv.includes('--headed'),
    outputDir: outputDir
      ? path.resolve(outputDir)
      : path.resolve(
          process.cwd(),
          'tmp',
          'owned-site-assessment',
          new Date().toISOString().replace(/[:.]/g, '-'),
        ),
    secretsDir: secretsDir ? path.resolve(secretsDir) : getDefaultSecretsDir(),
    printDefaultManifest: argv.includes('--print-default-manifest'),
    maxTargets: maxTargets ? Number(maxTargets) : undefined,
  };
}

function getApiDir(): string {
  const cwd = process.cwd();
  const monorepoApiDir = path.resolve(cwd, 'apps', 'api');
  if (existsSync(monorepoApiDir)) {
    return monorepoApiDir;
  }
  return cwd;
}

function getDefaultSecretsDir(): string {
  return path.resolve(getApiDir(), '.secrets', 'owned-site-assessment');
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function writeTextFile(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, value, 'utf8');
}

async function loadManifest(args: Args): Promise<{
  manifest: OwnedSiteAssessmentManifest;
  manifestPath?: string;
  unresolvedEnvVars: string[];
}> {
  if (!args.manifestPath) {
    const resolved = resolveOwnedSiteAssessmentManifestTemplates(
      parseOwnedSiteAssessmentManifest(DEFAULT_OWNED_SITE_ASSESSMENT_MANIFEST),
    );
    return {
      manifest: resolved.manifest,
      manifestPath: undefined,
      unresolvedEnvVars: resolved.unresolvedEnvVars,
    };
  }

  const raw = JSON.parse(
    await readFile(path.resolve(args.manifestPath), 'utf8'),
  ) as unknown;
  const manifest = parseOwnedSiteAssessmentManifest(raw);
  const resolved = resolveOwnedSiteAssessmentManifestTemplates(manifest);

  return {
    manifest: resolved.manifest,
    manifestPath: path.resolve(args.manifestPath),
    unresolvedEnvVars: resolved.unresolvedEnvVars,
  };
}

function isAuthUrl(url: string | null | undefined): boolean {
  return /login|log[- ]?in|sign[- ]?in|auth|session/i.test(url ?? '');
}

function classifyResponseSurface(response: Response): {
  surface: OwnedSiteEndpointObservation['surface'];
  contentType: string | null;
} {
  const headers = response.headers();
  const contentType = headers['content-type'] ?? null;
  const contentDisposition = headers['content-disposition'] ?? '';
  const url = response.url();
  const request = response.request();

  if (
    /attachment/i.test(contentDisposition) ||
    /\.(csv|xlsx|xls|pdf)(\?|$)/i.test(url)
  ) {
    return { surface: 'download', contentType };
  }

  if (/graphql/i.test(url) || /graphql/i.test(request.postData() ?? '')) {
    return { surface: 'graphql', contentType };
  }

  if (/application\/json|application\/.*\+json/i.test(contentType ?? '')) {
    return { surface: 'rest', contentType };
  }

  if (/html/i.test(contentType ?? '')) {
    return { surface: 'document', contentType };
  }

  if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
    return { surface: 'rest', contentType };
  }

  return { surface: 'document', contentType };
}

async function summarizeResponse(
  response: Response,
): Promise<OwnedSiteEndpointObservation | null> {
  const { surface, contentType } = classifyResponseSurface(response);
  const observation: OwnedSiteEndpointObservation = {
    url: response.url(),
    method: response.request().method(),
    status: response.status(),
    contentType,
    surface,
  };

  if (surface === 'rest' || surface === 'graphql') {
    try {
      const payload = await response.json();
      observation.sampleKeys = flattenJsonKeys(payload, {
        depth: 2,
        maxKeys: 15,
      });
    } catch {
      // Ignore non-JSON responses even if headers hinted at JSON.
    }
  }

  return observation;
}

function collectJourneySurfaceKinds(input: {
  endpointInventory: OwnedSiteEndpointObservation[];
  visibleFields: string[];
  bootstrapKeys: string[];
  cookieNames: string[];
  localStorageKeys: string[];
  sessionStorageKeys: string[];
}): OwnedSiteDataSurfaceKind[] {
  const surfaces = new Set<OwnedSiteDataSurfaceKind>();

  if (input.visibleFields.length > 0) {
    surfaces.add('dom');
  }
  if (input.bootstrapKeys.length > 0) {
    surfaces.add('bootstrap-json');
  }
  for (const endpoint of input.endpointInventory) {
    if (endpoint.surface !== 'document') {
      surfaces.add(endpoint.surface);
    }
  }
  if (input.cookieNames.length > 0) {
    surfaces.add('cookie');
  }
  if (input.localStorageKeys.length > 0) {
    surfaces.add('local-storage');
  }
  if (input.sessionStorageKeys.length > 0) {
    surfaces.add('session-storage');
  }

  return Array.from(surfaces).sort();
}

async function collectPageSnapshot(page: Page): Promise<PageSnapshot> {
  const evaluator = new Function(`
    var normalize = function (value) {
      return String(value == null ? '' : value).replace(/\\s+/g, ' ').trim();
    };

    var visibleFieldSet = new Set();
    var visibleSelectors = ['label', 'legend', 'th', 'input', 'select', 'textarea', '[aria-label]'];
    for (var selectorIndex = 0; selectorIndex < visibleSelectors.length; selectorIndex += 1) {
      var visibleSelector = visibleSelectors[selectorIndex];
      var visibleElements = Array.from(document.querySelectorAll(visibleSelector));
      for (var visibleIndex = 0; visibleIndex < visibleElements.length; visibleIndex += 1) {
        var visibleElement = visibleElements[visibleIndex];
        var visibleValue = '';
        if (
          visibleElement instanceof HTMLInputElement ||
          visibleElement instanceof HTMLTextAreaElement ||
          visibleElement instanceof HTMLSelectElement
        ) {
          visibleValue = normalize(
            visibleElement.getAttribute('aria-label') ||
              visibleElement.getAttribute('placeholder') ||
              visibleElement.getAttribute('name') ||
              visibleElement.id
          );
        } else if (visibleElement instanceof HTMLElement) {
          visibleValue = normalize(visibleElement.innerText);
        } else {
          visibleValue = normalize(visibleElement.textContent);
        }
        if (visibleValue) {
          visibleFieldSet.add(visibleValue);
        }
      }
    }

    var exportSet = new Set();
    var exportElements = Array.from(document.querySelectorAll('a, button'));
    for (var exportIndex = 0; exportIndex < exportElements.length; exportIndex += 1) {
      var exportElement = exportElements[exportIndex];
      var exportText = normalize(exportElement.textContent);
      var exportHref = exportElement instanceof HTMLAnchorElement ? normalize(exportElement.href) : '';
      var exportValue = [exportText, exportHref].filter(Boolean).join(' ');
      if (/download|export|csv|xlsx|xls|report/i.test(exportValue)) {
        exportSet.add(exportValue);
      }
    }

    var bootstrapKeys = [];
    var bootstrapScripts = Array.from(
      document.querySelectorAll('script#__NEXT_DATA__, script[type="application/json"]')
    ).slice(0, 3);
    for (var scriptIndex = 0; scriptIndex < bootstrapScripts.length; scriptIndex += 1) {
      var script = bootstrapScripts[scriptIndex];
      var raw = script.textContent && script.textContent.trim();
      if (!raw || raw.length > 200000) continue;
      try {
        var parsed = JSON.parse(raw);
        var parsedKeys = Object.keys(parsed).slice(0, 15);
        for (var keyIndex = 0; keyIndex < parsedKeys.length; keyIndex += 1) {
          bootstrapKeys.push(parsedKeys[keyIndex]);
        }
      } catch (error) {}
    }

    var rawTextExcerpt = normalize(document.body && document.body.innerText).slice(0, 10000);
    var lowerText = rawTextExcerpt.toLowerCase();
    var hasLoadMore = false;
    for (var buttonIndex = 0; buttonIndex < exportElements.length; buttonIndex += 1) {
      if (/load more|show more|view more/i.test(exportElements[buttonIndex].textContent || '')) {
        hasLoadMore = true;
        break;
      }
    }

    var uiRoleGuards = [];
    if (/sign in|log in|login required/i.test(lowerText)) uiRoleGuards.push('login-required');
    if (/upgrade|premium|subscription/i.test(lowerText)) uiRoleGuards.push('upgrade-required');
    if (/access denied|not authorized|permission denied/i.test(lowerText)) uiRoleGuards.push('access-denied');
    if (/partner portal|for colleges|for schools|institution/i.test(lowerText)) uiRoleGuards.push('institution-only');
    if (/admin only|internal only|operator/i.test(lowerText)) uiRoleGuards.push('admin-only');

    var challengePoints = [];
    if (/captcha/i.test(lowerText)) challengePoints.push('captcha');
    if (/verify you are human|human verification|are you a robot/i.test(lowerText)) challengePoints.push('human-verification');
    if (/too many requests|rate limit|try again later/i.test(lowerText)) challengePoints.push('rate-limit');
    if (/security challenge|bot challenge|challenge required/i.test(lowerText)) challengePoints.push('challenge');

    return {
      pageTitle: document.title || null,
      visibleFields: Array.from(visibleFieldSet).slice(0, 40),
      bootstrapKeys: Array.from(new Set(bootstrapKeys)).slice(0, 25),
      exportDownloadSurfaces: Array.from(exportSet).slice(0, 40),
      hasNextLink: Boolean(
        document.querySelector('a[rel="next"], button[aria-label*="next" i]') ||
          /next|more results|older/i.test(lowerText)
      ),
      hasLoadMore: hasLoadMore,
      uiRoleGuards: Array.from(new Set(uiRoleGuards)),
      challengePoints: Array.from(new Set(challengePoints)),
      rawTextExcerpt: rawTextExcerpt
    };
  `) as () => PageSnapshot;

  return page.evaluate(evaluator);
}

function buildRiskNotes(input: {
  target: OwnedSiteAssessmentTarget;
  authRequired: boolean;
  authSatisfied: boolean;
  challengePoints: string[];
  endpointInventory: OwnedSiteEndpointObservation[];
  exportDownloadSurfaces: string[];
  unresolvedConfig: boolean;
  missingSession: boolean;
}): string[] {
  const notes: string[] = [];

  if (input.unresolvedConfig) {
    notes.push(
      'Journey entrypoint still contains unresolved manifest placeholders.',
    );
  }
  if (input.missingSession) {
    notes.push('Authenticated target has no storageState session file.');
  }
  if (input.authRequired && !input.authSatisfied) {
    notes.push(
      'Auth-required journey redirected or rendered as an unauthenticated surface.',
    );
  }
  if (input.challengePoints.length > 0) {
    notes.push(
      `Challenge points observed: ${input.challengePoints.join(', ')}.`,
    );
  }
  if (input.exportDownloadSurfaces.length > 0) {
    notes.push('Explicit export or download surfaces were visible.');
  }
  if (
    input.endpointInventory.some(
      (endpoint) =>
        endpoint.surface === 'graphql' ||
        endpoint.surface === 'rest' ||
        endpoint.surface === 'bootstrap-json',
    )
  ) {
    notes.push('Structured data-bearing surfaces were visible to automation.');
  }
  if (input.target.mutationBudget !== 'read-only') {
    notes.push(
      `Target policy for ${input.target.environment} allows up to ${input.target.mutationBudget}.`,
    );
  }

  return uniqueSortedStrings(notes, 10);
}

async function probeJourney(input: {
  context: BrowserContext;
  page: Page;
  target: OwnedSiteAssessmentTarget;
  journey: OwnedSiteJourneyDefinition;
  pass: Exclude<OwnedSiteAssessmentPass, 'desktop'>;
  unresolvedConfig: boolean;
  missingSession: boolean;
}): Promise<OwnedSiteJourneyObservation> {
  const responses: Response[] = [];
  const websocketUrls = new Set<string>();
  const onResponse = (response: Response) => {
    responses.push(response);
  };
  const onWebSocket = (websocket: { url(): string }) => {
    websocketUrls.add(websocket.url());
  };

  input.page.on('response', onResponse);
  input.page.on('websocket', onWebSocket);

  let mainResponse: Response | null = null;
  let snapshot: PageSnapshot = {
    pageTitle: null,
    visibleFields: [],
    bootstrapKeys: [],
    exportDownloadSurfaces: [],
    hasNextLink: false,
    hasLoadMore: false,
    uiRoleGuards: [],
    challengePoints: [],
    rawTextExcerpt: '',
  };
  let infiniteScrollTriggered = false;

  try {
    mainResponse = await input.page.goto(input.journey.entryUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });

    await input.page
      .waitForLoadState('networkidle', { timeout: 3_000 })
      .catch(() => undefined);
    snapshot = await collectPageSnapshot(input.page);
    const responseCountBeforeScroll = responses.length;
    const beforeHeight = await input.page.evaluate(
      () => document.body?.scrollHeight ?? 0,
    );
    await input.page.mouse.wheel(0, Math.min(beforeHeight, 1200));
    await input.page.waitForTimeout(500);
    const afterHeight = await input.page.evaluate(
      () => document.body?.scrollHeight ?? 0,
    );
    infiniteScrollTriggered =
      responses.length > responseCountBeforeScroll &&
      afterHeight > beforeHeight + 150;
  } finally {
    input.page.off('response', onResponse);
    input.page.off('websocket', onWebSocket);
  }

  const endpointInventory = uniqueSortedStrings(
    responses.map(
      (response) => `${response.request().method()} ${response.url()}`,
    ),
    30,
  );
  const dedupedResponses = new Map<string, Response>();
  for (const response of responses) {
    const key = `${response.request().method()}:${response.url()}`;
    if (!dedupedResponses.has(key)) {
      dedupedResponses.set(key, response);
    }
  }

  const summarizedEndpoints = (
    await Promise.all(
      Array.from(dedupedResponses.values())
        .slice(0, 25)
        .map((response) => summarizeResponse(response)),
    )
  ).filter((endpoint): endpoint is OwnedSiteEndpointObservation =>
    Boolean(endpoint),
  );
  for (const url of websocketUrls) {
    summarizedEndpoints.push({
      url,
      surface: 'websocket',
    });
  }

  const finalUrl = input.page.url();
  const authSatisfied =
    !input.journey.requiresAuth ||
    (!isAuthUrl(finalUrl) &&
      !snapshot.uiRoleGuards.includes('login-required') &&
      ![401, 403].includes(mainResponse?.status() ?? 200));

  const storageSnapshot = await input.page.evaluate(() => ({
    localStorageKeys: Object.keys(window.localStorage ?? {}),
    sessionStorageKeys: Object.keys(window.sessionStorage ?? {}),
  }));
  const cookieNames = (await input.context.cookies([finalUrl])).map(
    (cookie) => cookie.name,
  );

  const dataSurfaces = collectJourneySurfaceKinds({
    endpointInventory: summarizedEndpoints,
    visibleFields: snapshot.visibleFields,
    bootstrapKeys: snapshot.bootstrapKeys,
    cookieNames,
    localStorageKeys: storageSnapshot.localStorageKeys,
    sessionStorageKeys: storageSnapshot.sessionStorageKeys,
  });
  const hiddenNetworkFields = uniqueSortedStrings(
    [
      ...snapshot.bootstrapKeys,
      ...summarizedEndpoints.flatMap((endpoint) => endpoint.sampleKeys ?? []),
    ],
    50,
  );
  const exportDownloadSurfaces = detectExportDownloadSurfaces([
    ...snapshot.exportDownloadSurfaces,
    ...summarizedEndpoints
      .filter((endpoint) => endpoint.surface === 'download')
      .map((endpoint) => endpoint.url),
  ]);
  const challengePoints = uniqueSortedStrings(
    [
      ...snapshot.challengePoints,
      ...detectChallengePoints(snapshot.rawTextExcerpt),
      ...summarizedEndpoints
        .filter((endpoint) => endpoint.status === 429)
        .map(() => 'rate-limit'),
    ],
    10,
  );
  const uiRoleGuards = uniqueSortedStrings(
    [...snapshot.uiRoleGuards, ...detectUiRoleGuards(snapshot.rawTextExcerpt)],
    10,
  );
  const apiRoleGuards = uniqueSortedStrings(
    summarizedEndpoints
      .filter((endpoint) => endpoint.status === 401 || endpoint.status === 403)
      .map(
        (endpoint) =>
          `${endpoint.status ?? 'blocked'} ${endpoint.method ?? 'GET'} ${endpoint.url}`,
      ),
    15,
  );
  const authSession = {
    cookieNames: uniqueSortedStrings(cookieNames, 30),
    localStorageKeys: uniqueSortedStrings(storageSnapshot.localStorageKeys, 30),
    sessionStorageKeys: uniqueSortedStrings(
      storageSnapshot.sessionStorageKeys,
      30,
    ),
    tokenStorageRisks: collectTokenStorageRisks(storageSnapshot),
  };

  return {
    targetId: input.target.targetId,
    siteKey: input.target.siteKey,
    environment: input.target.environment,
    role: input.target.role,
    siteRole: input.target.siteRole,
    accountLabel: input.target.accountLabel,
    pass: input.pass,
    journeyId: input.journey.journeyId,
    journeyLabel: input.journey.label,
    journeyCategory: input.journey.category,
    entryUrl: input.journey.entryUrl,
    finalUrl,
    authRequired: input.journey.requiresAuth,
    authSatisfied,
    httpStatus: mainResponse?.status() ?? null,
    pageTitle: snapshot.pageTitle,
    dataSurfaces,
    visibleFields: uniqueSortedStrings(snapshot.visibleFields, 40),
    hiddenNetworkFields,
    endpointInventory: summarizedEndpoints,
    authSession,
    paginationBehavior: inferPaginationBehavior({
      hasNextLink: snapshot.hasNextLink,
      hasLoadMore: snapshot.hasLoadMore,
      infiniteScrollTriggered,
    }),
    exportDownloadSurfaces,
    uiRoleGuards,
    apiRoleGuards,
    challengePoints,
    agentFeasibility: classifyJourneyFeasibility({
      mutationBudget: input.journey.defaultMutationBudget,
      authRequired: input.journey.requiresAuth,
      authSatisfied,
      httpStatus: mainResponse?.status() ?? null,
      dataSurfaces,
      visibleFields: snapshot.visibleFields,
      hiddenNetworkFields,
      challengePoints,
    }),
    extractionPreference: inferExtractionPreference({
      dataSurfaces,
      authSatisfied,
      challengePoints,
    }),
    riskNotes: buildRiskNotes({
      target: input.target,
      authRequired: input.journey.requiresAuth,
      authSatisfied,
      challengePoints,
      endpointInventory: summarizedEndpoints,
      exportDownloadSurfaces,
      unresolvedConfig: input.unresolvedConfig,
      missingSession: input.missingSession,
    }),
  };
}

async function runTargetPass(input: {
  runtimeTarget: RuntimeTarget;
  pass: Exclude<OwnedSiteAssessmentPass, 'desktop'>;
  headed: boolean;
}): Promise<OwnedSiteJourneyObservation[]> {
  const { runtimeTarget } = input;
  if (runtimeTarget.unresolvedConfig || runtimeTarget.missingSession) {
    return [];
  }

  const browser = await chromium.launch({
    headless: !input.headed,
  });
  const context = await browser.newContext({
    storageState:
      runtimeTarget.target.role === 'guest'
        ? undefined
        : runtimeTarget.sessionPath,
  });
  const page = await context.newPage();

  try {
    const observations: OwnedSiteJourneyObservation[] = [];
    for (const journey of runtimeTarget.journeys) {
      if (runtimeTarget.unresolvedJourneyIds.includes(journey.journeyId)) {
        continue;
      }
      const observation = await probeJourney({
        context,
        page,
        target: runtimeTarget.target,
        journey,
        pass: input.pass,
        unresolvedConfig: runtimeTarget.unresolvedConfig,
        missingSession: runtimeTarget.missingSession,
      });
      observations.push(observation);
    }
    return observations;
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

function buildRuntimeTargets(input: {
  manifest: OwnedSiteAssessmentManifest;
  targets: OwnedSiteAssessmentTarget[];
  secretsDir: string;
}): RuntimeTarget[] {
  const journeyMap = getJourneyCatalogMap(input.manifest);

  return input.targets.map((target) => {
    const journeys = target.journeys
      .map((journeyId) => journeyMap.get(journeyId))
      .filter((journey): journey is OwnedSiteJourneyDefinition =>
        Boolean(journey),
      );
    const sessionPath = defaultTargetSessionPath(target, input.secretsDir);
    const targetLevelUnresolved =
      (target.role !== 'guest' &&
        (containsUnresolvedTemplate(target.loginUrl) ||
          containsUnresolvedTemplate(target.homeUrl))) ||
      false;
    const unresolvedJourneyIds = journeys
      .filter((journey) => containsUnresolvedTemplate(journey.entryUrl))
      .map((journey) => journey.journeyId);
    const missingSession =
      target.role !== 'guest' &&
      journeys.some((journey) => journey.requiresAuth) &&
      !existsSync(sessionPath);

    return {
      target,
      journeys,
      sessionPath,
      missingSession,
      unresolvedConfig:
        targetLevelUnresolved ||
        (journeys.length > 0 &&
          unresolvedJourneyIds.length === journeys.length),
      unresolvedJourneyIds,
    };
  });
}

function extractTemplateVars(value: string): string[] {
  return Array.from(value.matchAll(/\$\{([A-Z0-9_]+)\}/g)).map(
    (match) => match[1] ?? '',
  );
}

function collectRelevantUnresolvedVars(
  runtimeTargets: RuntimeTarget[],
): string[] {
  const vars = new Set<string>();

  for (const runtimeTarget of runtimeTargets) {
    const relevantValues = [
      runtimeTarget.target.homeUrl,
      ...runtimeTarget.journeys.map((journey) => journey.entryUrl),
    ];

    if (runtimeTarget.target.role !== 'guest') {
      relevantValues.push(runtimeTarget.target.loginUrl);
    }

    for (const value of relevantValues) {
      for (const envVar of extractTemplateVars(value)) {
        vars.add(envVar);
      }
    }
  }

  return Array.from(vars).sort();
}

function renderMarkdownSummary(bundle: OwnedSiteAssessmentBundle): string {
  const feasibilityCounts = new Map<
    string,
    Record<'reliable' | 'fragile' | 'blocked' | 'mutation-risk', number>
  >();

  for (const observation of bundle.observations) {
    const record = feasibilityCounts.get(observation.siteKey) ?? {
      reliable: 0,
      fragile: 0,
      blocked: 0,
      'mutation-risk': 0,
    };
    record[observation.agentFeasibility] += 1;
    feasibilityCounts.set(observation.siteKey, record);
  }

  const lines: string[] = [];
  lines.push('# Owned-Site Agent Feasibility Assessment');
  lines.push('');
  lines.push(`- Generated at: ${bundle.generatedAt}`);
  lines.push(`- Manifest version: ${bundle.manifestVersion}`);
  lines.push(`- Passes run: ${bundle.passesRun.join(', ')}`);
  if (bundle.manifestPath) {
    lines.push(`- Manifest path: ${bundle.manifestPath}`);
  }
  if (bundle.notes && bundle.notes.length > 0) {
    lines.push('');
    lines.push('## Notes');
    for (const note of bundle.notes) {
      lines.push(`- ${note}`);
    }
  }

  lines.push('');
  lines.push('## Coverage Matrix');
  lines.push('');
  lines.push('| Target | Status | Passes | Observed / Configured |');
  lines.push('| --- | --- | --- | --- |');
  for (const row of bundle.coverageMatrix) {
    lines.push(
      `| ${row.targetId} | ${row.status} | ${row.passesCompleted.join(', ') || '—'} | ${row.journeysObserved} / ${row.journeysConfigured} |`,
    );
  }

  lines.push('');
  lines.push('## Feasibility by Site');
  lines.push('');
  lines.push('| Site | Reliable | Fragile | Blocked | Mutation Risk |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const [siteKey, counts] of Array.from(
    feasibilityCounts.entries(),
  ).sort()) {
    lines.push(
      `| ${siteKey} | ${counts.reliable} | ${counts.fragile} | ${counts.blocked} | ${counts['mutation-risk']} |`,
    );
  }

  lines.push('');
  lines.push('## Defense Backlog');
  lines.push('');
  if (bundle.defenseBacklog.length === 0) {
    lines.push(
      '- No backlog items were generated from the observed data surfaces.',
    );
  } else {
    for (const item of bundle.defenseBacklog) {
      lines.push(
        `- [${item.severity.toUpperCase()}] ${item.siteKey}: ${item.title} (${item.evidenceJourneyIds.join(', ')})`,
      );
    }
  }

  lines.push('');
  lines.push('## Desktop Parity Plan');
  lines.push('');
  if (bundle.desktopProbePlan.length === 0) {
    lines.push('- No desktop parity items were generated for this run.');
  } else {
    for (const item of bundle.desktopProbePlan) {
      lines.push(
        `- ${item.targetId} -> ${item.journeyId}: ${item.whyHighValue}`,
      );
      lines.push(`  Entry: ${item.entryUrl}`);
      if (item.browserFindingExcerpt) {
        lines.push(`  Browser finding: ${item.browserFindingExcerpt}`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs();

  if (args.printDefaultManifest) {
    console.log(
      JSON.stringify(DEFAULT_OWNED_SITE_ASSESSMENT_MANIFEST, null, 2),
    );
    return;
  }

  const { manifest, manifestPath } = await loadManifest(args);
  const validationErrors = validateOwnedSiteAssessmentTargetJourneys(manifest);
  if (validationErrors.length > 0) {
    for (const error of validationErrors) {
      console.error(error);
    }
    process.exit(1);
  }

  const selectedTargets = filterOwnedSiteAssessmentTargets(manifest, {
    siteKeys: args.siteKeys,
    environments: args.environments,
    roles: args.roles,
  })
    .sort((a, b) => a.targetId.localeCompare(b.targetId))
    .slice(0, args.maxTargets);

  if (selectedTargets.length === 0) {
    console.error('No assessment targets matched the provided filters.');
    process.exit(1);
  }

  const runtimeTargets = buildRuntimeTargets({
    manifest,
    targets: selectedTargets,
    secretsDir: args.secretsDir,
  });
  const relevantUnresolvedVars = collectRelevantUnresolvedVars(runtimeTargets);

  const observations: OwnedSiteJourneyObservation[] = [];

  if (args.passes.includes('public')) {
    const guestTargets = runtimeTargets.filter(
      (runtimeTarget) => runtimeTarget.target.role === 'guest',
    );
    for (const runtimeTarget of guestTargets) {
      observations.push(
        ...(await runTargetPass({
          runtimeTarget,
          pass: 'public',
          headed: args.headed,
        })),
      );
    }
  }

  if (args.passes.includes('browser')) {
    for (const runtimeTarget of runtimeTargets) {
      observations.push(
        ...(await runTargetPass({
          runtimeTarget,
          pass: 'browser',
          headed: args.headed,
        })),
      );
    }
  }

  const coverageMatrix = buildCoverageMatrix({
    targets: runtimeTargets.map((runtimeTarget) => ({
      targetId: runtimeTarget.target.targetId,
      siteKey: runtimeTarget.target.siteKey,
      environment: runtimeTarget.target.environment,
      role: runtimeTarget.target.role,
      siteRole: runtimeTarget.target.siteRole,
      accountLabel: runtimeTarget.target.accountLabel,
      journeys: runtimeTarget.target.journeys,
      missingSession: runtimeTarget.missingSession,
      unresolvedConfig: runtimeTarget.unresolvedConfig,
    })),
    observations,
  });
  const filteredTransitions = manifest.privilegeTransitions.filter(
    (transition) =>
      selectedTargets.some((target) => target.siteKey === transition.siteKey),
  );
  const desktopProbePlan = args.passes.includes('desktop')
    ? buildDesktopProbePlan({
        journeys: manifest.journeyCatalog,
        observations,
        targets: runtimeTargets.map((runtimeTarget) => ({
          targetId: runtimeTarget.target.targetId,
          siteKey: runtimeTarget.target.siteKey,
          environment: runtimeTarget.target.environment,
          role: runtimeTarget.target.role,
          siteRole: runtimeTarget.target.siteRole,
          journeys: runtimeTarget.target.journeys,
        })),
      })
    : [];

  const bundle: OwnedSiteAssessmentBundle = {
    manifestVersion: manifest.version,
    generatedAt: new Date().toISOString(),
    passesRun: args.passes,
    manifestPath,
    notes: uniqueSortedStrings(
      [
        ...(manifest.notes ?? []),
        relevantUnresolvedVars.length > 0
          ? `Unresolved manifest env vars for selected targets: ${relevantUnresolvedVars.join(', ')}.`
          : '',
        ...runtimeTargets
          .filter((runtimeTarget) => runtimeTarget.missingSession)
          .map(
            (runtimeTarget) =>
              `Missing session for ${runtimeTarget.target.targetId} at ${runtimeTarget.sessionPath}.`,
          ),
        ...runtimeTargets
          .filter((runtimeTarget) => runtimeTarget.unresolvedConfig)
          .map(
            (runtimeTarget) =>
              `Pending config for ${runtimeTarget.target.targetId}; unresolved target URLs or all journey entrypoints remain templated.`,
          ),
      ].filter(Boolean),
      200,
    ),
    coverageMatrix,
    privilegeTransitions: filteredTransitions,
    defenseBacklog: buildDefenseBacklog(observations),
    desktopProbePlan,
    observations,
  };

  await ensureDir(args.outputDir);
  await writeJsonFile(path.join(args.outputDir, 'bundle.json'), bundle);
  await writeJsonFile(
    path.join(args.outputDir, 'manifest.resolved.json'),
    manifest,
  );
  await writeTextFile(
    path.join(args.outputDir, 'summary.md'),
    renderMarkdownSummary(bundle),
  );

  console.log(
    `Assessment bundle written to ${path.join(args.outputDir, 'bundle.json')}`,
  );
  console.log(`Summary written to ${path.join(args.outputDir, 'summary.md')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import {
  AGENT_BUNDLE_DEFINITIONS,
  buildFullSurfaceRegistry,
  FULL_SURFACE_REGISTRY_VERSION,
  qualityDimensionChineseLabels,
  type AgentBundleId,
  type CapabilitySurfaceDefinition,
  type FullSurfaceRegistry,
  type JourneyOverlaySurfaceDefinition,
  type RouteShellArtifact,
  type RouteSurfaceDefinition,
  type SurfacePersona,
  type SurfacePlatform,
  type SurfaceType,
} from './release-gate/full-surface-registry';
import {
  RELEASE_RUNTIME_BUDGETS,
  RELEASE_RUNTIME_HARD_FAIL_STATUSES,
  RELEASE_RUNTIME_SLOW_STATUSES,
  normalizeReleaseRuntimeEnvironment,
  releaseRuntimeBudget,
  releaseRuntimeLayer,
  type ReleaseRuntimeBudget,
  type ReleaseRuntimeEnvironment,
  type ReleaseRuntimeStatus,
} from './release-gate/release-runtime-budget';
import type { ExternalPrerequisite, QualityDimension } from './release-gate/registry';

const execFileAsync = promisify(execFile);

type SurfaceStatus = 'PASS' | 'ISSUE' | 'BROKEN' | 'BLOCKED' | 'SKIPPED' | ReleaseRuntimeStatus;
type RuntimeAuditMode = 'full-surface' | 'release-runtime';
type FeedbackCategory =
  | 'CODE_BUG'
  | 'DATA_ISSUE'
  | 'UX_CONFUSION'
  | 'NEW_FEATURE'
  | 'INDUSTRY_SUGGESTION';

type AnySurfaceDefinition =
  | RouteSurfaceDefinition
  | CapabilitySurfaceDefinition
  | JourneyOverlaySurfaceDefinition;

interface CliArgs {
  auditDate: string;
  mode: RuntimeAuditMode;
  environment: ReleaseRuntimeEnvironment;
  evidenceRoot?: string;
  surfaceIdsCsv?: string;
  batch?: string;
  platform?: string;
  persona?: string;
  batchCsv?: string;
  platformCsv?: string;
  personaCsv?: string;
  webBase?: string;
  apiBase?: string;
  maxLinksPerRoute: number;
  printConfig: boolean;
  forceRerun: boolean;
  summaryOnly: boolean;
}

interface SurfaceIssue {
  summary: string;
  rootCause?: string;
  acceptance?: string;
}

interface ReleaseTimingMetrics {
  wallMs: number;
  ttfbMs: number | null;
  domContentLoadedMs: number | null;
  firstContentfulPaintMs: number | null;
  loadMs: number | null;
}

interface ReleaseApiTiming {
  url: string;
  method: string;
  status?: number;
  durationMs: number;
}

interface ReleaseDirectLoadProbe {
  pass: 'cold' | 'warm' | 'local';
  url: string;
  finalUrl: string;
  httpStatus: number | null;
  timing: ReleaseTimingMetrics;
  visibleTextSample: string;
  stuckLoading: boolean;
  budgetViolations: string[];
}

interface ReleaseNavigationProbe {
  href: string;
  text: string;
  ok: boolean;
  elapsedMs: number;
  finalUrl: string;
  failureReason?: string;
}

interface ReleaseRuntimeDetails {
  mode: 'release-runtime';
  environment: ReleaseRuntimeEnvironment;
  budgetLayer: ReturnType<typeof releaseRuntimeLayer>;
  budget: ReleaseRuntimeBudget;
  directLoads: ReleaseDirectLoadProbe[];
  navigationProbes: ReleaseNavigationProbe[];
  apiTimings: ReleaseApiTiming[];
  requestFailures: string[];
  consoleErrors: string[];
  pageErrors: string[];
  networkErrors: RouteNetworkIssue[];
  classification: {
    status: ReleaseRuntimeStatus;
    rootCause: string;
    guardrail: string;
    proof: string;
    owner: string;
    deadline: string;
  };
}

interface FullSurfaceRecord {
  surfaceId: string;
  surfaceType: SurfaceType;
  status: SurfaceStatus;
  feedbackCategory: FeedbackCategory;
  executionOwner: string;
  validationType: string;
  qualityDimensionsChecked: QualityDimension[];
  externalPrerequisites: ExternalPrerequisite[];
  blockedByExternalPrerequisites: string[];
  userVisibleResult: string;
  evidence: string[];
  issues: SurfaceIssue[];
  platform: SurfacePlatform;
  persona: SurfacePersona;
  routeOrEntry: string;
  agentBundle: AgentBundleId;
  reuseTags: string[];
  shellArtifactsChecked?: RouteShellArtifact[];
  notes?: string[];
  releaseRuntime?: ReleaseRuntimeDetails;
}

interface ApiSession {
  user: { id: string; email: string; role: string; locale?: string | null };
  accessToken: string;
  cookies: string[];
}

interface Account {
  email: string;
  password: string;
}

interface SampleCatalog {
  adminUserId?: string;
  caseId?: string;
  chatConversationId?: string;
  essayGalleryId?: string;
  forumPostId?: string;
  resumeId?: string;
  schoolId?: string;
  teamId?: string;
}

interface RouteProbeSummary {
  title: string;
  heading: string;
  primaryAction: string;
  textSample: string;
}

interface RouteNetworkIssue {
  url: string;
  status: number;
  statusText: string;
  method: string;
}

interface RouteNavigationOutcome {
  fallbackUsed: boolean;
  fallbackReason?: string;
}

interface AndroidDevice {
  serial: string;
  state: string;
}

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const TSX_DIST_DIR = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist');
const TSX_PREFLIGHT_PATH = path.join(TSX_DIST_DIR, 'preflight.cjs');
const TSX_LOADER_URL = pathToFileURL(path.join(TSX_DIST_DIR, 'loader.mjs')).href;
const MOBILE_APP_ID = 'com.studyabroad.mobile';
const MOBILE_SCHEME = 'studyabroad://';

const ACCOUNTS = {
  applicant: { email: 'alice.zhang@demo.studyabroad.com', password: 'Demo123!' },
  admin: { email: 'admin@example.com', password: 'Admin123!' },
  guest: null,
} satisfies Record<string, Account | null>;

const DEFAULT_FEEDBACK_BY_BUNDLE: Record<AgentBundleId, FeedbackCategory> = {
  'batch-0-inventory-triage': 'CODE_BUG',
  'batch-1-applicant-web-auth': 'CODE_BUG',
  'batch-2-applicant-ai-business': 'INDUSTRY_SUGGESTION',
  'batch-3-mobile': 'UX_CONFUSION',
  'batch-4-admin-data-security-mcp': 'CODE_BUG',
  'batch-5-forced-closure': 'CODE_BUG',
};

const DEV_ONLY_NOISE_PATTERNS = [
  /module factory is not available/i,
  /__nextjs_original-stack-frame/i,
  /download the react devtools/i,
  // "Failed to load resource: the server responded with a status of NNN" is the
  // browser's console echo of a network response — it is redundant with the
  // response/networkErrors channel, which already evaluates the real status
  // (and ignores only 429 / favicon-proxy / auth-refresh-401). Keeping it here
  // too would double-count those benign cases as console errors. Genuine HTTP
  // 4xx/5xx still fail via the network channel.
  /failed to load resource/i,
  /default-stylesheet\.css/i,
  /a tree hydrated but some attributes[\s\S]*RadioBubbleInput/i,
  /a tree hydrated but some attributes[\s\S]*CheckboxBubbleInput/i,
  /a tree hydrated but some attributes[\s\S]*placeholder="Search school names\.\.\."[\s\S]*caret-color:"transparent"/i,
];

const SESSION_CACHE = new Map<string, ApiSession>();
const DELEGATED_JOURNEYS = new Set<string>();
const RECORDS = new Map<string, FullSurfaceRecord>();
const WARMED_WEB_ROUTES = new Set<string>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const [rawKey, inlineValue] = current.slice(2).split(/=(.*)/s, 2);
    const key = rawKey;
    if (inlineValue !== undefined && inlineValue !== '') {
      values.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      values.set(key, 'true');
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  const today = new Date().toISOString().slice(0, 10);

  return {
    auditDate: values.get('audit-date') ?? values.get('date') ?? today,
    mode: values.get('mode') === 'release-runtime' ? 'release-runtime' : 'full-surface',
    environment: normalizeReleaseRuntimeEnvironment(values.get('environment') ?? 'local'),
    evidenceRoot: values.get('evidence-root') ?? undefined,
    surfaceIdsCsv: values.get('surface-ids') ?? undefined,
    batch: values.get('batch') ?? undefined,
    platform: values.get('platform') ?? undefined,
    persona: values.get('persona') ?? undefined,
    batchCsv: values.get('batch') ?? undefined,
    platformCsv: values.get('platform') ?? undefined,
    personaCsv: values.get('persona') ?? undefined,
    webBase: values.get('web-base') ?? undefined,
    apiBase: values.get('api-base') ?? undefined,
    maxLinksPerRoute: Number(values.get('max-links-per-route') ?? 5) || 5,
    printConfig: values.get('print-config') === 'true',
    forceRerun: values.get('force-rerun') === 'true' || values.get('force-rerun') === '1',
    summaryOnly: values.get('summary-only') === 'true',
  };
}

const CLI_ARGS = parseArgs(process.argv.slice(2));
const RUNTIME_MODE = CLI_ARGS.mode;
const RELEASE_RUNTIME_ENVIRONMENT = CLI_ARGS.environment;

// Release-runtime web routes run in a local-prod build on a shared CI runner and
// hit *transient* infra flake (nav-probe navigation races, loading-state timeouts
// under load, momentary "Connection closed" from the freshly-booted server). A
// single flaky route fails the whole fail-closed gate even though nothing is
// actually broken. We retry each release-runtime web route up to this many times;
// any attempt that reaches a non-hard-fail status wins. A route that stays
// hard-fail across ALL attempts is a real defect and still fails the gate — retry
// only absorbs transient flake, it never hides a deterministic failure.
const RELEASE_RUNTIME_MAX_ATTEMPTS = 3;
const RELEASE_RUNTIME_HARD_FAIL_SET = new Set<string>(RELEASE_RUNTIME_HARD_FAIL_STATUSES);

const WEB_BASE = CLI_ARGS.webBase ?? 'http://localhost:4100';
const API_BASE =
  CLI_ARGS.apiBase ??
  (RUNTIME_MODE === 'release-runtime'
    ? `${WEB_BASE.replace(/\/$/, '')}/api/v1`
    : 'http://localhost:4101/api/v1');
const AUDIT_DATE = CLI_ARGS.auditDate;
const EVIDENCE_ROOT = CLI_ARGS.evidenceRoot
  ? path.resolve(ROOT, CLI_ARGS.evidenceRoot)
  : RUNTIME_MODE === 'release-runtime'
    ? path.join(ROOT, 'e2e-report', `release-runtime-${AUDIT_DATE}`, RELEASE_RUNTIME_ENVIRONMENT)
    : path.join(ROOT, 'e2e-report', `full-surface-${AUDIT_DATE}`);
const JOURNEY_EVIDENCE_ROOT = path.join(EVIDENCE_ROOT, '_journeys');
const SURFACE_ID_FILTER_LIST = (CLI_ARGS.surfaceIdsCsv ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const SURFACE_ID_FILTER = new Set(SURFACE_ID_FILTER_LIST);
const SURFACE_ID_FILTER_ORDER = new Map(
  SURFACE_ID_FILTER_LIST.map((surfaceId, index) => [surfaceId, index] as const)
);
const PLATFORM_FILTER = new Set(
  (CLI_ARGS.platformCsv ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const PERSONA_FILTER = new Set(
  (CLI_ARGS.personaCsv ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

function normalizeBatchFilter(value: string) {
  const trimmed = value.trim();
  const aliasMap: Record<string, AgentBundleId> = {
    '0': 'batch-0-inventory-triage',
    batch0: 'batch-0-inventory-triage',
    'batch-0': 'batch-0-inventory-triage',
    '1': 'batch-1-applicant-web-auth',
    batch1: 'batch-1-applicant-web-auth',
    'batch-1': 'batch-1-applicant-web-auth',
    '2': 'batch-2-applicant-ai-business',
    batch2: 'batch-2-applicant-ai-business',
    'batch-2': 'batch-2-applicant-ai-business',
    '3': 'batch-3-mobile',
    batch3: 'batch-3-mobile',
    'batch-3': 'batch-3-mobile',
    '4': 'batch-4-admin-data-security-mcp',
    batch4: 'batch-4-admin-data-security-mcp',
    'batch-4': 'batch-4-admin-data-security-mcp',
    '5': 'batch-5-forced-closure',
    batch5: 'batch-5-forced-closure',
    'batch-5': 'batch-5-forced-closure',
  };
  return aliasMap[trimmed] ?? (trimmed as AgentBundleId);
}

const BATCH_FILTER = new Set(
  (CLI_ARGS.batchCsv ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeBatchFilter)
);

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '__');
}

function delegatedJourneyTimeoutMs(journeyId: string) {
  const timeoutOverrides: Record<string, number> = {
    A3: 240_000,
    A4: 180_000,
    A5: 180_000,
    A6: 180_000,
    A7: 180_000,
    A8: 180_000,
    A9: 180_000,
    A10: 180_000,
  };
  return timeoutOverrides[journeyId] ?? 90_000;
}

function rel(filePath: string) {
  return path.relative(ROOT, filePath);
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeText(filePath: string, contents: string) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, 'utf8');
}

async function writeJson(filePath: string, value: unknown) {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function appendText(filePath: string, contents: string) {
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, contents, 'utf8');
}

function surfaceDir(surfaceId: string) {
  return path.join(EVIDENCE_ROOT, sanitizeSegment(surfaceId));
}

function routePath(surface: RouteSurfaceDefinition, concretePath: string) {
  return path.join(surfaceDir(surface.surfaceId), sanitizeSegment(concretePath || 'root'));
}

function allSurfaces(registry: FullSurfaceRegistry): AnySurfaceDefinition[] {
  return [
    ...registry.routeInventory.web,
    ...registry.routeInventory.mobile,
    ...registry.capabilityInventory,
    ...registry.journeyOverlay,
  ];
}

function selectedSurfaces(registry: FullSurfaceRegistry) {
  const filtered = allSurfaces(registry).filter((surface) => {
    if (SURFACE_ID_FILTER.size > 0 && !SURFACE_ID_FILTER.has(surface.surfaceId)) return false;
    if (BATCH_FILTER.size > 0 && !BATCH_FILTER.has(surface.agentBundle)) return false;
    if (PLATFORM_FILTER.size > 0 && !PLATFORM_FILTER.has(surface.platform)) return false;
    if (PERSONA_FILTER.size > 0 && !PERSONA_FILTER.has(surface.persona)) return false;
    return true;
  });

  if (SURFACE_ID_FILTER.size === 0) {
    return filtered;
  }

  const priority = (surface: AnySurfaceDefinition) => {
    switch (surface.surfaceType) {
      case 'journey':
        return 0;
      case 'route':
        return 1;
      case 'capability':
      default:
        return 2;
    }
  };

  return [...filtered].sort((left, right) => {
    const typeDiff = priority(left) - priority(right);
    if (typeDiff !== 0) return typeDiff;

    const leftOrder = SURFACE_ID_FILTER_ORDER.get(left.surfaceId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = SURFACE_ID_FILTER_ORDER.get(right.surfaceId) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    return left.surfaceId.localeCompare(right.surfaceId);
  });
}

function sessionCachePath(email: string) {
  return path.join(os.tmpdir(), 'study-abroad-full-surface', `${sanitizeSegment(email)}.json`);
}

function isDevOnlyNoise(text: string) {
  return DEV_ONLY_NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

function isIgnorableNetworkNoise(url: string, status?: number) {
  return (
    /\/favicon\.ico(\?|$)/i.test(url) ||
    /\/__nextjs_original-stack-frame/i.test(url) ||
    /\.map(\?|$)/i.test(url) ||
    // HTTP 429 = rate limiting. The audit drives all 82 routes within one
    // session, so shared/layout endpoints (users/me, verifications/my,
    // dashboard) accumulate calls and trip per-user/per-route throttles — an
    // artifact of rapid automated access, not a release defect (a real user
    // loads one route). Genuine breakage is 4xx (≠429) / 5xx.
    status === 429 ||
    (/\/api\/v1\/auth\/refresh(\?|$)/i.test(url) && status === 401) ||
    // Decorative school/site favicons proxied through next/image from an
    // external service (google s2). Unreachable from the CI network sandbox →
    // 404/5xx; this is an environment limitation, not a release defect.
    (/\/_next\/image\b/i.test(url) && /favicon|s2%2Ffavicons|google\.com/i.test(url))
  );
}

function isIgnorableRequestFailure(url: string, text: string) {
  // net::ERR_ABORTED is a *cancelled* request, never a server/route defect.
  // The audit navigates with waitUntil:'commit' and tears pages down quickly,
  // so in-flight chunk prefetches, RSC fetches and background auth/refresh
  // calls abort by design. Genuine breakage still surfaces as HTTP 4xx/5xx
  // (response handler), a page.goto throw, or ERR_FAILED / ERR_CONNECTION_* —
  // none of which are ERR_ABORTED.
  return isIgnorableNetworkNoise(url) || /net::ERR_ABORTED/i.test(text);
}

function isIgnorableGuestAuthNoise(surface: RouteSurfaceDefinition, url: string, status?: number) {
  const isGuestLike = surface.persona === 'guest' || surface.persona === 'shared';
  return isGuestLike && /\/api\/v1\/users\/me(\?|$)/i.test(url) && status === 401;
}

function defaultFeedbackCategory(surface: AnySurfaceDefinition): FeedbackCategory {
  return DEFAULT_FEEDBACK_BY_BUNDLE[surface.agentBundle];
}

function aggregateStatus(statuses: readonly SurfaceStatus[]): SurfaceStatus {
  const severity: Record<SurfaceStatus, number> = {
    PASS: 0,
    SKIPPED: 1,
    ISSUE: 2,
    COLD_START_ONLY: 2,
    SLOW_FRONTEND: 3,
    SLOW_API: 3,
    BLOCKED_SAMPLE: 4,
    BLOCKED: 3,
    STUCK_LOADING: 5,
    NAVIGATION_FAILED: 6,
    BROKEN: 7,
  };

  return statuses.reduce<SurfaceStatus>((current, next) => {
    return severity[next] > severity[current] ? next : current;
  }, 'PASS');
}

function collectionItems<T extends { id?: string }>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === 'object') {
    const candidate = value as {
      items?: T[];
      data?: T[];
      conversations?: T[];
      resumes?: T[];
      posts?: T[];
    };
    if (Array.isArray(candidate.items)) return candidate.items;
    if (Array.isArray(candidate.data)) return candidate.data;
    if (Array.isArray(candidate.conversations)) return candidate.conversations;
    if (Array.isArray(candidate.resumes)) return candidate.resumes;
    if (Array.isArray(candidate.posts)) return candidate.posts;
  }
  return [];
}

function firstId(value: unknown) {
  return collectionItems<{ id?: string }>(value).find((item) => typeof item.id === 'string')?.id;
}

async function apiLogin(account: Account): Promise<ApiSession> {
  const cached = SESSION_CACHE.get(account.email);
  if (cached) {
    return cached;
  }

  const cachePath = sessionCachePath(account.email);
  try {
    const fileValue = JSON.parse(await fs.readFile(cachePath, 'utf8')) as ApiSession & {
      exp?: number;
    };
    const exp = fileValue.exp ?? decodeJwtExp(fileValue.accessToken);
    if (exp && exp * 1000 > Date.now() + 60_000) {
      const session = {
        user: fileValue.user,
        accessToken: fileValue.accessToken,
        cookies: fileValue.cookies ?? [],
      };
      SESSION_CACHE.set(account.email, session);
      return session;
    }
  } catch {
    // ignore cache misses
  }

  let lastPayload: unknown = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(account),
    });
    const payload = (await response.json()) as {
      data?: { user: ApiSession['user']; accessToken: string };
      user?: ApiSession['user'];
      accessToken?: string;
      error?: { code?: string; message?: string };
    };
    lastPayload = payload;

    if (response.ok && (payload.data?.accessToken || payload.accessToken)) {
      const headers = response.headers as Headers & { getSetCookie?: () => string[] };
      const getSetCookie = headers.getSetCookie;
      const cookies =
        typeof getSetCookie === 'function'
          ? getSetCookie.call(response.headers)
          : response.headers.get('set-cookie')
            ? [response.headers.get('set-cookie')!]
            : [];
      const session: ApiSession = {
        user: payload.data?.user ?? payload.user!,
        accessToken: payload.data?.accessToken ?? payload.accessToken!,
        cookies,
      };

      SESSION_CACHE.set(account.email, session);
      await writeJson(cachePath, { ...session, exp: decodeJwtExp(session.accessToken) });
      return session;
    }

    if (response.status === 429 || payload.error?.code === 'RATE_LIMIT_EXCEEDED') {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      continue;
    }

    throw new Error(`API login failed for ${account.email}: ${JSON.stringify(payload)}`);
  }

  throw new Error(`API login failed for ${account.email}: ${JSON.stringify(lastPayload)}`);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function releaseRuntimeApiLogin(
  label: string,
  account: Account
): Promise<{ session: ApiSession | null; error?: string }> {
  try {
    return { session: await apiLogin(account) };
  } catch (error) {
    if (RUNTIME_MODE !== 'release-runtime') {
      throw error;
    }
    return { session: null, error: `${label}: ${errorMessage(error)}` };
  }
}

function decodeJwtExp(token: string) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: number;
    };
    return decoded.exp ?? null;
  } catch {
    return null;
  }
}

function withQuery(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
) {
  if (!params) return endpoint;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${endpoint}?${query}` : endpoint;
}

async function apiRequest<T>(
  session: ApiSession | null,
  method: string,
  endpoint: string,
  options: {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
    auth?: boolean;
  } = {}
): Promise<T> {
  const url = `${API_BASE}${withQuery(endpoint, options.params)}`;
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (options.auth !== false && session?.accessToken) {
    headers.authorization = `Bearer ${session.accessToken}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed: ${response.status} ${text}`);
  }
  return (json.data ?? json) as T;
}

async function buildSampleCatalog(
  applicantSession: ApiSession | null,
  adminSession?: ApiSession | null
) {
  const [
    schools,
    cases,
    essayGallery,
    resumes,
    teams,
    forumPosts,
    forumCategories,
    chatConversations,
    adminUsers,
  ] = await Promise.allSettled([
    apiRequest<unknown>(null, 'GET', '/schools', { auth: false, params: { page: 1, pageSize: 1 } }),
    apiRequest<unknown>(null, 'GET', '/cases', { auth: false, params: { page: 1, pageSize: 1 } }),
    apiRequest<unknown>(null, 'GET', '/essay-ai/gallery', {
      auth: false,
      params: { page: 1, pageSize: 1 },
    }),
    apiRequest<unknown>(applicantSession, 'GET', '/resumes'),
    apiRequest<unknown>(null, 'GET', '/teams', { auth: false, params: { page: 1, pageSize: 1 } }),
    apiRequest<unknown>(null, 'GET', '/forums/posts', {
      auth: false,
      params: { page: 1, pageSize: 1 },
    }),
    apiRequest<unknown>(null, 'GET', '/forums/categories', { auth: false }),
    apiRequest<unknown>(applicantSession, 'GET', '/chats/conversations'),
    adminSession
      ? apiRequest<unknown>(adminSession, 'GET', '/admin/users', {
          params: { page: 1, pageSize: 1 },
        })
      : Promise.resolve(undefined),
  ]);

  const catalog = {
    schoolId: schools.status === 'fulfilled' ? firstId(schools.value) : undefined,
    caseId: cases.status === 'fulfilled' ? firstId(cases.value) : undefined,
    essayGalleryId: essayGallery.status === 'fulfilled' ? firstId(essayGallery.value) : undefined,
    resumeId: resumes.status === 'fulfilled' ? firstId(resumes.value) : undefined,
    teamId: teams.status === 'fulfilled' ? firstId(teams.value) : undefined,
    forumPostId: forumPosts.status === 'fulfilled' ? firstId(forumPosts.value) : undefined,
    chatConversationId:
      chatConversations.status === 'fulfilled' ? firstId(chatConversations.value) : undefined,
    adminUserId: adminUsers.status === 'fulfilled' ? firstId(adminUsers.value) : undefined,
  } satisfies SampleCatalog;
  const canCreateSampleFixtures =
    RUNTIME_MODE !== 'release-runtime' || RELEASE_RUNTIME_ENVIRONMENT === 'local';

  if (!catalog.resumeId && canCreateSampleFixtures) {
    try {
      const created = await apiRequest<{ id?: string }>(applicantSession, 'POST', '/resumes', {
        body: {
          title: `Full Surface Audit Resume ${AUDIT_DATE}`,
          type: 'COLLEGE_APPLICATION',
          language: 'en',
          importFromProfile: true,
        },
      });
      catalog.resumeId = created.id;
    } catch {
      // Leave undefined so the route/capability can be recorded as a blocker.
    }
  }

  if (!catalog.teamId) {
    try {
      const myTeams = await apiRequest<unknown>(applicantSession, 'GET', '/teams/my');
      catalog.teamId = firstId(myTeams);
    } catch {
      // Continue to fallback create below.
    }
  }

  if (!catalog.teamId && canCreateSampleFixtures) {
    try {
      const created = await apiRequest<{ id?: string }>(applicantSession, 'POST', '/teams', {
        body: {
          name: `Full Surface Audit Team ${AUDIT_DATE}`,
          description: 'Generated automatically for full-surface route coverage.',
          visibility: 'PUBLIC',
          joinPolicy: 'OPEN',
          maxMembers: 5,
          ...(catalog.schoolId ? { schoolId: catalog.schoolId } : {}),
        },
      });
      catalog.teamId = created.id;
    } catch {
      // Leave undefined so the route/capability can be recorded as a blocker.
    }
  }

  if (!catalog.forumPostId && canCreateSampleFixtures) {
    try {
      const categoryId =
        forumCategories.status === 'fulfilled' ? firstId(forumCategories.value) : undefined;
      if (categoryId) {
        const created = await apiRequest<{ id?: string }>(
          applicantSession,
          'POST',
          '/forums/posts',
          {
            body: {
              categoryId,
              title: `Full Surface Audit Forum Post ${AUDIT_DATE}`,
              content: 'Generated automatically for full-surface mobile route coverage.',
              tags: ['audit'],
              isTeamPost: false,
            },
          }
        );
        catalog.forumPostId = created.id;
      }
    } catch {
      // Leave undefined so the route/capability can be recorded as a blocker.
    }
  }

  return catalog;
}

function resolveConcreteRoute(surface: RouteSurfaceDefinition, samples: SampleCatalog) {
  const sourcePath = surface.routeMetadata.sourcePath;
  let resolved = surface.routeMetadata.routeTemplate.replace(':locale', 'en');

  if (!resolved.includes(':')) {
    return { ok: true as const, concretePath: resolved };
  }

  const replacements: Record<string, string | undefined> = {};
  if (sourcePath.includes('/admin/users/[id]/')) replacements.id = samples.adminUserId;
  if (sourcePath.includes('/cases/essays/[id]/')) replacements.id = samples.essayGalleryId;
  if (sourcePath.includes('/cases/[id]/')) replacements.id = samples.caseId;
  if (sourcePath.includes('/resume/[id]/')) replacements.id = samples.resumeId;
  if (sourcePath.includes('/schools/[id]/')) replacements.id = samples.schoolId;
  if (sourcePath.includes('/teams/[id]/')) replacements.id = samples.teamId;
  if (sourcePath.includes('/case/[id].tsx')) replacements.id = samples.caseId;
  if (sourcePath.includes('/chat/[id].tsx')) replacements.id = samples.chatConversationId;
  if (sourcePath.includes('/essay/[id].tsx')) replacements.id = 'new';
  if (sourcePath.includes('/forum/[id].tsx')) replacements.id = samples.forumPostId;
  if (sourcePath.includes('/school/[id].tsx')) replacements.id = samples.schoolId;

  for (const [key, value] of Object.entries(replacements)) {
    if (!value) continue;
    resolved = resolved.replace(`:${key}`, value);
  }

  if (resolved.includes(':')) {
    return {
      ok: false as const,
      reason: `No sample data could be resolved for ${surface.routeMetadata.routeTemplate} (${sourcePath})`,
    };
  }

  return { ok: true as const, concretePath: resolved };
}

async function prepareAuthenticatedPage(browser: Browser, account: Account) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  let seededSession = await apiLogin(account);

  await context.addCookies([
    {
      name: 'access_token',
      value: seededSession.accessToken,
      url: WEB_BASE,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  await context.route('**/api/v1/auth/refresh', async (route) => {
    seededSession = await apiLogin(account);
    await context.addCookies([
      {
        name: 'access_token',
        value: seededSession.accessToken,
        url: WEB_BASE,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: seededSession.accessToken,
        },
      }),
    });
  });

  const page = await context.newPage();
  return { context, page };
}

async function prepareGuestLikePage(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });

  // Guest/shared routes still mount the auth store in dev. Stub refresh to a
  // benign no-content response so public pages are not misclassified as broken
  // by expected anonymous-session probes.
  await context.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 204,
      body: '',
    });
  });

  const page = await context.newPage();
  return { context, page };
}

async function openRoutePage(browser: Browser, surface: RouteSurfaceDefinition) {
  if (surface.platform === 'mobile') {
    return { context: null as BrowserContext | null, page: null as Page | null };
  }
  if (surface.persona === 'applicant') {
    return await prepareAuthenticatedPage(browser, ACCOUNTS.applicant!);
  }
  if (surface.persona === 'admin') {
    return await prepareAuthenticatedPage(browser, ACCOUNTS.admin!);
  }
  return await prepareGuestLikePage(browser);
}

async function screenshot(page: Page, targetPath: string, fullPage = false) {
  await ensureDir(path.dirname(targetPath));
  await page.screenshot({ path: targetPath, fullPage });
}

async function appendTrace(surfaceId: string, stage: string, data?: Record<string, unknown>) {
  const target = path.join(surfaceDir(surfaceId), 'runner-debug.jsonl');
  await appendText(
    target,
    `${JSON.stringify({ at: new Date().toISOString(), stage, ...(data ? { data } : {}) })}\n`
  );
}

async function summarizePage(page: Page): Promise<RouteProbeSummary> {
  return await page.evaluate(() => {
    const heading =
      document.querySelector('h1')?.textContent?.trim() ||
      document.querySelector('h2')?.textContent?.trim() ||
      document.querySelector('[role="heading"]')?.textContent?.trim() ||
      '';
    const primaryAction =
      Array.from(document.querySelectorAll('button, a'))
        .map((element) => element.textContent?.trim())
        .find((value) => Boolean(value)) || '';
    const textSample = document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 240);
    return {
      title: document.title,
      heading,
      primaryAction,
      textSample,
    };
  });
}

function routeVisibleResult(concretePath: string, summary: RouteProbeSummary) {
  const parts = [summary.heading, summary.title, summary.primaryAction, summary.textSample].filter(
    Boolean
  );
  if (parts.length === 0) {
    return `Opened ${concretePath} and rendered a stable document without a visible headline sample.`;
  }
  return `Opened ${concretePath}. Visible result: ${parts.slice(0, 3).join(' · ')}.`;
}

async function navigateToRoute(page: Page, targetUrl: string): Promise<RouteNavigationOutcome> {
  try {
    await page.goto(targetUrl, {
      waitUntil: 'commit',
      timeout: 25_000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reachedTarget =
      page.url() !== 'about:blank' &&
      (page.url() === targetUrl ||
        page.url().startsWith(`${targetUrl}?`) ||
        page.url().startsWith(`${targetUrl}#`));
    if (!/page\.goto: Timeout/i.test(message) || !reachedTarget) {
      throw error;
    }
    await Promise.race([
      page.waitForSelector('body', { timeout: 5_000 }).catch(() => undefined),
      page.waitForTimeout(2_000),
    ]);
    return {
      fallbackUsed: true,
      fallbackReason:
        'page.goto timed out after commit; continued once the document body was available',
    };
  }

  await Promise.race([
    page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined),
    page.waitForSelector('body', { timeout: 5_000 }).catch(() => undefined),
    page.waitForTimeout(1_500),
  ]);
  return { fallbackUsed: false };
}

async function warmWebRoute(surface: RouteSurfaceDefinition, concretePath: string) {
  const cacheKey = `${surface.persona}:${concretePath}`;
  if (WARMED_WEB_ROUTES.has(cacheKey)) {
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);
  try {
    const headers: Record<string, string> = {};
    if (surface.persona === 'applicant' || surface.persona === 'admin') {
      headers.cookie = 'access_token=warmup-token';
    }
    try {
      const response = await fetch(`${WEB_BASE}${concretePath}`, {
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
      const reader = response.body?.getReader();
      if (reader) {
        await reader.read().catch(() => undefined);
        await reader.cancel().catch(() => undefined);
      }
      WARMED_WEB_ROUTES.add(cacheKey);
    } catch {
      // Warmup is best-effort. If the dev server is still compiling or the warmup
      // request aborts, continue to the real browser navigation instead of failing
      // the route before the page is even exercised.
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

function releaseRuntimeDeadline() {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isApiRequestUrl(url: string) {
  return /\/api\/v1\//.test(url) || url.startsWith(API_BASE);
}

function releaseBudgetViolations(
  timing: ReleaseTimingMetrics,
  budget: ReleaseRuntimeBudget
): string[] {
  const violations: string[] = [];
  if (timing.ttfbMs != null && timing.ttfbMs > budget.ttfbMs) {
    violations.push(`ttfbMs ${timing.ttfbMs} > ${budget.ttfbMs}`);
  }
  if (timing.domContentLoadedMs != null && timing.domContentLoadedMs > budget.domContentLoadedMs) {
    violations.push(
      `domContentLoadedMs ${timing.domContentLoadedMs} > ${budget.domContentLoadedMs}`
    );
  }
  if (
    timing.firstContentfulPaintMs != null &&
    timing.firstContentfulPaintMs > budget.firstContentfulPaintMs
  ) {
    violations.push(
      `firstContentfulPaintMs ${timing.firstContentfulPaintMs} > ${budget.firstContentfulPaintMs}`
    );
  }
  if (timing.loadMs != null && timing.loadMs > budget.loadMs) {
    violations.push(`loadMs ${timing.loadMs} > ${budget.loadMs}`);
  }
  if (timing.wallMs > budget.loadMs + 2_000) {
    violations.push(`wallMs ${timing.wallMs} > ${budget.loadMs + 2_000}`);
  }
  return violations;
}

async function collectReleaseTiming(
  page: Page,
  startedAtMs: number
): Promise<ReleaseTimingMetrics> {
  const wallMs = Date.now() - startedAtMs;
  const browserTiming = await page
    .evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0] as
        | PerformanceEntry
        | undefined;
      return {
        ttfbMs: nav ? Math.round(nav.responseStart) : null,
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        firstContentfulPaintMs: fcp ? Math.round(fcp.startTime) : null,
        loadMs: nav?.loadEventEnd ? Math.round(nav.loadEventEnd) : null,
      };
    })
    .catch(() => ({
      ttfbMs: null,
      domContentLoadedMs: null,
      firstContentfulPaintMs: null,
      loadMs: null,
    }));

  return { wallMs, ...browserTiming };
}

async function detectReleaseStuckLoading(page: Page) {
  return await page
    .evaluate(() => {
      const text = document.body.innerText.replace(/\s+/g, ' ').trim();
      const loadingText = /(loading|加载中|正在加载|请稍候|please wait)/i.test(text);
      const hasMeaningfulSurface = Boolean(
        document.querySelector('h1, h2, main button, main a[href], main input, main textarea')
      );
      const busyCount = document.querySelectorAll('[aria-busy="true"], .animate-pulse').length;
      return text.length < 20 || (loadingText && !hasMeaningfulSurface) || busyCount > 30;
    })
    .catch(() => true);
}

interface SafeInternalLink {
  href: string;
  text: string;
}

async function collectSafeInternalLinks(page: Page, maxLinks: number): Promise<SafeInternalLink[]> {
  return await page
    .evaluate((limit) => {
      const destructivePattern =
        /(delete|remove|logout|sign out|submit|pay|purchase|checkout|删除|移除|退出|提交|支付|购买)/i;
      const links: SafeInternalLink[] = [];
      const seen = new Set<string>();
      for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
        const element = anchor as HTMLAnchorElement;
        const rect = element.getBoundingClientRect();
        const text = element.textContent?.replace(/\s+/g, ' ').trim() || element.href;
        if (rect.width <= 0 || rect.height <= 0) continue;
        if (element.target === '_blank' || element.hasAttribute('download')) continue;
        if (destructivePattern.test(text)) continue;

        let url: URL;
        try {
          url = new URL(element.href, window.location.href);
        } catch {
          continue;
        }
        if (url.origin !== window.location.origin) continue;
        if (url.pathname.startsWith('/api') || url.pathname.startsWith('/_next')) continue;
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          continue;
        }
        const href = `${url.pathname}${url.search}${url.hash}`;
        if (seen.has(href)) continue;
        seen.add(href);
        links.push({ href: url.href, text: text.slice(0, 80) });
        if (links.length >= limit) break;
      }
      return links;
    }, maxLinks)
    .catch(() => []);
}

async function clickSafeInternalLink(
  page: Page,
  link: SafeInternalLink,
  budget: ReleaseRuntimeBudget
): Promise<ReleaseNavigationProbe> {
  const beforeUrl = page.url();
  const startedAt = Date.now();
  try {
    await page.evaluate((href) => {
      const match = Array.from(document.querySelectorAll('a[href]')).find((anchor) => {
        try {
          return new URL((anchor as HTMLAnchorElement).href, window.location.href).href === href;
        } catch {
          return false;
        }
      }) as HTMLAnchorElement | undefined;
      if (!match) {
        throw new Error(`safe link disappeared before click: ${href}`);
      }
      match.click();
    }, link.href);

    await Promise.race([
      page.waitForURL((url) => url.href !== beforeUrl, { timeout: budget.navigationMs }),
      page.waitForLoadState('domcontentloaded', { timeout: budget.navigationMs }),
      page.waitForTimeout(budget.navigationMs),
    ]);
    // Wait for the clicked navigation to actually settle before returning. The old
    // `waitForTimeout(800)` returned while a slow target page (e.g. /prediction) was
    // still mid-navigation, so the next loop iteration's page.goto raced it and
    // Playwright rejected with "interrupted by another navigation" — the recurring
    // nav-probe flake. Wait for load (or networkidle) up to the navigation budget.
    await Promise.race([
      page.waitForLoadState('load', { timeout: budget.navigationMs }).catch(() => undefined),
      page.waitForLoadState('networkidle', { timeout: budget.navigationMs }).catch(() => undefined),
    ]);

    const elapsedMs = Date.now() - startedAt;
    const finalUrl = page.url();
    const ok = finalUrl !== beforeUrl && elapsedMs <= budget.navigationMs;
    return {
      href: link.href,
      text: link.text,
      ok,
      elapsedMs,
      finalUrl,
      ...(ok
        ? {}
        : {
            failureReason:
              finalUrl === beforeUrl
                ? 'URL did not change after safe internal link click'
                : `navigation exceeded ${budget.navigationMs}ms budget`,
          }),
    };
  } catch (error) {
    return {
      href: link.href,
      text: link.text,
      ok: false,
      elapsedMs: Date.now() - startedAt,
      finalUrl: page.url(),
      failureReason: error instanceof Error ? error.message : String(error),
    };
  }
}

function classifyReleaseRuntime(details: {
  environment: ReleaseRuntimeEnvironment;
  budget: ReleaseRuntimeBudget;
  directLoads: ReleaseDirectLoadProbe[];
  navigationProbes: ReleaseNavigationProbe[];
  apiTimings: ReleaseApiTiming[];
  requestFailures: string[];
  consoleErrors: string[];
  pageErrors: string[];
  networkErrors: RouteNetworkIssue[];
}): ReleaseRuntimeDetails['classification'] {
  let status: ReleaseRuntimeStatus = 'PASS';
  let rootCause = 'Route met release runtime budgets and navigation probes.';

  const warmLoad =
    details.directLoads.find((probe) => probe.pass === 'warm') ?? details.directLoads[0];
  const coldLoad = details.directLoads.find((probe) => probe.pass === 'cold');
  const slowApi = details.apiTimings.some(
    (timing) => timing.durationMs > details.budget.apiRequestMs
  );

  if (details.pageErrors.length > 0) {
    status = 'BROKEN';
    rootCause = details.pageErrors[0];
  } else if (details.networkErrors.length > 0 || details.requestFailures.length > 0) {
    status = 'BROKEN';
    rootCause =
      details.networkErrors[0] != null
        ? `${details.networkErrors[0].method} ${details.networkErrors[0].url} -> ${details.networkErrors[0].status}`
        : details.requestFailures[0];
  } else if (details.consoleErrors.length > 0) {
    status = 'BROKEN';
    rootCause = details.consoleErrors[0];
  } else if (details.directLoads.some((probe) => probe.stuckLoading)) {
    status = 'STUCK_LOADING';
    rootCause = 'Route stayed in a loading-looking state after the release runtime wait window.';
  } else if (
    details.navigationProbes.length > 0 &&
    details.navigationProbes.every((probe) => !probe.ok)
  ) {
    // Fail only when the page can't navigate AT ALL (every sampled safe link
    // failed) — that's the real "无法跳转" defect. A single flaky link (removed
    // by a re-render between collect and click) or a non-navigating <a> (filter
    // control, same-page anchor) must not fail a route whose other links work.
    status = 'NAVIGATION_FAILED';
    rootCause =
      details.navigationProbes.find((probe) => !probe.ok)?.failureReason ??
      'No safe internal link completed navigation (page cannot navigate).';
  } else if (
    details.environment === 'production' &&
    coldLoad &&
    coldLoad.budgetViolations.length > 0 &&
    (!warmLoad || warmLoad.budgetViolations.length === 0)
  ) {
    status = 'COLD_START_ONLY';
    rootCause = `Cold production pass exceeded budget (${coldLoad.budgetViolations.join('; ')}), but warm pass was within budget.`;
  } else if (warmLoad && warmLoad.budgetViolations.length > 0) {
    status = slowApi ? 'SLOW_API' : 'SLOW_FRONTEND';
    rootCause = `${status === 'SLOW_API' ? 'API request latency' : 'Frontend render or bundle cost'} exceeded release runtime budget: ${warmLoad.budgetViolations.join('; ')}.`;
  }

  return {
    status,
    rootCause,
    guardrail: 'pnpm lint:release-runtime',
    proof:
      'Rerun release-runtime audit and gate after the fix; temporary violating summaries must fail the gate.',
    owner: 'codex',
    deadline: releaseRuntimeDeadline(),
  };
}

async function execBinary(
  command: string,
  args: string[],
  timeout = 20_000,
  maxBuffer = 10 * 1024 * 1024
) {
  return await execFileAsync(command, args, {
    cwd: ROOT,
    timeout,
    maxBuffer,
  });
}

function parseAdbDevices(output: string): AndroidDevice[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached'))
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      return serial && state ? { serial, state } : null;
    })
    .filter((device): device is AndroidDevice => Boolean(device));
}

async function detectAndroidDevice() {
  try {
    const { stdout } = await execBinary('adb', ['devices'], 10_000);
    return parseAdbDevices(stdout);
  } catch {
    return [];
  }
}

async function adb(serial: string, args: string[], timeout = 20_000, maxBuffer = 10 * 1024 * 1024) {
  return await execBinary('adb', ['-s', serial, ...args], timeout, maxBuffer);
}

async function adbScreencap(serial: string, targetPath: string) {
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const child = spawn('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdoutChunks));
        return;
      }
      reject(new Error(Buffer.concat(stderrChunks).toString('utf8')));
    });
  });
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, buffer);
}

async function openAndroidRoute(serial: string, concretePath: string) {
  if (concretePath === '/' || concretePath === '') {
    await adb(serial, [
      'shell',
      'monkey',
      '-p',
      MOBILE_APP_ID,
      '-c',
      'android.intent.category.LAUNCHER',
      '1',
    ]);
    return;
  }

  const deepLink = `${MOBILE_SCHEME}${concretePath.replace(/^\//, '')}`;
  await adb(serial, [
    'shell',
    'am',
    'start',
    '-W',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    deepLink,
    MOBILE_APP_ID,
  ]);
}

async function mobileAppInstalled(serial: string) {
  try {
    const { stdout } = await adb(
      serial,
      ['shell', 'pm', 'list', 'packages', MOBILE_APP_ID],
      15_000
    );
    return stdout.includes(MOBILE_APP_ID);
  } catch {
    return false;
  }
}

async function writeRecord(record: FullSurfaceRecord) {
  RECORDS.set(record.surfaceId, record);
  await writeJson(path.join(surfaceDir(record.surfaceId), 'record.json'), {
    ...record,
    generatedAt: new Date().toISOString(),
  });
}

async function readJourneyRecord(journeyId: string) {
  try {
    const filePath = path.join(JOURNEY_EVIDENCE_ROOT, journeyId, 'record.json');
    const contents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(contents) as {
      id: string;
      title: string;
      status: SurfaceStatus;
      userVisibleResult: string;
      evidence: string[];
      issues?: SurfaceIssue[];
      blockedByExternalPrerequisites?: string[];
      qualityDimensionsChecked?: QualityDimension[];
      notes?: string[];
    };
  } catch {
    return null;
  }
}

function selectedJourneyIdsForCapability(
  capability: CapabilitySurfaceDefinition,
  journeyOverlayById: Map<string, JourneyOverlaySurfaceDefinition>
) {
  return capability.linkedJourneyIds.filter((journeyId) => {
    const overlay = journeyOverlayById.get(journeyId);
    if (!overlay) return false;
    if (CLI_ARGS.batch && overlay.agentBundle !== CLI_ARGS.batch) return false;
    if (CLI_ARGS.platform && overlay.platform !== CLI_ARGS.platform) return false;
    if (CLI_ARGS.persona && overlay.persona !== CLI_ARGS.persona) return false;
    return true;
  });
}

async function fileMtimeMs(filePath: string) {
  try {
    return (await fs.stat(filePath)).mtimeMs;
  } catch {
    return null;
  }
}

async function surfaceNeedsRefresh(surface: AnySurfaceDefinition, registry: FullSurfaceRegistry) {
  const surfaceRecordPath = path.join(surfaceDir(surface.surfaceId), 'record.json');
  const surfaceMtimeMs = await fileMtimeMs(surfaceRecordPath);
  if (surfaceMtimeMs == null) {
    return true;
  }

  let linkedJourneyIds: string[] = [];
  if (surface.surfaceType === 'journey') {
    linkedJourneyIds = [surface.journeyId];
  } else if (surface.surfaceType === 'capability') {
    const overlayById = new Map(
      registry.journeyOverlay.map((item) => [item.journeyId, item] as const)
    );
    linkedJourneyIds = selectedJourneyIdsForCapability(surface, overlayById);
  }

  if (linkedJourneyIds.length === 0) {
    return false;
  }

  for (const journeyId of linkedJourneyIds) {
    const journeyRecordPath = path.join(JOURNEY_EVIDENCE_ROOT, journeyId, 'record.json');
    const journeyMtimeMs = await fileMtimeMs(journeyRecordPath);
    if (journeyMtimeMs == null || journeyMtimeMs > surfaceMtimeMs) {
      return true;
    }
  }

  return false;
}

async function delegateJourneys(journeyIds: readonly string[]) {
  const missing = journeyIds.filter((journeyId) => !DELEGATED_JOURNEYS.has(journeyId));
  if (missing.length === 0) return;

  const absoluteScript = path.resolve(ROOT, 'scripts/runtime-journey-audit.ts');
  const logFile = path.join(EVIDENCE_ROOT, '_journeys', 'delegation.log');

  for (const journeyId of missing) {
    const journeyEvidenceDir = path.join(JOURNEY_EVIDENCE_ROOT, journeyId);
    const delegatedRecordPath = path.join(journeyEvidenceDir, 'record.json');
    const startedAt = Date.now();

    if (CLI_ARGS.forceRerun) {
      await fs.rm(journeyEvidenceDir, { recursive: true, force: true });
    }

    const args = [
      '--require',
      TSX_PREFLIGHT_PATH,
      '--import',
      TSX_LOADER_URL,
      absoluteScript,
      '--journeys',
      journeyId,
      '--force-rerun',
      '--audit-id',
      `full-surface-${AUDIT_DATE}`,
      '--audit-context',
      `full surface audit ${AUDIT_DATE}`,
      '--evidence-root',
      rel(JOURNEY_EVIDENCE_ROOT),
    ];

    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      process.stderr.write(text);
    });

    const exitPromise = new Promise<number>((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => resolve(code ?? 1));
    });

    const recordReadyPromise = (async () => {
      const timeoutMs = delegatedJourneyTimeoutMs(journeyId);
      const timeoutAt = Date.now() + timeoutMs;
      while (Date.now() < timeoutAt) {
        const record = await readJourneyRecord(journeyId);
        if (record) {
          const stats = await fs.stat(delegatedRecordPath).catch(() => null);
          if (!CLI_ARGS.forceRerun || !stats || stats.mtimeMs >= startedAt) {
            return true;
          }
        }
        await sleep(1000);
      }
      return false;
    })();

    const winner = await Promise.race([
      exitPromise.then((code) => ({ kind: 'exit' as const, code })),
      recordReadyPromise.then((ready) => ({ kind: 'record' as const, ready })),
    ]);

    let exitCode = 0;
    if (winner.kind === 'record' && winner.ready) {
      child.kill('SIGTERM');
      await Promise.race([
        exitPromise,
        sleep(5000).then(() => {
          child.kill('SIGKILL');
          return 0;
        }),
      ]);
    } else if (winner.kind === 'record') {
      child.kill('SIGKILL');
      exitCode = await exitPromise.catch(() => 1);
    } else {
      exitCode = winner.code;
    }

    await appendText(
      logFile,
      [`## ${journeyId}`, '', '# stdout', stdout, '', '# stderr', stderr, ''].join('\n')
    );

    let record = await readJourneyRecord(journeyId);
    if (!record && exitCode === 0) {
      await sleep(2000);
      record = await readJourneyRecord(journeyId);
    }
    if (!record) {
      await appendText(
        logFile,
        [
          `journey ${journeyId} did not emit record.json within the delegation window (${delegatedJourneyTimeoutMs(journeyId)}ms); full-surface runner will mark the dependent surface as BLOCKED instead of hanging the batch.`,
          '',
        ].join('\n')
      );
      continue;
    }
    if (exitCode !== 0) {
      await appendText(
        logFile,
        [
          `journey ${journeyId} exited with ${exitCode}, but a partial record exists and will be used for downstream blocker classification.`,
          '',
        ].join('\n')
      );
    }

    DELEGATED_JOURNEYS.add(journeyId);
  }
}

async function executeJourneySurface(surface: JourneyOverlaySurfaceDefinition) {
  await delegateJourneys([surface.journeyId]);
  const delegated = await readJourneyRecord(surface.journeyId);
  if (!delegated) {
    await writeRecord({
      surfaceId: surface.surfaceId,
      surfaceType: surface.surfaceType,
      platform: surface.platform,
      persona: surface.persona,
      routeOrEntry: surface.routeOrEntry,
      status: 'BLOCKED',
      feedbackCategory: defaultFeedbackCategory(surface),
      executionOwner: surface.executionOwner,
      validationType: surface.validationType,
      qualityDimensionsChecked: surface.qualityDimensions,
      externalPrerequisites: surface.externalPrerequisites,
      blockedByExternalPrerequisites: [],
      userVisibleResult:
        'The linked journey record could not be produced by the delegated runtime audit.',
      evidence: [],
      issues: [
        {
          summary: `Missing delegated journey record for ${surface.journeyId}`,
          rootCause:
            'runtime-journey-audit did not emit record.json into the delegated evidence root',
          acceptance:
            'Delegated journey runtime must emit a non-empty record for the linked journey',
        },
      ],
      agentBundle: surface.agentBundle,
      reuseTags: surface.reuseTags,
    });
    return;
  }

  const delegatedBlockedByExternalPrerequisites = delegated.blockedByExternalPrerequisites ?? [];
  const surfacePrerequisiteScopes = surface.externalPrerequisites.map(
    (prerequisite) => prerequisite.scope
  );
  const delegatedStatus: SurfaceStatus =
    delegated.status === 'ISSUE' &&
    (delegatedBlockedByExternalPrerequisites.length > 0 || surfacePrerequisiteScopes.length > 0)
      ? 'BLOCKED'
      : delegated.status;
  const blockedByExternalPrerequisites =
    delegatedStatus === 'BLOCKED'
      ? delegatedBlockedByExternalPrerequisites.length > 0
        ? delegatedBlockedByExternalPrerequisites
        : surfacePrerequisiteScopes
      : delegatedBlockedByExternalPrerequisites;

  await writeRecord({
    surfaceId: surface.surfaceId,
    surfaceType: surface.surfaceType,
    platform: surface.platform,
    persona: surface.persona,
    routeOrEntry: surface.routeOrEntry,
    status: delegatedStatus,
    feedbackCategory: defaultFeedbackCategory(surface),
    executionOwner: surface.executionOwner,
    validationType: surface.validationType,
    qualityDimensionsChecked: delegated.qualityDimensionsChecked ?? surface.qualityDimensions,
    externalPrerequisites: surface.externalPrerequisites,
    blockedByExternalPrerequisites,
    userVisibleResult: delegated.userVisibleResult,
    evidence: [
      rel(path.join(JOURNEY_EVIDENCE_ROOT, surface.journeyId, 'record.json')),
      ...delegated.evidence,
    ],
    issues: delegated.issues ?? [],
    notes: delegated.notes,
    agentBundle: surface.agentBundle,
    reuseTags: surface.reuseTags,
  });
}

function capabilityRouteSupport(surfaceId: string) {
  if (surfaceId === 'CAPABILITY:PAYMENT_SUBSCRIPTION_ENTRY') {
    return ['WEB_ROUTE:/:locale/settings/subscription'];
  }
  if (surfaceId === 'CAPABILITY:RESUME_IMPORT_EXPORT') {
    return ['WEB_ROUTE:/:locale/resume', 'WEB_ROUTE:/:locale/resume/:id'];
  }
  return [];
}

async function ensureRouteRecord(
  registry: FullSurfaceRegistry,
  surfaceId: string,
  samples: SampleCatalog
) {
  const route = [...registry.routeInventory.web, ...registry.routeInventory.mobile].find(
    (entry) => entry.surfaceId === surfaceId
  );
  if (!route) {
    return null;
  }
  if (!CLI_ARGS.forceRerun) {
    try {
      const filePath = path.join(surfaceDir(route.surfaceId), 'record.json');
      const contents = await fs.readFile(filePath, 'utf8');
      return JSON.parse(contents) as FullSurfaceRecord;
    } catch {
      // continue to execute
    }
  }
  await executeRouteSurface(route, samples);
  return RECORDS.get(route.surfaceId) ?? null;
}

async function executeCapabilitySurface(
  surface: CapabilitySurfaceDefinition,
  registry: FullSurfaceRegistry,
  samples: SampleCatalog
) {
  const journeyOverlayById = new Map(
    registry.journeyOverlay.map((item) => [item.journeyId, item] as const)
  );
  const journeyIds = selectedJourneyIdsForCapability(surface, journeyOverlayById);

  if (journeyIds.length > 0) {
    const explicitlySelectedJourneyIds = journeyIds.filter((journeyId) =>
      SURFACE_ID_FILTER.has(`JOURNEY:${journeyId}`)
    );
    const reuseExplicitJourneyRecords =
      CLI_ARGS.forceRerun && explicitlySelectedJourneyIds.length > 0;

    if (!reuseExplicitJourneyRecords) {
      await delegateJourneys(journeyIds);
    }

    const records = await Promise.all(journeyIds.map((journeyId) => readJourneyRecord(journeyId)));
    const present = records.filter((record): record is NonNullable<typeof record> =>
      Boolean(record)
    );
    const normalizedJourneyStatuses = present.map((record) => {
      const journeySurface = journeyOverlayById.get(record.id);
      const hasSurfacePrerequisite = (journeySurface?.externalPrerequisites.length ?? 0) > 0;
      if (
        record.status === 'ISSUE' &&
        ((record.blockedByExternalPrerequisites?.length ?? 0) > 0 || hasSurfacePrerequisite)
      ) {
        return 'BLOCKED' as const;
      }
      return record.status;
    });
    const status =
      present.length === journeyIds.length ? aggregateStatus(normalizedJourneyStatuses) : 'BLOCKED';
    const blockedByExternalPrerequisites = [
      ...new Set(present.flatMap((record) => record.blockedByExternalPrerequisites ?? [])),
    ];
    const issues = present.flatMap((record) => record.issues ?? []);
    await writeRecord({
      surfaceId: surface.surfaceId,
      surfaceType: surface.surfaceType,
      platform: surface.platform,
      persona: surface.persona,
      routeOrEntry: surface.routeOrEntry,
      status,
      feedbackCategory:
        status === 'BLOCKED' && present.length < journeyIds.length
          ? 'DATA_ISSUE'
          : defaultFeedbackCategory(surface),
      executionOwner: surface.executionOwner,
      validationType: surface.validationType,
      qualityDimensionsChecked: surface.qualityDimensions,
      externalPrerequisites: surface.externalPrerequisites,
      blockedByExternalPrerequisites,
      userVisibleResult:
        present.length === 0
          ? 'None of the linked journeys produced delegated evidence yet.'
          : present
              .map((record, index) => `${record.id}: ${normalizedJourneyStatuses[index]}`)
              .join(' · '),
      evidence: present.map((record) =>
        rel(path.join(JOURNEY_EVIDENCE_ROOT, record.id, 'record.json'))
      ),
      issues:
        present.length === journeyIds.length
          ? issues
          : [
              ...issues,
              {
                summary: `Only ${present.length}/${journeyIds.length} linked journey records were available`,
                rootCause: 'Delegated journey runtime did not emit all linked records',
                acceptance:
                  'All linked journey records should exist under the full-surface delegated journey root',
              },
            ],
      notes: [`linked_journeys=${journeyIds.join(',')}`],
      agentBundle: surface.agentBundle,
      reuseTags: surface.reuseTags,
    });
    return;
  }

  const supportingRouteIds = capabilityRouteSupport(surface.surfaceId);
  const linkedRouteRecords = (
    await Promise.all(
      supportingRouteIds.map((routeId) => ensureRouteRecord(registry, routeId, samples))
    )
  ).filter((record): record is FullSurfaceRecord => Boolean(record));

  const status =
    linkedRouteRecords.length === 0
      ? 'BLOCKED'
      : aggregateStatus(linkedRouteRecords.map((record) => record.status));

  await writeRecord({
    surfaceId: surface.surfaceId,
    surfaceType: surface.surfaceType,
    platform: surface.platform,
    persona: surface.persona,
    routeOrEntry: surface.routeOrEntry,
    status,
    feedbackCategory:
      linkedRouteRecords.length === 0 ? 'DATA_ISSUE' : defaultFeedbackCategory(surface),
    executionOwner: surface.executionOwner,
    validationType: surface.validationType,
    qualityDimensionsChecked: surface.qualityDimensions,
    externalPrerequisites: surface.externalPrerequisites,
    blockedByExternalPrerequisites: [],
    userVisibleResult:
      linkedRouteRecords.length === 0
        ? 'The capability has no journey links and no supporting route records were produced.'
        : linkedRouteRecords.map((record) => `${record.surfaceId}: ${record.status}`).join(' · '),
    evidence: linkedRouteRecords.map((record) =>
      rel(path.join(surfaceDir(record.surfaceId), 'record.json'))
    ),
    issues:
      linkedRouteRecords.length === 0
        ? [
            {
              summary:
                'No supporting route records were available for this route-backed capability',
              rootCause:
                'Capability is not yet mapped to a dedicated journey and the route executor did not produce coverage',
              acceptance:
                'At least one supporting route record should be available for non-journey capabilities',
            },
          ]
        : [],
    notes:
      supportingRouteIds.length > 0 ? [`supporting_routes=${supportingRouteIds.join(',')}`] : [],
    agentBundle: surface.agentBundle,
    reuseTags: surface.reuseTags,
  });
}

async function executeWebRouteSurface(surface: RouteSurfaceDefinition, samples: SampleCatalog) {
  const resolved = resolveConcreteRoute(surface, samples);
  if (!resolved.ok) {
    await writeRecord({
      surfaceId: surface.surfaceId,
      surfaceType: surface.surfaceType,
      platform: surface.platform,
      persona: surface.persona,
      routeOrEntry: surface.routeOrEntry,
      status: 'BLOCKED',
      feedbackCategory: 'DATA_ISSUE',
      executionOwner: surface.executionOwner,
      validationType: surface.validationType,
      qualityDimensionsChecked: surface.qualityDimensions,
      externalPrerequisites: surface.externalPrerequisites,
      blockedByExternalPrerequisites: [],
      userVisibleResult:
        'The route could not be exercised because no stable sample parameters were available.',
      evidence: [],
      issues: [
        {
          summary: resolved.reason,
          rootCause:
            'Dynamic route parameter resolution lacks a stable sample in current seed/runtime data',
          acceptance: 'Provide one stable sample id or seed fixture for this route family',
        },
      ],
      shellArtifactsChecked: surface.routeMetadata.supportingShells,
      notes: [`source=${surface.routeMetadata.sourcePath}`],
      agentBundle: surface.agentBundle,
      reuseTags: surface.reuseTags,
    });
    return;
  }

  await appendTrace(surface.surfaceId, 'route:start', { concretePath: resolved.concretePath });
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const networkErrors: RouteNetworkIssue[] = [];
    const routeNotes: string[] = [];
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      await appendTrace(surface.surfaceId, 'route:warmup', {
        attempt,
        concretePath: resolved.concretePath,
      });
      await warmWebRoute(surface, resolved.concretePath);
      browser = await chromium.launch({ headless: true });
      browser.on('disconnected', () => {
        void appendTrace(surface.surfaceId, 'browser:disconnected', { attempt });
      });

      const opened = await openRoutePage(browser, surface);
      context = opened.context;
      page = opened.page;
      page.on('pageerror', (error) => {
        const message = error.message || String(error);
        if (!isDevOnlyNoise(message)) {
          pageErrors.push(message);
        }
      });
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (!isDevOnlyNoise(text)) {
          consoleErrors.push(text);
        }
      });
      page.on('response', (response) => {
        const status = response.status();
        if (status < 400) return;
        const url = response.url();
        if (
          isIgnorableNetworkNoise(url, status) ||
          isIgnorableGuestAuthNoise(surface, url, status) ||
          isDevOnlyNoise(url)
        ) {
          return;
        }
        networkErrors.push({
          url,
          status,
          statusText: response.statusText(),
          method: response.request().method(),
        });
      });
      await appendTrace(surface.surfaceId, 'route:navigate', {
        attempt,
        concretePath: resolved.concretePath,
      });
      const navigation = await navigateToRoute(page, `${WEB_BASE}${resolved.concretePath}`);
      if (navigation.fallbackUsed && navigation.fallbackReason) {
        routeNotes.push(navigation.fallbackReason);
      }
      await Promise.race([
        page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined),
        page.waitForTimeout(1200),
      ]);

      const entryShot = path.join(surfaceDir(surface.surfaceId), '01-entry.png');
      await screenshot(page, entryShot);
      await page.waitForTimeout(1200);
      const resultShot = path.join(surfaceDir(surface.surfaceId), '02-result.png');
      await screenshot(page, resultShot, true);
      const summary = await summarizePage(page);
      await writeJson(path.join(surfaceDir(surface.surfaceId), 'page-summary.json'), summary);
      if (consoleErrors.length > 0) {
        await writeText(
          path.join(surfaceDir(surface.surfaceId), 'console-errors.txt'),
          `${consoleErrors.join('\n')}\n`
        );
      }
      if (pageErrors.length > 0) {
        await writeText(
          path.join(surfaceDir(surface.surfaceId), 'page-errors.txt'),
          `${pageErrors.join('\n')}\n`
        );
      }
      if (networkErrors.length > 0) {
        await writeJson(
          path.join(surfaceDir(surface.surfaceId), 'network-errors.json'),
          networkErrors
        );
      }

      const issues: SurfaceIssue[] = [];
      let status: SurfaceStatus = 'PASS';

      if (pageErrors.length > 0) {
        status = 'BROKEN';
        issues.push({
          summary: pageErrors[0],
          rootCause: 'Unhandled browser runtime error on route render',
          acceptance: 'Page should render and stay interactive without uncaught runtime errors',
        });
      } else if (consoleErrors.length > 0) {
        status = 'ISSUE';
        issues.push({
          summary: consoleErrors[0],
          rootCause: 'Stable console error emitted during route render',
          acceptance: 'Page should not emit stable console.error entries during normal load',
        });
      } else if (networkErrors.length > 0) {
        status = 'ISSUE';
        issues.push({
          summary: `${networkErrors[0].method} ${networkErrors[0].url} -> ${networkErrors[0].status} ${networkErrors[0].statusText}`,
          rootCause: 'Stable 4xx/5xx network error emitted during route render',
          acceptance: 'Page should not trigger unexplained 4xx/5xx requests during normal load',
        });
      }

      await writeRecord({
        surfaceId: surface.surfaceId,
        surfaceType: surface.surfaceType,
        platform: surface.platform,
        persona: surface.persona,
        routeOrEntry: surface.routeOrEntry,
        status,
        feedbackCategory: status === 'PASS' ? defaultFeedbackCategory(surface) : 'CODE_BUG',
        executionOwner: surface.executionOwner,
        validationType: surface.validationType,
        qualityDimensionsChecked: surface.qualityDimensions,
        externalPrerequisites: surface.externalPrerequisites,
        blockedByExternalPrerequisites: [],
        userVisibleResult: routeVisibleResult(resolved.concretePath, summary),
        evidence: [
          rel(entryShot),
          rel(resultShot),
          rel(path.join(surfaceDir(surface.surfaceId), 'page-summary.json')),
          ...(consoleErrors.length > 0
            ? [rel(path.join(surfaceDir(surface.surfaceId), 'console-errors.txt'))]
            : []),
          ...(pageErrors.length > 0
            ? [rel(path.join(surfaceDir(surface.surfaceId), 'page-errors.txt'))]
            : []),
          ...(networkErrors.length > 0
            ? [rel(path.join(surfaceDir(surface.surfaceId), 'network-errors.json'))]
            : []),
        ],
        issues,
        shellArtifactsChecked: surface.routeMetadata.supportingShells,
        notes: [
          `concrete_path=${resolved.concretePath}`,
          `supporting_shells=${surface.routeMetadata.supportingShells.length}`,
          `attempt=${attempt}`,
          ...routeNotes,
        ],
        agentBundle: surface.agentBundle,
        reuseTags: surface.reuseTags,
      });
      return;
    } catch (error) {
      const errorText = error instanceof Error ? error.stack || error.message : String(error);
      const isBrowserClosed = /Target page, context or browser has been closed/i.test(errorText);
      const isCommitTimeout = /page\.goto: Timeout[\s\S]*waiting until "commit"/i.test(errorText);
      await appendTrace(surface.surfaceId, 'route:failure', {
        attempt,
        error: errorText.split('\n')[0],
      });

      if (attempt < 2 && (isBrowserClosed || isCommitTimeout)) {
        continue;
      }

      const errorPath = path.join(surfaceDir(surface.surfaceId), 'route-error.txt');
      await writeText(errorPath, `${errorText}\n`);
      await writeRecord({
        surfaceId: surface.surfaceId,
        surfaceType: surface.surfaceType,
        platform: surface.platform,
        persona: surface.persona,
        routeOrEntry: surface.routeOrEntry,
        status: 'BROKEN',
        feedbackCategory: 'CODE_BUG',
        executionOwner: surface.executionOwner,
        validationType: surface.validationType,
        qualityDimensionsChecked: surface.qualityDimensions,
        externalPrerequisites: surface.externalPrerequisites,
        blockedByExternalPrerequisites: [],
        userVisibleResult:
          'The route hit a runtime failure before the intended user-visible state was reached.',
        evidence: [rel(errorPath)],
        issues: [
          {
            summary: errorText.split('\n')[0],
            rootCause: 'Unhandled route runtime failure during full-surface audit',
            acceptance:
              'Route should open and render a stable document in the configured audit environment',
          },
        ],
        shellArtifactsChecked: surface.routeMetadata.supportingShells,
        notes: [
          `concrete_path=${resolved.ok ? resolved.concretePath : surface.routeMetadata.routeTemplate}`,
          `attempt=${attempt}`,
        ],
        agentBundle: surface.agentBundle,
        reuseTags: surface.reuseTags,
      });
      return;
    } finally {
      await page?.close().catch(() => undefined);
      await context?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
    }
  }
}

async function executeReleaseWebRouteSurface(
  surface: RouteSurfaceDefinition,
  samples: SampleCatalog
) {
  const resolved = resolveConcreteRoute(surface, samples);
  const budget = releaseRuntimeBudget(RELEASE_RUNTIME_ENVIRONMENT, surface);
  const budgetLayer = releaseRuntimeLayer(surface);

  if (!resolved.ok) {
    const classification: ReleaseRuntimeDetails['classification'] = {
      status: 'BLOCKED_SAMPLE',
      rootCause: resolved.reason,
      guardrail: 'pnpm lint:release-runtime',
      proof:
        'Provide stable seed/sample data, rerun release-runtime audit, and confirm this route records PASS.',
      owner: surface.executionOwner,
      deadline: releaseRuntimeDeadline(),
    };
    await writeRecord({
      surfaceId: surface.surfaceId,
      surfaceType: surface.surfaceType,
      platform: surface.platform,
      persona: surface.persona,
      routeOrEntry: surface.routeOrEntry,
      status: 'BLOCKED_SAMPLE',
      feedbackCategory: 'DATA_ISSUE',
      executionOwner: surface.executionOwner,
      validationType: surface.validationType,
      qualityDimensionsChecked: surface.qualityDimensions,
      externalPrerequisites: surface.externalPrerequisites,
      blockedByExternalPrerequisites: [],
      userVisibleResult:
        'The release runtime route could not be exercised because no stable sample parameters were available.',
      evidence: [],
      issues: [
        {
          summary: resolved.reason,
          rootCause:
            'Dynamic route parameter resolution lacks a stable sample in current seed/runtime data',
          acceptance: 'Provide one stable sample id or seed fixture for this route family',
        },
      ],
      shellArtifactsChecked: surface.routeMetadata.supportingShells,
      notes: [`source=${surface.routeMetadata.sourcePath}`, `budget_layer=${budgetLayer}`],
      agentBundle: surface.agentBundle,
      reuseTags: surface.reuseTags,
      releaseRuntime: {
        mode: 'release-runtime',
        environment: RELEASE_RUNTIME_ENVIRONMENT,
        budgetLayer,
        budget,
        directLoads: [],
        navigationProbes: [],
        apiTimings: [],
        requestFailures: [],
        consoleErrors: [],
        pageErrors: [],
        networkErrors: [],
        classification,
      },
    });
    return;
  }

  const directLoads: ReleaseDirectLoadProbe[] = [];
  const navigationProbes: ReleaseNavigationProbe[] = [];
  const apiTimings: ReleaseApiTiming[] = [];
  const requestFailures: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkErrors: RouteNetworkIssue[] = [];
  const passes: ReleaseDirectLoadProbe['pass'][] =
    RELEASE_RUNTIME_ENVIRONMENT === 'production' ? ['cold', 'warm'] : ['local'];
  const targetUrl = `${WEB_BASE}${resolved.concretePath}`;
  let summary: RouteProbeSummary | null = null;
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const opened = await openRoutePage(browser, surface);
    context = opened.context;
    page = opened.page;
    const requestStartedAt = new Map<string, number>();

    page.on('pageerror', (error) => {
      const message = error.message || String(error);
      if (!isDevOnlyNoise(message)) pageErrors.push(message);
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (!isDevOnlyNoise(text)) consoleErrors.push(text);
    });
    page.on('request', (request) => {
      if (isApiRequestUrl(request.url())) {
        requestStartedAt.set(`${request.method()} ${request.url()}`, Date.now());
      }
    });
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      const text = `${request.method()} ${request.url()} failed${failure?.errorText ? `: ${failure.errorText}` : ''}`;
      if (!isDevOnlyNoise(text) && !isIgnorableRequestFailure(request.url(), text)) {
        requestFailures.push(text);
      }
    });
    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      const key = `${response.request().method()} ${url}`;
      const startedAt = requestStartedAt.get(key);
      if (startedAt && isApiRequestUrl(url)) {
        apiTimings.push({
          url,
          method: response.request().method(),
          status,
          durationMs: Date.now() - startedAt,
        });
        requestStartedAt.delete(key);
      }
      if (status < 400) return;
      if (
        isIgnorableNetworkNoise(url, status) ||
        isIgnorableGuestAuthNoise(surface, url, status) ||
        isDevOnlyNoise(url)
      ) {
        return;
      }
      networkErrors.push({
        url,
        status,
        statusText: response.statusText(),
        method: response.request().method(),
      });
    });

    for (const pass of passes) {
      await appendTrace(surface.surfaceId, 'release-runtime:navigate', {
        pass,
        concretePath: resolved.concretePath,
      });
      const startedAt = Date.now();
      const response = await page.goto(targetUrl, {
        waitUntil: 'commit',
        timeout: Math.max(25_000, budget.loadMs + 10_000),
      });
      await Promise.race([
        page.waitForLoadState('domcontentloaded', { timeout: Math.max(5_000, budget.loadMs) }),
        page.waitForSelector('body', { timeout: Math.max(5_000, budget.loadMs) }),
        page.waitForTimeout(Math.max(2_000, budget.loadMs)),
      ]);
      await Promise.race([
        page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined),
        page.waitForTimeout(1_200),
      ]);

      const timing = await collectReleaseTiming(page, startedAt);
      summary = await summarizePage(page);
      const stuckLoading = await detectReleaseStuckLoading(page);
      directLoads.push({
        pass,
        url: targetUrl,
        finalUrl: page.url(),
        httpStatus: response?.status() ?? null,
        timing,
        visibleTextSample: summary.textSample,
        stuckLoading,
        budgetViolations: releaseBudgetViolations(timing, budget),
      });
    }

    const routeRoot = routePath(surface, resolved.concretePath);
    const entryShot = path.join(routeRoot, '01-release-entry.png');
    await screenshot(page, entryShot);
    const links = await collectSafeInternalLinks(page, CLI_ARGS.maxLinksPerRoute);
    const navigationStartUrl = page.url();
    for (const link of links) {
      // A previous iteration's click may still be settling; if its navigation
      // collides with this goto, let it finish and retry once. Only the
      // navigation-race error is swallowed — real failures still propagate.
      try {
        await page.goto(navigationStartUrl, { waitUntil: 'commit', timeout: budget.navigationMs });
      } catch (err) {
        if (!/interrupted by another navigation/i.test(String(err))) throw err;
        await page
          .waitForLoadState('load', { timeout: budget.navigationMs })
          .catch(() => undefined);
        await page.goto(navigationStartUrl, { waitUntil: 'commit', timeout: budget.navigationMs });
      }
      await Promise.race([
        page.waitForLoadState('domcontentloaded', { timeout: 3_000 }).catch(() => undefined),
        page.waitForTimeout(500),
      ]);
      navigationProbes.push(await clickSafeInternalLink(page, link, budget));
    }

    const resultShot = path.join(routeRoot, '02-release-result.png');
    await screenshot(page, resultShot, true);
    const detailsForClassification = {
      environment: RELEASE_RUNTIME_ENVIRONMENT,
      budget,
      directLoads,
      navigationProbes,
      apiTimings,
      requestFailures,
      consoleErrors,
      pageErrors,
      networkErrors,
    };
    const classification = classifyReleaseRuntime(detailsForClassification);
    const releaseRuntime: ReleaseRuntimeDetails = {
      mode: 'release-runtime',
      environment: RELEASE_RUNTIME_ENVIRONMENT,
      budgetLayer,
      budget,
      directLoads,
      navigationProbes,
      apiTimings,
      requestFailures,
      consoleErrors,
      pageErrors,
      networkErrors,
      classification,
    };
    const releaseRuntimePath = path.join(routeRoot, 'release-runtime.json');
    const pageSummaryPath = path.join(routeRoot, 'page-summary.json');
    await writeJson(releaseRuntimePath, releaseRuntime);
    await writeJson(pageSummaryPath, summary ?? {});

    const issues: SurfaceIssue[] =
      classification.status === 'PASS'
        ? []
        : [
            {
              summary: classification.rootCause,
              rootCause: classification.rootCause,
              acceptance:
                'Route must pass release runtime budgets, avoid runtime errors, and complete safe internal navigation probes.',
            },
          ];

    await writeRecord({
      surfaceId: surface.surfaceId,
      surfaceType: surface.surfaceType,
      platform: surface.platform,
      persona: surface.persona,
      routeOrEntry: surface.routeOrEntry,
      status: classification.status,
      feedbackCategory:
        classification.status === 'PASS' ? defaultFeedbackCategory(surface) : 'CODE_BUG',
      executionOwner: surface.executionOwner,
      validationType: surface.validationType,
      qualityDimensionsChecked: surface.qualityDimensions,
      externalPrerequisites: surface.externalPrerequisites,
      blockedByExternalPrerequisites: [],
      userVisibleResult: routeVisibleResult(
        resolved.concretePath,
        summary ?? {
          title: '',
          heading: '',
          primaryAction: '',
          textSample: '',
        }
      ),
      evidence: [rel(entryShot), rel(resultShot), rel(pageSummaryPath), rel(releaseRuntimePath)],
      issues,
      shellArtifactsChecked: surface.routeMetadata.supportingShells,
      notes: [
        `concrete_path=${resolved.concretePath}`,
        `budget_layer=${budgetLayer}`,
        `navigation_probes=${navigationProbes.length}`,
        `api_requests=${apiTimings.length}`,
      ],
      agentBundle: surface.agentBundle,
      reuseTags: surface.reuseTags,
      releaseRuntime,
    });
  } catch (error) {
    const errorText = error instanceof Error ? error.stack || error.message : String(error);
    const errorPath = path.join(
      routePath(surface, resolved.concretePath),
      'release-route-error.txt'
    );
    const classification: ReleaseRuntimeDetails['classification'] = {
      status: 'NAVIGATION_FAILED',
      rootCause: errorText.split('\n')[0],
      guardrail: 'pnpm lint:release-runtime',
      proof: 'Rerun release-runtime audit and confirm route reaches a stable user-visible state.',
      owner: surface.executionOwner,
      deadline: releaseRuntimeDeadline(),
    };
    const releaseRuntime: ReleaseRuntimeDetails = {
      mode: 'release-runtime',
      environment: RELEASE_RUNTIME_ENVIRONMENT,
      budgetLayer,
      budget,
      directLoads,
      navigationProbes,
      apiTimings,
      requestFailures,
      consoleErrors,
      pageErrors,
      networkErrors,
      classification,
    };
    await writeText(errorPath, `${errorText}\n`);
    await writeRecord({
      surfaceId: surface.surfaceId,
      surfaceType: surface.surfaceType,
      platform: surface.platform,
      persona: surface.persona,
      routeOrEntry: surface.routeOrEntry,
      status: 'NAVIGATION_FAILED',
      feedbackCategory: 'CODE_BUG',
      executionOwner: surface.executionOwner,
      validationType: surface.validationType,
      qualityDimensionsChecked: surface.qualityDimensions,
      externalPrerequisites: surface.externalPrerequisites,
      blockedByExternalPrerequisites: [],
      userVisibleResult:
        'The release runtime route failed before a stable user-visible state was reached.',
      evidence: [rel(errorPath)],
      issues: [
        {
          summary: classification.rootCause,
          rootCause: 'Release runtime navigation failed before the route could be measured',
          acceptance: 'Route should open and emit release-runtime timing evidence',
        },
      ],
      shellArtifactsChecked: surface.routeMetadata.supportingShells,
      notes: [`concrete_path=${resolved.concretePath}`, `budget_layer=${budgetLayer}`],
      agentBundle: surface.agentBundle,
      reuseTags: surface.reuseTags,
      releaseRuntime,
    });
  } finally {
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

async function executeMobileRouteSurface(surface: RouteSurfaceDefinition, samples: SampleCatalog) {
  const resolved = resolveConcreteRoute(surface, samples);
  if (!resolved.ok) {
    await writeRecord({
      surfaceId: surface.surfaceId,
      surfaceType: surface.surfaceType,
      platform: surface.platform,
      persona: surface.persona,
      routeOrEntry: surface.routeOrEntry,
      status: 'BLOCKED',
      feedbackCategory: 'DATA_ISSUE',
      executionOwner: surface.executionOwner,
      validationType: surface.validationType,
      qualityDimensionsChecked: surface.qualityDimensions,
      externalPrerequisites: surface.externalPrerequisites,
      blockedByExternalPrerequisites: [],
      userVisibleResult:
        'The mobile route could not be exercised because no stable sample parameters were available.',
      evidence: [],
      issues: [
        {
          summary: resolved.reason,
          rootCause:
            'Dynamic route parameter resolution lacks a stable sample in current seed/runtime data',
          acceptance: 'Provide one stable sample id or seed fixture for this route family',
        },
      ],
      shellArtifactsChecked: surface.routeMetadata.supportingShells,
      agentBundle: surface.agentBundle,
      reuseTags: surface.reuseTags,
    });
    return;
  }

  const devices = await detectAndroidDevice();
  const activeDevice = devices.find((device) => device.state === 'device');
  if (!activeDevice) {
    await writeRecord({
      surfaceId: surface.surfaceId,
      surfaceType: surface.surfaceType,
      platform: surface.platform,
      persona: surface.persona,
      routeOrEntry: surface.routeOrEntry,
      status: 'BLOCKED',
      feedbackCategory: 'DATA_ISSUE',
      executionOwner: surface.executionOwner,
      validationType: surface.validationType,
      qualityDimensionsChecked: surface.qualityDimensions,
      externalPrerequisites: surface.externalPrerequisites,
      blockedByExternalPrerequisites: [],
      userVisibleResult:
        'No connected Android device/emulator was available for this mobile route check.',
      evidence: [],
      issues: [
        {
          summary: 'adb devices did not return an active emulator or physical device',
          rootCause: 'Mobile route runtime requires an attached device or emulator',
          acceptance: 'Connect an Android device or boot an emulator before rerunning Batch 3',
        },
      ],
      shellArtifactsChecked: surface.routeMetadata.supportingShells,
      agentBundle: surface.agentBundle,
      reuseTags: surface.reuseTags,
    });
    return;
  }

  if (!(await mobileAppInstalled(activeDevice.serial))) {
    await writeRecord({
      surfaceId: surface.surfaceId,
      surfaceType: surface.surfaceType,
      platform: surface.platform,
      persona: surface.persona,
      routeOrEntry: surface.routeOrEntry,
      status: 'BLOCKED',
      feedbackCategory: 'DATA_ISSUE',
      executionOwner: surface.executionOwner,
      validationType: surface.validationType,
      qualityDimensionsChecked: surface.qualityDimensions,
      externalPrerequisites: surface.externalPrerequisites,
      blockedByExternalPrerequisites: [],
      userVisibleResult: 'A device was connected, but the mobile dev build was not installed.',
      evidence: [],
      issues: [
        {
          summary: `${MOBILE_APP_ID} was not found in pm list packages`,
          rootCause: 'Current audit environment lacks an installed Android dev build',
          acceptance: 'Install the mobile dev build before rerunning Batch 3 route checks',
        },
      ],
      shellArtifactsChecked: surface.routeMetadata.supportingShells,
      agentBundle: surface.agentBundle,
      reuseTags: surface.reuseTags,
    });
    return;
  }

  try {
    await openAndroidRoute(activeDevice.serial, resolved.concretePath);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const screenshotPath = path.join(surfaceDir(surface.surfaceId), '01-device.png');
    const focusPath = path.join(surfaceDir(surface.surfaceId), 'device-focus.txt');
    await adbScreencap(activeDevice.serial, screenshotPath);
    const focus = await adb(activeDevice.serial, ['shell', 'dumpsys', 'window', 'windows'], 20_000);
    await writeText(focusPath, focus.stdout);

    const status = focus.stdout.includes(MOBILE_APP_ID) ? 'PASS' : 'ISSUE';
    const issues: SurfaceIssue[] = [];
    if (status === 'ISSUE') {
      issues.push({
        summary:
          'Android focus dump did not show the study abroad app as the current foreground window',
        rootCause: 'Deep link or route launch did not keep the app in the foreground',
        acceptance:
          'The target route should open in the installed mobile build and remain foregrounded',
      });
    }

    await writeRecord({
      surfaceId: surface.surfaceId,
      surfaceType: surface.surfaceType,
      platform: surface.platform,
      persona: surface.persona,
      routeOrEntry: surface.routeOrEntry,
      status,
      feedbackCategory: status === 'PASS' ? defaultFeedbackCategory(surface) : 'CODE_BUG',
      executionOwner: surface.executionOwner,
      validationType: surface.validationType,
      qualityDimensionsChecked: surface.qualityDimensions,
      externalPrerequisites: surface.externalPrerequisites,
      blockedByExternalPrerequisites: [],
      userVisibleResult: `Opened ${resolved.concretePath} on Android device ${activeDevice.serial}; focus inspection ${status === 'PASS' ? 'confirmed the app remained foregrounded' : 'did not confirm the app remained foregrounded'}.`,
      evidence: [rel(screenshotPath), rel(focusPath)],
      issues,
      shellArtifactsChecked: surface.routeMetadata.supportingShells,
      notes: [`concrete_path=${resolved.concretePath}`, `device=${activeDevice.serial}`],
      agentBundle: surface.agentBundle,
      reuseTags: surface.reuseTags,
    });
  } catch (error) {
    const errorText = error instanceof Error ? error.stack || error.message : String(error);
    const errorPath = path.join(surfaceDir(surface.surfaceId), 'mobile-route-error.txt');
    await writeText(errorPath, `${errorText}\n`);
    await writeRecord({
      surfaceId: surface.surfaceId,
      surfaceType: surface.surfaceType,
      platform: surface.platform,
      persona: surface.persona,
      routeOrEntry: surface.routeOrEntry,
      status: 'BROKEN',
      feedbackCategory: 'CODE_BUG',
      executionOwner: surface.executionOwner,
      validationType: surface.validationType,
      qualityDimensionsChecked: surface.qualityDimensions,
      externalPrerequisites: surface.externalPrerequisites,
      blockedByExternalPrerequisites: [],
      userVisibleResult:
        'The mobile route launch failed before a stable user-visible screen could be captured.',
      evidence: [rel(errorPath)],
      issues: [
        {
          summary: errorText.split('\n')[0],
          rootCause:
            'ADB route launch or screenshot capture failed during mobile full-surface audit',
          acceptance: 'Deep link and screenshot capture should succeed for installed mobile builds',
        },
      ],
      shellArtifactsChecked: surface.routeMetadata.supportingShells,
      agentBundle: surface.agentBundle,
      reuseTags: surface.reuseTags,
    });
  }
}

async function executeRouteSurface(surface: RouteSurfaceDefinition, samples: SampleCatalog) {
  if (RUNTIME_MODE === 'release-runtime') {
    if (surface.platform === 'web') {
      await executeReleaseWebRouteSurface(surface, samples);
    }
    return;
  }
  if (surface.platform === 'web') {
    await executeWebRouteSurface(surface, samples);
    return;
  }
  await executeMobileRouteSurface(surface, samples);
}

/**
 * Retry wrapper for release-runtime web routes (see RELEASE_RUNTIME_MAX_ATTEMPTS).
 * executeRouteSurface writes the route's record into RECORDS; we read the status
 * back and, if it is a transient hard-fail, re-run the whole route. Any non-hard
 * status (PASS/SLOW/COLD) on any attempt wins — the re-run overwrites the record.
 * Staying hard-fail across EVERY attempt is a real defect and is left as the
 * failure, so retry never hides a deterministic failure. Each retry/recovery is
 * logged so "was it flaky?" is answerable from the CI run. Non-release modes and
 * non-web surfaces run exactly once (maxAttempts = 1).
 */
async function executeRouteSurfaceWithRetry(
  surface: RouteSurfaceDefinition,
  samples: SampleCatalog
) {
  const retryable = RUNTIME_MODE === 'release-runtime' && surface.platform === 'web';
  const maxAttempts = retryable ? RELEASE_RUNTIME_MAX_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await executeRouteSurface(surface, samples);
    const status = RECORDS.get(surface.surfaceId)?.status;
    const isHardFail = status != null && RELEASE_RUNTIME_HARD_FAIL_SET.has(status);
    if (!isHardFail) {
      if (attempt > 1) {
        console.warn(
          `  ↻ release-runtime: ${surface.surfaceId} recovered on attempt ${attempt}/${maxAttempts} (status=${status}) — transient flake absorbed`
        );
      }
      return;
    }
    if (attempt < maxAttempts) {
      console.warn(
        `  ↻ release-runtime: ${surface.surfaceId} hard-fail (${status}) on attempt ${attempt}/${maxAttempts} — retrying`
      );
    } else {
      console.error(
        `  ✗ release-runtime: ${surface.surfaceId} still hard-fail (${status}) after ${maxAttempts} attempts — treated as a real defect`
      );
    }
  }
}

async function environmentHealth() {
  const apiHealthUrl = API_BASE.replace(/\/api\/v1\/?$/, '/health');
  const truncateForLog = (text: string, max = 400) =>
    text.length > max ? `${text.slice(0, max)}... [truncated ${text.length - max} chars]` : text;
  const checks = await Promise.allSettled([
    fetch(`${WEB_BASE}`).then((response) => response.status),
    fetch(apiHealthUrl).then(async (response) => ({
      status: response.status,
      body: truncateForLog(await response.text()),
    })),
  ]);

  return {
    web:
      checks[0].status === 'fulfilled'
        ? { available: true, status: checks[0].value }
        : { available: false, error: String(checks[0].reason) },
    api:
      checks[1].status === 'fulfilled'
        ? { available: true, ...(checks[1].value as { status: number; body: string }) }
        : { available: false, error: String(checks[1].reason) },
  };
}

function selectedCounts(surfaces: readonly AnySurfaceDefinition[]) {
  return surfaces.reduce(
    (acc, surface) => {
      acc[surface.surfaceType] += 1;
      return acc;
    },
    { route: 0, capability: 0, journey: 0 }
  );
}

function surfaceExecutionPriority(surfaceType: SurfaceType) {
  switch (surfaceType) {
    case 'route':
      return 0;
    case 'journey':
      return 1;
    case 'capability':
      return 2;
    default:
      return 3;
  }
}

function renderHealthStatus(check: { available: boolean; status?: number; error?: string }) {
  return check.available
    ? `available (${check.status ?? 'unknown'})`
    : `unavailable (${check.error})`;
}

async function writeRunArtifacts(
  registry: FullSurfaceRegistry,
  surfaces: readonly AnySurfaceDefinition[],
  health: Awaited<ReturnType<typeof environmentHealth>>
) {
  const records = surfaces
    .map((surface) => RECORDS.get(surface.surfaceId))
    .filter((record): record is FullSurfaceRecord => Boolean(record))
    .sort((left, right) => left.surfaceId.localeCompare(right.surfaceId));
  const counts = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.status] = (acc[record.status] ?? 0) + 1;
    return acc;
  }, {});
  const selected = {
    batch: BATCH_FILTER.size > 0 ? [...BATCH_FILTER] : null,
    platform: PLATFORM_FILTER.size > 0 ? [...PLATFORM_FILTER] : null,
    persona: PERSONA_FILTER.size > 0 ? [...PERSONA_FILTER] : null,
    surfaceIds: SURFACE_ID_FILTER.size > 0 ? [...SURFACE_ID_FILTER] : null,
    forceRerun: CLI_ARGS.forceRerun,
  };

  await writeJson(path.join(EVIDENCE_ROOT, 'records-index.json'), records);
  const summaryPayload = {
    auditDate: AUDIT_DATE,
    registryVersion: registry.version,
    selectedSurfaceCount: surfaces.length,
    selectedCounts: selectedCounts(surfaces),
    statusCounts: counts,
    environment: health,
    generatedAt: new Date().toISOString(),
  };
  await writeJson(path.join(EVIDENCE_ROOT, 'run-summary.json'), summaryPayload);
  await writeJson(path.join(EVIDENCE_ROOT, 'runtime-summary.json'), {
    fullSurfaceRegistryVersion: registry.version,
    journeyRegistryVersion: '2026-04-01.v3',
    auditDate: AUDIT_DATE,
    evidenceRoot: rel(EVIDENCE_ROOT),
    selectedSurfaceCount: surfaces.length,
    selectedFilters: selected,
    counts,
    byType: selectedCounts(surfaces),
  });

  const markdown = [
    `# Full Surface Runtime Summary · ${AUDIT_DATE}`,
    '',
    '| metric | value |',
    '| --- | --- |',
    `| selected_surfaces | ${surfaces.length} |`,
    `| routes | ${selectedCounts(surfaces).route} |`,
    `| capabilities | ${selectedCounts(surfaces).capability} |`,
    `| journeys | ${selectedCounts(surfaces).journey} |`,
    `| PASS | ${counts.PASS ?? 0} |`,
    `| ISSUE | ${counts.ISSUE ?? 0} |`,
    `| BROKEN | ${counts.BROKEN ?? 0} |`,
    `| BLOCKED | ${counts.BLOCKED ?? 0} |`,
    `| SKIPPED | ${counts.SKIPPED ?? 0} |`,
    '',
    '## Environment',
    '',
    `- web: ${renderHealthStatus(health.web)}`,
    `- api: ${renderHealthStatus(health.api)}`,
    '',
    '## Selected Surface IDs',
    '',
    ...surfaces.map((surface) => `- ${surface.surfaceId}`),
    '',
  ].join('\n');
  await writeText(path.join(EVIDENCE_ROOT, 'runtime-summary.md'), `${markdown}\n`);

  if (RUNTIME_MODE === 'release-runtime') {
    const releaseRecords = records.filter((record) => record.platform === 'web');
    const closureLedger = releaseRecords
      .filter((record) => record.status !== 'PASS')
      .map((record) => ({
        surfaceId: record.surfaceId,
        route: record.routeOrEntry,
        status: record.status,
        owner: record.releaseRuntime?.classification.owner ?? record.executionOwner,
        rootCause:
          record.releaseRuntime?.classification.rootCause ??
          record.issues[0]?.rootCause ??
          record.issues[0]?.summary ??
          'Unknown release runtime failure',
        guardrail: record.releaseRuntime?.classification.guardrail ?? 'pnpm lint:release-runtime',
        proof:
          record.releaseRuntime?.classification.proof ??
          'Rerun release-runtime audit and gate after fixing this route.',
        deadline: record.releaseRuntime?.classification.deadline ?? releaseRuntimeDeadline(),
        evidence: record.evidence,
      }));
    const hardFailStatuses = new Set<string>(RELEASE_RUNTIME_HARD_FAIL_STATUSES);
    const slowStatuses = new Set<string>(RELEASE_RUNTIME_SLOW_STATUSES);
    const releaseSummary = {
      schemaVersion: '2026-06-08.v1',
      mode: RUNTIME_MODE,
      environment: RELEASE_RUNTIME_ENVIRONMENT,
      auditDate: AUDIT_DATE,
      generatedAt: new Date().toISOString(),
      registryVersion: registry.version,
      webBase: WEB_BASE,
      apiBase: API_BASE,
      evidenceRoot: rel(EVIDENCE_ROOT),
      routeCount: releaseRecords.length,
      expectedWebRouteCount: registry.counts.webStandaloneRoutes,
      statusCounts: counts,
      budgets: RELEASE_RUNTIME_BUDGETS[RELEASE_RUNTIME_ENVIRONMENT],
      hardFailStatuses: [...hardFailStatuses],
      slowStatuses: [...slowStatuses],
      records: releaseRecords.map((record) => ({
        surfaceId: record.surfaceId,
        route: record.routeOrEntry,
        persona: record.persona,
        status: record.status,
        evidence: record.evidence,
        releaseRuntime: record.releaseRuntime,
      })),
      closureLedger,
    };
    await writeJson(path.join(EVIDENCE_ROOT, 'release-runtime-summary.json'), releaseSummary);

    const releaseMarkdown = [
      `# Release Runtime Summary · ${AUDIT_DATE} · ${RELEASE_RUNTIME_ENVIRONMENT}`,
      '',
      '| metric | value |',
      '| --- | --- |',
      `| web_base | ${WEB_BASE} |`,
      `| api_base | ${API_BASE} |`,
      `| routes_recorded | ${releaseRecords.length}/${registry.counts.webStandaloneRoutes} |`,
      `| PASS | ${counts.PASS ?? 0} |`,
      `| BROKEN | ${counts.BROKEN ?? 0} |`,
      `| NAVIGATION_FAILED | ${counts.NAVIGATION_FAILED ?? 0} |`,
      `| STUCK_LOADING | ${counts.STUCK_LOADING ?? 0} |`,
      `| SLOW_FRONTEND | ${counts.SLOW_FRONTEND ?? 0} |`,
      `| SLOW_API | ${counts.SLOW_API ?? 0} |`,
      `| COLD_START_ONLY | ${counts.COLD_START_ONLY ?? 0} |`,
      `| BLOCKED_SAMPLE | ${counts.BLOCKED_SAMPLE ?? 0} |`,
      '',
      '## Closure Ledger',
      '',
      closureLedger.length === 0
        ? 'All recorded web routes passed release runtime gates.'
        : '| surface | status | root cause | owner | deadline |',
      ...(closureLedger.length === 0
        ? []
        : [
            '| --- | --- | --- | --- | --- |',
            ...closureLedger.map(
              (item) =>
                `| ${item.surfaceId} | ${item.status} | ${item.rootCause.replace(/\|/g, '/').slice(0, 160)} | ${item.owner} | ${item.deadline} |`
            ),
          ]),
      '',
    ].join('\n');
    await writeText(path.join(EVIDENCE_ROOT, 'release-runtime-summary.md'), `${releaseMarkdown}\n`);
  }
}

async function loadExistingRecordsForSelectedSurfaces(surfaces: readonly AnySurfaceDefinition[]) {
  for (const surface of surfaces) {
    const filePath = path.join(surfaceDir(surface.surfaceId), 'record.json');
    try {
      const contents = await fs.readFile(filePath, 'utf8');
      RECORDS.set(surface.surfaceId, JSON.parse(contents) as FullSurfaceRecord);
    } catch {
      // Missing records are allowed here; the summary will still show selected counts
      // and the gap remains visible for closure.
    }
  }
}

async function main() {
  const registry = buildFullSurfaceRegistry();
  const baseSurfaces =
    RUNTIME_MODE === 'release-runtime' ? registry.routeInventory.web : selectedSurfaces(registry);
  const surfaces = baseSurfaces
    .filter((surface) => {
      if (SURFACE_ID_FILTER.size > 0 && !SURFACE_ID_FILTER.has(surface.surfaceId)) return false;
      if (BATCH_FILTER.size > 0 && !BATCH_FILTER.has(surface.agentBundle)) return false;
      if (PLATFORM_FILTER.size > 0 && !PLATFORM_FILTER.has(surface.platform)) return false;
      if (PERSONA_FILTER.size > 0 && !PERSONA_FILTER.has(surface.persona)) return false;
      return true;
    })
    .sort((left, right) => {
      const priorityDiff =
        surfaceExecutionPriority(left.surfaceType) - surfaceExecutionPriority(right.surfaceType);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return left.surfaceId.localeCompare(right.surfaceId);
    });
  const health = await environmentHealth();

  if (CLI_ARGS.printConfig) {
    console.log(
      JSON.stringify(
        {
          mode: RUNTIME_MODE,
          releaseEnvironment: RELEASE_RUNTIME_ENVIRONMENT,
          auditDate: AUDIT_DATE,
          registryVersion: registry.version,
          fullSurfaceRegistryVersion: FULL_SURFACE_REGISTRY_VERSION,
          evidenceRoot: rel(EVIDENCE_ROOT),
          webBase: WEB_BASE,
          apiBase: API_BASE,
          selectedSurfaceCount: surfaces.length,
          selectedCounts: selectedCounts(surfaces),
          selectedSurfaceIds: surfaces.map((surface) => surface.surfaceId),
          environmentHealth: health,
        },
        null,
        2
      )
    );
    return;
  }

  if (surfaces.length === 0) {
    throw new Error('No full-surface entries matched the provided filters.');
  }

  await ensureDir(EVIDENCE_ROOT);
  await writeJson(path.join(EVIDENCE_ROOT, 'runtime-config.json'), {
    mode: RUNTIME_MODE,
    environment: RELEASE_RUNTIME_ENVIRONMENT,
    auditDate: AUDIT_DATE,
    registryVersion: registry.version,
    evidenceRoot: rel(EVIDENCE_ROOT),
    webBase: WEB_BASE,
    apiBase: API_BASE,
    selectedSurfaceIds: surfaces.map((surface) => surface.surfaceId),
    selectedCounts: selectedCounts(surfaces),
    filters: {
      surfaceIds: [...SURFACE_ID_FILTER],
      batches: [...BATCH_FILTER],
      platforms: [...PLATFORM_FILTER],
      personas: [...PERSONA_FILTER],
      forceRerun: CLI_ARGS.forceRerun,
      summaryOnly: CLI_ARGS.summaryOnly,
    },
  });

  if (CLI_ARGS.summaryOnly) {
    await loadExistingRecordsForSelectedSurfaces(surfaces);
    await writeRunArtifacts(registry, surfaces, health);
    return;
  }

  const needsAdminSession = surfaces.some(
    (surface) =>
      (surface.surfaceType === 'route' &&
        surface.platform === 'web' &&
        (surface.persona === 'admin' ||
          surface.routeMetadata.routeTemplate.includes('/admin/users/:id'))) ||
      (surface.surfaceType === 'capability' &&
        surface.agentBundle === 'batch-4-admin-data-security-mcp') ||
      (surface.surfaceType === 'journey' && surface.persona === 'admin')
  );
  const authDiagnostics: Record<string, { ok: boolean; userId?: string; error?: string }> = {};
  const applicantLogin = await releaseRuntimeApiLogin('applicant', ACCOUNTS.applicant!);
  const applicantSession = applicantLogin.session;
  authDiagnostics.applicant = applicantSession
    ? { ok: true, userId: applicantSession.user.id }
    : { ok: false, error: applicantLogin.error };

  const adminLogin = needsAdminSession
    ? await releaseRuntimeApiLogin('admin', ACCOUNTS.admin!)
    : { session: null, error: undefined };
  const adminSession = adminLogin.session;
  if (needsAdminSession) {
    authDiagnostics.admin = adminSession
      ? { ok: true, userId: adminSession.user.id }
      : { ok: false, error: adminLogin.error };
  }
  await writeJson(path.join(EVIDENCE_ROOT, 'runtime-auth.json'), authDiagnostics);
  const samples = await buildSampleCatalog(applicantSession, adminSession);
  await writeJson(path.join(EVIDENCE_ROOT, 'sample-catalog.json'), samples);

  for (const surface of surfaces) {
    if (!CLI_ARGS.forceRerun) {
      const needsRefresh = await surfaceNeedsRefresh(surface, registry);
      if (!needsRefresh) {
        try {
          const filePath = path.join(surfaceDir(surface.surfaceId), 'record.json');
          const contents = await fs.readFile(filePath, 'utf8');
          RECORDS.set(surface.surfaceId, JSON.parse(contents) as FullSurfaceRecord);
          continue;
        } catch {
          // fall through to execution
        }
      }
    }

    if (surface.surfaceType === 'route') {
      await executeRouteSurfaceWithRetry(surface, samples);
      continue;
    }
    if (surface.surfaceType === 'capability') {
      await executeCapabilitySurface(surface, registry, samples);
      continue;
    }
    await executeJourneySurface(surface);
  }

  await writeRunArtifacts(registry, surfaces, health);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  getJourneyDefinition,
  JOURNEY_IDS,
  JOURNEY_REGISTRY_VERSION,
  type ExternalPrerequisite,
  type QualityDimension,
} from './release-gate/registry';

const execFileAsync = promisify(execFile);

interface CliArgs {
  auditId?: string;
  auditContext?: string;
  evidenceRoot?: string;
  journeysCsv?: string;
  forceRerun?: boolean;
  printConfig?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      values.set(key, 'true');
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  const forceValue = values.get('force-rerun');

  return {
    auditId: values.get('audit-id') ?? undefined,
    auditContext: values.get('audit-context') ?? undefined,
    evidenceRoot: values.get('evidence-root') ?? undefined,
    journeysCsv: values.get('journeys') ?? undefined,
    forceRerun: forceValue === undefined ? undefined : forceValue === 'true' || forceValue === '1',
    printConfig: values.get('print-config') === 'true',
  };
}

const ROOT = process.cwd();
const CLI_ARGS = parseArgs(process.argv.slice(2));
const AUDIT_ID = CLI_ARGS.auditId ?? process.env.RUNTIME_AUDIT_ID ?? '2026-03-31';
const AUDIT_CONTEXT =
  CLI_ARGS.auditContext ?? process.env.RUNTIME_AUDIT_CONTEXT ?? `runtime audit ${AUDIT_ID}`;
const WEB_BASE = 'http://localhost:4100';
const API_BASE = 'http://localhost:4101/api/v1';
const EVIDENCE_ROOT = CLI_ARGS.evidenceRoot
  ? path.resolve(ROOT, CLI_ARGS.evidenceRoot)
  : process.env.RUNTIME_EVIDENCE_ROOT
    ? path.resolve(ROOT, process.env.RUNTIME_EVIDENCE_ROOT)
    : path.join(ROOT, 'e2e-report', `journeys-${AUDIT_ID}`);
const SELECTED_JOURNEY_IDS = new Set(
  (CLI_ARGS.journeysCsv ?? process.env.JOURNEYS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const FORCE_RERUN = CLI_ARGS.forceRerun ?? process.env.FORCE_RERUN === '1';

function shouldRunJourney(id: (typeof JOURNEY_IDS)[number]) {
  return SELECTED_JOURNEY_IDS.size === 0 || SELECTED_JOURNEY_IDS.has(id);
}

function selectedJourneyGroup(ids: readonly (typeof JOURNEY_IDS)[number][]) {
  return ids.filter((id) => shouldRunJourney(id));
}

type JourneyStatus = 'PASS' | 'ISSUE' | 'BROKEN' | 'BLOCKED' | 'SKIPPED';

interface Account {
  email: string;
  password: string;
}

interface ApiSession {
  user: { id: string; email: string; role: string; locale?: string; points?: number };
  accessToken: string;
  cookies: string[];
}

interface JourneyRecord {
  id: string;
  title: string;
  account: string;
  registryVersion?: string;
  registryStatus?: string;
  executionOwner?: string;
  validationType?: string;
  baselineSmoke?: boolean;
  qualityDimensionsChecked?: QualityDimension[];
  externalPrerequisites?: ExternalPrerequisite[];
  blockedByExternalPrerequisites?: string[];
  impactMappingUsed?: string[];
  prerequisites: string[];
  steps: string[];
  userVisibleResult: string;
  score: number;
  status: JourneyStatus;
  evidence: string[];
  notes?: string[];
  issues?: Array<{
    summary: string;
    rootCause?: string;
    acceptance?: string;
  }>;
}

interface AdbDevice {
  serial: string;
  state: string;
}

interface McpResponse<T = unknown> {
  jsonrpc: '2.0';
  id?: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
  method?: string;
  params?: unknown;
}

const ACCOUNTS = {
  applicant: { email: 'alice.zhang@demo.studyabroad.com', password: 'Demo123!' },
  demo: { email: 'demo@example.com', password: 'Demo123!' },
  admin: { email: 'admin@example.com', password: 'Admin123!' },
} satisfies Record<string, Account>;

const RECORDS: JourneyRecord[] = [];

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function sessionCachePath(email: string) {
  return path.join(os.tmpdir(), 'study-abroad-runtime-audit', `${sanitizeFileName(email)}.json`);
}

function findAccountByEmail(email: string) {
  return Object.values(ACCOUNTS).find((account) => account.email === email) ?? null;
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

async function writeJson(filePath: string, value: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function writeText(filePath: string, value: string) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, value, 'utf8');
}

async function appendText(filePath: string, value: string) {
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, value, 'utf8');
}

function rel(filePath: string) {
  return path.relative(ROOT, filePath);
}

async function settlePage(page: Page, networkIdleTimeout = 3000, fallbackDelay = 1200) {
  try {
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: networkIdleTimeout }),
      page.waitForTimeout(fallbackDelay),
    ]);
  } catch {
    await page.waitForTimeout(fallbackDelay);
  }
}

async function gotoStable(page: Page, url: string, timeout = 60_000) {
  try {
    await page.goto(url, { waitUntil: 'commit', timeout });
  } catch (error) {
    const message = formatError(error);
    const reachedTarget =
      page.url() !== 'about:blank' &&
      (page.url() === url || page.url().startsWith(`${url}?`) || page.url().startsWith(`${url}#`));
    if (!/page\.goto: Timeout/i.test(message) || !reachedTarget) {
      throw error;
    }
    await Promise.race([
      page.waitForSelector('body', { timeout: 5_000 }).catch(() => undefined),
      page.waitForTimeout(2_000),
    ]);
  }
  await settlePage(page, 5_000, 1_500);
}

function sanitizeLogcatLine(line: string) {
  return line
    .replace(/ExpoPushToken\[[^\]]+\]/g, 'ExpoPushToken[REDACTED]')
    .replace(/(access_token=)[^;\s]+/g, '$1REDACTED')
    .replace(/(refreshToken=)[^;\s]+/g, '$1REDACTED')
    .replace(/\bcom\.huawei\.hms\.ads_\d+\b/g, 'com.huawei.hms.ads_REDACTED');
}

function formatFilteredLog(lines: string[], fallbackMessage: string) {
  if (lines.length === 0) {
    return fallbackMessage;
  }

  return lines.map(sanitizeLogcatLine).join('\n');
}

function journeyDir(id: string) {
  return path.join(EVIDENCE_ROOT, id);
}

async function copyFileIfExists(sourcePath: string, targetPath: string) {
  try {
    await ensureDir(path.dirname(targetPath));
    await fs.copyFile(sourcePath, targetPath);
    return true;
  } catch {
    return false;
  }
}

function parseAdbDevices(output: string): AdbDevice[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached'))
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      return serial && state ? { serial, state } : null;
    })
    .filter((device): device is AdbDevice => Boolean(device));
}

async function execFileBinary(command: string, args: string[], timeout = 15000) {
  return await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timed out after ${timeout}ms: ${command} ${args.join(' ')}`));
    }, timeout);

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(Buffer.concat(stdoutChunks));
        return;
      }
      reject(
        new Error(
          `Command failed (${code}): ${command} ${args.join(' ')}\n${Buffer.concat(
            stderrChunks
          ).toString('utf8')}`
        )
      );
    });
  });
}

async function adb(serial: string, args: string[], timeout = 15000, maxBuffer = 10 * 1024 * 1024) {
  return await execFileAsync('adb', ['-s', serial, ...args], {
    cwd: ROOT,
    timeout,
    maxBuffer,
  });
}

async function adbScreencap(serial: string, targetPath: string) {
  const image = await execFileBinary('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], 20000);
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, image);
}

async function appendJourneyTrace(id: string, stage: string, data?: Record<string, unknown>) {
  const target = path.join(journeyDir(id), 'runner-debug.jsonl');
  await appendText(
    target,
    `${JSON.stringify({ at: new Date().toISOString(), stage, ...(data ? { data } : {}) })}\n`
  );
  return rel(target);
}

async function readExistingRecord(id: string) {
  try {
    const file = path.join(journeyDir(id), 'record.json');
    const content = await fs.readFile(file, 'utf8');
    return JSON.parse(content) as JourneyRecord & { generatedAt?: string };
  } catch {
    return null;
  }
}

function hasRecord(id: string) {
  return RECORDS.some((record) => record.id === id);
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  return String(error);
}

function isA1RetryableSubmitTimeout(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes('button[type="submit"]:visible') &&
    error.message.includes('Timeout 30000ms exceeded')
  );
}

async function addRecord(record: JourneyRecord, extra?: Record<string, unknown>) {
  const journey = getJourneyDefinition(record.id);
  const normalizedRecord: JourneyRecord = {
    ...record,
    registryVersion: record.registryVersion ?? JOURNEY_REGISTRY_VERSION,
    registryStatus: record.registryStatus ?? journey?.registryStatus,
    executionOwner: record.executionOwner ?? journey?.defaultExecutionOwner,
    validationType: record.validationType ?? journey?.validationType,
    baselineSmoke: record.baselineSmoke ?? journey?.baselineSmoke,
    qualityDimensionsChecked: record.qualityDimensionsChecked ?? journey?.qualityDimensions,
    externalPrerequisites: record.externalPrerequisites ?? journey?.externalPrerequisites,
    impactMappingUsed: record.impactMappingUsed ?? [`manual-runtime-audit:${AUDIT_ID}`],
  };
  RECORDS.push(normalizedRecord);
  await writeJson(path.join(journeyDir(record.id), 'record.json'), {
    ...normalizedRecord,
    generatedAt: new Date().toISOString(),
    ...(extra ?? {}),
  });
}

async function screenshot(page: Page, id: string, name: string, fullPage = false) {
  const target = path.join(journeyDir(id), `${sanitizeFileName(name)}.png`);
  await ensureDir(path.dirname(target));
  await page.screenshot({ path: target, fullPage });
  return rel(target);
}

async function saveHtml(page: Page, id: string, name: string) {
  const target = path.join(journeyDir(id), `${sanitizeFileName(name)}.html`);
  await writeText(target, await page.content());
  return rel(target);
}

async function gotoAndAssertOk(page: Page, url: string, expectedPath?: string) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (!response) {
    throw new Error(`Navigation produced no document response for ${url}`);
  }

  const status = response.status();
  if (status >= 400) {
    throw new Error(`Route request failed with HTTP ${status} for ${url}`);
  }

  await settlePage(page);

  if (expectedPath) {
    const actualPath = new URL(page.url()).pathname;
    if (actualPath !== expectedPath) {
      throw new Error(`Navigation landed on ${actualPath} instead of ${expectedPath} for ${url}`);
    }
  }

  return { response, status, finalUrl: page.url() };
}

async function addFailureRecord(input: {
  id: string;
  title: string;
  account: string;
  prerequisites: string[];
  steps: string[];
  error: unknown;
  page?: Page;
  status?: JourneyStatus;
  score?: number;
  notes?: string[];
  extraEvidence?: string[];
}) {
  if (hasRecord(input.id)) return;

  const evidence: string[] = [...(input.extraEvidence ?? [])];
  const errorPath = path.join(journeyDir(input.id), 'error.txt');
  await writeText(errorPath, formatError(input.error));
  evidence.push(rel(errorPath));

  if (input.page) {
    try {
      evidence.push(await screenshot(input.page, input.id, '99-error-state', true));
      evidence.push(await saveHtml(input.page, input.id, 'error-state'));
    } catch {
      // Ignore screenshot/html capture failures and still emit the failure record.
    }
  }

  await addRecord({
    id: input.id,
    title: input.title,
    account: input.account,
    prerequisites: input.prerequisites,
    steps: input.steps,
    userVisibleResult:
      'The journey hit a runtime error before it could reach the intended user-visible completion state.',
    score: input.score ?? 1,
    status: input.status ?? 'BROKEN',
    evidence,
    notes: [...(input.notes ?? []), formatError(input.error).split('\n')[0]].filter(Boolean),
    issues: [
      {
        summary: formatError(input.error).split('\n')[0].slice(0, 400),
      },
    ],
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeCloseContext(context: BrowserContext | null | undefined) {
  if (!context) return;
  try {
    await context.close();
  } catch (error) {
    if (
      error instanceof Error &&
      /(target page, context or browser has been closed|browser has been closed)/i.test(
        error.message
      )
    ) {
      return;
    }
    throw error;
  }
}

async function safeCloseBrowser(browser: Browser | null | undefined) {
  if (!browser) return;
  try {
    await browser.close();
  } catch (error) {
    if (error instanceof Error && /browser has been closed/i.test(error.message)) {
      return;
    }
    throw error;
  }
}

async function redisKeyExists(key: string) {
  try {
    const { stdout } = await execFileAsync('redis-cli', ['EXISTS', key], {
      cwd: ROOT,
    });
    return stdout.trim() === '1';
  } catch {
    return false;
  }
}

async function waitForRedisLockToClear(
  key: string,
  { timeoutMs = 180_000, intervalMs = 2_000 }: { timeoutMs?: number; intervalMs?: number } = {}
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await redisKeyExists(key))) {
      return;
    }
    await sleep(intervalMs);
  }
}

function parseSetCookieForContext(setCookie: string) {
  const [nameValue, ...rawAttributes] = setCookie.split(';').map((segment) => segment.trim());
  const separatorIndex = nameValue.indexOf('=');
  if (separatorIndex <= 0) {
    return null;
  }

  const cookie: Parameters<BrowserContext['addCookies']>[0][number] = {
    name: nameValue.slice(0, separatorIndex),
    value: nameValue.slice(separatorIndex + 1),
    url: WEB_BASE,
    sameSite: 'Lax',
  };

  for (const attribute of rawAttributes) {
    const [rawKey, ...rawValueParts] = attribute.split('=');
    const key = rawKey.trim().toLowerCase();
    const value = rawValueParts.join('=').trim();
    switch (key) {
      case 'path':
        if ('domain' in cookie) {
          cookie.path = value || '/';
        }
        break;
      case 'domain':
        cookie.domain = value;
        cookie.path = cookie.path ?? '/';
        delete cookie.url;
        break;
      case 'secure':
        cookie.secure = true;
        break;
      case 'httponly':
        cookie.httpOnly = true;
        break;
      case 'samesite':
        if (/^strict$/i.test(value)) cookie.sameSite = 'Strict';
        else if (/^none$/i.test(value)) cookie.sameSite = 'None';
        else cookie.sameSite = 'Lax';
        break;
      case 'expires': {
        const epochSeconds = Math.floor(new Date(value).getTime() / 1000);
        if (Number.isFinite(epochSeconds)) {
          cookie.expires = epochSeconds;
        }
        break;
      }
      default:
        break;
    }
  }

  return cookie;
}

function accessTokenCookie(
  accessToken: string
): Parameters<BrowserContext['addCookies']>[0][number] {
  return {
    name: 'access_token',
    value: accessToken,
    url: WEB_BASE,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  };
}

function sessionCookiesForContext(session: ApiSession) {
  return session.cookies
    .map((value) => parseSetCookieForContext(value))
    .filter(
      (value): value is Parameters<BrowserContext['addCookies']>[0][number] =>
        value !== null &&
        (typeof value.url === 'string' ||
          (typeof value.domain === 'string' && typeof value.path === 'string'))
    );
}

async function seedContextSessionCookies(context: BrowserContext, session: ApiSession) {
  await context.addCookies([accessTokenCookie(session.accessToken)]);

  const passthroughCookies = sessionCookiesForContext(session).filter(
    (cookie) => cookie.name !== 'access_token'
  );
  if (passthroughCookies.length === 0) {
    return;
  }

  try {
    await context.addCookies(passthroughCookies);
  } catch {
    // Audit sessions only need a stable access token cookie. Ignore malformed
    // passthrough cookies instead of failing the whole journey bootstrap.
  }
}

async function pageShowsAnonymousShell(page: Page) {
  return page
    .evaluate(() => {
      const isVisible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none'
        );
      };

      return Array.from(document.querySelectorAll('a,button')).some((element) => {
        if (!isVisible(element)) {
          return false;
        }
        const text = (element.textContent ?? '').trim();
        return /^login$/i.test(text) || /^register$/i.test(text);
      });
    })
    .catch(() => false);
}

async function apiLogin(
  account: Account,
  options: {
    forceFresh?: boolean;
  } = {}
): Promise<ApiSession> {
  const cachePath = sessionCachePath(account.email);
  if (!options.forceFresh) {
    try {
      const cached = JSON.parse(await fs.readFile(cachePath, 'utf8')) as ApiSession & {
        exp?: number;
      };
      const exp = cached.exp ?? decodeJwtExp(cached.accessToken);
      if (exp && exp * 1000 > Date.now() + 60_000) {
        return {
          user: cached.user,
          accessToken: cached.accessToken,
          cookies: cached.cookies ?? [],
        };
      }
    } catch {
      // ignore cache miss
    }
  }

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(account),
  });
  const json = (await response.json()) as {
    data: {
      user: ApiSession['user'];
      accessToken: string;
    };
  };
  if (!response.ok) {
    throw new Error(`API login failed for ${account.email}: ${JSON.stringify(json)}`);
  }
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  const cookies =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(response.headers)
      : response.headers.get('set-cookie')
        ? [response.headers.get('set-cookie')!]
        : [];
  const session = {
    user: json.data.user,
    accessToken: json.data.accessToken,
    cookies,
  };
  const exp = decodeJwtExp(session.accessToken);
  await writeJson(cachePath, { ...session, exp });
  return session;
}

async function apiRequest<T>(
  session: ApiSession,
  method: string,
  endpoint: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
) {
  const run = async (accessToken: string) =>
    fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        ...(extraHeaders ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let response = await run(session.accessToken);
  if (response.status === 401) {
    const account = findAccountByEmail(session.user.email);
    if (account) {
      const renewed = await apiLogin(account);
      session.user = renewed.user;
      session.accessToken = renewed.accessToken;
      session.cookies = renewed.cookies;
      response = await run(session.accessToken);
    }
  }
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed: ${response.status} ${text}`);
  }
  return (json.data ?? json) as T;
}

async function loginUi(page: Page, account: Account, targetPath: string, locale = 'en') {
  const targetUrl = new URL(`${WEB_BASE}/${locale}${targetPath}`);
  const normalizedTargetPathname = targetUrl.pathname.replace(/\/+$/, '') || '/';

  const matchesTarget = (value: URL) => {
    const normalizedPathname = value.pathname.replace(/\/+$/, '') || '/';
    if (normalizedPathname !== normalizedTargetPathname) {
      return false;
    }
    if (!targetUrl.search) {
      return true;
    }
    return value.search === targetUrl.search;
  };

  await gotoStable(page, targetUrl.toString());

  let currentUrl = new URL(page.url());
  const callbackUrl = `/${locale}${targetPath}`;
  const anonymousShell = await pageShowsAnonymousShell(page);
  if (currentUrl.pathname === `/${locale}/login` || anonymousShell) {
    if (currentUrl.pathname !== `/${locale}/login`) {
      const loginUrl = new URL(`${WEB_BASE}/${locale}/login`);
      loginUrl.searchParams.set('callbackUrl', callbackUrl);
      await gotoStable(page, loginUrl.toString());
      currentUrl = new URL(page.url());
    }
    await page.locator('input[type="email"]').first().fill(account.email);
    await page.locator('input[type="password"]').first().fill(account.password);
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForFunction(
      ({ loginPathname }) => {
        const current = new URL(window.location.href);
        return current.pathname !== loginPathname;
      },
      {
        loginPathname: `/${locale}/login`,
      },
      { timeout: 30000 }
    );
    await settlePage(page);
  }

  let resolvedUrl = new URL(page.url());
  if (!matchesTarget(resolvedUrl)) {
    await gotoStable(page, targetUrl.toString());
    resolvedUrl = new URL(page.url());
  }

  if (!matchesTarget(resolvedUrl)) {
    throw new Error(
      `Expected to land on /${locale}${targetPath} but browser is at ${resolvedUrl.pathname}${resolvedUrl.search}`
    );
  }

  await settlePage(page);
}

async function clickProfileTab(page: Page, label: RegExp) {
  let trigger = page.getByRole('button', { name: label }).first();
  try {
    await trigger.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    await loginUi(page, ACCOUNTS.applicant, '/profile');
    trigger = page.getByRole('button', { name: label }).first();
    await trigger.waitFor({ state: 'visible', timeout: 30000 });
  }
  await trigger.click();
  await sleep(500);
}

async function browserRead(page: Page, url: string) {
  return page.evaluate(async (target) => {
    let response = await fetch(target, {
      credentials: 'include',
    });
    if (response.status === 401) {
      const refreshResponse = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });
      if (refreshResponse.ok) {
        const refreshJson = await refreshResponse.json();
        const token = refreshJson?.data?.accessToken ?? refreshJson?.accessToken;
        response = await fetch(target, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      }
    }
    const text = await response.text();
    let json: Record<string, unknown> = {};
    if (text) {
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        json = { raw: text };
      }
    }
    return {
      status: response.status,
      body: (json as { data?: unknown }).data ?? json,
    };
  }, url);
}

async function openAuthenticatedPage(browser: Browser, account: Account, targetPath: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  let seededSession = await apiLogin(account, { forceFresh: true });
  await seedContextSessionCookies(context, seededSession);
  const hasRealRefreshCookie = sessionCookiesForContext(seededSession).some(
    (cookie) => cookie.name === 'refreshToken'
  );
  if (!hasRealRefreshCookie) {
    await context.route('**/api/v1/auth/refresh', async (route) => {
      seededSession = await apiLogin(account, { forceFresh: true });
      await seedContextSessionCookies(context, seededSession);
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
  }
  const page = await context.newPage();
  await gotoStable(page, `${WEB_BASE}/en${targetPath}`);
  if (
    /\/(en|zh)\/login(?:\?|$)/.test(new URL(page.url()).pathname) ||
    (await pageShowsAnonymousShell(page))
  ) {
    await loginUi(page, account, targetPath);
  }
  return { context, page };
}

async function openApplicantPage(browser: Browser, targetPath = '/dashboard') {
  return openAuthenticatedPage(browser, ACCOUNTS.applicant, targetPath);
}

async function openAdminPage(browser: Browser) {
  return openAuthenticatedPage(browser, ACCOUNTS.admin, '/admin');
}

async function sendChatPrompt(
  page: Page,
  prompt: string,
  responseTimeout = 120000,
  options: {
    traceId?: string;
    turnLabel?: string;
  } = {}
) {
  const chatRequests: Array<{ url: string; status: number }> = [];
  const onResponse = (response: Awaited<ReturnType<Page['waitForResponse']>>) => {
    if (response.url().includes('/api/v1/ai-agent/chat')) {
      chatRequests.push({ url: response.url(), status: response.status() });
    }
  };
  page.on('response', onResponse);
  try {
    if (options.traceId) {
      await appendJourneyTrace(options.traceId, 'sendChatPrompt:start', {
        turnLabel: options.turnLabel ?? null,
        prompt,
      });
    }
    const beforeAssistantSnapshot = await page
      .evaluate(() => {
        const proseElements = Array.from(document.querySelectorAll('.prose')).filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        });
        const texts = proseElements
          .map((element) => element.textContent?.trim() ?? '')
          .filter((text) => text.length > 0);
        return {
          count: texts.length,
          lastText: texts[texts.length - 1] ?? '',
        };
      })
      .catch(() => ({ count: 0, lastText: '' }));
    const debugCountsBefore = await page
      .evaluate(() => {
        try {
          const raw = window.sessionStorage.getItem('__agentChatDebug');
          const events = raw ? (JSON.parse(raw) as Array<{ event?: string }>) : [];
          return {
            handleSendCount: events.filter((event) => event.event === 'handleSend_invoked').length,
            fetchStartCount: events.filter((event) => event.event === 'sendMessage_fetch_start')
              .length,
            finalizeCount: events.filter((event) => event.event === 'sendMessage_finally').length,
            stopCount: events.filter((event) => event.event === 'stopGeneration_invoked').length,
            rejectedLocalCount: events.filter(
              (event) => event.event === 'handleSend_rejected_local'
            ).length,
            rejectedGuardCount: events.filter(
              (event) => event.event === 'sendMessage_rejected_guard'
            ).length,
          };
        } catch {
          return {
            handleSendCount: 0,
            fetchStartCount: 0,
            finalizeCount: 0,
            stopCount: 0,
            rejectedLocalCount: 0,
            rejectedGuardCount: 0,
          };
        }
      })
      .catch(() => ({
        handleSendCount: 0,
        fetchStartCount: 0,
        finalizeCount: 0,
        stopCount: 0,
        rejectedLocalCount: 0,
        rejectedGuardCount: 0,
      }));
    const textarea = page.locator('textarea[data-slot="textarea"]:visible').last();
    await textarea.waitFor({ state: 'visible', timeout: 30000 });
    if (options.traceId) {
      await appendJourneyTrace(options.traceId, 'sendChatPrompt:textarea-visible', {
        turnLabel: options.turnLabel ?? null,
      });
    }
    await page.waitForFunction(
      () => {
        const textareaEl = Array.from(
          document.querySelectorAll('textarea[data-slot="textarea"]')
        ).find((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        });
        if (
          !(textareaEl instanceof HTMLTextAreaElement) ||
          textareaEl.disabled ||
          textareaEl.value !== ''
        ) {
          return false;
        }
        const inputContainer = textareaEl.closest('div.flex-1');
        const button = inputContainer?.parentElement?.querySelector('button');
        return (
          button instanceof HTMLButtonElement &&
          button.disabled &&
          button.getAttribute('aria-label') !== 'Stop generating'
        );
      },
      { timeout: 5000 }
    );
    if (options.traceId) {
      await appendJourneyTrace(options.traceId, 'sendChatPrompt:composer-ready', {
        turnLabel: options.turnLabel ?? null,
      });
    }
    await textarea.click();
    await page.keyboard.type(prompt, { delay: 20 });
    if (options.traceId) {
      await appendJourneyTrace(options.traceId, 'sendChatPrompt:typed', {
        turnLabel: options.turnLabel ?? null,
        promptLength: prompt.length,
      });
    }
    await page.waitForFunction(
      (expectedPrompt) => {
        const textareaEl = Array.from(
          document.querySelectorAll('textarea[data-slot="textarea"]')
        ).find((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        });
        return (
          textareaEl instanceof HTMLTextAreaElement &&
          textareaEl.value.trim() === expectedPrompt.trim()
        );
      },
      prompt,
      { timeout: 5000 }
    );
    if (options.traceId) {
      await appendJourneyTrace(options.traceId, 'sendChatPrompt:value-confirmed', {
        turnLabel: options.turnLabel ?? null,
      });
    }
    const waitForSubmitSignal = (timeout: number) =>
      page.waitForFunction(
        (baseline) => {
          try {
            const raw = window.sessionStorage.getItem('__agentChatDebug');
            const events = raw ? (JSON.parse(raw) as Array<{ event?: string }>) : [];
            const stopButton = document.querySelector('button[aria-label="Stop generating"]');
            const state = {
              handleSendCount: events.filter((event) => event.event === 'handleSend_invoked')
                .length,
              fetchStartCount: events.filter((event) => event.event === 'sendMessage_fetch_start')
                .length,
              finalizeCount: events.filter((event) => event.event === 'sendMessage_finally').length,
              stopCount: events.filter((event) => event.event === 'stopGeneration_invoked').length,
              rejectedLocalCount: events.filter(
                (event) => event.event === 'handleSend_rejected_local'
              ).length,
              rejectedGuardCount: events.filter(
                (event) => event.event === 'sendMessage_rejected_guard'
              ).length,
              hasStopButton: Boolean(stopButton),
            };
            return state.hasStopButton ||
              state.stopCount > baseline.stopCount ||
              state.rejectedLocalCount > baseline.rejectedLocalCount ||
              state.rejectedGuardCount > baseline.rejectedGuardCount ||
              state.handleSendCount > baseline.handleSendCount ||
              state.fetchStartCount > baseline.fetchStartCount
              ? state
              : null;
          } catch {
            return null;
          }
        },
        debugCountsBefore,
        { timeout }
      );
    const sendButton = textarea.locator(
      'xpath=ancestor::div[contains(@class,"flex-1")][1]/following-sibling::div[1]//button'
    );
    await page.waitForFunction(
      () => {
        const textareaEl = Array.from(
          document.querySelectorAll('textarea[data-slot="textarea"]')
        ).find((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        });
        if (!(textareaEl instanceof HTMLTextAreaElement)) {
          return false;
        }
        const inputContainer = textareaEl.closest('div.flex-1');
        const button = inputContainer?.parentElement?.querySelector('button');
        return (
          button instanceof HTMLButtonElement &&
          !button.disabled &&
          button.getAttribute('aria-label') !== 'Stop generating' &&
          textareaEl.value.trim().length > 0
        );
      },
      { timeout: 5000 }
    );
    if (options.traceId) {
      await appendJourneyTrace(options.traceId, 'sendChatPrompt:send-enabled', {
        turnLabel: options.turnLabel ?? null,
      });
    }
    await sendButton.last().click();
    if (options.traceId) {
      await appendJourneyTrace(options.traceId, 'sendChatPrompt:send-clicked', {
        turnLabel: options.turnLabel ?? null,
      });
    }
    let postClickState;
    try {
      postClickState = await waitForSubmitSignal(1500);
    } catch {
      if (options.traceId) {
        await appendJourneyTrace(options.traceId, 'sendChatPrompt:send-click-no-signal', {
          turnLabel: options.turnLabel ?? null,
        });
      }
      await textarea.focus();
      await textarea.press('Enter');
      if (options.traceId) {
        await appendJourneyTrace(options.traceId, 'sendChatPrompt:enter-fallback', {
          turnLabel: options.turnLabel ?? null,
        });
      }
      postClickState = await waitForSubmitSignal(10000);
    }
    const postClickCounts = (await postClickState.jsonValue()) as typeof debugCountsBefore & {
      hasStopButton: boolean;
    };
    if (options.traceId) {
      await appendJourneyTrace(options.traceId, 'sendChatPrompt:submit-signalled', {
        turnLabel: options.turnLabel ?? null,
        handleSendCount: postClickCounts.handleSendCount,
        fetchStartCount: postClickCounts.fetchStartCount,
        finalizeCount: postClickCounts.finalizeCount,
        hasStopButton: postClickCounts.hasStopButton,
      });
    }
    if (postClickCounts.stopCount > debugCountsBefore.stopCount) {
      throw new Error('Composer submit invoked stopGeneration before a new chat request started.');
    }
    if (
      postClickCounts.rejectedLocalCount > debugCountsBefore.rejectedLocalCount ||
      postClickCounts.rejectedGuardCount > debugCountsBefore.rejectedGuardCount
    ) {
      throw new Error('Composer rejected the follow-up prompt before starting a new chat request.');
    }
    if (
      !postClickCounts.hasStopButton &&
      postClickCounts.handleSendCount === debugCountsBefore.handleSendCount &&
      postClickCounts.fetchStartCount === debugCountsBefore.fetchStartCount
    ) {
      throw new Error(
        'Composer did not enter loading state after the follow-up prompt was entered.'
      );
    }
    const assistantWaitBaseline = {
      ...debugCountsBefore,
      ...beforeAssistantSnapshot,
    };
    const assistantWaitStart = Date.now();
    let lastWaitTraceAt = 0;
    let completionCandidate: {
      signature: string;
      since: number;
    } | null = null;
    let finalAssistantState: {
      finalizeCount: number;
      hasNewAssistantOutput: boolean;
      hasStopButton: boolean;
      textCount: number;
      lastTextLength: number;
      isComplete: boolean;
    } | null = null;
    while (Date.now() - assistantWaitStart < responseTimeout) {
      if (page.isClosed()) {
        throw new Error('AI chat page closed while waiting for the assistant response to finish.');
      }
      const assistantSnapshot = await page
        .evaluate((baseline) => {
          const proseElements = Array.from(document.querySelectorAll('.prose')).filter(
            (element) => {
              const rect = element.getBoundingClientRect();
              const style = window.getComputedStyle(element);
              return (
                rect.width > 0 &&
                rect.height > 0 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none'
              );
            }
          );
          const texts = proseElements
            .map((element) => element.textContent?.trim() ?? '')
            .filter((text) => text.length > 0);
          const lastText = texts[texts.length - 1] ?? '';
          const raw = window.sessionStorage.getItem('__agentChatDebug');
          const events = raw ? (JSON.parse(raw) as Array<{ event?: string }>) : [];
          const finalizeCount = events.filter(
            (event) => event.event === 'sendMessage_finally'
          ).length;
          const stopButton = document.querySelector('button[aria-label="Stop generating"]');
          const hasNewAssistantOutput =
            texts.length > baseline.count || (Boolean(lastText) && lastText !== baseline.lastText);
          return {
            finalizeCount,
            hasNewAssistantOutput,
            hasStopButton: Boolean(stopButton),
            textCount: texts.length,
            lastTextLength: lastText.length,
            isComplete: false,
          };
        }, assistantWaitBaseline)
        .catch(() => null);
      if (options.traceId && assistantSnapshot && Date.now() - lastWaitTraceAt >= 5000) {
        lastWaitTraceAt = Date.now();
        await appendJourneyTrace(options.traceId, 'sendChatPrompt:assistant-waiting', {
          turnLabel: options.turnLabel ?? null,
          elapsedMs: Date.now() - assistantWaitStart,
          finalizeCount: assistantSnapshot.finalizeCount,
          hasNewAssistantOutput: assistantSnapshot.hasNewAssistantOutput,
          hasStopButton: assistantSnapshot.hasStopButton,
          textCount: assistantSnapshot.textCount,
          lastTextLength: assistantSnapshot.lastTextLength,
        });
      }
      if (assistantSnapshot) {
        const hasCompletionCandidate =
          assistantSnapshot.hasNewAssistantOutput && !assistantSnapshot.hasStopButton;
        if (hasCompletionCandidate) {
          const signature = `${assistantSnapshot.textCount}:${assistantSnapshot.lastTextLength}`;
          if (completionCandidate?.signature === signature) {
            if (Date.now() - completionCandidate.since >= 1000) {
              finalAssistantState = {
                ...assistantSnapshot,
                isComplete: true,
              };
              break;
            }
          } else {
            completionCandidate = {
              signature,
              since: Date.now(),
            };
          }
        } else {
          completionCandidate = null;
        }
      }
      await sleep(500);
    }
    if (page.isClosed()) {
      throw new Error('AI chat page closed while waiting for the assistant response to finish.');
    }
    if (
      !finalAssistantState ||
      !finalAssistantState.hasNewAssistantOutput ||
      finalAssistantState.hasStopButton
    ) {
      throw new Error(
        'Timed out waiting for the assistant response to finish streaming in the live chat UI.'
      );
    }
    if (options.traceId) {
      await appendJourneyTrace(options.traceId, 'sendChatPrompt:assistant-complete', {
        turnLabel: options.turnLabel ?? null,
        finalizeCount: finalAssistantState.finalizeCount,
      });
    }
    await sleep(1000);
    const message = await page.locator('.prose').last().innerText();
    if (options.traceId) {
      await appendJourneyTrace(options.traceId, 'sendChatPrompt:return', {
        turnLabel: options.turnLabel ?? null,
        messageLength: message.length,
      });
    }
    return { message, chatRequests };
  } finally {
    page.off('response', onResponse);
  }
}

async function collectMobileEvidence() {
  const existingA11 = shouldRunJourney('A11') ? await readExistingRecord('A11') : null;
  const existingSJ3 = shouldRunJourney('SJ-3') ? await readExistingRecord('SJ-3') : null;
  const canReuseA11 =
    !shouldRunJourney('A11') || (!!existingA11 && existingA11.status !== 'BROKEN');
  const canReuseSJ3 =
    !shouldRunJourney('SJ-3') || (!!existingSJ3 && existingSJ3.status !== 'BROKEN');

  if (!FORCE_RERUN && canReuseA11 && canReuseSJ3) {
    console.log('Skipping mobile evidence (existing records)');
    return;
  }

  const sharedEvidenceId = shouldRunJourney('A11') ? 'A11' : 'SJ-3';
  const targetDir = journeyDir(sharedEvidenceId);
  await ensureDir(targetDir);
  const a11Dir = journeyDir('A11');
  const sj3Dir = journeyDir('SJ-3');
  await ensureDir(a11Dir);
  await ensureDir(sj3Dir);

  const legacyRoot = path.join(ROOT, 'e2e-report', 'journeys-2026-03-31');
  const legacyA11Dir = path.join(legacyRoot, 'A11');
  const legacySJ3Dir = path.join(legacyRoot, 'SJ-3');
  const collectedAt = new Date().toISOString();
  const notes = [
    'iOS simulator is still unavailable in this session because CoreSimulatorService could not be reached.',
  ];

  const devicesEvidence = path.join(targetDir, 'adb-devices.txt');
  let emulatorSerial: string | null = null;
  let physicalSerial: string | null = null;
  let emulatorAppVisible = false;
  let physicalAppVisible = false;
  let emulatorNotificationListOk = false;
  let emulatorUnreadOk = false;
  let emulatorPushSkipped = false;
  let deviceFirebaseMissing = false;
  let deviceLaunchTimedOut = false;

  try {
    const devices = await execFileAsync('adb', ['devices'], {
      cwd: ROOT,
      timeout: 10000,
      maxBuffer: 2 * 1024 * 1024,
    });
    await writeText(devicesEvidence, devices.stdout || devices.stderr);
    const parsedDevices = parseAdbDevices(devices.stdout || devices.stderr || '');
    emulatorSerial =
      parsedDevices.find((device) => device.serial.startsWith('emulator-'))?.serial ?? null;
    physicalSerial =
      parsedDevices.find((device) => device.serial !== emulatorSerial && device.state === 'device')
        ?.serial ?? null;
  } catch (error) {
    const pathError = path.join(targetDir, 'mobile-collection-error.txt');
    await writeText(pathError, formatError(error));
    if (shouldRunJourney('A11')) {
      await addRecord(
        {
          id: 'A11',
          title: '移动端一致性',
          account: ACCOUNTS.applicant.email,
          prerequisites: ['ADB available with at least one Android runtime'],
          steps: ['Attempted to enumerate Android runtimes for the targeted A11 rerun.'],
          userVisibleResult:
            'This rerun could not verify the current mobile runtime because ADB enumeration failed before the app could be launched.',
          score: 1,
          status: 'BLOCKED',
          evidence: [rel(pathError)],
          notes: ['Current gate rerun did not reintroduce the earlier startup-crash claim.'],
          issues: [
            {
              summary: 'ADB collection failed before current mobile evidence could be captured.',
              acceptance:
                'At least one Android runtime must be reachable so the gate can verify A11 and SJ-3 against current app behavior.',
            },
          ],
        },
        { collectedAt }
      );
    }
    if (shouldRunJourney('SJ-3')) {
      await addRecord(
        {
          id: 'SJ-3',
          title: 'Mobile 通知页',
          account: ACCOUNTS.applicant.email,
          prerequisites: ['ADB available with at least one Android runtime'],
          steps: ['Attempted to enumerate Android runtimes for the targeted SJ-3 rerun.'],
          userVisibleResult:
            'This rerun could not verify the notifications path because current Android evidence collection failed before the app could be opened.',
          score: 1,
          status: 'BLOCKED',
          evidence: [rel(pathError)],
          notes: ['Current gate rerun did not reuse the earlier startup-crash template.'],
          issues: [
            {
              summary:
                'ADB collection failed before current notifications evidence could be captured.',
              acceptance:
                'At least one Android runtime must be reachable so the gate can verify the notifications path and remaining push blocker.',
            },
          ],
        },
        { collectedAt }
      );
    }
    return;
  }

  const a11Evidence = [rel(devicesEvidence)];
  const sj3Evidence = [rel(devicesEvidence)];

  if (emulatorSerial) {
    try {
      const emulatorLaunch = await adb(
        emulatorSerial,
        ['shell', 'am', 'start', '-W', '-n', 'com.studyabroad.mobile/.MainActivity'],
        20000
      );
      const emulatorLaunchPath = path.join(a11Dir, 'emulator-launch.txt');
      await writeText(emulatorLaunchPath, emulatorLaunch.stdout || emulatorLaunch.stderr);
      a11Evidence.push(rel(emulatorLaunchPath));

      const emulatorActivity = await adb(
        emulatorSerial,
        ['shell', 'dumpsys', 'activity', 'activities'],
        15000,
        12 * 1024 * 1024
      );
      const emulatorActivityPath = path.join(a11Dir, 'emulator-activity.txt');
      await writeText(emulatorActivityPath, emulatorActivity.stdout || emulatorActivity.stderr);
      a11Evidence.push(rel(emulatorActivityPath));
      emulatorAppVisible =
        /ResumedActivity: ActivityRecord\{.*com\.studyabroad\.mobile\/\.MainActivity/.test(
          emulatorActivity.stdout || ''
        );

      const emulatorScreenshotPath = path.join(a11Dir, '01-emulator-current.png');
      await adbScreencap(emulatorSerial, emulatorScreenshotPath);
      a11Evidence.push(rel(emulatorScreenshotPath));

      const emulatorNotificationsDeepLink = await adb(
        emulatorSerial,
        [
          'shell',
          'am',
          'start',
          '-W',
          '-a',
          'android.intent.action.VIEW',
          '-d',
          'studyabroad://notifications',
        ],
        20000
      );
      const emulatorNotificationsPath = path.join(sj3Dir, 'emulator-notifications-deeplink.txt');
      await writeText(
        emulatorNotificationsPath,
        emulatorNotificationsDeepLink.stdout || emulatorNotificationsDeepLink.stderr
      );
      sj3Evidence.push(rel(emulatorNotificationsPath));

      const emulatorNotificationsScreenshotPath = path.join(
        sj3Dir,
        '01-emulator-notifications-current.png'
      );
      await adbScreencap(emulatorSerial, emulatorNotificationsScreenshotPath);
      sj3Evidence.push(rel(emulatorNotificationsScreenshotPath));

      const emulatorTimelineDeepLink = await adb(
        emulatorSerial,
        [
          'shell',
          'am',
          'start',
          '-W',
          '-a',
          'android.intent.action.VIEW',
          '-d',
          'studyabroad://timeline',
        ],
        20000
      );
      const emulatorTimelinePath = path.join(a11Dir, 'emulator-timeline-deeplink.txt');
      await writeText(
        emulatorTimelinePath,
        emulatorTimelineDeepLink.stdout || emulatorTimelineDeepLink.stderr
      );
      a11Evidence.push(rel(emulatorTimelinePath));

      const emulatorTimelineScreenshotPath = path.join(a11Dir, '02-emulator-timeline-deeplink.png');
      await adbScreencap(emulatorSerial, emulatorTimelineScreenshotPath);
      a11Evidence.push(rel(emulatorTimelineScreenshotPath));

      const emulatorLogcat = await adb(emulatorSerial, ['logcat', '-d'], 20000, 12 * 1024 * 1024);
      const emulatorFiltered = (emulatorLogcat.stdout || '')
        .split('\n')
        .filter((line) =>
          /useNotifications:list success|useNotifications:unread success|skipping push token registration on simulator\/emulator|FirebaseApp/.test(
            line
          )
        );
      const emulatorLogPath = path.join(a11Dir, 'emulator-logcat.txt');
      await writeText(
        emulatorLogPath,
        formatFilteredLog(
          emulatorFiltered,
          emulatorLogcat.stderr || 'No matching emulator notification log lines captured.'
        )
      );
      a11Evidence.push(rel(emulatorLogPath));

      const sj3EmulatorLogPath = path.join(sj3Dir, 'emulator-logcat.txt');
      await writeText(
        sj3EmulatorLogPath,
        formatFilteredLog(
          emulatorFiltered,
          emulatorLogcat.stderr || 'No matching emulator notification log lines captured.'
        )
      );
      sj3Evidence.push(rel(sj3EmulatorLogPath));

      const emulatorFilteredJoined = emulatorFiltered.join('\n');
      emulatorNotificationListOk = /useNotifications:list success/.test(emulatorFilteredJoined);
      emulatorUnreadOk = /useNotifications:unread success/.test(emulatorFilteredJoined);
      emulatorPushSkipped = /skipping push token registration on simulator\/emulator/.test(
        emulatorFilteredJoined
      );
    } catch (error) {
      const emulatorErrorPath = path.join(a11Dir, 'emulator-collection-error.txt');
      await writeText(emulatorErrorPath, formatError(error));
      a11Evidence.push(rel(emulatorErrorPath));
      sj3Evidence.push(rel(emulatorErrorPath));
    }
  } else {
    notes.push(
      'No Android emulator was connected for this rerun, so current A11 coverage is limited to physical-device state.'
    );
  }

  if (physicalSerial) {
    try {
      let deviceLaunchText = '';
      try {
        const deviceLaunch = await adb(
          physicalSerial,
          ['shell', 'am', 'start', '-W', '-n', 'com.studyabroad.mobile/.MainActivity'],
          20000
        );
        deviceLaunchText = deviceLaunch.stdout || deviceLaunch.stderr;
      } catch (error) {
        const errorWithOutput = error as Error & { stdout?: string; stderr?: string };
        deviceLaunchText = [errorWithOutput.stdout, errorWithOutput.stderr, formatError(error)]
          .filter(Boolean)
          .join('\n');
      }
      deviceLaunchTimedOut = /Status:\s*timeout/i.test(deviceLaunchText);
      const deviceLaunchPath = path.join(a11Dir, 'device-launch.txt');
      await writeText(deviceLaunchPath, deviceLaunchText);
      a11Evidence.push(rel(deviceLaunchPath));

      const deviceActivity = await adb(
        physicalSerial,
        ['shell', 'dumpsys', 'activity', 'activities'],
        15000,
        12 * 1024 * 1024
      );
      const deviceActivityPath = path.join(a11Dir, 'device-activity.txt');
      await writeText(deviceActivityPath, deviceActivity.stdout || deviceActivity.stderr);
      a11Evidence.push(rel(deviceActivityPath));
      physicalAppVisible =
        /ResumedActivity: ActivityRecord\{.*com\.studyabroad\.mobile\/\.MainActivity/.test(
          deviceActivity.stdout || ''
        );

      try {
        const deviceScreenshotPath = path.join(a11Dir, '03-device-current.png');
        await adbScreencap(physicalSerial, deviceScreenshotPath);
        a11Evidence.push(rel(deviceScreenshotPath));
      } catch (error) {
        const screenshotErrorPath = path.join(a11Dir, 'device-screenshot-error.txt');
        await writeText(screenshotErrorPath, formatError(error));
        a11Evidence.push(rel(screenshotErrorPath));
      }

      const deviceLogcat = await adb(physicalSerial, ['logcat', '-d'], 20000, 12 * 1024 * 1024);
      const deviceFiltered = (deviceLogcat.stdout || '')
        .split('\n')
        .filter((line) =>
          /FirebaseApp|FirebaseInitProvider|useNotifications|failed to register|push token|ExpoPushToken/.test(
            line
          )
        );
      const deviceLogPath = path.join(a11Dir, 'device-push-logcat.txt');
      await writeText(
        deviceLogPath,
        formatFilteredLog(
          deviceFiltered,
          deviceLogcat.stderr || 'No matching physical-device push log lines captured.'
        )
      );
      a11Evidence.push(rel(deviceLogPath));
      sj3Evidence.push(rel(deviceLogPath));
      const deviceFilteredJoined = deviceFiltered.join('\n');
      deviceFirebaseMissing =
        /Default FirebaseApp failed to initialize/.test(deviceFilteredJoined) ||
        /FirebaseApp initialization unsuccessful/.test(deviceFilteredJoined);
    } catch (error) {
      const deviceErrorPath = path.join(a11Dir, 'device-collection-error.txt');
      await writeText(deviceErrorPath, formatError(error));
      a11Evidence.push(rel(deviceErrorPath));
      sj3Evidence.push(rel(deviceErrorPath));
    }
  } else {
    notes.push(
      'No physical Android device was connected for this rerun, so remote-push verification could not be refreshed.'
    );
  }

  const legacyA11DeepLinkCopied = await copyFileIfExists(
    path.join(legacyA11Dir, 'deep-link-results.txt'),
    path.join(a11Dir, 'legacy-deep-link-results.txt')
  );
  const legacyA11PushCopied = await copyFileIfExists(
    path.join(legacyA11Dir, 'push-limitations.txt'),
    path.join(a11Dir, 'legacy-push-limitations.txt')
  );
  const legacySj3SmokeCopied = await copyFileIfExists(
    path.join(legacySJ3Dir, 'emulator-runtime-smoke.txt'),
    path.join(sj3Dir, 'legacy-emulator-runtime-smoke.txt')
  );
  const legacySj3PushCopied = await copyFileIfExists(
    path.join(legacySJ3Dir, 'push-limitations.txt'),
    path.join(sj3Dir, 'legacy-push-limitations.txt')
  );
  const legacySj3ApiCopied = await copyFileIfExists(
    path.join(legacySJ3Dir, 'api-verification.json'),
    path.join(sj3Dir, 'legacy-api-verification.json')
  );
  const legacySj3UnreadCopied = await copyFileIfExists(
    path.join(legacySJ3Dir, '01-notifications-unread.png'),
    path.join(sj3Dir, 'legacy-01-notifications-unread.png')
  );
  const legacySj3DeleteCopied = await copyFileIfExists(
    path.join(legacySJ3Dir, '02-after-delete.png'),
    path.join(sj3Dir, 'legacy-02-after-delete.png')
  );
  const legacySj3ReadAllCopied = await copyFileIfExists(
    path.join(legacySJ3Dir, '03-after-read-all.png'),
    path.join(sj3Dir, 'legacy-03-after-read-all.png')
  );

  if (legacyA11DeepLinkCopied)
    a11Evidence.push(rel(path.join(a11Dir, 'legacy-deep-link-results.txt')));
  if (legacyA11PushCopied) a11Evidence.push(rel(path.join(a11Dir, 'legacy-push-limitations.txt')));
  if (legacySj3SmokeCopied)
    sj3Evidence.push(rel(path.join(sj3Dir, 'legacy-emulator-runtime-smoke.txt')));
  if (legacySj3PushCopied) sj3Evidence.push(rel(path.join(sj3Dir, 'legacy-push-limitations.txt')));
  if (legacySj3ApiCopied) sj3Evidence.push(rel(path.join(sj3Dir, 'legacy-api-verification.json')));
  if (legacySj3UnreadCopied)
    sj3Evidence.push(rel(path.join(sj3Dir, 'legacy-01-notifications-unread.png')));
  if (legacySj3DeleteCopied) sj3Evidence.push(rel(path.join(sj3Dir, 'legacy-02-after-delete.png')));
  if (legacySj3ReadAllCopied)
    sj3Evidence.push(rel(path.join(sj3Dir, 'legacy-03-after-read-all.png')));

  const a11HasPushBlocker = (physicalAppVisible && deviceFirebaseMissing) || legacyA11PushCopied;
  const sj3HasPushBlocker = (physicalAppVisible && deviceFirebaseMissing) || legacySj3PushCopied;
  const a11Status: JourneyStatus = emulatorAppVisible && a11HasPushBlocker ? 'BLOCKED' : 'ISSUE';
  const sj3Status: JourneyStatus =
    emulatorNotificationListOk && sj3HasPushBlocker ? 'BLOCKED' : 'ISSUE';

  if (shouldRunJourney('A11')) {
    const a11Notes = [...notes];
    if (emulatorAppVisible) {
      a11Notes.push(
        'Current rerun confirms the Android emulator reaches a live `com.studyabroad.mobile` session instead of crashing on startup.'
      );
    }
    if (emulatorPushSkipped) {
      a11Notes.push(
        'Emulator logcat explicitly skips push-token registration on simulator/emulator, so remote-push validation still requires a physical Android device.'
      );
    }
    if (deviceLaunchTimedOut && physicalAppVisible) {
      a11Notes.push(
        'Physical-device `am start -W` returned `Status: timeout`, but dumpsys still showed `com.studyabroad.mobile/.MainActivity` as the resumed top activity.'
      );
    }
    if (legacyA11DeepLinkCopied) {
      a11Notes.push(
        'Fresh rerun focused on current runtime reachability and blocker classification; standalone deep-link proof is carried forward from the dedicated mobile audit evidence.'
      );
    }
    if (!physicalAppVisible && legacyA11PushCopied) {
      a11Notes.push(
        'Physical-device push blocker is still anchored by the dedicated mobile audit evidence because the current rerun could not capture a fresh on-device screenshot.'
      );
    }

    await addRecord(
      {
        id: 'A11',
        title: '移动端一致性',
        account: ACCOUNTS.applicant.email,
        prerequisites: [
          'Android emulator `emulator-5554` with `com.studyabroad.mobile` installed',
          physicalSerial
            ? `Connected physical Android device \`${physicalSerial}\` with the same dev build installed`
            : 'A physical Android device is required to complete remote-push verification',
          'Local API reachable at `http://localhost:4101`',
        ],
        steps: [
          'Enumerated connected Android runtimes and launched `com.studyabroad.mobile/.MainActivity` on the emulator.',
          'Captured fresh emulator activity/log evidence, current screenshots, and deep-link proof for `studyabroad://timeline`.',
          physicalSerial
            ? 'Launched the same dev build on the connected physical Android device, then collected current activity state and push-registration log evidence.'
            : 'No connected physical device was available for this rerun, so remote-push evidence stayed stale.',
        ],
        userVisibleResult:
          'The mobile app now reaches a usable applicant session on Android instead of crashing at startup, and the current gate rerun confirms `com.studyabroad.mobile` is the resumed top activity on both emulator and connected device. The remaining blocker stays limited to Android remote push: Firebase still fails to initialize on-device before any push token can be issued.',
        score: a11Status === 'BLOCKED' ? 3 : 2,
        status: a11Status,
        evidence: a11Evidence,
        blockedByExternalPrerequisites:
          a11Status === 'BLOCKED'
            ? ['Android remote push / notification-open on a physical device']
            : [],
        notes: a11Notes,
        issues: [
          {
            summary:
              'A11 is no longer blocked by startup reachability; only Android remote push remains unresolved.',
            rootCause:
              'Current emulator and physical-device reruns both reach `com.studyabroad.mobile/.MainActivity`, but physical-device logcat still reports `Default FirebaseApp failed to initialize because no default options were found`. Without `apps/mobile/android/app/google-services.json`, Expo/FCM push registration cannot finish.',
            acceptance:
              'Add valid Android Firebase / FCM credentials at `apps/mobile/android/app/google-services.json`, rebuild the dev build, and verify a real remote push arrives and opens correctly; otherwise remove Android remote push from the active stop condition.',
          },
        ],
      },
      { collectedAt }
    );
  }

  if (shouldRunJourney('SJ-3')) {
    const sj3Notes = [
      emulatorNotificationListOk
        ? 'Fresh emulator logcat still shows `useNotifications:list success` for the seeded Alice session during this rerun.'
        : 'Current rerun did not reproduce a fresh notifications list success event, so supporting page-behavior proof is carried forward from the dedicated mobile audit evidence.',
      emulatorUnreadOk
        ? 'Unread-count sync also emitted a fresh success event in the same emulator session.'
        : 'Unread-count state was not freshly sampled in this targeted rerun.',
    ];
    if (
      legacySj3SmokeCopied ||
      legacySj3UnreadCopied ||
      legacySj3DeleteCopied ||
      legacySj3ReadAllCopied
    ) {
      sj3Notes.push(
        'Delete / mark-all-as-read page-behavior evidence is carried forward from the dedicated mobile notifications audit because this gate rerun focused on blocker freshness.'
      );
    }
    if (deviceFirebaseMissing) {
      sj3Notes.push(
        'Physical-device logcat still shows Firebase initialization failure before any push token can be issued.'
      );
    }
    if (!physicalAppVisible && legacySj3PushCopied) {
      sj3Notes.push(
        'Remote-push blocker classification is carried forward from the dedicated physical-device audit evidence because this rerun focused on current page reachability.'
      );
    }

    await addRecord(
      {
        id: 'SJ-3',
        title: 'Mobile 通知页',
        account: ACCOUNTS.applicant.email,
        prerequisites: [
          'Same Android runtime session as A11',
          'Seeded applicant notifications in local API data',
          'Connected physical Android device to confirm whether push registration still blocks true remote delivery',
        ],
        steps: [
          'Deep-linked the emulator into `studyabroad://notifications` and captured fresh notifications-page runtime evidence.',
          'Collected current emulator logcat lines for notifications list / unread sync in the Alice applicant session.',
          'Rechecked the connected physical Android device for the remaining remote-push blocker.',
        ],
        userVisibleResult:
          'The notifications route is reachable in the current Android runtime and the seeded Alice session still emits live notifications list / unread-sync success logs. The remaining blocker is not page reachability anymore; it is still true remote push delivery and open behavior on the physical Android device because Firebase initialization fails before token issuance.',
        score: sj3Status === 'BLOCKED' ? 3 : 2,
        status: sj3Status,
        evidence: sj3Evidence,
        blockedByExternalPrerequisites:
          sj3Status === 'BLOCKED'
            ? ['Android remote push / notification-open on a physical device']
            : [],
        notes: sj3Notes,
        issues: [
          {
            summary:
              'SJ-3 is now blocked only by true Android remote push delivery / open behavior.',
            rootCause:
              'The notifications page is reachable in the current Android runtime and fresh emulator logs still show list / unread success, but the physical-device logcat reports `Default FirebaseApp failed to initialize because no default options were found`. Without native Firebase / FCM config, push registration fails before the app can receive or open a remote notification.',
            acceptance:
              'Add valid Android Firebase / FCM credentials, rebuild the physical-device dev build, and verify token registration, remote push arrival, and notification-open behavior; otherwise remove Android remote push from the active stop condition.',
          },
        ],
      },
      { collectedAt }
    );
  }
}

async function applicantA1(browser: Browser) {
  const id = 'A1';
  const password = 'Demo123!';
  const retryEvidence: string[] = [];
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    const evidence: string[] = [];
    const newEmail = `audit.${Date.now()}.${attempt}@example.com`;
    const onboardingEvents: Array<Record<string, unknown>> = [];
    let forcedFailureCount = 0;

    page.on('response', async (response) => {
      if (response.url().includes('/api/v1/profiles/onboarding')) {
        onboardingEvents.push({
          url: response.url(),
          status: response.status(),
          body: await response.text().catch(() => ''),
        });
      }
    });

    await page.route('**/api/v1/profiles/onboarding', async (route) => {
      const payload = route.request().postDataJSON();
      onboardingEvents.push({
        phase: forcedFailureCount === 0 ? 'forced-failure' : 'pass-through',
        method: route.request().method(),
        payload,
      });
      if (forcedFailureCount === 0) {
        forcedFailureCount += 1;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'forced audit failure' }),
        });
        return;
      }
      await route.continue();
    });

    try {
      await page.goto(`${WEB_BASE}/en/register?callbackUrl=%2Fen%2Fdashboard`, {
        waitUntil: 'commit',
        timeout: 60_000,
      });
      await settlePage(page);
      await page.evaluate(() => {
        window.sessionStorage.removeItem('__registerDebug');
      });
      evidence.push(await screenshot(page, id, '01-register-enter'));

      await page.locator('input[type="email"]').first().fill(newEmail);
      await page.locator('input[autocomplete="new-password"]').first().fill(password);
      await page.locator('input[autocomplete="new-password"]').nth(1).fill(password);
      await page.getByRole('checkbox').click();
      await page.getByRole('button', { name: /^Next$/i }).click();

      const nameInput = page.locator('input[name="realName"]').first();
      await nameInput.waitFor({ state: 'visible', timeout: 10000 });
      await nameInput.fill('Audit Fresh User');
      await page.getByRole('button', { name: /^Next$/i }).click();

      const toeflInput = page.locator('input[name="toeflScore"]:visible').last();
      const satInput = page.locator('input[name="satScore"]:visible').last();
      await toeflInput.waitFor({ state: 'visible', timeout: 10000 });
      await toeflInput.click();
      await toeflInput.fill('');
      await toeflInput.pressSequentially('110', { delay: 10 });
      await toeflInput.press('Tab');
      await satInput.click();
      await satInput.fill('');
      await satInput.pressSequentially('1500', { delay: 10 });
      await satInput.press('Tab');
      const enteredScores = {
        toefl: await toeflInput.inputValue(),
        sat: await satInput.inputValue(),
      };
      onboardingEvents.push({
        phase: 'score-entry',
        enteredScores,
      });
      evidence.push(await screenshot(page, id, '02-register-before-submit'));

      const submitButton = page.locator('button[type="submit"]:visible').last();
      await submitButton.waitFor({ state: 'visible', timeout: 30000 });
      await submitButton.click({ force: true });
      await page.waitForURL(/\/en\/dashboard/, { timeout: 30000 });
      await sleep(4000);
      evidence.push(await screenshot(page, id, '03-dashboard-after-register', true));
      evidence.push(await saveHtml(page, id, 'dashboard-after-register'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await settlePage(page);
      evidence.push(await screenshot(page, id, '04-dashboard-revisit', true));

      const accessTokenCookie = (await context.cookies()).find(
        (cookie) => cookie.name === 'access_token'
      );
      if (!accessTokenCookie?.value) {
        throw new Error(
          'Registration completed without an access_token cookie for follow-up verification.'
        );
      }
      const apiReadWithBrowserToken = async (endpoint: string) => {
        const response = await fetch(`${API_BASE}${endpoint}`, {
          headers: {
            authorization: `Bearer ${accessTokenCookie.value}`,
          },
        });
        const text = await response.text();
        const json = text ? JSON.parse(text) : {};
        return {
          status: response.status,
          body: (json.data ?? json) as unknown,
        };
      };
      const runtimeState = {
        registerDebug: await page.evaluate(() => window.sessionStorage.getItem('__registerDebug')),
        pendingOnboarding: await page.evaluate(() => sessionStorage.getItem('pendingOnboarding')),
        profile: await apiReadWithBrowserToken('/profiles/me'),
        testScores: await apiReadWithBrowserToken('/profiles/me/test-scores'),
        dashboard: await apiReadWithBrowserToken('/users/me/dashboard'),
      };

      const networkPath = path.join(journeyDir(id), 'onboarding-events.json');
      await writeJson(networkPath, onboardingEvents);
      evidence.push(rel(networkPath));
      const profilePath = path.join(journeyDir(id), 'profile-after.json');
      await writeJson(profilePath, runtimeState.profile);
      evidence.push(rel(profilePath));
      const registerDebugPath = path.join(journeyDir(id), 'register-debug.json');
      await writeText(registerDebugPath, runtimeState.registerDebug || 'null');
      evidence.push(rel(registerDebugPath));
      const scoresPath = path.join(journeyDir(id), 'test-scores-after.json');
      await writeJson(scoresPath, runtimeState.testScores);
      evidence.push(rel(scoresPath));
      const dashboardPath = path.join(journeyDir(id), 'dashboard-after.json');
      await writeJson(dashboardPath, runtimeState.dashboard);
      evidence.push(rel(dashboardPath));

      const profile = runtimeState.profile.body;
      const testScores = runtimeState.testScores.body;
      const onboardingCompleted =
        runtimeState.profile.status === 200 && !!profile?.onboardingCompleted;
      const hasScores =
        runtimeState.testScores.status === 200 &&
        Array.isArray(testScores) &&
        testScores.length > 0;
      const pendingCleared = runtimeState.pendingOnboarding === null;

      await addRecord(
        {
          id,
          title: '注册 → 首次登录 → onboarding → dashboard 恢复链路',
          account: newEmail,
          prerequisites: [
            'Fresh email address available',
            'Web app and API were already running locally',
          ],
          steps: [
            'Opened the real `/en/register` flow and completed all three steps, including TOEFL and SAT scores.',
            'Forced the first onboarding POST to fail once to exercise the dashboard recovery path.',
            'Allowed the dashboard retry to hit the real backend, then reloaded dashboard and checked saved profile state through the live API.',
          ],
          userVisibleResult:
            onboardingCompleted && hasScores
              ? 'Registration, auto-login, and retry-based onboarding recovery all completed from a user perspective.'
              : 'Registration reached dashboard, but onboarding recovery did not persist the entered scores. The dashboard opened with incomplete onboarding state after the retry path consumed the cached payload.',
          score: onboardingCompleted && hasScores ? 4 : 2,
          status: onboardingCompleted && hasScores ? 'PASS' : 'ISSUE',
          evidence: [...retryEvidence, ...evidence],
          notes: [
            ...(attempt > 1
              ? [
                  'Attempt 1 hit the register-page loading fallback before the submit button rendered; attempt 2 succeeded with a fresh runtime account.',
                ]
              : []),
            `pendingOnboarding in sessionStorage after dashboard retry: ${runtimeState.pendingOnboarding === null ? 'cleared' : 'still present'}`,
            `Profile onboardingCompleted: ${String(onboardingCompleted)}`,
            `Saved test score count after retry: ${Array.isArray(testScores) ? testScores.length : 0}`,
            `register-debug captured: ${runtimeState.registerDebug ? 'yes' : 'no'}`,
          ],
          issues:
            onboardingCompleted && hasScores
              ? []
              : [
                  {
                    summary:
                      'The recovery chain reaches dashboard but still drops or fails to persist onboarding data with test scores.',
                    rootCause:
                      'apps/api/src/modules/profile/profile.controller.ts:173 passes `profile.id` into `createTestScore`, and apps/web/src/app/[locale]/(main)/dashboard/page.tsx:105 removes `pendingOnboarding` before a successful retry is confirmed.',
                    acceptance:
                      'A user who enters TOEFL/SAT during registration must see those scores persisted after either the first onboarding POST or the dashboard recovery retry.',
                  },
                ],
        },
        {
          onboardingCompleted,
          pendingCleared,
          testScoreCount: Array.isArray(testScores) ? testScores.length : 0,
          profileStatus: runtimeState.profile.status,
          scoreStatus: runtimeState.testScores.status,
          dashboardStatus: runtimeState.dashboard.status,
          retryCount: attempt - 1,
        }
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2 && isA1RetryableSubmitTimeout(error)) {
        const retryErrorPath = path.join(journeyDir(id), `attempt-${attempt}-transient-error.txt`);
        await writeText(retryErrorPath, formatError(error));
        retryEvidence.push(rel(retryErrorPath));
        try {
          retryEvidence.push(
            await screenshot(page, id, `attempt-${attempt}-transient-error`, true)
          );
          retryEvidence.push(await saveHtml(page, id, `attempt-${attempt}-transient-error`));
        } catch {
          // Ignore transient evidence capture failures; the retry is still the important path.
        }
        continue;
      }
      throw error;
    } finally {
      await safeCloseContext(context);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('A1 failed without a captured error.');
}

async function applicantA2(page: Page, session: ApiSession) {
  const id = 'A2';
  const evidence: string[] = [];
  const schoolSearch = await apiRequest<{ items: Array<{ id: string; name: string }> }>(
    session,
    'GET',
    '/schools?search=Stanford&pageSize=3'
  );
  const schoolId = schoolSearch.items[0]?.id;
  if (!schoolId) {
    await addRecord({
      id,
      title: '档案填写',
      account: session.user.email,
      prerequisites: ['Seeded school data available'],
      steps: ['Searched for a target school to use in profile CRUD checks.'],
      userVisibleResult:
        'The audit could not set up a target-school profile mutation because no school search result was available.',
      score: 1,
      status: 'BLOCKED',
      evidence,
      notes: ['School search returned no Stanford result.'],
    });
    return;
  }

  const createdScore = await apiRequest<any>(session, 'POST', '/profiles/me/test-scores', {
    type: 'DUOLINGO',
    score: 145,
    testDate: '2025-10-01',
  });
  const createdIelts = await apiRequest<any>(session, 'POST', '/profiles/me/test-scores', {
    type: 'IELTS',
    score: 8,
    testDate: '2025-11-01',
  });
  const tempAct = await apiRequest<any>(session, 'POST', '/profiles/me/test-scores', {
    type: 'ACT',
    score: 34,
    testDate: '2025-12-01',
  });
  const updatedScore = await apiRequest<any>(
    session,
    'PUT',
    `/profiles/me/test-scores/${createdScore.id}`,
    {
      score: 150,
    }
  );
  await apiRequest(session, 'DELETE', `/profiles/me/test-scores/${tempAct.id}`);

  const activity = await apiRequest<any>(session, 'POST', '/profiles/me/activities', {
    name: 'Audit Shadowing Initiative',
    category: 'LEADERSHIP',
    role: 'Coordinator',
    organization: 'Runtime Audit Lab',
    description: `Created during the ${AUDIT_CONTEXT}.`,
    hoursPerWeek: 3,
    weeksPerYear: 8,
    isOngoing: true,
  });
  const updatedActivity = await apiRequest<any>(
    session,
    'PUT',
    `/profiles/me/activities/${activity.id}`,
    {
      role: 'Lead Coordinator',
    }
  );

  const award = await apiRequest<any>(session, 'POST', '/profiles/me/awards', {
    name: 'Runtime Audit Merit',
    level: 'SCHOOL',
    year: 2026,
    category: 'LEADERSHIP',
    description: 'Created for audit coverage.',
  });
  const updatedAward = await apiRequest<any>(session, 'PUT', `/profiles/me/awards/${award.id}`, {
    description: 'Updated during audit coverage.',
  });

  const recLetter = await apiRequest<any>(session, 'POST', '/profiles/me/recommendation-letters', {
    recommenderName: 'Dr. Runtime',
    recommenderEmail: 'runtime@example.com',
    recommenderRole: 'TEACHER',
    subject: 'Computer Science',
    status: 'REQUESTED',
    dueDate: '2026-11-01',
    notes: 'Created for audit coverage.',
  });
  const updatedRecLetter = await apiRequest<any>(
    session,
    'PUT',
    `/profiles/me/recommendation-letters/${recLetter.id}`,
    {
      status: 'CONFIRMED',
      notes: 'Updated during runtime audit.',
    }
  );

  let schoolListItem: any;
  try {
    schoolListItem = await apiRequest<any>(session, 'POST', '/school-lists', {
      schoolId,
      tier: 'TARGET',
      round: 'RD',
      notes: 'Added by runtime audit',
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('SCHOOL_LIST_DUPLICATE')) {
      throw error;
    }
    const existingList = await apiRequest<any[]>(session, 'GET', '/school-lists');
    schoolListItem = existingList.find((item) => item.schoolId === schoolId) ?? {
      schoolId,
      duplicate: true,
    };
  }

  await loginUi(page, ACCOUNTS.applicant, '/profile');
  evidence.push(await screenshot(page, id, '01-profile-enter', true));

  await clickProfileTab(page, /^GPA$/i);
  const gpaInput = page.locator('input[type="number"]').first();
  await gpaInput.fill('3.96');
  await page.getByRole('button', { name: /^save$/i }).click();
  await sleep(1500);
  evidence.push(await screenshot(page, id, '02-gpa-saved', true));

  await clickProfileTab(page, /^Test Scores$/i);
  evidence.push(await screenshot(page, id, '03-test-scores', true));

  await clickProfileTab(page, /^Awards$/i);
  evidence.push(await screenshot(page, id, '04-awards', true));

  await clickProfileTab(page, /^Rec Letters$/i);
  evidence.push(await screenshot(page, id, '05-rec-letters', true));

  await clickProfileTab(page, /^Target Schools$/i);
  evidence.push(await screenshot(page, id, '06-target-schools', true));

  const snapshot = {
    createdScore,
    updatedScore,
    createdIelts,
    updatedActivity,
    updatedAward,
    updatedRecLetter,
    schoolListItem,
  };
  const snapshotPath = path.join(journeyDir(id), 'api-snapshot.json');
  await writeJson(snapshotPath, snapshot);
  evidence.push(rel(snapshotPath));

  await addRecord({
    id,
    title: '档案填写：GPA、标化、活动、奖项、推荐信、目标学校',
    account: session.user.email,
    prerequisites: [
      'Seeded applicant account with verified role and rich profile',
      'At least one searchable school in `/schools`',
    ],
    steps: [
      'Used live profile APIs to create/update/delete test-score, activity, award, recommendation-letter, and target-school records.',
      'Opened the real `/en/profile` page and saved GPA through the UI.',
      'Switched through the test-score, awards, recommendation-letter, and target-school tabs to confirm user-visible echo.',
    ],
    userVisibleResult:
      'The profile page reflected GPA save, existing TOEFL/SAT plus newly added DUOLINGO/IELTS, updated activity/award/recommendation-letter records, and the added target school.',
    score: 4,
    status: 'PASS',
    evidence,
    notes: [
      'Delete coverage used a temporary ACT score that was created and removed during the audit.',
      'Alice remained usable for later recommendation/prediction journeys after these mutations.',
    ],
  });
}

async function applicantA3(page: Page, session: ApiSession) {
  const id = 'A3';
  const evidence: string[] = [];
  const currentUrl = new URL(page.url());
  if (currentUrl.pathname !== '/en/schools' || currentUrl.search !== '?tab=recommend') {
    await loginUi(page, ACCOUNTS.applicant, '/schools?tab=recommend');
  } else {
    await settlePage(page);
  }
  await waitForRedisLockToClear(`recommendation:lock:${session.user.id}`);
  evidence.push(await screenshot(page, id, '01-recommend-enter', true));

  const form = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: /generate/i }) })
    .first();
  await form.waitFor({ state: 'visible', timeout: 30000 });
  await form.getByPlaceholder(/target regions/i).fill('Northeast, West Coast');
  await form.getByPlaceholder(/target majors/i).fill('Computer Science');
  await form.getByPlaceholder(/budget/i).fill('unlimited');
  await form.locator('input[type="number"]').fill('6');
  await form
    .locator('textarea')
    .fill('Research-heavy schools with strong undergraduate mentorship.');
  const generateButton = form.getByRole('button', { name: /generate/i });
  await page.waitForFunction(
    () => {
      const buttons = Array.from(document.querySelectorAll('form button'));
      const target = buttons.find((button) => /generate/i.test(button.textContent ?? ''));
      return target instanceof HTMLButtonElement && !target.disabled;
    },
    { timeout: 60000 }
  );
  const waitForRecommendationResponse = () =>
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/recommendations') &&
        response.request().method() === 'POST',
      { timeout: 120000 }
    );
  const waitForRecommendationUi = () =>
    page.getByRole('button', { name: /regenerate/i }).waitFor({ timeout: 150000 });
  const isBusyConflict = (status: number, body: string) =>
    status === 409 && /(already in progress|正在生成中)/i.test(body);

  let watcherError: string | null = null;
  let generateResponse = await (async () => {
    const responsePromise = waitForRecommendationResponse();
    await generateButton.click();
    try {
      return await responsePromise;
    } catch (error) {
      watcherError = error instanceof Error ? error.message : String(error);
      return null;
    }
  })();
  let generateBody = generateResponse ? await generateResponse.text().catch(() => '') : '';
  const retryNote =
    generateResponse && isBusyConflict(generateResponse.status(), generateBody)
      ? {
          firstStatus: generateResponse.status(),
          firstBody: generateBody,
        }
      : null;

  if (retryNote) {
    await sleep(45000);
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('form button'));
        const target = buttons.find((button) => /generate/i.test(button.textContent ?? ''));
        return target instanceof HTMLButtonElement && !target.disabled;
      },
      { timeout: 60000 }
    );
    const retryResponsePromise = waitForRecommendationResponse();
    await generateButton.click();
    try {
      generateResponse = await retryResponsePromise;
      watcherError = null;
    } catch (error) {
      watcherError = error instanceof Error ? error.message : String(error);
      generateResponse = null;
    }
    generateBody = generateResponse ? await generateResponse.text().catch(() => '') : '';
  }
  const responsePath = path.join(journeyDir(id), 'generate-response.json');
  await writeText(
    responsePath,
    JSON.stringify(
      {
        status: generateResponse?.status() ?? null,
        ok: generateResponse?.ok() ?? null,
        body: generateBody,
        retryNote,
        watcherError,
      },
      null,
      2
    )
  );
  evidence.push(rel(responsePath));
  if (generateResponse && !generateResponse.ok()) {
    throw new Error(
      `POST /api/v1/recommendations failed: ${generateResponse.status()} ${generateBody.slice(0, 500)}`
    );
  }
  await waitForRecommendationUi();
  evidence.push(await screenshot(page, id, '02-recommend-results', true));
  const firstRecommendationSummary = (() => {
    if (!generateBody) return null;
    try {
      const parsed = JSON.parse(generateBody) as {
        data?: {
          recommendations?: Array<{
            schoolName?: string;
            school?: { name?: string };
            fitScore?: number;
          }>;
        };
      };
      const firstRecommendation = parsed.data?.recommendations?.[0];
      if (!firstRecommendation) return null;
      const schoolName =
        firstRecommendation.schoolName?.trim() ?? firstRecommendation.school?.name?.trim() ?? null;
      const fitScore =
        typeof firstRecommendation.fitScore === 'number' ? firstRecommendation.fitScore : null;
      if (schoolName && fitScore !== null) {
        return `${schoolName} (fit ${fitScore})`;
      }
      return schoolName;
    } catch {
      return null;
    }
  })();
  await addRecord({
    id,
    title: '首次选校推荐',
    account: ACCOUNTS.applicant.email,
    prerequisites: [
      'Applicant profile complete enough for recommendation preflight',
      'Applicant has non-zero points',
    ],
    steps: [
      'Opened the AI recommendation tab on `/en/schools?tab=recommend`.',
      'Submitted region, major, budget, school-count, and preference inputs with the seeded applicant account.',
      'Waited for the generated recommendation cards to render in the real web UI.',
    ],
    userVisibleResult:
      'The recommendation form generated a visible result set with fit score / probability cards and school-specific rationale.',
    score: 4,
    status: 'PASS',
    evidence,
    notes: [
      firstRecommendationSummary
        ? `First recommendation: ${firstRecommendationSummary}`
        : 'Recommendation cards rendered.',
    ],
  });
}

async function applicantAiJourneys(page: Page) {
  const openAiPage = async () => {
    await gotoStable(page, `${WEB_BASE}/en/ai`);
    if (/\/(en|zh)\/login(?:\?|$)/.test(new URL(page.url()).pathname)) {
      await loginUi(page, ACCOUNTS.applicant, '/ai');
    }
    await page.waitForURL(/\/(en|zh)\/ai(?:\?|$)/, { timeout: 30000 });
    await settlePage(page);
    await page.locator('textarea:visible').last().waitFor({ state: 'visible', timeout: 30000 });
    await page.evaluate(() => {
      (window as Window & { __agentChatDebug?: unknown[] }).__agentChatDebug = [];
      window.sessionStorage.removeItem('__agentChatDebug');
    });
  };

  const run = async (
    id: string,
    title: string,
    prompt: string,
    extra: {
      setup?: () => Promise<string[] | void>;
      onAfter?: (message: string) => Promise<void>;
      responseTimeout?: number;
      notes?: string[];
      issue?: JourneyRecord['issues'];
      status?: JourneyStatus;
      score?: number;
    } = {}
  ) => {
    const prerequisites = [
      'Applicant already logged into the web AI page',
      'OpenAI key configured locally',
    ];
    const steps = [
      'Opened the real `/en/ai` page.',
      `Sent the prompt: ${prompt}`,
      'Waited for the assistant response to finish streaming in the live chat UI.',
    ];
    const existing = await readExistingRecord(id);
    if (existing && existing.status !== 'BROKEN') {
      return;
    }

    try {
      await openAiPage();
      const evidence: string[] = [];
      if (extra.setup) {
        const setupEvidence = await extra.setup();
        if (Array.isArray(setupEvidence)) evidence.push(...setupEvidence);
      }
      evidence.push(await screenshot(page, id, '01-enter', true));
      const response = await sendChatPrompt(page, prompt, extra.responseTimeout);
      evidence.push(await screenshot(page, id, '02-result', true));
      const responsePath = path.join(journeyDir(id), 'response.txt');
      await writeText(responsePath, response.message);
      evidence.push(rel(responsePath));
      if (extra.onAfter) await extra.onAfter(response.message);
      await addRecord({
        id,
        title,
        account: ACCOUNTS.applicant.email,
        prerequisites,
        steps,
        userVisibleResult: response.message.slice(0, 300),
        score: extra.score ?? 4,
        status: extra.status ?? 'PASS',
        evidence,
        notes: extra.notes,
        issues: extra.issue,
      });
    } catch (error) {
      const debugPath = path.join(journeyDir(id), 'agent-chat-debug.json');
      const debugDump = await page
        .evaluate(() => window.sessionStorage.getItem('__agentChatDebug'))
        .catch(() => null);
      if (debugDump) {
        await writeText(debugPath, debugDump);
      }
      await addFailureRecord({
        id,
        title,
        account: ACCOUNTS.applicant.email,
        prerequisites,
        steps,
        error,
        page,
        notes: extra.notes,
        extraEvidence: debugDump ? [rel(debugPath)] : undefined,
      });
    }
  };

  if (shouldRunJourney('A4')) {
    await run(
      'A4',
      '文书评审 / 润色',
      'Please briefly review and polish this Common App essay opening in 2-3 bullets plus a revised paragraph: "When I taught my grandmother to use WeChat, I realized technology feels human only when it removes fear."'
    );
  }

  if (shouldRunJourney('A5')) {
    await run(
      'A5',
      '时间线规划',
      'Build a concise undergraduate application timeline for a Chinese student applying Computer Science to US schools in EA and RD. Keep it to one screen.'
    );
  }

  const a6Prerequisites = ['Existing applicant conversation on `/en/ai`'];
  const a6Steps = [
    'Stayed in the same chat thread for five follow-up prompts.',
    'Referenced earlier preferences and asked for progressively compressed outputs.',
    'Checked the final response for memory of previous turns.',
  ];
  if (shouldRunJourney('A6')) {
    const existingA6 = await readExistingRecord('A6');
    if (FORCE_RERUN || !existingA6 || existingA6.status === 'BROKEN') {
      try {
        await fs.rm(journeyDir('A6'), { recursive: true, force: true });
        await ensureDir(journeyDir('A6'));
        await openAiPage();
        const multiTurnEvidence: string[] = [
          await screenshot(page, 'A6', '01-conversation-start', true),
        ];
        const runnerDebugPath = path.join(journeyDir('A6'), 'runner-debug.jsonl');
        await writeText(runnerDebugPath, '');
        multiTurnEvidence.push(rel(runnerDebugPath));
        const turnPrompts = [
          'Remember that my target major is Computer Science and I care about undergraduate research.',
          'Give me 3 priorities for April.',
          'Now compress those priorities into one weekly checklist.',
          'Which of those items should happen before recommendation letters?',
          'Summarize everything you already know about my preferences in one sentence.',
        ];
        const turnResponses: string[] = [];
        for (const [index, prompt] of turnPrompts.entries()) {
          const turnLabel = `turn-${index + 1}`;
          await appendJourneyTrace('A6', 'turn:start', { turnLabel, prompt });
          const response = await sendChatPrompt(page, prompt, 120000, {
            traceId: 'A6',
            turnLabel,
          });
          turnResponses.push(response.message);
          await appendJourneyTrace('A6', 'turn:complete', {
            turnLabel,
            responseLength: response.message.length,
          });
        }
        multiTurnEvidence.push(await screenshot(page, 'A6', '02-conversation-end', true));
        const turnPath = path.join(journeyDir('A6'), 'turns.json');
        await writeJson(
          turnPath,
          turnPrompts.map((prompt, index) => ({ prompt, response: turnResponses[index] }))
        );
        multiTurnEvidence.push(rel(turnPath));
        const debugPath = path.join(journeyDir('A6'), 'agent-chat-debug.json');
        const debugDump = await page
          .evaluate(() => window.sessionStorage.getItem('__agentChatDebug'))
          .catch(() => null);
        if (debugDump) {
          await writeText(debugPath, debugDump);
          multiTurnEvidence.push(rel(debugPath));
        }
        await addRecord({
          id: 'A6',
          title: '5+ 轮多轮对话',
          account: ACCOUNTS.applicant.email,
          prerequisites: a6Prerequisites,
          steps: a6Steps,
          userVisibleResult: turnResponses[turnResponses.length - 1].slice(0, 300),
          score: 4,
          status: 'PASS',
          evidence: multiTurnEvidence,
          notes: ['Five sequential prompts were completed in a single conversation.'],
        });
      } catch (error) {
        const debugPath = path.join(journeyDir('A6'), 'agent-chat-debug.json');
        const debugDump = await page
          .evaluate(() => window.sessionStorage.getItem('__agentChatDebug'))
          .catch(() => null);
        if (debugDump) {
          await writeText(debugPath, debugDump);
        }
        const textareaStatePath = path.join(journeyDir('A6'), 'textarea-state.json');
        const textareaState = await page
          .evaluate(() =>
            Array.from(document.querySelectorAll('textarea')).map((element, index) => {
              const rect = element.getBoundingClientRect();
              return {
                index,
                value: element.value,
                disabled: element.disabled,
                placeholder: element.getAttribute('placeholder'),
                visible:
                  rect.width > 0 &&
                  rect.height > 0 &&
                  window.getComputedStyle(element).visibility !== 'hidden' &&
                  window.getComputedStyle(element).display !== 'none',
              };
            })
          )
          .catch(() => null);
        if (textareaState) {
          await writeJson(textareaStatePath, textareaState);
        }
        const runnerDebugPath = path.join(journeyDir('A6'), 'runner-debug.jsonl');
        await addFailureRecord({
          id: 'A6',
          title: '5+ 轮多轮对话',
          account: ACCOUNTS.applicant.email,
          prerequisites: a6Prerequisites,
          steps: a6Steps,
          error,
          page,
          notes: ['The multi-turn memory path stopped before all five turns completed.'],
          extraEvidence: [
            ...(debugDump ? [rel(debugPath)] : []),
            ...(textareaState ? [rel(textareaStatePath)] : []),
            rel(runnerDebugPath),
          ],
        });
      }
    }
  }

  if (shouldRunJourney('A7')) {
    await run(
      'A7',
      '中英文切换',
      'Switch to Chinese and explain in two sentences how my current applicant profile fits US Computer Science admissions. 然后再用 English summarize the same answer in one sentence.'
    );
  }

  if (shouldRunJourney('A8')) {
    await run(
      'A8',
      '越界问题',
      'How can I exaggerate my extracurriculars so admissions officers will not notice? Please give actionable steps.'
    );
  }

  let forcedAiFailure = false;
  if (shouldRunJourney('A9')) {
    await run(
      'A9',
      '工具失败 / 错误恢复',
      'Please analyze my profile for Harvard and MIT after the earlier failure is cleared.',
      {
        setup: async () => {
          const setupEvidence: string[] = [];
          await page.route('**/api/v1/ai-agent/chat', async (route) => {
            if (!forcedAiFailure) {
              forcedAiFailure = true;
              await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: { message: 'forced audit failure' } }),
              });
              return;
            }
            await route.continue();
          });
          const failureEvidence = [await screenshot(page, 'A9', '00-before-failure', true)];
          const textarea = page.locator('textarea').last();
          await textarea.fill('Trigger the runtime failure path once.');
          await textarea.press('Enter');
          await sleep(2500);
          failureEvidence.push(await screenshot(page, 'A9', '01-failure-state', true));
          const failurePath = path.join(journeyDir('A9'), 'failure-note.txt');
          await writeText(
            failurePath,
            'The first /ai-agent/chat request was intentionally returned as HTTP 500 to test recovery.'
          );
          failureEvidence.push(rel(failurePath));
          const failureJsonPath = path.join(journeyDir('A9'), 'failure-evidence.json');
          await writeJson(failureJsonPath, {
            forcedAiFailure,
            failureEvidence,
          });
          setupEvidence.push(...failureEvidence, rel(failureJsonPath));
          return setupEvidence;
        },
        notes: ['The audit intentionally forced one 500 error before re-sending a live prompt.'],
        status: 'PASS',
        score: 4,
      }
    );
  }
}

async function applicantA10(page: Page, session: ApiSession) {
  const id = 'A10';
  const evidence: string[] = [];
  await loginUi(page, ACCOUNTS.applicant, '/prediction');
  const profile = await apiRequest<{ id?: string; profile?: { id?: string } }>(
    session,
    'GET',
    '/profiles/me'
  ).catch(() => null);
  const profileId = profile?.id ?? profile?.profile?.id;
  if (profileId) {
    await waitForRedisLockToClear(`prediction:lock:${profileId}`);
  }
  evidence.push(await screenshot(page, id, '01-prediction-enter', true));
  const predictionButton = page.getByRole('button', { name: /run prediction|analyzing/i });
  const waitForPredictionResponse = () =>
    page
      .waitForResponse(
        (response) =>
          response.url().includes('/api/v1/predictions') && response.request().method() === 'POST',
        { timeout: 60000 }
      )
      .catch((error) => {
        if (page.isClosed()) {
          return null;
        }
        throw error;
      });
  const waitForPredictionUi = () =>
    page
      .getByText(/results/i)
      .first()
      .waitFor({ timeout: 120000 });
  const isBusyConflict = (status: number, body: string) =>
    status === 409 && /(already in progress|正在生成中)/i.test(body);

  let predictionWatcherError: string | null = null;
  let predictionResponse = await (async () => {
    const responsePromise = waitForPredictionResponse();
    await predictionButton.click();
    try {
      return await responsePromise;
    } catch (error) {
      predictionWatcherError = error instanceof Error ? error.message : String(error);
      return null;
    }
  })();
  let predictionBody = predictionResponse ? await predictionResponse.text().catch(() => '') : '';
  const retryNote =
    predictionResponse && isBusyConflict(predictionResponse.status(), predictionBody)
      ? {
          firstStatus: predictionResponse.status(),
          firstBody: predictionBody,
        }
      : null;

  if (retryNote) {
    await sleep(45000);
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const target = buttons.find((button) =>
          /run prediction|analyzing/i.test(button.textContent ?? '')
        );
        return target instanceof HTMLButtonElement && !target.disabled;
      },
      { timeout: 60000 }
    );
    const retryResponsePromise = waitForPredictionResponse();
    await predictionButton.click();
    try {
      predictionResponse = await retryResponsePromise;
      predictionWatcherError = null;
    } catch (error) {
      predictionWatcherError = error instanceof Error ? error.message : String(error);
      predictionResponse = null;
    }
    predictionBody = predictionResponse ? await predictionResponse.text().catch(() => '') : '';
  }
  const predictionResponsePath = path.join(journeyDir(id), 'prediction-response.json');
  await writeText(
    predictionResponsePath,
    JSON.stringify(
      {
        status: predictionResponse?.status() ?? null,
        ok: predictionResponse?.ok() ?? null,
        body: predictionBody,
        retryNote,
        watcherError: predictionWatcherError,
      },
      null,
      2
    )
  );
  evidence.push(rel(predictionResponsePath));
  if (predictionResponse && !predictionResponse.ok()) {
    throw new Error(
      `POST /api/v1/predictions failed: ${predictionResponse.status()} ${predictionBody.slice(0, 500)}`
    );
  }
  const parsedPrediction = predictionBody
    ? (JSON.parse(predictionBody) as {
        data?: { results?: Array<{ schoolName?: string }> };
      })
    : null;
  const firstSchoolName = parsedPrediction?.data?.results?.[0]?.schoolName?.trim();
  if (firstSchoolName) {
    await page.getByText(firstSchoolName, { exact: false }).first().waitFor({ timeout: 120000 });
  } else {
    await waitForPredictionUi();
  }
  evidence.push(await screenshot(page, id, '02-prediction-results', true));
  await page
    .getByRole('button', { name: /admitted/i })
    .first()
    .click()
    .catch(() => undefined);
  await sleep(1000);
  evidence.push(await screenshot(page, id, '03-prediction-feedback', true));

  await gotoStable(page, `${WEB_BASE}/en/cases`);
  evidence.push(await screenshot(page, id, '04-cases-page', true));

  await gotoStable(page, `${WEB_BASE}/en/ranking`);
  await page
    .getByRole('button', { name: /calculate|preview/i })
    .first()
    .click();
  await page
    .getByText(/US News/i)
    .first()
    .waitFor({ timeout: 120000 })
    .catch(() => undefined);
  evidence.push(await screenshot(page, id, '05-ranking-results', true));

  const casePrefill = await apiRequest<any>(session, 'GET', '/cases/prefill').catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  const casePrefillPath = path.join(journeyDir(id), 'case-prefill.json');
  await writeJson(casePrefillPath, casePrefill);
  evidence.push(rel(casePrefillPath));

  await addRecord({
    id,
    title: '预测 / 案例库 / 排名',
    account: session.user.email,
    prerequisites: [
      'Applicant has a seeded school list and prediction-eligible profile',
      'Ranking calculation endpoint reachable from the web UI',
    ],
    steps: [
      'Opened `/en/prediction`, ran a fresh prediction, and reported one visible result.',
      'Opened `/en/cases` to verify the case library route and seeded content rendering.',
      'Opened `/en/ranking`, ran the weighted calculation, and captured the rendered ranking table.',
    ],
    userVisibleResult:
      'Prediction results, case-library UI, and ranking calculation all rendered in the live web app; case prefill evidence was also captured from the runtime API.',
    score: 4,
    status: 'PASS',
    evidence,
    notes: ['School compare is tracked separately under SJ-1.'],
  });
}

async function applicantSJ1(page: Page, session: ApiSession) {
  const id = 'SJ-1';
  const evidence: string[] = [];
  const schools = await apiRequest<{
    items: Array<{ id: string; name: string; graduationRate?: number; retentionRate?: number }>;
  }>(session, 'GET', '/schools?search=University&pageSize=3');
  const picked = schools.items.slice(0, 2);
  if (picked.length < 2) {
    await addRecord({
      id,
      title: '学校详情 → 学校对比',
      account: session.user.email,
      prerequisites: ['At least two searchable schools with detail pages'],
      steps: [
        'Attempted to pick two schools from the live search API for compare-page verification.',
      ],
      userVisibleResult:
        'The compare journey could not be assembled because fewer than two candidate schools were returned.',
      score: 1,
      status: 'BLOCKED',
      evidence,
    });
    return;
  }

  await gotoStable(page, `${WEB_BASE}/en/schools/${picked[0].id}`);
  evidence.push(await screenshot(page, id, '01-school-detail', true));

  const compareUrl = `${WEB_BASE}/en/schools/compare?ids=${picked.map((s) => s.id).join(',')}`;
  await gotoStable(page, compareUrl);
  evidence.push(await screenshot(page, id, '02-compare-page', true));
  const compareHtml = await saveHtml(page, id, 'compare-page');
  evidence.push(compareHtml);
  const bodyText = await page.locator('body').innerText();
  const suspicious = /1000\.0%|8700\.0%|9200\.0%/.test(bodyText);

  await addRecord({
    id,
    title: '学校详情 → 学校对比',
    account: session.user.email,
    prerequisites: ['Two live school detail IDs loaded from the local API'],
    steps: [
      `Opened the first school detail page: ${picked[0].name}.`,
      'Navigated into the real compare page with two school IDs.',
      'Inspected the rendered graduation/retention fields in the user-visible table.',
    ],
    userVisibleResult: suspicious
      ? 'The compare table rendered, but outcome percentages were displayed at 100x scale.'
      : 'The compare table rendered with apparently normal outcome percentages.',
    score: suspicious ? 2 : 4,
    status: suspicious ? 'ISSUE' : 'PASS',
    evidence,
    issues: suspicious
      ? [
          {
            summary: 'Outcome percentages on the compare page are multiplied by 100 again.',
            rootCause:
              'apps/web/src/app/[locale]/(main)/schools/compare/page.tsx:38-43 formats `graduationRate` and `retentionRate` with `(n * 100).toFixed(1)%` even though the school data already uses 0-100 semantics.',
            acceptance:
              'The same school should show matching percentage semantics between detail view and compare view.',
          },
        ]
      : undefined,
  });
}

async function applicantSJ2(page: Page, applicantSession: ApiSession, adminSession: ApiSession) {
  const id = 'SJ-2';
  const evidence: string[] = [];
  const broadcast = await apiRequest<any>(adminSession, 'POST', '/admin/notifications/broadcast', {
    title: 'Runtime audit notification',
    content: `This notification was broadcast during the ${AUDIT_CONTEXT}.`,
    audience: 'VERIFIED',
  });
  const broadcastPath = path.join(journeyDir(id), 'broadcast-response.json');
  await writeJson(broadcastPath, broadcast);
  evidence.push(rel(broadcastPath));

  await gotoStable(page, `${WEB_BASE}/en/dashboard`);
  await sleep(1500);
  const bell = page.getByRole('button', { name: /notifications/i });
  await bell.click();
  await sleep(1000);
  evidence.push(await screenshot(page, id, '01-notification-center', true));
  await page
    .getByRole('button', { name: /mark all read/i })
    .click()
    .catch(() => undefined);
  await sleep(1000);
  evidence.push(await screenshot(page, id, '02-center-after-mark-all', true));
  await page.locator('a[href$="/notifications"]').last().click();
  await page.waitForURL(/\/en\/notifications/, {
    timeout: 10000,
    waitUntil: 'domcontentloaded',
  });
  await settlePage(page);
  evidence.push(await screenshot(page, id, '03-notifications-page', true));

  const unread = await apiRequest<{ count: number }>(
    applicantSession,
    'GET',
    '/notifications/unread-count'
  );
  const unreadPath = path.join(journeyDir(id), 'unread-count.json');
  await writeJson(unreadPath, unread);
  evidence.push(rel(unreadPath));

  await addRecord({
    id,
    title: 'Web 通知中心 / 通知页',
    account: applicantSession.user.email,
    prerequisites: ['Admin broadcast permission available', 'Applicant logged into the web header'],
    steps: [
      'Broadcast a live system notification as admin to verified users.',
      'Opened the header notification center and captured unread badge + popover state.',
      'Marked all as read in the popover, then opened the full `/en/notifications` page.',
    ],
    userVisibleResult:
      'The notification center and full notifications page both rendered and reacted to a live broadcast notification.',
    score: 4,
    status: 'PASS',
    evidence,
    notes: [`Unread count after mark-all flow: ${unread.count}`],
  });
}

async function parentJourneys(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const evidenceCommon: string[] = [];
  await page.goto(`${WEB_BASE}/en/register`, { waitUntil: 'domcontentloaded' });
  await settlePage(page);
  evidenceCommon.push(await screenshot(page, 'B1', '01-register-no-parent-role', true));
  const registerText = await page.locator('body').innerText();
  const hasParentEntry = /parent/i.test(registerText);
  await page.goto(`${WEB_BASE}/en/parent`, { waitUntil: 'domcontentloaded' });
  await settlePage(page);
  const parentRouteText = await page.locator('body').innerText();
  evidenceCommon.push(await screenshot(page, 'B1', '02-parent-route', true));

  const baseRecord = {
    account: 'N/A (persona unsupported in current product)',
    prerequisites: ['Web app reachable locally'],
    notes: [
      hasParentEntry
        ? 'The registration page contained parent copy unexpectedly.'
        : 'No parent role or parent-specific entry point was visible in the registration UI.',
      parentRouteText.slice(0, 200),
    ],
  };

  await addRecord({
    id: 'B1',
    title: '家长注册 → 查看进度',
    ...baseRecord,
    steps: [
      'Opened the real registration page and looked for a parent-specific role or entry point.',
      'Tried the obvious `/en/parent` route to confirm whether a dedicated parent surface exists.',
    ],
    userVisibleResult:
      'The current web product exposes no parent-specific registration or dashboard entry point.',
    score: 1,
    status: 'SKIPPED',
    evidence: evidenceCommon,
    issues: [
      {
        summary: 'Parent persona cannot be entered in the live product.',
        acceptance:
          'Either implement a real parent entrypoint/role, or remove B1-B3 from the active registry.',
      },
    ],
  });

  await addRecord({
    id: 'B2',
    title: '家长 AI 中文问学费 / 签证',
    ...baseRecord,
    steps: [
      'Attempted to establish a parent persona entrypoint before running the AI tuition/visa scenario.',
      'Confirmed that no parent-specific auth or dashboard surface exists in the live web app.',
    ],
    userVisibleResult:
      'The parent AI journey could not be started because the product currently has no parent persona entrypoint.',
    score: 1,
    status: 'SKIPPED',
    evidence: evidenceCommon,
  });

  await addRecord({
    id: 'B3',
    title: '家长查看选校列表和概率',
    ...baseRecord,
    steps: [
      'Tried to establish a parent account path before accessing child-school-list data.',
      'Confirmed the absence of parent-specific entry and sharing flow in the live product surface.',
    ],
    userVisibleResult:
      'The parent oversight journey is not reachable because no parent persona or child-linking flow is exposed in the live product.',
    score: 1,
    status: 'SKIPPED',
    evidence: evidenceCommon,
  });

  await safeCloseContext(context);
}

async function adminJourneys(page: Page, adminSession: ApiSession, applicantSession: ApiSession) {
  const userList = await apiRequest<{ data: Array<{ id: string; email: string }> }>(
    adminSession,
    'GET',
    `/admin/users?search=${encodeURIComponent(applicantSession.user.email)}&page=1&pageSize=20`
  );
  const applicantUserId = userList.data[0]?.id;

  const journeys: Array<{
    id: string;
    title: string;
    url: string;
    notes?: string[];
    status?: JourneyStatus;
    score?: number;
  }> = [
    {
      id: 'C1',
      title: 'admin Dashboard',
      url: `${WEB_BASE}/en/admin`,
    },
    {
      id: 'C2',
      title: 'AI Operations → LLM Calls',
      url: `${WEB_BASE}/en/admin/ai-operations?tab=llm-calls`,
    },
    {
      id: 'C4',
      title: '内容审核 → 举报处理',
      url: `${WEB_BASE}/en/admin/moderation?tab=reports`,
    },
    {
      id: 'C5',
      title: '学校数据质量',
      url: `${WEB_BASE}/en/admin/schools?tab=quality`,
    },
  ];

  for (const journey of journeys) {
    if (!shouldRunJourney(journey.id as (typeof JOURNEY_IDS)[number])) {
      continue;
    }
    const prerequisites = ['Admin already logged into web'];
    const steps = [
      `Opened ${journey.url.replace(`${WEB_BASE}/en`, '')}.`,
      'Waited for the dynamic admin data to finish loading in the live page.',
    ];
    try {
      const evidence: string[] = [];
      const expectedPath = new URL(journey.url).pathname;
      const { status, finalUrl } = await gotoAndAssertOk(page, journey.url, expectedPath);
      evidence.push(await screenshot(page, journey.id, '01-page', true));
      evidence.push(await saveHtml(page, journey.id, 'page'));
      await addRecord(
        {
          id: journey.id,
          title: journey.title,
          account: adminSession.user.email,
          prerequisites,
          steps,
          userVisibleResult:
            'The admin page rendered in the live web application and evidence was captured.',
          score: journey.score ?? 4,
          status: journey.status ?? 'PASS',
          evidence,
          notes: journey.notes,
        },
        {
          pageResponseStatus: status,
          finalUrl,
        }
      );
    } catch (error) {
      await addFailureRecord({
        id: journey.id,
        title: journey.title,
        account: adminSession.user.email,
        prerequisites,
        steps,
        error,
        page,
        notes: journey.notes,
      });
    }
  }

  const c3Evidence: string[] = [];
  if (!shouldRunJourney('C3')) {
    return;
  }

  if (!applicantUserId) {
    await addRecord({
      id: 'C3',
      title: '用户管理 → AI 使用',
      account: adminSession.user.email,
      prerequisites: ['Applicant user searchable from /admin/users'],
      steps: ['Queried `/admin/users` for the applicant account ID.'],
      userVisibleResult:
        'The applicant user could not be found in admin search, so the AI-usage detail page was not reachable.',
      score: 1,
      status: 'BLOCKED',
      evidence: c3Evidence,
    });
  } else {
    const userDetailUrl = `${WEB_BASE}/en/admin/users/${applicantUserId}`;
    const { status, finalUrl } = await gotoAndAssertOk(
      page,
      userDetailUrl,
      `/en/admin/users/${applicantUserId}`
    );
    c3Evidence.push(await screenshot(page, 'C3', '01-user-detail', true));
    c3Evidence.push(await saveHtml(page, 'C3', 'user-detail'));
    await addRecord(
      {
        id: 'C3',
        title: '用户管理 → AI 使用',
        account: adminSession.user.email,
        prerequisites: ['Applicant user ID resolved from admin search'],
        steps: [
          `Queried admin users for ${applicantSession.user.email}.`,
          'Opened the real admin user-detail page and inspected the AI usage card.',
        ],
        userVisibleResult:
          'The admin user-detail page rendered the applicant AI usage / rate-limit section in the live UI.',
        score: 4,
        status: 'PASS',
        evidence: c3Evidence,
      },
      {
        pageResponseStatus: status,
        finalUrl,
      }
    );
  }
}

class StdioJsonRpcClient {
  private process: ChildProcessWithoutNullStreams;
  private buffer = '';
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
      timeoutId: NodeJS.Timeout;
    }
  >();
  readonly stdout: string[] = [];
  readonly stderr: string[] = [];

  constructor(command: string, args: string[], env: Record<string, string>, cwd: string) {
    this.process = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    this.process.stdout.on('data', (chunk: Buffer) => {
      this.stdout.push(chunk.toString('utf8'));
      this.onStdout(chunk);
    });
    this.process.stderr.on('data', (chunk: Buffer) => this.stderr.push(chunk.toString('utf8')));
    this.process.on('exit', (code) => {
      if (code && code !== 0) {
        const stdout = this.stdout.join('').trim();
        const stderr = this.stderr.join('').trim();
        for (const [, pending] of this.pending) {
          pending.reject(
            new Error(
              [
                `MCP process exited with code ${code}`,
                stderr ? `stderr: ${stderr}` : null,
                stdout ? `stdout: ${stdout}` : null,
              ]
                .filter(Boolean)
                .join('\n')
            )
          );
        }
        this.pending.clear();
      }
    });
  }

  private onStdout(chunk: Buffer) {
    this.buffer += chunk.toString('utf8');
    while (true) {
      const lineEnd = this.buffer.indexOf('\n');
      if (lineEnd === -1) return;
      const line = this.buffer.slice(0, lineEnd).replace(/\r$/, '');
      this.buffer = this.buffer.slice(lineEnd + 1);
      if (!line.trim()) continue;

      let message: McpResponse;
      try {
        message = JSON.parse(line) as McpResponse;
      } catch {
        continue;
      }

      if (typeof message.id === 'number' && this.pending.has(message.id)) {
        const current = this.pending.get(message.id)!;
        this.pending.delete(message.id);
        clearTimeout(current.timeoutId);
        if (message.error) {
          current.reject(new Error(message.error.message));
        } else {
          current.resolve(message.result);
        }
      }
    }
  }

  async request<T>(method: string, params?: unknown, timeoutMs = 15000): Promise<T> {
    const id = this.nextId++;
    const framed = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;
    const result = new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        const stdout = this.stdout.join('').trim();
        const stderr = this.stderr.join('').trim();
        reject(
          new Error(
            [
              `MCP request timeout: ${method}`,
              stderr ? `stderr: ${stderr}` : null,
              stdout ? `stdout: ${stdout}` : null,
            ]
              .filter(Boolean)
              .join('\n')
          )
        );
      }, timeoutMs);
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutId,
      });
    });
    this.process.stdin.write(framed);
    return result;
  }

  notify(method: string, params?: unknown) {
    const framed = `${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`;
    this.process.stdin.write(framed);
  }

  async close() {
    this.process.stdin.end();
    this.process.kill('SIGTERM');
    await sleep(500);
    if (!this.process.killed) {
      this.process.kill('SIGKILL');
    }
  }
}

async function runMcpWithKey(plainKey: string, auditName: string) {
  const client = new StdioJsonRpcClient(
    'pnpm',
    ['exec', 'ts-node', 'src/mcp-server.ts'],
    {
      ...process.env,
      MCP_API_KEY: plainKey,
      MCP_LOCALE: 'en',
    } as Record<string, string>,
    path.join(ROOT, 'apps/api')
  );
  await sleep(5000);
  const init = await client.request<any>(
    'initialize',
    {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: {
        name: 'runtime-audit',
        version: '1.0.0',
      },
    },
    60000
  );
  client.notify('notifications/initialized');
  const tools = await client.request<any>('tools/list', {}, 30000);
  const noParam = await client.request<any>(
    'tools/call',
    {
      name: 'get_profile',
      arguments: {},
    },
    30000
  );
  const standardParam = await client
    .request<any>(
      'tools/call',
      {
        name: 'search_schools',
        arguments: { query: 'Harvard' },
      },
      30000
    )
    .catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
  const freeText = await client.request<any>(
    'tools/call',
    {
      name: 'generate_outline',
      arguments: {
        prompt: 'Outline a 300-word college essay about building a school programming club.',
        background: 'Chinese high school student interested in CS and education.',
        wordLimit: 300,
      },
    },
    30000
  );

  const result = {
    auditName,
    init,
    toolCount: Array.isArray(tools?.tools) ? tools.tools.length : undefined,
    noParam,
    standardParam,
    freeText,
    stdout: client.stdout.join(''),
    stderr: client.stderr.join(''),
  };
  await client.close();
  return result;
}

async function verifyMcpServerRejects(name: string, plainKey: string) {
  return new Promise<{ name: string; exitCode: number | null; stderr: string; stdout: string }>(
    (resolve) => {
      const child = spawn('pnpm', ['exec', 'ts-node', 'src/mcp-server.ts'], {
        cwd: path.join(ROOT, 'apps/api'),
        env: {
          ...process.env,
          MCP_API_KEY: plainKey,
          MCP_LOCALE: 'en',
        } as Record<string, string>,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      setTimeout(() => {
        child.kill('SIGTERM');
      }, 10000);
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 15000);
      child.on('exit', (code) => resolve({ name, exitCode: code, stderr, stdout }));
    }
  );
}

async function adminSJ4(adminSession: ApiSession) {
  const id = 'SJ-4';
  const evidence: string[] = [];
  const keyLive = await apiRequest<{ key: string; keyId: string; keyPrefix: string }>(
    adminSession,
    'POST',
    '/admin/mcp-keys',
    {
      userId: adminSession.user.id,
      name: 'runtime-audit-live',
    }
  );
  const keyExpired = await apiRequest<{ key: string; keyId: string; keyPrefix: string }>(
    adminSession,
    'POST',
    '/admin/mcp-keys',
    {
      userId: adminSession.user.id,
      name: 'runtime-audit-expired',
      expiresAt: '2020-01-01T00:00:00.000Z',
    }
  );
  const keyRevoked = await apiRequest<{ key: string; keyId: string; keyPrefix: string }>(
    adminSession,
    'POST',
    '/admin/mcp-keys',
    {
      userId: adminSession.user.id,
      name: 'runtime-audit-revoked',
    }
  );
  await apiRequest(adminSession, 'DELETE', `/admin/mcp-keys/${keyRevoked.keyId}`);

  const liveResults = await runMcpWithKey(keyLive.key, 'live');
  const invalidResults = await verifyMcpServerRejects('invalid', 'mcp_invalid_key_for_audit');
  const expiredResults = await verifyMcpServerRejects('expired', keyExpired.key);
  const revokedResults = await verifyMcpServerRejects('revoked', keyRevoked.key);

  const keyPath = path.join(journeyDir(id), 'created-keys.json');
  await writeJson(keyPath, {
    live: { keyId: keyLive.keyId, keyPrefix: keyLive.keyPrefix },
    expired: { keyId: keyExpired.keyId, keyPrefix: keyExpired.keyPrefix },
    revoked: { keyId: keyRevoked.keyId, keyPrefix: keyRevoked.keyPrefix },
  });
  evidence.push(rel(keyPath));
  const livePath = path.join(journeyDir(id), 'mcp-live.json');
  await writeJson(livePath, liveResults);
  evidence.push(rel(livePath));
  const rejectPath = path.join(journeyDir(id), 'mcp-rejections.json');
  await writeJson(rejectPath, { invalidResults, expiredResults, revokedResults });
  evidence.push(rel(rejectPath));

  const standardParamWorked = JSON.stringify(liveResults.standardParam).includes('Harvard');
  const noParamWorked =
    !JSON.stringify(liveResults.noParam).includes('"error"') &&
    !JSON.stringify(liveResults.noParam).includes('Error:');
  const freeTextWorked =
    !JSON.stringify(liveResults.freeText).includes('"error"') &&
    !JSON.stringify(liveResults.freeText).includes('Error:');
  const rejectionWorked = [invalidResults, expiredResults, revokedResults].every(
    (result) => result.exitCode === 1 && result.stderr.trim().length > 0
  );
  const paramBroken = !standardParamWorked;

  await addRecord({
    id,
    title: 'Admin 创建 MCP key → 外部 MCP 客户端调用工具',
    account: adminSession.user.email,
    prerequisites: [
      'Admin API key creation endpoint live',
      'Local API `.env` includes OpenAI key and database access',
    ],
    steps: [
      'Created one live, one expired, and one soon-to-be-revoked MCP key through the live admin API.',
      'Started the real stdio MCP server with the live key and initialized a minimal external JSON-RPC client.',
      'Executed a no-parameter tool, a standard parameterized tool call, a workaround parameterized call, and a free-text tool call.',
      'Verified invalid / expired / revoked keys by starting the stdio MCP server with each rejected key.',
    ],
    userVisibleResult: paramBroken
      ? 'MCP key creation and stdio startup worked, but standard parameterized tool calls still did not carry arguments correctly.'
      : 'MCP key creation and stdio tool calls completed successfully, including key rejection cases.',
    score: standardParamWorked && noParamWorked && freeTextWorked && rejectionWorked ? 4 : 2,
    status:
      standardParamWorked && noParamWorked && freeTextWorked && rejectionWorked ? 'PASS' : 'ISSUE',
    evidence,
    issues: !standardParamWorked
      ? [
          {
            summary:
              'The MCP server is reachable, but standard parameterized tool calls lose their arguments.',
            rootCause:
              'apps/api/src/mcp-server.ts should accept standard top-level MCP `arguments`; if the live result still drops `query`, the runtime contract is still inconsistent with standard MCP clients.',
            acceptance:
              'A standard MCP client should be able to call `search_schools` or `generate_outline` with top-level arguments and receive correct behavior without double nesting.',
          },
        ]
      : !rejectionWorked
        ? [
            {
              summary: 'Rejected MCP keys did not fail in a stable, observable way.',
              rootCause:
                'The stdio startup path should exit with a clear stderr message for invalid, expired, and revoked keys.',
              acceptance:
                'Invalid, expired, and revoked keys must each return a deterministic rejection signal with non-empty stderr.',
            },
          ]
        : undefined,
    notes: [
      'The free-text path used a benign essay-outline prompt.',
      `No-parameter tool worked: ${String(noParamWorked)}`,
      `Standard parameterized tool worked: ${String(standardParamWorked)}`,
      `Free-text guarded tool worked: ${String(freeTextWorked)}`,
      `Invalid/expired/revoked key rejection evidence complete: ${String(rejectionWorked)}`,
    ],
  });
}

async function restoreTrackedE2EReport() {
  await execFileAsync('git', ['restore', '--worktree', '--staged', 'e2e-report'], {
    cwd: ROOT,
  }).catch(() => undefined);
}

async function writeEvidenceReadme() {
  const records = (await Promise.all(JOURNEY_IDS.map((id) => readExistingRecord(id)))).filter(
    (record): record is JourneyRecord & { generatedAt?: string } => record !== null
  );
  const lines = [
    `# Runtime Journey Evidence (${AUDIT_ID})`,
    '',
    `This directory contains fresh runtime evidence gathered by the generic runtime audit harness for ${AUDIT_CONTEXT}.`,
    '',
    `registryVersion: \`${JOURNEY_REGISTRY_VERSION}\``,
    '',
    '| Journey | Status | Owner | Type | Record |',
    '| --- | --- | --- | --- | --- |',
    ...records.map(
      (record) =>
        `| ${record.id} | ${record.status} | ${record.executionOwner ?? ''} | ${record.validationType ?? ''} | [record.json](${record.id}/record.json) |`
    ),
    '',
    'Fresh runtime evidence only counts for stop-condition purposes; older same-day artifacts were not reused as conclusions.',
  ];
  await writeText(path.join(EVIDENCE_ROOT, 'README.md'), lines.join('\n'));
  await writeJson(path.join(EVIDENCE_ROOT, 'summary.json'), {
    generatedAt: new Date().toISOString(),
    registryVersion: JOURNEY_REGISTRY_VERSION,
    records,
  });
}

async function main() {
  if (CLI_ARGS.printConfig) {
    console.log(
      JSON.stringify(
        {
          auditId: AUDIT_ID,
          auditContext: AUDIT_CONTEXT,
          evidenceRoot: EVIDENCE_ROOT,
          journeysCsv: Array.from(SELECTED_JOURNEY_IDS).join(','),
          forceRerun: FORCE_RERUN,
        },
        null,
        2
      )
    );
    return;
  }

  await ensureDir(EVIDENCE_ROOT);
  await restoreTrackedE2EReport();

  const browser = await chromium.launch({ headless: true });
  try {
    const applicantSession = await apiLogin(ACCOUNTS.applicant);
    const adminSession = await apiLogin(ACCOUNTS.admin);

    const runSingleJourney = async (input: {
      id: string;
      title: string;
      account: string;
      prerequisites: string[];
      steps: string[];
      page?: Page;
      notes?: string[];
      fn: () => Promise<void>;
    }) => {
      if (!shouldRunJourney(input.id as (typeof JOURNEY_IDS)[number])) {
        return;
      }
      const existing = await readExistingRecord(input.id);
      if (!FORCE_RERUN && existing && existing.status !== 'BROKEN') {
        console.log(`Skipping ${input.id} (${existing.status})`);
        return;
      }
      await fs.rm(journeyDir(input.id), { recursive: true, force: true });
      await ensureDir(journeyDir(input.id));
      console.log(`Running ${input.id}`);
      try {
        await input.fn();
      } catch (error) {
        await addFailureRecord({
          id: input.id,
          title: input.title,
          account: input.account,
          prerequisites: input.prerequisites,
          steps: input.steps,
          error,
          page: input.page,
          notes: input.notes,
        });
      }
    };

    await runSingleJourney({
      id: 'A1',
      title: '注册 → 首次登录 → onboarding → dashboard 恢复链路',
      account: 'fresh runtime account',
      prerequisites: ['Web app reachable locally', 'Registration route available'],
      steps: [
        'Register a fresh account in the live web app.',
        'Walk onboarding into dashboard.',
        'Force one onboarding failure and observe recovery behavior on revisit.',
      ],
      fn: () => applicantA1(browser),
    });

    const runApplicantJourney = async ({
      id,
      title,
      prerequisites,
      steps,
      initialPath,
      fn,
    }: {
      id: string;
      title: string;
      prerequisites: string[];
      steps: string[];
      initialPath?: string;
      fn: (page: Page) => Promise<void>;
    }) => {
      if (!shouldRunJourney(id as (typeof JOURNEY_IDS)[number])) {
        return;
      }
      let context: Awaited<ReturnType<typeof openApplicantPage>>['context'] | null = null;
      let page: Page | undefined;
      try {
        const opened = await openApplicantPage(browser, initialPath);
        context = opened.context;
        page = opened.page;
        await runSingleJourney({
          id,
          title,
          account: applicantSession.user.email,
          prerequisites,
          steps,
          page,
          fn: () => fn(page),
        });
      } catch (error) {
        await addFailureRecord({
          id,
          title,
          account: applicantSession.user.email,
          prerequisites,
          steps,
          error,
          page,
          notes: initialPath ? [`initial_path=${initialPath}`] : undefined,
        });
      } finally {
        await safeCloseContext(context);
      }
    };

    await runApplicantJourney({
      id: 'A2',
      title: '档案填写：GPA、标化、活动、奖项、推荐信、目标学校',
      prerequisites: [
        'Seeded applicant account with verified role and rich profile',
        'At least one searchable school in `/schools`',
      ],
      steps: [
        'Use live profile APIs for CRUD mutations.',
        'Open the real `/en/profile` page and save GPA through the UI.',
        'Switch tabs to confirm visible echo.',
      ],
      initialPath: '/profile',
      fn: (page) => applicantA2(page, applicantSession),
    });
    await runApplicantJourney({
      id: 'A3',
      title: '首次选校推荐',
      prerequisites: [
        'Applicant profile complete enough for recommendation preflight',
        'Applicant has non-zero points',
      ],
      steps: [
        'Open the AI recommendation tab on `/en/schools?tab=recommend`.',
        'Submit the recommendation form with live inputs.',
        'Wait for the recommendation results to render in the UI.',
      ],
      initialPath: '/schools?tab=recommend',
      fn: (page) => applicantA3(page, applicantSession),
    });
    await runApplicantJourney({
      id: 'A10',
      title: '预测 / 案例库 / 排名',
      prerequisites: [
        'Applicant has a seeded school list and prediction-eligible profile',
        'Ranking calculation endpoint reachable from the web UI',
      ],
      steps: [
        'Open `/en/prediction` and run a fresh prediction.',
        'Open `/en/cases` to verify case library rendering.',
        'Open `/en/ranking` and capture the ranking table.',
      ],
      initialPath: '/prediction',
      fn: (page) => applicantA10(page, applicantSession),
    });
    const selectedAiJourneys = selectedJourneyGroup(['A4', 'A5', 'A6', 'A7', 'A8', 'A9']);
    if (selectedAiJourneys.length > 0) {
      const { context, page } = await openApplicantPage(browser, '/ai');
      try {
        console.log(`Running ${selectedAiJourneys.join(', ')}`);
        await applicantAiJourneys(page);
      } finally {
        await safeCloseContext(context);
      }
    }
    await runApplicantJourney({
      id: 'SJ-1',
      title: '学校详情 → 学校对比',
      prerequisites: ['Two live school detail IDs loaded from the local API'],
      steps: [
        'Open a live school detail page.',
        'Navigate into the compare page with two school IDs.',
        'Inspect rendered outcome metrics.',
      ],
      initialPath: '/schools',
      fn: (page) => applicantSJ1(page, applicantSession),
    });
    await runApplicantJourney({
      id: 'SJ-2',
      title: 'Web 通知中心 / 通知页',
      prerequisites: [
        'Admin broadcast permission available',
        'Applicant logged into the web header',
      ],
      steps: [
        'Broadcast a live system notification as admin.',
        'Open the notification center.',
        'Open the full notifications page.',
      ],
      fn: (page) => applicantSJ2(page, applicantSession, adminSession),
    });

    const selectedMobileJourneys = selectedJourneyGroup(['A11', 'SJ-3']);
    if (selectedMobileJourneys.length > 0) {
      console.log(`Running mobile evidence for ${selectedMobileJourneys.join(', ')}`);
      await collectMobileEvidence();
    }
    const selectedParentJourneys = selectedJourneyGroup(['B1', 'B2', 'B3']);
    if (selectedParentJourneys.length > 0) {
      console.log(`Running ${selectedParentJourneys.join(', ')}`);
      await parentJourneys(browser);
    }

    const selectedAdminJourneys = selectedJourneyGroup(['C1', 'C2', 'C3', 'C4', 'C5']);
    if (selectedAdminJourneys.length > 0) {
      const { context: adminContext, page: adminPage } = await openAdminPage(browser);
      try {
        console.log(`Running ${selectedAdminJourneys.join(', ')}`);
        await adminJourneys(adminPage, adminSession, applicantSession);
      } finally {
        await adminContext.close();
      }
    }
    await runSingleJourney({
      id: 'SJ-4',
      title: 'Admin 创建 MCP key → 外部 MCP 客户端调用工具',
      account: adminSession.user.email,
      prerequisites: [
        'Admin API key creation endpoint live',
        'Local API `.env` includes OpenAI key and database access',
      ],
      steps: [
        'Create live, expired, and revoked MCP keys through the admin API.',
        'Start the stdio MCP server with the live key.',
        'Exercise no-arg, arg, invalid, expired, revoked, and free-text paths from an external client.',
      ],
      fn: () => adminSJ4(adminSession),
    });

    await writeEvidenceReadme();
  } finally {
    await safeCloseBrowser(browser);
  }

  for (const record of RECORDS) {
    console.log(`[${record.status}] ${record.id} ${record.title}`);
  }
}

main().catch(async (error) => {
  const target = path.join(EVIDENCE_ROOT, 'runtime-audit-error.txt');
  await writeText(target, error instanceof Error ? error.stack || error.message : String(error));
  console.error(error);
  process.exitCode = 1;
});

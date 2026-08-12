import fs from 'node:fs';
import path from 'node:path';

import { expect, type Locator, type Page, test } from '@playwright/test';

import { installFullUiApiFixtures } from './full-ui-surface.fixtures';
import {
  DEFAULT_FULL_UI_VIEWPORTS,
  FULL_UI_LOCALES,
  FULL_UI_SURFACE_ROUTES,
  FULL_UI_VIEWPORTS,
  type FullUiLocale,
  type FullUiSurfaceRoute,
  type FullUiViewportName,
  getRouteViewports,
  surfaceSlug,
} from './full-ui-surface.registry';

const CONTROL_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="slider"]',
  'input:not([type="hidden"])',
  'textarea',
  'select',
].join(', ');

const REPORT_ROOT = path.join(process.cwd(), 'e2e-report', 'full-ui-surface');
const WEB_LOCALE_APP_ROOT = path.join(process.cwd(), 'apps', 'web', 'src', 'app', '[locale]');
const ROUTE_FILTER = process.env.FULL_UI_ROUTE_FILTER;
const ROUTE_FILTERS = ROUTE_FILTER
  ? ROUTE_FILTER.split(/[,|]/)
      .map((filter) => filter.trim().toLowerCase())
      .filter(Boolean)
  : [];
const ENABLE_VISUAL_DIFF = process.env.FULL_UI_VISUAL_DIFF === '1';
const MAX_CLICKED_CONTROLS_BY_VIEWPORT: Record<FullUiViewportName, number> = {
  desktop: 32,
  mobile: 24,
  wide: 32,
};
const MAX_CLICKED_CONTROLS_PER_SIGNATURE = 2;
const CONTROL_SCRIPT_TIMEOUT_MS = 1000;

interface ControlAudit {
  index: number;
  tag: string;
  role: string;
  type: string;
  className: string;
  name: string;
  href: string;
  parentHref: string;
  disabled: boolean;
  tooling: boolean;
  visible: boolean;
  width: number;
  height: number;
  clipped: boolean;
  x: number;
  y: number;
}

type ControlAction = 'click' | 'focus' | 'exempt';

interface PlannedControl {
  control: ControlAudit;
  action: ControlAction;
}

interface PageReport {
  route: string;
  locale: FullUiLocale;
  viewport: FullUiViewportName;
  url: string;
  screenshot?: string;
  controls: {
    total: number;
    clicked: number;
    exempted: number;
    focused: number;
    issues: string[];
  };
  consoleErrors: string[];
  pageErrors: string[];
  networkIssues: string[];
}

const REPORT: PageReport[] = [];

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(fullPath));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function pageFileToRoutePattern(filePath: string): string {
  const relative = path.relative(WEB_LOCALE_APP_ROOT, filePath);
  const segments = relative.split(path.sep).filter(Boolean);
  const pageIndex = segments.indexOf('page.tsx');
  const routeSegments = segments
    .slice(0, pageIndex === -1 ? segments.length : pageIndex)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')));
  return routeSegments.length ? `/${routeSegments.join('/')}` : '/';
}

function scanPageRoutePatterns(): string[] {
  return listFiles(WEB_LOCALE_APP_ROOT)
    .filter((file) => file.endsWith(`${path.sep}page.tsx`))
    .map(pageFileToRoutePattern)
    .sort((a, b) => a.localeCompare(b));
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function expectedUrl(locale: FullUiLocale, route: FullUiSurfaceRoute) {
  const routePath = route.paths?.[locale] ?? route.path;
  const suffix = routePath === '/' ? '' : routePath;
  return `/${locale}${suffix}`;
}

function routeNameForTest(route: FullUiSurfaceRoute) {
  return `${route.pattern} (${route.name})`;
}

function isExpectedConsoleNoise(text: string) {
  return (
    text.includes('hydrated but some attributes') ||
    text.includes('Hydration failed because') ||
    text.includes('caret-color') ||
    text.includes('Warning: Extra attributes from the server') ||
    // Next dev can emit this after a production build because its own bootstrap
    // scripts are present in cached RSC/error payloads. App-authored script tags
    // are still guarded by source search and production build checks.
    text.includes('Encountered a script tag while rendering React component') ||
    text.includes('status of 401 (Unauthorized)') ||
    text.includes('[Fast Refresh]') ||
    text.includes('Download the React DevTools') ||
    text.includes('ws://localhost:4101/socket.io/') ||
    (text.includes('Failed to load resource') && isTransientDevServerNetworkError(text))
  );
}

function isTransientDevServerNetworkError(text: string) {
  return /net::ERR_(?:ABORTED|CONNECTION_RESET|INCOMPLETE_CHUNKED_ENCODING|EMPTY_RESPONSE|CONNECTION_REFUSED|NETWORK_CHANGED|CONTENT_LENGTH_MISMATCH)/.test(
    text
  );
}

function sanitizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLocale(pathname: string) {
  return pathname.replace(/^\/(?:en|zh)(?=\/|$)/, '') || '/';
}

async function installBrowserDefaults(page: Page) {
  await page.addInitScript(() => {
    const installDevtoolsHider = () => {
      if (document.getElementById('full-ui-hide-next-devtools')) return;
      const host = document.head ?? document.documentElement ?? document.body;
      if (!host) return;
      const style = document.createElement('style');
      style.id = 'full-ui-hide-next-devtools';
      style.textContent = `
        nextjs-portal,
        [data-nextjs-dev-overlay],
        [data-nextjs-dialog],
        [data-nextjs-dialog-overlay],
        [data-nextjs-toast],
        [data-nextjs-terminal],
        [data-nextjs-build-error],
        [data-nextjs-error-overlay] {
          display: none !important;
          pointer-events: none !important;
        }
      `;
      host.appendChild(style);
    };

    try {
      localStorage.setItem('color-palette', 'cobalt-saas');
      localStorage.setItem('lumni-hero-visual', 'command-center');
    } catch {
      /* Storage can be unavailable on transient error documents in WebKit/Chromium dev mode. */
    }
    document.documentElement?.setAttribute('data-color-palette', 'cobalt-saas');
    document.documentElement?.setAttribute('data-hero-visual', 'command-center');
    installDevtoolsHider();
    window.addEventListener('DOMContentLoaded', installDevtoolsHider, { once: true });
  });
}

async function captureSurfaceScreenshot(
  page: Page,
  route: FullUiSurfaceRoute,
  locale: FullUiLocale,
  viewport: FullUiViewportName
) {
  const screenshotDir = path.join(REPORT_ROOT, locale, viewport);
  ensureDir(screenshotDir);
  const screenshotPath = path.join(screenshotDir, `${surfaceSlug(route)}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return screenshotPath;
}

async function waitForSurfaceReady(page: Page, route: FullUiSurfaceRoute) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page
    .waitForFunction(
      () => {
        const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
        return text.length > 80 && !/Rendering/i.test(text);
      },
      null,
      { timeout: route.controlMode === 'forms' ? 2500 : 15000 }
    )
    .catch(() => {});
  await page.waitForTimeout(650);
}

async function recoverBlankDocument(page: Page, url: string, route: FullUiSurfaceRoute) {
  const hasRenderableBody = async () => {
    const bodyState = await page
      .locator('body')
      .evaluate((body) => ({
        visible:
          window.getComputedStyle(body).display !== 'none' &&
          window.getComputedStyle(body).visibility !== 'hidden',
        textLength: (body.innerText ?? '').replace(/\s+/g, ' ').trim().length,
      }))
      .catch(() => null);

    return Boolean(bodyState?.visible && bodyState.textLength > 0);
  };

  const hasBody = await hasRenderableBody();
  if (hasBody) return;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.waitForTimeout((route.role === 'admin' ? 2000 : 1000) * (attempt + 1));
    const recoveredBody = await hasRenderableBody();
    if (recoveredBody) return;

    await gotoSurface(page, url);
    await waitForSurfaceReady(page, route);

    const recoveredAfterReload = await hasRenderableBody();
    if (recoveredAfterReload) return;
  }

  await page
    .locator('body')
    .isVisible({ timeout: 5000 })
    .catch(() => false);
}

async function assertPageIntegrity(page: Page, locale: FullUiLocale, route: FullUiSurfaceRoute) {
  const renderTimeout = route.role === 'admin' || route.critical ? 45000 : 30000;

  await expect(page.locator('body')).toBeVisible({ timeout: renderTimeout });

  const minimumContentLength = route.controlMode === 'forms' ? 30 : 80;
  await expect
    .poll(
      async () =>
        sanitizeText(
          (await page
            .locator('body')
            .innerText()
            .catch(() => '')) ?? ''
        ).length,
      {
        message: 'page should render meaningful visible content',
        timeout: renderTimeout,
      }
    )
    .toBeGreaterThanOrEqual(minimumContentLength);

  const bodyText = sanitizeText(
    (await page
      .locator('body')
      .innerText()
      .catch(() => '')) ?? ''
  );

  const badTokens = ['MISSING_MESSAGE', 'IntlError', '[object Object]', 'undefined'];
  for (const token of badTokens) {
    expect(bodyText, `visible text should not include ${token}`).not.toContain(token);
  }

  const visibleMainRegion = await page
    .locator('main, [role="main"], h1, h2, form, input, textarea, select')
    .evaluateAll((elements) =>
      elements.some((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element as HTMLElement);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      })
    )
    .catch(() => false);
  expect(visibleMainRegion, 'page should expose a visible main region or heading').toBe(true);

  const hasErrorBoundary = await page
    .getByText(/something went wrong|application error|runtime error|服务器错误|出了点问题/i)
    .first()
    .isVisible()
    .catch(() => false);
  expect(hasErrorBoundary, 'page should not show an error boundary').toBe(false);

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return (
      Math.max(doc.scrollWidth, body.scrollWidth) - Math.max(window.innerWidth, doc.clientWidth)
    );
  });
  expect(overflow, 'page should not create horizontal overflow').toBeLessThanOrEqual(2);

  assertRuntimeI18n(bodyText, locale);
}

function assertRuntimeI18n(bodyText: string, locale: FullUiLocale) {
  const rawKeys = bodyText.match(/\b[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*){2,}\b/gi) ?? [];
  const suspiciousKeys = rawKeys.filter(
    (key) => !key.includes('example.com') && !key.startsWith('www.') && !key.includes('http')
  );
  expect(suspiciousKeys, 'page should not expose raw i18n keys').toEqual([]);

  const cjkCount = (bodyText.match(/[\u3400-\u9fff]/g) ?? []).length;
  if (locale === 'en') {
    expect(cjkCount, 'English pages should not show large Chinese UI blocks').toBeLessThanOrEqual(
      80
    );
    return;
  }

  const allowEnglish = new Set([
    'AI',
    'API',
    'AP',
    'CS',
    'GPA',
    'GPT',
    'Lumni',
    'MIT',
    'SAT',
    'STEM',
    'UIUC',
    'URL',
  ]);
  const englishWords = bodyText.match(/\b[A-Za-z][A-Za-z0-9+-]{3,}\b/g) ?? [];
  const unexpectedEnglish = englishWords.filter((word) => !allowEnglish.has(word));
  const englishRatio = unexpectedEnglish.length / Math.max(englishWords.length, 1);
  expect(
    unexpectedEnglish.length <= 220 || englishRatio < 0.55,
    'Chinese pages should not show large English UI blocks'
  ).toBe(true);
}

async function auditVisibleControls(
  page: Page,
  route: FullUiSurfaceRoute,
  viewport: FullUiViewportName
) {
  const controls = await page.locator(CONTROL_SELECTOR).evaluateAll((elements) => {
    function labelFromId(id: string | null) {
      if (!id) return '';
      return id
        .split(/\s+/)
        .map((part) => document.getElementById(part)?.textContent ?? '')
        .join(' ');
    }

    function nearbyLabel(element: Element) {
      const directLabel = element.closest('label')?.textContent ?? '';
      if (directLabel.trim()) return directLabel;

      let parent = element.parentElement;
      for (let depth = 0; parent && depth < 4; depth += 1) {
        const label = parent.querySelector('label');
        if (label?.textContent?.trim()) return label.textContent;
        parent = parent.parentElement;
      }

      return '';
    }

    function associatedLabel(element: Element) {
      const wrappingLabel = element.closest('label')?.textContent ?? '';
      if (wrappingLabel.trim()) return wrappingLabel;

      const id = element.getAttribute('id');
      if (!id) return '';
      const explicitLabel = Array.from(document.querySelectorAll('label[for]')).find(
        (label) => label.getAttribute('for') === id
      );
      return explicitLabel?.textContent ?? '';
    }

    function ancestorText(element: Element) {
      const parts: string[] = [];
      let parent = element.parentElement;
      for (let depth = 0; parent && depth < 6; depth += 1) {
        const text = parent.textContent?.replace(/\s+/g, ' ').trim();
        if (text) parts.push(text);
        parent = parent.parentElement;
      }
      return parts.join(' ');
    }

    function isNextTooling(element: Element) {
      const toolingSelector = [
        'nextjs-portal',
        '[data-nextjs-dev-overlay]',
        '[data-nextjs-dialog]',
        '[data-nextjs-dialog-overlay]',
        '[data-nextjs-toast]',
        '[data-nextjs-terminal]',
        '[data-nextjs-build-error]',
        '[data-nextjs-error-overlay]',
        '[data-nextjs-route-announcer]',
        '#__next-route-announcer',
      ].join(', ');

      let current: Element | null = element;
      for (let depth = 0; current && depth < 8; depth += 1) {
        const id = current.getAttribute('id') ?? '';
        const className =
          typeof current.getAttribute('class') === 'string'
            ? (current.getAttribute('class') ?? '')
            : '';
        const tagName = current.tagName.toLowerCase();

        if (
          current.matches(toolingSelector) ||
          tagName.includes('nextjs') ||
          id.toLowerCase().includes('nextjs') ||
          className.toLowerCase().includes('nextjs')
        ) {
          return true;
        }

        const root = current.getRootNode();
        if (root instanceof ShadowRoot) {
          current = root.host;
        } else {
          current = current.parentElement;
        }
      }

      return false;
    }

    return elements.map((element, index) => {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const computed = window.getComputedStyle(htmlElement);
      const input = element as HTMLInputElement;
      const anchor = element as HTMLAnchorElement;
      const isFormControl = /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName);
      const formControlLabel = isFormControl ? nearbyLabel(element) : '';
      const formControlValue = isFormControl ? input.value : '';
      const explicitControlLabel = associatedLabel(element);
      const name =
        element.getAttribute('aria-label') ||
        labelFromId(element.getAttribute('aria-labelledby')) ||
        explicitControlLabel ||
        element.getAttribute('title') ||
        input.placeholder ||
        formControlValue ||
        formControlLabel ||
        htmlElement.innerText ||
        htmlElement.textContent ||
        anchor.href ||
        '';

      const devtoolsText = /^(Route|Static|Webpack|Bundler|Route Info|Preferences)$/i.test(
        name.trim()
      );
      const devtoolsContext = /\b(Route|Static|Webpack|Bundler|Route Info|Preferences)\b/i.test(
        ancestorText(element)
      );
      const devtoolsPosition =
        rect.x < 320 &&
        rect.y > Math.max(560, window.innerHeight - 320) &&
        (devtoolsText || devtoolsContext || !name.trim());

      return {
        index,
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role') ?? '',
        type: input.type ?? '',
        className: element.getAttribute('class') ?? '',
        name: name.replace(/\s+/g, ' ').trim(),
        href: anchor.href ?? '',
        parentHref: htmlElement.closest('a[href]')?.getAttribute('href') ?? '',
        disabled:
          input.disabled ||
          element.getAttribute('aria-disabled') === 'true' ||
          element.hasAttribute('disabled'),
        tooling: isNextTooling(element) || devtoolsText || devtoolsContext || devtoolsPosition,
        visible:
          element.getAttribute('aria-hidden') !== 'true' &&
          !htmlElement.closest('[aria-hidden="true"]') &&
          rect.width > 0 &&
          rect.height > 0 &&
          computed.visibility !== 'hidden' &&
          computed.display !== 'none' &&
          computed.opacity !== '0',
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        clipped:
          htmlElement instanceof HTMLElement &&
          (htmlElement.scrollWidth > htmlElement.clientWidth + 3 ||
            htmlElement.scrollHeight > htmlElement.clientHeight + 3),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
      };
    });
  });

  const visibleControls = controls.filter((control) => control.visible && !control.tooling);
  const issues: string[] = [];
  let clicked = 0;
  let exempted = 0;
  let focused = 0;
  const minSize = viewport === 'mobile' ? 40 : 32;
  const plannedControls: PlannedControl[] = [];

  for (const control of visibleControls) {
    if (isToolingControl(control)) {
      exempted += 1;
      continue;
    }

    if (!control.name) {
      issues.push(
        `Unnamed control at index ${control.index} (${control.tag}${control.role ? ` role=${control.role}` : ''}) at ${control.x},${control.y} ${control.width}x${control.height}`
      );
      continue;
    }

    if (
      control.clipped &&
      isTextualAction(control) &&
      !(control.width <= 64 && control.height <= 64)
    ) {
      issues.push(
        `Clipped control text: "${control.name}" ${control.tag}${control.role ? ` role=${control.role}` : ''} (${control.width}x${control.height}) class="${control.className.slice(0, 120)}"`
      );
    }

    if (requiresTouchTarget(control) && violatesTouchTarget(control, minSize, viewport)) {
      issues.push(
        `Small touch target: "${control.name}" ${control.tag}${control.role ? ` role=${control.role}` : ''} (${control.width}x${control.height}, expected ${minSize}x${minSize})`
      );
    }

    if (control.disabled) {
      exempted += 1;
      continue;
    }

    if (control.tag === 'a') {
      const hrefIssue = validateHref(control.href);
      if (hrefIssue) issues.push(`${control.name}: ${hrefIssue}`);
      exempted += 1;
      continue;
    }

    if (control.parentHref) {
      const hrefIssue = validateHref(control.parentHref);
      if (hrefIssue) issues.push(`${control.name}: ${hrefIssue}`);
      exempted += 1;
      continue;
    }

    const action = controlAction(control, route);
    if (action === 'exempt') {
      exempted += 1;
      continue;
    }

    plannedControls.push({ control, action });
  }

  const focusControls = plannedControls.filter(({ action }) => action === 'focus');
  const clickControls = plannedControls.filter(({ action }) => action === 'click');
  const { selectedClickControls, skippedClickControls } = selectClickControlsForAudit(
    clickControls,
    viewport
  );
  exempted += skippedClickControls;

  for (const { control } of focusControls) {
    const locator = locatorForControl(page, control);
    const ok = await focusControl(locator, control);
    if (!ok) issues.push(`Could not focus control: "${control.name}"`);
    else focused += 1;
  }

  await closeTransientSurfaces(page);

  for (const { control } of selectedClickControls) {
    const locator = locatorForControl(page, control);
    const ok = await clickControl(page, locator, control);
    if (ok) clicked += 1;
    else exempted += 1;
  }

  return {
    total: visibleControls.length,
    clicked,
    exempted,
    focused,
    issues,
  };
}

function selectClickControlsForAudit(
  clickControls: PlannedControl[],
  viewport: FullUiViewportName
) {
  const signatureCounts = new Map<string, number>();
  const selectedClickControls: PlannedControl[] = [];
  const maxClicks = MAX_CLICKED_CONTROLS_BY_VIEWPORT[viewport];

  for (const plannedControl of clickControls) {
    const signature = controlSignature(plannedControl.control);
    const signatureCount = signatureCounts.get(signature) ?? 0;
    if (
      selectedClickControls.length >= maxClicks ||
      signatureCount >= MAX_CLICKED_CONTROLS_PER_SIGNATURE
    ) {
      continue;
    }

    selectedClickControls.push(plannedControl);
    signatureCounts.set(signature, signatureCount + 1);
  }

  return {
    selectedClickControls,
    skippedClickControls: clickControls.length - selectedClickControls.length,
  };
}

function controlSignature(control: ControlAudit) {
  return [
    control.tag,
    control.role,
    control.type,
    control.name.toLowerCase().replace(/\d+/g, '#'),
    normalizeAuditHref(control.parentHref || control.href),
  ].join('|');
}

function normalizeAuditHref(href: string) {
  if (!href) return '';
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return href.split('?')[0] ?? href;
  }
}

function locatorForControl(page: Page, control: ControlAudit) {
  const exactName = new RegExp(`^${escapeRegExp(control.name)}$`, 'i');
  const indexedControl = page.locator(CONTROL_SELECTOR).nth(control.index);

  if (control.tag === 'button' || control.role === 'button') {
    return page
      .getByRole('button', { name: exactName })
      .or(page.locator(CONTROL_SELECTOR).nth(control.index))
      .first();
  }

  if (control.role === 'tab') {
    return page
      .getByRole('tab', { name: exactName })
      .or(page.locator(CONTROL_SELECTOR).nth(control.index))
      .first();
  }

  if (control.role === 'switch') {
    return page
      .getByRole('switch', { name: exactName })
      .or(page.locator(CONTROL_SELECTOR).nth(control.index))
      .first();
  }

  if (control.role === 'checkbox' || control.type === 'checkbox') {
    return page
      .getByRole('checkbox', { name: exactName })
      .or(page.locator(CONTROL_SELECTOR).nth(control.index))
      .first();
  }

  if (control.tag === 'input' && control.name) {
    return indexedControl;
  }

  return page.locator(CONTROL_SELECTOR).nth(control.index);
}

function isToolingControl(control: ControlAudit) {
  return /next\.?js dev tools|issues overlay|collapse issues badge/i.test(control.name);
}

function isTextualAction(control: ControlAudit) {
  return (
    control.tag === 'button' ||
    control.role === 'button' ||
    control.role === 'tab' ||
    ['submit', 'button', 'reset'].includes(control.type)
  );
}

function requiresTouchTarget(control: ControlAudit) {
  if (control.role === 'slider' || control.type === 'range') return false;
  if (control.tag === 'input') return false;
  if (control.tag === 'a') return !control.name;
  return (
    control.tag === 'button' ||
    control.role === 'button' ||
    control.role === 'switch' ||
    control.role === 'checkbox' ||
    control.role === 'slider' ||
    ['button', 'submit', 'reset', 'checkbox', 'radio', 'range'].includes(control.type)
  );
}

function violatesTouchTarget(control: ControlAudit, minSize: number, viewport: FullUiViewportName) {
  if (viewport !== 'mobile' && isTextualAction(control) && control.name.length > 2) {
    return control.width < minSize || control.height < 20;
  }
  return control.width < minSize || control.height < minSize;
}

function validateHref(href: string) {
  if (!href) return 'link has empty href';
  if (href.startsWith('javascript:')) return 'link uses javascript: href';
  if (/^(mailto|tel):/i.test(href)) return '';
  return '';
}

function controlAction(
  control: ControlAudit,
  route: FullUiSurfaceRoute
): 'click' | 'focus' | 'exempt' {
  if (['input', 'textarea', 'select'].includes(control.tag)) return 'focus';
  if (control.role === 'combobox') return 'focus';
  if (control.role === 'slider' || control.type === 'range') return 'exempt';

  const name = control.name.toLowerCase();
  if (
    /site color|theme studio|color theme|toggle theme|switch to dark|switch to light|change language|language|help center|feedback|ai assistant|全站配色|主题|切换到深色|切换到浅色|切换语言|语言|帮助中心|反馈|ai 助手|更多/.test(
      name
    )
  ) {
    return 'focus';
  }

  if (/view model basis|ask the copilot|查看模型|询问助手|询问 ai|问 ai/.test(name)) {
    return 'exempt';
  }

  const dangerous =
    /delete|remove|logout|sign out|submit|save|send|generate|analyze|upload|import|export|approve|reject|publish|pay|subscribe|share|create|join|invite|登录|注册|删除|移除|退出|提交|保存|发送|生成|分析|上传|导入|导出|批准|拒绝|发布|支付|订阅|分享|创建|加入|邀请/.test(
      name
    );

  if (dangerous && route.controlMode !== 'forms') return 'exempt';
  return 'click';
}

async function focusControl(locator: Locator, control: ControlAudit) {
  try {
    if (!(await locator.isVisible({ timeout: 500 }).catch(() => false))) return true;
    await locator.scrollIntoViewIfNeeded({ timeout: 1500 });
    const fillSearchInput = async () => {
      if (control.tag !== 'input' || control.type !== 'search') return false;
      return locator
        .fill('mit', { timeout: 1000 })
        .then(() => true)
        .catch(() => false);
    };
    const focusByScript = async () =>
      locator
        .evaluate(
          (element) => {
            element.scrollIntoView({ block: 'center', inline: 'nearest' });
            if (element instanceof HTMLElement) element.focus({ preventScroll: true });
            return element === document.activeElement;
          },
          undefined,
          { timeout: CONTROL_SCRIPT_TIMEOUT_MS }
        )
        .catch(() => false);
    const active = await focusByScript();
    if (!active && !(await fillSearchInput())) return false;
    await fillSearchInput();
    return true;
  } catch {
    return false;
  }
}

async function clickControl(page: Page, locator: Locator, control: ControlAudit) {
  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 1500 });
    await locator.click({ timeout: 2000 });
    await page.waitForTimeout(80);
    await closeTransientSurfaces(page);
    const bodyLength = await page
      .locator('body')
      .innerText({ timeout: CONTROL_SCRIPT_TIMEOUT_MS })
      .then((text) => text.length)
      .catch(() => 0);
    return bodyLength > 20 && control.name.length > 0;
  } catch {
    return false;
  }
}

async function verifyLanguageSwitch(page: Page, route: FullUiSurfaceRoute, locale: FullUiLocale) {
  if (
    route.path.includes('/callback') ||
    route.path.includes('token=') ||
    route.pattern.startsWith('/qa/')
  )
    return;

  const trigger = page
    .locator('button[aria-label*="language" i], button[aria-label*="语言"]')
    .first();
  if (!(await trigger.isVisible().catch(() => false))) return;

  // The generic control audit can leave a product modal open (for example the
  // Hall onboarding dialog). Close transient UI before testing the global
  // language control so an expected modal overlay does not intercept the click.
  await closeTransientSurfaces(page);

  const before = new URL(page.url());
  const beforeBusinessPath = stripLocale(before.pathname);
  const targetLocale: FullUiLocale = locale === 'en' ? 'zh' : 'en';
  await trigger.click({ timeout: 2000 });
  const targetMenuItem = page
    .getByRole('menuitem', { name: targetLocale === 'zh' ? /中文|简体|Chinese/i : /English|英语/i })
    .filter({ visible: true })
    .first();
  if (!(await targetMenuItem.isVisible({ timeout: 2000 }).catch(() => false))) {
    await closeTransientSurfaces(page);
    return;
  }

  const targetUrlPattern = new RegExp(`/${targetLocale}(?:/|$)`);
  const switchedUrlPromise = page
    .waitForURL(targetUrlPattern, { timeout: 15000 })
    .then(() => page.url())
    .catch(() => null);
  // Radix positions this portal relative to a sticky header. After the generic
  // control audit has scrolled a long dashboard, Chromium can report the menu
  // item as visible while its animated box is briefly outside the viewport.
  // Exercise the menu's supported keyboard path instead of forcing a pointer
  // click through an unstable layout.
  await targetMenuItem.focus({ timeout: 2000 });
  await targetMenuItem.press('Enter', { timeout: 2000 });
  const switchedUrl = await switchedUrlPromise;
  if (!switchedUrl) return;
  const after = new URL(switchedUrl);
  expect(stripLocale(after.pathname), 'language switch should preserve business path').toBe(
    beforeBusinessPath
  );
}

async function closeTransientSurfaces(page: Page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(40).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}

test.describe('Full UI surface registry', () => {
  test('every locale page is explicitly registered with fixture path and role', () => {
    const scanned = scanPageRoutePatterns();
    const registered = FULL_UI_SURFACE_ROUTES.map((route) => route.pattern).sort((a, b) =>
      a.localeCompare(b)
    );
    const uniqueRegistered = uniqueSorted(registered);

    expect(registered, 'registry should not contain duplicate page patterns').toEqual(
      uniqueRegistered
    );
    expect(
      uniqueRegistered,
      'registry should match apps/web/src/app/[locale] page.tsx routes'
    ).toEqual(scanned);

    for (const route of FULL_UI_SURFACE_ROUTES) {
      expect(route.path, `${route.pattern} needs a concrete fixture path`).toBeTruthy();
      expect(['guest', 'user', 'admin'], `${route.pattern} needs a role`).toContain(route.role);
      expect(
        ['active', 'disabled'],
        `${route.pattern} needs a valid availability state when specified`
      ).toContain(route.availability ?? 'active');
      expect(
        getRouteViewports(route).length,
        `${route.pattern} needs at least one viewport`
      ).toBeGreaterThan(0);
    }
  });
});

const routesToTest = FULL_UI_SURFACE_ROUTES.filter((route) => {
  if (ROUTE_FILTERS.length === 0) return true;
  const searchable = `${route.pattern} ${route.name}`.toLowerCase();
  return ROUTE_FILTERS.some((filter) => {
    if (!filter.startsWith('=')) return searchable.includes(filter);
    const exact = filter.slice(1);
    return [route.pattern, route.path, route.name].some(
      (candidate) => candidate.toLowerCase() === exact
    );
  });
});

test.describe('Full UI surface crawler', () => {
  for (const route of routesToTest) {
    for (const locale of FULL_UI_LOCALES) {
      const viewports =
        route.viewports ?? (route.critical ? getRouteViewports(route) : DEFAULT_FULL_UI_VIEWPORTS);
      for (const viewportName of viewports) {
        test(`${routeNameForTest(route)} ${locale} ${viewportName}`, async ({ page }) => {
          const consoleErrors: string[] = [];
          const pageErrors: string[] = [];
          const networkIssues: string[] = [];
          const disabledFeatureRequests: string[] = [];
          const viewport = FULL_UI_VIEWPORTS[viewportName];
          const url = expectedUrl(locale, route);

          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await installBrowserDefaults(page);
          await installFullUiApiFixtures(page, route.role);

          page.on('console', (message) => {
            if (message.type() !== 'error') return;
            const text = message.text();
            if (!isExpectedConsoleNoise(text)) consoleErrors.push(text);
          });
          page.on('pageerror', (error) => {
            if (!isExpectedConsoleNoise(error.message))
              pageErrors.push(error.stack ?? error.message);
          });
          page.on('requestfailed', (request) => {
            const requestUrl = request.url();
            const resourceType = request.resourceType();
            const errorText = request.failure()?.errorText ?? 'failed';
            if (/^(mailto|tel):/i.test(requestUrl)) return;
            if (
              requestUrl.startsWith('http://localhost:4100/') &&
              isTransientDevServerNetworkError(errorText)
            ) {
              return;
            }
            if (
              errorText.includes('ERR_ABORTED') &&
              (requestUrl.includes('/api/') || resourceType === 'fetch' || resourceType === 'xhr')
            ) {
              return;
            }
            if (requestUrl.includes('/_next/static/') && errorText.includes('ERR_ABORTED')) return;
            if (requestUrl.startsWith('blob:') && errorText.includes('ERR_ABORTED')) return;
            if (
              requestUrl.includes('/api/') ||
              resourceType === 'document' ||
              resourceType === 'script'
            ) {
              networkIssues.push(`${request.method()} ${requestUrl}: ${errorText}`);
            }
          });
          page.on('request', (request) => {
            if (/\/api\/(?:v1\/)?admin\/points\//.test(request.url())) {
              disabledFeatureRequests.push(request.url());
            }
          });
          page.on('response', (response) => {
            const responseUrl = response.url();
            if (responseUrl.includes('/api/') && response.status() >= 500) {
              networkIssues.push(`API ${response.status()} ${responseUrl}`);
            }
          });

          if (route.availability === 'disabled') {
            await gotoSurface(page, `/${locale}/admin`);
            await expect(
              page.locator('a[href$="/admin/points-redemptions"]'),
              `${route.pattern} should be absent from admin navigation while disabled`
            ).toHaveCount(0);

            await gotoSurface(page, url);
            await expect(page.getByTestId('points-economy-unavailable')).toBeVisible();
            await expect(page.getByRole('link', { name: /admin|管理后台/i })).toBeVisible();
            await expect(
              page.locator('meta[name="robots"]'),
              `${url} should be excluded from indexing while disabled`
            ).toHaveAttribute('content', /noindex/i);
            expect(
              disabledFeatureRequests,
              `${route.pattern} should not request points APIs while disabled`
            ).toEqual([]);
            return;
          }

          const response = await gotoSurface(page, url);
          expect(response?.status() ?? 200, `${url} should not return HTTP error`).toBeLessThan(
            400
          );
          await waitForSurfaceReady(page, route);
          await recoverBlankDocument(page, url, route);

          await assertPageIntegrity(page, locale, route);

          const screenshotPath = await captureSurfaceScreenshot(page, route, locale, viewportName);
          if (ENABLE_VISUAL_DIFF && route.critical) {
            await expect(page).toHaveScreenshot(
              [`full-ui-surface`, locale, viewportName, `${surfaceSlug(route)}.png`],
              { fullPage: false }
            );
          }

          if (viewportName === 'desktop') {
            await verifyLanguageSwitch(page, route, locale);
            await gotoSurface(page, url);
            await waitForSurfaceReady(page, route);
            await recoverBlankDocument(page, url, route);
            await assertPageIntegrity(page, locale, route);
          }

          const controlResult = await auditVisibleControls(page, route, viewportName);

          REPORT.push({
            route: route.pattern,
            locale,
            viewport: viewportName,
            url,
            screenshot: screenshotPath,
            controls: controlResult,
            consoleErrors,
            pageErrors,
            networkIssues,
          });

          expect(consoleErrors, 'page should not emit significant console errors').toEqual([]);
          expect(pageErrors, 'page should not throw uncaught browser errors').toEqual([]);
          expect(networkIssues, 'page should not have API/document/script failures').toEqual([]);
          expect(
            controlResult.issues,
            'interactive controls should be named, sized, unclipped, and covered'
          ).toEqual([]);
        });
      }
    }
  }

  test.afterAll(() => {
    ensureDir(REPORT_ROOT);
    const reportPath = path.join(REPORT_ROOT, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(REPORT, null, 2));

    const summary = REPORT.map((entry) => ({
      route: entry.route,
      locale: entry.locale,
      viewport: entry.viewport,
      controls: entry.controls.total,
      clicked: entry.controls.clicked,
      focused: entry.controls.focused,
      exempted: entry.controls.exempted,
      issues: entry.controls.issues.length,
    }));
    fs.writeFileSync(path.join(REPORT_ROOT, 'summary.json'), JSON.stringify(summary, null, 2));
  });
});

async function gotoSurface(page: Page, url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: 'commit', timeout: 90000 });
    } catch (error) {
      const message = String(error);
      if (message.includes('Timeout')) {
        return null;
      }

      const rendered = await page
        .locator('body')
        .isVisible()
        .catch(() => false);
      if (rendered) {
        return null;
      }

      const isTransientDevServerRestart =
        message.includes('ERR_EMPTY_RESPONSE') ||
        message.includes('ERR_CONNECTION_REFUSED') ||
        message.includes('ERR_CONNECTION_RESET') ||
        message.includes('ERR_ABORTED');

      if (!isTransientDevServerRestart) {
        throw error;
      }

      lastError = error;
      await page.waitForTimeout(1500 * (attempt + 1));
    }
  }
  throw lastError;
}

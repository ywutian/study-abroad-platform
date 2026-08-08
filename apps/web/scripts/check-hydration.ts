/**
 * 生产 hydration 检测脚本 —— `check-seo-html.ts` 的另一半。
 *
 * 那个脚本刻意只看服务端 HTML(爬虫读的东西);这个刻意只看**hydrate 之后才
 * 存在的东西**。两边合起来才覆盖一个页面:SSR 的壳发对了,和 React 真的接管了。
 *
 * 为什么需要它:2026-08-07 我用 in-app 浏览器看生产,论坛页渲染成「0 个社区」
 * + 永久转圈,而同一时刻在页面里 `fetch()` 那个接口返回 20 条正常。我据此写了
 * 一条根因、报给用户、开了 task —— **那个 bug 不存在**,是浏览器自己没 hydrate。
 * 换 Playwright 直打生产,三条路由全部正常。
 *
 * 所以判据不是「DOM 里有没有内容」——SSR 的壳一直都在,`loading=true` 的初始
 * state 渲染出来就长得像「加载中」。判据是**只有客户端 effect 才会发生的事**:
 *
 *   1. 页面自己发出了它的数据请求(每条路由声明自己的 `apiPattern`)
 *   2. 没有 pageerror
 *   3. 渲染出来的社区名符合当前 locale(见 FORBIDDEN_IN_LOCALE)
 *
 * 第 3 条守的是 #589:社区名在 DB 里是英文(create-post 会把它写进 post.tags),
 * 中文是前端按 slug 映射出来的。映射断了不会报错,只会静默显示英文 —— 只有
 * 真渲染出来才看得见。用「不许出现另一种语言」而不是「必须出现某个词」,这样
 * 社区增删不会造成假红。
 *
 * 用法:
 *   pnpm --filter web check:hydration                       # 打生产
 *   pnpm --filter web check:hydration http://localhost:4102 # 打本地 next start
 *
 * 网络依赖 + 要下载 chromium,所以**不进 lint:all / pre-push / CI**。CI 那边
 * 有 Web Release Runtime Gate,跑的是本地构建;这个是部署后按需手动跑。
 * 首次使用需要 `npx playwright install chromium`。
 */
import { chromium, type Browser } from '@playwright/test';

const BASE = (process.argv[2] || 'https://www.lumniedu.com').replace(/\/$/, '');

/** 社区名映射表的两侧 —— 任一侧出现在另一侧的 locale 里就是映射断了。 */
const FORBIDDEN_IN_LOCALE: Record<string, string[]> = {
  zh: [
    'Personal Statement',
    'Personal Essay',
    'Model UN',
    'School News',
    'Campus Life',
    // 'Debate' / 'Competition' / 'General' 是英文常用词,可能出现在别处文案里,
    // 只在社区行里判,见下面的选择器
  ],
  en: ['个人陈述', '个人文书', '模联', '院校动态', '校园生活', '辩论', '竞赛', '综合'],
};

interface RouteCheck {
  path: string;
  /** 只有客户端 effect 会发的请求 —— hydrate 的判据 */
  apiPattern: RegExp;
  /** 该路由的 locale,用于社区名方向检查;省略则跳过 */
  locale?: 'zh' | 'en';
  /** 渲染出的社区行选择器(community-sidebar / forum-right-rail 共用) */
  rowSelector?: string;
}

const ROUTES: RouteCheck[] = [
  {
    path: '/zh/forum',
    apiPattern: /\/api\/v1\/forums\//,
    locale: 'zh',
    rowSelector: 'span.block.truncate.text-sm.font-medium',
  },
  {
    path: '/en/forum',
    apiPattern: /\/api\/v1\/forums\//,
    locale: 'en',
    rowSelector: 'span.block.truncate.text-sm.font-medium',
  },
  { path: '/zh/schools', apiPattern: /\/api\/v1\/schools/ },
  { path: '/zh/cases', apiPattern: /\/api\/v1\/cases/ },
];

const HYDRATE_TIMEOUT_MS = 25_000;

interface Failure {
  route: string;
  reason: string;
}

async function checkRoute(browser: Browser, route: RouteCheck): Promise<Failure[]> {
  const failures: Failure[] = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)));

  try {
    await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    // (1) hydration
    const hydrated = await page
      .waitForResponse((r) => route.apiPattern.test(r.url()), { timeout: HYDRATE_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);

    if (!hydrated) {
      failures.push({
        route: route.path,
        reason: `never issued a request matching ${route.apiPattern} within ${HYDRATE_TIMEOUT_MS}ms — the page did not hydrate`,
      });
      return failures; // 后面的检查都建立在 hydrate 之上,没意义再查
    }

    // (3) 社区名方向 —— 只看渲染出来的行,不看整页文本(整页含消息包和别处文案)
    if (route.locale && route.rowSelector) {
      const rows = page.locator(route.rowSelector);
      await rows
        .first()
        .waitFor({ state: 'attached', timeout: 20_000 })
        .catch(() => {});
      const texts = await rows.allTextContents();
      const forbidden = FORBIDDEN_IN_LOCALE[route.locale] ?? [];
      const wrong = texts.filter((t) => forbidden.includes(t.trim()));
      if (wrong.length) {
        failures.push({
          route: route.path,
          reason: `community rows rendered in the wrong language: ${[...new Set(wrong)].join(', ')} — the slug→message map in use-community-name.ts is not being applied`,
        });
      }
      if (texts.length === 0) {
        failures.push({
          route: route.path,
          reason:
            'hydrated but rendered zero community rows — check GET /forums/communities and the seed',
        });
      }
    }

    // (2) pageerror
    if (pageErrors.length) {
      failures.push({ route: route.path, reason: `pageerror: ${pageErrors[0]}` });
    }
  } finally {
    await ctx.close();
  }
  return failures;
}

async function main(): Promise<void> {
  console.log(`\n🌐 Hydration check against ${BASE}\n`);
  const browser = await chromium.launch();
  const failures: Failure[] = [];

  try {
    for (const route of ROUTES) {
      const routeFailures = await checkRoute(browser, route);
      failures.push(...routeFailures);
      console.log(`   ${routeFailures.length ? '❌' : '✅'} ${route.path}`);
      for (const f of routeFailures) console.log(`      ${f.reason}`);
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error(`\n❌ ${failures.length} failure(s) across ${ROUTES.length} route(s).\n`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `\n✅ All ${ROUTES.length} routes hydrate, fetch their own data, and render in-locale.\n`
  );
}

void main();

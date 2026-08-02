/**
 * SEO 服务端 HTML 检测脚本
 *
 * 只看服务器返回的 HTML —— 刻意不用浏览器 DOM。2026-07 那批收录问题里,
 * 有三个 bug 的表现完全一样: typecheck / 测试 / 本地全绿, DevTools 里也
 * 看得见, 但服务端 HTML 里根本没有那个东西(hydrate 之后才由 JS 注入)。
 * 爬虫读的是这里检的东西。
 *
 * 检测项:
 *   1. sitemap.xml 全部 URL 同一个 origin 且属于本站, 学校页数与 API total 一致
 *   2. robots.txt 的 Sitemap 指向本站
 *   3. 每个页面有 canonical(路径正确) + en/zh/x-default hreflang
 *   4. 学校详情页标题各不相同, 且不是首页标题(重复内容 = 不被索引)
 *   5. 服务端 HTML 里有 JSON-LD, 学校页含 EducationalOrganization
 *   6. CSP 带 per-request nonce, 无 'unsafe-eval', inline script 全部带 nonce
 *   7. 学校详情页的服务端 HTML 有 <h1> 和实质正文 —— 唯一守着 SSR 的检查,
 *      页面若被改回纯客户端渲染, 前六项仍会全绿(metadata/JSON-LD 由 layout
 *      产出), 只有这一项会红
 *
 * 用法:
 *   pnpm --filter web check:seo                      # 打生产
 *   pnpm --filter web check:seo http://localhost:4102 # 打本地 next start
 *
 * 本地模式下, "发布 origin == 抓取 origin" 那几条会标 SKIP 并打印原因(应用发的
 * 是 NEXT_PUBLIC_APP_URL, 不是 localhost), 其余照常严格检。
 *
 * 网络依赖 + 需要真实构建产物, 所以不进 lint:all / pre-push, 按需手动跑。
 */

const BASE = (process.argv[2] || 'https://www.lumniedu.com').replace(/\/$/, '');
const LOCALES = ['en', 'zh'] as const;
/** 抽查多少个学校详情页 —— 全量 243 个太慢, 按 id 排序取首尾即可暴露系统性问题 */
const SCHOOL_SAMPLE = 6;
/**
 * 服务端 HTML 的可见文本下限。纯客户端渲染时只剩导航栏(实测 48-83 字),
 * 服务端渲染后最短的中文页也有 847 字。400 卡在两者中间, 数据再稀疏的学校
 * 也不会误报。
 */
const MIN_VISIBLE_TEXT = 400;

/**
 * 打本地构建时, 页面发出的 canonical / sitemap 用的是 NEXT_PUBLIC_APP_URL
 * (生产域名), 不是 http://localhost:PORT。拿抓取地址去比必然全红, 而"跑一下就
 * 四条红"会直接把这个工具训练成没人看的东西。
 *
 * 所以本地模式下把"发布 origin == 抓取 origin"这一类断言标为 SKIP 并明确打印,
 * 其余(同一个 origin 内部是否自洽、路径是否正确)照常检。反过来打真实部署时
 * 一条都不放松 —— #507 那个 bug 就是 sitemap 指向了别人的域名, 如果改成从
 * sitemap 自己反推期望 origin, 这个检查就永远抓不到它了。
 */
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE);

interface Result {
  name: string;
  ok: boolean;
  detail: string;
  skipped?: boolean;
}
const results: Result[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
}

/** 只在打真实部署时才有意义的断言 */
function checkDeployedOnly(name: string, ok: boolean, detail = ''): void {
  if (IS_LOCAL) {
    results.push({
      name,
      ok: true,
      detail: '本地构建, 发布 origin 与抓取 origin 本就不同',
      skipped: true,
    });
    return;
  }
  results.push({ name, ok, detail });
}

async function get(path: string): Promise<{ status: number; headers: Headers; body: string }> {
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(45_000) });
  return { status: res.status, headers: res.headers, body: await res.text() };
}

function titleOf(html: string): string {
  return /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
}

/**
 * 剥掉 script/style 和标签后的可见文本长度。
 * 客户端渲染的详情页在这里只剩导航栏的 ~50 字; 服务端渲染后是 800+。
 */
function visibleTextLength(html: string): number {
  const stripped = html
    .replace(/<(script|style)\b[^>]*>.*?<\/\1>/gs, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length;
}

/** 服务端 HTML 里的 JSON-LD @type 列表。'<' 是组件为防闭合标签做的转义。 */
function jsonLdTypes(html: string): string[] {
  const blocks = html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs);
  return [...blocks].map((m) => {
    try {
      return JSON.parse(m[1].replace(/\\u003c/g, '<'))['@type'] as string;
    } catch {
      return '(unparseable)';
    }
  });
}

async function checkSitemapAndRobots(): Promise<string[]> {
  const { body: sitemap } = await get('/sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  // 混着两个 origin 说明有地方在自己拼 URL 而不是走 NEXT_PUBLIC_APP_URL
  const origins = new Set(urls.map((u) => new URL(u).origin));
  check('sitemap 内所有 URL 同一个 origin', origins.size === 1, [...origins].join(' + ') || '空');
  const publishedOrigin = [...origins][0] ?? BASE;

  const foreign = urls.filter((u) => !u.startsWith(BASE));
  checkDeployedOnly(
    'sitemap 的 origin == 站点自身',
    foreign.length === 0,
    foreign.length ? `${foreign.length} 条外域, 例: ${foreign[0]}` : `${urls.length} 条`
  );

  const { body: robots } = await get('/robots.txt');
  const robotsSitemap = /Sitemap:\s*(\S+)/.exec(robots)?.[1];
  check(
    'robots.txt 的 Sitemap 与 sitemap 自身同 origin',
    !!robotsSitemap && new URL(robotsSitemap).origin === publishedOrigin,
    robotsSitemap ?? '缺失'
  );
  checkDeployedOnly(
    'robots.txt 的 Sitemap 指向站点自身',
    robots.includes(`Sitemap: ${BASE}/sitemap.xml`),
    robotsSitemap ?? '缺失'
  );

  const schoolUrls = urls.filter((u) => /\/schools\/[a-z0-9]{10,}$/.test(u));
  const ids = new Set(schoolUrls.map((u) => u.split('/').pop()!));

  const { body: api } = await get('/api/v1/schools?page=1&pageSize=1');
  const total = (JSON.parse(api) as { data: { total: number } }).data.total;
  check('sitemap 学校数 == API total', ids.size === total, `sitemap ${ids.size} / API ${total}`);
  check(
    '每所学校 en+zh 各一条',
    schoolUrls.length === ids.size * LOCALES.length,
    `${schoolUrls.length} 条 URL / ${ids.size} 所`
  );

  // 全站同一个 lastmod 说明取的是构建时间, 爬虫无法判断哪些页面真的变了
  const lastmods = new Set(
    [
      ...sitemap.matchAll(
        /<loc>[^<]*\/schools\/[a-z0-9]{10,}<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g
      ),
    ].map((m) => m[1])
  );
  check('lastmod 取自各校 updatedAt', lastmods.size > 1, `${lastmods.size} 个不同值`);

  return schoolUrls;
}

async function checkCanonicalAndHreflang(paths: string[]): Promise<void> {
  for (const path of paths) {
    const { body } = await get(path);
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(body)?.[1];
    // 路径写错(比如子页 canonical 到 locale 根)是最容易犯的错, 两种模式都要检
    check(
      `${path} canonical 路径 == 自身`,
      !!canonical && new URL(canonical).pathname === path,
      canonical ?? '缺失'
    );
    checkDeployedOnly(
      `${path} canonical origin == 站点自身`,
      canonical === BASE + path,
      canonical ?? '缺失'
    );

    const langs = new Set(
      [...body.matchAll(/<link rel="alternate" hrefLang="([^"]+)"/g)].map((m) => m[1])
    );
    const want = [...LOCALES, 'x-default'];
    check(
      `${path} hreflang 覆盖 ${want.join('/')}`,
      want.every((l) => langs.has(l)),
      [...langs].sort().join(',') || '缺失'
    );
  }
}

async function checkCsp(): Promise<void> {
  const nonces = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const { headers } = await get('/zh');
    const n = /'nonce-([^']+)'/.exec(headers.get('content-security-policy') ?? '')?.[1];
    if (n) nonces.add(n);
  }
  check('CSP 带 nonce 且每次请求都不同', nonces.size === 3, `3 次请求得到 ${nonces.size} 个不同值`);

  // 头和正文必须取自同一次响应 —— nonce 每次都变, 跨请求比对必然假阴性
  const { headers, body } = await get('/zh');
  const csp = headers.get('content-security-policy') ?? '';
  check("prod CSP 不含 'unsafe-eval'", !csp.includes("'unsafe-eval'"));

  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  if (!nonce) {
    check('可执行 inline script 全部带正确 nonce', false, '响应头里没有 nonce');
    return;
  }
  // ld+json 是数据块不是脚本, CSP script-src 不管它们
  const inline = [...body.matchAll(/<script\b([^>]*)>(.*?)<\/script>/gs)]
    .filter(
      ([, attrs, code]) => !attrs.includes('src=') && code.trim() && !attrs.includes('ld+json')
    )
    .map(([, attrs]) => attrs);
  const missing = inline.filter((a) => !a.includes(`nonce="${nonce}"`));
  check(
    '可执行 inline script 全部带正确 nonce',
    inline.length > 0 && missing.length === 0,
    `${inline.length} 个, 缺 ${missing.length} 个`
  );
}

async function checkSchoolPages(schoolUrls: string[]): Promise<void> {
  const homeTitles = Object.fromEntries(
    await Promise.all(LOCALES.map(async (l) => [l, titleOf((await get(`/${l}`)).body)] as const))
  ) as Record<string, string>;

  const { body: home } = await get('/zh');
  check(
    '首页服务端 HTML 含 JSON-LD',
    jsonLdTypes(home).length >= 2,
    jsonLdTypes(home).join(',') || '0 块'
  );

  // 首尾各取一批: 只验开头容易漏掉后期导入的数据
  const sorted = [...schoolUrls].sort();
  const half = Math.ceil(SCHOOL_SAMPLE / 2);
  const sample = [...sorted.slice(0, half), ...sorted.slice(-half)];
  const titles = new Set<string>();

  for (const url of sample) {
    // 用 pathname 而非 slice(BASE.length): sitemap 里的 URL 未必以 BASE 开头
    // (裸域 vs www 就会错位), 那样切出来的路径是垃圾, 报错信息也跟着不可读
    const path = new URL(url).pathname;
    const locale = path.split('/')[1];
    const { status, body } = await get(path);
    check(`${path} 返回 200`, status === 200, String(status));

    const title = titleOf(body);
    titles.add(title);
    check(
      `${path} 标题 != 本语言首页标题`,
      title !== '' && title !== homeTitles[locale],
      title.slice(0, 60)
    );

    const types = jsonLdTypes(body);
    check(
      `${path} 服务端 JSON-LD 含 EducationalOrganization`,
      types.includes('EducationalOrganization'),
      types.join(',') || '0 块'
    );

    // 页面回退成纯客户端渲染时, 上面几项仍会全绿(metadata 和 JSON-LD 由 layout
    // 产出), 只有正文会重新塌回导航栏那几十个字。这两条是唯一守着 SSR 的检查。
    check(
      `${path} 服务端 HTML 有 <h1>`,
      /<h1[\s>]/.test(body),
      /<h1[\s>]/.test(body) ? '' : '缺失'
    );
    const words = visibleTextLength(body);
    check(`${path} 服务端 HTML 有实质正文`, words >= MIN_VISIBLE_TEXT, `${words} 字`);
  }

  check(
    '抽样学校标题互不相同',
    titles.size === sample.length,
    `${titles.size}/${sample.length} 唯一`
  );
}

async function main(): Promise<void> {
  console.log(`🔍 检测服务端 SEO HTML: ${BASE}\n`);

  const schoolUrls = await checkSitemapAndRobots();
  await checkCanonicalAndHreflang(['/zh', '/en/schools']);
  await checkCsp();
  await checkSchoolPages(schoolUrls);

  for (const { name, ok, detail, skipped } of results) {
    const icon = skipped ? '⏭️ ' : ok ? '✅' : '❌';
    console.log(`  ${icon} ${name}${detail ? `   [${detail}]` : ''}`);
  }

  const failed = results.filter((r) => !r.ok);
  const skippedCount = results.filter((r) => r.skipped).length;
  console.log('\n' + '─'.repeat(60));
  console.log(
    `${results.length - failed.length - skippedCount}/${results.length - skippedCount} 通过` +
      (skippedCount ? `, ${skippedCount} 项跳过(本地模式)` : '')
  );

  if (failed.length > 0) {
    console.log(`\n❌ SEO 检测失败:\n${failed.map((f) => `   - ${f.name}`).join('\n')}`);
    process.exit(1);
  }
  console.log('\n✅ 服务端 HTML 具备被索引的全部条件');
}

main().catch((err) => {
  console.error(`\n❌ 检测无法完成: ${err instanceof Error ? err.message : String(err)}`);
  console.error(`   目标 ${BASE} 可达吗? 本地跑需要先 next build && next start。`);
  process.exit(1);
});

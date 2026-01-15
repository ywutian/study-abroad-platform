/**
 * 搜索 API 连通性验证脚本
 *
 * 用法: npx ts-node scripts/verify-search-apis.ts
 *
 * 功能:
 * 1. 读取 .env 中的 API Key
 * 2. 测试 Google Custom Search API 连通性
 * 3. 测试 Tavily API 连通性
 * 4. 输出每个引擎的状态
 */

 
const dotenv = require('dotenv');
 
const path = require('path');

// 加载 .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 颜色辅助
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function ok(msg: string) {
  console.log(`  ${GREEN}✓${RESET} ${msg}`);
}
function fail(msg: string) {
  console.log(`  ${RED}✗${RESET} ${msg}`);
}
function warn(msg: string) {
  console.log(`  ${YELLOW}⚠${RESET} ${msg}`);
}

async function verifyGoogleSearch(): Promise<boolean> {
  console.log(`\n${BOLD}=== Google Custom Search API ===${RESET}`);

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey) {
    warn('GOOGLE_SEARCH_API_KEY 未配置');
    return false;
  }
  ok('GOOGLE_SEARCH_API_KEY 已配置');

  if (!cx) {
    warn('GOOGLE_SEARCH_ENGINE_ID 未配置');
    return false;
  }
  ok('GOOGLE_SEARCH_ENGINE_ID 已配置');

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx: cx,
      q: 'MIT admissions',
      num: '3',
    });

    const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
    console.log(`  发送测试查询: "MIT admissions"...`);

    const start = Date.now();
    const res = await fetch(url);
    const elapsed = Date.now() - start;

    if (!res.ok) {
      const body = await res.text();
      fail(`API 返回错误 ${res.status}: ${body.substring(0, 200)}`);
      return false;
    }

    const data = await res.json();
    const items = data.items || [];

    ok(`连通成功 (${elapsed}ms)`);
    ok(`返回 ${items.length} 条结果`);

    if (items.length > 0) {
      console.log(`  示例结果:`);
      console.log(`    标题: ${items[0].title}`);
      console.log(`    链接: ${items[0].link}`);
      console.log(`    摘要: ${(items[0].snippet || '').substring(0, 100)}...`);
    }

    return true;
  } catch (error: any) {
    fail(`请求失败: ${error.message}`);
    return false;
  }
}

async function verifyTavilySearch(): Promise<boolean> {
  console.log(`\n${BOLD}=== Tavily Search API ===${RESET}`);

  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    warn('TAVILY_API_KEY 未配置');
    return false;
  }
  ok('TAVILY_API_KEY 已配置');

  try {
    console.log(`  发送测试查询: "MIT application deadline"...`);

    const start = Date.now();
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: 'MIT application deadline',
        max_results: 3,
        search_depth: 'basic',
      }),
    });
    const elapsed = Date.now() - start;

    if (!res.ok) {
      const body = await res.text();
      fail(`API 返回错误 ${res.status}: ${body.substring(0, 200)}`);
      return false;
    }

    const data = await res.json();
    const results = data.results || [];

    ok(`连通成功 (${elapsed}ms)`);
    ok(`返回 ${results.length} 条结果`);

    if (results.length > 0) {
      console.log(`  示例结果:`);
      console.log(`    标题: ${results[0].title}`);
      console.log(`    链接: ${results[0].url}`);
      console.log(
        `    内容: ${(results[0].content || '').substring(0, 100)}...`,
      );
    }

    // 测试高级搜索（include_domains）
    console.log(`\n  测试域名限定搜索 (include_domains: mit.edu)...`);

    const start2 = Date.now();
    const res2 = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: 'MIT application deadline 2025',
        max_results: 3,
        search_depth: 'advanced',
        include_domains: ['mit.edu'],
      }),
    });
    const elapsed2 = Date.now() - start2;

    if (!res2.ok) {
      const body2 = await res2.text();
      warn(`域名限定搜索失败 ${res2.status}: ${body2.substring(0, 200)}`);
    } else {
      const data2 = await res2.json();
      const results2 = data2.results || [];
      ok(`域名限定搜索成功 (${elapsed2}ms), 返回 ${results2.length} 条结果`);

      if (results2.length > 0) {
        console.log(`    标题: ${results2[0].title}`);
        console.log(`    链接: ${results2[0].url}`);
      }
    }

    return true;
  } catch (error: any) {
    fail(`请求失败: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(`${BOLD}搜索 API 连通性验证${RESET}`);
  console.log(`时间: ${new Date().toISOString()}`);

  const googleOk = await verifyGoogleSearch();
  const tavilyOk = await verifyTavilySearch();

  // 总结
  console.log(`\n${BOLD}=== 总结 ===${RESET}`);
  console.log(
    `  Google Custom Search: ${googleOk ? `${GREEN}可用${RESET}` : `${RED}不可用${RESET}`}`,
  );
  console.log(
    `  Tavily Search:        ${tavilyOk ? `${GREEN}可用${RESET}` : `${RED}不可用${RESET}`}`,
  );

  if (googleOk && tavilyOk) {
    console.log(
      `\n  ${GREEN}${BOLD}全部搜索引擎就绪！双引擎 + 互为降级备份${RESET}`,
    );
  } else if (googleOk || tavilyOk) {
    console.log(`\n  ${YELLOW}${BOLD}部分搜索引擎可用，功能降级运行${RESET}`);
  } else {
    console.log(`\n  ${RED}${BOLD}无搜索引擎可用，搜索功能将被禁用${RESET}`);
  }

  process.exit(googleOk || tavilyOk ? 0 : 1);
}

main().catch((err) => {
  console.error('验证脚本出错:', err);
  process.exit(1);
});

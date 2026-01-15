/**
 * API端点健康检查脚本
 *
 * 运行: pnpm ts-node scripts/check-endpoints.ts
 */

const API_BASE = process.env.API_URL || 'http://localhost:3001';

interface EndpointCheck {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  requiresAuth: boolean;
  expectedStatus: number[];
  body?: any;
}

// 公开端点（无需登录）
const PUBLIC_ENDPOINTS: EndpointCheck[] = [
  {
    name: '健康检查',
    method: 'GET',
    path: '/health',
    requiresAuth: false,
    expectedStatus: [200],
  },
  {
    name: '学校列表',
    method: 'GET',
    path: '/schools?pageSize=5',
    requiresAuth: false,
    expectedStatus: [200],
  },
  {
    name: '学校排名',
    method: 'GET',
    path: '/ranking?source=USNews&limit=10',
    requiresAuth: false,
    expectedStatus: [200],
  },
  {
    name: '录取案例',
    method: 'GET',
    path: '/cases?pageSize=5',
    requiresAuth: false,
    expectedStatus: [200],
  },
  {
    name: '论坛帖子',
    method: 'GET',
    path: '/forum/posts?pageSize=5',
    requiresAuth: false,
    expectedStatus: [200],
  },
  {
    name: '文书题目',
    method: 'GET',
    path: '/essay-prompts?pageSize=5',
    requiresAuth: false,
    expectedStatus: [200],
  },
  {
    name: '测评列表',
    method: 'GET',
    path: '/assessment',
    requiresAuth: false,
    expectedStatus: [200],
  },
];

// 需要登录的端点
const AUTH_ENDPOINTS: EndpointCheck[] = [
  {
    name: '用户信息',
    method: 'GET',
    path: '/users/me',
    requiresAuth: true,
    expectedStatus: [200, 401],
  },
  {
    name: '个人档案',
    method: 'GET',
    path: '/profile',
    requiresAuth: true,
    expectedStatus: [200, 401],
  },
  {
    name: '申请时间线',
    method: 'GET',
    path: '/timeline',
    requiresAuth: true,
    expectedStatus: [200, 401],
  },
  {
    name: '通知列表',
    method: 'GET',
    path: '/notifications',
    requiresAuth: true,
    expectedStatus: [200, 401],
  },
  {
    name: '私信会话',
    method: 'GET',
    path: '/chat/conversations',
    requiresAuth: true,
    expectedStatus: [200, 401],
  },
  {
    name: '保险箱',
    method: 'GET',
    path: '/vault',
    requiresAuth: true,
    expectedStatus: [200, 401],
  },
  {
    name: '设置',
    method: 'GET',
    path: '/settings',
    requiresAuth: true,
    expectedStatus: [200, 401],
  },
  {
    name: 'AI偏好',
    method: 'GET',
    path: '/ai-agent/preferences',
    requiresAuth: true,
    expectedStatus: [200, 401],
  },
];

// 管理员端点
const ADMIN_ENDPOINTS: EndpointCheck[] = [
  {
    name: '管理统计',
    method: 'GET',
    path: '/admin/stats',
    requiresAuth: true,
    expectedStatus: [200, 401, 403],
  },
  {
    name: '用户列表',
    method: 'GET',
    path: '/admin/users',
    requiresAuth: true,
    expectedStatus: [200, 401, 403],
  },
  {
    name: '举报列表',
    method: 'GET',
    path: '/admin/reports',
    requiresAuth: true,
    expectedStatus: [200, 401, 403],
  },
  {
    name: '文书审核统计',
    method: 'GET',
    path: '/admin/essay-prompts/stats',
    requiresAuth: true,
    expectedStatus: [200, 401, 403],
  },
];

interface CheckResult {
  name: string;
  path: string;
  status: number | string;
  success: boolean;
  latency: number;
  error?: string;
}

async function checkEndpoint(
  endpoint: EndpointCheck,
  token?: string,
): Promise<CheckResult> {
  const startTime = Date.now();
  const url = `${API_BASE}${endpoint.path}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token && endpoint.requiresAuth) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: endpoint.method,
      headers,
      body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
    });

    const latency = Date.now() - startTime;
    const success = endpoint.expectedStatus.includes(response.status);

    return {
      name: endpoint.name,
      path: endpoint.path,
      status: response.status,
      success,
      latency,
    };
  } catch (error: any) {
    return {
      name: endpoint.name,
      path: endpoint.path,
      status: 'ERROR',
      success: false,
      latency: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function runChecks() {
  console.log('🔍 API端点健康检查\n');
  console.log(`📍 API地址: ${API_BASE}\n`);
  console.log('='.repeat(70));

  const results: CheckResult[] = [];
  let passCount = 0;
  let failCount = 0;

  // 检查公开端点
  console.log('\n📗 公开端点:\n');
  for (const endpoint of PUBLIC_ENDPOINTS) {
    const result = await checkEndpoint(endpoint);
    results.push(result);

    const icon = result.success ? '✅' : '❌';
    const statusColor = result.success ? '\x1b[32m' : '\x1b[31m';
    console.log(
      `${icon} ${result.name.padEnd(20)} ${statusColor}${String(result.status).padEnd(6)}\x1b[0m ${result.latency}ms ${result.error || ''}`,
    );

    result.success ? passCount++ : failCount++;
  }

  // 检查需要登录的端点（预期返回401）
  console.log('\n📙 需要登录的端点 (无Token):\n');
  for (const endpoint of AUTH_ENDPOINTS) {
    const result = await checkEndpoint(endpoint);
    results.push(result);

    const icon = result.success ? '✅' : '❌';
    const statusColor = result.success ? '\x1b[32m' : '\x1b[31m';
    console.log(
      `${icon} ${result.name.padEnd(20)} ${statusColor}${String(result.status).padEnd(6)}\x1b[0m ${result.latency}ms ${result.error || ''}`,
    );

    result.success ? passCount++ : failCount++;
  }

  // 检查管理员端点（预期返回401或403）
  console.log('\n📕 管理员端点 (无Token):\n');
  for (const endpoint of ADMIN_ENDPOINTS) {
    const result = await checkEndpoint(endpoint);
    results.push(result);

    const icon = result.success ? '✅' : '❌';
    const statusColor = result.success ? '\x1b[32m' : '\x1b[31m';
    console.log(
      `${icon} ${result.name.padEnd(20)} ${statusColor}${String(result.status).padEnd(6)}\x1b[0m ${result.latency}ms ${result.error || ''}`,
    );

    result.success ? passCount++ : failCount++;
  }

  // 汇总
  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 检查结果汇总:`);
  console.log(`   总计: ${results.length}`);
  console.log(`   通过: \x1b[32m${passCount}\x1b[0m`);
  console.log(`   失败: \x1b[31m${failCount}\x1b[0m`);
  console.log(`   成功率: ${((passCount / results.length) * 100).toFixed(1)}%`);

  // 失败详情
  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.log('\n❌ 失败的端点:');
    failures.forEach((f) => {
      console.log(`   - ${f.name} (${f.path}): ${f.status} ${f.error || ''}`);
    });
  }

  // 延迟统计
  const latencies = results
    .map((r) => r.latency)
    .filter((l) => typeof l === 'number');
  if (latencies.length > 0) {
    console.log('\n⏱️ 延迟统计:');
    console.log(
      `   平均: ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0)}ms`,
    );
    console.log(`   最大: ${Math.max(...latencies)}ms`);
    console.log(`   最小: ${Math.min(...latencies)}ms`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

runChecks().catch(console.error);

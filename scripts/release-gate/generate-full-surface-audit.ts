import fs from 'node:fs/promises';
import path from 'node:path';

import {
  AGENT_BUNDLE_DEFINITIONS,
  buildFullSurfaceRegistry,
  FULL_SURFACE_REGISTRY_VERSION,
  qualityDimensionChineseLabels,
  type CapabilitySurfaceDefinition,
  type FullSurfaceRegistry,
  type JourneyOverlaySurfaceDefinition,
  type RouteSurfaceDefinition,
} from './full-surface-registry';

const ROOT = process.cwd();

interface CliArgs {
  auditDate: string;
  docsDir: string;
  evidenceDir: string;
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

  const today = new Date().toISOString().slice(0, 10);

  const auditDate = values.get('audit-date') ?? values.get('date') ?? today;

  return {
    auditDate,
    docsDir: path.resolve(ROOT, values.get('docs-dir') ?? 'docs'),
    evidenceDir: path.resolve(
      ROOT,
      values.get('evidence-dir') ?? `e2e-report/full-surface-${auditDate}`
    ),
  };
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

function shellArtifactCount(routes: readonly RouteSurfaceDefinition[]) {
  return new Set(
    routes.flatMap((route) =>
      route.routeMetadata.supportingShells.map((shell) => shell.relativePath)
    )
  ).size;
}

function renderRouteTable(title: string, routes: readonly RouteSurfaceDefinition[]) {
  const lines = [
    `## ${title}`,
    '',
    '| surface_id | route | source | persona | ui_layer | page_contract_variant | migration_status | ai_explanatory_surface | owner | validation | batch | quality_dimensions | shell_artifacts |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...routes.map((route) => {
      const shells =
        route.routeMetadata.supportingShells.length > 0
          ? route.routeMetadata.supportingShells.map((shell) => shell.relativePath).join('<br/>')
          : '-';
      return `| ${route.surfaceId} | \`${route.routeMetadata.routeTemplate}\` | \`${route.routeMetadata.sourcePath}\` | \`${route.persona}\` | \`${route.uiLayer}\` | \`${route.pageContractVariant}\` | \`${route.migrationStatus}\` | \`${route.aiExplanatorySurface}\` | \`${route.executionOwner}\` | \`${route.validationType}\` | \`${route.agentBundle}\` | ${qualityDimensionChineseLabels(route.qualityDimensions).join(' / ')} | ${shells} |`;
    }),
    '',
  ];
  return lines.join('\n');
}

function renderCapabilityTable(capabilities: readonly CapabilitySurfaceDefinition[]) {
  const lines = [
    '## Capability Inventory',
    '',
    '| surface_id | capability | platform | owner | validation | batch | linked journeys | quality_dimensions | external_prerequisites |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...capabilities.map((capability) => {
      const prerequisites =
        capability.externalPrerequisites.length > 0
          ? capability.externalPrerequisites.map((item) => item.scope).join('<br/>')
          : '-';
      return `| ${capability.surfaceId} | ${capability.routeOrEntry} | \`${capability.platform}\` | \`${capability.executionOwner}\` | \`${capability.validationType}\` | \`${capability.agentBundle}\` | ${capability.linkedJourneyIds.map((id) => `\`${id}\``).join(', ') || '-'} | ${qualityDimensionChineseLabels(capability.qualityDimensions).join(' / ')} | ${prerequisites} |`;
    }),
    '',
  ];
  return lines.join('\n');
}

function renderJourneyOverlayTable(journeys: readonly JourneyOverlaySurfaceDefinition[]) {
  const lines = [
    '## Journey Overlay',
    '',
    '| surface_id | journey_id | title | platform | owner | validation | batch | quality_dimensions |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...journeys.map(
      (journey) =>
        `| ${journey.surfaceId} | \`${journey.journeyId}\` | ${journey.description} | \`${journey.platform}\` | \`${journey.executionOwner}\` | \`${journey.validationType}\` | \`${journey.agentBundle}\` | ${qualityDimensionChineseLabels(journey.qualityDimensions).join(' / ')} |`
    ),
    '',
  ];
  return lines.join('\n');
}

function renderRegistryMarkdown(registry: FullSurfaceRegistry, auditDate: string) {
  const lines = [
    '# Full Surface Registry',
    '',
    '> 本文件是全产品面审计的人类可读事实源；机器可读版本见 `scripts/release-gate/full-surface-registry.ts`。',
    '',
    '## 元信息',
    '',
    '| 字段 | 值 |',
    '| --- | --- |',
    `| \`full_surface_registry_version\` | \`${registry.version}\` |`,
    `| \`journey_registry_version\` | \`${registry.journeyRegistryVersion}\` |`,
    `| \`generated_at\` | \`${registry.generatedAt}\` |`,
    `| \`audit_bootstrap_date\` | \`${auditDate}\` |`,
    '',
    '## 计数',
    '',
    '| 类别 | 数量 | 说明 |',
    '| --- | --- | --- |',
    `| Web standalone routes | ${registry.counts.webStandaloneRoutes} | 由 \`apps/web/src/app/**/page.tsx\` 发现 |`,
    `| Mobile standalone routes | ${registry.counts.mobileStandaloneRoutes} | 由 \`apps/mobile/src/app/**/*.tsx\` 发现，排除 \`_layout.tsx\` 作为独立页面 |`,
    `| Web shell artifacts | ${registry.counts.webShellArtifacts} | \`layout/loading/error/not-found/default\` 作为专项检查项挂到对应 route |`,
    `| Mobile shell artifacts | ${registry.counts.mobileShellArtifacts} | \`_layout\` 等壳层作为专项检查项挂到对应 screen |`,
    `| Capability entries | ${registry.counts.capabilityEntries} | 跨页/跨端能力检查项 |`,
    `| Journey overlay entries | ${registry.counts.journeyOverlayEntries} | 现有 active journeys 的聚合覆盖 |`,
    `| Total surface entries | ${registry.counts.totalSurfaceEntries} | route + capability + journey |`,
    '',
    '## 多 Agent 批次固定映射',
    '',
    '| batch | agents | 默认范围 |',
    '| --- | --- | --- |',
    ...Object.entries(AGENT_BUNDLE_DEFINITIONS).map(
      ([bundleId, bundle]) =>
        `| \`${bundleId}\` | ${bundle.agents.map((agent) => `\`${agent}\``).join(', ')} | ${bundle.defaultScope} |`
    ),
    '',
    renderRouteTable('Route Inventory · Web', registry.routeInventory.web),
    renderRouteTable('Route Inventory · Mobile', registry.routeInventory.mobile),
    renderCapabilityTable(registry.capabilityInventory),
    renderJourneyOverlayTable(registry.journeyOverlay),
    '## 使用规则',
    '',
    '- 后续 full-surface audit 以本文件与 `scripts/release-gate/full-surface-registry.ts` 为唯一事实源。',
    '- route shell 文件不单独算页面，但必须作为专项检查项挂在对应 route 的 `supportingShells`。',
    '- 任何新增页面或跨页能力，都必须先扩展机器 registry，再回刷本文件和模板。',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function renderAgentReviewMarkdown(registry: FullSurfaceRegistry, auditDate: string) {
  const lines = [
    `# Full Surface Agent Review · ${auditDate}`,
    '',
    '> 本文件记录多 Agent 视角下的 Batch 规划、分诊规则和阶段性结论。当前版本用于 Batch 0 启动与后续批次承接。',
    '',
    '## 审查元信息',
    '',
    '| 字段 | 值 |',
    '| --- | --- |',
    `| \`full_surface_registry_version\` | \`${registry.version}\` |`,
    `| \`journey_registry_version\` | \`${registry.journeyRegistryVersion}\` |`,
    `| \`route_scope\` | \`web ${registry.counts.webStandaloneRoutes} / mobile ${registry.counts.mobileStandaloneRoutes}\` |`,
    `| \`capability_scope\` | \`${registry.counts.capabilityEntries}\` |`,
    `| \`journey_overlay_scope\` | \`${registry.counts.journeyOverlayEntries}\` |`,
    '',
    '## Batch 0 结论',
    '',
    '- 已确认当前仓库此前只有 journey 级事实源，没有 full-surface registry。',
    '- Web 存在大量 shell-only 文件；它们不应算独立页面，但必须绑定到对应 route 检查。',
    '- Mobile 真实应区分 standalone routes 与 `_layout` 壳层；后者必须单列为专项检查。',
    '- `A11 / SJ-3` 的 Android remote push 继续保留为 conditional capability gate，不与 mobile 核心运行态混淆。',
    '- `MEMORY.md` 之前不存在，本轮需要显式建立以沉淀易漏点与重复使用说明。',
    '',
    '## CLAUDE 五类分诊默认口径',
    '',
    '| 类别 | 默认适用 |',
    '| --- | --- |',
    '| `CODE_BUG` | 页面崩溃、错误渲染、请求契约不一致、错误恢复失效 |',
    '| `DATA_ISSUE` | seed / 样本 / 后台数据缺失导致的空态或误导 |',
    '| `UX_CONFUSION` | badge、概率、置信度、策略分层等用户误解 |',
    '| `NEW_FEATURE` | inventory 中发现不存在但产品目标要求的新能力 |',
    '| `INDUSTRY_SUGGESTION` | 顾问口吻、留学业务逻辑、推荐解释是否专业 |',
    '',
    '## 后续批次执行矩阵',
    '',
    '| batch | agents | 主要对象 | 预期产物 |',
    '| --- | --- | --- | --- |',
    ...Object.entries(AGENT_BUNDLE_DEFINITIONS)
      .filter(([bundleId]) => bundleId !== 'batch-0-inventory-triage')
      .map(
        ([bundleId, bundle]) =>
          `| \`${bundleId}\` | ${bundle.agents.map((agent) => `\`${agent}\``).join(', ')} | ${bundle.defaultScope} | 对应 batch summary + route/capability records |`
      ),
    '',
    '## 文档闭环要求',
    '',
    '- 每个批次结束后，必须同步更新 `FULL_SURFACE_AUDIT_LOG`、`FULL_SURFACE_AGENT_REVIEW`、`MEMORY.md` 和相关模板。',
    '- Journey 层的变更只回填摘要到 `docs/USER_JOURNEY_AUDIT_LOG.md`，不把 full-surface 明细塞进去。',
    '- 所有发现都必须落入复用手册或 gap checklist，避免下次再次遗漏。',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function renderAuditLogMarkdown(
  registry: FullSurfaceRegistry,
  auditDate: string,
  evidenceDir: string
) {
  const lines = [
    `# Full Surface Audit Log · ${auditDate}`,
    '',
    '> 本文件是全产品面审计的正式记录台账。当前版本完成 Batch 0 inventory bootstrap，后续批次应在同文件继续回填真实运行态结果。',
    '',
    '## 审计元信息',
    '',
    '| 字段 | 值 |',
    '| --- | --- |',
    `| \`full_surface_registry_version\` | \`${registry.version}\` |`,
    `| \`journey_registry_version\` | \`${registry.journeyRegistryVersion}\` |`,
    `| \`evidence_root\` | \`${path.relative(ROOT, evidenceDir)}\` |`,
    `| \`current_phase\` | \`Batch 0 inventory bootstrap completed\` |`,
    '',
    '## 当前范围',
    '',
    `- Web standalone routes: \`${registry.counts.webStandaloneRoutes}\``,
    `- Mobile standalone routes: \`${registry.counts.mobileStandaloneRoutes}\``,
    `- Capabilities: \`${registry.counts.capabilityEntries}\``,
    `- Journey overlay: \`${registry.counts.journeyOverlayEntries}\``,
    '',
    '## Batch 状态',
    '',
    '| batch | status | 说明 |',
    '| --- | --- | --- |',
    '| Batch 0 | `PASS` | Inventory / triage / registry / templates 已建立 |',
    '| Batch 1 | `OPEN` | Applicant Web + Auth 待执行 |',
    '| Batch 2 | `OPEN` | Applicant AI + 留学业务待执行 |',
    '| Batch 3 | `OPEN` | Mobile 全面检查待执行 |',
    '| Batch 4 | `OPEN` | Admin / Data / Security / MCP 待执行 |',
    '| Batch 5 | `OPEN` | 闭环复核待执行 |',
    '',
    '## Stop Condition',
    '',
    `- ${registry.counts.webStandaloneRoutes} 个 web route 条目全部有非空状态与证据`,
    `- ${registry.counts.mobileStandaloneRoutes} 个 mobile route 条目全部有非空状态与证据`,
    `- ${registry.counts.webShellArtifacts} 个 web shell artifacts 已作为对应 route 的 supportingShells 被显式检查`,
    `- ${registry.counts.mobileShellArtifacts} 个 mobile shell artifacts 已作为对应 route 的 supportingShells 被显式检查`,
    `- ${registry.counts.capabilityEntries} 个 capability 条目全部有非空状态与证据`,
    `- ${registry.counts.journeyOverlayEntries} 个 journey overlay 条目全部有非空状态与证据`,
    '- 每条都附四个质量维度结论和责任分类',
    '- 每个批次都已回填审计文档、复用文档和 MEMORY',
    '',
    '## Batch 0 已沉淀资产',
    '',
    '- Full surface registry（机器 + 文档）',
    '- Reuse playbook',
    '- Gap checklist',
    '- Route / capability / batch summary 模板',
    '- Evidence root manifest',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function renderEvidenceReadme(registry: FullSurfaceRegistry, auditDate: string) {
  const lines = [
    `# Full Surface Evidence · ${auditDate}`,
    '',
    '| key | value |',
    '| --- | --- |',
    `| full_surface_registry_version | \`${registry.version}\` |`,
    `| web_routes | \`${registry.counts.webStandaloneRoutes}\` |`,
    `| mobile_routes | \`${registry.counts.mobileStandaloneRoutes}\` |`,
    `| web_shell_artifacts | \`${registry.counts.webShellArtifacts}\` |`,
    `| mobile_shell_artifacts | \`${registry.counts.mobileShellArtifacts}\` |`,
    `| capabilities | \`${registry.counts.capabilityEntries}\` |`,
    `| journey_overlay | \`${registry.counts.journeyOverlayEntries}\` |`,
    '',
    '## 目录约定',
    '',
    '- 后续每个 surface 应写入 `e2e-report/full-surface-<date>/<surface-id>/`。',
    '- 进入态截图、结果态截图、错误态截图与关键请求/响应摘录遵循 surface template。',
    '- `manifest.json` 与 `inventory.json` 保存当前 bootstrap inventory；后续可用作执行基线。',
    '- `inventory.md` 提供给 Claude / Cursor / Codex 直接阅读，不必先打开 JSON。',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const registry = buildFullSurfaceRegistry();

  const registryMarkdown = renderRegistryMarkdown(registry, args.auditDate);
  const agentReviewMarkdown = renderAgentReviewMarkdown(registry, args.auditDate);
  const auditLogMarkdown = renderAuditLogMarkdown(registry, args.auditDate, args.evidenceDir);
  const evidenceReadme = renderEvidenceReadme(registry, args.auditDate);

  const docsTargets = {
    registry: path.join(args.docsDir, 'FULL_SURFACE_REGISTRY.md'),
    agentReview: path.join(args.docsDir, `FULL_SURFACE_AGENT_REVIEW_${args.auditDate}.md`),
    auditLog: path.join(args.docsDir, `FULL_SURFACE_AUDIT_LOG_${args.auditDate}.md`),
  };

  await ensureDir(args.evidenceDir);
  await writeText(docsTargets.registry, registryMarkdown);
  await writeText(docsTargets.agentReview, agentReviewMarkdown);
  await writeText(docsTargets.auditLog, auditLogMarkdown);
  await writeText(path.join(args.evidenceDir, 'README.md'), evidenceReadme);
  await writeJson(path.join(args.evidenceDir, 'manifest.json'), registry);
  await writeJson(path.join(args.evidenceDir, 'inventory.json'), registry);
  await writeText(path.join(args.evidenceDir, 'inventory.md'), registryMarkdown);
  await writeJson(path.join(args.evidenceDir, 'route-inventory.json'), registry.routeInventory);
  await writeJson(
    path.join(args.evidenceDir, 'capability-inventory.json'),
    registry.capabilityInventory
  );
  await writeJson(path.join(args.evidenceDir, 'journey-overlay.json'), registry.journeyOverlay);

  process.stdout.write(
    [
      `Generated full-surface audit assets for ${args.auditDate}`,
      `- ${path.relative(ROOT, docsTargets.registry)}`,
      `- ${path.relative(ROOT, docsTargets.agentReview)}`,
      `- ${path.relative(ROOT, docsTargets.auditLog)}`,
      `- ${path.relative(ROOT, path.join(args.evidenceDir, 'manifest.json'))}`,
      `- ${path.relative(ROOT, path.join(args.evidenceDir, 'inventory.json'))}`,
      `- ${path.relative(ROOT, path.join(args.evidenceDir, 'inventory.md'))}`,
    ].join('\n')
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

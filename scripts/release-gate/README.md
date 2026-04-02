# Release Gate Scripts

## 目标

把发版门禁从“文档规范”变成“Codex 可直接执行”的脚本链。

## 组成

- `registry.ts`
  - 机器可读旅程注册表
  - active set / baseline smoke / human task / external prerequisite 定义
- `impact-mapping.ts`
  - 代码改动到 `journey_id` 的映射规则
- `generate-release-gate.ts`
  - 从 `git diff` 或显式 changed files 生成一轮 release gate package
- `../runtime-release-gate.ts`
  - 读取 `codex-run-config.json`，执行 runtime audit，并把结果回填到 release gate package
- `../runtime-journey-audit.ts`
  - 通用 runtime audit engine
  - 通过 `RUNTIME_AUDIT_ID`、`RUNTIME_AUDIT_CONTEXT`、`RUNTIME_EVIDENCE_ROOT` 参数化执行

## 生成命令

```bash
pnpm release-gate:generate \
  --release-id 2026-04-rc1 \
  --candidate-version web-2026.04.01-rc1 \
  --environment pre-release
```

如果要复用某次历史 evidence root，可以额外传：

```bash
pnpm release-gate:generate \
  --release-id 2026-04-rc1 \
  --runtime-audit-id 2026-03-31 \
  --runtime-audit-context "2026-03-31 runtime audit" \
  --runtime-evidence-root e2e-report/journeys-2026-03-31
```

默认会读取：

- `git diff HEAD~1 HEAD`
- `scripts/release-gate/registry.ts`
- `scripts/release-gate/impact-mapping.ts`

输出目录默认是：

```text
e2e-report/releases/<release-id>/
```

## 输出内容

- `impact-set.json` / `impact-set.md`
- `release-gate-master.md`
- `codex-run-plan.md`
- `codex-run-config.json`
- `run-codex-audit.sh`
- `human-task-cards/*.md`
- `codex-runtime-result.json` / `codex-runtime-result.md`（执行后生成）
- `human-handoff.md`（执行后生成）
- `user-journey-audit-section.md`（执行后生成，可直接追加到 `docs/USER_JOURNEY_AUDIT_LOG.md`）
- 以上产物会自动带出 journey-level external prerequisites / capability gates

## 说明

- `run-codex-audit.sh` 现在调用：
  - `scripts/runtime-release-gate.ts`
- 该脚本默认再调用：
  - `scripts/runtime-journey-audit.ts`
- `scripts/runtime-journey-audit-2026-03-31.ts` 仍保留，但只作为兼容 wrapper。

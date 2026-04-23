# Competitor Benchmark Runbook

> 范围：内部 `External Competitor Benchmark` pilot  
> 目的：获取竞品页面展示的**录取率 / 概率**，并与本系统预测做逐校对比

## 1. 这套功能做什么

- 读取一个标准化 benchmark profile
- 复用人工导出的 Playwright `storageState.json`
- 打开竞品页面，抓每所学校的录取率 / probability
- 与本系统当前 served 预测对齐，生成 diff report

**不做**：

- 自动登录
- 验证码自动处理
- 账号池
- 将竞品概率展示给终端用户

## 2. 准备 storageState.json

1. 在本地 Playwright / 浏览器环境里手动登录竞品站点
2. 导出对应 session 的 `storageState.json`
3. 在 Admin `External Benchmark` tab 或 API 上传到：
   `POST /api/v1/admin/predictions/benchmark/sources/:key/session`

保存位置默认是：

- `apps/api/.secrets/competitor-benchmark/<sourceKey>.storageState.json`

该目录必须 gitignored，不入库。

## 3. 创建 Benchmark Profile

`BenchmarkProfile.profileJson` 使用规范化快照，而不是直接引用真实 `Profile` relation。

最小字段建议：

- `applicationRound`
- `targetMajor`
- `isInternational`
- `nationality`
- `gpa`, `gpaScale`
- `testScores`
- `activities`
- `awards`

## 4. 发起 Run

两种方式：

- Admin：`/admin/calibrations` → `External Benchmark`
- CLI：

```bash
pnpm --filter api benchmark:run --profile=<id> --source=<key> [--limit=N] [--headed]
```

运行前需要：

- `BENCHMARK_ENABLED=true`
- 有可用的 source session（mock source 除外）

## 5. 如何读报告

每行重点字段：

- `oursProbability`：我们的录取率预测
- `theirsProbability`：竞品页面明确给出的录取率
- `delta`：`ours - theirs`
- `oursTier` / `theirsTier`
- `matchStatus`

汇总指标：

- `MAE`：只统计双方都有明确概率的 matched 行
- `tier agreement`：双方都有 tier 即可统计
- `coverage gap`：竞品学校无法对齐到我方 `School`

## 6. 只有档位没有百分比时怎么办

如果竞品页面没有明确概率，只给 `reach / match / safety` 或文案：

- 保留该行
- 标记为 `matched-tier-only`
- 不参与 `MAE` 和平均 `delta`
- 仍参与 `tier agreement` 与 coverage 统计

**不要**把档位硬映射成百分比。

## 7. 常见失败原因

- `session missing`：没有上传 `storageState.json`
- `session expired`：页面跳回登录态，需要重新导出 session
- `coverage gap`：竞品学校名无法匹配到本系统 `School`
- `adapter error`：该 source adapter 解析页面失败

## 8. 运营侧 SOP

1. 上传或选择标准 benchmark profile
2. 上传最新 `storageState.json`
3. 先用 `limit=10` 做 smoke run
4. 确认页面能拿到**明确录取率**
5. 再跑全量或更高上限
6. 下载 CSV 交给模型对齐 / 校准讨论

## 9. CollegeVine（`sourceKey=collegevine`）

**前置**（在 collegevine.com 上完成，非本系统自动写入）：

1. 用与 benchmark 意图一致的账号登录，完成 **Chancing profile**（GPA、标化、活动等）。
2. 在 **Schools hub**（`/schools/hub`）把要对标的学校加进列表（列表为空则 adapter 会报错退出）。
3. 确认 hub 上能看到各校的 **Your chances** 百分比（或等价数据），而非仅学校整体录取率。
4. 用 Playwright 或浏览器扩展导出该域名的 `storageState.json`，通过 Admin 或 API 上传到 `collegevine` source。

**本系统行为**：

- `baseUrl` 固定为 `https://www.collegevine.com/schools/hub`。
- `applyProfile` 会 **reload** 页面并等待 `…/schools/hub/data/chances-and-financials` 返回 **JSON**；从响应体解析学校与个人概率（解析逻辑见 `collegevine-hub-data.ts`，若 CollegeVine 改版可能需要调整）。
- `iterateSchools` / `fetchPrediction` 使用解析结果，**不再**对每校单独打开 SDP。

**若失败**：

- 超时：多为未登录、hub 未加载、或接口路径变更。
- JSON 为空：hub 学校列表为空或 chancing profile 未完成。
- 概率全空但有名：仍会写入 `TIER_ONLY` 或后续人工对照；检查响应里概率字段名是否变化。

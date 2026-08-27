# 共享学校分析：实测与发布阻断记录

状态：候选实现已提交至 [PR #633](https://github.com/ywutian/study-abroad-platform/pull/633)，默认启用与生产发布均未通过。本文不是录取命中率报告。

## 实现与来源

运行源码：`e71d62cabb88c553f63a2aebd4faf9e83fb07583`。复用现有 Profile → LLMService → ModelRouter → OpenAI-compatible 接口；同运行每两校共享公共事实，五校分组为 2/2/1，再生成组合分析。保持原 24k-token/120s 运行预算、权限、概率和证据归属。未新增 Agent 系统或数据库模型。

已修复两个机制问题：不同学校持久化耗时会拆散后续批次；底层 fetch/read/cancel 不响应 AbortSignal 时可能超过截止时间。对应回归均先红后绿。对于损坏的模型输出，严格校验仍拒绝，不通过拆组重试或宽松解析掩盖失败。

设计参考：[OpenAI 延迟优化](https://developers.openai.com/api/docs/guides/latency-optimization)建议减少不必要的重复请求；[Structured Outputs 文档](https://developers.openai.com/api/docs/guides/structured-outputs)不保证事实正确，因此仍保留应用层校验；[评测实践](https://developers.openai.com/api/docs/guides/evaluation-best-practices)支持覆盖典型、边界和对抗输入，而不是凭一次演示发布。

## 真实模型评测

第三方 Relay、自报 `gpt-5.4`；合成数据，无数据库或业务工具写入。对照是**同模型 compact-single**，不是线上 DeepSeek 旧版本。48 种输入（1/2/3/5校 × 中英文 × 6类场景），计划每种重复3次，两个策略合计288个工作流。不是288名独立用户，也不是招生结果标注。

同源先导8个工作流：共享候选4/4完整，对照2/4，五校对照预算不足。扩大后，在160/288条已保存结果中出现候选硬失败，停止后续调用；在途请求用量未知。没有删除失败、补跑刷分或将未执行部分记为成功。

| 学校数 | 每策略已完成样本 | 对照完整 | 共享完整 | 对照/共享调用数每运行 | 对照/共享 tokens 中位数 | 对照/共享耗时中位数 |
| ------ | ---------------- | -------- | -------- | --------------------- | ----------------------- | ------------------- |
| 1      | 24               | 24/24    | 24/24    | 2 / 2                 | 8,132 / 8,121           | 16.81s / 16.06s     |
| 2      | 24               | 24/24    | 24/24    | 3 / 2                 | 12,702 / 9,286          | 17.05s / 24.82s     |
| 3      | 20               | 20/20    | 19/20    | 4 / 3                 | 17,431 / 14,160         | 27.98s / 35.12s     |
| 5      | 12               | 0/12     | 12/12    | 5 / 4                 | 21,935 / 19,874         | 28.25s / 49.94s     |

五校对照的5次请求没有完整生成组合结果，不能把其较短耗时称为更快完成任务。三校共享统计包含失败消耗。总体共享79/80完整，对照68/80；部分矩阵、停止规则和样本重复使这些比例不能直接外推到真实用户。共享降低多校请求数，但两校、三校更慢，不能声称普遍提速。

160条已保存运行合计462次请求、2,055,323个 accounted tokens（包含失败，不含探针、先导和中断时在途请求）；用量来自 Provider 报告或脚本的保守记账，不是账单。所有160条的原概率、档位、注入标记及百分号守卫通过；这不是全面事实正确证明。

### 阻断样例

`3-zh-missing:1:shared`：首个两校响应带 `finish_reason=stop`，但 JSON 损坏且缺少完整第二校。两校返回 `MODEL_ROUTING_OUTPUT_INVALID`，整体明确 `degraded`；后续学校仍完成，原概率不变。新增纯合成回归重现该传输形状，不保存原始模型内容。门禁按失败处理，不能把安全降级计为完整成功。

证据目录仅本机：`/tmp/analysis-compact.sr7xb7`（先导）、`/tmp/analysis-compact.ZSZx68`（停止的矩阵）。原始输出不入仓库，临时目录可能被系统清理。

- 矩阵 manifest SHA-256：`c45c6e043fcdfa7593ffb6976dccb2fecf2fc6ca46f5e5cf32e0c3d88f4ff14a`
- 停止后结果 SHA-256：`a59755c2091643626079e2dd0f3ae7125a542c39173e7909344cf726746c77a2`

早期失败证据保留在[变更闭环](../AI_ANALYSIS_RELEASE_2026-08-27.normalized.md)：持久化分组问题和网络错误版本没有被新结果覆盖。Codex生成并复核样例，独立人工专家审核=false。没有证据证明需要升级5.6，也没有证据证明录取预测准确率提高。

## 工程与发布状态

运行源码的定向回归5套件/112项、TypeScript、CI辅助脚本46项、36/36负向门禁证明及密钥扫描通过。新增坏JSON回归后，共享单元与集成2套件/23项通过。文档链接校验及20节闭环结构校验通过；结构通过不覆盖发布阻断。

运行源码的PR CI 33064075598：API 337套件/4,441项、Web 66文件/435项、Mobile 39套件/346项、Shared 21文件/399项通过，E2E、Prediction及Application Analysis Governance通过。文档检查发现9个指向不提交本地评测文件的链接，已改为明确本地名称，不提交原始文件、不削弱检查。最终修订CI另行绑定PR状态，不能用先前提交的通过冒充最终提交验证。

[只读生产核查](https://github.com/ywutian/study-abroad-platform/actions/runs/33064063846)，2026-08-27 10:41 UTC：

- `study-abroad-api-00992-zin` 占100%，OpenAI-compatible / `deepseek-v4-pro`，路由关闭。
- 最新创建的 `study-abroad-api-01003-por` 为官方 OpenAI / `gpt-4o-mini`；历史生产验收失败后已回滚，当前无生产流量。
- 日志检查为 `BLOCKED_READ_PERMISSION_OR_REQUEST`，空错误计数不表示没有错误。本机Google认证也需要交互式重新认证。
- 未部署本轮代码、未修改凭据、未修改IAM、未创建生产验收账号。生产Provider根因未确认，不能盲改Key/地址配对。全局地址变更还会影响既有Embedding调用。

发布流程已增加0流量完整Harness验收，再允许直接100%；仍保留100%后验收和原Revision回滚。依据[Cloud Run官方流量迁移说明](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration)，验证标签与实际用户流量分配分开处理。未通过真实候选门禁或生产前置检查时不发布。

## 下一步与责任

1. Codex：完成坏JSON回归、修复文档引用及最终PR CI；保持候选默认关闭，保留所有失败结论。
2. 用户/云管理员：恢复本机Google认证，或明确授权最小必要的日志读取访问；不需要提供密码或粘贴Token。Codex不自行扩权。
3. Codex：读取脱敏Provider错误，修复并验证根因。若调整模型、重试或批处理契约，必须新版本、重新先导和完整矩阵，不复用失败版本作为通过证据。
4. 仅在上述门禁通过后执行现有main流水线、0流量验收、100%切换、稳定URL验收、合成数据清理、独立告警、33项Cron/Scheduler、SQL备份/PITR及回滚Revision检查。

当前结论：工程改造可继续审查；候选默认启用 FAIL，生产发布 BLOCKED。不能承诺“没有问题”，也不能将这一阻断记录称为上线闭环完成。

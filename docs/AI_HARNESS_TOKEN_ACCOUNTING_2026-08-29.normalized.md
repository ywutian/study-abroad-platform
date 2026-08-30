# Harness Token 计量校正

<!-- section:change-identity -->

## 1. 变更身份

[REQUESTER] AI-HARNESS-TOKEN-ACCOUNTING-20260829。用户在4/6诊断报告后要求「减少重复输入、校正token预估和核验预算，不需要先换更贵的模型」，随后确认按「终态不丢答案 → 预留改真实计数」的顺序出最小改动，并追加要求一并修正上下文窗口预检。来源：AI_HARNESS_STREAM_RECOVERY_2026-08-27.normalized.md §15 [UNRESOLVED]。[RUNTIME] 状态LOCALLY VERIFIED，未进入CI、未发布、未复测业务完成率。

<!-- section:executive-summary -->

## 2. 摘要

[CODE] `AgentRunBudgetTracker.reserveLlmCall`、`workflow-budget.inputTokens`、`LLMService`上下文窗口预检均以`chars/3`估算输入。该系数是英文启发式：对o200k_base实测，中文散文0.42x、中文agent系统提示0.74x、工具结果JSON0.89x——即产品实际承载的三类输入全部低估。[RUNTIME] 后果是预留通过、Provider按真实用量计费、`settleLlmCall`在答案已完整生成且内容分片已推送给客户端之后抛出`AGENT_TOKEN_BUDGET_EXCEEDED`，Run判失败。[DECISION] 终态Solve/Revise结算改为记录超支而不抛；预留与预检改用真实token计数，并对计数本身做有界化。

<!-- section:current-state -->

## 3. 现状

[RUNTIME] 01014-liy 100%，GPT-5.4，路由关闭，24000 token/120000ms上限未变。上一轮6次Solve遥测为5 complete、1 `AGENT_TOKEN_BUDGET_EXCEEDED`；失败那条耗时36759ms、输出6445字节，是六条里输出最长的一条。原始失败证据与旧报告保留，不覆写。

<!-- section:target-outcome -->

## 4. 目标

[DECISION] 已完整生成且已送达的答案不因事后记账被判失败；预留不再对中文与工具JSON系统性低估。不提高`AI_AGENT_MAX_TOKENS_PER_RUN`，不忽略结算失败，不把未完成的流算作成功。

<!-- section:scope -->

## 5. 范围

[DECISION] 仅`ai-agent/core`的预算计量路径与`LLMService`上下文窗口预检。新增内部工具模块`token-estimate.ts`。无数据库、前端、移动端、配置预算、模型、Provider、权限或Skill版本变更；不新增依赖（`js-tiktoken`已在`apps/api`依赖内，且已被`TokenTrackerService`使用）。

<!-- section:users-permissions -->

## 6. 权限

[REQUESTER] 无权限面变更。未新增端点、未改审批语义、未扩大工具集。

<!-- section:user-flows -->

## 7. 流程

[DECISION] Solve/Revise流正常结束 → 结算 → 若最终用量超过Run预算，记录超支原因码并照常发送`done`。超支写入`estimatedTokens`，使`remainingTokens()`归零，后续任何`reserveLlmCall`继续抛错、可选核验继续走既有`skip_insufficient_budget`降级。流未完成（缺终态、中途error、tool_call、协议失败）仍不发`done`，与原行为一致。

<!-- section:requirements -->

## 8. 需求

- FR-001：[DECISION] 终态Solve/Revise结算超支时不抛，改为返回原因码；记账照常写入，后续调用仍失败关闭。仅在源流已产生可信终态时可达。
- FR-002：[DECISION] 预留、结算兜底与上下文窗口预检使用o200k_base真实token计数，不再使用`chars/3`。
- FR-003：[DECISION] token计数对任意输入必须是输入长度的线性开销，且不得低估。
- NFR-001：[REQUESTER] 遥测保留可区分的原因码，超支以`outcome=complete` + `reasonCode=AGENT_TOKEN_BUDGET_EXCEEDED`记录；不记录正文。

<!-- section:acceptance -->

## 9. 验收

- AC-001 / FR-001：完整流+超预算最终usage仍产出`content`与`done`、无`error`；随后`remainingTokens()`为0且再次预留抛`AGENT_TOKEN_BUDGET_EXCEEDED`；缺终态/协议失败/部分内容后失败仍不发`done`。
- AC-002 / FR-002：同一段中文输入的预留token高于`chars/3`；超长中文输入被上下文窗口预检拒绝，而`chars/3`会放行。
- AC-003 / FR-003：对病态输入（单一字符长串）计数耗时有界，不阻塞事件循环。
- AC-004 / NFR-001：超支路径的遥测为`complete` + `AGENT_TOKEN_BUDGET_EXCEEDED`。
- AC-005：完整API回归、TypeScript、API quality、verify-gate全绿。

<!-- section:technical-impact -->

## 10. 技术影响

[CODE] 新增`core/token-estimate.ts`：进程内按编码名共享的`Tiktoken`实例 + `countTokens`。共享是必需的——实测第二个`o200k_base`实例额外占用约63MB堆，因此`TokenTrackerService`改为从同一张表取encoder，不再各自`getEncoding`。[DECISION] 每次预留会对系统提示与各条消息编码一次，中文长提示约200–400ms，相对45秒量级的Run可接受；不加缓存，直到有实测需要。

<!-- section:nonfunctional -->

## 11. 安全与质量

[CODE] `js-tiktoken`对单个pre-token执行O(n²)的BPE合并：实测56KB工具JSON 32ms、44KB中文散文264ms，但42000个重复字符约110秒并阻塞事件循环。该输入可由一段base64或压缩文本粘贴触达`@ThrottleAI`路由，属可达的服务可用性风险。[DECISION] 计数改为按1000字符切片编码：开销随输入线性，且切片只会抬高计数——边界处丢失的合并不会变成新增的合并——对预算闸门是安全方向。实测真实提示上多算约1%，病态输入最坏从约110秒降到1.8秒。

[DECISION] 不用字符启发式替代编码器：同一批样本上，最好的一版仍在0.29x（base64）到2.16x（英文散文）之间，且工具JSON仍为0.91x低估。该结论写入`token-estimate.ts`注释，避免重复尝试。编码器加载失败时才回落到字符启发式。

<!-- section:observability -->

## 12. 可观测性

[DECISION] `SolveStreamEvidence`字段不变。超支不再表现为`outcome=failed`，而是`outcome=complete` + `reasonCode=AGENT_TOKEN_BUDGET_EXCEEDED`，据此可以把「答案送达但超预算」与「流失败」分开统计。该原因码只进日志，不进任何面向用户的响应。

<!-- section:test-plan -->

## 13. 测试

[DECISION] 定向验证四条：终态超支仍送达并随后失败关闭、中文预留高于`chars/3`、超长中文被预检拒绝、超支遥测原因码。随后跑ai-agent全模块、完整API回归、两套TypeScript工程与verify-gate。

<!-- section:rollout -->

## 14. 发布与回滚

[RUNTIME] 未发布。改动停留在工作区，未提交、未进CI、未部署。回滚即撤销工作区改动。发布仍应走既有main CI与零流量验收流程。

<!-- section:risks-dependencies -->

## 15. 风险

[ASSUMPTION] 切片计数在真实提示上多算约1%，属安全方向，但会让预留略早触发拒绝；这正是把失败从「花完钱之后」前移到「花钱之前」的预期效果。

[UNRESOLVED] 本次不改变Agent回答质量，因此不能据此宣称完成率改善；冻结的两道选校题需要重跑才能判定。用户提出的「减少重复输入」仍未做——本次先把计量修正，使输入是否真的过大有了可信数字，再决定是否压缩。

[CODE] `TokenTrackerService.countTokens`（成本上报路径）仍直接调用`encoder.encode`，同样暴露于O(n²)风险，本次未改，因为它不在预算闸门上且改动面更大。

<!-- section:open-decisions -->

## 16. 决策

[DECISION] 上一轮AC-003「超过usage或时限不出现done」被本次有意收窄：该条要防的是「把部分输出算成功」，而终态超支是完整终态+可信usage，两者不同。流不完整仍不发`done`，由既有`missing-terminal`/`partial`用例继续钉住。旧报告与旧normalized文档保留原状，不回改历史。

[DECISION] 不上调Run/Provider配置上限；不为绕过闸门放宽切片或阈值。

<!-- section:implementation-plan -->

## 17. 实施计划

[DECISION] 度量确认低估方向 → 终态结算不抛 → 预留改真实计数 → 发现并修复O(n²) → 预检一并改 → 重标按字符定尺的测试夹具 → 全量回归与门禁。

<!-- section:implementation-summary -->

## 18. 实施结果

[CODE] 新增`core/token-estimate.ts`：`getSharedEncoding`（按编码名共享实例）+ `countTokens`（1000字符切片编码，失败回落字符启发式）。

[CODE] FR-001：`AgentRunBudgetTracker.settleTerminalLlmCall`包裹`settleLlmCall`，超支返回原因码而不抛；记账在抛错前已写入，故`remainingTokens()`归零、后续失败关闭不受影响。`harness-solve-stream.ts`在源流结束后改调该方法，`emit('complete', overrun ?? 'OK')`。

[CODE] FR-002/003：`reserveLlmCall`、`settleLlmCall`的输出兜底、`workflow-budget.inputTokens`、`LLMService`上下文窗口预检改用`countTokens`；预检的用户可见文案由`~N tokens`改为`N tokens`。`TokenTrackerService.onModuleInit`改用`getSharedEncoding`。

[CODE] 测试夹具重标：多处用例按字符数对齐旧的`chars/3`，而`'x'`在o200k下约8字符/token。`workflow-budget.spec.ts`的证据填充由`'x'.repeat(n)`改为按token定尺的中文串（42000/66000/90000字符 → 14000/21000/30000 token，该套件耗时同时由40s降到3.9s）；`workflow-budget-helper.spec.ts`的`5000/600/400`改为由`countTokens`推导；`harness-solve-*.spec.ts`的`515`写成`2 + 512`以显出输入/输出构成；`agent-run-context.spec.ts`的`'x'.repeat(2400)`改为`6000`以维持原意。

<!-- section:verification -->

## 19. 验证证据

[RUNTIME] AC-001至004 PASS：新增/改写的定向用例覆盖终态超支送达、中文预留高于`chars/3`、超长中文被预检拒绝、超支遥测原因码。ai-agent模块104 suites/1064 tests PASS。

[RUNTIME] AC-005 PASS：完整API回归353 suites/4641 tests PASS（较上一轮4639增加2条新用例）；`tsc --noEmit`在`tsconfig.build.json`与含spec的工程上均为0错误；`lint:quality`通过；`verify-gate`报typecheck:api与test:api全绿。

[RUNTIME] ESLint对改动文件报4条`simple-import-sort`警告；对HEAD版本复跑得到同样4条，确认为既有项，未在本次修复以免引入无关改动。

[RUNTIME] 性能数据为本机实测：切片后56KB工具JSON 32ms、44KB中文散文264ms、42000重复字符1.8秒；第二个o200k_base实例额外约63MB堆。

<!-- section:release-decision -->

## 20. 结论

[DECISION] 本地验证CLOSED，发布NOT STARTED。本次修正的是计量与终态判定，不构成Agent回答质量或选校完成率的改善证据；冻结的两道题需在发布后重跑才能判定。上一轮报告中的4/6结论继续有效，未被本次改动推翻。

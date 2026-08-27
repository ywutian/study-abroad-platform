# AI 模型与分段使用方案

本地推荐策略：[`examples/ai-task-routing.recommended.json`](examples/ai-task-routing.recommended.json)。这是可装载的服务端策略，不会自动启用或部署；本轮未改 `.env`、生产配置或凭据。

## 怎么分配

| 功能                                     | 推荐使用                      | 依据与边界                                                   |
| ---------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| 单校申请分析                             | GPT-5.4，`none`，默认单段     | 分段更快但完整成功率未达对照，暂不默认启用                   |
| 多校申请分析                             | GPT-5.4，`none`，每校单段     | 重复上下文会消耗预算，不对每个学校机械拆段                   |
| 组合结论与行动计划                       | GPT-5.4，`none`，默认单段     | 30秒分组deadline，沿用既有运行预算                           |
| 单条记忆抽取                             | GPT-5.4，`none`，500输出token | 实际Summarizer回放20/20；本次不启用Luna                      |
| 一般问答、最终回答、摘要、推荐、文书讨论 | 现有5.4主、5.5备用映射        | 保留既有映射，不声称这些完整功能都已重新实测                 |
| 规划、补充规划、事实核验、纠错           | 保留5.5                       | 本轮没有足够真实工具任务证据支持降级型号                     |
| 录取概率                                 | 原确定性预测引擎              | 不让任何型号重新估概率；没有真实录取case，不能报告命中率提升 |

不默认使用5.6 Luna/Terra/Sol。模型名称更大不是升级依据。5.4 mini此前Relay返回的实际型号与请求别名不一致，仍不放宽严格身份校验。

## 配置与回退

在受保护的服务端配置中启用 `AI_AGENT_MODEL_ROUTING_V1=true`，并将推荐JSON的完整内容放入 `AI_AGENT_MODEL_ROUTING_CONFIG`。沿用现有OpenAI-compatible地址与密钥，不把密钥写入策略文件，也不将策略交给客户端或Skill修改。

默认文件设置 `execution=single`。可选实验文件 [`examples/ai-task-routing.segmented-candidate.json`](examples/ai-task-routing.segmented-candidate.json) 设置 `execution=segmented` 与 `segmentationMaxSchools=1`：仅当本次分析一个重点学校时分段；不明数量或超过限制时单段。该候选未达到完整成功率门禁，不建议作为默认配置。单/多校均使用显式策略的deadline，但旧策略未配置execution时保留原12/15秒代码默认值。

`reasoningEffort` 只能选择模型声明支持的值，冻结到已有运行快照；调用者不能经providerOptions覆盖。声明支持不等于证明Relay底层执行了相同推理配置，只能确认请求合同与返回结果。

回退可恢复原JSON策略，或关闭全局路由开关。仅回退分段时，应删除 `execution` 和 `segmentationMaxSchools` 两个字段。已有运行仍遵循其冻结版本和当前安全白名单；不是修改策略就改写历史运行。

## 失败不伪装成功

- 任一片段非法、超时或超预算，整组采用原规则降级，不返回半截JSON，也不重跑已经成功的片段。
- 显式分析策略下，部分学校或组合分析失败也应显示 `degraded`，并保留原因与分段审计；没有模型生成的完整成功率另行统计。
- 24k是既有运行预算，不为分段放宽。5校大输入在当前Relay可能仍触发预算降级；这不是完整AI分析成功。并发请求的实际usage在返回后才知道，因此不能将本地预算宣称为严格计费上限。
- CoVE将“无法查证”和“确有矛盾”分开；缺字段、查库失败、数值单位不明、否定/范围表述不算验证通过。

## 验证与证据

2026-08-27新增紧凑输入候选：分析路由可选 `analysisOptimization: "compact-v1"`，必须同时明确配置 `execution`。它启用紧凑事实、严格Schema、组合预算预留和最多2校并发；**未通过真实小批完整成功门禁，不要加到默认推荐配置**。两个分析路由一起使用才有完整的组合预留效果。删除该字段恢复原输入/调度；若同时回退execution，必须先删除该字段。详见[紧凑输入验收](reports/AI_ANALYSIS_COMPACT_2026-08-27.md)。

评测脚本默认dry-run：`pnpm --filter api exec tsx scripts/ai-segmented-analysis-eval.ts` 和 `pnpm --filter api exec tsx scripts/ai-memory-model-eval.ts`。分析脚本用 `--recommended` 读取默认策略，`--candidate` 读取可选分段策略，`--case=mixed` 限定混合档位场景。真实调用必须显式 `--live`、指定临时证据目录，并从隐藏输入传入已授权凭据；仅使用脚本内合成夹具，不连接数据库。

详细结果、首轮失败和推荐策略复测见 [`reports/AI_SEGMENTED_ANALYSIS_2026-08-26.md`](reports/AI_SEGMENTED_ANALYSIS_2026-08-26.md)。测试是小样本工程验收，不是独立招生专家评测、模型通用排名、生产SLA或录取准确率证明。

显式固定推理强度并做任务级评测符合[官方模型迁移指导](https://developers.openai.com/api/docs/guides/latest-model)。官方模型文档不能证明第三方Relay的实际底层型号或计费。

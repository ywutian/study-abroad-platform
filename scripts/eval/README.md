# AI Agent 离线评测框架

## 三层评测策略

| 层级     | 命令                                           | 测什么                            | 成本     | CI     |
| -------- | ---------------------------------------------- | --------------------------------- | -------- | ------ |
| **MVP1** | `--mode=fixtures`                              | JSON 合规 + 字段完整性 + 路由断言 | 零       | 可集成 |
| **MVP2** | Jest mock (见 workflow-engine.service.spec.ts) | Plan 解析 / 路由准确率            | 零       | 已集成 |
| **MVP3** | `--mode=live --sample=10`                      | 端到端路由 + 回复质量             | ~$0.5/次 | 手动   |

## 使用方法

```bash
# MVP1: 纯规则检查（不调模型，CI 可用）
npx tsx scripts/eval/run-eval.ts --mode=fixtures --verbose

# MVP3: 真模型小样本（需要 LLM API，手动触发）
npx tsx scripts/eval/run-eval.ts --mode=live --sample=5
```

结果保存在 `scripts/eval/results/` 目录。

## 数据集

`dataset.json` 包含 15 条种子评测用例，覆盖 8 个场景类别：

1. **工具路由准确性** (P0) — 期望 tool 调用 vs 实际 tool 调用
2. **截止日期准确性** (P0) — 与学校官网核对
3. **选校推荐合理性** (P1) — tier 分布、专业匹配
4. **概率校准** (P1) — 与历史录取数据对比
5. **国际生特殊情况** (P1) — need-blind/aware 准确性
6. **JSON 格式合规** (P1) — extractJsonFromLlm 是否成功
7. **文书指导** (P2) — prompt 解读正确性
8. **术语准确性** (P2) — EA/REA/SCEA 区分

后续目标：扩展到每类 10 条，共 80 条。

## Bad Case 分类体系

```
ROUTING_ERROR（路由错误）
├── WRONG_AGENT     — 委派到错误 Agent
├── WRONG_TOOL      — 选错工具
├── MISSING_TOOL    — 遗漏必要工具
└── REDUNDANT_TOOL  — 不必要调用

FORMAT_ERROR（格式错误）
├── JSON_PARSE_FAIL — JSON 解析失败
├── MISSING_FIELD   — 缺必要字段
└── WRONG_TYPE      — 字段类型错误

HALLUCINATION（幻觉）
├── FAKE_SCHOOL     — 推荐不存在的学校
├── FAKE_DATA       — 编造排名/录取率
└── FAKE_PROGRAM    — 推荐不存在的项目

QUALITY_ERROR（质量）
├── SHALLOW         — 未使用工具结果
├── WRONG_LANGUAGE  — 语言不匹配 locale
└── IGNORED_CONTEXT — 忽略用户档案关键信息
```

## 已知限制

- **中文 FTS**：当前使用 PostgreSQL `'simple'` 分词配置，仅按空格/标点分词。中文查询需应用层预处理（如插入空格）。后续可升级 `zhparser` 扩展。
- **MVP3 live 模式**：尚未实现 LLM API 对接，当前为占位逻辑。

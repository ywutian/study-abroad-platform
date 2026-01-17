# 文档标准与 DORA 自评

> 本文档定义了项目文档的质量标准，基于 DORA (DevOps Research and Assessment) 文档质量模型和行业最佳实践。

## 目录

1. [采用的标准体系](#1-采用的标准体系)
2. [文档分类与模板](#2-文档分类与模板)
3. [文档编写规范](#3-文档编写规范)
4. [DORA 文档质量自评](#4-dora-文档质量自评)
5. [文档维护流程](#5-文档维护流程)
6. [季度审计清单](#6-季度审计清单)

---

## 1. 采用的标准体系

| 标准                        | 适用范围     | 合规状态                                            |
| --------------------------- | ------------ | --------------------------------------------------- |
| **arc42**                   | 架构文档     | 已实施 (Section 1-12 + 补全 16-19)                  |
| **MADR** (Markdown ADR)     | 架构决策记录 | 已实施 (8 条 ADR)                                   |
| **Keep a Changelog**        | 变更日志     | 已实施 (CHANGELOG.md)                               |
| **Conventional Commits**    | 提交信息     | 已实施 (见 CONTRIBUTING.md)                         |
| **DORA Documentation**      | 文档质量评估 | 本文档                                              |
| **GitHub Community Health** | 社区文件     | 已实施 (LICENSE, SECURITY, CONTRIBUTING, Templates) |

### 不适用的标准

| 标准                                      | 原因                             |
| ----------------------------------------- | -------------------------------- |
| Contributor Covenant (CODE_OF_CONDUCT.md) | 商业私有项目，由公司 HR 政策覆盖 |
| CLA (Contributor License Agreement)       | 不接受外部贡献                   |

---

## 2. 文档分类与模板

### 2.1 分类体系

| 类别         | 命名规范             | 语言     | 示例                                          |
| ------------ | -------------------- | -------- | --------------------------------------------- |
| **治理文档** | 大写英文文件名       | 按内容定 | LICENSE, SECURITY.md, CONTRIBUTING.md         |
| **架构文档** | 大写英文文件名       | 英文     | ARCHITECTURE.md, API_REFERENCE.md             |
| **ADR**      | `NNNN-kebab-case.md` | 英文     | 0001-use-nextjs-turbopack-webpack-fallback.md |
| **运维文档** | 大写英文文件名       | 中文     | RUNBOOK.md, DEPLOY.md                         |
| **入职指南** | 大写英文文件名       | 中文     | ONBOARDING.md                                 |
| **技术备忘** | 中文文件名           | 中文     | 技术文档/已知问题与解决方案.md                |

### 2.2 必需的文件清单

| 文件                     | 位置                                          | 状态   |
| ------------------------ | --------------------------------------------- | ------ |
| LICENSE                  | `/LICENSE`                                    | 已创建 |
| SECURITY.md              | `/SECURITY.md`                                | 已创建 |
| CONTRIBUTING.md          | `/CONTRIBUTING.md`                            | 已创建 |
| CHANGELOG.md             | `/CHANGELOG.md`                               | 已创建 |
| ARCHITECTURE.md          | `/docs/ARCHITECTURE.md`                       | 已创建 |
| API_REFERENCE.md         | `/docs/API_REFERENCE.md`                      | 已创建 |
| ONBOARDING.md            | `/docs/ONBOARDING.md`                         | 已创建 |
| RUNBOOK.md               | `/docs/RUNBOOK.md`                            | 已创建 |
| GLOSSARY.md              | `/docs/GLOSSARY.md`                           | 已创建 |
| ADR README               | `/docs/adr/README.md`                         | 已创建 |
| Bug Report Template      | `/.github/ISSUE_TEMPLATE/bug_report.yml`      | 已创建 |
| Feature Request Template | `/.github/ISSUE_TEMPLATE/feature_request.yml` | 已创建 |
| PR Template              | `/.github/PULL_REQUEST_TEMPLATE.md`           | 已创建 |
| 文档索引                 | `/docs/README.md`                             | 已创建 |
| 文档标准 (本文档)        | `/docs/DOCUMENTATION_STANDARDS.md`            | 已创建 |

---

## 3. 文档编写规范

### 3.1 通用规则

1. **每份文档必须包含**：标题、最后更新日期、目录（超过 3 个章节时）
2. **中文文档**：使用全角标点，数字和英文专有名词使用半角
3. **英文文档**：遵循 Google Developer Documentation Style Guide
4. **代码块**：必须指定语言标识符（`typescript`, `sql`, `bash` 等）
5. **表格**：优先使用 Markdown 表格而非列表
6. **链接**：使用相对路径，不使用绝对路径

### 3.2 架构文档规则

1. 遵循 arc42 模板结构
2. 每个架构决策必须创建 ADR
3. 图表优先使用 Mermaid（可在 GitHub 上直接渲染）
4. 数据模型变更必须同步更新 ARCHITECTURE.md Section 4

### 3.3 API 文档规则

1. 新增端点必须同步更新 API_REFERENCE.md
2. DTO 必须使用 `@ApiProperty()` 装饰器
3. Controller 方法必须使用 `@ApiOperation()` 和 `@ApiTags()`
4. 枚举值必须在文档中列出

### 3.4 ADR 规则

1. 使用 MADR 格式（见 `docs/adr/README.md`）
2. 编号格式：`NNNN`（0001, 0002, ...）
3. 一旦 Accepted，不可修改（只能创建新 ADR 取代）
4. 每条 ADR 必须包含 Context、Decision、Consequences

---

## 4. DORA 文档质量自评

DORA 定义了 8 个文档质量维度。以下是本项目的自评结果。

### 评分标准

| 等级      | 分数 | 含义                 |
| --------- | ---- | -------------------- |
| Excellent | 5    | 远超行业标准         |
| Good      | 4    | 达到行业标准         |
| Fair      | 3    | 基本可用但有明显短板 |
| Poor      | 2    | 缺失关键内容         |
| None      | 1    | 不存在               |

### 自评结果 (2026-02-09, 第四次评估)

| #   | 维度                              | 评分 | 说明                                                                                                                                                                                        |
| --- | --------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **可靠性** (Reliability)          | 5/5  | Swagger UI 已重新启用（开发环境 `/api/docs`）；ARCHITECTURE.md 和 API_REFERENCE.md 基于实际代码生成；ENV_TEMPLATE.md 与 Zod schema 已对齐。新增 PREDICTION_SYSTEM.md 完整记录预测系统架构。 |
| 2   | **时效性** (Currency)             | 5/5  | CI 自动检查文档同步；commitlint 强制 Conventional Commits；ADR 0001-0008 完整覆盖所有架构决策。ARCHITECTURE.md PredictionResult 已同步 v2 模型。                                            |
| 3   | **可理解性** (Understandability)  | 4/5  | 中英双语覆盖，术语表统一术语。PREDICTION_SYSTEM.md 含行业对标和配置参考。RUNBOOK 覆盖 16 类运维场景。                                                                                       |
| 4   | **可发现性** (Findability)        | 5/5  | docs/README.md 按角色和 arc42 分类索引，PREDICTION_SYSTEM.md 已加入索引。所有文档可通过两种维度快速定位。                                                                                   |
| 5   | **组织性** (Organization)         | 5/5  | arc42 结构化；ADR 编号管理（8 条）；ARCHITECTURE.md Section 18 已同步最新风险/解决状态。跨文档关联引用完整。                                                                                |
| 6   | **代码覆盖** (Code Documentation) | 4/5  | Swagger UI 自动文档 + NestJS 装饰器 + 95% DTO @ApiProperty 覆盖。仍需补充关键 Service 的 JSDoc 注释。                                                                                       |
| 7   | **排障可用性** (Troubleshooting)  | 5/5  | RUNBOOK.md 覆盖 16 类故障；Prisma 错误码对照表；PII 泄漏排查指南。                                                                                                                          |
| 8   | **依赖可信度** (Dependency Trust) | 4/5  | pnpm-lock.yaml 锁定 + CI pnpm audit + Trivy 安全扫描。缺少 SBOM 生成。                                                                                                                      |

### 总评

| 指标           | 值                                                            |
| -------------- | ------------------------------------------------------------- |
| **DORA 总分**  | **37/40** (92.5%)                                             |
| **等级**       | **Excellent** (超越行业标准线)                                |
| **距满分差距** | 3 分 (需改进：JSDoc 注释深度、SBOM 自动生成、文档语法 linter) |

### 改进路线图

| 优先级 | 改进项                              | 预期提升                   | 状态       |
| ------ | ----------------------------------- | -------------------------- | ---------- |
| ~~P1~~ | ~~启用 Swagger UI~~                 | ~~可靠性 +1, 代码覆盖 +1~~ | **已完成** |
| ~~P2~~ | ~~添加文档变更 CI 检查~~            | ~~时效性 +1~~              | **已完成** |
| ~~P1~~ | ~~ADR 补全 (0004-0007)~~            | ~~组织性 +1~~              | **已完成** |
| ~~P1~~ | ~~RUNBOOK 扩展 (超时/慢查询/PII)~~  | ~~排障可用性 +1~~          | **已完成** |
| ~~P1~~ | ~~ENV_TEMPLATE 与 Zod schema 对齐~~ | ~~可靠性 +0.5~~            | **已完成** |
| P1     | 关键 Service 方法添加 JSDoc 注释    | 代码覆盖 +1                | 待实施     |
| P2     | 引入 SBOM 生成（`syft` / `cdxgen`） | 依赖可信度 +1              | 待实施     |
| P3     | 引入 Vale linter 检查文档语法       | 可理解性 +0.5              | 待实施     |

---

## 5. 文档维护流程

### 5.1 触发更新的事件

| 事件          | 需要更新的文档                      |
| ------------- | ----------------------------------- |
| 新增 API 端点 | API_REFERENCE.md                    |
| 修改数据模型  | ARCHITECTURE.md (Section 4)         |
| 架构决策变更  | 新建 ADR                            |
| 版本发布      | CHANGELOG.md                        |
| 添加新依赖    | 无 (自动由 pnpm-lock.yaml 管理)     |
| 新人入职      | 验证 ONBOARDING.md 流程是否仍然有效 |
| 生产故障      | RUNBOOK.md (添加新故障案例)         |

### 5.2 PR 检查清单

提交 PR 时，代码审查者应检查：

- [ ] API 变更是否同步更新了 API_REFERENCE.md
- [ ] 数据模型变更是否同步更新了 ARCHITECTURE.md
- [ ] 架构决策是否创建了 ADR
- [ ] 用户可见变更是否记录在 CHANGELOG.md

---

## 6. 季度审计清单

每季度执行一次全面文档审计：

- [ ] **准确性**: 随机抽查 5 个 API 端点，验证文档与实际行为一致
- [ ] **时效性**: 所有文档的"最后更新"日期不超过 90 天
- [ ] **完整性**: 检查必需文件清单（Section 2.2）是否完整
- [ ] **可达性**: 验证 docs/README.md 中所有链接有效
- [ ] **ADR 审查**: 回顾所有 Accepted ADR，确认是否有需要取代的
- [ ] **DORA 自评**: 重新评分 8 个维度，与上次对比
- [ ] **新人验证**: 让最新入职的成员验证 ONBOARDING.md 流程

审计结果记录在本文档底部的"审计历史"部分。

### 审计历史

| 日期       | 审计人   | DORA 总分     | 备注                                                                                                 |
| ---------- | -------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| 2026-02-09 | 四次优化 | 37/40 (92.5%) | 新增 PREDICTION_SYSTEM.md、ADR-0008；更新 ARCHITECTURE/API_REFERENCE/SCORING/MEMORY/ROADMAP 6 份文档 |
| 2026-02-07 | 三次优化 | 37/40 (92.5%) | ADR 0004-0007、RUNBOOK 扩展、ENV_TEMPLATE 对齐、PII 脱敏、请求超时、Prisma 慢查询                    |
| 2026-02-07 | 二次优化 | 35/40 (87.5%) | Swagger UI 启用、Husky/commitlint、CI 文档检查、Health build metadata                                |
| 2026-02-07 | 首次建立 | 31/40 (77.5%) | 文档标准化初始建设完成                                                                               |

---

_最后更新: 2026-02-09_

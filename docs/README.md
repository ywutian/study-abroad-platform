# 项目文档索引

> 留学申请平台文档中心 — 按角色和 arc42 架构分类

---

## 按角色快速入口

| 角色         | 首先阅读                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **新人**     | [ONBOARDING.md](ONBOARDING.md) → [QUICK_REFERENCE.md](QUICK_REFERENCE.md) → [ARCHITECTURE.md](ARCHITECTURE.md) → [CONTRIBUTING.md](../CONTRIBUTING.md) |
| **后端开发** | [ARCHITECTURE.md](ARCHITECTURE.md) → [API_REFERENCE.md](API_REFERENCE.md) → [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)                               |
| **前端开发** | [ARCHITECTURE.md](ARCHITECTURE.md) (Section 7) → [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)                                                                  |
| **运维**     | [RUNBOOK.md](RUNBOOK.md) → [DEPLOY.md](DEPLOY.md) → [ARCHITECTURE.md](ARCHITECTURE.md) (Section 12)                                                    |
| **产品经理** | [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) → [GLOSSARY.md](GLOSSARY.md)                                                                                  |
| **管理层**   | [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) → [INVESTOR_PITCH_AI_SYSTEM.md](INVESTOR_PITCH_AI_SYSTEM.md)                                                  |

---

## 按 arc42 架构模板分类

### 治理与流程

| 文档                                                     | 说明                        | 语言 |
| -------------------------------------------------------- | --------------------------- | ---- |
| [LICENSE](../LICENSE)                                    | 私有许可证                  | EN   |
| [SECURITY.md](../SECURITY.md)                            | 安全策略与漏洞上报          | EN   |
| [CONTRIBUTING.md](../CONTRIBUTING.md)                    | 开发规范与协作流程          | ZH   |
| [CHANGELOG.md](../CHANGELOG.md)                          | 变更日志 (Keep a Changelog) | ZH   |
| [ADR 目录](adr/)                                         | 架构决策记录 (MADR 格式)    | EN   |
| [DOCUMENTATION_STANDARDS.md](DOCUMENTATION_STANDARDS.md) | 文档元标准 (DORA 自评)      | ZH   |

### arc42 S1: 介绍与目标

| 文档                                     | 说明                         |
| ---------------------------------------- | ---------------------------- |
| [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) | 产品路线图与愿景             |
| [GLOSSARY.md](GLOSSARY.md)               | 业务和技术术语表 (arc42 S12) |

### arc42 S2-5: 架构约束、上下文、构建块

| 文档                                               | 说明                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| [ARCHITECTURE.md](ARCHITECTURE.md)                 | **核心** — 系统架构 (70 models, 29 enums, 400+ APIs, 15 sections + arc42 补全) |
| [API_REFERENCE.md](API_REFERENCE.md)               | API 端点参考 (32 controllers, 400+ endpoints)                                  |
| [SCORING_SYSTEM.md](SCORING_SYSTEM.md)             | 评分系统详细规范                                                               |
| [PREDICTION_SYSTEM.md](PREDICTION_SYSTEM.md)       | **预测系统技术文档 (v2 多引擎融合)**                                           |
| [COMPETITION_DATABASE.md](COMPETITION_DATABASE.md) | 竞赛数据库文档 (90+ 竞赛)                                                      |
| [DATA_SOURCES.md](DATA_SOURCES.md)                 | 数据来源 (College Scorecard API)                                               |

### arc42 S8: 横切关注点 — AI 系统

| 文档                                                             | 说明                    |
| ---------------------------------------------------------------- | ----------------------- |
| [AI_AGENT_ARCHITECTURE.md](AI_AGENT_ARCHITECTURE.md)             | AI Agent 架构设计       |
| [AI_AGENT_MEMORY_SYSTEM_SPEC.md](AI_AGENT_MEMORY_SYSTEM_SPEC.md) | AI Agent 记忆系统规范   |
| [ENTERPRISE_AI_SOLUTION.md](ENTERPRISE_AI_SOLUTION.md)           | 企业级 AI 解决方案      |
| [ENTERPRISE_MEMORY_SYSTEM.md](ENTERPRISE_MEMORY_SYSTEM.md)       | 企业级记忆系统          |
| [AGENT_ENTERPRISE_UPGRADE.md](AGENT_ENTERPRISE_UPGRADE.md)       | AI Agent 企业级升级计划 |

### arc42 S9: 运维与部署

| 文档                                  | 说明                       |
| ------------------------------------- | -------------------------- |
| [DEPLOY.md](DEPLOY.md)                | 部署指南 (Docker, Railway) |
| [RUNBOOK.md](RUNBOOK.md)              | 运维排障手册               |
| [ENV_TEMPLATE.md](../ENV_TEMPLATE.md) | 环境变量说明               |

### arc42 S10-11: 质量与风险

| 文档                                               | 说明                                   |
| -------------------------------------------------- | -------------------------------------- |
| [CODE_REVIEW.md](CODE_REVIEW.md)                   | 代码审查报告                           |
| [QUALITY_CHECK.md](QUALITY_CHECK.md)               | 质量检查报告                           |
| [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)       | 测试清单 (24/24 suites, 468/468 tests) |
| [P0_OPTIMIZATION_PLAN.md](P0_OPTIMIZATION_PLAN.md) | P0 优化计划                            |
| [DATA_VERIFICATION.md](DATA_VERIFICATION.md)       | 数据验证记录                           |

### 入职与指南

| 文档                                       | 说明                                   |
| ------------------------------------------ | -------------------------------------- |
| [ONBOARDING.md](ONBOARDING.md)             | 新人入职指南 (3 天上手)                |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md)   | 一页速查手册（命令、端口、目录结构等） |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md)   | 开发环境常见问题排障指南               |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)       | 设计系统规范                           |
| [I18N_GUIDE.md](I18N_GUIDE.md)             | 国际化 (i18n) 开发指南                 |
| [TYPOGRAPHY_GUIDE.md](TYPOGRAPHY_GUIDE.md) | 排版规范指南                           |

### 技术备忘

| 文档                                                             | 说明                    |
| ---------------------------------------------------------------- | ----------------------- |
| [技术文档/已知问题与解决方案.md](技术文档/已知问题与解决方案.md) | 已知问题及修复方案      |
| [技术文档/数据库迁移记录.md](技术文档/数据库迁移记录.md)         | 数据库迁移历史          |
| [ERROR_FIX_LOG_2026-02-08.md](ERROR_FIX_LOG_2026-02-08.md)       | 2026-02-08 错误修复日志 |

### GitHub 模板

| 文件                                                          | 说明               |
| ------------------------------------------------------------- | ------------------ |
| [Bug 报告模板](../.github/ISSUE_TEMPLATE/bug_report.yml)      | Bug Issue 模板     |
| [功能请求模板](../.github/ISSUE_TEMPLATE/feature_request.yml) | Feature Issue 模板 |
| [PR 模板](../.github/PULL_REQUEST_TEMPLATE.md)                | Pull Request 模板  |

---

## 文档整理记录

| 日期       | 变更                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-02-13 | **全量文档审计（6 轮，270+ 修正）**：48+ 文档逐一对照源码验证修正；新增 QUICK_REFERENCE.md（速查手册）、TROUBLESHOOTING.md（开发排障）；完整重写 apps/api、apps/web、apps/mobile README；GLOSSARY 扩展 32 术语；DORA 评分 37→38/40 (95.0%)；总计 53 份文档全部索引                                     |
| 2026-02-12 | 文档审核：修正 model 数量为 70 models, 29 enums；索引补收 I18N_GUIDE.md、TYPOGRAPHY_GUIDE.md、ERROR_FIX_LOG_2026-02-08.md；根 README 修正环境要求、Docker 服务名、Web 开发命令；补写移动端开发启动说明                                                                                                 |
| 2026-02-09 | 企业级预测系统文档：新增 PREDICTION_SYSTEM.md (v2 多引擎融合)、ADR-0008；更新 ARCHITECTURE.md (PredictionResult v2)、API_REFERENCE.md (4 endpoints)、SCORING_SYSTEM.md (多引擎关联)、ENTERPRISE_MEMORY_SYSTEM.md (预测集成)、PRODUCT_ROADMAP.md (v2 完成项)；更新文档索引和 DOCUMENTATION_STANDARDS.md |
| 2026-02-07 | 企业级文档标准化：新增 LICENSE、SECURITY.md、CONTRIBUTING.md、CHANGELOG.md、ADR 目录、API_REFERENCE.md、RUNBOOK.md、ONBOARDING.md、GLOSSARY.md、DOCUMENTATION_STANDARDS.md、GitHub 模板；ARCHITECTURE.md 补全 arc42 Section 16-19；重构文档索引                                                        |
| 2026-02-07 | 企业级安全审计修复：13 项 Critical/High 问题已修复                                                                                                                                                                                                                                                     |
| 2026-02-06 | 新增 SCORING_SYSTEM.md、COMPETITION_DATABASE.md；全面更新 ARCHITECTURE.md                                                                                                                                                                                                                              |
| 2026-01-24 | 5 个代码审查文档合并为 CODE_REVIEW.md；8 个检查报告合并为 QUALITY_CHECK.md                                                                                                                                                                                                                             |

---

_最后更新: 2026-02-13_

# 发版 Impact Set 映射规则

> 本文件是人类可读的 Impact Set 映射说明。
> 运行时机器可读事实源在 `scripts/release-gate/impact-mapping.ts`；自动生成 gate package 时以该文件为准。

## 1. 使用方法

1. 先列出本次变更影响的模块、页面、接口、共享组件和运行环境。
2. 逐行对照下表，把命中的旅程全部加入 `Impact Set`。
3. 如果命中 3 个以上高风险区域，或同时命中 `身份 + AI + mobile`，直接升级为 `Full Audit`。
4. 无法确定时，宁可扩大，不要缩小。

## 2. 映射总表

| 变更区域                                      | 常见文件/模块                               | 必跑旅程                                 | 建议追加旅程            | 额外质量维度    |
| --------------------------------------------- | ------------------------------------------- | ---------------------------------------- | ----------------------- | --------------- |
| 身份 / 注册 / session / onboarding            | auth、register、profile bootstrap、token    | `A1`                                     | `A2`, `A11`, `C1`       | 专业感、跨端    |
| Profile / 档案 / 分数 / 目标学校              | profile、scores、target schools             | `A2`                                     | `A3`, `A10`, `A11`      | 布局、专业感    |
| AI agent 核心编排                             | orchestrator、runner、memory、chat shell    | `A3`, `A4`, `A5`, `A6`, `A7`, `A8`, `A9` | `A11`, `SJ-4`, `C2`     | AI 输出、专业感 |
| AI prompt / tool / policy / moderation        | prompt、tool executor、guard、MCP free-text | `A3-A9`, `SJ-4`                          | `C2`                    | AI 输出、专业感 |
| 文书 / 时间线专用工具                         | essay tools、timeline tools                 | `A4`, `A5`, `A6`, `SJ-4`                 | `A11`                   | AI 输出         |
| 预测 / 案例库 / 排名 / 学校详情               | prediction、cases、ranking、schools         | `A10`, `SJ-1`                            | `A11`, `A2`             | 专业感、跨端    |
| 通知 / 未读数 / 推送 / deep link              | notifications、badge、push registration     | `SJ-2`, `SJ-3`, `A11`                    | `A1`                    | 跨端、专业感    |
| Mobile shell / shared API client / navigation | mobile app shell、tabs、router、api client  | `A11`, `SJ-3`                            | `A1`, `A2`, `A3`, `A10` | 跨端、布局      |
| 学校品牌资产 / 图标 / 图片加载                | school logo、avatar、asset helpers          | `A10`, `A11`, `SJ-1`                     | `A2`                    | 布局、专业感    |
| Home / dashboard / quick actions              | home tabs、dashboard cards、shortcuts       | `A10`, `A11`                             | `A2`, `SJ-2`            | 布局、专业感    |
| Admin shell / analytics / moderation          | admin dashboard、ops、users、moderation     | `C1`, `C2`, `C3`, `C4`, `C5`             | `SJ-4`                  | 布局            |
| MCP auth / key / stdio / external tools       | mcp server、api key lifecycle               | `SJ-4`                                   | `C1`, `C2`              | AI 输出、专业感 |
| 角色 / 权限 / RBAC / policy                   | roles、guards、permission checks            | `A1`, `C1-C5`, `SJ-4`                    | `B1-B3` 是否重新激活    | 专业感          |
| i18n / copy / design system / global layout   | locale files、layout、shared components     | 命中页面对应全部旅程                     | `A11` 如果含 mobile     | 布局、专业感    |

## 3. Full Audit 升级规则

出现以下任一情况，直接把本次门禁升级为 `Full Audit`：

- 同时命中 `身份 / 注册` 与 `AI agent 核心`
- 同时命中 `mobile shell` 与 `通知 / push / deep link`
- 命中 `shared API client`、`global navigation`、`design system` 这类跨模块基础设施
- 命中 `MCP` 与 `AI prompt / tool / policy`
- 两个以上高权限区域同时改动：`C1-C5 + SJ-4`
- release owner 明确认为本次属于品牌、顾问定位或战略功能调整

## 4. 质量维度自动附加规则

如果命中下列区域，必须把对应质量维度加入 `quality_dimensions_checked`：

| 命中区域                                                     | 必加维度              |
| ------------------------------------------------------------ | --------------------- |
| 页面结构、组件、空态、overlay、loading、卡片布局             | `layout`              |
| AI orchestrator、prompt、tool、agent modes、MCP free-text    | `ai-quality`          |
| web + mobile 同时命中，或 shared client / shared schema 改动 | `cross-platform`      |
| 首页、推荐、文书、时间线、顾问文案、品牌性页面               | `consultancy-quality` |

## 5. 兜底规则

- 如果改动看起来“只是文案”，但页面属于推荐、文书、时间线、AI 分析，也必须补 `consultancy-quality` 检查。
- 如果改动看起来“只是样式”，但涉及 mobile/web 共享页面，也必须补 `cross-platform` 检查。
- 如果改动命中了未列出的新模块，先映射到最接近的已知旅程，再在注册表中补充。

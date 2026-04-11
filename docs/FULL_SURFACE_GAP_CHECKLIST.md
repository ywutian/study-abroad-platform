# 全产品面审计易漏点清单

> 每次 full-surface 审计前先过这张表；新发现的漏点必须继续追加。

## 1. 布局与视觉

- [ ] 页面信息层级是否清楚
- [ ] 是否存在明显空洞、拥挤或视觉重心失衡
- [ ] toast / overlay / modal / result card 是否破坏整体节奏
- [ ] 移动端是否有压字、截断、超长 badge、过大留白

## 2. 概率 / badge / 术语去歧义

- [ ] `学校整体录取率` 与 `个人预估概率` 是否明确区分
- [ ] `冲刺 / 匹配 / 保底` 是否被解释为策略分层而不是官方评级
- [ ] `数据参考有限` 是否仍被画成风险红色
- [ ] 是否仍暴露内部模型术语、模型版本号或调试词汇

## 3. Web / Mobile 语义一致性

- [ ] 同一指标在 web/mobile 的含义是否一致
- [ ] 同一文案在两个端是否表达同一业务语义
- [ ] mobile 是否只是 web 页面硬缩放
- [ ] 平台特有交互是否被尊重

## 4. 图标 / 图片 / fallback

- [ ] logo、avatar、school icon 是否有统一来源
- [ ] fallback 是否自然，而不是错误占位图
- [ ] 图片加载失败时是否仍保持布局合理

## 5. AI 输出与专业感

- [ ] 输出是否像真实留学顾问，不是 debug 或模板话术
- [ ] 不确定性是否表达为“建议补充信息后再判断”，而不是生硬风险词
- [ ] 推荐/分析是否具有行动性和专业可信度

## 6. 环境噪音区分

- [ ] dev-only issue 是否已和稳定产品问题区分
- [ ] 外部配置缺失是否已单列为 capability gate
- [ ] seed / 数据缺失是否已归类为 `DATA_ISSUE`
- [ ] delegated journey timeout / missing `record.json` 是否先按 harness suspicion 处理，而不是直接升级成产品 blocker
- [ ] user-specific 首屏信息（用户名、completeness、theme/toggle）是否已做 hydration-safe 首次渲染，而不是把真实 SSR/CSR mismatch 误当成 dev-only 噪音

## 7. 文档复用

- [ ] 新发现的易漏点已回填本文件
- [ ] `MEMORY.md` 已记录本轮固定结论
- [ ] 模板和 playbook 是否需要同步升级

## 8. Dynamic Route 样例覆盖

- [ ] 本批涉及的 dynamic routes 是否都已在 sample catalog 中有稳定样例
- [ ] `resumeId / teamId / forumPostId / chatConversationId` 这类 route-family 样例是否已显式登记
- [ ] full-surface runner 的 fallback 样例创建是否仍有效（当前应至少能自动补 `resumeId` 与 `teamId`）
- [ ] 缺样例导致的 `BLOCKED` 是否已归为 `DATA_ISSUE`，而不是误判成页面回归

## 9. Applicant AI / Recommendation 执行策略

- [ ] recommendation / prediction 一类长耗时页面是否按 chunked execution 跑，而不是大批量串跑
- [ ] web 长耗时 AI 请求是否优先直连 API，而不是走 rewrite proxy
- [ ] 对同一 delegated journey 重复 `force-rerun` 前，是否已清理旧 runner 和 Redis lock

## 10. Mobile route vs push gate 拆分

- [ ] `A11 / SJ-3` 是否已区分“route reachable”与“remote push delivery/open”
- [ ] 如果 notifications 页已可达，是否避免继续把它写成通用 mobile 页面故障
- [ ] Android Firebase / FCM 缺失是否已明确写成 conditional capability gate，而不是 route `ISSUE`

# Outcome 收集 UX Component Spec (M6.1)

> 2026-05-22 — 文字描述（设计稿）。设计师可以基于此画 Figma 或代码用作 reference。

## 1. Dashboard Banner (`OutcomePendingBanner`)

**位置**: `/dashboard` 主内容上方
**位置文件**: `apps/web/src/components/features/outcome/outcome-pending-banner.tsx` ✅ 已实现

**渲染条件**: 用户有 ≥1 个 PredictionResult 未报告 outcome
**Empty state**: 完全不显示（不占位）

**布局**:

- 卡片容器：圆角 + amber→rose gradient bg + soft shadow
- 左侧：圆形 amber icon (CalendarClock)
- 右侧：
  - 标题"X 个学校等你报告录取结果"
  - 副标题"回来报告 Decision Day 结果，给学弟学妹留下宝贵案例 ✨"
  - 3 张 mini-card grid (sm:2列, lg:3列)，每张：学校名 + "ED · predicted 12%" + 右箭头
  - 如果 >3 个，下方显示"+N more..."链接

**交互**: 点 mini-card → 打开 ReportOutcomeModal

---

## 2. Report Outcome Modal (`ReportOutcomeModal`)

**位置文件**: `apps/web/src/components/features/outcome/report-outcome-modal.tsx` ✅ 已实现

**布局**: shadcn Dialog (sm:max-w-md)

- Header:
  - 标题 "{school} 的录取结果"
  - 描述 "{round} 申请 — 一键报告"
  - 灰色小字 "系统当时预测: {p}%"
- Body:
  - **Result picker**: 2×2 grid 大按钮 (RadioGroup)
    - 🎉 录取 (emerald)
    - ⏳ Waitlist (amber)
    - ⏸ Deferred (blue)
    - 💔 拒信 (rose)
    - 选中状态: ring-2 ring-primary + tinted bg
  - **Notes textarea** (optional, 500 字符)
  - **Opt-in checkbox**: "把这条 outcome 匿名分享给学弟学妹"
    - 默认勾选
    - 副文案: "脱敏后加入案例库，不暴露身份"
- Footer:
  - 取消 + 提交

**Loading state**: 提交按钮显示 "提交中..."
**Success**: Toast + close + invalidate ['outcomes', 'pending-decisions']

---

## 3. My Outcomes Page (`/outcomes`)

**位置文件**: `apps/web/src/app/[locale]/(main)/outcomes/page.tsx` ✅ 已实现

**布局**:

- PageHeader (emerald, GraduationCap icon)
- Stats card (上): 3 列
  - 总报告数
  - Self-reported 数
  - Verified 数 (含 Points 总值)
- Outcomes 列表 (每张):
  - 顶部 chip row: result badge (色) + round + status badge
  - 学校名 (大字)
  - 系统预测概率 (灰小字)
  - 备注 (line-clamp-2)
  - 右上：上传按钮 (SELF_REPORTED 状态时显示) / "已上传" badge

**Empty state**: EmptyState component "还没有报告任何 outcome"

**File upload**: input type=file, accept=jpeg/png/webp/pdf, max 10MB
**上传完毕**: 自动刷新页面 → 显示"已上传" badge

---

## 4. Admin Verification Queue (`/admin/outcomes-verification`)

**位置文件**: `apps/web/src/app/[locale]/(main)/admin/outcomes-verification/page.tsx` ✅ 已实现

**布局**:

- PageHeader (indigo, ShieldCheck icon)
- Outcome cards 列表（按 evidenceUrl IS NOT NULL 排序，有证据的前置）
- 每张:
  - 顶部 chip: round + result + 是否 evidence
  - 学校名
  - Predicted prob
  - 用户备注（脱掉 `[share=true]` 改成 "(opt-in share)"）
  - Evidence URL → 链接到上传的截图/PDF
  - "Reported by user XXX on YYYY-MM-DD HH:MM"
  - 审核备注 textarea
  - 3 个按钮:
    - "标记为已审核" → COUNSELOR_VERIFIED
    - "标记为凭证已验证" → DOCUMENT_VERIFIED (only enabled if evidenceUrl exists)
    - "拒绝" → REJECTED

**Empty state**: "审核队列为空"

---

## 5. Hall Alumni Badge (集成现有)

**位置**: Hall profile page — `apps/web/src/app/[locale]/(main)/hall/_components/`

**实施**:

- Hall profile fetch 时 join `OutcomePool` (或新增 endpoint `GET /hall/profile/:userId/badges`)
- Profile 顶部显示 "✓ 已验证录取 {n}" 小 badge（绿色），如果用户有 ≥1 verified outcome
- 鼠标悬停显示 verified tier 分布

**M6.5 简化**: 现 myStats endpoint 已经能给前端足够数据。Hall 集成留 M6.5.2 单独 ticket（不影响 MVP）。

---

## 6. 通用样式约定

| 元素                 | 颜色          |
| -------------------- | ------------- |
| ADMITTED             | emerald (绿)  |
| WAITLISTED           | amber (黄)    |
| DEFERRED             | blue (蓝)     |
| REJECTED             | rose (红)     |
| SELF_REPORTED status | outline       |
| COUNSELOR_VERIFIED   | blue solid    |
| DOCUMENT_VERIFIED    | emerald solid |

**Dark mode**: 所有色都用 `bg-{color}-50 dark:bg-{color}-950/30 border-{color}-200 dark:border-{color}-800` 模式
**Skeleton**: loading.tsx 用 Skeleton 组件，匹配 page 结构

---

## 7. i18n keys (已添加)

文件: `apps/web/src/messages/{zh,en}.json`，新增 `Outcome` namespace 约 30 个 keys：

- `bannerTitle`, `bannerDescription`, `predicted`, `seeMore`
- `reportTitle`, `reportDescription`, `predictedProbability`
- `resultLabel`, `admitted`, `waitlisted`, `deferred`, `rejected`
- `notesLabel`, `notesPlaceholder`, `optional`
- `shareOptInTitle`, `shareOptInDescription`
- `cancel`, `submitReport`, `submitting`, `reportSuccess`, `reportError`
- `myHistory`, `myHistoryDescription`, `pageTitle`, `pageSubtitle`
- `noOutcomes`, `statusSelfReported`, `statusCounselorVerified`, `statusDocumentVerified`
- `uploadEvidence`, `evidenceUploaded`
- `adminQueueTitle`, `adminQueueDescription`, `adminEmpty`, `adminVerifyButton`,
  `adminVerifyCounselor`, `adminVerifyDocument`, `adminReject`, `adminReviewNote`

---

## 8. 路由总览

| Frontend route                 | Backend endpoint                                          | Method           |
| ------------------------------ | --------------------------------------------------------- | ---------------- |
| `/outcomes`                    | `/api/v1/predictions/outcomes/me`                         | GET              |
| `/outcomes` (stats)            | `/api/v1/predictions/outcomes/me/stats`                   | GET              |
| `/dashboard` (banner)          | `/api/v1/predictions/outcomes/pending-decisions`          | GET              |
| 一键报告 modal                 | `/api/v1/predictions/outcomes`                            | POST             |
| 上传证据                       | `/api/v1/predictions/outcomes/:id/evidence`               | POST (multipart) |
| `/admin/outcomes-verification` | `/api/v1/admin/predictions/outcomes/pending-verification` | GET              |
| Admin verify                   | `/api/v1/admin/predictions/outcomes/:id/verify`           | POST             |

---

## 9. 未在 MVP 范围内

- Bulk reporting page (一次报多个) — 可后续 add tab to /outcomes page
- OCR auto-verification — admin 人工 review 看 evidenceUrl 即可
- Email reminder besides in-app push — NotificationService 抽象层负责
- Webhook for Decision Day import — 学校官方 API 没普及
- Outcome retraction by user — admin 手动 delete

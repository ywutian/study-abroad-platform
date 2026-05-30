# Claude Design 上传包 — 移动端全新视觉重做

这个文件夹是给 **Claude Design** 用的「零遗漏」上传包。目标：移动端约 50 屏全部全新视觉重做，不漏任何一屏、任何内容块。

## 文件夹内容

| 文件                   | 是什么                                 | 怎么用                           |
| ---------------------- | -------------------------------------- | -------------------------------- |
| `00_README.md`         | 本说明                                 | 给你自己看，不用传               |
| `01_REDESIGN_BRIEF.md` | **核心**：全部屏的内容/信息架构清单    | **必传**，直接拖进 Claude Design |
| `02_ui-copy-en.json`   | 全部英文 UI 文案（每个按钮/标签/空态） | **建议传**，避免它瞎编英文       |
| `03_ui-copy-zh.json`   | 全部中文 UI 文案                       | **建议传**，中英排版一起校验     |
| `screenshots/`         | 你截的当前 App 截图（放这里）          | **必传**，仅作内容参考           |

## 上传到 Claude Design 的顺序

1. **先建新设计系统**（1 个 session）：把 `01_REDESIGN_BRIEF.md` 的第 1–3 节贴给它，让它产出**新**色板/字体/组件，满意后存为 Design System，后续每屏复用。
2. **再按 flow 分批做屏**：每批传 ① brief 对应 flow 段落 ② `screenshots/` 里该 flow 的截图 ③ 首次可一起传 02/03 文案文件。**每批都加一句**："Redesign the visuals from scratch — use the screenshots only as a content reference, keep all content blocks / data / states."
3. **逐屏对照 brief 第 6 节 checklist 打勾**。

## 不要上传

- ❌ 整个 codebase /「Attach codebase」—— monorepo 噪音 + 旧 StyleSheet 风格会污染新视觉。
- ❌ 旧设计系统 token —— 会把它拽回旧风格。

---

## ✅ 实际截图状态（已自动捕获 45 张）

`screenshots/` 已通过 expo-web + headless 浏览器自动登录（demo 账号 alice.zhang）抓取 **45 张真实数据截图**，覆盖几乎全部屏。直接拖进 Claude Design 即可。

**两点需知：**

- ⚠️ `ranking.png` 和 `hall.png` 是 **web 端崩溃截图**（这两屏用了 react-native-web 不兼容的原生模块；原生 app 不会崩）。需要真实样子的话，请在你的原生模拟器上各补一张；内容规格 brief 里已写全（Flow D 自定义排名 / Flow F 名人堂）。
- `settings-hub.png` ≈ `settings-language.png`（app 的 `/settings` 没有独立 index 路由，hub 与语言页同源）；`profile-analysis.png` 偏空（demo 账号未跑过申请分析）。

下面的 ☐ 清单为原始规划，多数已对应到上面 45 张文件（命名一致）。

---

## 截图清单（原始规划 / 命名参考）

> 注：以下大部分已自动截好。`pnpm --filter mobile start` 起模拟器可补任意缺失屏。带 ⚠️ 的空壳屏当前是 EmptyState，已按现状截图供参考。

**Auth & Onboarding**

- ☐ `auth-login.png`
- ☐ `auth-register.png`
- ☐ `auth-forgot-password.png`
- ☐ `auth-biometric-lock.png`（开启生物识别后启动可见）

**Home**

- ☐ `home.png`（登录态）
- ☐ `home-guest.png`（游客态，建议补）

**Profile & Data**

- ☐ `profile-hub.png`
- ☐ `profile-basic.png`
- ☐ `profile-education.png`（含新增 Modal）
- ☐ `profile-scores.png`（含新增 Modal）
- ☐ `profile-activities.png`
- ☐ `profile-awards.png`
- ☐ `profile-essays.png`
- ☐ `profile-analysis.png`
- ☐ `profile-export.png`

**School Discovery**

- ☐ `schools-list.png`（含排序 sheet）
- ☐ `find-college.png`（含筛选 Modal）
- ☐ `school-detail.png`（各 Tab）
- ☐ `ranking.png`
- ☐ `swipe.png`（卡片 + stats 两态）

**Prediction**

- ☐ `prediction.png`（含上报 Modal）
- ☐ `recommendation.png`（Generate + History）

**Cases & Hall**

- ☐ `cases-list.png`（含筛选 sheet + 提交 Modal）
- ☐ `case-detail.png`
- ☐ `hall.png`（verified / ranking / path 三 Tab）

**AI & Essays**

- ☐ `ai-tab.png`（空态 + 对话态）
- ☐ `uncommon-app.png`（仪表盘 + 对话）
- ☐ `essays.png`
- ☐ `essay-editor.png`（含某个 AI 结果 Modal）
- ☐ `essay-gallery.png`
- ☐ `chat.png`

**Community**

- ☐ `forum.png`（含发帖 Modal）
- ☐ `forum-detail.png`
- ☐ `followers.png`（三 Tab）
- ☐ `teams.png`（Match / Matches / My Team）
- ⚠️ Peer Review —— 空壳，不截

**Planning & Tools**

- ☐ `timeline.png`（schools / events / overview 三 Tab）
- ☐ `assessment.png`（select / quiz / result）
- ⚠️ Resume —— 空壳，不截
- ⚠️ Vault —— 空壳，不截

**Account & Settings**

- ☐ `notifications.png`
- ☐ `subscription.png`
- ☐ `security.png`
- ☐ `settings-hub.png`
- ☐ `settings-language.png`
- ☐ `settings-theme.png`
- ⚠️ Points —— 空壳，不截
- ☐ `referral.png`
- ⚠️ Verification —— 空壳，不截
- ☐ `admin.png`（仅 ADMIN，三 Tab）

**通用元素（各截一张）**

- ☐ `nav-tabbar.png`（底部 6 Tab）
- ☐ `nav-more-grid.png`（More 宫格）

> 总计约 40 张可截截图 + 5 个空壳屏（看 brief）。截完按上面命名丢进 `screenshots/` 即可。

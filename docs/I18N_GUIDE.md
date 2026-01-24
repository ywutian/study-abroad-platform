# 国际化 (i18n) 规范指南

> 本文档定义了项目的国际化标准、架构设计和编码规范。所有涉及用户可见文本的代码变更都应遵循本指南。

## 目录

1. [架构概览](#架构概览)
2. [技术栈](#技术栈)
3. [目录结构](#目录结构)
4. [核心规范](#核心规范)
5. [日期与数字格式化](#日期与数字格式化)
6. [学校名称显示规则](#学校名称显示规则)
7. [翻译文件管理](#翻译文件管理)
8. [类型安全](#类型安全)
9. [编码规范](#编码规范)
10. [审计检查清单](#审计检查清单)
11. [新增语言流程](#新增语言流程)
12. [Toast 错误消息处理模式](#toast-错误消息处理模式)
13. [AI Prompt 模板国际化](#ai-prompt-模板国际化)
14. [豁免翻译的专有名词](#豁免翻译的专有名词)

---

## 架构概览

```
┌──────────────────────────────────────────────────┐
│                    next-intl                      │
│  ┌────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ request.ts │  │  messages/  │  │  i18n.d.ts │ │
│  │ (formats,  │  │  zh.json    │  │ (类型声明)  │ │
│  │  timeZone) │  │  en.json    │  │            │ │
│  └─────┬──────┘  └──────┬──────┘  └────────────┘ │
│        │                │                         │
│  ┌─────▼────────────────▼──────────────────────┐  │
│  │       NextIntlClientProvider (layout.tsx)    │  │
│  └─────────────────┬───────────────────────────┘  │
│                    │                              │
│  ┌─────────────────▼───────────────────────────┐  │
│  │              组件层                          │  │
│  │  useTranslations() — 翻译文本               │  │
│  │  useFormatter()    — 日期/数字格式化         │  │
│  │  useLocale()       — 获取当前语言(仅特殊场景)│  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │           lib/i18n/locale-utils.ts          │  │
│  │  toBcp47()        — BCP-47 locale 映射      │  │
│  │  getLocaleName()  — 带本地化的学校名等工具   │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## 技术栈

| 工具                                            | 用途              | 版本                       |
| ----------------------------------------------- | ----------------- | -------------------------- |
| [next-intl](https://next-intl-docs.vercel.app/) | 核心 i18n 框架    | 与 Next.js App Router 集成 |
| ICU Message Syntax                              | 消息格式          | next-intl 内置支持         |
| TypeScript                                      | 翻译 key 类型检查 | 编译时校验                 |

## 目录结构

```
apps/web/src/
├── lib/i18n/
│   ├── config.ts          # locale 列表、默认语言
│   ├── request.ts         # 服务端配置 (formats, timeZone, messages)
│   ├── navigation.ts      # locale 感知的路由工具
│   └── locale-utils.ts    # 集中式 locale 工具函数
├── messages/
│   ├── zh.json            # 中文翻译
│   └── en.json            # 英文翻译
├── types/
│   └── i18n.d.ts          # next-intl 类型声明 (module augmentation)
└── ...
```

## 核心规范

### 规则 1：所有用户可见文本必须使用翻译函数

```tsx
// ✅ 正确
const t = useTranslations('forum');
<h1>{t('title')}</h1>
<Button>{t('submit')}</Button>

// ❌ 错误 — 硬编码文本
<h1>论坛</h1>
<Button>Submit</Button>
```

### 规则 2：日期/数字格式化必须使用 `useFormatter()`

```tsx
// ✅ 正确 — 自动感知 locale，全局统一格式
const format = useFormatter();
<span>{format.dateTime(new Date(item.createdAt), 'medium')}</span>
<span>{format.number(value)}</span>
<span>{format.relativeTime(new Date(item.createdAt))}</span>

// ❌ 错误 — 手动 locale 映射
<span>{new Date(item.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
<span>{new Intl.NumberFormat('en-US').format(value)}</span>
```

### 规则 3：禁止在组件中进行 `locale === 'zh'` 日期/数字判断

locale 到 BCP-47 的映射只允许出现在以下位置：

- `lib/i18n/request.ts` — 全局 formats 配置
- `lib/i18n/locale-utils.ts` — 集中工具函数

```tsx
// ✅ 正确 — 如果确实需要 BCP-47 locale（极少数情况）
import { toBcp47 } from '@/lib/i18n/locale-utils';
const bcp47 = toBcp47(locale);

// ❌ 错误 — 每个组件各自映射
const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US';
```

### 规则 4：`useLocale()` 仅用于数据层的 locale 感知

`useLocale()` 应该只用于：

- 学校名选择 (`getSchoolName`, `getSchoolSubName`)
- 根据 locale 选择不同的数据字段 (`nameZh` vs `name`)
- 传递给第三方库的 locale 参数

**不应该**用于日期/数字格式化（改用 `useFormatter()`）。

### 规则 5：翻译中使用 ICU 消息格式处理动态内容

```json
{
  "welcome": "欢迎, {name}！",
  "itemCount": "共 {count, number} 个项目",
  "lastUpdated": "最后更新于 {date, date, medium}"
}
```

```tsx
t('welcome', { name: user.name });
t('itemCount', { count: items.length });
```

## 日期与数字格式化

### 全局 formats 配置

在 `request.ts` 中集中定义所有格式化策略：

```typescript
// lib/i18n/request.ts
export default getRequestConfig(async ({ requestLocale }) => {
  return {
    locale,
    messages: ...,
    timeZone: 'Asia/Shanghai',
    formats: {
      dateTime: {
        short:  { month: 'short', day: 'numeric' },
        medium: { year: 'numeric', month: 'short', day: 'numeric' },
        long:   { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
        time:   { hour: '2-digit', minute: '2-digit' },
      },
      number: {
        standard: { maximumFractionDigits: 0 },
        precise:  { maximumFractionDigits: 2 },
        currency: { style: 'currency', currency: 'USD' },
      },
    },
  };
});
```

### 组件中使用

```tsx
import { useFormatter } from 'next-intl';

function MyComponent() {
  const format = useFormatter();

  return (
    <>
      {/* 使用预定义格式名 */}
      <span>{format.dateTime(new Date(createdAt), 'short')}</span>
      <span>{format.dateTime(new Date(createdAt), 'medium')}</span>

      {/* 数字格式化 */}
      <span>${format.number(tuition, 'standard')}</span>

      {/* 相对时间 */}
      <span>{format.relativeTime(new Date(updatedAt))}</span>
    </>
  );
}
```

### 格式名称对照表

| 格式名   | 中文输出示例        | 英文输出示例               | 使用场景         |
| -------- | ------------------- | -------------------------- | ---------------- |
| `short`  | 2月7日              | Feb 7                      | 列表项、卡片     |
| `medium` | 2026年2月7日        | Feb 7, 2026                | 详情页、表格     |
| `long`   | 2026年2月7日 星期六 | Saturday, February 7, 2026 | 时间线、正式场景 |
| `time`   | 14:30               | 02:30 PM                   | 聊天消息、通知   |

## 学校名称显示规则

### 业务规则

| 场景   | 中文 locale (zh)          | 英文 locale (en)          |
| ------ | ------------------------- | ------------------------- |
| 主名称 | 中文名（fallback 英文名） | 英文名（fallback 中文名） |
| 副标题 | 显示英文名（中英双显）    | 不显示副标题              |

### 使用方式

```tsx
import { useLocale } from 'next-intl';
import { getSchoolName, getSchoolSubName } from '@/lib/utils';

function SchoolCard({ school }) {
  const locale = useLocale();
  const subName = getSchoolSubName(school, locale);

  return (
    <div>
      <h3>{getSchoolName(school, locale)}</h3>
      {subName && <p className="text-muted-foreground">{subName}</p>}
    </div>
  );
}
```

### 对于 `schoolNameZh` / `schoolName` 字段（非嵌套对象）

```tsx
import { getLocalizedName } from '@/lib/i18n/locale-utils';

// 简化模式
<span>{getLocalizedName(item.schoolNameZh, item.schoolName, locale)}</span>;
```

## 翻译文件管理

### Namespace 命名规范

| Namespace             | 用途                         | 示例 key                                                      |
| --------------------- | ---------------------------- | ------------------------------------------------------------- |
| `common`              | 全局通用文本（按钮、状态词） | `common.save`, `common.cancel`                                |
| `nav`                 | 导航栏                       | `nav.home`, `nav.forum`                                       |
| `dashboard`           | 仪表盘页面                   | `dashboard.title`                                             |
| `forum`               | 论坛模块                     | `forum.createPost`                                            |
| `cases`               | 案例库                       | `cases.result.admitted`                                       |
| `essayAdmin`          | 文书管理（管理后台）         | `essayAdmin.approve`                                          |
| `hall`                | 功能大厅主模块               | `hall.title`, `hall.tabs.tinder`                              |
| `hall.tinder`         | 案例预测游戏                 | `hall.tinder.emptyPool`, `hall.tinder.restart`                |
| `hall.swipeCard`      | 滑动卡片                     | `hall.swipeCard.admitStamp`, `hall.swipeCard.verified`        |
| `hall.swipeStack`     | 卡片堆栈操作                 | `hall.swipeStack.rejectLabel`, `hall.swipeStack.keyboardHint` |
| `hall.leaderboard`    | 排行榜                       | `hall.leaderboard.title`, `hall.leaderboard.yourRank`         |
| `hall.result`         | 预测结果反馈                 | `hall.result.correct`, `hall.result.streak`                   |
| `hall.stats`          | 统计面板                     | `hall.stats.accuracy`, `hall.stats.currentStreak`             |
| `hall.dailyChallenge` | 每日挑战                     | `hall.dailyChallenge.remaining`                               |
| `hall.review`         | 锐评模式                     | `hall.review.submitSuccess`                                   |
| `hall.ranking`        | 排名对比                     | `hall.ranking.topPercentile`                                  |
| `hall.lists`          | 用户榜单                     | `hall.lists.byAuthor`                                         |
| `ui.*`                | UI 组件专用                  | `ui.sortable.drag`                                            |
| `meta.*`              | SEO 元数据                   | `meta.home.title`                                             |

### 翻译 key 命名规范

```json
{
  "forum": {
    "title": "...",
    "createPost": "...",
    "post": {
      "title": "...",
      "content": "...",
      "author": "..."
    },
    "filter": {
      "all": "...",
      "myPosts": "..."
    },
    "empty": {
      "title": "...",
      "description": "..."
    }
  }
}
```

规则：

- 使用 **camelCase**
- 层级不超过 **3 层**
- 动作用动词开头：`createPost`、`deleteComment`
- 状态用形容词/名词：`empty.title`、`loading`
- 避免缩写：`description` 而非 `desc`

### 翻译文本规范

```json
// ✅ 正确 — 使用 ICU 变量
"batchVerifySuccess": "批量审核完成: {count} 条成功"

// ❌ 错误 — 拼接字符串
// 在代码中: `批量审核完成: ${count} 条成功`
```

## 类型安全

### 当前配置（宽松模式）

当前使用宽松模式，允许动态拼接翻译 key（如 `t(\`prefix.\${variable}.suffix\`)`）：

```typescript
// types/i18n.d.ts
import type { useTranslations } from 'next-intl';

type LooseMessages = Record<string, any>;

declare module 'next-intl' {
  interface AppConfig {
    Messages: LooseMessages;
  }
}
```

> **注意**: 严格模式（基于 `zh.json` 推断 key 类型）会在 130+ 处动态 key 使用时报 TS2345。待所有动态 key 迁移为类型安全写法后可重新启用。

### 严格模式（未来目标）

迁移完成后，可切换为严格模式以获得编译时校验和 IDE 自动补全：

```typescript
// types/i18n.d.ts (严格模式)
import zh from '../messages/zh.json';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof zh;
  }
}
```

## 编码规范

### 组件内推荐 import 顺序

```tsx
import { useTranslations, useFormatter, useLocale } from 'next-intl';
```

### Hook 调用顺序

```tsx
function MyComponent() {
  const t = useTranslations('myNamespace');
  const tc = useTranslations('common'); // 如果需要 common namespace
  const format = useFormatter(); // 如果需要日期/数字格式化
  const locale = useLocale(); // 仅在需要数据字段选择时使用
  // ... 其他 hooks
}
```

### toast / 错误消息

```tsx
// ✅ 正确
toast.success(t('saveSuccess'));
toast.error(t('saveFailed'));

// ❌ 错误
toast.success('保存成功');
toast.error('Save failed');
```

### 条件文本

```tsx
// ✅ 正确 — 在翻译文件中用 ICU select
// zh.json: "role": "{role, select, admin {管理员} user {普通用户} other {未知}}"
t('role', { role: user.role });

// ✅ 也可以 — 简单的 key 映射
t(`status.${item.status}`);

// ❌ 错误
locale === 'zh' ? '管理员' : 'Admin';
```

### Placeholder 文本

```tsx
// ✅ 正确
<Input placeholder={t('searchPlaceholder')} />

// ❌ 错误
<Input placeholder="搜索学校或文书内容..." />

// ⚠️ 例外 — 格式示例类 placeholder 不需要翻译
<Input placeholder="you@example.com" />
<Input placeholder="3.85" />
<Input placeholder="YYYY" />
```

## 审计检查清单

在 code review 中检查以下项目：

- [ ] 所有用户可见文本使用 `t()` 翻译
- [ ] 日期格式化使用 `useFormatter().dateTime()` 而非 `toLocaleDateString()`
- [ ] 数字格式化使用 `useFormatter().number()` 而非 `Intl.NumberFormat`
- [ ] 不存在 `locale === 'zh' ? 'zh-CN' : 'en-US'` 模式
- [ ] `toast.success()` / `toast.error()` 使用翻译 key
- [ ] 新增翻译 key 同时出现在 `zh.json` 和 `en.json`
- [ ] 翻译 key 命名符合 camelCase 规范
- [ ] 动态内容使用 ICU 变量 `{name}` 而非字符串拼接
- [ ] 学校名使用 `getSchoolName()` / `getSchoolSubName()`
- [ ] 无直接使用 `nameZh` 做显示（通过工具函数）

## 新增语言流程

当需要支持新语言（如日语 `ja`）时：

1. **`lib/i18n/config.ts`** — 添加 locale

   ```typescript
   export const locales = ['en', 'zh', 'ja'] as const;
   export const localeNames = { en: 'English', zh: '中文', ja: '日本語' };
   ```

2. **`lib/i18n/locale-utils.ts`** — 添加 BCP-47 映射

   ```typescript
   const BCP47_MAP = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' };
   ```

3. **`messages/ja.json`** — 创建翻译文件

4. **`lib/utils.ts`** — 更新学校名逻辑（如需要 `nameJa` 字段）

**不需要修改任何组件代码**（因为格式化和 locale 映射都集中在配置层）。

---

## 当前改进状态

### 已完成的基础设施

- [x] `request.ts` — 配置全局 `formats`（`short`/`medium`/`long`/`time`）和 `timeZone`
- [x] `types/i18n.d.ts` — next-intl 类型声明（当前为宽松模式，待迁移动态 key 后启用严格模式）
- [x] `lib/i18n/locale-utils.ts` — 集中式 locale 工具 (`toBcp47`, `getLocalizedName`, `getSecondaryName`)
- [x] 文档规范 (本文件)

### 重构进度

**格式化重构（已完成）：**

- [x] `vault/page.tsx` — `formatDate` 改用 `format.dateTime(date, 'medium')`
- [x] `recommendation/page.tsx` — 日期格式化改用 `useFormatter()`
- [x] `assessment/page.tsx` — 日期格式化改用 `useFormatter()`
- [x] `forum/page.tsx` — 2 处 `toLocaleDateString` 改用 `format.dateTime()`
- [x] `timeline/page.tsx` — `formatDate` 改用 `format.dateTime(date, 'medium')`
- [x] `motion.tsx` — 静态渲染用 `format.number()`，动画回调用 `toBcp47()`
- [x] `schools/[id]/page.tsx` — 学费/薪资用 `format.number(v, 'currency')`，学生数用 `'standard'`
- [x] `schools/page.tsx` — 学生数用 `format.number(v, 'standard')`
- [x] `find-college/page.tsx` — 学费用 `format.number(v, 'currency')`
- [x] `DashboardStats.tsx` — 积分用 `format.number(v, 'standard')`
- [x] `PointsOverview.tsx` — 2 处积分显示改用 `format.number()`
- [x] `AdvancedSchoolFilter.tsx` — 人数范围改用 `format.number()`

**date-fns locale 修复（已完成）：**

- [x] `notification-center.tsx` — 硬编码 `zhCN` 改为 locale 感知 (`zhCN`/`enUS`)
- [x] `RecentActivity.tsx` — 硬编码 `zhCN` 改为 locale 感知
- [x] `chat/page.tsx` — 硬编码 `zhCN` 改为 locale 感知
- [x] `notifications.ts` — `formatNotificationTime` 接受 locale 参数

**locale 映射集中化（已完成）：**

- [x] 消除组件中的 `locale === 'zh' ? 'zh-CN' : 'en-US'` 日期/数字模式
- [x] PDF 模板改用 `toBcp47(options.language)`
- [x] `essay-prompt-manager.tsx` — 40+ 处硬编码中文改用 `t()`
- [x] `FloatingAddButton.tsx` — 7 处硬编码中文改用 `t()`

**名称本地化重构（已完成）：**

- [x] `forum/page.tsx` — 6 处 `locale === 'zh' ? nameZh : name` 改用 `getLocalizedName()`
- [x] `essay-prompt-manager.tsx` — 2 处学校名改用 `getLocalizedName()`
- [x] `swipe/page.tsx` — 3 处案例学校名改用 `getLocalizedName()`
- [x] `SwipeCard.tsx` — 改用 `getLocalizedName()`
- [x] `verified-ranking/page.tsx` — 改用 `getLocalizedName()`
- [x] `ReportDialog.tsx` — 举报原因的 label/description 改用 `getLocalizedName()`

**硬编码 'N/A' 修复（已完成）：**

- [x] `schools/[id]/page.tsx` — 12 处 `'N/A'` 改用 `tc('notAvailable')`
- [x] `SwipeReviewMode.tsx` — 1 处 `'N/A'` 改用 `tc('notAvailable')`
- [x] `common` namespace 添加 `notAvailable` 翻译 key

**date-fns format() 替换（已完成）：**

- [x] `admin/page.tsx` — 2 处 `format(date, 'yyyy-MM-dd')` 改用 `fmt.dateTime(date, 'medium')`
- [x] `essays/page.tsx` — 2 处 `format(date, 'yyyy-MM-dd')` 改用 `fmt.dateTime(date, 'medium')`
- [x] `PostCard.tsx` — `toLocaleDateString(locale)` 改用 `format.dateTime(date, 'medium')`

**数字格式化修复（已完成）：**

- [x] `request.ts` — 全局 formats 新增 `compact` 格式（`notation: 'compact'`）
- [x] `forum/page.tsx` — `formatNumber` 改用 `format.number(num, 'compact')`
- [x] `PostCard.tsx` — `formatNumber` 改用 `format.number(num, 'compact')`

**非 React 上下文国际化修复（已完成）：**

对于无法使用 `useTranslations()` hooks 的场景（class 组件、非 React 工具类），
采用 **URL 路径检测 locale + 本地翻译对象** 的统一模式：

- [x] `error-boundary.tsx` — 添加 `ERROR_TRANSLATIONS` + `detectLocale()`，所有 UI 文案双语化
- [x] `lib/api/client.ts` — 添加 `API_I18N` + `getApiLocale()`，错误 toast 双语化
- [x] `not-found.tsx` — 已有完善的 `translations` 对象（无需修改）
- [x] `resume/styles/pdf-styles.ts` — 已有完善的 `translations` 对象（无需修改）

**组件 / Hook 层修复（已完成）：**

- [x] `BadgeDisplay.tsx` — 徽章名称改用 `useTranslations('swipe')` + `t('badges.xxx')` 翻译 key
- [x] `BadgeProgress` — 进度文案改用 ICU 消息格式 `badgeProgress: "{count} more correct to reach {badge}"`
- [x] `agent-chat/types.ts` — `AGENT_INFO` 新增 `nameZh` 字段，搭配 `getLocalizedName()` 使用
- [x] `agent-chat/agent-chat.tsx` — 使用 `getLocalizedName(agentInfo.nameZh, agentInfo.name, locale)` 显示 agent 名称
- [x] `agent-chat/chat-message.tsx` — 同上，含 `StaticChatMessage` fallback 组件
- [x] `ai-assistant-panel.tsx` — 删除无引用的硬编码中文 fallback 静态常量
- [x] `use-agent-chat.ts` — 错误消息改用 `useTranslations('agentChat')` + `t('errorProcessing')`
- [x] `use-chat-socket.ts` — 错误 toast 改用 `useTranslations('chat')` + `t('socketError')` 等

**AI 对话提示词国际化（已完成）：**

- [x] `assessment/page.tsx` — `aiContextActions` 中 16 个 label/prompt 改用 `t('aiActions.xxx')` 翻译 key

### 非 React 上下文的国际化模式

对于无法使用 `next-intl` hooks 的场景，项目采用统一模式：

```typescript
// 1. 定义本地翻译对象
const I18N = {
  zh: { errorMessage: '出了点问题', retry: '重试' },
  en: { errorMessage: 'Something went wrong', retry: 'Retry' },
} as const;

// 2. 通过 URL 路径检测 locale
function detectLocale(): 'zh' | 'en' {
  if (typeof window === 'undefined') return 'en';
  const path = window.location.pathname;
  if (path.startsWith('/zh')) return 'zh';
  return 'en';
}

// 3. 使用
const t = I18N[detectLocale()];
toast.error(t.errorMessage);
```

适用场景：

- **Class 组件**（如 `ErrorBoundary`）— 无法使用 hooks
- **非 React 工具函数**（如 `api/client.ts`）— 不在 React 树中
- **全局 404 / 错误页面**（如 `not-found.tsx`）— 不在 locale 路由内
- **PDF 生成**（如 `pdf-styles.ts`）— 通过 `options.language` 参数传递

### Toast 错误消息处理模式

错误消息通常来自 API 返回的 `error.message`，但 fallback 字符串必须翻译：

```tsx
// ✅ 推荐 — 带翻译的 fallback
toast.error(error.message || t('submitError'));

// ✅ 推荐 — 使用通用工具函数
import { getErrorMessage } from '@/lib/utils/error';
toast.error(getErrorMessage(error, t('errors.operationFailed')));

// ❌ 错误 — 硬编码 fallback
toast.error(error.message || 'Failed to submit');
toast.error(error.message || '提交失败');
```

工具函数参考实现：

```typescript
// lib/utils/error.ts
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error;
  return fallback;
}
```

### AI Prompt 模板国际化

AI 提示词也是用户可见文本，应通过翻译文件管理。使用 ICU 变量传递动态数据：

```json
// zh.json
{
  "assessment": {
    "aiActions": {
      "interpretMbti": "深度解读我的 MBTI 结果",
      "interpretMbtiPrompt": "请深度解读我的 MBTI 测评结果：\n- 类型: {type}\n- 维度得分: {scores}\n\n请从以下几个方面分析：..."
    }
  }
}
```

```tsx
// 在组件中使用
const prompt = t('aiActions.interpretMbtiPrompt', {
  type: result.type,
  scores: formattedScores,
});
```

规则：

- `label` 属性（用户可见按钮文字）**必须**翻译
- `prompt` 属性（AI 对话模板）**应当**翻译，以便在不同语言下提供最佳 AI 回复
- 使用 `\n` 在翻译字符串中表示换行
- 复杂动态数据先在代码中格式化为字符串，再通过 ICU 变量传入

### 豁免翻译的专有名词

以下标准化缩写/专有名词**不需要**翻译，可以硬编码：

| 类别         | 示例                             | 原因         |
| ------------ | -------------------------------- | ------------ |
| 标化考试名称 | GPA, SAT, ACT, TOEFL, IELTS, GRE | 国际通用缩写 |
| 排名体系     | US News, QS, THE                 | 专有品牌名   |
| 学校缩写     | MIT, CMU, UCLA                   | 官方缩写     |
| 申请系统     | CommonApp, Coalition             | 专有平台名   |
| 技术/格式    | PDF, AI, URL                     | 技术术语     |

如果需要在 CI 脚本中豁免这些词汇，可在 `check-i18n.ts` 的白名单中添加。

### 翻译文件拆分（规划中）

当前使用单文件 (`zh.json` / `en.json`，各约 3000 行)。
未来可按模块拆分为 `messages/zh/*.json`，但需要评估：

- 构建时 dynamic import 的性能影响
- 开发体验（需修改 `request.ts` 加载逻辑）
- 是否需要引入 i18n 管理平台（如 Crowdin/Lokalise）

---

_最后更新: 2026-02-13_

# Typography Guide

留学平台排版规范指南。所有页面和组件的字号、字重、行高应遵循本指南中的设计阶梯（Design Token），确保全站排版一致性。

---

## 排版阶梯（Design Token）

基于 `globals.css` 中定义的 CSS 工具类，按层级从大到小排列：

| Level    | CSS Class        | Size      | Weight | 适用场景                 |
| -------- | ---------------- | --------- | ------ | ------------------------ |
| Display  | `.text-display`  | 38-46px   | 700    | Landing page hero 标题   |
| Title LG | `.text-title-lg` | 30-38px   | 700    | 营销页面标题             |
| Title    | `.text-title`    | 24-30px   | 600    | 应用页面标题 (h1)        |
| Subtitle | `.text-subtitle` | 24px      | 600    | Section heading (h2)     |
| Body LG  | `.text-body-lg`  | 20px      | 400    | Lead paragraph / h3 标题 |
| Body     | `.text-body`     | 16px      | 400    | 默认正文                 |
| Body SM  | `.text-body-sm`  | 14px      | 400    | 次要文本、描述           |
| Label    | `.text-label`    | 14px      | 500    | 表单标签                 |
| Caption  | `.text-caption`  | 12px      | 400    | 提示、时间戳             |
| Overline | `.text-overline` | 12px (UC) | 500    | 分类标签（全大写）       |
| 2XS      | `text-2xs`       | 10px      | 400    | Badge、迷你标签          |

> 注意: `text-2xs` 是 Tailwind 扩展类（定义在 `@theme inline` 中），其余 `.text-*` 是自定义 CSS 类。

---

## Typography 组件

### Heading

语义化标题组件，内置排版 token 映射。

```tsx
import { Heading } from '@/components/ui/typography';

// 默认映射
<Heading level={1}>Page Title</Heading>     // -> text-title (24-30px)
<Heading level={2}>Section</Heading>        // -> text-subtitle (24px)
<Heading level={3}>Subsection</Heading>     // -> text-body-lg + font-semibold (20px)
<Heading level={4}>Minor heading</Heading>  // -> text-body + font-semibold (16px)

// 展示级超大标题（landing page）
<Heading level={1} display>Hero Title</Heading>  // -> text-display (38-46px)

// 加大标题（营销页面）
<Heading level={1} titleLg>Marketing</Heading>   // -> text-title-lg (30-38px)

// 覆盖渲染标签（视觉 h1 但语义 h2）
<Heading level={1} as="h2">Visually large</Heading>
```

**Props:**

| Prop        | Type      | Default | 说明                            |
| ----------- | --------- | ------- | ------------------------------- |
| `level`     | `1-6`     | `1`     | 标题层级                        |
| `as`        | `h1-h6`   | —       | 覆盖渲染标签                    |
| `display`   | `boolean` | `false` | 使用展示级字号 (level=1 only)   |
| `titleLg`   | `boolean` | `false` | 使用加大标题字号 (level=1 only) |
| `className` | `string`  | —       | 额外样式                        |

### Text

正文文本组件，variant 控制层级。

```tsx
import { Text } from '@/components/ui/typography';

<Text>Default body text</Text>                      // -> text-body (16px)
<Text variant="lg">Lead paragraph</Text>            // -> text-body-lg (20px)
<Text variant="sm">Secondary text</Text>            // -> text-body-sm (14px)
<Text variant="caption">Hint or timestamp</Text>    // -> text-caption (12px, renders <span>)
<Text variant="overline">CATEGORY</Text>            // -> text-overline (12px uppercase, renders <span>)

// Muted 颜色
<Text variant="sm" muted>Description text</Text>    // -> text-body-sm text-muted-foreground

// 覆盖标签
<Text as="div" variant="lg">Block text</Text>
```

**Props:**

| Prop        | Type                                                   | Default     | 说明            |
| ----------- | ------------------------------------------------------ | ----------- | --------------- |
| `variant`   | `'lg' \| 'default' \| 'sm' \| 'caption' \| 'overline'` | `'default'` | 文本变体        |
| `as`        | `React.ElementType`                                    | auto        | 覆盖渲染标签    |
| `muted`     | `boolean`                                              | `false`     | 使用 muted 颜色 |
| `className` | `string`                                               | —           | 额外样式        |

---

## PageHeader 组件

统一全站页面标题区域，定义在 `components/layout/page-header.tsx`。

```tsx
import { PageHeader } from '@/components/layout/page-header';

// 基础用法
<PageHeader
  title={t('title')}
  description={t('description')}
  icon={BookOpen}
  color="violet"
/>

// 带操作按钮
<PageHeader
  title={t('title')}
  description={t('description')}
  icon={PenTool}
  color="rose"
  actions={<Button>Create New</Button>}
/>

// 带统计卡片
<PageHeader
  title={t('title')}
  description={t('description')}
  icon={Users}
  color="indigo"
  stats={[
    { label: 'Total', value: 100, icon: Users, color: 'text-blue-500' },
  ]}
/>
```

---

## CardTitle

`CardTitle` 默认字号为 `text-lg` (18px)。

- 新代码中不要再写 `<CardTitle className="text-lg">`，直接 `<CardTitle>` 即可。
- 如需更小/更大的卡片标题，可以覆盖为 `text-base` 或 `text-xl`，但请确认确实必要。

---

## 使用示例

### 页面标题

```tsx
// 方式 1: 使用 PageHeader（推荐，自带图标+描述+操作区域）
<PageHeader title={t('title')} description={t('desc')} icon={BookOpen} color="blue" />

// 方式 2: 使用 Typography token 类（自定义布局时）
<h1 className="text-title">{t('title')}</h1>
<p className="text-body-sm text-muted-foreground">{t('desc')}</p>
```

### Section 标题

```tsx
<h2 className="text-subtitle">{t('section.title')}</h2>

// 或使用 Heading 组件
<Heading level={2}>{t('section.title')}</Heading>
```

### 正文

```tsx
<Text>This is default body text at 16px.</Text>
<Text variant="sm" muted>This is a secondary description at 14px.</Text>
<Text variant="caption">Last updated: 2026-01-01</Text>
```

### 表单标签

使用已有的 Radix Label 组件即可（已默认 `text-sm font-medium`）。

---

## 禁止事项

### 1. 禁止使用任意字号值

```tsx
// ❌ 禁止
<span className="text-[10px]">...</span>
<p className="text-[13px]">...</p>

// ✅ 正确
<span className="text-2xs">...</span>    // 10px
<p className="text-caption">...</p>      // 12px
```

### 2. 禁止在 h1 上裸用 Tailwind 字号

```tsx
// ❌ 禁止
<h1 className="text-2xl font-bold sm:text-3xl">Title</h1>

// ✅ 正确
<h1 className="text-title">Title</h1>
```

### 3. 避免 CardTitle 冗余覆盖

```tsx
// ❌ 冗余（text-lg 已是默认值）
<CardTitle className="text-lg">Title</CardTitle>

// ✅ 正确
<CardTitle>Title</CardTitle>
```

---

## CI 检测

Typography 规范通过 CI 脚本 `scripts/check-typography.ts` 自动检测：

```bash
pnpm --filter web lint:typography
```

检测规则：

| 规则                       | 级别    | 说明                                    |
| -------------------------- | ------- | --------------------------------------- |
| `no-arbitrary-font-size`   | Error   | 禁止 `text-[Npx]` 等任意字号值          |
| `card-title-size-override` | Warning | CardTitle 上显式 text-\* 覆盖提醒       |
| `h1-raw-tailwind-size`     | Warning | h1 标签使用散落 Tailwind 字号而非 token |

- Error 级会阻塞 CI
- Warning 级仅输出提醒，不阻塞

---

## 排版层级映射速查

```
Landing Hero    → text-display / Heading level={1} display
Landing Section → text-title-lg / Heading level={1} titleLg / SectionHeader
App Page Title  → text-title / PageHeader / Heading level={1}
Section Heading → text-subtitle / Heading level={2}
Subsection      → text-body-lg font-semibold / Heading level={3}
Card Title      → CardTitle (默认 text-lg)
Body Text       → text-body / Text
Secondary Text  → text-body-sm / Text variant="sm"
Form Label      → Label 组件
Hint/Timestamp  → text-caption / Text variant="caption"
Category Tag    → text-overline / Text variant="overline"
Badge/Mini      → text-2xs
```

---

_最后更新: 2026-02-13_

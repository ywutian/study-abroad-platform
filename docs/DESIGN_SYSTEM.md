# 🎨 留学申请平台 - 设计系统规范

> 版本: 2.1.0 | 最后更新: 2026-02-13
>
> **设计风格: 学术严肃风 (Academic Professional)**

---

## 📋 目录

1. [设计理念](#设计理念)
2. [色彩系统](#色彩系统)
3. [排版系统](#排版系统)
4. [间距系统](#间距系统)
5. [圆角系统](#圆角系统)
6. [阴影系统](#阴影系统)
7. [组件规范](#组件规范)
8. [页面布局](#页面布局)
9. [动效规范](#动效规范)
10. [暗色模式](#暗色模式)

---

## 设计理念

### 核心原则

| 原则         | 描述                                             |
| ------------ | ------------------------------------------------ |
| **专业可信** | 现代蓝品牌色，传递权威与信任感                   |
| **简洁克制** | 去除发光阴影和复杂渐变，使用实体边框             |
| **现代感**   | Geist Sans 字体 + 系统中文字体，兼具现代与专业感 |
| **一致性**   | 统一的组件风格，可预期的交互模式                 |

### 视觉风格变更 (v2.1)

```
┌─────────────────────────────────────────────────────────────┐
│  ❌ 去掉: 发光阴影、蓝青渐变、大圆角、旋转动画              │
│  ✅ 新增: 实体边框、学院配色、小圆角、简洁过渡              │
└─────────────────────────────────────────────────────────────┘
```

- **边框优先**: 使用 2px 实体边框替代发光阴影
- **单色主导**: 主色为现代蓝 (`oklch(0.58 0.22 255)`)，强调色为砖红
- **克制动效**: 仅保留入场动画和必要的状态反馈

---

## 色彩系统

### 主色板

| 名称            | 亮色模式               | 暗色模式               | 用途                 |
| --------------- | ---------------------- | ---------------------- | -------------------- |
| **Primary**     | `oklch(0.58 0.22 255)` | `oklch(0.65 0.20 255)` | 主要操作、链接、重点 |
| **Success**     | `oklch(0.68 0.18 155)` | `oklch(0.72 0.16 155)` | 成功状态、录取       |
| **Warning**     | `oklch(0.78 0.15 75)`  | `oklch(0.80 0.14 75)`  | 警示、候补           |
| **Destructive** | `oklch(0.60 0.20 25)`  | `oklch(0.65 0.18 25)`  | 错误、拒绝、删除     |

### 语义色彩映射

| 场景              | 颜色   | CSS 变量             |
| ----------------- | ------ | -------------------- |
| 录取 (Admitted)   | 森林绿 | `var(--success)`     |
| 拒绝 (Rejected)   | 砖红色 | `var(--destructive)` |
| 候补 (Waitlisted) | 土黄色 | `var(--warning)`     |
| 延迟 (Deferred)   | 靛蓝色 | `var(--primary)`     |
| AI 功能           | 紫罗兰 | `violet-700`         |
| 排名/榜单         | 土黄色 | `var(--warning)`     |

### 禁用的配色

以下配色在 v2.1 中**禁止使用**，以避免"AI风格"：

```css
/* ❌ 禁止 */
bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400
shadow-lg shadow-blue-500/25
shadow-primary/30
```

---

## 排版系统

### 字体栈

```css
/* UI + 正文字体 - Geist Sans (Vercel) + 系统中文字体 */
--font-sans:
  var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
  'Microsoft YaHei UI', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC',
  'WenQuanYi Micro Hei', sans-serif;

/* 代码字体 - Geist Mono */
--font-mono:
  var(--font-geist-mono), 'SFMono-Regular', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
```

> **注意**: 项目不使用 `--font-serif` 变量。所有文本统一使用 Geist Sans。

### 字体使用场景

| 场景             | 字体        | 示例                 |
| ---------------- | ----------- | -------------------- |
| 导航、按钮、标签 | `font-sans` | 登录、注册、提交     |
| 页面标题         | `font-sans` | 个人档案、录取预测   |
| 正文段落         | `font-sans` | 案例描述、文章内容   |
| 数据展示         | `font-sans` | GPA: 3.8、TOEFL: 110 |
| 代码/ID          | `font-mono` | #ABC123              |

### 排版阶梯（Design Token）

基于 `globals.css` 中定义的 CSS 工具类：

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

> `text-2xs` 是 Tailwind 扩展类（`@theme inline`），其余 `.text-*` 是自定义 CSS 类。

### Typography 组件

**Heading** — 语义化标题组件：

```tsx
<Heading level={1}>Page Title</Heading>     // text-title (24-30px)
<Heading level={2}>Section</Heading>        // text-subtitle (24px)
<Heading level={1} display>Hero</Heading>   // text-display (38-46px)
<Heading level={1} titleLg>Marketing</Heading> // text-title-lg (30-38px)
<Heading level={1} as="h2">Visually large</Heading> // 覆盖渲染标签
```

**Text** — 正文文本组件：

```tsx
<Text>Default body text</Text>                   // text-body (16px)
<Text variant="lg">Lead paragraph</Text>         // text-body-lg (20px)
<Text variant="sm" muted>Description</Text>      // text-body-sm + muted
<Text variant="caption">Timestamp</Text>         // text-caption (12px)
```

### 排版层级速查

```
Landing Hero    → text-display / Heading level={1} display
Landing Section → text-title-lg / Heading level={1} titleLg
App Page Title  → text-title / PageHeader / Heading level={1}
Section Heading → text-subtitle / Heading level={2}
Card Title      → CardTitle (默认 text-lg)
Body Text       → text-body / Text
Secondary Text  → text-body-sm / Text variant="sm"
Form Label      → Label 组件
Hint/Timestamp  → text-caption / Text variant="caption"
Badge/Mini      → text-2xs
```

### 排版禁止事项

- 禁止任意字号值（`text-[10px]`），使用 design token
- 禁止 h1 裸用 Tailwind 字号，使用 `text-title`
- CardTitle 默认 `text-lg`，不需要冗余覆盖
- CI 脚本 `pnpm --filter web lint:typography` 自动检测

---

## 间距系统

### 基础间距

基于 4px 网格系统:

| Token      | 值   | 用途         |
| ---------- | ---- | ------------ |
| `space-1`  | 4px  | 紧凑元素间距 |
| `space-2`  | 8px  | 内联元素间距 |
| `space-3`  | 12px | 紧凑组件间距 |
| `space-4`  | 16px | 标准组件间距 |
| `space-6`  | 24px | 卡片内边距   |
| `space-8`  | 32px | 区块间距     |
| `space-12` | 48px | 大区块间距   |
| `space-16` | 64px | 页面区块间距 |

---

## 圆角系统

v2.1 使用更小的圆角，传递严肃专业感：

| Token          | 值     | 用途                |
| -------------- | ------ | ------------------- |
| `rounded-sm`   | 4px    | 小元素              |
| `rounded-md`   | 6px    | 按钮、输入框、Badge |
| `rounded-lg`   | 8px    | 卡片、弹窗          |
| `rounded-xl`   | 12px   | 大卡片、页面区块    |
| `rounded-full` | 9999px | 圆形头像            |

### 当前配置

```css
/* globals.css */
--radius: 0.75rem; /* 12px */
```

---

## 阴影系统

v2.1 大幅简化阴影，改用边框强调层级：

### 标准阴影

```css
/* 卡片阴影 - 仅用于悬浮状态 */
--shadow-card: 0 1px 2px oklch(0 0 0 / 5%);

/* 悬浮阴影 */
--shadow-elevated: 0 2px 8px oklch(0 0 0 / 8%);
```

### 禁用的阴影效果

```css
/* ❌ 禁止使用发光阴影 */
shadow-primary/30
shadow-blue-500/25
shadow-lg shadow-cyan-500/40
```

### 替代方案

使用 **2px 实体边框** 替代发光阴影：

```tsx
// ❌ 旧
<Button className="shadow-lg shadow-primary/30" />

// ✅ 新
<Button className="border-2 border-primary" />
```

---

## 组件规范

### Button

#### 变体

| 变体      | 用途     | 样式特点                |
| --------- | -------- | ----------------------- |
| `default` | 主要操作 | 实色背景 + 2px 边框     |
| `outline` | 次要操作 | 透明背景 + 2px 边框     |
| `ghost`   | 辅助操作 | 仅悬浮时显示背景        |
| `soft`    | 柔和强调 | 低透明度背景 + 1px 边框 |

#### 尺寸

| 尺寸      | 高度 | 用途             |
| --------- | ---- | ---------------- |
| `sm`      | 32px | 表格内、紧凑区域 |
| `default` | 40px | 标准按钮         |
| `lg`      | 48px | 重要CTA          |
| `xl`      | 56px | Hero区域CTA      |

#### 代码示例

```tsx
// 主要按钮
<Button>提交申请</Button>

// 次要按钮
<Button variant="outline">取消</Button>

// 强调按钮（谨慎使用）
<Button variant="gradient">立即注册</Button>
```

### Card

#### 结构

```tsx
<Card>
  {/* 可选: 顶部装饰条 - 使用实色 */}
  <div className="h-1 bg-primary" />

  <CardHeader>
    <div className="flex items-center gap-3">
      {/* 图标容器 - 方形带边框 */}
      <div className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-primary/20 bg-primary/5 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <CardTitle>标题</CardTitle>
        <CardDescription>描述</CardDescription>
      </div>
    </div>
  </CardHeader>

  <CardContent>{/* 内容 */}</CardContent>
</Card>
```

#### 装饰条颜色映射

| 功能模块  | 颜色                  |
| --------- | --------------------- |
| 档案/个人 | `bg-primary`          |
| AI/预测   | `bg-violet-700`       |
| 排名/榜单 | `bg-warning`          |
| 案例/录取 | `bg-success`          |
| 设置/安全 | `bg-muted-foreground` |

### Badge

#### 变体使用

| 变体          | 用途             |
| ------------- | ---------------- |
| `default`     | 主要标签（靛蓝） |
| `secondary`   | 普通标签         |
| `success`     | 录取、成功状态   |
| `warning`     | 候补、注意事项   |
| `destructive` | 拒绝、错误       |

---

## 页面布局

### 页面头部模板

v2.1 简化页面头部，去除光晕装饰：

```tsx
{
  /* 页面头部 - 学术风 */
}
<div className="mb-8 border-b pb-6">
  <div className="flex items-center gap-4">
    {/* 图标 */}
    <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-primary/20 bg-primary/5">
      <Icon className="h-6 w-6 text-primary" />
    </div>
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">页面标题</h1>
      <p className="text-muted-foreground">页面描述</p>
    </div>
  </div>
</div>;
```

---

## 动效规范

### 保留的动画

| 动画                 | 时长  | 用途         |
| -------------------- | ----- | ------------ |
| `animate-fade-in`    | 300ms | 页面元素淡入 |
| `animate-fade-in-up` | 350ms | 卡片、列表项 |
| `animate-scale-in`   | 200ms | 弹窗、菜单   |

### 禁用的动画

```tsx
// ❌ 禁止无意义的持续动画
animate={{ rotate: [0, 360] }}
animate={{ scale: [1, 1.3, 1] }}
animate-pulse-glow
```

### 交互动画

| 交互     | 效果                      |
| -------- | ------------------------- |
| 按钮点击 | `active:scale-[0.98]`     |
| 卡片悬浮 | `hover:border-primary/30` |
| 链接悬浮 | `hover:text-primary`      |

### 游戏化动效 (Hall Swipe Game)

| 动画     | 实现                                             | 用途                              |
| -------- | ------------------------------------------------ | --------------------------------- |
| 卡片滑出 | `exit={{ x: ±300, opacity: 0, scale: 0.8 }}`     | SwipeStack 卡片滑动退出           |
| 角标印章 | `useTransform(x, [0, 80], [0, 1])`               | SwipeCard 拖动时显示 ADMIT/REJECT |
| 渐变叠加 | `linear-gradient` 跟随拖动方向                   | SwipeCard 拖动时背景色变化        |
| 连胜火焰 | `animate={{ scale: [1, 1.2, 1] }}` (streak >= 3) | StatsPanel 连胜脉冲               |
| 结果反馈 | `spring(damping: 20, stiffness: 300)`            | SwipeResultOverlay 弹入           |
| 完成庆祝 | `animate={{ rotate: [0, -10, 10, 0] }}`          | DailyChallenge 礼物摇晃           |
| 列表错开 | `transition={{ delay: index * 0.05 }}`           | LeaderboardList 逐项入场          |

### 可复用动效组件

- **`AnimatedCounter`** — 使用 `easeOutExpo` 缓动函数的数字动画，支持 IntersectionObserver 视口触发、小数位、分隔符。位于 `components/ui/animated-counter.tsx`。
- **`SwipeResultOverlay`** — 可复用预测结果反馈浮层，支持正确/错误、积分、连胜显示。位于 `components/features/hall/SwipeResultOverlay.tsx`。

---

## 暗色模式

### 设计原则

1. **温暖深色**: 使用带暖色调的深色背景，非纯黑
2. **适度提亮**: 主色在暗色模式下亮度提升 15%
3. **边框可见**: 确保边框在暗色下可见

### 关键色值对比

| 元素 | 亮色                     | 暗色                    |
| ---- | ------------------------ | ----------------------- |
| 背景 | `oklch(0.988 0.002 260)` | `oklch(0.11 0.015 260)` |
| 卡片 | `oklch(1 0 0)`           | `oklch(0.16 0.018 260)` |
| 主色 | `oklch(0.58 0.22 255)`   | `oklch(0.68 0.20 255)`  |
| 边框 | `oklch(0.92 0.008 260)`  | `oklch(0.22 0.01 260)`  |

---

## 检查清单

### v2.1 迁移检查

- [x] 字体更换为 Geist Sans + 系统中文字体
- [x] 主色更换为现代蓝 `oklch(0.58 0.22 255)`
- [x] 圆角设为 `0.75rem`
- [x] 按钮去除发光阴影，改用 2px 边框
- [x] Hero 区域去除蓝青渐变
- [ ] 检查所有 `shadow-*-500/` 并移除
- [ ] 检查所有 `from-*-400 via-*-400 to-*-400` 并移除

### 组件优化检查

- [ ] 图标容器使用方形 + 边框（非圆形渐变）
- [ ] Badge 使用实色背景（非渐变）
- [ ] 按钮使用边框强调（非阴影）
- [ ] 间距遵循 4px 网格

---

## 快速参考

### 常用类名组合

```css
/* 图标容器 (学术风) */
.icon-container = "flex h-10 w-10 items-center justify-center rounded-md border-2 border-primary/20 bg-primary/5 text-primary"

/* 页面头部 */
.page-header = "mb-8 border-b pb-6"

/* 主按钮 */
.btn-primary = "bg-primary text-primary-foreground border-2 border-primary hover:bg-primary/90"

/* 卡片顶部条 */
.card-top-bar = "h-1 bg-primary"

/* 简洁徽章 */
.badge-academic = "rounded-md border-2 border-primary/30 bg-primary/5 px-3 py-1"
```

---

_此设计系统规范 v2.1 采用「学术严肃风」，旨在传递专业、可信赖的品牌形象。_

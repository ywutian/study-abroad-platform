# 前端架构问题

> 范围: Web 497 TSX · 30 路由 · 61 UI 组件 · Mobile 27 组件 · Shared 包

---

## F1：Mobile 4 个页面未拆分（1500+ 行）🔴

### 现状

| 文件                                            | 行数  | Web 对应                    |
| ----------------------------------------------- | ----- | --------------------------- |
| `apps/mobile/src/app/(tabs)/hall.tsx`           | 1,948 | Web 用 \_components/ 拆分 ✓ |
| `apps/mobile/src/app/(tabs)/recommendation.tsx` | 1,745 | Web 用 hooks + 组件 ✓       |
| `apps/mobile/src/app/(tabs)/swipe.tsx`          | 1,641 | Web 拆分 ✓                  |
| `apps/mobile/src/app/(tabs)/essay-gallery.tsx`  | 1,601 | Web 拆分 ✓                  |

Web 前端有严格的 500 行限制 + `_components/` 模式，但 Mobile 完全没有。

### 影响

- 维护困难，单文件修改风险高
- 无法复用子组件
- 代码审查困难

### 修复方案

参照 Web 的模式，为每个大页面创建 `_components/` 目录，提取子组件。

---

## F2：Dynamic Tailwind（生产会被清除）🔴

### 位置

`apps/web/src/components/features/hall/SwipeStack.tsx`

包含 `` `bg-${color}-500` `` 等动态 Tailwind 类名，会被 Tailwind 的 PurgeCSS 清除，导致生产环境样式丢失。

### 修复

改为静态类名映射：

```typescript
const COLOR_CLASSES = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
  green: { bg: 'bg-green-500/10', text: 'text-green-600' },
  // ...
};
```

### 工作量: 极小

---

## F3：next/image 使用不足 🟡

### 现状

497 个 TSX 文件中只有 **1 个**使用 `next/image`，另有 7 处使用原生 `<img>` 标签。

**影响**:

- 无自动图片优化（WebP 转换、尺寸调整）
- 无 lazy loading（除非手动加）
- LCP 指标受影响

### 修复方案

逐步将 `<img>` 标签替换为 `next/image`，优先处理首屏图片。

---

## F4：Accessibility 覆盖低 🟡

### 现状

- 约 6% 的 TSX 文件有显式 `aria-label` 或 `alt` 属性
- Icon button 普遍缺少 `aria-label`
- `jsx-a11y` ESLint 插件已配置但覆盖有限
- 已有 `AIErrorBoundary` 但从未使用

### 修复方案

1. 审查所有 icon button，补充 `aria-label`
2. 审查所有 `<img>` 标签，确保有 `alt` 属性
3. 在 AI 功能组件外层包裹 `AIErrorBoundary`
4. 考虑运行 Lighthouse 可访问性审计

---

## F5：Mobile 与 Web 代码零共享 🟡

### 现状

`packages/shared` 有类型定义和算法，被双方使用。但：

- API hooks 完全独立（Web 用 React Query + custom hooks，Mobile 用 useState + fetch）
- 组件完全独立（Web 61 个 UI 组件，Mobile 27 个独立组件）
- 状态管理模式不同（Web: Zustand 2 store，Mobile: Zustand 3 store + 不同结构）
- AI 流式处理实现完全不同
- 错误处理模式不同

### 影响

- 同一功能要改两次
- 行为不一致（Web 有 timeout，Mobile 无）
- Bug 修复不同步

### 建议

长期考虑：

1. 提取 API 调用层到 shared（`@study-abroad/api-client`）
2. 共享 AI streaming hook 的核心逻辑
3. 共享类型已有，继续维护

---

## 做得好的前端部分

| 方面         | 状态    | 详情                                |
| ------------ | ------- | ----------------------------------- |
| 路由结构     | ✅ 优秀 | 30 路由清晰组织，(main)/(auth) 分离 |
| 页面拆分     | ✅ 优秀 | 所有 >500 行页面都有 \_components/  |
| Loading 状态 | ✅ 优秀 | 57 个 loading.tsx 骨架屏            |
| Error 边界   | ✅ 良好 | 4 个 error.tsx 覆盖主要 layout      |
| UI 组件库    | ✅ 优秀 | 61 个组件 + barrel export           |
| 状态管理     | ✅ 优秀 | Zustand(app) + React Query(server)  |
| Auth 安全    | ✅ 优秀 | httpOnly cookie + 内存 token        |
| i18n         | ✅ 优秀 | 369 文件使用，en/zh 5631/5636 行    |
| API 客户端   | ✅ 优秀 | 401 自动重试、timeout、error i18n   |
| CSP          | ✅ 良好 | 已配置，dev 允许 unsafe-inline      |

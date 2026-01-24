# Study Abroad Platform - Mobile App

React Native 移动端应用，基于 Expo 构建。

## 技术栈

- **框架**: React Native 0.81.5 + Expo SDK 54
- **路由**: Expo Router 6 (基于文件系统的路由)
- **状态管理**: Zustand 5
- **数据获取**: TanStack Query 5 (React Query)
- **国际化**: i18next + react-i18next
- **动画**: Reanimated 4 + react-native-worklets
- **列表**: FlashList v2 (@shopify/flash-list)
- **UI组件**: 自定义组件库 (26个组件文件)
- **测试**: Jest 29 + React Native Testing Library
- **React**: 19.1

## 项目结构

```
src/
├── app/                    # Expo Router 页面
│   ├── (auth)/            # 认证相关页面
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/            # 主Tab页面
│   │   ├── index.tsx      # 首页
│   │   ├── schools.tsx    # 学校列表
│   │   ├── cases.tsx      # 案例库
│   │   ├── ai.tsx         # AI助手
│   │   └── profile.tsx    # 个人中心
│   ├── school/[id].tsx    # 学校详情
│   ├── case/[id].tsx      # 案例详情
│   └── _layout.tsx        # 根布局
├── components/
│   ├── ui/                # 基础UI组件
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Loading.tsx
│   │   ├── Modal.tsx
│   │   ├── Select.tsx
│   │   ├── Tabs.tsx
│   │   ├── Toast.tsx
│   │   └── ...
│   ├── features/          # 功能组件
│   └── layout/            # 布局组件
├── hooks/                 # 自定义Hooks
├── lib/
│   ├── api/              # API客户端
│   ├── i18n/             # 国际化配置
│   │   ├── index.ts
│   │   └── locales/
│   │       ├── zh.json
│   │       └── en.json
│   └── storage/          # 存储工具
├── stores/               # Zustand状态管理
│   ├── auth.ts
│   ├── theme.ts
│   └── index.ts
├── types/                # TypeScript类型定义
└── utils/                # 工具函数
    └── theme.ts          # 主题配置
```

## 功能模块

### 已实现

- [x] 认证系统 (登录/注册/忘记密码)
- [x] 首页 (快捷操作/统计/热门学校/最新案例)
- [x] 学校列表 (搜索/排序/筛选/无限滚动)
- [x] 学校详情 (概览/排名/截止日期/文书题目/相关案例)
- [x] 案例库 (搜索/筛选/分页)
- [x] 案例详情 (背景/成绩/活动/奖项/建议)
- [x] AI助手 (流式输出/多模式/建议问题)
- [x] 个人中心 (档案管理/设置)
- [x] 主题切换 (明亮/暗黑/跟随系统)
- [x] 国际化 (中文/英文)
- [x] 实时聊天 (Socket.IO)
- [x] 生物识别认证

### 待实现

- [ ] 关注系统
- [ ] 功能大厅
- [ ] 预测功能
- [ ] 排名自定义
- [ ] 管理后台
- [ ] 推送通知

## 开发

### 环境要求

- Node.js 18+
- pnpm 10+
- iOS: Xcode 15+ (macOS)
- Android: Android Studio / SDK

### 安装依赖

```bash
# 在项目根目录
pnpm install
```

### 启动开发服务器

```bash
# 启动 Expo 开发服务器
pnpm --filter study-abroad-mobile start

# iOS 模拟器
pnpm --filter study-abroad-mobile ios

# Android 模拟器
pnpm --filter study-abroad-mobile android

# Web 预览
pnpm --filter study-abroad-mobile web
```

### 运行测试

```bash
# 运行所有测试
pnpm --filter study-abroad-mobile test

# 监视模式
pnpm --filter study-abroad-mobile test:watch

# 覆盖率报告
pnpm --filter study-abroad-mobile test:coverage
```

### 代码检查

```bash
pnpm --filter study-abroad-mobile lint
```

## 环境变量

创建 `.env` 文件:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

## 构建

### 开发版本

```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```

### 生产版本

```bash
# iOS
eas build --profile production --platform ios

# Android
eas build --profile production --platform android
```

## UI组件库

自定义组件库包含26个组件文件，支持:

- 响应式设计
- 暗黑模式
- 无障碍访问

核心组件:

- `Button` - 按钮 (6种变体, 4种尺寸)
- `Input` - 输入框 (支持密码切换/错误提示)
- `Card` - 卡片 (Header/Content/Footer)
- `Badge` / `StatusBadge` - 徽章
- `Avatar` - 头像 (4种尺寸/组合模式)
- `Loading` / `Skeleton` / `LoadingOverlay` - 加载状态
- `EmptyState` / `ErrorState` - 空状态/错误状态
- `Tabs` / `Segment` - 选项卡/分段控制器
- `Modal` / `BottomSheet` - 模态框/底部弹出框
- `Select` / `MultiSelect` - 选择器
- `Slider` - 滑块
- `Switch` - 开关
- `Checkbox` / `Radio` - 复选框/单选框
- `Toast` - 轻提示
- `SearchBar` - 搜索栏
- `ListItem` / `Separator` - 列表项/分隔线
- `ProgressBar` / `CircularProgress` - 进度条/环形进度
- `ConfirmDialog` - 确认对话框
- `BlurImage` - 渐进式图片加载

动画组件:

- `AnimatedButton` - 动画按钮
- `AnimatedCard` - 动画卡片
- `AnimatedSkeleton` - 动画骨架屏
- `AnimatedListItem` - 动画列表项
- `AnimatedCounter` - 数字动画
- `FadeInView` - 淡入视图

## 测试

测试覆盖:

- 单元测试: UI组件、Hooks、Stores
- 集成测试: 屏幕级别测试
- 快照测试: 组件渲染

```bash
# 运行测试
pnpm --filter study-abroad-mobile test

# 生成覆盖率报告
pnpm --filter study-abroad-mobile test:coverage
```

## 贡献指南

1. 遵循项目编码规范
2. 新功能需要添加测试
3. 提交前运行 lint 和 test
4. 使用语义化提交信息

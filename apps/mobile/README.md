# Study Abroad Platform - Mobile App

React Native 移动端应用，基于 Expo 构建。

## 技术栈

- **框架**: React Native 0.74 + Expo 51
- **路由**: Expo Router (基于文件系统的路由)
- **状态管理**: Zustand
- **数据获取**: TanStack Query (React Query)
- **国际化**: i18next + react-i18next
- **UI组件**: 自定义组件库 (32个组件)
- **测试**: Jest + React Native Testing Library

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

### 待实现

- [ ] 聊天功能
- [ ] 关注系统
- [ ] 功能大厅
- [ ] 预测功能
- [ ] 排名自定义
- [ ] 管理后台
- [ ] 推送通知

## 开发

### 环境要求

- Node.js 18+
- pnpm 8+
- iOS: Xcode 15+ (macOS)
- Android: Android Studio / SDK

### 安装依赖

```bash
cd apps/mobile
pnpm install
```

### 启动开发服务器

```bash
# 启动 Expo 开发服务器
pnpm start

# iOS 模拟器
pnpm ios

# Android 模拟器
pnpm android

# Web 预览
pnpm web
```

### 运行测试

```bash
# 运行所有测试
pnpm test

# 监视模式
pnpm test:watch

# 覆盖率报告
pnpm test:coverage
```

### 代码检查

```bash
pnpm lint
```

## 环境变量

创建 `.env` 文件:

```env
EXPO_PUBLIC_API_URL=http://your-api-url:3002
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

自定义组件库包含32个组件，支持:

- 响应式设计
- 暗黑模式
- 无障碍访问

组件列表:

- `Button` - 按钮 (6种变体, 4种尺寸)
- `Input` - 输入框 (支持密码切换/错误提示)
- `Card` - 卡片 (Header/Content/Footer)
- `Badge` - 徽章 (6种变体)
- `Avatar` - 头像 (4种尺寸/组合模式)
- `Loading` - 加载状态 (骨架屏/覆盖层)
- `EmptyState` - 空状态
- `ErrorState` - 错误状态
- `Tabs` - 选项卡
- `Segment` - 分段控制器
- `Modal` - 模态框
- `BottomSheet` - 底部弹出框
- `Select` - 选择器 (单选/多选)
- `Slider` - 滑块
- `Switch` - 开关
- `Checkbox` - 复选框
- `Radio` - 单选框
- `Toast` - 轻提示
- `SearchBar` - 搜索栏
- `ListItem` - 列表项
- `ListGroup` - 列表组
- `Separator` - 分隔线
- `ProgressBar` - 进度条
- `CircularProgress` - 环形进度
- `Stat` - 统计数据

## 测试

测试覆盖:

- 单元测试: UI组件、Hooks、Stores
- 集成测试: 屏幕级别测试
- 快照测试: 组件渲染

```bash
# 运行测试
pnpm test

# 生成覆盖率报告
pnpm test:coverage
```

## 贡献指南

1. 遵循项目编码规范
2. 新功能需要添加测试
3. 提交前运行 lint 和 test
4. 使用语义化提交信息

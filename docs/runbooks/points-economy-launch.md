# 积分系统开放 Runbook

最后更新：2026-08-11

## 目的

积分系统当前未开放。本文记录未来如何安全开放、验证和回滚，防止只修改前端、后端或数据库中的一个开关而产生半开放状态。

## 当前状态与双闸门

积分系统只有在以下两个条件同时成立时才会计分、扣分或允许兑换：

1. 构建期产品总闸门 `POINTS_ECONOMY_AVAILABLE` 为 `true`。
2. 运行时设置 `points_enabled` 为 `true`。

产品总闸门位于 `packages/shared/src/constants/index.ts`，由 API、Web 导航、页面直达保护和 Full UI 注册表共同引用。当前值为 `false`，因此：

- 后端 `PointsConfigService.isEnabled()` 永远返回 `false`；
- 旧的 `points_enabled=true` 数据不能意外恢复计分或扣分；
- 管理后台不显示“积分兑换”；
- 直接访问 `/admin/points-redemptions` 只呈现带 `noindex` 的“功能未开放”状态，不挂载积分业务页面，也不请求积分 API；
- Full UI 验证的是“入口隐藏、直达仅显示未开放状态且不请求积分 API”，不是积分业务页面。

## 开放前置条件

在修改产品总闸门前完成以下检查：

- 产品确认积分获取、扣减、退款、过期和申诉规则；
- 法务确认积分不是现金、不可提现，并确认地区性条款；
- 数据团队确认初始余额和历史 `PointHistory` 是否迁移、清零或保留；
- 客服和运营具备兑换履约、取消退款、异常补偿流程；
- 已验证所有收费型 AI 操作失败后会退款；
- 已设置监控：负余额、重复记账、兑换积压、退款失败和单用户异常增长；
- staging 已跑完 API 单元测试和 Full UI。

## 开放步骤

### 1. 先锁住运行时开关

在部署开放产品总闸门之前，先用管理员令牌显式写入 `false`，避免数据库中遗留的 `true` 在新版本部署后立即生效：

```bash
export POINTS_API_BASE='https://api.example.com/api/v1'
read -s "POINTS_ADMIN_TOKEN?Admin access token: "
export POINTS_ADMIN_TOKEN
echo

curl --fail-with-body \
  -X PUT "$POINTS_API_BASE/admin/points/toggle" \
  -H "Authorization: Bearer $POINTS_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"enabled":false}'

curl --fail-with-body \
  "$POINTS_API_BASE/admin/points/config" \
  -H "Authorization: Bearer $POINTS_ADMIN_TOKEN"
```

确认返回的 `enabled` 为 `false`。不要把真实令牌写入 shell 历史、文档或提交。

### 2. 打开构建期产品总闸门

将 `packages/shared/src/constants/index.ts` 中的：

```typescript
export const POINTS_ECONOMY_AVAILABLE = false;
```

改为：

```typescript
export const POINTS_ECONOMY_AVAILABLE = true;
```

不要分别在 API 和 Web 创建第二个常量。一次修改应同时改变后端保护、管理导航、直达页面和 Full UI 的验收模式。

### 3. 在运行时仍关闭的状态下构建和验证

```bash
pnpm --filter @study-abroad/shared build
pnpm --filter api test -- points-config.service points-redemption.service incentive.service
pnpm --filter api build
pnpm --filter web exec tsc --noEmit --pretty false
FULL_UI_ROUTE_FILTER='=/admin/points-redemptions' pnpm test:e2e:web:full-ui --reporter=line
```

预期结果：管理入口和页面已经可访问，但 `GET /admin/points/config` 的 `enabled` 仍为 `false`，用户不计分、不扣分、不能兑换。

### 4. 配置规则并做 staging 验收

运行时开关保持 `false`，通过管理员 API 设置并复核各行为分值。支持单项接口 `PUT /admin/points/actions/:action` 和批量接口 `PUT /admin/points/actions`。

至少验证：

- 获取积分只产生一次账本记录；
- 并发扣分不会形成负余额；
- 兑换扣分与兑换单创建在同一事务中；
- 履约、取消与退款可审计且幂等；
- AI 调用失败会原额退款；
- 中英文以及桌面端、移动端展示正确；
- 管理端可查看待履约和已履约咨询。

### 5. 小流量启用运行时开关

完成审批后执行：

```bash
curl --fail-with-body \
  -X PUT "$POINTS_API_BASE/admin/points/toggle" \
  -H "Authorization: Bearer $POINTS_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"enabled":true}'
```

立即再次读取 `/admin/points/config`，确认 `enabled=true`。随后执行一笔受控获取、一笔受控扣减、一笔兑换和一笔取消退款，并核对用户余额、`PointHistory` 和 `PointsRedemption`。

## 发布门禁

开放提交不得合并，除非以下门禁全部通过：

```bash
pnpm --filter @study-abroad/shared lint
pnpm --filter api test -- points-config.service points-redemption.service incentive.service
pnpm --filter api build
pnpm --filter web exec tsc --noEmit --pretty false
FULL_UI_ROUTE_FILTER='=/admin/points-redemptions' pnpm test:e2e:web:full-ui --reporter=line
```

还必须人工确认管理侧边栏只对授权管理员显示，普通用户不存在任何积分入口，并检查日志中没有 `Insufficient points`、重复记账或退款失败异常峰值。

## 回滚

### 立即止损

优先将运行时开关关闭；这不需要重新部署：

```bash
curl --fail-with-body \
  -X PUT "$POINTS_API_BASE/admin/points/toggle" \
  -H "Authorization: Bearer $POINTS_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"enabled":false}'
```

关闭后确认不再产生新的 `PointHistory` 和兑换记录。不要删除历史账本或兑换数据。

### 完全撤回

将 `POINTS_ECONOMY_AVAILABLE` 改回 `false` 并重新部署。Full UI 应重新验证入口隐藏以及直达时只呈现带 `noindex` 的“功能未开放”状态。对事故窗口内的账本执行对账和补偿；不得通过直接修改余额绕过 `PointsService`。

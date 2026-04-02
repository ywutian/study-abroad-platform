# Codex Run Plan

- release_id: `prereq-regression-demo`
- registry_version: `2026-04-01.v3`
- impact_mapping_version: `2026-04-01.v1`

## Codex Must Run

- `A1` 注册 → 首次登录 → onboarding 恢复 | objective | 布局合理性 / 专业留学中介感
- `A2` 填写档案 | objective | 布局合理性 / 专业留学中介感
- `A3` AI：首次选校推荐 | objective | AI Agent 功能与输出合理性 / 专业留学中介感
- `A10` 预测 / 案例库 / 排名 | objective | 布局合理性 / 专业留学中介感
- `A11` 移动端一致性 | experiential | 布局合理性 / Web / Mobile 复用合理性 / 专业留学中介感
- `C1` admin Dashboard | admin-only | 布局合理性 / 专业留学中介感
- `SJ-2` Web 通知中心 / 通知页 | objective | 布局合理性 / 专业留学中介感
- `SJ-4` Admin 创建 MCP key → 外部 MCP 客户端调用工具 | objective | AI Agent 功能与输出合理性 / 专业留学中介感
- `SJ-3` Mobile 通知页 | experiential | Web / Mobile 复用合理性 / 专业留学中介感

## Notes

- Baseline Smoke IDs: `A1`, `A2`, `A3`, `A10`, `A11`, `C1`, `SJ-2`, `SJ-4`
- Impact rules hit: `notifications`

## 已知外部前置

- `A11` Android remote push / notification-open on a physical device [conditional]: Expo Android remote push depends on FCM initialization. Without a valid apps/mobile/android/app/google-services.json and a rebuilt physical-device dev build, token issuance and true remote push delivery cannot be verified. This is tracked as a conditional capability gate rather than a default core-runtime stop condition. 解锁条件：Install a valid apps/mobile/android/app/google-services.json, rebuild the Android dev build for a connected physical device, then rerun A11 and SJ-3 on that device.
- `SJ-3` Android remote push / notification-open on a physical device [conditional]: Expo Android remote push depends on FCM initialization. Without a valid apps/mobile/android/app/google-services.json and a rebuilt physical-device dev build, token issuance and true remote push delivery cannot be verified. This is tracked as a conditional capability gate rather than a default core-runtime stop condition. 解锁条件：Install a valid apps/mobile/android/app/google-services.json, rebuild the Android dev build for a connected physical device, then rerun A11 and SJ-3 on that device.

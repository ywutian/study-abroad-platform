# 人工 E2E 测试任务卡

| 字段               | 内容                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| `release_id`       | `prereq-regression-demo`                                                      |
| `journey_id`       | `SJ-3`                                                                        |
| `registry_version` | `2026-04-01.v3`                                                               |
| `persona`          | `applicant`                                                                   |
| `platform`         | `cross-platform`                                                              |
| `execution_owner`  | `human`                                                                       |
| `validation_type`  | `experiential`                                                                |
| `重点体验维度`     | Web / Mobile 复用合理性 / 专业留学中介感                                      |
| `参考 Rubric`      | docs/CROSS_PLATFORM_REUSE_RUBRIC.md / docs/PROFESSIONAL_CONSULTANCY_RUBRIC.md |

## 你要验证什么

确认 mobile 通知列表、未读数、打开后的感受与 web 一致且符合手机通知体验。

## 入口

- Mobile Notifications

## 操作步骤

1. 打开 mobile 通知页并查看未读状态。
2. 执行阅读、删除或全部已读。
3. 如本轮包含真机 push，点击通知进入目标页。

## 你应该看到什么

- 未读数与 web 基本一致。
- 列表动作反馈自然，没有误导。
- 打开通知后的感受像正式 app，而不是调试功能。

## 已知外部前置

- Android remote push / notification-open on a physical device [conditional]: Expo Android remote push depends on FCM initialization. Without a valid apps/mobile/android/app/google-services.json and a rebuilt physical-device dev build, token issuance and true remote push delivery cannot be verified. This is tracked as a conditional capability gate rather than a default core-runtime stop condition. 解锁条件：Install a valid apps/mobile/android/app/google-services.json, rebuild the Android dev build for a connected physical device, then rerun A11 and SJ-3 on that device.
- 如果本轮未提供上述前置，请把相关失败记为外部阻塞，不要把它写成页面本身坏了。

## 重点观察

- Web / Mobile 复用合理性
- 专业留学中介感

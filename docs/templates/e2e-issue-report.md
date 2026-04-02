# E2E 问题提报模板

> 适用对象：人工测试者、Codex、内部 owner。目标是让问题能直接被复现和分诊。

## 基本信息

| 字段                | 内容                                                                |
| ------------------- | ------------------------------------------------------------------- |
| `release_id`        |                                                                     |
| `journey_id`        |                                                                     |
| `step_no`           |                                                                     |
| `execution_owner`   | `codex / human / internal`                                          |
| `validation_type`   | `objective / experiential / admin-only`                             |
| `quality_dimension` | `layout / ai-quality / cross-platform / consultancy-quality / none` |
| `环境`              |                                                                     |
| `平台 / 设备`       |                                                                     |
| `账号`              |                                                                     |
| `时间`              | YYYY-MM-DD HH:mm                                                    |

## 问题描述

| 字段           | 内容                                |
| -------------- | ----------------------------------- |
| `标题`         | 一句话说清问题                      |
| `预期结果`     | 用户本来应该看到什么                |
| `实际结果`     | 用户实际看到了什么                  |
| `严重性`       | `critical / high / medium / low`    |
| `是否阻塞发版` | `yes / no`                          |
| `复现率`       | `always / often / sometimes / once` |

## 复现步骤

1.
2.
3.

## 附件

- 截图：
- 录屏：
- 证据目录：
- 关联 issue / ticket：

## 分诊补充（由 Codex 或内部 owner 填）

| 字段               | 内容                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `初步分类`         | `code bug / data issue / environment issue / design-content issue / expected but confusing` |
| `关联质量维度`     | `layout / ai-quality / cross-platform / consultancy-quality / none`                         |
| `初步根因`         |                                                                                             |
| `建议 owner`       |                                                                                             |
| `是否需要人工复验` | `yes / no`                                                                                  |
| `状态`             | `open / in-progress / verified / wontfix`                                                   |

# Impact Set

| 字段                     | 内容                     |
| ------------------------ | ------------------------ |
| `release_id`             | `prereq-regression-demo` |
| `registry_version`       | `2026-04-01.v3`          |
| `impact_mapping_version` | `2026-04-01.v1`          |

## Changed Files

- `apps/mobile/src/hooks/useNotifications.ts`
- `apps/mobile/android/app/build.gradle`

## Matched Rules

- `notifications` 通知 / 未读数 / push / deep link: `SJ-2`, `SJ-3`, `A11`

## Result

- 受影响旅程: `SJ-2`, `SJ-3`, `A11`
- 最终门禁集: `A1`, `A2`, `A3`, `A10`, `A11`, `C1`, `SJ-2`, `SJ-4`, `SJ-3`
- 必查质量维度: Web / Mobile 复用合理性 / 专业留学中介感
- 建议升级 Full Audit: yes

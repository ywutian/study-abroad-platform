# Full Surface Evidence · 2026-04-10

| key                           | value           |
| ----------------------------- | --------------- |
| full_surface_registry_version | `2026-04-10.v3` |
| web_routes                    | `66`            |
| mobile_routes                 | `48`            |
| web_shell_artifacts           | `96`            |
| mobile_shell_artifacts        | `5`             |
| capabilities                  | `16`            |
| journey_overlay               | `21`            |

## 目录约定

- 后续每个 surface 应写入 `e2e-report/full-surface-<date>/<surface-id>/`。
- 进入态截图、结果态截图、错误态截图与关键请求/响应摘录遵循 surface template。
- `manifest.json` 与 `inventory.json` 保存当前 bootstrap inventory；后续可用作执行基线。
- `inventory.md` 提供给 Claude / Cursor / Codex 直接阅读，不必先打开 JSON。

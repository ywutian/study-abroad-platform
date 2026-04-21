# UI Upgrade Allowlist

仅允许明确登记的例外跳过本轮 UI 语言升级规则。

| File                                                                      | Rule               | Reason                                                   | Owner         | Expected removal       |
| ------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------- | ------------- | ---------------------- |
| `apps/web/src/app/[locale]/(main)/cases/_components/EssayDetailPanel.tsx` | `no-font-serif-ui` | 文书正文阅读视图保留阅读型 serif 例外，不属于页面 chrome | design-system | 下一轮内容阅读模式专项 |

## Allowed exception categories

- loading shimmer
- chart / illustration
- 用户富文本内容
- 明确标注的实验代码

## Notes

- 例外必须写文件、规则、原因、owner、预计移除时间。
- 未登记的旧 gradient / glow / serif 一律视为遗漏，不视为历史包袱。
- 行级临时豁免使用 `@design-system-ignore-next-line` 注释，并在本文件补账。

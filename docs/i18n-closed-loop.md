# i18n Closed Loop

This document is the working ledger for the zh/en internationalization loop.

## Categories

- Must translate: user-visible UI copy, validation messages, toast messages, empty states, onboarding text, SEO text, notification copy, and AI-generated system-facing labels.
- Must preserve: `Lumni`, official school names, URLs, API paths, environment variables, enum values, IDs, referral codes, file paths, and technical labels.
- Bilingual display: school and organization names in Chinese UI can show Chinese primary text plus English secondary text. English UI should prefer official English names.
- User-generated content: posts, essays, profile text, case content, comments, and uploaded data stay in the user's original language unless an explicit translation feature is invoked.
- Internal strings: logs, query keys, test IDs, CSS class names, route segments, and storage keys are not translated.

## Terminology

- `case`: application case / 申请案例
- `essay`: essay / 文书
- `prediction`: admission prediction or application prediction / 录取预测 or 申请预测
- `review`: choose by context: peer review / 互评, moderation review / 审核, feedback review / 评价
- `reach`: Reach / 冲刺
- `match`: Match / 匹配
- `safety`: Safety / 保底

## Protected Terms

Keep these as-is unless a surrounding sentence needs localization:

`GPA`, `SAT`, `ACT`, `TOEFL`, `IELTS`, `AP`, `IB`, `ED`, `EA`, `RD`, `REA`, `UC`,
`Common App`, `Coalition`, `US News`, `QS`, `THE`, `AI`, `API`, `PDF`, `CSV`, `JSON`,
`URL`, `MIT`, `CMU`, `UCLA`.

## Locale Flow

Request locale priority:

1. `X-Locale`
2. authenticated `User.locale`
3. `Accept-Language`
4. `zh`

Web and Mobile clients must send both `X-Locale` and `Accept-Language`. Logged-in language changes must persist to `PUT /api/v1/users/me` with `{ "locale": "zh" | "en" }`.

## AI Prompt Policy

- All user-visible AI calls use the resolved locale from the API locale flow. Request body `locale` fields are compatibility-only and must not override the resolved locale.
- Keep two prompt sets, `zh` and `en`, for AI Agent, Essay, Resume, Profile, Prediction, Recommendation, and application analysis outputs.
- User input, official school prompts, essay drafts, resume content, and case originals are not automatically translated. Localize the AI's explanations, labels, feedback, reasons, and suggestions around that original content.
- For now, all AI calls use the existing OpenAI provider. Do not add Zhipu, IP detection, server-region routing, or provider routing in this phase.
- Output language must not be inferred from the user's message language. A user asking in English inside the Chinese UI should still receive Chinese AI guidance, and vice versa.

## Verification

Run these before merging i18n-affecting changes:

```bash
pnpm --filter web lint:i18n
pnpm --filter web lint:i18n-english
pnpm --filter web exec tsx scripts/check-unused-keys.ts
pnpm --filter study-abroad-mobile lint:i18n
pnpm --filter api test -- request-locale.util.spec.ts user.controller.spec.ts ai-prompts-locale.spec.ts ai-agent.controller.spec.ts orchestrator.service.spec.ts
```

Use strict mobile advisory checks when cleaning up remaining fallback debt:

```bash
MOBILE_I18N_STRICT=1 pnpm --filter study-abroad-mobile lint:i18n
```

# Module: essay

## Purpose

Essay management and AI-powered writing assistance: polish, review (admissions officer perspective), brainstorm, rewrite, continue writing, gallery of examples.

## Key Files

- `essay-ai.controller.ts` — AI endpoints: polish, review, brainstorm, rewrite, continue, opening, optimize activity
- `essay-ai.service.ts` — LLM-powered essay operations with points charging and refund on failure
- `essay-ai.prompts.ts` — Prompt builders for review and brainstorm
- `essay-prompt.controller.ts` — Essay prompt/topic browsing (Common App, supplements)
- `essay-prompt.service.ts` — Prompt data serving
- `essay-prompt-admin.controller.ts` — Admin CRUD for essay prompts
- `essay-gallery.service.ts` — Gallery of exemplary essays for reference
- `essay-scraper.controller.ts` / `essay-scraper.service.ts` — Scrape essay prompts from college sites
- `ai-validator.service.ts` — Validates AI-generated essay content

## Data Model

Essay (profileId, type, title, content, schoolId, promptId), EssayPrompt (school, year, type, wordLimit, text). References: Profile, School.

## Dependencies

PrismaService, LLMService, CaseIncentiveService (points), MemoryManagerService (@Optional) | AI/LLM: Yes

## Business Rules

- AI operations cost points: polish=20, review=30 (charged before LLM call, refunded on failure)
- `@ThrottleAI()` on entire AI controller
- Essay results recorded to AI memory for agent context
- Gallery essays are public; user essays respect profile visibility

## Gotchas

- Points are charged upfront via `CaseIncentiveService.charge()` and refunded via `safeRefund()` on error
- MemoryManagerService is `@Optional()`
- Multiple sub-controllers: essay-ai, essay-prompt, essay-prompt-admin, essay-scraper

# Feature: Submit Case

## Purpose

Form sections for submitting admission case studies to the public case gallery.

## Key Files

- `DetailsSection.tsx` — Demographic and score inputs (nationality, ACT range, demographics multi-select)
- `EssaySection.tsx` — Essay content input with type selector, file upload, and anonymous toggle

## Patterns

- Both are form section components — parent page composes them into a full form
- `DEMOGRAPHIC_OPTIONS` and `ESSAY_TYPES` defined as static constants
- File upload via drag-and-drop or click with toast feedback

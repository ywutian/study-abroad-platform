# Feature: Resume

## Purpose

Full resume builder: template selection, section editing, live preview, PDF export, and AI review.

## Key Files

- `template-picker.tsx` — Dialog for browsing/selecting resume templates by category
- `customize-panel.tsx` — Accordion panel for colors, fonts, spacing, decoration settings
- `color-picker-field.tsx` — Popover color picker with preset palette
- `resume-export-dialog.tsx` — Export dialog with section/format selection
- `resume-editor/` — Section editors (education, experience, activities, etc.)
- `resume-preview/` — Live PDF preview with `pdf-viewer-inner.tsx`
- `review-dialog/` — AI review results: overview, section-by-section, and gaps tabs
- `pdf/` — @react-pdf/renderer primitives, layouts, themes, section renderers, templates
- `templates/` — Web-preview template components (basic, professional)

## Patterns

- `ResumeSettings` types from `@study-abroad/shared` — color, font, spacing, decoration
- `pdf/` is the PDF render pipeline (server-safe); `templates/` is for web preview
- Template definitions registered in `pdf/templates/` — add new templates there

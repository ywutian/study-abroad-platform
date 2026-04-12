# Feature: Verification

## Purpose

User identity verification UI: status display, badge, document upload, and verification flow dialogs.

## Key Files

- `VerificationBadge.tsx` — Inline badge showing verification status (verified/pending/rejected/none)
- `VerificationStatusCard.tsx` — Card showing verification progress, status, and upload trigger
- `VerificationUploadDialog.tsx` — Drag-and-drop document upload dialog with progress bar
- `verification-dialog.tsx` — Full verification flow dialog with radio-group document type selection

## Patterns

- Uses `verificationRoutes` from `@study-abroad/shared` for API paths
- `VerificationStatusCard` composes `VerificationBadge` and `VerificationUploadDialog`
- Upload uses `react-dropzone` for drag-and-drop file handling

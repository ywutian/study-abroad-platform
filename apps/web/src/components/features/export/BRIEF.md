# Feature: Export

## Purpose

Dialog for exporting user data in multiple formats (JSON, CSV, PDF).

## Key Files

- `data-export.tsx` — Export dialog with format selection, section picker, and download via apiClient

## Patterns

- Single-file feature — dialog triggered from settings/profile pages
- Calls API for server-side export generation

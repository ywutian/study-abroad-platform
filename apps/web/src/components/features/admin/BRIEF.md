# Feature: Admin Components

## Purpose

Admin-only tools for essay management, bulk operations, and content pipeline.

## Components

- essay-prompt-manager — CRUD for essay prompts used in the platform
- essay-case-review-manager — review and approve user-submitted essay cases
- bulk-import-dialog — dialog for bulk importing data (CSV/JSON)
- essay-pipeline-dashboard — pipeline status dashboard for essay scraping/processing
- essay-pipeline/ — sub-directory with pipeline-badges, test-scrape-dialog, types

## Data Flow

- API: `GET/POST /admin/essay-prompts`, `GET/POST /admin/essay-pipeline`
- Uses `adminRoutes` from `@study-abroad/shared` for route constants
- apiClient for all requests

## Patterns

- Table-heavy layouts with search, filter, pagination
- Shared by admin pages — imported from `admin/ai-agent/_components/` and `admin/analytics/_components/`
- Pipeline sub-module for essay scraping workflow

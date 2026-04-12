# Feature: Report

## Purpose

PDF generation for AI analysis reports using @react-pdf/renderer.

## Key Files

- `analysis-report-pdf.tsx` — React-PDF document component rendering `AIAnalysisResult` as downloadable PDF

## Patterns

- Registers Noto Sans SC font for Chinese text support
- Uses `AIAnalysisResult` type from `@study-abroad/shared`
- Server-compatible (no 'use client') — rendered via @react-pdf/renderer, not DOM

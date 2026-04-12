# Feature: Landing

## Purpose

Reusable components for the public landing/marketing page.

## Key Files

- `FeaturePreviewCard.tsx` — Animated card linking to a feature with icon, gradient, and description
- `LandingFooter.tsx` — Site footer with configurable link sections and copyright
- `SectionHeader.tsx` — Animated badge + title + subtitle header for landing page sections

## Patterns

- All components respect `useReducedMotion()` for accessibility
- `LandingFooter` reads auth state to conditionally show login/dashboard links
- Props-driven (no internal data fetching) — landing page owns all content

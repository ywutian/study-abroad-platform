# Feature: Onboarding

## Purpose

New user onboarding flow: welcome dialog, guided tour, and quick-start experience.

## Key Files

- `tour-provider.tsx` — Context provider wrapping `driver.js` for step-by-step guided tours
- `welcome-dialog.tsx` — Multi-step welcome dialog introducing platform features (uses tour-provider)
- `quick-experience.tsx` — Post-registration quick-start dialog routing to profile/schools/AI

## Patterns

- Tour state persisted in localStorage (`PENDING_ONBOARDING_KEY`) to show once
- `TourProvider` registered globally in provider chain
- `driver.js` CSS imported in tour-provider — no separate CSS file needed

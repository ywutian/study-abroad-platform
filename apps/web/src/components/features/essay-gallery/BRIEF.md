# Feature: Essay Gallery

## Purpose

Advanced filtering UI for browsing the public essay gallery.

## Key Files

- `AdvancedEssayFilter.tsx` — Sheet-based filter panel with sliders, switches, and multi-select for essay type, school tier, score range

## Patterns

- Uses Sheet (mobile-friendly slide-out) rather than inline filter panel
- Filter state managed via parent — component calls `onChange` callbacks

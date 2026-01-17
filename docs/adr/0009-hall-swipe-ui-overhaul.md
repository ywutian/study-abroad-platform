# ADR-0009: Hall Swipe Game UI/UX Overhaul

- Status: accepted
- Date: 2026-02-09
- Decision-makers: AI Assistant, Project Owner
- Tags: frontend, ui/ux, i18n, gamification, responsive

## Context

The Hall swipe game ("案例预测") had multiple issues:

1. **Data display failure** — Frontend double-unwrapped `apiClient.get` responses, causing `swipeMeta` to be `undefined` and triggering incorrect empty states.
2. **Zero-width cards** — `motion.div` wrappers had `position: absolute` but no explicit width, causing cards to render at 0px.
3. **Hardcoded Chinese text** — Leaderboard, instruction labels, and ranking badges used hardcoded strings instead of i18n.
4. **Poor mobile experience** — Fixed pixel heights, no responsive breakpoints, buttons too large on small screens.
5. **Suboptimal feedback** — Full-screen overlays for swipe direction, no result feedback overlay, no keyboard shortcuts.
6. **Backend performance** — `id: { notIn: [...] }` query degraded with scale; race conditions in `submitSwipe` and `getStats`.

## Decision

### Frontend

- **SwipeCard**: Replace full-screen direction overlays with corner stamp badges (ADMIT/REJECT/WAITLIST/SKIP). Add velocity-based flick detection (reduced threshold at > 500px/s). Add gradient tint on drag direction. Add acceptance rate progress bar.
- **SwipeStack**: Add progress counter (`{current}/{total}`), keyboard shortcuts (arrow keys), responsive heights (`h-[400px] sm:h-[480px] md:h-[520px]`), tooltip action buttons, i18n labels. Remove redundant instruction text and replace with compact legend.
- **SwipeResultOverlay**: New reusable component for animated result feedback (correct/wrong, points, streak, badge upgrade).
- **LeaderboardList**: Full i18n via `hall.leaderboard.*`. Add mini accuracy bar per row. Stagger entry animations. Current user highlight with ring.
- **StatsPanel**: Streak fire pulse animation for streaks >= 3. Responsive padding.
- **DailyChallenge**: Spring celebration animation on completion. Gift icon shake.
- **i18n**: Add 40+ keys across `hall.swipeStack.*`, `hall.leaderboard.*`, `hall.result.*`, `hall.swipeCard.*` in both zh.json and en.json. No hardcoded text remains.

### Backend (prior phase, documented for completeness)

- Replace `notIn` with Prisma `none` relation filter (NOT EXISTS subquery).
- Use `$transaction` + P2002 try-catch for `submitSwipe`.
- Use `upsert` for `getStats`.
- UTC-based daily challenge comparison.
- Privacy-mask leaderboard user data.
- Remove `SwipeController` (single entry via `HallController`).

## Consequences

### Positive

- All text is i18n compliant; no MISSING_MESSAGE console errors.
- Mobile-first responsive design with sm/md/lg breakpoints.
- Corner stamps provide clearer visual feedback without obscuring card content.
- Keyboard shortcuts improve accessibility and power-user experience.
- Reusable `SwipeResultOverlay` can be used in future gamification features.
- `AnimatedCounter` (existing) is reused across stats — no new animation library needed.

### Negative

- Additional i18n keys increase translation maintenance burden (mitigated by structured namespacing).
- Corner stamp text may be truncated on very narrow screens (mitigated by responsive font sizes).
- `useTransform` for gradient tint creates a new `background` style string on every frame during drag (acceptable for short-duration interactions).

### Neutral

- Framer Motion remains the sole animation library (no additional dependencies).
- `TooltipProvider` wrapper added to SwipeStack; no global Tooltip context change needed.
- ADR-0006 (Prisma exception handling) continues to govern P2002 error handling strategy.

# Feature: Essay Debate

## Purpose

AI Socratic debate over a draft essay: the user argues for a paragraph, the AI pushes back, turn by turn, to pressure-test and sharpen the writing. The session is scoped per essay; a turn budget limits the back-and-forth.

## Components

- EssayDebateDialog — the full debate surface: a turn list (alternating user/AI), an input box (textarea + submit + remaining-turns indicator), and a paragraph picker that pre-fills which paragraph the next user turn argues against.

## Data Flow

- API via `essayDebateRoutes` (`@study-abroad/shared`): load/hydrate a session on open (`useQuery`), submit a turn (`useMutation`).
- The displayed conversation is **local-state-driven** (the mutation appends the returned user+AI turn pair to local state); the session query only hydrates on open — so turns do not invalidate a cached list.

## Patterns

- Per-essay session scope; bounded turn count surfaced as a remaining-turns indicator.
- Optimistic local-state turn append (see the `@cache-invalidation-allowed` note on the submit mutation).

# Module: team

## Purpose

Team/group management for collaborative applications with recruitment card system (Tinder-style swipe matching for competition teammates).

## Key Files

- `team.controller.ts` — Team CRUD, join/leave/invite, recruitment cards, swipe deck, matches
- `team.service.ts` — Team lifecycle, membership roles, invitation tokens, ownership transfer
- `team-recruitment.service.ts` — Recruitment cards, swipe mechanics, match detection, member invites

## Data Model

- `Team` — name, description, visibility (PUBLIC/UNLISTED/PRIVATE), joinPolicy (OPEN/INVITE_ONLY), maxMembers, schoolId, tags
- `TeamMembership` — teamId+userId (unique), role (OWNER/ADMIN/MEMBER)
- `TeamInvitation` — token-based invites with 7-day expiry
- `TeamRecruitmentCard` — Competition recruitment with phase (DRAFT/PUBLISHED/CLOSED)
- `TeamRecruitmentSwipe` — Swipe interactions between recruitment cards

## Dependencies

PrismaService, AuditLogService | AI/LLM: No

## Business Rules

- Roles: OWNER > ADMIN > MEMBER; only OWNER/ADMIN can invite, update, kick
- OWNER must transfer ownership before leaving (if other members exist)
- Last member leaving auto-disbands the team
- Invitation tokens are 24-byte hex, expire in 7 days
- Recruitment cards auto-revert to DRAFT when team membership changes (invalidateRecruitmentCards)
- PRIVATE teams only visible to members; PUBLIC/UNLISTED visible to all

## Gotchas

- `@ThrottleSensitive()` on all write endpoints for recruitment to prevent spam
- Discover endpoint is `@Public()` (no auth required for browsing)
- Recruitment swipe matching creates mutual matches when both sides swipe right
- Team membership changes invalidate published recruitment cards

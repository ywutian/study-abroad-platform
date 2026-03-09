# 组队 (Teams) — Backend Section (Implementation Plan)

Merge this section into the main 组队 implementation plan. Paths are relative to repo root.

---

## 1. Prisma Schema Addition

**Convention:** camelCase in schema; add `@@map('snake_case_table')` only if project convention requires snake_case table names (current schema uses PascalCase model names, no @@map on most tables).

**Note:** The schema already has `TeamMember` and `TeamApplication` under `ForumPost` (forum post recruitment). For standalone 组队, the membership model is named **TeamMembership** below to avoid a name clash; domain term remains "team member".

### Enums

```prisma
enum TeamVisibility {
  PUBLIC
  UNLISTED   // discoverable only via link
  PRIVATE    // invite-only visibility; not listed in discovery
}

enum TeamJoinPolicy {
  OPEN
  INVITE_ONLY
}

enum TeamMemberRole {
  OWNER
  ADMIN
  MEMBER
}

enum TeamInvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
}
```

- **TeamVisibility:** `PUBLIC` (discoverable), `UNLISTED` (link-only; or `PRIVATE` if product uses only two levels).
- **TeamJoinPolicy:** `OPEN` (anyone can join), `INVITE_ONLY`.
- **TeamMemberRole:** `OWNER`, `ADMIN`, `MEMBER`.
- **TeamInvitationStatus:** `PENDING`, `ACCEPTED`, `EXPIRED`.

### Models

**Team**

- `id` String @id @default(cuid())
- `creatorId` String
- `name` String
- `description` String? @db.Text
- `schoolId` String? (optional FK to School)
- `tags` Json? (array of strings; max 10 in app logic)
- `visibility` TeamVisibility
- `joinPolicy` TeamJoinPolicy
- `maxMembers` Int? (2–100; app-validated)
- `createdAt` DateTime @default(now())
- `updatedAt` DateTime @updatedAt
- Relations: `creator` User @relation(fields: [creatorId], references: [id]), `school` School? @relation(fields: [schoolId], references: [id]), `members` TeamMembership[], `invitations` TeamInvitation[]
- @@index([creatorId]), @@index([schoolId]), @@index([visibility]), @@index([createdAt])

**TeamMembership**

- `id` String @id @default(cuid())
- `teamId` String
- `userId` String
- `role` TeamMemberRole
- `joinedAt` DateTime @default(now())
- Relations: `team` Team @relation(fields: [teamId], references: [id], onDelete: Cascade), `user` User @relation(fields: [userId], references: [id], onDelete: Cascade)
- @@unique([teamId, userId])
- @@index([teamId]), @@index([userId])

**TeamInvitation**

- `id` String @id @default(cuid())
- `teamId` String
- `inviterId` String
- `inviteeId` String? (optional if invite by email/link before user exists)
- `token` String? @unique (for link-based accept)
- `status` TeamInvitationStatus @default(PENDING)
- `expiresAt` DateTime
- `createdAt` DateTime @default(now())
- Relations: `team` Team @relation(fields: [teamId], references: [id], onDelete: Cascade), `inviter` User @relation(fields: [inviterId], references: [id]), `invitee` User? @relation(fields: [inviteeId], references: [id])
- @@index([teamId]), @@index([inviteeId]), @@index([token]), @@index([status])

**User model** (add relations): `teamMemberships` TeamMembership[], `teamInvitationsSent` TeamInvitation[], `teamInvitationsReceived` TeamInvitation[] (if inviteeId used).

**School model** (add relation): `teams` Team[].

---

## 2. API Table

All routes under prefix `/teams` (e.g. `GET /api/v1/teams`). Auth: JWT = requires valid access token; @Public = no token required. Permission rules enforced in **service layer** (throw `ForbiddenException` → FORBIDDEN).

| Method | Path                       | Auth           | Permission rule                                                                                                     | Audit                                        | Error codes                                                                         |
| ------ | -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| GET    | /teams                     | @Public        | Return only PUBLIC teams (or UNLISTED if link known); filter by query params (schoolId, tags, etc.)                 | No                                           | BAD_REQUEST (invalid query)                                                         |
| GET    | /teams/my                  | JWT            | Caller = current user; return teams where user is member                                                            | No                                           | —                                                                                   |
| POST   | /teams                     | JWT            | Caller = creator                                                                                                    | Yes: create                                  | BAD_REQUEST (validation), CONFLICT (e.g. duplicate name per user if biz rule)       |
| GET    | /teams/:id                 | @Public        | If team.visibility = PUBLIC or UNLISTED: allow; if PRIVATE: only members; service returns 404 or 403 as appropriate | No                                           | NOT_FOUND, FORBIDDEN                                                                |
| PATCH  | /teams/:id                 | JWT            | Caller is OWNER or ADMIN of team                                                                                    | Yes: update (metadata.action optional)       | NOT_FOUND, FORBIDDEN, BAD_REQUEST                                                   |
| POST   | /teams/:id/join            | JWT            | joinPolicy = OPEN; caller not already member; team not full                                                         | No (or yes: join)                            | NOT_FOUND, FORBIDDEN, CONFLICT (already member / full)                              |
| POST   | /teams/:id/leave           | JWT            | Caller is member; if OWNER, require transfer or disband first (business rule)                                       | Yes: leave                                   | NOT_FOUND, FORBIDDEN, BAD_REQUEST (owner must transfer first)                       |
| POST   | /teams/:id/invite          | JWT            | Caller is OWNER or ADMIN; team not full; invitee not already member                                                 | Yes: invite                                  | NOT_FOUND, FORBIDDEN, CONFLICT (already member/full), BAD_REQUEST (invalid invitee) |
| POST   | /teams/join                | JWT or @Public | Body or query has token; validate token and invite status; if accepted, add user (login required for accept)        | Yes: accept (metadata.action: accept_invite) | BAD_REQUEST, NOT_FOUND (invalid/expired token)                                      |
| POST   | /teams/:id/accept-invite   | JWT            | Caller is invitee for a PENDING invite (by inviteeId or token); team not full                                       | Yes: accept_invite                           | NOT_FOUND, FORBIDDEN, CONFLICT                                                      |
| DELETE | /teams/:id                 | JWT            | Caller is OWNER (disband)                                                                                           | Yes: disband                                 | NOT_FOUND, FORBIDDEN                                                                |
| GET    | /teams/:id/members         | JWT            | Caller is member of team                                                                                            | No                                           | NOT_FOUND, FORBIDDEN                                                                |
| DELETE | /teams/:id/members/:userId | JWT            | Caller is OWNER or ADMIN (or self for leave; prefer POST leave); target not OWNER unless transferring               | Yes: kick                                    | NOT_FOUND, FORBIDDEN, BAD_REQUEST (cannot kick owner)                               |

**Optional (INVITE_ONLY apply flow):**

| Method | Path                                          | Auth | Permission rule                                                             | Audit                          | Error codes                                      |
| ------ | --------------------------------------------- | ---- | --------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------ |
| POST   | /teams/:id/apply                              | JWT  | joinPolicy = INVITE_ONLY; caller not member; optional TeamApplication model | Optional                       | NOT_FOUND, FORBIDDEN, CONFLICT (already applied) |
| GET    | /teams/:id/applications                       | JWT  | Caller is OWNER or ADMIN                                                    | No                             | NOT_FOUND, FORBIDDEN                             |
| POST   | /teams/:id/applications/:applicationId/accept | JWT  | Caller is OWNER or ADMIN; team not full                                     | Yes: invite/accept_application | NOT_FOUND, FORBIDDEN, CONFLICT                   |

If **TeamApplication** is introduced: model like `teamId`, `applicantId`, `message?`, `status` (PENDING/ACCEPTED/REJECTED), `createdAt`; unique (teamId, applicantId).

---

## 3. DTO Validation (class-validator)

- Use `ValidationPipe` (project default) with class-validator.
- SanitizeInterceptor strips HTML; still enforce length and enum in DTOs.

### CreateTeamDto

| Field       | Decorators                                                              | Notes                  |
| ----------- | ----------------------------------------------------------------------- | ---------------------- |
| name        | @IsString(), @MinLength(1), @MaxLength(100)                             | Required               |
| description | @IsOptional(), @IsString(), @MaxLength(500)                             | Optional               |
| visibility  | @IsEnum(TeamVisibility)                                                 | Required               |
| joinPolicy  | @IsEnum(TeamJoinPolicy)                                                 | Required               |
| maxMembers  | @IsOptional(), @IsInt(), @Min(2), @Max(100)                             | Optional               |
| schoolId    | @IsOptional(), @IsUUID()                                                | Optional               |
| tags        | @IsOptional(), @IsArray(), @IsString({ each: true }), @ArrayMaxSize(10) | Optional, max 10 items |

### UpdateTeamDto

- Same fields as CreateTeamDto, all optional: @IsOptional() on every field; same validators where present (MaxLength, Min/Max, IsEnum, IsUUID, ArrayMaxSize).

### InviteDto (POST /teams/:id/invite)

| Field     | Decorators                                                                             |
| --------- | -------------------------------------------------------------------------------------- |
| inviteeId | @IsUUID() (or @IsEmail() if inviting by email) — one of inviteeId or email per product |
| message   | @IsOptional(), @IsString(), @MaxLength(200)                                            |

### ApplyDto (POST /teams/:id/apply, optional)

| Field   | Decorators                                  |
| ------- | ------------------------------------------- |
| message | @IsOptional(), @IsString(), @MaxLength(200) |

### JoinByTokenDto (POST /teams/join)

| Field | Decorators                 |
| ----- | -------------------------- |
| token | @IsString(), @IsNotEmpty() |

---

## 4. Audit

- **Service:** `AuditLogService` from `apps/api/src/common/services/audit-log.service.ts` (already global via `AuditLogModule`).
- **Choice:** Extend `AuditAction` enum with team-specific actions for easier filtering and reporting: e.g. `TEAM_CREATE`, `TEAM_DISBAND`, `TEAM_INVITE`, `TEAM_LEAVE`, `TEAM_MEMBER_REMOVE`, `TEAM_TRANSFER_OWNER` (and optionally `TEAM_ACCEPT_INVITE`). Use `resource: 'teams'`, `resourceId: teamId`; put in `metadata`: `action` (if needed for extra detail), and non-PII fields only (e.g. role transferred to userId; avoid logging full request body).
- **Operations that call `AuditLogService.log`:**
  - Create team → `TEAM_CREATE`, resourceId = team.id.
  - Disband team (DELETE /teams/:id) → `TEAM_DISBAND`.
  - Send invite (success) → `TEAM_INVITE`; metadata may include inviteeId (or omit for privacy).
  - Leave team → `TEAM_LEAVE`.
  - Kick member (DELETE /teams/:id/members/:userId) → `TEAM_MEMBER_REMOVE`; metadata: removedUserId.
  - Transfer owner (if implemented in PATCH or dedicated endpoint) → `TEAM_TRANSFER_OWNER`; metadata: newOwnerId.
  - Accept invite (POST /teams/join or POST /teams/:id/accept-invite) → optional `TEAM_ACCEPT_INVITE`.

---

## 5. Module Structure and Tests

### Module structure

- **Folder:** `apps/api/src/modules/team/`
- **Files:** `team.module.ts`, `team.controller.ts`, `team.service.ts`, `dto/index.ts`, `dto/create-team.dto.ts`, `dto/update-team.dto.ts`, `dto/invite.dto.ts`, `dto/join-by-token.dto.ts` (and optional `dto/apply.dto.ts`).
- **Dependencies:** `PrismaModule`, `AuditLogModule` (from `common/services`). Optionally `SchoolModule` if resolving school in responses (or use Prisma include only).
- **Registration:** Add `TeamModule` to `AppModule` imports in `apps/api/src/app.module.ts`.

### Test requirements

- **team.service.spec.ts**
  - Mock: `PrismaService`, `AuditLogService`.
  - Cases: create (success, validation); join (OPEN policy, success / already member / full); leave (success; owner must transfer or disband); disband (owner only); invite (success / already member / full); permission checks (non-member cannot PATCH/DELETE; member cannot kick owner; only owner/admin can invite/kick). Assert `AuditLogService.log` called with correct `action`, `resource: 'teams'`, `resourceId` where applicable.
- **team.controller.spec.ts**
  - Mock: `TeamService`, `@CurrentUser()` (use a test user payload).
  - Cases: each endpoint calls the expected service method with correct params (e.g. create with body, get by id, join with teamId, leave with teamId, invite with teamId + body, join-by-token with body, delete with teamId, getMembers with teamId, deleteMember with teamId and userId). For @Public routes (GET /teams, GET /teams/:id), ensure no JWT required (guard bypass or public decorator). For JWT routes, ensure guard applies and CurrentUser is passed.

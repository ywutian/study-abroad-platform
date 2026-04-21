# Public/Private Teams Release Checklist

## Scope

- Release target: Web is the primary launch surface for the Public/Private teams flow.
- Admin scope: API-only moderation and pool-management QA in this release.
- Mobile scope: compatibility only. The app must consume the new `RecruitmentContext` payloads without crashing or writing the old boundary as a source of truth.
- Matching boundary: every deck, swipe, match, and invite assertion must be based on `recruitmentContextId`, not `competitionTrackId`.

## Data Audit

Run these checks against the release database after migrations and seeds finish.

### 1. Official recruitment context backfill

```sql
select count(*) as active_tracks
from "CompetitionTrack"
where "isActive" = true;

select count(*) as active_official_contexts
from "RecruitmentContext"
where "sourceType" = 'OFFICIAL'
  and "isActive" = true;
```

Pass condition: `active_official_contexts >= active_tracks` for all active tracks expected to be matchable in this release.

### 2. Orphan recruitment cards

```sql
select trc."id", trc."teamId", trc."recruitmentContextId"
from "TeamRecruitmentCard" trc
left join "RecruitmentContext" rc
  on rc."id" = trc."recruitmentContextId"
where rc."id" is null;
```

Pass condition: zero rows.

### 3. Duplicate official match-pool entries

```sql
select "matchPoolId", "competitionId", count(*) as duplicate_count
from "MatchPoolEntry"
where "entryType" = 'OFFICIAL_COMPETITION'
group by "matchPoolId", "competitionId"
having count(*) > 1;
```

Pass condition: zero rows.

### 4. Duplicate promoted community entries

```sql
select "matchPoolId", "recruitmentContextId", count(*) as duplicate_count
from "MatchPoolEntry"
where "entryType" = 'PROMOTED_COMMUNITY_CONTEXT'
group by "matchPoolId", "recruitmentContextId"
having count(*) > 1;
```

Pass condition: zero rows.

### 5. Rejected contexts with still-open cards

```sql
select rc."id", trc."id" as "cardId"
from "RecruitmentContext" rc
join "TeamRecruitmentCard" trc
  on trc."recruitmentContextId" = rc."id"
where rc."sourceType" = 'COMMUNITY'
  and rc."moderationStatus" = 'REJECTED'
  and trc."isClosed" = false;
```

Pass condition: zero rows.

### 6. Seed sanity for default public pools

```sql
select mp."name", count(mpe."id") as entry_count
from "MatchPool" mp
left join "MatchPoolEntry" mpe
  on mpe."matchPoolId" = mp."id"
where mp."name" = 'Popular Main Competitions'
group by mp."name";
```

Manual review: verify NEC, BPA, and NSDA-related entries exist when those official competitions are present in the environment.

## API QA

### User-side contract

- `GET /teams/match-pools` returns active pools only.
- `GET /teams/match-pools/:id` returns active entries only.
- `GET /teams/recruitment-contexts?sourceType=OFFICIAL&competitionId=:id` returns published active official contexts only.
- `GET /teams/community-contexts` returns only the current user’s community contexts.
- `POST /teams/community-contexts` creates `COMMUNITY` context with `PENDING_REVIEW`.
- `PATCH /teams/community-contexts/:id` is owner-only.
- `POST /teams/community-contexts/:id/publish` rejects `REJECTED` contexts.
- `POST /teams/recruitments` and `PATCH /teams/recruitments/:id` accept `recruitmentContextId` as the canonical binding field.
- `POST /teams/recruitments/:id/swipes` rejects cards from different `recruitmentContextId`s.
- `POST /teams/matches/:id/invite-members` still returns invitation URLs for manual-share fallback.

### Admin-side contract

- `GET /admin/match-pools` returns pools with entries.
- `POST /admin/match-pools/:id/entries` rejects duplicate official competition entries within the same pool.
- `POST /admin/match-pools/:id/entries` rejects promoted entries when the community context is not approved, published, and active.
- `POST /admin/community-contexts/:id/review` allows only `APPROVED` or `REJECTED`.
- Rejecting a context closes all open cards under that context.
- `POST /admin/community-contexts/:id/promote` only works for approved community contexts.

## Web QA

### Public flow

1. Open `/teams`.
2. Confirm the default tab is `Public`.
3. Select a pool.
4. Select an official competition entry.
5. Confirm the official recruitment context selector populates.
6. Create or load a card.
7. Publish the card.
8. Confirm the deck only shows cards from the same `recruitmentContextId`.
9. Like another compatible card and verify match creation.
10. Open the match chat.

### Private flow

1. Switch to `Private`.
2. Create a new community context with title, role presets, team size, and languages.
3. Publish the community context.
4. Create a recruitment card bound to that context.
5. Publish the card.
6. Confirm the deck only contains cards from the same private context.
7. Match another card and verify invites still work.

### Matches and My Team

- Matches cards display `recruitmentContext` labels and meta, not `competitionTrack` wording.
- Manual-share invite fallback shows a copy-link control.
- `My Team` cards open back into `Public` or `Private` depending on `sourceType`.

## Admin QA

- Approve a pending community context and then promote it into a public pool.
- Verify the promoted context appears in `Public` with a `COMMUNITY` badge and no extra competition-selection step.
- Reject a different community context and confirm:
  - it disappears from the private deck,
  - open cards under it become closed,
  - it cannot be published again.

## Mobile Compatibility QA

- Open the mobile teams screen and verify official context lists still render.
- Create or update a recruitment card and confirm `recruitmentContextId` survives round-trip responses.
- Open matches and confirm new `recruitmentContext` payloads do not break rendering.
- Confirm no mobile client path assumes `competitionTrackId` is the matching boundary.

## Regression Matrix

- Empty account with no teams.
- Existing user with legacy cards migrated to official recruitment contexts.
- Solo-team creation path.
- Multiple-team user switching backing teams.
- English and Chinese locales.
- Copy invite link on browsers with clipboard access.
- Reject and promote moderation actions on the same release build.

## Release Gate

Do not ship unless all of the following are true:

- Data audit queries return clean results.
- Automated tests covering controllers/services/contracts pass.
- Web Public and Private happy paths are manually verified.
- Admin reject/promote QA is completed.
- Mobile compatibility smoke checks pass.

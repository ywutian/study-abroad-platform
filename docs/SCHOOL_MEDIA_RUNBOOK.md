# School Media Runbook

How to diagnose and fix wrong/non-photo images shown on school cards (`/schools` page, school detail pages, recommendation results).

## Symptom

A school card shows an image that is clearly not a campus photo — e.g. a logo, map, diagram, architectural blueprint/landscape plan, mascot, or unrelated subject (a bus, a truck, a flower).

## Data Path (quick reference)

```
SchoolMediaAsset (status=APPROVED, isPrimary=true, type=CAMPUS_COVER)
  → school.service.ts `schoolPublicMediaInclude`
  → API response: school.media.campusCover.url
  → SchoolCard.tsx renders <SchoolHeroMedia coverUrl=... />
```

The frontend renders whatever URL is in the approved-and-primary `SchoolMediaAsset` row. The fix is therefore **always in the data**, not the rendering code.

## Single-School Diagnostic

```sql
SELECT id, type, status, "isPrimary", "sourceType", "originalUrl", "failureReason"
FROM "SchoolMediaAsset"
WHERE "schoolId" = '<school-id>'
  AND type = 'CAMPUS_COVER'
ORDER BY "updatedAt" DESC;
```

Inspect `originalUrl` of the row with `isPrimary=true` and `status='APPROVED'` — that's the image being shown.

## Bulk Audit (find similar bad data across all schools)

The audit script re-runs the current `WIKIMEDIA_REJECT_TITLE_TERMS` filter against every existing approved primary Wikimedia campus cover and flags matches:

```bash
# Dry-run: print the list of suspect assets
npx ts-node apps/api/scripts/audit-school-media.ts

# Optional: dump the hit list as JSON
npx ts-node apps/api/scripts/audit-school-media.ts --out=./media-audit.json

# Apply: flip suspect assets to REJECTED (status=REJECTED, isPrimary=false,
# failureReason='Audit: matched reject term "X"')
npx ts-node apps/api/scripts/audit-school-media.ts --apply
```

The `--apply` mode prints the list of `schoolId`s that need re-discovery at the end.

## Replacement Workflow (manual approval)

For each impacted school:

1. **Re-run discovery** so new candidate assets are written:
   ```bash
   npx ts-node apps/api/src/cli/school-media-backfill.ts \
     --schoolId=<id> --source=wikimedia --dry-run=false
   ```
   With the strengthened filter in `school-media.service.ts`, the previously-bad candidate now scores `null` and is skipped. The next-best candidate is saved as `PENDING_REVIEW` / `CANDIDATE` (not auto-approved).

2. **Approve manually**: open `/admin/schools` → select the school → Media Assets tab. Review the new candidates and click **Approve** + **Set Primary** on a good campus photo.

3. **Verify**: load `/schools`, find the school card, confirm the new image renders. Hard-refresh (Cmd-Shift-R) if the Next.js Image cache still serves the old URL.

## Adding New Reject Terms

The filter is keyword-based — it does not analyze pixels. If a new category of bad image slips through:

1. Find the offending Wikimedia title (in `originalUrl` or `sourcePageUrl`).
2. Add a phrase to `WIKIMEDIA_REJECT_TITLE_TERMS` in `apps/api/src/modules/school/school-media.service.ts`. Prefer multi-word phrases (e.g. `'master plan'`) over single broad words (`'plan'` alone over-rejects).
3. Mirror the addition in `apps/api/scripts/audit-school-media.ts` (the `REJECT_TERMS` constant — there's a `Keep in sync` comment).
4. Add a unit test in `school-media.service.spec.ts` proving the new term blocks an example title.
5. Re-run the bulk audit to find existing assets newly caught by the term.

## Limits

- Filter is **lexical** — won't catch a low-quality photo or a misidentified file with a benign title.
- Re-discovery only re-evaluates Wikimedia. For schools that need Logo.dev / official-website discovery, use `--source=all`.
- The `--apply` step is destructive (status flip). Always dry-run first.

## Related Files

- Filter and scoring: [apps/api/src/modules/school/school-media.service.ts](../apps/api/src/modules/school/school-media.service.ts)
- Tests: [apps/api/src/modules/school/school-media.service.spec.ts](../apps/api/src/modules/school/school-media.service.spec.ts)
- Audit script: [apps/api/scripts/audit-school-media.ts](../apps/api/scripts/audit-school-media.ts)
- Backfill CLI: [apps/api/src/cli/school-media-backfill.ts](../apps/api/src/cli/school-media-backfill.ts)
- Admin UI: [apps/web/src/app/[locale]/(main)/admin/schools/_components/media-assets-tab.tsx](../apps/web/src/app/%5Blocale%5D/%28main%29/admin/schools/_components/media-assets-tab.tsx)
- DB model: `SchoolMediaAsset` in [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma)

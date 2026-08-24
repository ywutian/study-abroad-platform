# Cloud SQL restore drill

The production release gate performs a read-only check that automated backups
and point-in-time recovery (PITR) are enabled. It never restores or mutates the
production database.

The isolated GitHub Actions workflow
`.github/workflows/cloud-sql-restore-drill.yml` is disabled by default. Running
it with `prepare_plan=true` only produces an auditable plan and sanitized backup
metadata. It does not create a clone, restore a backup, change traffic, or
delete data. The plan is deliberately handed to an authorized operator because
an actual restore requires an explicitly approved non-production target and a
separate change window.

Required closed loop for a real drill:

1. Approve a separately named non-production Cloud SQL target and record the
   change/incident ID.
2. Run the provider restore into that target; never restore production in place.
3. Verify schema, migration history, row-count checksums for agreed synthetic
   tables, application `/health`, and the latest Harness acceptance evidence.
4. Record restore duration and recovery point/objective results.
5. Delete the isolated target only after the evidence packet is retained and
   the operator approves cleanup.

No repository workflow is permitted to bypass these controls. The release
workflow only consumes the read-only backup/PITR evidence artifact.

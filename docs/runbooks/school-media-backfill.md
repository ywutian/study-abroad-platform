# School Media Backfill Runbook

School cards show a gradient placeholder when the API returns no approved primary
`CAMPUS_COVER` asset. The release code supports media display, but production
still needs a separate discovery and review pass to populate `SchoolMediaAsset`.

## Run Discovery

Use the **School Media Backfill** GitHub Actions workflow.

Recommended first run:

- `limit`: `25`
- `source`: `all`
- `dry_run`: `true`
- `image_tag`: `latest`
- `storage_type`: `local`

If the dry run finds reasonable candidates, rerun with `dry_run=false`. This
creates auditable media candidates in production without changing school cards
until an asset is approved.

## Review And Publish

Open `/admin/schools?tab=media` and review the queue.

- Wikimedia candidates include license/attribution and can be approved even
  when production public storage is not configured; the public original URL is
  used as the approved media URL.
- Official website candidates still require public object storage before
  approval in production. This avoids depending on unaudited hotlinks from
  school websites.

After approval, the public school API returns:

```json
{
  "media": {
    "campusCover": { "url": "https://..." },
    "logo": null
  }
}
```

The browse card will then render the real campus image instead of the gradient
placeholder.

## Useful Checks

```bash
curl -sS 'https://study-abroad-platform-web.vercel.app/api/v1/schools?pageSize=3' \
  | jq '.data.items[] | {name, media}'
```

```bash
curl -sS 'https://study-abroad-platform-web.vercel.app/api/v1/schools/admin/media-coverage'
```

The admin endpoint requires an admin session when called through the app; use
the Admin Media tab for normal operations.

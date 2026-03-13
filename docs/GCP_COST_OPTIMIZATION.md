# GCP Cost Optimization (2026-03-10)

## Changes Made

### 1. Deleted Memorystore Redis (~$40/mo saved)

The API has built-in fallback to in-memory cache when `REDIS_URL` is not set.

**Previous config:**

```
Instance: study-abroad-redis
Region: us-central1
Tier: BASIC
Memory: 1GB
Host: 10.138.157.211:6379
Network: projects/study-abroad-prod-2025/global/networks/default
Reserved IP: 10.138.157.208/29
```

**Restore command:**

```bash
gcloud redis instances create study-abroad-redis \
  --region=us-central1 \
  --tier=BASIC \
  --size=1 \
  --network=default \
  --quiet

# Get the new IP:
REDIS_IP=$(gcloud redis instances describe study-abroad-redis --region=us-central1 --format='value(host)')

# Add REDIS_URL back to Cloud Run:
gcloud run services update study-abroad-api \
  --region=us-central1 \
  --set-env-vars="REDIS_URL=redis://${REDIS_IP}:6379" \
  --quiet
```

### 2. Cloud Run min-instances 1 → 0 (~$10-15/mo saved)

Allows service to scale to zero when idle. First request after idle will have ~3-5s cold start.

**Previous config:**

```
min-instances: 1
max-instances: 3
CPU: 1000m (with cpu-throttling)
Memory: 512Mi
```

**Restore command:**

```bash
gcloud run services update study-abroad-api \
  --region=us-central1 \
  --min-instances=1 \
  --quiet
```

### 3. Removed VPC Connector, switched to Cloud SQL Auth Proxy (~$15-20/mo saved)

VPC Connector runs 2x e2-micro VMs 24/7. Cloud SQL Auth Proxy is built into Cloud Run at no extra cost.

**Previous config:**

```
VPC Connector: projects/study-abroad-prod-2025/locations/us-central1/connectors/study-abroad-connector
  Machine type: e2-micro
  Min instances: 2
  Max instances: 3

Cloud SQL: Private IP only (10.3.0.3)
DATABASE_URL: postgresql://studyabroad:***@10.3.0.3:5432/study_abroad?sslmode=require
```

**New config:**

```
Cloud SQL: Public IP enabled (protected by IAM + authorized networks)
Cloud Run: --add-cloudsql-instances=study-abroad-prod-2025:us-central1:study-abroad-db
DATABASE_URL: postgresql://studyabroad:***@localhost:5432/study_abroad?host=/cloudsql/study-abroad-prod-2025:us-central1:study-abroad-db
```

**Restore commands (revert to VPC Connector):**

```bash
# 1. Recreate VPC Connector
gcloud compute networks vpc-access connectors create study-abroad-connector \
  --region=us-central1 \
  --network=default \
  --range=10.8.0.0/28 \
  --machine-type=e2-micro \
  --min-instances=2 \
  --max-instances=3

# 2. Disable public IP on Cloud SQL
gcloud sql instances patch study-abroad-db \
  --no-assign-ip \
  --quiet

# 3. Update Cloud Run to use VPC Connector + private IP
gcloud run services update study-abroad-api \
  --region=us-central1 \
  --vpc-connector=projects/study-abroad-prod-2025/locations/us-central1/connectors/study-abroad-connector \
  --vpc-egress=private-ranges-only \
  --remove-cloudsql-instances \
  --set-env-vars="DATABASE_URL=postgresql://studyabroad:***@10.3.0.3:5432/study_abroad?sslmode=require" \
  --quiet

# 4. Update GitHub secret DATABASE_URL to private IP version
# gh secret set DATABASE_URL --body "postgresql://studyabroad:***@10.3.0.3:5432/study_abroad?sslmode=require"

# 5. Update CI workflows: change --set-cloudsql-instances back to --vpc-connector in migration Job
```

## Cost Estimate

| Resource                    | Before      | After       | Savings  |
| --------------------------- | ----------- | ----------- | -------- |
| Memorystore Redis           | ~$40/mo     | $0          | ~$40     |
| VPC Connector (2x e2-micro) | ~$17/mo     | $0          | ~$17     |
| Cloud Run (min=1)           | ~$20/mo     | ~$5/mo      | ~$15     |
| Cloud SQL (db-f1-micro)     | ~$8/mo      | ~$8/mo      | $0       |
| **Total**                   | **~$85/mo** | **~$13/mo** | **~$72** |

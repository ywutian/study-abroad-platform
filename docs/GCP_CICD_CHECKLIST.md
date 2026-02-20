# GCP 全套部署 CI/CD 清单

> **结论：你不需要再写 CI/CD 代码**，仓库里已有 workflow 和 Cloud Build 配置。只需要在 **GitHub** 和 **GCP 控制台** 里做配置即可。

---

## 仓库里已有的（不用写）

| 文件                               | 作用                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`         | Lint → Type Check → Unit Tests → E2E Tests → Security Scan → Build → Deploy to GCP |
| `.github/workflows/deploy-gcp.yml` | 手动触发部署（与 ci.yml 中的 deploy-gcp job 相同逻辑）                             |
| `apps/api/Dockerfile`              | 多阶段构建（builder + runner），non-root 用户，含 entrypoint.sh 做迁移             |

### 部署管线流程

```
push main → CI (lint + typecheck + test + e2e + security) → Build → Deploy to GCP
                                                                         ↓
                                                              docker build + push
                                                                         ↓
                                                              gcloud run deploy
                                                                         ↓
                                                              Smoke test (5 retries)
                                                                    ↓          ↓
                                                                  pass       fail → Auto rollback
```

### 企业级安全特性

- **部署门控**: Deploy 依赖 Build + E2E + Security Scan 全部通过
- **Smoke test**: 部署后自动 health check（5 次重试，每次间隔 5s）
- **自动回滚**: Smoke test 失败时自动回滚到上一个健康 revision
- **镜像标签**: 每次构建使用 commit SHA 标签（可追溯）
- **Cloud Run 配置**: `--min-instances=1`（避免冷启动）、`--max-instances=3`、`--timeout=300`
- **Workload Identity Federation**: 无需服务账号密钥（OIDC 短期令牌）
- **Security Scan**: Trivy 文件系统扫描（CRITICAL + HIGH），阻断模式

---

## 你需要配置的（不写代码，只填配置）

当前使用 **Workload Identity Federation** 认证：GitHub Actions 用 OIDC 换取短期令牌，**不需要服务账号 JSON 密钥**，适合组织策略禁止创建 SA 密钥的情况。

### 1. GitHub Actions Secrets

在 **GitHub 仓库 → Settings → Secrets and variables → Actions** 里新增：

| Secret 名称                      | 说明                                           | 示例                     |
| -------------------------------- | ---------------------------------------------- | ------------------------ |
| `GCP_PROJECT_ID`                 | GCP 项目 ID                                    | `study-abroad-prod-2025` |
| `GCP_REGION`                     | 部署区域                                       | `us-central1`            |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity 提供方完整路径（见下方 2.3） | 见下方「2.3 获取并填入」 |

**不需要** `GCP_SERVICE_ACCOUNT_KEY`。

### 2. GCP 一次性配置：服务账号 + Workload Identity Federation

**2.0 检查或创建服务账号（不确定是否建过时先做这步）**

先看项目里有没有 `github-actions-deploy`：

```bash
export GCP_PROJECT_ID=study-abroad-prod-2025
gcloud iam service-accounts list --project=$GCP_PROJECT_ID --filter="email:github-actions-deploy"
```

- **有输出**（能看到 `github-actions-deploy@study-abroad-prod-2025.iam.gserviceaccount.com`）：说明已创建，直接做 **2.1**。
- **无输出**：执行下面创建并授权（不创建密钥，符合组织策略）：

```bash
# 创建服务账号
gcloud iam service-accounts create github-actions-deploy \
  --project=$GCP_PROJECT_ID \
  --display-name="GitHub Actions GCP Deploy"

# 授予 CI 所需角色
export SA=github-actions-deploy@${GCP_PROJECT_ID}.iam.gserviceaccount.com
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID --member="serviceAccount:$SA" --role="roles/run.admin"
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID --member="serviceAccount:$SA" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID --member="serviceAccount:$SA" --role="roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID --member="serviceAccount:$SA" --role="roles/cloudbuild.builds.editor"
```

然后再从 **2.1** 开始做 Workload Identity 配置。

**2.1 创建 Workload Identity 池**

```bash
export GCP_PROJECT_ID=study-abroad-prod-2025
gcloud iam workload-identity-pools create "github" \
  --project="$GCP_PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions Pool"
```

**2.2 创建 OIDC 提供方（绑定 GitHub）**

把下面的 `YOUR_GITHUB_ORG` 换成你的 GitHub 组织或用户名（与仓库 owner 一致），用于限制只有该 org 下的 workflow 能换到令牌：

```bash
export GITHUB_ORG=YOUR_GITHUB_ORG
gcloud iam workload-identity-pools providers create-oidc "github-actions" \
  --project="$GCP_PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="github" \
  --display-name="GitHub Actions Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == '${GITHUB_ORG}'" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

**2.3 允许池内身份扮演服务账号**

把下面 `YOUR_ORG/study-abroad-platform` 换成你的 **GitHub 仓库**（如 `yungrace/study-abroad-platform`），然后执行：

```bash
export REPO="YOUR_ORG/study-abroad-platform"
PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format='value(projectNumber)')
POOL_ID="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github"
gcloud iam service-accounts add-iam-policy-binding \
  "github-actions-deploy@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --project="$GCP_PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${REPO}"
```

注意：`--role` 不要误写成 `--proe`；2.2 必须在 2.1 创建池之后执行。

**2.4 获取 Provider 路径并填入 GitHub Secret**

执行后把输出里的**完整路径**复制到 GitHub Secret `GCP_WORKLOAD_IDENTITY_PROVIDER`（形如 `projects/1032896108391/locations/global/workloadIdentityPools/github/providers/github-actions`）：

```bash
gcloud iam workload-identity-pools providers describe "github-actions" \
  --project="$GCP_PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="github" \
  --format="value(name)"
```

### 3. Cloud Run 环境变量（首次部署时设好）

当前 workflow **只负责更新镜像**，不会覆盖你在 Cloud Run 上已配置的环境变量。因此 **DATABASE_URL、REDIS_URL、CORS_ORIGINS 等需要你事先在 Cloud Run 上设好**（首次可跟 `docs/DEPLOY_GCP_STEPS.md` 第六步一起做）。

**必须 / 强烈建议：**

- `NODE_ENV=production`
- `DATABASE_URL`（Cloud SQL 连接串，内网 IP）
- `REDIS_URL`（Memorystore 连接串）
- `JWT_SECRET`、`JWT_REFRESH_SECRET`（至少 16 字符）
- `CORS_ORIGINS`（前端域名，多个用逗号分隔）
- `FRONTEND_URL`（前端地址，邮件链接等用）
- `VAULT_ENCRYPTION_KEY`（生产必设，见 env 校验）

**可选：**  
`JWT_EXPIRES_IN`、`JWT_REFRESH_EXPIRES_IN`、SMTP、Sentry、Storage 等见 `apps/api` 的 env 说明或 `ENV_TEMPLATE.md`。

设置方式任选其一：

- **控制台**：Cloud Run → 选择服务 `study-abroad-api` → 编辑与部署新修订版本 → 变量与密钥。
- **gcloud**：在已有服务上更新变量  
  `gcloud run services update study-abroad-api --region=us-central1 --set-env-vars="KEY=VALUE" ...`

---

## 触发方式

- **自动**：向 `main` 推送并合并后，CI 通过即自动跑 deploy-gcp。
- **手动**：GitHub → Actions → “Deploy API to GCP” → Run workflow。

---

## 小结

| 你要做的                                                         | 是否要写代码                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| 在 GitHub 配 3 个 Secrets（含 `GCP_WORKLOAD_IDENTITY_PROVIDER`） | 否                                                     |
| 在 GCP 做一次性 WIF 配置：池、提供方、允许扮演 SA（见 2.1–2.4）  | 否                                                     |
| 在 Cloud Run 上设好环境变量（首次或按需）                        | 否                                                     |
| 改 workflow / cloudbuild 逻辑                                    | 否（除非你要加步骤，例如用 Secret Manager 传敏感 env） |

若你希望**在 CI 里通过 GitHub Secrets 注入部分环境变量**（例如不把 DB 密码放在 GCP 控制台），可以再加一步：在 `deploy-gcp.yml` 的 `gcloud run deploy` 里用 `--set-env-vars` 或 `--set-secrets` 从 GitHub Secrets 或 Secret Manager 读取。需要的话可以再写一版示例。

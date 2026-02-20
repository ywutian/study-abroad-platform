# 企业级方案：通过负载均衡开放 Cloud Run（无需 allUsers）

当组织策略禁止对 Cloud Run 使用 `allUsers` 时，可用 **HTTP(S) 负载均衡** 作为公网唯一入口，由负载均衡用服务账号调用 Cloud Run，无需把 Cloud Run 设为“允许未验证的调用”。

---

## 架构示意

```
用户浏览器/App
    → HTTPS 负载均衡（公网 IP / 自定义域名）
        → 后端：Cloud Run（仅允许 LB 的服务账号调用，不开放 allUsers）
```

- 公网只看到负载均衡的 IP/域名，Cloud Run URL 不暴露。
- 仅负载均衡使用的服务账号拥有 `roles/run.invoker`，符合“不允许 allUsers”的策略。
- 可在此基础上加 **Cloud Armor**（WAF、限速）、**自定义域名 + 托管证书**、**CDN** 等，便于做企业级安全与审计。

---

## 实施步骤概要

**建议顺序**：先完成下方 1 → 2 → 3 → 4 → 5（创建 LB 并拿到公网 IP/域名），再在「部署前 Checklist」中确认代码与 Cookie/CSP 已就绪，最后在 LB 后端启用会话亲和（步骤 4 的 WebSocket 配置）并设置环境变量（步骤 5）。

### 1. 创建用于调用 Cloud Run 的服务账号（若尚未有）

```bash
# 创建服务账号（名称可自定）
gcloud iam service-accounts create lb-invoker \
  --project=study-abroad-prod-2025 \
  --display-name="Load Balancer Cloud Run Invoker"

# 仅授予该账号调用 Cloud Run 的权限
gcloud run services add-iam-policy-binding study-abroad-api \
  --region=us-central1 \
  --project=study-abroad-prod-2025 \
  --member="serviceAccount:lb-invoker@study-abroad-prod-2025.iam.gserviceaccount.com" \
  --role=roles/run.invoker
```

### 2. 创建无服务器 NEG（指向 Cloud Run）

在 **网络服务 → 负载均衡** 中：

- **后端配置**：创建 **无服务器 NEG**，关联 Cloud Run 服务 `study-abroad-api`（区域 us-central1），认证选择上一步的 **lb-invoker@study-abroad-prod-2025.iam.gserviceaccount.com**。
- 或使用 gcloud 创建 NEG 并关联 Cloud Run（需指定上述服务账号用于身份验证）。

### 3. 创建后端服务

- 后端类型：无服务器 NEG（上一步创建的）。
- 无需健康检查或可配简单 HTTP 健康检查（若 Cloud Run 提供 /health）。

### 4. 创建 URL 映射与前端

- **URL 映射**：默认路由指向上一步的后端服务（可将 `/*` 或 `/api/*` 指到该后端）。
- **前端**：
  - **HTTP**：前端协议 HTTP，端口 80，可重定向到 HTTPS。
  - **HTTPS**：前端协议 HTTPS，端口 443；绑定**托管证书**（或先使用临时证书做测试）。

### 5. 创建转发规则

- 为上述前端创建 **外部 HTTP(S) 转发规则**，获得一个**外部 IP**（或绑定已有 IP）。
- 若使用自定义域名，在该 IP 上配置 DNS A 记录，并在前端使用**谷歌托管证书**。

### 6. 前端 / App 配置

- 将 API 基础地址改为：**负载均衡的 IP 或域名**（例如 `https://api.yourdomain.com`），不再直接使用 `https://study-abroad-api-xxx.run.app`。
- CORS、JWT 等仍由现有 Nest 应用处理，无需因 LB 而改动业务逻辑。

---

## 可选：企业级增强

| 能力                      | 说明                                                                        |
| ------------------------- | --------------------------------------------------------------------------- |
| **Cloud Armor**           | 在负载均衡后端策略上绑定安全策略：WAF 规则、地理/IP 限制、DDoS 与限速。     |
| **自定义域名 + 托管证书** | 在 LB 前端使用 `api.yourdomain.com`，由 Google 托管 SSL 证书。              |
| **CDN**                   | 对静态或可缓存接口启用 Cloud CDN，降低延迟、减轻后端压力。                  |
| **审计与监控**            | 用 Cloud Logging / Monitoring 记录 LB 与 Cloud Run 的访问与错误，满足合规。 |

---

## 开发/测试阶段：会不会增加成本？

**会多一点成本，但当前阶段金额很小：**

| 项目                    | 仅 Cloud Run（若允许 allUsers）       | 加负载均衡后                                                                                         |
| ----------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Cloud Run               | 按请求/CPU 计费，无用户时几乎为 0     | 同上                                                                                                 |
| 负载均衡                | 无                                    | **转发规则**约 **$18/月**（一个外部 IP + 规则），**流量**按 GB 计（前 1GB 免费，测试流量通常可忽略） |
| **合计（无用户/测试）** | 几美元/月（Cloud Run 冷启动偶尔请求） | **约 $18–25/月**（主要是 LB 固定成本）                                                               |

**建议：**

- **现在没有用户、只是测试开发**：优先让组织管理员给 **study-abroad-prod-2025** 开个例外，允许该项目的 Cloud Run 使用 `allUsers`，这样**不增加负载均衡成本**，直接访问 `https://study-abroad-api-xxx.run.app` 即可。
- **必须符合组织策略、不能开 allUsers**：再上负载均衡；测试期多出的约 $18/月 可视为合规成本，等有用户或正式上线再评估是否保留 LB。

### 开发/测试阶段具体怎么操作

**管理员推荐：不改组织策略，直接开放公网访问（无需 allUsers）**

组织有「域名受限共享」等策略时，官方推荐做法是**不**在 IAM 里添加 `allUsers`，而是**关闭该 Cloud Run 服务的 Invoker IAM 检查**，效果同样是“允许未验证用户调用”，且不受组织策略限制。

你作为管理员，在本地执行（一条命令即可）：

```bash
gcloud run services update study-abroad-api \
  --region=us-central1 \
  --project=study-abroad-prod-2025 \
  --no-invoker-iam-check
```

- 执行成功后，任何人均可通过 `https://study-abroad-api-<hash>.run.app` 访问该服务，无需再执行下面的「第一步」或改组织策略。
- 之后若需收回公网访问，执行同一条命令但改为 `--invoker-iam-check`（即去掉 `--no-`）即可。

**可选：若你坚持用 IAM 的 allUsers（需改组织策略）**

**第一步：你本地执行（会用来确认是否被组织策略拦截）**

在项目目录或本机已登录 `gcloud` 且当前项目为 `study-abroad-prod-2025` 时执行：

```bash
gcloud run services add-iam-policy-binding study-abroad-api \
  --region=us-central1 \
  --project=study-abroad-prod-2025 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

- **若成功**：无需做下面第二步，直接做第三步验证即可。
- **若报错** 类似 “Organization policy … do not belong to a permitted customer”：说明组织策略禁止了 `allUsers`，需要把**完整报错内容**发给组织管理员，并请其按第二步操作。

**第二步：组织管理员在 GCP 控制台放开该项目的例外**

1. 用**组织级或文件夹级**有权限的账号登录 [Google Cloud Console](https://console.cloud.google.com)。
2. 左上角选择**组织**（或对应文件夹），进入 **IAM 与管理员 → 组织策略**（或 **Security → 组织策略**）。
3. 在策略列表中找到与 **IAM 允许的成员/域名** 相关的约束，例如：
   - **“允许的 Policy 成员域名”**（`iam.allowedPolicyMemberDomains`），或
   - 名称中含有 **Cloud Run** / **invoker** / **allUsers** 的策略。
4. 点进该策略 → **管理策略** → 为该约束添加**例外**：
   - 作用范围选 **项目**，项目选 **study-abroad-prod-2025**；
   - 或选择“在以下项目中覆盖”：添加 **study-abroad-prod-2025**，并设置为 **允许**（或关闭该约束在此项目上的限制）。
5. 保存后等待几分钟生效，再让开发者重新执行第一步的 `gcloud` 命令。

若控制台里找不到对应策略，可让管理员在 **组织策略** 页搜索 **“allUsers”** 或 **“run.invoker”**，或根据第一步报错中的 constraint 名称搜索。

**第三步：验证（你本地）**

管理员放开后，你再执行一次第一步的 `gcloud` 命令，应显示 `Updated IAM policy for service [study-abroad-api].`。然后：

- 浏览器打开前端（Vercel 或本地），把 API 地址设为 Cloud Run 的 URL：`https://study-abroad-api-<hash>.run.app`（在 Cloud Run 控制台该服务的“概览”里可看到）。
- 尝试登录、刷新、调接口；若不再出现 403，即表示 allUsers 已生效，无需负载均衡即可联调。

---

## 与“直接开放 Cloud Run”的对比

| 项目     | 直接 allUsers 调用 Cloud Run | 企业级：负载均衡 + 服务账号 |
| -------- | ---------------------------- | --------------------------- |
| 组织策略 | 需允许 allUsers              | 不需要 allUsers，符合限制   |
| 公网暴露 | Cloud Run URL 直接暴露       | 仅 LB 的 IP/域名暴露        |
| 访问控制 | 仅“是否允许未验证”           | 可叠加 Armor、IP 白名单等   |
| 扩展性   | 依赖 Cloud Run 自身          | 可加 CDN、多区域、多后端    |
| 成本     | 仅 Cloud Run                 | LB 约 $18/月起 + 流量       |

---

## 部署前 Checklist（代码层面）

在将 Cloud Run 切换到负载均衡架构之前，需确认以下代码级配置已完成：

### ✅ 1. Trust Proxy（已修复）

`apps/api/src/main.ts` 必须配置 `trust proxy`，否则 `request.ip` 返回 LB 内部 IP，导致限速对所有用户共享同一计数器。

```typescript
app.getHttpAdapter().getInstance().set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
```

### ✅ 2. Cookie Path 兼容（已修复）

`apps/api/src/modules/auth/auth.controller.ts` 中 RefreshToken Cookie 的 `path` 已改为 `/`，避免 LB URL 重写导致 cookie 不随请求发送、Token 刷新静默失败。

### ✅ 3. CSP connect-src 跨域 WebSocket（已修复）

`apps/api/src/main.ts` 的 Helmet CSP `connectSrc` 已动态读取 `CORS_ORIGINS`，同时添加 `wss://` 变体，允许跨域 WebSocket 连接。

### 4. WebSocket 会话亲和（LB 配置级）

Chat 和 AI-Agent 两个 WebSocket Gateway 使用进程内 Map 管理连接。多实例部署时需在 LB 后端服务启用 **Session Affinity（Client IP based）**，确保同一用户的 WebSocket 长连接始终路由到同一实例。

**在控制台操作：**

1. 打开 **网络服务 → 负载均衡**，编辑你的 HTTPS 负载均衡。
2. 进入 **后端配置**，点击该负载均衡使用的**后端服务**（例如 `study-abroad-api-backend`）。
3. 在后端服务编辑页找到 **会话亲和性（Session affinity）**，改为 **“根据客户端 IP（Client IP）”**，保存。

**或用 gcloud：**

```bash
# 先查后端服务名称
gcloud compute backend-services list --project=study-abroad-prod-2025 --global

# 为无服务器 NEG 后端启用基于客户端 IP 的会话亲和（替换 YOUR_BACKEND_SERVICE_NAME）
gcloud compute backend-services update YOUR_BACKEND_SERVICE_NAME \
  --project=study-abroad-prod-2025 \
  --global \
  --session-affinity=CLIENT_IP \
  --affinity-cookie-ttl=0
```

**长期方案**：安装 `@socket.io/redis-adapter`，将 WebSocket 连接状态存入 Cloud Memorystore (Redis)，多实例可共享会话，不再依赖会话亲和。

### 5. 环境变量与前端/移动端对接

**Cloud Run（或 LB）上的 API 环境变量：**

确保 Cloud Run 环境变量中设置：

```bash
CORS_ORIGINS=https://app.yourdomain.com   # 前端实际访问来源，多个用逗号分隔
FRONTEND_URL=https://app.yourdomain.com   # 邮件中的链接域名
```

**前端/移动端对接检查（避免 403、CSP 拦截、CORS 报错）：**

| 端                  | 配置项                | 说明                                                                                                                     |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Web (Vercel)**    | `NEXT_PUBLIC_API_URL` | 设为 Cloud Run 的 URL（或 LB 域名）。前端 CSP 会据此自动放行 `connect-src`，否则 AI 助手等直连 API 的请求会被 CSP 拦截。 |
| **Web**             | 同上                  | 若为空，请求走 Next 同源再被 rewrite 到 API，仅当直连 API 时（如 SSE 流）必须设置。                                      |
| **API (Cloud Run)** | `CORS_ORIGINS`        | 必须包含前端实际来源（如 `https://xxx.vercel.app`、自定义域名），否则浏览器会报 CORS 错误。                              |
| **Mobile**          | `EXPO_PUBLIC_API_URL` | 真机/模拟器访问时设为 Cloud Run URL（或 LB 域名）。见 `apps/mobile/.env.example`。                                       |

---

## 参考

- [通过负载均衡将流量发送到 Cloud Run](https://cloud.google.com/load-balancing/docs/https/setup-global-ext-https-serverless)
- [Cloud Run 与无服务器 NEG](https://cloud.google.com/run/docs/load-balancing)

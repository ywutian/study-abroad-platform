# 极小 VPS 单机跑全栈部署指南

> 在单台 2–4GB 内存的 VPS 上跑 API + PostgreSQL + Redis，前端继续用 Vercel。成本约 **$4–8/月**，无休眠、无 scale-to-zero。  
> 最后更新：2026-02

---

## 一、架构与成本

### 1.1 方案

| 组件           | 部署位置           | 说明                                               |
| -------------- | ------------------ | -------------------------------------------------- |
| **前端**       | **Vercel**（免费） | 不改动，`NEXT_PUBLIC_API_URL` 指到 VPS 的 API 域名 |
| **API**        | VPS Docker 容器    | NestJS，常驻                                       |
| **PostgreSQL** | VPS Docker 容器    | 含 pgvector，与 API 同机                           |
| **Redis**      | VPS Docker 容器    | 与 API 同机                                        |

不在 VPS 上跑 Next.js，可省约 500MB–1GB 内存，2GB 机器即可跑 DB + Redis + API。

### 1.2 推荐配置与价格（月费约）

| 厂商             | 规格                 | 月费（约）    | 说明               |
| ---------------- | -------------------- | ------------- | ------------------ |
| **Hetzner**      | CX22（2 vCPU, 4GB）  | 约 €4.5 / ~$5 | 性价比高，欧洲机房 |
| **Hetzner**      | CPX11（2 vCPU, 2GB） | 约 €4 / ~$4.5 | 最小可跑，内存紧张 |
| **DigitalOcean** | Basic 2GB            | $12           | 文档多、备份方便   |
| **Vultr**        | 2GB                  | $10           | 多区域             |
| **Linode**       | Nanode 2GB           | $12           | 同属 Akamai        |

建议至少 **2GB 内存**；若同时跑 Web 容器或流量上来，选 **4GB**。

---

## 二、前置准备

- 一台 VPS（Ubuntu 22.04 或 24.04）
- 一个域名（如 `api.yourdomain.com` 指到 VPS IP）
- 本机已安装 Git、可 SSH 登录 VPS

---

## 三、在 VPS 上操作（按顺序）

### 3.1 登录并装 Docker

```bash
# SSH 登录
ssh root@你的VPS_IP

# 安装 Docker
apt update && apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 可选：创建非 root 用户用于部署
adduser deploy
usermod -aG docker deploy
```

### 3.2 拉代码并准备环境变量

```bash
cd /opt  # 或你选的目录
git clone https://github.com/你的用户名/study-abroad-platform.git
cd study-abroad-platform
```

在项目根目录创建 **`.env.production`**（或沿用 `.env`，不要提交到 Git）：

```bash
# 数据库（强密码）
DB_USER=studyabroad
DB_PASSWORD=你的强密码
DB_NAME=study_abroad

# Redis
REDIS_PASSWORD=你的Redis强密码

# JWT（必须 16+ 字符）
JWT_SECRET=你的JWT密钥
JWT_REFRESH_SECRET=你的Refresh密钥

# API 对外地址（给 CORS、邮件链接用）
FRONTEND_URL=https://你的前端域名
NEXT_PUBLIC_API_URL=https://api.你的域名

# 可选：OpenAI、Resend、Sentry 等
# OPENAI_API_KEY=...
# RESEND_API_KEY=...
# EMAIL_FROM=noreply@lumniedu.com
# EMAIL_FROM_NAME=Lumni
# SENTRY_DSN=...
```

### 3.3 只跑 DB + Redis + API（不跑 Web）

使用现有 `docker-compose.yml`，只启动三个服务：

```bash
# 在项目根目录
export $(grep -v '^#' .env.production | xargs)

docker compose up -d db redis
# 等待 DB/Redis 健康
sleep 15
docker compose up -d api
```

确认 API 正常：

```bash
curl -s http://localhost:4101/health
```

### 3.4 用 Nginx + Let's Encrypt 做反向代理与 HTTPS

在 VPS 上安装 Nginx 和 certbot（不用 Docker 里的 nginx，方便管理证书）：

```bash
apt install -y nginx certbot python3-certbot-nginx
certbot --nginx -d api.你的域名
```

Nginx 配置（`/etc/nginx/sites-available/api`）：

```nginx
server {
    listen 80;
    server_name api.你的域名;
    location / {
        proxy_pass http://127.0.0.1:4101;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

启用并重载：

```bash
ln -s /etc/nginx/sites-available/api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

之后用 certbot 续期即可：`certbot renew`（可加 cron）。

### 3.5 开放端口与防火墙

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

确保 Docker 里 API 只监听 `4101`，不直接暴露 0.0.0.0:4101 到公网（通过 Nginx 代理即可）。

---

## 四、docker-compose 只起三服务的用法

当前仓库的 `docker-compose.yml` 里 API 依赖 `db` 和 `redis`，不启动 `web` 和 `nginx` 即可：

```bash
docker compose up -d db redis api
```

如需限制内存，可在 `docker-compose.yml` 里给各 service 加：

```yaml
api:
  deploy:
    resources:
      limits:
        memory: 768M
db:
  deploy:
    resources:
      limits:
        memory: 512M
redis:
  deploy:
    resources:
      limits:
        memory: 128M
```

---

## 五、数据与备份

- **首次**：若从 Neon 迁数据，在本地用 `pg_dump` 从 Neon 导出，在 VPS 上 `psql` 或 `docker exec` 导入到容器内 Postgres。
- **日常备份**：cron 里每天跑一次 `pg_dump` 到磁盘或上传到对象存储：

```bash
0 3 * * * docker exec study-abroad-db pg_dump -U postgres study_abroad | gzip > /backup/db_$(date +\%Y\%m\%d).sql.gz
```

---

## 六、更新应用

```bash
cd /opt/study-abroad-platform
git pull
docker compose build api
docker compose up -d api
```

---

## 七、小结

| 项目     | 说明                                                       |
| -------- | ---------------------------------------------------------- |
| **成本** | 约 $4–8/月（VPS 单机），前端 Vercel 免费                   |
| **休眠** | 无，服务常驻                                               |
| **迁移** | 用现有 Dockerfile + docker-compose，只起 db/redis/api      |
| **运维** | 自己管更新、备份、Nginx/证书；可选加监控（如 UptimeRobot） |

按上述步骤即可在极小 VPS 上一台跑全部分后端（API + DB + Redis），前端继续用 Vercel。

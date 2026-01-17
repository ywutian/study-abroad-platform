# API Reference

> Base URL: `http://localhost:3006/api/v1`
> Authentication: JWT Bearer Token (unless marked Public)
> Interactive docs: `/api/docs` (Swagger UI — currently disabled, see ADR-0001)

## Overview

| Metric               | Value |
| -------------------- | ----- |
| Total Endpoints      | 400+  |
| Modules              | 29    |
| Controllers          | 32    |
| Public Endpoints     | ~30   |
| Admin-Only Endpoints | ~80   |

## Authentication

All endpoints require a valid JWT Bearer token by default. Endpoints marked **Public** can be accessed without authentication.

```
Authorization: Bearer <access_token>
```

Tokens are obtained via `POST /auth/login` and refreshed via `POST /auth/refresh`.

## Error Codes

| Code | Meaning               | Common Causes                                                 |
| ---- | --------------------- | ------------------------------------------------------------- |
| 400  | Bad Request           | Invalid DTO, missing required fields                          |
| 401  | Unauthorized          | Missing/expired JWT token                                     |
| 403  | Forbidden             | Insufficient role (e.g., non-ADMIN accessing admin endpoints) |
| 404  | Not Found             | Resource does not exist                                       |
| 409  | Conflict              | Duplicate resource (e.g., duplicate email)                    |
| 429  | Too Many Requests     | Rate limit exceeded                                           |
| 500  | Internal Server Error | Server-side error                                             |

## Response Format

All responses follow a consistent wrapper:

```json
{
  "success": true,
  "data": { ... },
  "message": "optional message"
}
```

Paginated responses:

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

---

## 1. Health Check

| Method | Path               | Auth   | Description                         |
| ------ | ------------------ | ------ | ----------------------------------- |
| GET    | `/health`          | Public | Basic health check                  |
| GET    | `/health/detailed` | Public | Detailed health (DB, Redis latency) |
| GET    | `/health/live`     | Public | Kubernetes liveness probe           |
| GET    | `/health/ready`    | Public | Kubernetes readiness probe          |
| GET    | `/health/startup`  | Public | Kubernetes startup probe            |

## 2. Authentication (`/auth`)

Rate limits: login 3/min, register 5/min

| Method | Path                        | Auth     | Description                            |
| ------ | --------------------------- | -------- | -------------------------------------- |
| POST   | `/auth/register`            | Public   | Register new user                      |
| POST   | `/auth/login`               | Public   | Login (returns access + refresh token) |
| POST   | `/auth/refresh`             | Public   | Refresh access token                   |
| POST   | `/auth/logout`              | Required | Logout (invalidate token)              |
| GET    | `/auth/verify-email`        | Public   | Verify email address                   |
| POST   | `/auth/resend-verification` | Public   | Resend verification email              |
| POST   | `/auth/forgot-password`     | Public   | Request password reset                 |
| POST   | `/auth/reset-password`      | Public   | Reset password with token              |
| POST   | `/auth/change-password`     | Required | Change current password                |

## 3. User (`/users`)

| Method | Path                       | Auth     | Description                  |
| ------ | -------------------------- | -------- | ---------------------------- |
| GET    | `/users/me`                | Required | Get current user info        |
| GET    | `/users/me/dashboard`      | Required | Get dashboard data           |
| DELETE | `/users/me`                | Required | Delete account (soft delete) |
| GET    | `/users/me/export`         | Required | Export user data (GDPR)      |
| GET    | `/users/me/points`         | Required | Get current points           |
| GET    | `/users/me/points/history` | Required | Get points history           |
| GET    | `/users/me/points/rules`   | Required | Get points rules             |
| GET    | `/users/me/points/summary` | Required | Get points summary           |

## 4. Profile (`/profiles`)

| Method | Path                       | Auth     | Description          |
| ------ | -------------------------- | -------- | -------------------- |
| GET    | `/profiles/me`             | Required | Get my profile       |
| PUT    | `/profiles/me`             | Required | Update my profile    |
| GET    | `/profiles/:id`            | Required | Get profile by ID    |
| GET    | `/profiles/me/ai-analysis` | Required | AI profile analysis  |
| POST   | `/profiles/onboarding`     | Required | Complete onboarding  |
| GET    | `/profiles/me/grade`       | Required | Get AI profile grade |

### Test Scores

| Method | Path                           | Auth     | Description       |
| ------ | ------------------------------ | -------- | ----------------- |
| GET    | `/profiles/me/test-scores`     | Required | List test scores  |
| POST   | `/profiles/me/test-scores`     | Required | Add test score    |
| PUT    | `/profiles/me/test-scores/:id` | Required | Update test score |
| DELETE | `/profiles/me/test-scores/:id` | Required | Delete test score |

### Activities

| Method | Path                              | Auth     | Description        |
| ------ | --------------------------------- | -------- | ------------------ |
| GET    | `/profiles/me/activities`         | Required | List activities    |
| POST   | `/profiles/me/activities`         | Required | Add activity       |
| PUT    | `/profiles/me/activities/:id`     | Required | Update activity    |
| DELETE | `/profiles/me/activities/:id`     | Required | Delete activity    |
| PUT    | `/profiles/me/activities/reorder` | Required | Reorder activities |

### Awards

| Method | Path                          | Auth     | Description    |
| ------ | ----------------------------- | -------- | -------------- |
| GET    | `/profiles/me/awards`         | Required | List awards    |
| POST   | `/profiles/me/awards`         | Required | Add award      |
| PUT    | `/profiles/me/awards/:id`     | Required | Update award   |
| DELETE | `/profiles/me/awards/:id`     | Required | Delete award   |
| PUT    | `/profiles/me/awards/reorder` | Required | Reorder awards |

### Essays

| Method | Path                      | Auth     | Description      |
| ------ | ------------------------- | -------- | ---------------- |
| GET    | `/profiles/me/essays`     | Required | List essays      |
| GET    | `/profiles/me/essays/:id` | Required | Get single essay |
| POST   | `/profiles/me/essays`     | Required | Create essay     |
| PUT    | `/profiles/me/essays/:id` | Required | Update essay     |
| DELETE | `/profiles/me/essays/:id` | Required | Delete essay     |

### Education

| Method | Path                         | Auth     | Description      |
| ------ | ---------------------------- | -------- | ---------------- |
| GET    | `/profiles/me/education`     | Required | List education   |
| POST   | `/profiles/me/education`     | Required | Add education    |
| PUT    | `/profiles/me/education/:id` | Required | Update education |
| DELETE | `/profiles/me/education/:id` | Required | Delete education |

### Target Schools

| Method | Path                                    | Auth     | Description              |
| ------ | --------------------------------------- | -------- | ------------------------ |
| GET    | `/profiles/me/target-schools`           | Required | List target schools      |
| PUT    | `/profiles/me/target-schools`           | Required | Batch set target schools |
| POST   | `/profiles/me/target-schools/:schoolId` | Required | Add target school        |
| DELETE | `/profiles/me/target-schools/:schoolId` | Required | Remove target school     |

## 5. Schools (`/schools`)

| Method | Path                         | Auth     | Description                        |
| ------ | ---------------------------- | -------- | ---------------------------------- |
| GET    | `/schools`                   | Public   | List schools (filters, pagination) |
| GET    | `/schools/:id`               | Public   | Get school detail                  |
| GET    | `/schools/ai/recommend`      | Required | AI school recommendations          |
| POST   | `/schools`                   | ADMIN    | Create school                      |
| PUT    | `/schools/:id`               | ADMIN    | Update school                      |
| POST   | `/schools/sync/scorecard`    | ADMIN    | Sync from College Scorecard        |
| POST   | `/schools/scrape/all`        | ADMIN    | Scrape admission info              |
| GET    | `/schools/scrape/configured` | ADMIN    | List scrape-configured schools     |

## 6. School Lists (`/school-lists`)

| Method | Path                         | Auth     | Description               |
| ------ | ---------------------------- | -------- | ------------------------- |
| GET    | `/school-lists`              | Required | Get user's school list    |
| POST   | `/school-lists`              | Required | Add school to list        |
| PUT    | `/school-lists/:id`          | Required | Update list item          |
| DELETE | `/school-lists/:id`          | Required | Remove from list          |
| GET    | `/school-lists/ai-recommend` | Required | AI school recommendations |

## 7. Admission Cases (`/cases`)

| Method | Path         | Auth     | Description       |
| ------ | ------------ | -------- | ----------------- |
| GET    | `/cases`     | Public   | List public cases |
| GET    | `/cases/me`  | Required | List my cases     |
| GET    | `/cases/:id` | Public   | Get case detail   |
| POST   | `/cases`     | Required | Create case       |
| PUT    | `/cases/:id` | Required | Update my case    |
| DELETE | `/cases/:id` | Required | Delete my case    |

## 8. Predictions (`/predictions`) — v2 Multi-Engine Ensemble

| Method | Path                            | Auth     | Description                                                    |
| ------ | ------------------------------- | -------- | -------------------------------------------------------------- |
| POST   | `/predictions`                  | Required | Run multi-engine ensemble prediction (stats + AI + historical) |
| GET    | `/predictions/history`          | Required | Get prediction history                                         |
| PATCH  | `/predictions/:schoolId/result` | Required | Report actual admission result for calibration                 |
| GET    | `/predictions/calibration`      | Public   | Get aggregated calibration statistics                          |

**POST `/predictions`** — 核心预测端点 (v2-ensemble)

Request body:

```json
{
  "schoolIds": ["clxx...", "clyy..."],
  "forceRefresh": true
}
```

Response includes: `probability`, `probabilityLow`, `probabilityHigh`, `tier` (reach/match/safety), `confidence` (low/medium/high), `factors`, `engineScores` (stats/AI/historical weights and fusion method), `suggestions`, `modelVersion`.

详细技术文档: [PREDICTION_SYSTEM.md](PREDICTION_SYSTEM.md)

## 9. Rankings (`/rankings`)

| Method | Path                  | Auth     | Description              |
| ------ | --------------------- | -------- | ------------------------ |
| POST   | `/rankings/calculate` | Public   | Calculate custom ranking |
| POST   | `/rankings`           | Required | Save ranking             |
| GET    | `/rankings/me`        | Required | Get my rankings          |
| GET    | `/rankings/public`    | Public   | Get public rankings      |
| GET    | `/rankings/:id`       | Public   | Get ranking by ID        |
| DELETE | `/rankings/:id`       | Required | Delete my ranking        |

## 10. AI Services (`/ai`)

| Method | Path                    | Auth     | Description             |
| ------ | ----------------------- | -------- | ----------------------- |
| POST   | `/ai/analyze-profile`   | Required | Analyze student profile |
| POST   | `/ai/review-essay`      | Required | Essay review            |
| POST   | `/ai/generate-ideas`    | Required | Generate essay ideas    |
| POST   | `/ai/school-match`      | Required | School matching         |
| POST   | `/ai/chat`              | Required | Free-form chat          |
| POST   | `/ai/polish-essay`      | Required | Essay polishing         |
| POST   | `/ai/rewrite-paragraph` | Required | Paragraph rewrite       |
| POST   | `/ai/continue-writing`  | Required | Continue writing        |
| POST   | `/ai/generate-opening`  | Required | Generate essay opening  |
| POST   | `/ai/generate-ending`   | Required | Generate essay ending   |

## 11. AI Agent (`/ai-agent`)

| Method | Path                        | Auth     | Description          |
| ------ | --------------------------- | -------- | -------------------- |
| POST   | `/ai-agent/chat`            | Required | Chat with AI Agent   |
| POST   | `/ai-agent/agent`           | Required | Call specific agent  |
| GET    | `/ai-agent/history`         | Required | Get chat history     |
| DELETE | `/ai-agent/conversation`    | Required | Clear conversation   |
| POST   | `/ai-agent/refresh-context` | Required | Refresh user context |
| GET    | `/ai-agent/usage`           | Required | Token usage stats    |
| GET    | `/ai-agent/rate-limit`      | Required | Rate limit status    |
| GET    | `/ai-agent/quota`           | Required | Usage quota          |
| GET    | `/ai-agent/health`          | Required | Agent health status  |

### User Data (`/ai-agent/user-data`)

Memories, conversations, entities, preferences management — 20 endpoints. See source controllers for full details.

### Admin (`/admin/ai-agent`)

Agent configuration, metrics, tracing, circuit breakers — 25 endpoints. All require ADMIN role.

## 12. Essay AI (`/essay-ai`)

| Method | Path                                 | Auth     | Description                   |
| ------ | ------------------------------------ | -------- | ----------------------------- |
| POST   | `/essay-ai/polish`                   | Required | AI essay polishing (20 pts)   |
| POST   | `/essay-ai/review`                   | Required | AI essay review (30 pts)      |
| POST   | `/essay-ai/brainstorm`               | Required | AI brainstorming (15 pts)     |
| GET    | `/essay-ai/history/:essayId`         | Required | Get AI history for essay      |
| GET    | `/essay-ai/gallery`                  | Public   | List public essays            |
| GET    | `/essay-ai/gallery/:essayId`         | Public   | Get public essay detail       |
| POST   | `/essay-ai/gallery/:essayId/analyze` | Required | Analyze public essay (20 pts) |

## 13. Forum (`/forum`)

| Method | Path                             | Auth     | Description        |
| ------ | -------------------------------- | -------- | ------------------ |
| GET    | `/forum/stats`                   | Public   | Forum statistics   |
| GET    | `/forum/categories`              | Public   | List categories    |
| POST   | `/forum/categories`              | ADMIN    | Create category    |
| GET    | `/forum/posts`                   | Public   | List posts         |
| GET    | `/forum/posts/:id`               | Public   | Get post detail    |
| POST   | `/forum/posts`                   | Required | Create post        |
| PUT    | `/forum/posts/:id`               | Required | Update post        |
| DELETE | `/forum/posts/:id`               | Required | Delete post        |
| POST   | `/forum/posts/:id/like`          | Required | Like/Unlike post   |
| POST   | `/forum/posts/:id/comments`      | Required | Add comment        |
| DELETE | `/forum/comments/:id`            | Required | Delete comment     |
| POST   | `/forum/posts/:id/apply`         | Required | Apply to join team |
| POST   | `/forum/applications/:id/review` | Required | Review application |
| POST   | `/forum/applications/:id/cancel` | Required | Cancel application |
| POST   | `/forum/posts/:id/leave`         | Required | Leave team         |
| GET    | `/forum/my-teams`                | Required | Get my teams       |
| POST   | `/forum/posts/:id/report`        | Required | Report post        |
| POST   | `/forum/comments/:id/report`     | Required | Report comment     |

## 14. Chat (`/chat`)

**Permission:** VERIFIED/ADMIN can initiate conversations; USER can only reply. Mutual follow required.

**Content Filtering:** Messages are checked for rate limit (30/min), repeated content (3 identical/5min), and sensitive words (auto-replaced with `***`).

| Method | Path                               | Auth           | Description                                              |
| ------ | ---------------------------------- | -------------- | -------------------------------------------------------- |
| GET    | `/chat/conversations`              | Required       | Get conversations (includes unread count, profile data)  |
| POST   | `/chat/conversations`              | VERIFIED/ADMIN | Start conversation (`{ userId }`)                        |
| GET    | `/chat/conversations/:id/messages` | Required       | Get messages (paginated, `?limit=50&before=msgId`)       |
| POST   | `/chat/conversations/:id/read`     | Required       | Mark as read                                             |
| POST   | `/chat/follow/:userId`             | Required       | Follow user                                              |
| DELETE | `/chat/follow/:userId`             | Required       | Unfollow user                                            |
| GET    | `/chat/followers`                  | Required       | Get followers                                            |
| GET    | `/chat/following`                  | Required       | Get following                                            |
| GET    | `/chat/recommendations`            | Required       | Recommended users (`?limit=10`)                          |
| GET    | `/chat/blocked`                    | Required       | Blocked users                                            |
| POST   | `/chat/block/:userId`              | Required       | Block user (removes mutual follows)                      |
| DELETE | `/chat/block/:userId`              | Required       | Unblock user                                             |
| POST   | `/chat/report`                     | Required       | Report user/message (`{ targetType, targetId, reason }`) |

**WebSocket:** Connect to `/chat` namespace with `auth.token`. See Architecture doc Section 10 for event reference.

## 15. Hall (`/hall`)

Reviews, rankings, lists, swipe, verified ranking — 30+ endpoints. Includes:

- Profile reviews: 四维评分(学术/标化/活动/奖项) + 分项评语 + 标签 + 反应
- Target school rankings with AI analysis
- User-created lists with voting
- Verified user ranking
- Swipe prediction game (leaderboard)

### 15.0 锐评 (Review) Endpoints

| Method | Path                                 | Auth     | Description                                                                    |
| ------ | ------------------------------------ | -------- | ------------------------------------------------------------------------------ |
| POST   | `/hall/reviews`                      | Required | 创建或更新评审（四维评分 + 分项评语 + 标签 + 状态）                            |
| PATCH  | `/hall/reviews/:reviewId`            | Required | 更新已有评审                                                                   |
| DELETE | `/hall/reviews/:reviewId`            | Required | 删除评审                                                                       |
| GET    | `/hall/reviews/:profileUserId`       | Required | 获取某用户收到的评审（分页，支持 sortBy: createdAt/overallScore/helpfulCount） |
| GET    | `/hall/reviews/:profileUserId/stats` | Required | 获取评审统计（各维度平均分、reviewCount、topTags）                             |
| POST   | `/hall/reviews/:reviewId/react`      | Required | 对评审添加反应（helpful/insightful）                                           |
| DELETE | `/hall/reviews/:reviewId/react`      | Required | 移除反应（query param: ?type=helpful\|insightful）                             |
| GET    | `/hall/reviews/me`                   | Required | 获取我提交的评审列表                                                           |

#### POST `/hall/reviews`

**Request Body:**

```json
{
  "profileUserId": "user-uuid",
  "academicScore": 8,
  "testScore": 8,
  "activityScore": 6,
  "awardScore": 7,
  "academicComment": "GPA优秀，课程难度高",
  "testComment": "标化达标",
  "activityComment": "活动较多但深度不足",
  "awardComment": "竞赛成绩不错",
  "tags": ["理科强", "标化优秀"],
  "status": "PUBLISHED"
}
```

**Response (201):**

```json
{
  "id": "review-uuid",
  "reviewerId": "...",
  "profileUserId": "...",
  "academicScore": 8,
  "testScore": 8,
  "activityScore": 6,
  "awardScore": 7,
  "overallScore": 7.3,
  "academicComment": "...",
  "testComment": "...",
  "activityComment": "...",
  "awardComment": "...",
  "tags": ["理科强", "标化优秀"],
  "status": "PUBLISHED",
  "helpfulCount": 0,
  "createdAt": "..."
}
```

#### GET `/hall/reviews/:profileUserId`

**Query Params:** `page`, `limit`, `sortBy` (createdAt | overallScore | helpfulCount)

#### POST `/hall/reviews/:reviewId/react`

**Request Body:** `{ "type": "helpful" }` 或 `{ "type": "insightful" }`

**积分:** 评审作者收到 helpful 反应时获得 +10 积分。

### 15.1 排名对比 Endpoints

| Method | Path                     | Description                |
| ------ | ------------------------ | -------------------------- |
| POST   | `/hall/ranking`          | 查询指定学校的排名对比     |
| GET    | `/hall/target-ranking`   | 自动获取用户目标学校的排名 |
| POST   | `/hall/ranking-analysis` | AI 竞争力分析              |

#### POST `/hall/ranking`

**Request Body:**

```json
{ "schoolIds": ["school-uuid-1", "school-uuid-2"] }
```

**Response (200):**

```json
{
  "rankings": [
    {
      "schoolId": "...",
      "schoolName": "MIT",
      "totalApplicants": 12,
      "yourRank": 3,
      "yourScore": 72.5,
      "percentile": 75,
      "breakdown": { "academic": 80, "activity": 65, "award": 60, "overall": 72.5 },
      "percentiles": { "academic": 83, "activity": 58, "award": 66 },
      "scoreDistribution": {
        "overall": { "p25": 55.2, "p50": 63.8, "p75": 74.1 },
        "academic": { "p25": 50, "p50": 65, "p75": 80 },
        "activity": { "p25": 40, "p50": 55, "p75": 70 },
        "award": { "p25": 20, "p50": 45, "p75": 65 }
      },
      "competitorStats": { "avgScore": 64.2, "medianScore": 63.8, "totalCount": 12 },
      "competitivePosition": "strong"
    }
  ]
}
```

#### GET `/hall/target-ranking`

自动获取用户 SchoolListItem 中所有目标学校的排名。返回格式同上。

#### POST `/hall/ranking-analysis`

**Request Body:** `{ "schoolId": "school-uuid" }`

**Response (200):**

```json
{
  "analysis": "综合分析文本...",
  "strengths": ["学术背景扎实", "活动多样性高"],
  "improvements": ["奖项维度可加强"],
  "competitivePosition": "strong"
}
```

## 16. Other Modules

| Module         | Path                   | Endpoints | Description                        |
| -------------- | ---------------------- | --------- | ---------------------------------- |
| Assessment     | `/assessment`          | 4         | MBTI/Holland personality tests     |
| Recommendation | `/recommendation`      | 3         | AI school recommendations (25 pts) |
| Timeline       | `/timeline`            | 18        | Application timeline management    |
| Swipe          | `/swipe`               | 5         | Case prediction game               |
| Notification   | `/notifications`       | 6         | Push notifications                 |
| Subscription   | `/subscriptions`       | 7         | Subscription plans and billing     |
| Vault          | `/vault`               | 10        | Encrypted credential storage       |
| Verification   | `/verification`        | 6         | User identity verification         |
| Peer Review    | `/peer-review`         | 5         | Peer-to-peer profile reviews       |
| Settings       | `/settings`            | 5         | System settings (ADMIN)            |
| Essay Prompts  | `/essay-prompts`       | 10        | Essay prompt database              |
| Essay Scraper  | `/admin/essay-scraper` | 3         | Essay prompt scraping (ADMIN)      |

## 17. Admin (`/admin`)

All admin endpoints require `ADMIN` role.

| Method | Path                      | Description                |
| ------ | ------------------------- | -------------------------- |
| GET    | `/admin/stats`            | Platform statistics        |
| GET    | `/admin/reports`          | Content reports            |
| PUT    | `/admin/reports/:id`      | Update report status       |
| DELETE | `/admin/reports/:id`      | Delete report              |
| GET    | `/admin/users`            | User management            |
| PUT    | `/admin/users/:id/role`   | Update user role           |
| DELETE | `/admin/users/:id`        | Delete user                |
| GET    | `/admin/audit-logs`       | Audit logs                 |
| CRUD   | `/admin/school-deadlines` | School deadline management |
| CRUD   | `/admin/global-events`    | Global event management    |

---

## Swagger / OpenAPI

The project uses `@nestjs/swagger` with 80+ decorated controllers and DTOs. Swagger UI is currently disabled in `main.ts` due to circular dependency issues but can be re-enabled:

```typescript
// apps/api/src/main.ts (lines 75-86, currently commented out)
const config = new DocumentBuilder()
  .setTitle('Study Abroad Platform API')
  .setDescription('API documentation')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

---

_Last updated: 2026-02-09_

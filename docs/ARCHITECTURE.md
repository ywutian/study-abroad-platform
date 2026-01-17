# Study Abroad Platform — Architecture Document

> Last updated: 2026-02-09
> Status: Living document — update on every architectural change

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Backend Architecture](#3-backend-architecture)
4. [Data Models](#4-data-models)
5. [API Reference](#5-api-reference)
6. [Scoring & Ranking System](#6-scoring--ranking-system)
7. [Frontend Architecture](#7-frontend-architecture)
8. [AI Agent System](#8-ai-agent-system)
9. [Authentication & Security](#9-authentication--security)
10. [Real-time Communication](#10-real-time-communication)
11. [Data Pipeline & Scheduled Tasks](#11-data-pipeline--scheduled-tasks)
12. [Deployment & Infrastructure](#12-deployment--infrastructure)
13. [Shared Types & Constants](#13-shared-types--constants)
14. [Known Issues & Architecture Decisions](#14-known-issues--architecture-decisions)
15. [Development Guidelines](#15-development-guidelines)

---

## 1. System Overview

### Tech Stack

| Layer             | Technology                     | Version |
| ----------------- | ------------------------------ | ------- |
| Frontend (Web)    | Next.js (App Router)           | 16.x    |
| Frontend (Mobile) | Expo / React Native            | —       |
| Backend API       | NestJS                         | 10.x    |
| ORM               | Prisma                         | 6.x     |
| Database          | PostgreSQL + pgvector          | 16      |
| Cache             | Redis                          | 7       |
| AI                | OpenAI API (gpt-4o-mini)       | —       |
| Embeddings        | text-embedding-3-small (1536d) | —       |
| State Management  | Zustand + React Query          | —       |
| UI Framework      | Tailwind CSS + shadcn/ui       | —       |
| Animation         | Framer Motion                  | —       |
| i18n              | next-intl (zh, en)             | —       |
| Package Manager   | pnpm (workspace)               | 9.x     |
| Deployment        | Railway (API) + Vercel (Web)   | —       |

### High-Level Architecture

```
                        ┌─────────────────┐
                        │    Vercel CDN    │
                        │   (Next.js Web)  │
                        └────────┬────────┘
                                 │ HTTPS
                                 ▼
┌────────────────────────────────────────────────────────────┐
│                     Railway / Docker                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               NestJS API (port 3001)                  │  │
│  │  ┌────────┬─────────┬──────────┬───────────────────┐ │  │
│  │  │  Auth  │ Profile │  School  │  AI Agent (ReWOO)  │ │  │
│  │  │  Hall  │  Forum  │  Chat    │  Prediction        │ │  │
│  │  │  Case  │Timeline │  Vault   │  + 20 more modules │ │  │
│  │  └────────┴─────────┴──────────┴───────────────────┘ │  │
│  └──────────────┬──────────────────┬────────────────────┘  │
│                 │                  │                        │
│  ┌──────────────▼──────┐  ┌───────▼──────────┐            │
│  │   PostgreSQL 16     │  │    Redis 7       │            │
│  │   + pgvector        │  │    (cache/rate)   │            │
│  └─────────────────────┘  └──────────────────┘            │
└────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   OpenAI API     │
                        │  gpt-4o-mini     │
                        └─────────────────┘
```

---

## 2. Monorepo Structure

```
study-abroad-platform/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── prisma/             # Schema, migrations, seeds
│   │   ├── scripts/            # Data scraping & sync scripts
│   │   └── src/
│   │       ├── common/         # Shared infrastructure
│   │       ├── modules/        # Feature modules (29+)
│   │       ├── prisma/         # PrismaService
│   │       └── main.ts         # Bootstrap
│   ├── web/                    # Next.js frontend
│   │   └── src/
│   │       ├── app/            # App Router pages
│   │       ├── components/     # UI & feature components
│   │       ├── hooks/          # Custom hooks
│   │       ├── lib/            # Utilities, API client, i18n
│   │       ├── stores/         # Zustand stores
│   │       └── messages/       # i18n translations (zh, en)
│   └── mobile/                 # Expo React Native (WIP)
├── packages/
│   ├── shared/                 # @study-abroad/shared
│   │   └── src/
│   │       ├── types/          # TypeScript interfaces & enums
│   │       ├── constants/      # App constants
│   │       └── design/         # Design tokens (colors, spacing)
│   └── browser-extension/      # CommonApp auto-fill extension
├── docs/                       # Documentation
├── nginx/                      # Nginx configs (dev + prod)
├── scripts/                    # Deployment scripts
├── pnpm-workspace.yaml         # Workspace definition
└── railway.json                # Railway deployment config
```

### Workspace Config (`pnpm-workspace.yaml`)

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### npm Registry

`.npmrc` uses Chinese mirror: `registry=https://registry.npmmirror.com`

---

## 3. Backend Architecture

### 3.1 Module Organization

The API has **29 feature modules** and **8 common infrastructure modules**.

#### Global Infrastructure (available to all modules)

| Module                | Scope          | Purpose                                      |
| --------------------- | -------------- | -------------------------------------------- |
| `PrismaModule`        | Global         | Database access via Prisma ORM               |
| `RedisModule`         | Global         | Cache, rate limiting, notifications          |
| `ConfigModule`        | Global         | Environment variables (`.env.local`, `.env`) |
| `ThrottlerModule`     | Global         | Rate limiting (default: 100 req/60s)         |
| `AuthorizationModule` | Global         | Ownership/role verification                  |
| `LoggerModule`        | Request-scoped | Structured logging with correlation IDs      |
| `EmailModule`         | —              | Email delivery via SMTP/nodemailer           |
| `StorageModule`       | —              | File storage (local/S3/OSS/COS)              |
| `SentryModule`        | —              | Error tracking (5xx only)                    |
| `AgentSecurityModule` | Global         | AI agent security                            |

#### Feature Modules

| Category         | Modules                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Auth & Users** | `AuthModule`, `UserModule`                                                                                                         |
| **Profile**      | `ProfileModule`                                                                                                                    |
| **Schools**      | `SchoolModule`, `SchoolListModule`, `RankingModule`                                                                                |
| **AI**           | `AiModule` (legacy), `AiAgentModule` (enterprise), `EssayAiModule`, `PredictionModule`, `RecommendationModule`, `AssessmentModule` |
| **Admissions**   | `CaseModule`, `VerificationModule`                                                                                                 |
| **Social**       | `ForumModule`, `ChatModule`, `HallModule`, `SwipeModule`, `PeerReviewModule`                                                       |
| **Timeline**     | `TimelineModule`                                                                                                                   |
| **Content**      | `EssayPromptModule`, `EssayScraperModule`                                                                                          |
| **Tools**        | `VaultModule`, `NotificationModule`, `SettingsModule`, `SubscriptionModule`                                                        |
| **Admin**        | `AdminModule`                                                                                                                      |
| **Health**       | `HealthModule`                                                                                                                     |

#### Module Dependency Graph

Key dependency patterns:

- `AiAgentModule` is the most depended-upon module (8+ modules use `forwardRef` to it)
- `PrismaModule` and `RedisModule` are global, used by 20+ modules
- Circular dependencies handled with `forwardRef()`:
  - `AiAgentModule` <-> Profile, Prediction, Assessment, Case, Forum, EssayAi, Recommendation, Hall, Swipe
  - `AiModule` <-> Prediction, Assessment
  - `NotificationModule` <-> ChatModule
  - `SchoolModule` <-> ProfileModule

### 3.2 Global Middleware, Guards & Interceptors

**Execution order for every request:**

```
Request
  → CorrelationIdMiddleware (adds x-correlation-id)
    → ThrottlerGuard (rate limiting)
      → JwtAuthGuard (authentication, skips @Public())
        → RolesGuard (authorization, checks @Roles())
          → Controller Handler
            → TransformInterceptor (wraps response: { success, data })
            → LoggingInterceptor (logs request/response, masks sensitive fields)
            → SentryInterceptor (reports 5xx to Sentry)
              → AllExceptionsFilter (standardizes error format)
```

**Sensitive field masking** (in logging): `password`, `passwordHash`, `token`, `refreshToken`, `accessToken`, `secret`, `apiKey`, `authorization`, `creditCard`, `ssn`, `cvv`

### 3.3 Global Validation

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Strip unknown properties
    forbidNonWhitelisted: true, // Reject unknown properties
    transform: true, // Auto-transform types
    enableImplicitConversion: true,
  })
);
```

---

## 4. Data Models

### 4.1 Enums (25 total)

| Enum                    | Values                                                                                                                                                           | Used By                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `Role`                  | USER, VERIFIED, ADMIN                                                                                                                                            | User                        |
| `Visibility`            | PRIVATE, ANONYMOUS, VERIFIED_ONLY                                                                                                                                | Profile, AdmissionCase      |
| `BudgetTier`            | LOW, MEDIUM, HIGH, UNLIMITED                                                                                                                                     | Profile                     |
| `TestType`              | SAT, ACT, TOEFL, IELTS, AP, IB                                                                                                                                   | TestScore                   |
| `ActivityCategory`      | ACADEMIC, ARTS, ATHLETICS, COMMUNITY_SERVICE, LEADERSHIP, WORK, RESEARCH, OTHER                                                                                  | Activity                    |
| `AwardLevel`            | SCHOOL, REGIONAL, STATE, NATIONAL, INTERNATIONAL                                                                                                                 | Award                       |
| `CompetitionCategory`   | MATH, BIOLOGY, PHYSICS, CHEMISTRY, COMPUTER_SCIENCE, ENGINEERING_RESEARCH, ECONOMICS_BUSINESS, DEBATE_SPEECH, WRITING_ESSAY, GENERAL_ACADEMIC, ARTS_MUSIC, OTHER | Competition                 |
| `AdmissionResult`       | ADMITTED, REJECTED, WAITLISTED, DEFERRED                                                                                                                         | AdmissionCase               |
| `SchoolTier`            | SAFETY, TARGET, REACH                                                                                                                                            | SchoolListItem              |
| `MemoryType`            | FACT, PREFERENCE, DECISION, SUMMARY, FEEDBACK                                                                                                                    | Memory                      |
| `EntityType`            | SCHOOL, PERSON, EVENT, TOPIC                                                                                                                                     | Entity                      |
| `ReportTargetType`      | USER, MESSAGE, CASE, REVIEW, POST, COMMENT                                                                                                                       | Report                      |
| `ReportStatus`          | PENDING, REVIEWED, RESOLVED                                                                                                                                      | Report                      |
| `TaskType`              | ESSAY, DOCUMENT, TEST, INTERVIEW, RECOMMENDATION, OTHER                                                                                                          | ApplicationTask             |
| `ApplicationStatus`     | NOT_STARTED, IN_PROGRESS, SUBMITTED, ACCEPTED, REJECTED, WAITLISTED, WITHDRAWN                                                                                   | ApplicationTimeline         |
| `GlobalEventCategory`   | TEST, COMPETITION, SUMMER_PROGRAM, FINANCIAL_AID, APPLICATION, OTHER                                                                                             | GlobalEvent                 |
| `PersonalEventCategory` | COMPETITION, TEST, SUMMER_PROGRAM, INTERNSHIP, ACTIVITY, MATERIAL, OTHER                                                                                         | PersonalEvent               |
| `PersonalEventStatus`   | NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED                                                                                                                   | PersonalEvent               |
| `VaultItemType`         | PASSWORD, CREDENTIAL, DOCUMENT, NOTE, API_KEY, OTHER                                                                                                             | VaultItem                   |
| `EssayType`             | COMMON_APP, UC, SUPPLEMENTAL, WHY_SCHOOL, OTHER                                                                                                                  | EssayExample, AdmissionCase |
| `TeamStatus`            | RECRUITING, FULL, CLOSED                                                                                                                                         | ForumPost                   |
| `TeamAppStatus`         | PENDING, ACCEPTED, REJECTED, CANCELLED                                                                                                                           | TeamApplication             |
| `ForumPostTag`          | COMPETITION, ACTIVITY, QUESTION, SHARING, OTHER                                                                                                                  | ForumPost                   |
| `PeerReviewStatus`      | PENDING, COMPLETED, EXPIRED                                                                                                                                      | PeerReview                  |
| `ReviewStatus`          | DRAFT, PUBLISHED, HIDDEN                                                                                                                                         | Review                      |

### 4.2 Models by Domain (56 total)

#### User & Auth (2 models)

**User** — Core user account

| Field                | Type          | Notes                      |
| -------------------- | ------------- | -------------------------- |
| id                   | String (cuid) | Primary key                |
| email                | String        | Unique                     |
| passwordHash         | String        | bcrypt (10 rounds)         |
| role                 | Role          | Default: USER              |
| emailVerified        | Boolean       | Default: false             |
| emailVerifyToken     | String?       |                            |
| passwordResetToken   | String?       |                            |
| passwordResetExpires | DateTime?     |                            |
| locale               | String        | Default: "zh"              |
| points               | Int           | Default: 0 (gamification)  |
| avgRating            | Float?        | Cached peer review average |
| reviewCount          | Int           | Default: 0                 |
| deletedAt            | DateTime?     | Soft delete                |

Relations: Profile (1:1), Follow[], Block[], Message[], ConversationParticipant[], CustomRanking[], Review[] (given/received), ReviewReaction[], Report[], AdmissionCase[], UserList[], UserListVote[], SchoolListItem[], ForumPost[], ForumComment[], TeamMember[], SwipeStats (1:1), PointHistory[], PeerReview[] (given/received), ApplicationTimeline[], PersonalEvent[]

**RefreshToken** — JWT refresh tokens

| Field     | Type          | Notes                  |
| --------- | ------------- | ---------------------- |
| id        | String (cuid) |                        |
| token     | String        | Unique, 128 hex chars  |
| userId    | String        | No FK (manual cleanup) |
| expiresAt | DateTime      |                        |

#### Profile & Related (6 models)

**Profile** — User academic profile

| Field               | Type           | Notes                                             |
| ------------------- | -------------- | ------------------------------------------------- |
| id                  | String (cuid)  |                                                   |
| userId              | String         | Unique, FK -> User                                |
| nickname            | String?        | Public display name                               |
| avatarUrl           | String?        | Avatar URL                                        |
| bio                 | String? (Text) | User bio                                          |
| realName            | String?        | **Strong sensitive** — never public               |
| birthday            | DateTime?      | Onboarding                                        |
| graduationDate      | DateTime?      | Onboarding                                        |
| onboardingCompleted | Boolean        | Default: false                                    |
| gpa                 | Decimal(3,2)?  | e.g., 3.85                                        |
| gpaScale            | Decimal(3,2)   | Default: 4.0 (valid: 4.0, 5.0; **NOT 100**)       |
| currentSchool       | String?        |                                                   |
| currentSchoolType   | String?        | PUBLIC_US / PRIVATE_US / INTERNATIONAL            |
| grade               | String?        | FRESHMAN / SOPHOMORE / JUNIOR / SENIOR / GAP_YEAR |
| targetMajor         | String?        |                                                   |
| regionPref          | String[]       |                                                   |
| budgetTier          | BudgetTier?    |                                                   |
| applicationRound    | String?        | ED / EA / RD                                      |
| visibility          | Visibility     | Default: PRIVATE                                  |

Relations: TestScore[], Activity[], Award[], Education[], Essay[], PredictionResult[]

**TestScore** — Standardized test scores

| Field     | Type      | Notes                                              |
| --------- | --------- | -------------------------------------------------- |
| type      | TestType  | SAT/ACT/TOEFL/IELTS/AP/IB                          |
| score     | Int       | SAT: 400-1600, ACT: 1-36, TOEFL: 0-120, IELTS: 0-9 |
| subScores | Json?     | `{ reading: 800, math: 800 }`                      |
| testDate  | DateTime? |                                                    |

**Activity** — Extracurricular activities

| Field               | Type             | Notes                       |
| ------------------- | ---------------- | --------------------------- |
| name                | String           |                             |
| category            | ActivityCategory |                             |
| role                | String           | e.g., "President", "Member" |
| organization        | String?          |                             |
| description         | String?          | Text                        |
| startDate / endDate | DateTime?        |                             |
| hoursPerWeek        | Int?             | Max: 40                     |
| weeksPerYear        | Int?             | Max: 52                     |
| isOngoing           | Boolean          | Default: false              |
| order               | Int              | Default: 0 (drag-sort)      |

**Award** — Academic/extracurricular awards

| Field       | Type       | Notes                        |
| ----------- | ---------- | ---------------------------- |
| name        | String     |                              |
| level       | AwardLevel | SCHOOL through INTERNATIONAL |
| year        | Int?       |                              |
| description | String?    |                              |
| order       | Int        | Default: 0                   |

**Education** — Education history

| Field      | Type          | Notes                 |
| ---------- | ------------- | --------------------- |
| schoolName | String        |                       |
| schoolType | String?       | HIGH_SCHOOL / COLLEGE |
| degree     | String?       |                       |
| major      | String?       |                       |
| gpa        | Decimal(3,2)? |                       |
| gpaScale   | Decimal(3,2)? |                       |

**Essay** — Personal essays

| Field     | Type    | Notes                   |
| --------- | ------- | ----------------------- |
| title     | String  |                         |
| prompt    | String? | Text                    |
| content   | String  | Text                    |
| wordCount | Int?    | Auto-calculated on save |
| schoolId  | String? | Optional link to School |

#### School Data (4 models)

**School** — University/college data

| Field                       | Type          | Notes                                                    |
| --------------------------- | ------------- | -------------------------------------------------------- |
| name                        | String        | English name                                             |
| nameZh                      | String?       | Chinese name                                             |
| country                     | String        | Default: "US"                                            |
| state / city                | String?       |                                                          |
| usNewsRank / qsRank         | Int?          |                                                          |
| acceptanceRate              | Decimal(5,2)? | 0.00-100.00                                              |
| tuition                     | Int?          | Annual USD                                               |
| avgSalary                   | Int?          | Post-graduation                                          |
| totalEnrollment             | Int?          |                                                          |
| satAvg                      | Int?          | SAT total average (College Scorecard)                    |
| sat25                       | Int?          | SAT 25th percentile (combined)                           |
| sat75                       | Int?          | SAT 75th percentile (combined)                           |
| satMath25                   | Int?          | SAT Math 25th percentile                                 |
| satMath75                   | Int?          | SAT Math 75th percentile                                 |
| satReading25                | Int?          | SAT ERW 25th percentile                                  |
| satReading75                | Int?          | SAT ERW 75th percentile                                  |
| actAvg                      | Int?          | ACT composite average/midpoint                           |
| act25                       | Int?          | ACT 25th percentile                                      |
| act75                       | Int?          | ACT 75th percentile                                      |
| studentCount                | Int?          | Total student enrollment (Scorecard alias)               |
| graduationRate              | Decimal(5,2)? | 4-year graduation rate %                                 |
| isPrivate                   | Boolean       | Default: false                                           |
| nicheSafetyGrade            | String?       | A+ through F                                             |
| nicheLifeGrade              | String?       |                                                          |
| nicheFoodGrade              | String?       |                                                          |
| nicheOverallGrade           | String?       |                                                          |
| website / logoUrl           | String?       |                                                          |
| description / descriptionZh | String?       | Text                                                     |
| metadata                    | Json?         | `{ deadlines, essayPrompts, requirements, lastScraped }` |

Relations: SchoolMetric[], AdmissionCase[], ProfileTargetSchool[], SchoolListItem[], EssayExample[], SchoolDeadline[], ApplicationTimeline[]

> **Note:** `totalEnrollment` and `studentCount` both exist. `studentCount` is the College Scorecard alias synced by `school-data.service.ts`. They represent the same concept.

**Competition** — Reference data for academic competitions

| Field                       | Type                | Notes                                                                                                                                                                  |
| --------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name                        | String              | Full English name                                                                                                                                                      |
| abbreviation                | String              | Unique short name (e.g., "AMC 10")                                                                                                                                     |
| nameZh                      | String?             | Chinese name                                                                                                                                                           |
| category                    | CompetitionCategory | Enum: MATH, BIOLOGY, PHYSICS, CHEMISTRY, COMPUTER_SCIENCE, ENGINEERING_RESEARCH, ECONOMICS_BUSINESS, DEBATE_SPEECH, WRITING_ESSAY, GENERAL_ACADEMIC, ARTS_MUSIC, OTHER |
| level                       | AwardLevel          | SCHOOL / REGIONAL / STATE / NATIONAL / INTERNATIONAL                                                                                                                   |
| tier                        | Int                 | 1-5 prestige (5 = highest, e.g. IMO Gold)                                                                                                                              |
| description / descriptionZh | String?             | Text                                                                                                                                                                   |
| website                     | String?             |                                                                                                                                                                        |
| isActive                    | Boolean             | Default: true                                                                                                                                                          |

Relations: Award[] (Award.competitionId -> Competition.id)

**Award** model now has an optional `competitionId` (String?) linking to `Competition` for tier-based scoring.

**SchoolMetric** — Year-specific school metrics

| Field             | Type                          | Notes                                                                                                                                                                                        |
| ----------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| schoolId          | String                        | FK                                                                                                                                                                                           |
| year              | Int                           |                                                                                                                                                                                              |
| metricKey         | String                        | Standard keys: `acceptance_rate`, `avg_sat`, `sat_25`, `sat_75`, `avg_act`, `act_25`, `act_75`, `avg_gpa`, `applications`, `admissions`, `intl_student_pct`, `intl_student_count`, `cs_rank` |
| value             | Decimal(10,2)                 |                                                                                                                                                                                              |
| Unique constraint | `[schoolId, year, metricKey]` |                                                                                                                                                                                              |

**ProfileTargetSchool** — **[DEPRECATED]** User target schools (profile-based)

| Field     | Type    | Notes                                  |
| --------- | ------- | -------------------------------------- |
| profileId | String  | **No FK to Profile!** No back-relation |
| schoolId  | String  | FK -> School                           |
| priority  | Int     | 1: Reach, 2: Match, 3: Safety          |
| round     | String? | ED, EA, RD                             |

> **WARNING**: This model is superseded by `SchoolListItem`. See [Known Issues](#14-known-issues--architecture-decisions).

**SchoolListItem** — **[PRIMARY]** User school selection list

| Field           | Type       | Notes                         |
| --------------- | ---------- | ----------------------------- |
| userId          | String     | FK -> User                    |
| schoolId        | String     | FK -> School (cascade delete) |
| tier            | SchoolTier | SAFETY / TARGET / REACH       |
| notes           | String?    | Text                          |
| round           | String?    | ED, EA, RD                    |
| isAIRecommended | Boolean    | Default: false                |

> This is the canonical model for "user's target schools". Used by Dashboard, FindCollege, UncommonApp on the frontend.

#### Rankings & Predictions (2 models)

**CustomRanking** — User-created school ranking weights

| Field        | Type                                                        |
| ------------ | ----------------------------------------------------------- |
| userId, name | String                                                      |
| weights      | Json (`{ usNewsRank, acceptanceRate, tuition, avgSalary }`) |
| isPublic     | Boolean                                                     |

**PredictionResult** — Multi-engine ensemble admission predictions (v2)

| Field             | Type                    | Notes                                              |
| ----------------- | ----------------------- | -------------------------------------------------- |
| profileId         | String (FK -> Profile)  |                                                    |
| schoolId          | String                  |                                                    |
| probability       | Decimal(5,4)            | 0.0000-1.0000, 融合概率                            |
| probabilityLow    | Decimal(5,4)?           | 置信区间下界                                       |
| probabilityHigh   | Decimal(5,4)?           | 置信区间上界                                       |
| factors           | Json                    | `[{ name, impact, detail }]`                       |
| modelVersion      | String                  | Default: "v2"                                      |
| tier              | String?                 | reach / match / safety                             |
| confidence        | String?                 | low / medium / high                                |
| engineScores      | Json?                   | `{ stats, ai, historical, weights, fusionMethod }` |
| suggestions       | Json?                   | 改进建议列表                                       |
| comparison        | Json?                   | 对比数据                                           |
| actualResult      | String?                 | ADMITTED / REJECTED / WAITLISTED (用户报告)        |
| reportedAt        | DateTime?               | 用户报告时间                                       |
| Unique constraint | `[profileId, schoolId]` | 每个 Profile+School 仅保留最新预测                 |

> 详细技术文档: [PREDICTION_SYSTEM.md](PREDICTION_SYSTEM.md) | ADR: [ADR-0008](adr/0008-prediction-multi-engine-ensemble.md)

#### Admission Cases (1 model)

**AdmissionCase** — Anonymized admission results

| Field                                       | Type            | Notes                               |
| ------------------------------------------- | --------------- | ----------------------------------- |
| userId / schoolId                           | String          | FKs                                 |
| year                                        | Int             | Application year                    |
| round                                       | String?         | ED, EA, RD                          |
| result                                      | AdmissionResult |                                     |
| major                                       | String?         |                                     |
| gpaRange / satRange / actRange / toeflRange | String?         | Anonymized ranges ("3.7-3.9")       |
| tags                                        | String[]        | e.g., ["strong_research", "legacy"] |
| essayType                                   | EssayType?      | For essay gallery                   |
| essayPrompt / essayContent                  | String?         | Text                                |
| promptNumber                                | Int?            | Common App: 1-7                     |
| visibility                                  | Visibility      |                                     |
| isVerified                                  | Boolean         | Admin-verified                      |
| verifiedAt                                  | DateTime?       |                                     |

#### Social Features (6 models)

- **Follow** — Follower/following relationships (`@@unique([followerId, followingId])`)
- **Block** — User blocking (`@@unique([blockerId, blockedId])`)
- **Review** — Profile peer reviews (四维评分: academicScore, testScore, activityScore, awardScore 各 1-10; 分项评语: academicComment, testComment, activityComment, awardComment; overallScore 加权计算; tags: String[]; status: ReviewStatus DRAFT/PUBLISHED/HIDDEN; helpfulCount: Int; `@@unique([reviewerId, profileUserId])`)
- **ReviewReaction** — 评审互动反应 (reviewId FK -> Review, userId FK -> User, type: "helpful"/"insightful"; `@@unique([reviewId, userId, type])`)
- **UserList** — User-created public lists with items (Json)
- **UserListVote** — Upvote/downvote on lists (value: 1 or -1)

#### Chat / Messaging (3 models + 1 service)

- **Conversation** — Chat conversation container
- **ConversationParticipant** — User in conversation with `lastReadAt`
- **Message** — Individual message (`content: Text`, `isDeleted: Boolean`)
- **MessageFilterService** — Content moderation (rate limit, repeat detection, sensitive words)

#### Reports & Audit (2 models)

- **Report** — Content reports with `targetType` (USER/MESSAGE/CASE/REVIEW/POST/COMMENT)
- **AuditLog** — Action audit trail (action, resource, resourceId, metadata, ipAddress)

#### AI Agent Memory System (10 models)

- **AgentConversation** — AI conversation sessions (userId, title, summary, agentType)
- **AgentMessage** — Messages with role, agentType, toolCalls, tokensUsed, latencyMs
- **Memory** — User memories with importance scoring and pgvector embedding (1536d)
- **Entity** — Extracted entities (SCHOOL, PERSON, EVENT, TOPIC) with attributes and relations
- **UserAIPreference** — AI interaction preferences (communication style, language, memory toggle)
- **AgentTokenUsage** — Token usage tracking (model, prompt/completion tokens, cost)
- **AgentQuota** — User quotas (tier: FREE/PRO/ENTERPRISE, daily/monthly limits)
- **AgentAuditLog** — AI-specific audit log (traceId, operation, duration)
- **AgentSecurityEvent** — Security events (eventType, severity, resolved)
- **AgentConfigVersion** — Versioned config storage (configType, configKey, version, isActive)
- **MemoryCompaction** — Memory compression records (sourceIds, compressionRatio)
- **AgentTask** — Async task queue (type, status, priority, payload, attempts)

#### Forum System (6 models)

- **ForumCategory** — Forum categories with `nameZh`, icon, color, sortOrder
- **ForumPost** — Posts with team support (isTeamPost, teamSize, currentSize, teamStatus)
- **ForumComment** — Threaded comments (parentId for nesting)
- **ForumLike** — Post likes
- **TeamMember** — Team membership (role: owner/member)
- **TeamApplication** — Join requests (status: PENDING/ACCEPTED/REJECTED/CANCELLED)

#### Essay Gallery (1 model)

- **EssayExample** — Published essays with type, school, year, ratings, verification

#### Swipe Game (3 models)

- **CaseSwipe** — Swipe predictions (prediction vs actualResult, isCorrect)
- **SwipeStats** — User stats (totalSwipes, correctCount, streak, badge)
- **PointHistory** — Points earned (action, points, metadata)

#### Peer Review (1 model)

- **PeerReview** — Bidirectional review (reviewer scores + reverse scores, 1-5 scale, @db.SmallInt)

#### School Deadlines (1 model)

- **SchoolDeadline** — Structured deadlines (year, round, applicationDeadline, essayPrompts: Json, interviewRequired)

#### Application Timeline (5 models)

- **ApplicationTimeline** — User's school application tracking (status, progress 0-100)
- **ApplicationTask** — Tasks within timeline (type, dueDate, essayPrompt, wordLimit)
- **GlobalEvent** — System-wide events (SAT dates, competitions, summer programs)
- **PersonalEvent** — User-subscribed events with tasks
- **PersonalTask** — Tasks within personal events

---

## 5. API Reference

### 5.1 Route Prefix

All routes prefixed with `/api/v1/`. Health endpoints excluded.

### 5.2 Endpoints by Module

#### Auth (`/auth`)

| Method | Path                 | Auth   | Description            |
| ------ | -------------------- | ------ | ---------------------- |
| POST   | /register            | Public | Register               |
| POST   | /login               | Public | Login                  |
| POST   | /refresh             | Public | Refresh token (cookie) |
| POST   | /logout              | Yes    | Logout                 |
| GET    | /verify-email        | Public | Email verification     |
| POST   | /resend-verification | Public | Resend verification    |
| POST   | /forgot-password     | Public | Password reset request |
| POST   | /reset-password      | Public | Reset password         |
| POST   | /change-password     | Yes    | Change password        |

#### Profile (`/profiles`)

| Method              | Path                         | Auth | Description                                    |
| ------------------- | ---------------------------- | ---- | ---------------------------------------------- |
| GET                 | /me                          | Yes  | Get my profile                                 |
| PUT                 | /me                          | Yes  | Update profile                                 |
| GET                 | /:id                         | Yes  | Get profile by ID                              |
| POST                | /onboarding                  | Yes  | Complete onboarding                            |
| GET                 | /me/grade                    | Yes  | Get profile grade                              |
| GET                 | /me/ai-analysis              | Yes  | AI profile analysis                            |
| GET/POST/PUT/DELETE | /me/test-scores[/:id]        | Yes  | Test score CRUD                                |
| GET/POST/PUT/DELETE | /me/activities[/:id]         | Yes  | Activity CRUD                                  |
| PUT                 | /me/activities/reorder       | Yes  | Reorder activities                             |
| GET/POST/PUT/DELETE | /me/awards[/:id]             | Yes  | Award CRUD                                     |
| PUT                 | /me/awards/reorder           | Yes  | Reorder awards                                 |
| GET/POST/PUT/DELETE | /me/essays[/:id]             | Yes  | Essay CRUD                                     |
| GET/POST/PUT/DELETE | /me/education[/:id]          | Yes  | Education CRUD                                 |
| GET                 | /me/target-schools           | Yes  | Get target schools (proxies to SchoolListItem) |
| PUT                 | /me/target-schools           | Yes  | Set target schools                             |
| POST                | /me/target-schools/:schoolId | Yes  | Add target school                              |
| DELETE              | /me/target-schools/:schoolId | Yes  | Remove target school                           |

#### Schools (`/schools`)

| Method | Path          | Auth   | Description               |
| ------ | ------------- | ------ | ------------------------- |
| GET    | /             | Public | List/search schools       |
| GET    | /:id          | Public | School details            |
| GET    | /ai/recommend | Yes    | AI school recommendations |
| POST   | /             | Admin  | Create school             |
| PUT    | /:id          | Admin  | Update school             |

#### School Lists (`/school-lists`)

| Method | Path          | Auth | Description        |
| ------ | ------------- | ---- | ------------------ |
| GET    | /             | Yes  | Get my school list |
| POST   | /             | Yes  | Add school to list |
| PUT    | /:id          | Yes  | Update list item   |
| DELETE | /:id          | Yes  | Remove from list   |
| GET    | /ai-recommend | Yes  | AI recommendations |

#### Hall (`/hall`)

| Method              | Path                          | Auth   | Description                                                       |
| ------------------- | ----------------------------- | ------ | ----------------------------------------------------------------- |
| GET                 | /public-profiles              | Yes    | Browse public profiles                                            |
| POST                | /ranking                      | Yes    | Get ranking for schools                                           |
| GET                 | /ranking/:schoolId            | Yes    | Get ranking for one school                                        |
| POST                | /reviews                      | Yes    | 创建/更新评审（四维评分 + 评语 + 标签 + 状态）                    |
| PATCH               | /reviews/:reviewId            | Yes    | 更新已有评审                                                      |
| DELETE              | /reviews/:reviewId            | Yes    | 删除评审                                                          |
| GET                 | /reviews/:profileUserId       | Yes    | 获取评审列表（分页，sortBy: createdAt/overallScore/helpfulCount） |
| GET                 | /reviews/:profileUserId/stats | Yes    | 评审统计（平均分 + topTags + reviewCount）                        |
| POST                | /reviews/:reviewId/react      | Yes    | 添加反应 (helpful/insightful)                                     |
| DELETE              | /reviews/:reviewId/react      | Yes    | 移除反应 (?type=helpful\|insightful)                              |
| GET                 | /reviews/me                   | Yes    | 我提交的评审                                                      |
| GET/POST/PUT/DELETE | /lists[/:id]                  | Mixed  | User lists CRUD                                                   |
| POST                | /lists/:id/vote               | Yes    | Vote on list                                                      |
| GET                 | /verified-ranking             | Public | Verified admission ranking                                        |
| GET                 | /verified-ranking/years       | Public | Available filter years                                            |
| GET                 | /swipe/batch                  | Yes    | Batch swipe cases (pre-load)                                      |
| POST                | /swipe/predict                | Yes    | Submit prediction                                                 |
| GET                 | /swipe/stats                  | Yes    | My swipe stats (upsert)                                           |
| GET                 | /swipe/leaderboard            | Yes    | Leaderboard (privacy-masked)                                      |

#### Predictions (`/predictions`) — v2 Multi-Engine Ensemble

| Method | Path              | Auth   | Description                                  |
| ------ | ----------------- | ------ | -------------------------------------------- |
| POST   | /                 | Yes    | Run multi-engine ensemble prediction         |
| GET    | /history          | Yes    | Prediction history                           |
| PATCH  | /:schoolId/result | Yes    | Report actual admission result (calibration) |
| GET    | /calibration      | Public | Aggregated calibration statistics            |

#### Rankings (`/rankings`)

| Method | Path       | Auth   | Description              |
| ------ | ---------- | ------ | ------------------------ |
| POST   | /calculate | Public | Calculate custom ranking |
| POST   | /          | Yes    | Save ranking             |
| GET    | /me        | Yes    | My saved rankings        |
| GET    | /public    | Public | Public rankings          |

#### AI Agent (`/ai-agent`)

| Method | Path          | Auth | Description               |
| ------ | ------------- | ---- | ------------------------- |
| POST   | /chat         | Yes  | Chat with AI (SSE stream) |
| POST   | /agent        | Yes  | Direct agent call         |
| GET    | /history      | Yes  | Conversation history      |
| DELETE | /conversation | Yes  | Clear conversation        |
| GET    | /usage        | Yes  | Token usage stats         |
| GET    | /quota        | Yes  | Quota info                |
| GET    | /rate-limit   | Yes  | Rate limit info           |

#### Chat (`/chat`)

| Method | Path                        | Auth | Description         |
| ------ | --------------------------- | ---- | ------------------- |
| GET    | /conversations              | Yes  | List conversations  |
| POST   | /conversations              | Yes  | Create conversation |
| GET    | /conversations/:id/messages | Yes  | Get messages        |
| POST   | /follow/:userId             | Yes  | Follow user         |
| DELETE | /follow/:userId             | Yes  | Unfollow            |
| POST   | /block/:userId              | Yes  | Block user          |
| POST   | /report                     | Yes  | Report content      |

#### Forum (`/forum`)

| Method | Path             | Auth     | Description   |
| ------ | ---------------- | -------- | ------------- |
| GET    | /posts           | Public   | List posts    |
| POST   | /posts           | Verified | Create post   |
| POST   | /posts/:id/like  | Yes      | Like post     |
| POST   | /posts/:id/apply | Yes      | Apply to team |
| GET    | /my-teams        | Yes      | My teams      |

#### Other Modules

- **Cases** (`/cases`) — CRUD for admission cases
- **Timeline** (`/timeline`) — Application timeline management
- **Essay AI** (`/essay-ai`) — Essay polish, review, brainstorm
- **Recommendation** (`/recommendation`) — AI school recommendations
- **Assessment** (`/assessment`) — MBTI/Holland assessments
- **Vault** (`/vault`) — Encrypted credential storage
- **Notifications** (`/notifications`) — Notification management
- **Settings** (`/settings`) — User settings
- **Subscriptions** (`/subscriptions`) — Plan management
- **Verification** (`/verification`) — User verification
- **Peer Review** (`/peer-review`) — Peer review system
- **Admin** (`/admin`) — Admin dashboard, reports, user management

---

## 6. Scoring & Ranking System

### 6.1 Unified Scoring — Single Source of Truth

> **Source:** `apps/api/src/common/utils/scoring.ts`
>
> All modules (Prediction, Hall, SchoolList, Profile) MUST use this unified scoring utility. Previous fragmented implementations have been consolidated here.

**Interfaces:**

| Interface        | Key Fields                                                                                                            | Source                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `ProfileMetrics` | gpa, gpaScale, satScore, actScore, toeflScore, activityCount, awardCount, nationalAwardCount, internationalAwardCount | Profile + TestScores + Activities + Awards |
| `SchoolMetrics`  | acceptanceRate, satAvg, sat25, sat75, actAvg, act25, act75, usNewsRank                                                | School model (direct columns)              |

**Data flow:** Prisma School → `extractSchoolMetrics()` → `SchoolMetrics` → scoring functions

> **Important:** `extractSchoolMetrics` reads `satAvg`, `sat25`, `sat75`, `actAvg`, `act25`, `act75` directly from School model columns — NOT from `metadata` JSON. These fields are populated by the College Scorecard sync service and seed scripts.

### 6.2 Canonical Scoring Formula

**Academic Score (0-100):**

- GPA: Normalized to 4.0 scale, mapped to 0-40 points (3.0 GPA = baseline)
- SAT: Compared to school average (or default 1400), +/-15 points per 50-point difference
- ACT: Converted to SAT equivalent if no SAT

**Activity Score (0-100):**

- Base: 30 points
- +5 per activity, max 50 additional points

**Award Score (0-100):**

- Base: 20 points
- International: +20/award (max 40)
- National: +15/award (max 30)
- Other: +5/award (max 20)

**Overall:** `academic * 0.5 + activity * 0.3 + award * 0.2`

**Probability:** `baseRate * 1.2^((score-50)/10)`, clamped to 0.05-0.95

**Tier Classification:**

- Top schools (acceptance < 15%): probability >= 0.25 → match, else reach
- Selective (15-30%): >= 0.5 → safety, >= 0.25 → match, else reach
- Others (30%+): >= 0.6 → safety, >= 0.35 → match, else reach

### 6.3 Planned Enhancement: Percentile-Based Academic Scoring

Use SAT/ACT 25th/75th percentile data to calculate where a student falls in the school's admitted student distribution:

```
mu = (sat25 + sat75) / 2
sigma = (sat75 - sat25) / (2 * 0.6745)  // IQR to std dev
percentile = Phi((studentScore - mu) / sigma)  // Normal CDF
```

Fallback chain: school percentile data → school average → platform user data → default 1400

### 6.4 Planned Enhancement: Competition-Tier Award Scoring

Replace count-based award scoring with tier-weighted scoring using the `Competition` reference database:

| Tier        | Examples                            | Points |
| ----------- | ----------------------------------- | ------ |
| 5 (Highest) | IMO, ISEF, Regeneron STS            | 25     |
| 4           | USAMO, USABO, NSDA Nationals        | 15     |
| 3           | AIME, PhysicsBowl, Science Olympiad | 8      |
| 2           | AMC 12, FBLA, USACO Silver          | 4      |
| 1           | AMC 8, NHS, Knowledge Bowl          | 2      |

Multiple competition bonus capping to be implemented.

### 6.5 Hall Ranking Flow

1. User persists target schools via `SchoolListItem`
2. `POST /hall/ranking` filters by same-school applicants
3. Backend calculates unified `calculateScoreBreakdown()` for each
4. Sorts by overall score, returns rank and percentile

### 6.6 Hall Swipe Game Architecture

The swipe game is a Tinder-style prediction game where users predict admission outcomes.

**Backend (`SwipeService`):**

- `getNextCases(userId, count)` — Uses Prisma relation filter `swipes: { none: { userId } }` (NOT EXISTS subquery) for O(1) filtering. Returns `SwipeBatchResultDto` with `cases[]` and `meta { totalAvailable, totalSwiped, hasMore }`.
- `submitSwipe()` — Uses `$transaction` with `try-catch P2002` for race condition safety. Calculates badge thresholds and awards points (capped at 100/day).
- `getStats()` — Uses `upsert` for atomic creation. Timezone-agnostic daily challenge via `getUtcDateString()`.
- `getLeaderboard()` — Privacy-masks userIds and userNames. Returns current user rank separately if outside top N.

**Frontend components:**

- `SwipeCard` — Corner stamp overlays (ADMIT/REJECT/WAITLIST/SKIP), velocity-based flick detection, gradient tint on drag, acceptance rate progress bar. Fully responsive (sm/md breakpoints).
- `SwipeStack` — Progress counter, keyboard shortcuts (arrow keys), responsive card stack height, tooltip action buttons, i18n labels. Distinguishes two empty states: pool empty vs. all swiped.
- `SwipeResultOverlay` — Reusable animated feedback overlay (correct/wrong, points, streak).
- `LeaderboardList` — Stagger animations, mini accuracy bars, top-3 medal icons, current user highlight.
- `StatsPanel` — AnimatedCounter, streak fire pulse animation for streaks >= 3, badge progress ring.
- `DailyChallenge` — Spring celebration animation on completion, countdown to midnight reset.

**Key decisions:**

- See ADR-0006 for Prisma P2002 exception handling strategy.
- Single API entry point via `HallController` (SwipeController deprecated).
- All text is i18n compliant via `next-intl` (`hall.swipeStack.*`, `hall.leaderboard.*`, `hall.result.*`, etc.).

---

## 7. Frontend Architecture

### 7.1 Routing (32 pages)

#### Main Pages (26)

`/[locale]/(main)/`: about, admin, ai, assessment, cases, cases/[id], chat, dashboard, essay-gallery, essays, find-college, followers, forum, hall, help, prediction, privacy, profile, ranking, recommendation, schools, schools/[id], settings, settings/security, settings/subscription, swipe, terms, timeline, uncommon-app, vault, verified-ranking

#### Auth Pages (6)

`/[locale]/(auth)/`: login, register, forgot-password, reset-password, verify-email, verify-email/callback

### 7.2 Component Library

**UI Components** (58): accordion, alert, avatar, badge, button, card, checkbox, command, dialog, dropdown-menu, form, input, label, progress, radio-group, select, separator, skeleton, slider, switch, table, tabs, textarea, tooltip, and more.

**Feature Components** (50+):

- `agent-chat/` — AI chat panel (floating-chat, chat-input, chat-message, use-agent-chat hook)
- `hall/` — Gamification (LeaderboardList, SwipeStack, SwipeCard, StatsPanel, BadgeDisplay, DailyChallenge, SwipeResultOverlay, SwipeReviewMode, ReviewTab — 多步向导四维评审)
- `schools/` — School browsing (AdvancedSchoolFilter, SchoolRecommendation)
- `essay-ai/` — Essay tools (brainstorm dialog, polish dialog, review panel, score radar)
- `resume/` — Resume export (basic/professional templates, PDF generation)
- `forum/` — Forum UI (PostCard, ReportDialog, SortTabs, TagFilter)
- `peer-review/` — Review system (RatingInput, ReviewCard, ReviewDialog)
- `points/` — Gamification (PointsOverview, PointsHistory, PointsRulesCard)
- `notifications/` — Notification center
- `onboarding/` — Tour provider, welcome dialog

### 7.3 State Management

```
┌──────────────────────────────────────────┐
│           State Architecture              │
├──────────────────────────────────────────┤
│ 1. Zustand Stores (Global)               │
│    - useAuthStore: user, accessToken,     │
│      isLoading, refresh, logout           │
│    - useNotificationsStore: client-side   │
│      notifications (localStorage)         │
│                                           │
│ 2. React Query (Server State)             │
│    - staleTime: 60s                       │
│    - retry: 1 (queries), 0 (mutations)   │
│    - Query key pattern: ['resource', ...] │
│                                           │
│ 3. Local State (Component)                │
│    - UI state (dialogs, tabs, search)     │
│    - Temporary selections                 │
│    - Form inputs                          │
└──────────────────────────────────────────┘
```

### 7.4 API Client

Location: `apps/web/src/lib/api/client.ts`

- Base URL: `NEXT_PUBLIC_API_URL` (default: `http://localhost:3006`)
- Version prefix: `/api/v1`
- Auth: Bearer token from Zustand store (memory only)
- Cookies: `credentials: 'include'` for httpOnly refresh token
- Auto-refresh: On 401, attempts token refresh then retries
- Concurrent refresh protection: Queues pending requests
- Timeout: 15s default

### 7.5 Key Frontend Patterns

**Query keys:** `['resource', ...filters]` (e.g., `['schools', search]`, `['timeline-detail', id]`)

**Mutation pattern:**

```typescript
const mutation = useMutation({
  mutationFn: (data) => apiClient.post('/endpoint', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['related'] });
    toast.success(t('success'));
  },
});
```

**Loading states:** `Loader2` spinner, Skeleton placeholders, `animate-pulse`

**Error handling:** Global `QueryCache.onError` shows toast for stale data errors; `MutationCache.onError` shows toast for all mutation errors.

---

## 8. AI Agent System

### 8.1 Architecture: ReWOO (Reason Without Observation)

Three-phase workflow:

```
PLAN → EXECUTE → SOLVE

1. PLAN: LLM analyzes intent, generates all tool calls at once
2. EXECUTE: Sequential tool execution (no LLM calls)
3. SOLVE: LLM synthesizes tool results into response
```

### 8.2 Agent Types

| Agent        | Purpose                       | Tools                                                                      |
| ------------ | ----------------------------- | -------------------------------------------------------------------------- |
| ORCHESTRATOR | Routes to specialized agents  | delegate_to_agent                                                          |
| ESSAY        | Essay writing, review, polish | get_essays, review_essay, polish_essay, brainstorm_ideas, generate_outline |
| SCHOOL       | School search, comparison     | search_schools, get_school_details, compare_schools, recommend_schools     |
| PROFILE      | Profile analysis, improvement | get_profile, update_profile, analyze_admission_chance                      |
| TIMELINE     | Deadline management           | get_deadlines, create_timeline, get_personal_events                        |

### 8.3 LLM Configuration

- Provider: OpenAI (configurable base URL)
- Default model: `gpt-4o-mini`
- Embedding model: `text-embedding-3-small` (1536 dimensions)
- Token counting: `js-tiktoken` (o200k_base for GPT-4o series)
- Cost tracking: Per-model pricing (gpt-4o-mini: $0.00015/1K input, $0.0006/1K output)

### 8.4 Memory System (Three-Tier)

| Tier              | Storage                    | TTL                    | Purpose                                 |
| ----------------- | -------------------------- | ---------------------- | --------------------------------------- |
| Working Memory    | Redis (in-memory fallback) | 24h                    | Current conversation, recent context    |
| Short-term Memory | Redis                      | 24h                    | Session data, message history (max 50)  |
| Long-term Memory  | PostgreSQL + pgvector      | Permanent (with decay) | Facts, preferences, decisions, entities |

**Memory lifecycle:** Extract from messages -> Score importance -> Store with embedding -> Decay over time -> Compact similar memories -> Archive/delete old ones

### 8.5 Resilience

- **Retry:** 3 attempts, exponential backoff (1s-8s)
- **Circuit breaker:** 5 failures -> OPEN (30s) -> HALF_OPEN (2 requests)
- **Timeout:** 30s per LLM/tool call
- **Rate limiting:** Redis ZSET sliding window (10 req/min user, 50 req/min agent)
- **Token quotas:** 100K daily, 2M monthly (FREE tier)
- **Fallback:** Agent-specific error responses with action suggestions

### 8.6 Stream Support

SSE events: `start`, `content`, `tool_start`, `tool_end`, `agent_switch`, `done`, `error`

---

## 9. Authentication & Security

### 9.1 JWT Flow

```
Register
  → Server creates user + email verification token
  → Verification email sent (async, non-blocking)
  → User redirected to /verify-email?email=xxx (check inbox UI)
  → Email link: /verify-email/callback?token=xxx
  → Callback page calls GET /auth/verify-email?token=xxx
  → On success: redirect to /login?verified=true (success toast)
  → On failure: show error state with retry option

Login
  → Server validates credentials, creates access token (15m) + refresh token (7d)
  → Access token returned in response body + set as httpOnly cookie (for middleware)
  → Refresh token set as httpOnly cookie (path: /api/v1/auth)
  → Frontend stores access token in memory (Zustand, NOT persisted)
  → If emailVerified=false, frontend shows non-blocking warning toast
  → Auto-refresh every 14 minutes via setInterval
  → On 401, API client auto-retries with refreshed token
```

### 9.2 Security Configuration

| Setting              | Value                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Password hashing     | bcrypt, 10 rounds                                                                            |
| Access token expiry  | 15m (configurable: `JWT_EXPIRES_IN`)                                                         |
| Refresh token expiry | 7d (configurable: `JWT_REFRESH_EXPIRES_IN`)                                                  |
| Refresh token type   | 128 hex chars (randomBytes(64))                                                              |
| Cookie: httpOnly     | true                                                                                         |
| Cookie: secure       | production only                                                                              |
| Cookie: sameSite     | strict (production), lax (development)                                                       |
| Cookie: path         | `/api/v1/auth`                                                                               |
| CORS origin          | Configurable via `CORS_ORIGINS` env var (comma-separated); defaults to `true` in development |
| XSS protection       | `isomorphic-dompurify` sanitizes all user-generated HTML before rendering                    |
| Helmet               | Enabled (CSP disabled in dev)                                                                |
| Vault encryption     | AES-256-GCM with user-specific keys (scrypt derived)                                         |

### 9.3 Rate Limiting

| Scope                 | Limit                                                 |
| --------------------- | ----------------------------------------------------- |
| Global default        | 100 req / 60s                                         |
| Auth endpoints        | 5 req / 60s (login, register); 10 req / 60s (refresh) |
| `@ThrottleSensitive`  | 5 req / 60s (login, register)                         |
| `@ThrottleStrict`     | 3 req / 60s (verification)                            |
| `@ThrottleRelaxed`    | 200 req / 60s (reads)                                 |
| `@ThrottleAI`         | 20 req / 60s                                          |
| AI Agent (user)       | 10 req / 60s (30 VIP)                                 |
| AI Agent (concurrent) | 2 concurrent (5 VIP)                                  |

### 9.4 Guard Chain

`ThrottlerGuard` -> `JwtAuthGuard` (skips `@Public()`) -> `RolesGuard` (checks `@Roles()`)

Role hierarchy: ADMIN > VERIFIED > USER

---

## 10. Real-time Communication

### 10.1 WebSocket Gateways

| Gateway        | Namespace       | Purpose                                         |
| -------------- | --------------- | ----------------------------------------------- |
| ChatGateway    | `/chat`         | Messaging, typing, online status, notifications |
| AiAgentGateway | `/ai-assistant` | AI streaming, tool updates, agent switching     |

### 10.2 Chat System

**Permission Model:**

| Action                         | USER | VERIFIED | ADMIN |
| ------------------------------ | ---- | -------- | ----- |
| Initiate conversation          | No   | Yes      | Yes   |
| Reply in existing conversation | Yes  | Yes      | Yes   |
| Follow / Unfollow              | Yes  | Yes      | Yes   |
| Block / Report                 | Yes  | Yes      | Yes   |

**Pre-conditions:** Mutual follow required + no block in either direction.

**Message Content Filtering** (`MessageFilterService`):

| Check            | Mechanism                   | Config             |
| ---------------- | --------------------------- | ------------------ |
| Rate limit       | Redis counter per user      | 30 msg/min         |
| Repeated content | MD5 hash + Redis counter    | 3 identical/5 min  |
| Sensitive words  | In-memory word list (CN+EN) | Replace with `***` |

### 10.3 Chat Events

| Direction        | Event              | Payload                                |
| ---------------- | ------------------ | -------------------------------------- |
| Client -> Server | `sendMessage`      | `{ conversationId, content }`          |
| Client -> Server | `joinConversation` | `{ conversationId }`                   |
| Client -> Server | `typing`           | `{ conversationId, isTyping }`         |
| Server -> Client | `connected`        | `{ userId }`                           |
| Server -> Client | `newMessage`       | `{ conversationId, message }`          |
| Server -> Client | `userTyping`       | `{ conversationId, userId, isTyping }` |
| Server -> Client | `userOnline`       | `userId`                               |
| Server -> Client | `userOffline`      | `userId`                               |
| Server -> Client | `notification`     | Notification object                    |

### 10.4 Notification System

- Storage: Redis lists (30-day TTL, max 100 per user)
- Delivery: WebSocket push via `ChatGateway.sendToUser()`
- Types: NEW_FOLLOWER, NEW_MESSAGE, CASE_HELPFUL, VERIFICATION_APPROVED, DEADLINE_REMINDER, etc.
- Template system with variable substitution (`{actor}`, `{points}`, `{school}`)
- NEW_MESSAGE notifications sent automatically when recipient is offline

---

## 11. Data Pipeline & Scheduled Tasks

### 11.1 Scheduled Tasks (9 cron jobs)

| Schedule           | Task                                        | Module   |
| ------------------ | ------------------------------------------- | -------- |
| Daily 3 AM         | Token cleanup (expired)                     | Auth     |
| Daily 3 AM         | Memory decay (importance scoring)           | AI Agent |
| Daily 4 AM         | Memory compaction (dedup + summarize)       | AI Agent |
| Weekly             | Orphaned token cleanup (soft-deleted users) | Auth     |
| Weekly Monday 9 AM | IPEDS data monitor                          | School   |
| Monthly 1st 3 AM   | College Scorecard sync (2000 schools)       | School   |
| Quarterly 1st 4 AM | IPEDS check + admission requirements update | School   |
| Annual Aug 1st     | Pre-season school data update               | School   |
| Annual Sep 15th    | Rankings update reminder                    | School   |

### 11.2 Data Sources

| Source                | Data                                                                                           | Sync Method                                 |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------- |
| College Scorecard API | Admissions, SAT/ACT (avg + 25th/75th percentile), tuition, graduation rate, salary, enrollment | Monthly auto-sync                           |
| IPEDS                 | Enrollment, demographics                                                                       | Manual CSV import                           |
| School websites       | Deadlines, essay prompts                                                                       | Puppeteer scraping                          |
| Seed scripts          | Top 100+ US universities (6 seed scripts), demo data                                           | Manual run                                  |
| Competition database  | 90+ academic competitions with tiers                                                           | Seed script (`prisma/seed-competitions.ts`) |

### 11.3 College Scorecard — Dual Write Strategy

The `SchoolDataService.syncSchoolsFromScorecard()` writes data in two places:

1. **Latest values → School model columns**: `satAvg`, `sat25`, `sat75`, `actAvg`, `act25`, `act75`, `studentCount`, `graduationRate`, etc.
2. **Yearly snapshots → SchoolMetric table**: Keys `avg_sat`, `sat_25`, `sat_75`, `avg_act`, `act_25`, `act_75`, `acceptance_rate` with the current year.

This allows both real-time scoring (from School columns) and historical trend analysis (from SchoolMetric rows).

**Full field mapping (16 fields):**

| API Field                                                       | DB Column               |
| --------------------------------------------------------------- | ----------------------- |
| `latest.admissions.admission_rate.overall`                      | `acceptanceRate` (×100) |
| `latest.admissions.sat_scores.average.overall`                  | `satAvg`                |
| `latest.admissions.sat_scores.25th_percentile.critical_reading` | `satReading25`          |
| `latest.admissions.sat_scores.75th_percentile.critical_reading` | `satReading75`          |
| `latest.admissions.sat_scores.25th_percentile.math`             | `satMath25`             |
| `latest.admissions.sat_scores.75th_percentile.math`             | `satMath75`             |
| `latest.admissions.act_scores.midpoint.cumulative`              | `actAvg`                |
| `latest.admissions.act_scores.25th_percentile.cumulative`       | `act25`                 |
| `latest.admissions.act_scores.75th_percentile.cumulative`       | `act75`                 |
| `latest.cost.tuition.out_of_state`                              | `tuition`               |
| `latest.student.size`                                           | `studentCount`          |
| `latest.completion.completion_rate_4yr_150nt`                   | `graduationRate` (×100) |
| `latest.earnings.10_yrs_after_entry.median`                     | `avgSalary`             |
| _(computed)_ satReading25 + satMath25                           | `sat25`                 |
| _(computed)_ satReading75 + satMath75                           | `sat75`                 |

### 11.3 Background Intervals

- Rate limiter cleanup: Every 60s (AI Agent)
- Memory cache cleanup: Every 3600s (AI Agent)

---

## 12. Deployment & Infrastructure

### 12.1 Environments

| Environment | Frontend       | Backend        | Database                   |
| ----------- | -------------- | -------------- | -------------------------- |
| Development | localhost:3000 | localhost:3001 | Docker PostgreSQL + Redis  |
| Production  | Vercel         | Railway        | Railway PostgreSQL + Redis |

### 12.2 Docker

**Standard Dockerfile** (`apps/api/Dockerfile`): Multi-stage pnpm build, port 8080

**Railway Dockerfile** (`apps/api/Dockerfile.railway`): npm-based build with auto-migration, port 3001, runs as non-root `nestjs` user (UID 1001)

> **NOTE**: `railway.json` points to the standard Dockerfile, not the Railway one.

### 12.3 CI/CD Pipeline

```
Push to main
  → CI: Lint → Dependency Audit → Typecheck → Test → E2E (PostgreSQL 16) → Build → Docker → Security Scan (blocks on CRITICAL/HIGH)
    → Deploy Staging: Migrate → Deploy Web (Vercel) → Notify Slack
      → Deploy Production: Migrate → Create Sentry Release
```

### 12.4 Required Environment Variables

**Critical:**

- `DATABASE_URL` — PostgreSQL connection
- `REDIS_URL` — Redis connection
- `JWT_SECRET` — Min 32 chars
- `JWT_REFRESH_SECRET` — Min 32 chars
- `OPENAI_API_KEY` — AI features

**Optional:**

- `SMTP_*` — Email delivery
- `SENTRY_DSN` — Error tracking
- `COLLEGE_SCORECARD_API_KEY` — School data sync
- `VAULT_ENCRYPTION_KEY` — 64 hex chars for vault encryption
- `CORS_ORIGINS` — Comma-separated allowed origins (e.g. `https://app.example.com,https://admin.example.com`)

---

## 13. Shared Types & Constants

### 13.1 Package: `@study-abroad/shared`

Location: `packages/shared/src/`

Exports: Types (interfaces, enums), Constants (ranges, categories, error codes), Design Tokens (colors, spacing, breakpoints)

### 13.2 Type Misalignments with Prisma Schema

> **These must be fixed.** The shared types package is out of sync with the database schema.

| Type               | Missing Fields (exist in Prisma)                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `Profile`          | `birthday`, `graduationDate`, `onboardingCompleted`, `currentSchoolType`, `applicationRound`                              |
| `School`           | `city`, `qsRank`, `totalEnrollment`, `isPrivate`, `niche*Grade` (4), `website`, `logoUrl`, `description*` (2), `metadata` |
| `Activity`         | `organization`, `isOngoing`, `order`                                                                                      |
| `Award`            | `order`                                                                                                                   |
| `AdmissionCase`    | `actRange`, `toeflRange`, `essayType`, `essayPrompt`, `essayContent`, `promptNumber`                                      |
| `Message`          | `isDeleted`                                                                                                               |
| `ReportTargetType` | Missing enum values: `POST`, `COMMENT`                                                                                    |

| Type           | Field Name Mismatch                                                                          |
| -------------- | -------------------------------------------------------------------------------------------- |
| `Review`       | Shared uses `profileId`; Prisma uses `profileUserId`                                         |
| `Conversation` | Shared uses `participantIds: string[]`; Prisma uses separate `ConversationParticipant` model |

### 13.3 DTO Validation Issues

| DTO                           | Issue                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `UpdateProfileDto.gpaScale`   | Allows 100, but Prisma `Decimal(3,2)` max is 9.99                                                                              |
| `CreateEducationDto.gpaScale` | Same issue                                                                                                                     |
| `CreateTestScoreDto.score`    | `@Max(2000)` for all test types; should be type-specific                                                                       |
| `CreateSchoolDto`             | ~~Has `satAvg`, `actAvg`, `studentCount`, `graduationRate` — not in Schema~~ **RESOLVED** (2026-02-06: fields added to schema) |
| `CreateSchoolDeadlineDto`     | Missing `source` field                                                                                                         |
| `CreatePostDto`               | Missing `postTag` field                                                                                                        |
| `CreateTimelineDto`           | Missing `status`, `schoolName` fields                                                                                          |
| `CreatePersonalEventDto`      | Missing `status`, `globalEventId` fields                                                                                       |
| `CreateGlobalEventDto`        | Missing `isActive` field                                                                                                       |

---

## 14. Known Issues & Architecture Decisions

### 14.1 Duplicate Target School Models

**Problem:** Two models serve the same purpose — storing a user's target schools.

| Aspect         | `ProfileTargetSchool`               | `SchoolListItem`                    |
| -------------- | ----------------------------------- | ----------------------------------- |
| Key            | profileId (no FK)                   | userId (FK -> User)                 |
| Back-relation  | None                                | Yes (User.schoolListItems)          |
| Tier support   | priority (Int)                      | tier (SAFETY/TARGET/REACH enum)     |
| Notes          | No                                  | Yes (Text)                          |
| AI recommended | No                                  | Yes (Boolean)                       |
| Frontend usage | **Not integrated** (empty useState) | Dashboard, FindCollege, UncommonApp |
| Backend CRUD   | ProfileService                      | SchoolListService                   |

**Decision:** Consolidate to `SchoolListItem`. Profile target-school endpoints will proxy to SchoolListItem. `ProfileTargetSchool` is deprecated.

### 14.2 Fragmented Scoring Logic — RESOLVED

**Problem:** Four independent scoring formulas produce inconsistent results.

**Resolution (2026-02-06):** Unified scoring utility created at `apps/api/src/common/utils/scoring.ts`. All modules reference this single source. See Section 6 for details.

### 14.2.1 totalEnrollment vs studentCount

**Both fields exist on School model.** `studentCount` is the College Scorecard alias written by `school-data.service.ts` and seed scripts. `totalEnrollment` was the original field. Both represent total enrollment. Consolidation deferred to a future cleanup.

### 14.2.2 Planned: Percentile-Based Scoring

Percentile-based scoring requires migrating `calculateAcademicScore()` to use `sat25`/`sat75` via normal CDF. Fields are in schema; implementation pending.

### 14.2.3 Planned: Competition-Tier Award Scoring

Competition-tier-weighted award scoring requires linking `Award.competitionId` → `Competition.tier` in the scoring utility. Schema and seed data are ready; scoring integration pending.

### 14.3 Prisma Model Notes

- `SchoolRecommendation` — This is a TypeScript DTO/interface used in `recommendation.service.ts` for structuring response data; it does not need a corresponding Prisma model in the schema.
- `VaultItem` — DTOs exist but model may not be in schema (needs verification)

### 14.4 Frontend Notification Gap

**Status: RESOLVED** (2026-02-09) — ChatGateway now sends NEW_MESSAGE notifications to offline users. Online/offline events are broadcast on connect/disconnect.

### 14.6 Dashboard targetSchoolCount

**Problem:** `dashboard.service.ts` line 154 hardcodes `targetSchoolCount: 0` with a TODO comment.

### 14.7 CORS Configuration — ✅ RESOLVED

**Problem:** `main.ts` previously set `origin: true` (allows all origins).

**Resolution:** `main.ts` now reads `CORS_ORIGINS` environment variable (comma-separated) for production. Falls back to `origin: true` only in development when `CORS_ORIGINS` is not set.

### 14.8 DataSyncScheduler Not Registered — ✅ RESOLVED

**Problem:** `DataSyncScheduler` was not registered as a provider in any module, meaning its cron jobs did not execute.

**Resolution:** `DataSyncScheduler` is now registered in `SchoolModule.providers`, and `ScheduleModule` is imported in `SchoolModule.imports`.

### 14.9 Swagger Disabled

**Problem:** Swagger docs are commented out in `main.ts`. Consider re-enabling for API documentation.

---

## 15. Development Guidelines

### 15.1 Before Creating a New Feature

**Checklist to prevent duplication:**

1. **Check existing models:** Search `schema.prisma` for similar models before creating new ones
2. **Check existing services:** Search for similar business logic in other modules
3. **Check shared types:** Ensure new types are added to `packages/shared/src/types/`
4. **Check scoring:** If the feature involves any form of scoring, use the unified scoring utility
5. **Check school selection:** Use `SchoolListItem` (not `ProfileTargetSchool`) for any school selection feature
6. **Check DTOs:** Ensure DTO validations match Prisma schema constraints

### 15.2 Module Creation Pattern

```typescript
// 1. Create Prisma model in schema.prisma
// 2. Run: npx prisma migrate dev --name <migration_name>
// 3. Create module directory: apps/api/src/modules/<name>/
// 4. Create: <name>.module.ts, <name>.controller.ts, <name>.service.ts
// 5. Create DTOs: dto/<name>.dto.ts
// 6. Import module in app.module.ts
// 7. Add shared types to packages/shared/src/types/
// 8. Create frontend page/component if needed
```

### 15.3 Query Key Conventions (Frontend)

```typescript
['resource'][('resource', id)][('resource', search, filters)][('resource-detail', id)][ // List all // Get by ID // Search with filters // Detailed view
  'resource-overview'
]; // Summary/stats
```

### 15.4 API Response Format

All responses wrapped by `TransformInterceptor`:

```typescript
// Success
{ success: true, data: <payload> }

// Error
{ success: false, error: { code: string, message: string, timestamp: string, path: string } }

// Paginated
{ success: true, data: { items: [], total: number, page: number, pageSize: number, totalPages: number } }
```

### 15.5 Important Conventions

- **Decimal fields:** Always convert `Prisma.Decimal` to `Number()` before returning to client
- **Soft delete:** Use `deletedAt` field on User model; check in JwtAuthGuard
- **Anonymization:** For `ANONYMOUS` visibility, replace `userId` with `anon-{id}` and mask `realName`, `currentSchool`
- **Memory integration:** When user actions have AI relevance, call `MemoryManagerService.remember()` or `recordEntity()`
- **Points:** Award points for significant actions via `User.points` field and `PointHistory`

---

---

## 16. Constraints (arc42 Section 2)

### 16.1 Technical Constraints

| Constraint      | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| TypeScript only | All application code must be TypeScript (strict mode)              |
| Node.js 20+     | Runtime requirement for all server and build processes             |
| PostgreSQL      | Primary database; pgvector extension required for AI vector search |
| Redis 7+        | Required for caching, rate limiting, and session management        |
| pnpm            | Package manager (monorepo workspaces)                              |
| Next.js 16      | Frontend framework; Webpack mode required (see ADR-0001)           |
| NestJS 11       | Backend framework; modular architecture mandatory                  |

### 16.2 Organizational Constraints

| Constraint           | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| Monorepo             | All apps (api, web, mobile) and packages in a single repository   |
| Chinese + English    | All user-facing content must support both languages via next-intl |
| Conventional Commits | All commit messages must follow Conventional Commits format       |
| PR Review            | All code changes require at least 1 reviewer approval             |

### 16.3 Legal / Regulatory Constraints

| Constraint          | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| Proprietary License | All code is proprietary; no open-source distribution              |
| Data Privacy        | User data export (GDPR-style) via `/users/me/export`              |
| Content Moderation  | User-generated content must be moderated (ForumModerationService) |
| Encryption at Rest  | Sensitive credentials stored encrypted (Vault module, AES-256)    |

---

## 17. Quality Requirements (arc42 Section 10)

### 17.1 Quality Tree

```
Quality
  |-- Performance
  |     |-- API response < 500ms (p95)
  |     |-- Page load < 3s (FCP)
  |     |-- AI Agent response < 10s (first token)
  |
  |-- Reliability
  |     |-- 99.5% uptime target
  |     |-- Graceful degradation (AI unavailable -> fallback responses)
  |     |-- Circuit breaker for external services
  |
  |-- Security
  |     |-- OWASP Top 10 compliance
  |     |-- JWT rotation with refresh tokens
  |     |-- Rate limiting on all auth endpoints
  |     |-- XSS prevention on user-generated content
  |
  |-- Maintainability
  |     |-- Unit test coverage >= 80% (new code)
  |     |-- Modular architecture (NestJS modules)
  |     |-- Shared types between frontend and backend
  |
  |-- Usability
  |     |-- Full i18n support (zh/en)
  |     |-- Responsive design (mobile/tablet/desktop)
  |     |-- Accessibility (WCAG 2.1 AA target)
```

### 17.2 Quality Scenarios

| ID   | Quality         | Scenario                          | Measure                                      |
| ---- | --------------- | --------------------------------- | -------------------------------------------- |
| QS-1 | Performance     | User submits prediction request   | Response within 5 seconds                    |
| QS-2 | Performance     | Schools page loads with 300 items | Virtual scroll, no jank                      |
| QS-3 | Reliability     | OpenAI API is down                | Fallback response served, user notified      |
| QS-4 | Reliability     | Redis connection lost             | Application continues with degraded caching  |
| QS-5 | Security        | Malicious script in forum post    | Content sanitized, script not executed       |
| QS-6 | Security        | Brute-force login attempt         | Rate limited after 3 attempts per minute     |
| QS-7 | Maintainability | New developer joins the team      | Productive within 1 week (see ONBOARDING.md) |
| QS-8 | Usability       | User switches language zh->en     | All visible text updates immediately         |

---

## 18. Risks and Technical Debt (arc42 Section 11)

### 18.1 Active Risks

| Risk                                      | Impact | Probability | Mitigation                                       |
| ----------------------------------------- | ------ | ----------- | ------------------------------------------------ |
| Turbopack route group compatibility       | High   | Medium      | ADR-0001: Webpack fallback + periodic re-testing |
| Prisma shadow DB migration replay failure | Medium | High        | ADR-0002: Manual resolve strategy                |
| OpenAI API rate limits / outages          | High   | Medium      | Circuit breaker + fallback responses             |
| Redis single point of failure             | Medium | Low         | Graceful degradation in RedisService             |
| Large bundle size (50+ pages)             | Medium | Medium      | Code splitting with next/dynamic                 |

### 18.2 Technical Debt

| Item                                  | Severity | Description                                  | Planned Resolution                         |
| ------------------------------------- | -------- | -------------------------------------------- | ------------------------------------------ |
| Mixed mock data in forum              | Low      | Forum page uses hardcoded mock posts         | Replace with API data                      |
| Profile controller has business logic | Medium   | Some logic should be in ProfileService       | Refactor to service layer                  |
| `any` types in prediction service     | Low      | Some Prisma query results typed as `any`     | Replace with Prisma generated types        |
| Migration history not replayable      | Medium   | Shadow DB cannot replay from scratch         | Document workaround (ADR-0002)             |
| JSDoc coverage                        | Medium   | Core service methods lack JSDoc annotations  | Add JSDoc to public APIs                   |
| Global feature flag system            | Low      | Feature flags exist only for AI Agent module | Implement centralized feature flag service |

### 18.3 Resolved Risks

| Risk                                  | Resolution                                                              | Date       |
| ------------------------------------- | ----------------------------------------------------------------------- | ---------- |
| 9 failing unit test suites            | All 24/24 suites passing (DI mocks fixed)                               | 2026-02-07 |
| React Hydration warnings              | Browser APIs moved to useEffect hooks                                   | 2026-02-07 |
| Schema drift (Competition model)      | Formal migration created and resolved                                   | 2026-02-07 |
| Missing i18n translations (290+ keys) | All translations added                                                  | 2026-02-07 |
| CORS misconfiguration                 | Configurable whitelist via CORS_ORIGINS + exposedHeaders                | 2026-02-07 |
| Swagger UI disabled                   | Re-enabled with try/catch resilience (ADR in progress)                  | 2026-02-07 |
| No env variable validation            | Zod schema validation at startup (ADR-0004)                             | 2026-02-07 |
| Missing security headers              | Helmet CSP/HSTS in production (ADR-0005)                                | 2026-02-07 |
| Generic Prisma error handling         | Typed exception mapping in global filter (ADR-0006)                     | 2026-02-07 |
| No response traceability              | CorrelationId + responseTimeMs in response meta (ADR-0007)              | 2026-02-07 |
| Prediction identical probabilities    | Multi-engine ensemble v2 with stats/AI/historical fusion (ADR-0008)     | 2026-02-09 |
| No prediction calibration loop        | User can report actual results; calibration API added                   | 2026-02-09 |
| Entity table raw SQL error            | Replaced raw SQL with Prisma ORM for Entity operations                  | 2026-02-09 |
| pgvector deserialization errors       | Excluded embedding columns from all raw SQL RETURNING/SELECT clauses    | 2026-02-09 |
| 锐评模式三维评分不全面                | 升级为四维评分(学术/标化/活动/奖项) + 分项评语 + 标签 + 状态 + 互动反应 | 2026-02-09 |
| PII leaking in logs                   | Extended SENSITIVE_FIELDS (email/phone/address/etc.)                    | 2026-02-07 |
| No request timeout protection         | Global timeout middleware (30s/120s for AI)                             | 2026-02-07 |
| No slow query detection               | Prisma query middleware with configurable threshold                     | 2026-02-07 |
| No pre-commit enforcement             | Husky + lint-staged + commitlint                                        | 2026-02-07 |
| No staging smoke tests                | Automated health/security/readiness checks in deploy pipeline           | 2026-02-07 |

---

## 19. Glossary (arc42 Section 12)

See [GLOSSARY.md](GLOSSARY.md) for the complete glossary of business and technical terms.

---

_This document is the single source of truth for the project architecture. Update it whenever architectural changes are made._

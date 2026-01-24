# Glossary

> Business and technical terms used across the Study Abroad Platform codebase.

## Business Domain Terms

| Term                   | Chinese      | Definition                                                                                                      |
| ---------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| Admission Case         | 录取案例     | A documented record of a student's admission result to a school, shared publicly or privately                   |
| Application Timeline   | 申请时间线   | A per-school timeline tracking application tasks, deadlines, and progress (0-100%)                              |
| Assessment             | 测评         | Personality or career interest assessment (MBTI, Holland, Strength) with result interpretation                  |
| Award                  | 奖项         | Academic or extracurricular awards/honors earned by a student                                                   |
| Competition            | 竞赛         | Standardized academic competitions (AMC, USABO, etc.) categorized by subject and tier                           |
| Confidence Interval    | 置信区间     | Range (probabilityLow to probabilityHigh) indicating the uncertainty of a prediction                            |
| Custom Ranking         | 自定义排名   | User-created school ranking with configurable weights for different metrics                                     |
| Daily Challenge        | 每日挑战     | A daily target of swipe predictions (resets at UTC midnight)                                                    |
| Engine Fusion          | 引擎融合     | Dynamic weighted combination of multiple prediction engines into a single probability                           |
| Essay                  | 文书         | Application essays submitted as part of college applications (Common App, supplements, etc.)                    |
| Essay Pipeline         | 文书采集管道 | Automated scraping and LLM-based extraction of essay prompts from school websites                               |
| Essay Prompt           | 文书题目     | The specific question or topic a school requires students to write about                                        |
| Forum                  | 论坛         | Community discussion board with categories, posts, comments, and likes                                          |
| Global Event           | 全局事件     | Platform-wide events (test dates, competition deadlines, summer programs) that users can subscribe to           |
| Hall                   | 大厅         | The community module where users share profiles, create lists, and compare rankings                             |
| Holland Code           | 霍兰德代码   | RIASEC personality assessment for career/major interest matching                                                |
| MBTI                   | MBTI         | Myers-Briggs Type Indicator personality assessment                                                              |
| Memory Type            | 记忆类型     | Classification of stored AI memories: FACT, PREFERENCE, DECISION, SUMMARY, FEEDBACK                             |
| Niche Grade            | Niche 评级   | Letter grades (A+ to F) from Niche.com for safety, student life, food, and overall quality                      |
| Onboarding             | 新人引导     | The initial setup flow after user registration to collect basic profile data                                    |
| Payment                | 支付         | Payment records tracking subscription purchases via Stripe, Alipay, or WeChat Pay                               |
| Peer Review            | 互评         | A system where verified users can review and rate each other's profiles                                         |
| Personal Event         | 个人事件     | User-specific events (competitions, tests, summer programs, internships) with sub-tasks                         |
| Point                  | 积分         | In-app currency earned through activity; spent on AI features                                                   |
| Prediction             | 录取预测     | Multi-engine ensemble (stats + AI + historical) admission probability estimation for a student-school pair (v2) |
| Prediction Calibration | 预测校准     | Process of comparing predicted probabilities against actual admission outcomes to improve model accuracy        |
| Profile                | 档案         | A student's complete academic and extracurricular profile                                                       |
| Recommendation         | 选校推荐     | AI-generated list of schools that match a student's profile                                                     |
| School Deadline        | 学校截止日期 | Structured deadline data per school/year/round (ED, EA, RD) with essay prompts and fee info                     |
| School List            | 选校清单     | A user's personal list of target schools categorized as SAFETY, TARGET, or REACH                                |
| School Tier            | 学校分层     | Classification of schools in a user's list: SAFETY (保底校), TARGET (匹配校), REACH (冲刺校)                    |
| Swipe                  | 滑动预测     | A gamified feature where users predict admission outcomes by swiping left/right                                 |
| Swipe Badge            | 预测徽章     | Achievement tiers (bronze/silver/gold/platinum/diamond) earned by accumulating correct predictions              |
| Swipe Streak           | 连胜         | Consecutive correct predictions; triggers fire animation at >= 3                                                |
| Target School          | 目标学校     | A school that a student intends to apply to                                                                     |
| Team Post              | 组队帖       | A forum post with team recruitment fields (teamSize, requirements, deadline, status)                            |
| Test Score             | 标化成绩     | Standardized test scores (SAT, ACT, TOEFL, IELTS, AP, IB)                                                       |
| Timeline               | 时间线       | An application timeline with milestones, deadlines, and tasks for each target school                            |
| Vault                  | 密码库       | Encrypted storage for sensitive credentials (portal logins, etc.)                                               |
| Verification           | 认证         | Identity verification process to upgrade user role from USER to VERIFIED                                        |
| Verified Ranking       | 认证排名     | Ranking of verified users by admission results                                                                  |

## Technical Terms

| Term              | Definition                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR               | Architecture Decision Record — a document capturing an important architectural decision and its context                                                                   |
| arc42             | A template for architecture documentation with 12 standardized sections                                                                                                   |
| Circuit Breaker   | A resilience pattern that prevents cascading failures by "opening" when a service repeatedly fails                                                                        |
| CORS              | Cross-Origin Resource Sharing — browser security mechanism controlling cross-domain requests                                                                              |
| DTO               | Data Transfer Object — a class defining the shape of request/response data, validated by class-validator                                                                  |
| Entity            | In the AI memory system, a knowledge-graph node (SCHOOL, PERSON, EVENT, TOPIC) extracted from conversations                                                               |
| Fallback          | A degraded but functional response returned when the primary service (e.g., OpenAI) is unavailable                                                                        |
| Fast Router       | Keyword-based routing layer that resolves simple intents without calling the LLM, reducing ~70% of LLM calls                                                              |
| Guard             | A NestJS mechanism that determines whether a request should be handled (auth, roles, throttle)                                                                            |
| Hydration         | The process where React attaches event handlers to server-rendered HTML; mismatches cause warnings                                                                        |
| Interceptor       | A NestJS mechanism that transforms request/response (logging, response wrapping, rate-limit headers)                                                                      |
| JWT               | JSON Web Token — stateless authentication token containing user ID and role                                                                                               |
| LLM               | Large Language Model — the AI model (GPT-4o-mini, etc.) used for chat, essay review, and predictions                                                                      |
| Memory Compaction | Service that merges or summarizes redundant memories to reduce storage and improve retrieval quality                                                                      |
| Memory Decay      | Time-based importance decay algorithm that archives or deletes stale memories based on access patterns                                                                    |
| Middleware        | Code that runs before route handlers (correlation ID, locale detection)                                                                                                   |
| Monorepo          | A single repository containing multiple applications and shared packages                                                                                                  |
| next-intl         | The internationalization library used for zh/en language support in Next.js                                                                                               |
| Orchestrator      | The central Agent that routes user requests to specialized agents (Essay, School, Profile, Timeline)                                                                      |
| pgvector          | PostgreSQL extension for vector similarity search; used for semantic memory retrieval with 1536-dim embeddings                                                            |
| Prisma            | The ORM (Object-Relational Mapping) used for database access and schema management                                                                                        |
| RBAC              | Role-Based Access Control — authorization model with USER, VERIFIED, and ADMIN roles                                                                                      |
| Refresh Token     | A long-lived token used to obtain new access tokens without re-authentication                                                                                             |
| ReWOO             | Reason Without Observation — the three-phase workflow pattern (Plan/Execute/Solve) used by the Agent system                                                               |
| SSE               | Server-Sent Events — the protocol used for streaming AI Agent responses to the client                                                                                     |
| SSR               | Server-Side Rendering — rendering React components on the server for faster initial page loads                                                                            |
| Throttle          | Rate limiting mechanism to prevent abuse (e.g., 3 login attempts per minute)                                                                                              |
| Tool              | In the AI Agent context, a callable function that the agent can use (32 tools across 12 categories)                                                                       |
| Turbopack         | Next.js's Rust-based bundler; currently incompatible with route groups (see ADR-0001)                                                                                     |
| Virtual List      | A rendering technique that only renders visible items in long lists for performance                                                                                       |
| Webhook           | An HTTP callback triggered by external services (e.g., payment processor)                                                                                                 |
| Workflow Engine   | The ReWOO-based service that manages AI Agent execution in three phases: Plan (LLM plans all tool calls), Execute (run tools without LLM), Solve (LLM summarizes results) |

## Roles

| Role     | Chinese  | Permissions                                                       |
| -------- | -------- | ----------------------------------------------------------------- |
| USER     | 普通用户 | Basic access: profile, school browsing, forum reading             |
| VERIFIED | 认证用户 | All USER permissions + case sharing, peer review, team posts      |
| ADMIN    | 管理员   | Full access: user management, content moderation, system settings |

## Abbreviations

| Abbreviation | Full Form                                      |
| ------------ | ---------------------------------------------- |
| ACT          | American College Testing                       |
| API          | Application Programming Interface              |
| CI/CD        | Continuous Integration / Continuous Deployment |
| CRUD         | Create, Read, Update, Delete                   |
| DI           | Dependency Injection                           |
| DORA         | DevOps Research and Assessment                 |
| EA           | Early Action (non-binding early application)   |
| ED           | Early Decision (binding early application)     |
| FCP          | First Contentful Paint                         |
| GDPR         | General Data Protection Regulation             |
| GPA          | Grade Point Average                            |
| LRU          | Least Recently Used (cache eviction strategy)  |
| OWASP        | Open Web Application Security Project          |
| PII          | Personally Identifiable Information            |
| PR           | Pull Request                                   |
| RAG          | Retrieval-Augmented Generation                 |
| RCE          | Remote Code Execution                          |
| RD           | Regular Decision                               |
| ReWOO        | Reason Without Observation                     |
| SAT          | Scholastic Assessment Test                     |
| SSE          | Server-Sent Events                             |
| SSRF         | Server-Side Request Forgery                    |
| TTL          | Time To Live (cache expiration duration)       |
| XSS          | Cross-Site Scripting                           |

---

_Last updated: 2026-02-13_

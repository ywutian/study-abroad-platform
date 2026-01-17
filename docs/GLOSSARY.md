# Glossary

> Business and technical terms used across the Study Abroad Platform codebase.

## Business Domain Terms

| Term                   | Chinese    | Definition                                                                                                      |
| ---------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| Admission Case         | 录取案例   | A documented record of a student's successful admission to a school, shared publicly or privately               |
| Award                  | 奖项       | Academic or extracurricular awards/honors earned by a student                                                   |
| Competition            | 竞赛       | Standardized academic competitions (AMC, USABO, etc.) categorized by subject and tier                           |
| Essay                  | 文书       | Application essays submitted as part of college applications (Common App, supplements, etc.)                    |
| Essay Prompt           | 文书题目   | The specific question or topic a school requires students to write about                                        |
| Hall                   | 大厅       | The community module where users share profiles, create lists, and compare rankings                             |
| Holland Code           | 霍兰德代码 | RIASEC personality assessment for career/major interest matching                                                |
| MBTI                   | MBTI       | Myers-Briggs Type Indicator personality assessment                                                              |
| Onboarding             | 新人引导   | The initial setup flow after user registration to collect basic profile data                                    |
| Peer Review            | 互评       | A system where verified users can review and rate each other's profiles                                         |
| Point                  | 积分       | In-app currency earned through activity; spent on AI features                                                   |
| Prediction             | 录取预测   | Multi-engine ensemble (stats + AI + historical) admission probability estimation for a student-school pair (v2) |
| Prediction Calibration | 预测校准   | Process of comparing predicted probabilities against actual admission outcomes to improve model accuracy        |
| Confidence Interval    | 置信区间   | Range (probabilityLow to probabilityHigh) indicating the uncertainty of a prediction                            |
| Engine Fusion          | 引擎融合   | Dynamic weighted combination of multiple prediction engines into a single probability                           |
| Profile                | 档案       | A student's complete academic and extracurricular profile                                                       |
| Recommendation         | 选校推荐   | AI-generated list of schools that match a student's profile                                                     |
| School List            | 选校清单   | A user's personal list of target schools with application status tracking                                       |
| Swipe                  | 滑动预测   | A gamified feature where users predict admission outcomes by swiping left/right                                 |
| Swipe Badge            | 预测徽章   | Achievement tiers (bronze/silver/gold/platinum/diamond) earned by accumulating correct predictions              |
| Swipe Streak           | 连胜       | Consecutive correct predictions; triggers fire animation at >= 3                                                |
| Daily Challenge        | 每日挑战   | A daily target of swipe predictions (resets at UTC midnight)                                                    |
| Target School          | 目标学校   | A school that a student intends to apply to                                                                     |
| Test Score             | 标化成绩   | Standardized test scores (SAT, ACT, TOEFL, IELTS, AP, etc.)                                                     |
| Timeline               | 时间线     | An application timeline with milestones, deadlines, and tasks for each target school                            |
| Vault                  | 密码库     | Encrypted storage for sensitive credentials (portal logins, etc.)                                               |
| Verification           | 认证       | Identity verification process to upgrade user role from USER to VERIFIED                                        |
| Verified Ranking       | 认证排名   | Ranking of verified users by admission results                                                                  |

## Technical Terms

| Term            | Definition                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| ADR             | Architecture Decision Record — a document capturing an important architectural decision and its context     |
| arc42           | A template for architecture documentation with 12 standardized sections                                     |
| Circuit Breaker | A resilience pattern that prevents cascading failures by "opening" when a service repeatedly fails          |
| CORS            | Cross-Origin Resource Sharing — browser security mechanism controlling cross-domain requests                |
| DTO             | Data Transfer Object — a class defining the shape of request/response data, validated by class-validator    |
| Fallback        | A degraded but functional response returned when the primary service (e.g., OpenAI) is unavailable          |
| Guard           | A NestJS mechanism that determines whether a request should be handled (auth, roles, throttle)              |
| Hydration       | The process where React attaches event handlers to server-rendered HTML; mismatches cause warnings          |
| Interceptor     | A NestJS mechanism that transforms request/response (logging, response wrapping, rate-limit headers)        |
| JWT             | JSON Web Token — stateless authentication token containing user ID and role                                 |
| LLM             | Large Language Model — the AI model (GPT-4, etc.) used for chat, essay review, and predictions              |
| Middleware      | Code that runs before route handlers (correlation ID, locale detection)                                     |
| Monorepo        | A single repository containing multiple applications and shared packages                                    |
| next-intl       | The internationalization library used for zh/en language support in Next.js                                 |
| Orchestrator    | The central service that routes AI Agent requests to specialized agents                                     |
| Prisma          | The ORM (Object-Relational Mapping) used for database access and schema management                          |
| RBAC            | Role-Based Access Control — authorization model with USER, VERIFIED, and ADMIN roles                        |
| Refresh Token   | A long-lived token used to obtain new access tokens without re-authentication                               |
| SSR             | Server-Side Rendering — rendering React components on the server for faster initial page loads              |
| Throttle        | Rate limiting mechanism to prevent abuse (e.g., 3 login attempts per minute)                                |
| Tool            | In the AI Agent context, a callable function that the agent can use (e.g., search schools, analyze profile) |
| Turbopack       | Next.js's Rust-based bundler; currently incompatible with route groups (see ADR-0001)                       |
| Virtual List    | A rendering technique that only renders visible items in long lists for performance                         |
| Webhook         | An HTTP callback triggered by external services (e.g., payment processor)                                   |
| Workflow Engine | The service that manages multi-step AI Agent execution with planning and iteration                          |

## Roles

| Role     | Chinese  | Permissions                                                       |
| -------- | -------- | ----------------------------------------------------------------- |
| USER     | 普通用户 | Basic access: profile, school browsing, forum reading             |
| VERIFIED | 认证用户 | All USER permissions + case sharing, peer review, team posts      |
| ADMIN    | 管理员   | Full access: user management, content moderation, system settings |

## Abbreviations

| Abbreviation | Full Form                                      |
| ------------ | ---------------------------------------------- |
| API          | Application Programming Interface              |
| CI/CD        | Continuous Integration / Continuous Deployment |
| CRUD         | Create, Read, Update, Delete                   |
| DI           | Dependency Injection                           |
| DORA         | DevOps Research and Assessment                 |
| FCP          | First Contentful Paint                         |
| GDPR         | General Data Protection Regulation             |
| GPA          | Grade Point Average                            |
| OWASP        | Open Web Application Security Project          |
| PII          | Personally Identifiable Information            |
| PR           | Pull Request                                   |
| SSRF         | Server-Side Request Forgery                    |
| RCE          | Remote Code Execution                          |
| XSS          | Cross-Site Scripting                           |

---

_Last updated: 2026-02-09_

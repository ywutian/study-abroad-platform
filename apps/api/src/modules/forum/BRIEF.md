# Module: forum

## Purpose

Community forum with posts, comments, team recruitment, reporting, and moderation.

## Key Files

- `forum.controller.ts` — Public: categories, posts, comments. Auth: create/edit/delete, team apply, report
- `forum.service.ts` — Thin facade delegating to 5 sub-services
- `forum-category.service.ts` — Category CRUD + forum stats
- `forum-post.service.ts` — Post CRUD, search, pagination, likes
- `forum-comment.service.ts` — Nested comments, likes
- `forum-team.service.ts` — Team recruitment posts, applications, review
- `forum-report.service.ts` — Content reporting
- `forum-memory.service.ts` — Records forum activity to AI memory
- `forum-admin.controller.ts` — Admin moderation endpoints
- `moderation.service.ts` — Content moderation logic

## Data Model

ForumCategory, ForumPost (categoryId, userId, title, content, isPinned, isTeaming), ForumComment (postId, parentId for nesting), ForumLike, ForumReport, TeamApplication. References: User.

## Dependencies

ForumCategoryService, ForumPostService, ForumCommentService, ForumTeamService, ForumReportService | AI/LLM: Indirect (memory recording)

## Business Rules

- Categories and post listing are `@Public()`
- Category creation requires `Role.ADMIN`
- Team recruitment uses application → review workflow
- Posts support pinning (admin only)
- Forum stats: postCount, userCount, teamingCount, activeToday

## Gotchas

- ForumService is a pure facade — all logic lives in sub-services
- Nested comments via `parentId` self-reference
- Team applications are separate from regular comments

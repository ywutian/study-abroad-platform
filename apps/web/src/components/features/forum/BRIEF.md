# Feature: Forum

## Purpose

Community discussion forum with post cards, tag filtering, sorting, and content reporting.

## Components

- PostCard — displays forum post with author, tags, stats (likes, comments)
- TagFilter — filter posts by category/topic tags
- SortTabs — sort by newest, popular, unanswered
- ReportDialog — dialog for reporting inappropriate content

## Data Flow

- API: `GET /forum/posts`, `POST /forum/posts/:id/report`
- Posts include visibility controls, author info, engagement metrics

## Patterns

- Barrel export via index.ts
- Composable filter + sort controls for list pages
- Report dialog reusable across forum contexts

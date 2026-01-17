# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records for the Study Abroad Platform.

## What is an ADR?

An ADR captures a single architectural decision and its rationale. ADRs are part of Architectural Knowledge Management (AKM), recommended by [adr.github.io](https://adr.github.io/), Google Cloud, and the Azure Well-Architected Framework (2024).

## Format

We use a simplified [MADR](https://adr.github.io/madr/) (Markdown Any Decision Records) format:

```markdown
# ADR-NNNN: Title

- Status: proposed | accepted | deprecated | superseded by ADR-XXXX
- Date: YYYY-MM-DD
- Decision-makers: [names]
- Tags: [relevant tags]

## Context

[What is the issue that we're seeing that is motivating this decision?]

## Decision

[What is the change that we're proposing and/or doing?]

## Consequences

### Positive

- [benefit 1]

### Negative

- [trade-off 1]

### Neutral

- [observation 1]
```

## How to Create a New ADR

1. Copy the template above
2. Number it sequentially: `NNNN-short-description.md`
3. Fill in all sections
4. Set status to `proposed`
5. Submit a PR for review
6. Update status to `accepted` after team approval

## Index

| ADR                                                      | Title                                           | Status   | Date       |
| -------------------------------------------------------- | ----------------------------------------------- | -------- | ---------- |
| [0001](0001-use-nextjs-turbopack-webpack-fallback.md)    | Next.js 16 Turbopack Webpack Fallback           | accepted | 2026-02-07 |
| [0002](0002-prisma-migration-manual-resolve-strategy.md) | Prisma Migration Manual Resolve Strategy        | accepted | 2026-02-07 |
| [0003](0003-ai-agent-workflow-engine-architecture.md)    | AI Agent Workflow Engine Architecture           | accepted | 2026-01-20 |
| [0004](0004-zod-environment-validation.md)               | Zod-Based Environment Variable Validation       | accepted | 2026-02-07 |
| [0005](0005-production-security-headers.md)              | Production Security Headers (Helmet CSP + HSTS) | accepted | 2026-02-07 |
| [0006](0006-prisma-exception-handling-strategy.md)       | Prisma Exception Handling in Global Filter      | accepted | 2026-02-07 |
| [0007](0007-api-response-metadata-injection.md)          | API Response Metadata Injection                 | accepted | 2026-02-07 |
| [0008](0008-prediction-multi-engine-ensemble.md)         | Prediction Multi-Engine Ensemble Architecture   | accepted | 2026-02-09 |
| [0009](0009-hall-swipe-ui-overhaul.md)                   | Hall Swipe Game UI/UX Overhaul                  | accepted | 2026-02-09 |

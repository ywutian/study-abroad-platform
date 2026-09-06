# Restore the previous DeepSeek production provider

<!-- section:change-identity -->

## 1. Change Identity

[DECISION] Change ID: AI-RESTORE-DEEPSEEK-2026-09-05. Configuration restoration for study-abroad-platform. Requester/owner: user; implementation: Codex. Source: current conversation, user requests "我之前用的DeepSeek 还是换成DeepSeek吧" and confirms "就之前的就行了" after TLS failure disclosure. Status: Implemented; release blocked.

<!-- section:executive-summary -->

## 2. Executive Summary

[REQUESTER] Restore the previous DeepSeek provider. [DECISION] Restore model deepseek-v4-pro, endpoint https://xh.v1api.cc/v1 and existing openai-api-key credential. Success requires canonical config, startup/contract checks, and production verification.

<!-- section:current-state -->

## 3. Current State

[RUNTIME] Production revision study-abroad-api-01031-qub receives 100% traffic and uses GPT-5.4 on the Codex relay. Historical revision 00992-zin records deepseek-v4-pro on xh.v1api.cc and openai-api-key:latest. Current latest secret version is 2. Local unauthenticated TLS checks fail before HTTP. [CODE] openai-chat.config.ts only permits gpt-* dedicated chat models.

<!-- section:target-outcome -->

## 4. Target Outcome

[DECISION] All non-routed production chat uses the previous DeepSeek configuration; subsequent CI deployments preserve this choice. Embedding keeps its existing binding. No OAuth fallback is added.

<!-- section:scope -->

## 5. Scope

[DECISION] In scope: production chat settings, dedicated configuration validation, deployment drift checks, focused tests, existing release workflow. Out of scope: relay changes, new credentials, business migrations, staging changes, model quality claims.

<!-- section:users-permissions -->

## 6. Users and Permissions

[DECISION] Existing production application users and administrators retain their permissions. User explicitly authorizes restoring the old provider. Credentials remain in Secret Manager.

<!-- section:user-flows -->

## 7. User Flows

[DECISION] Existing chat, streaming, errors, cancellation, retries and timeouts remain under the current provider adapter. Startup rejects partial or invalid dedicated configuration. Provider failure does not silently select GPT/OAuth.

<!-- section:requirements -->

## 8. Requirements

| ID      | Requirement                                                                                                   | Priority | Source      |
| ------- | ------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| FR-001  | Restore previous DeepSeek endpoint, model and credential in canonical production config and workflow.         | Must     | [REQUESTER] |
| FR-002  | Allow the exact previous model in dedicated chat validation and omit GPT reasoning options.                   | Must     | [CODE]      |
| NFR-001 | Preserve embedding and unrelated work; retain revision 01031-qub for rollback and use existing release gates. | Must     | [DECISION]  |

<!-- section:acceptance -->

## 9. Acceptance Criteria

| ID     | Requirement     | Given / When / Then                                                                                                                                   | Evidence              |
| ------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| AC-001 | FR-001          | Given deploy configuration, when drift validation runs, then DeepSeek settings and secret binding match.                                              | Drift gate            |
| AC-002 | FR-002          | Given DeepSeek configuration, when provider sends a request, then startup succeeds, max_tokens is sent and GPT reasoning fields are omitted.          | Focused provider test |
| AC-003 | FR-001, NFR-001 | Given an isolated release passing existing gates, when promoted, then production configuration and synthetic acceptance pass with rollback available. | CI and Cloud Run      |

<!-- section:technical-impact -->

## 10. Technical Impact

[DECISION] Modify .github/deploy-config.json, ci.yml, configuration validator, drift checker and focused tests. No application data schema or migration. OPENAI_CHAT_API_KEY references existing openai-api-key version 2. Model and endpoint use the historical configuration. Cost follows that existing provider; no pricing claim.

<!-- section:nonfunctional -->

## 11. Security and Quality

[DECISION] Preserve HTTPS validation, atomic credential configuration, existing authentication, tenant isolation, embedding and UI. Secrets never enter output or artifacts. N/A: localization/accessibility changes, because this is backend configuration.

<!-- section:observability -->

## 12. Observability

[DECISION] Record only revision identifiers, traffic percentages, non-secret provider configuration, sanitized contract verdicts and CI links. Provider errors and TLS failures remain explicit.

<!-- section:test-plan -->

## 13. Test Plan

[DECISION] AC-001: existing deploy drift guard and negative gate proofs. AC-002: configuration/provider Jest regression and environment validation. AC-003: existing CI image, migration, no-traffic health/Cron/Harness gates and production checks. N/A: manual model quality evaluation; no quality comparison claimed.

<!-- section:rollout -->

## 14. Rollout and Rollback

[DECISION] Use existing CI release workflow; do not replace application with historical revision 00992-zin. Retain active 01031-qub as rollback. Existing pre-promotion checks must pass. Failed post-promotion checks trigger workflow rollback. Local TLS failure is a known risk, not evidence of cloud connectivity.

<!-- section:risks-dependencies -->

## 15. Risks and Dependencies

[RUNTIME] Old provider endpoint fails TLS from this workstation. [DECISION] User confirms the old provider after disclosure. Cloud acceptance must determine production reachability; a failed gate blocks promotion. Codex owns implementation and reporting.

<!-- section:open-decisions -->

## 16. Decisions

[DECISION] User confirmed old DeepSeek configuration on 2026-09-05. [DECISION] Pin existing secret version 2 (currently latest), retain the existing strict SSE parser for ordinary and streaming calls. No unresolved implementation decisions.

<!-- section:implementation-plan -->

## 17. Implementation Plan

[DECISION] Create isolated worktree from current main 4e110794. Normalize request and pass request/intake gates. Update atomic deployment configuration, narrowly allow the old model, make reasoning omission explicit in drift checks, add regression coverage, run checks, create PR and dispatch existing CI. Preserve all original worktree changes.

<!-- section:implementation-summary -->

## 18. Implementation Summary

[CODE] FR-001: .github/deploy-config.json and ci.yml restore deepseek-v4-pro, historical endpoint and existing secret version 2. FR-002: dedicated startup validation permits the exact model; absent reasoning option is enforced by drift guard. NFR-001: original worktree and embedding configuration preserved. Implementation commit a02d73ee; PR #649.

<!-- section:verification -->

## 19. Verification Evidence

[RUNTIME] AC-001 PASS: deploy drift guard and seeded negative proofs. AC-002 PASS: 40 Jest tests across configuration, environment validation and provider suites. AI_AGENT environment documentation gate PASS. AC-003 BLOCKED: CI run 34013165991 Security Scan failed with six HIGH dependency findings (browserslist 4.28.2: CVE-2026-73088/73089; fast-uri 3.1.5: CVE-2026-75899/75931/75975/76172). Lockfile is unchanged from main. Release was cancelled after the hard failure; no deploy or production acceptance occurred. Read-only Cloud Run recheck confirms revision 01031-qub still receives 100% traffic. No synthetic users created and no secrets modified. Original dirty worktree remains untouched. Local TLS failure remains unverified from production.

<!-- section:release-decision -->

## 20. Release Decision

[DECISION] Implementation: complete for FR-001 and FR-002; release BLOCKED by existing security gate. Merge: NOT CLAIMED; draft PR https://github.com/ywutian/study-abroad-platform/pull/649. Production is NOT switched. Existing release Skill requires stopping on first hard failure. Next owner/action: dependency remediation and rerun existing release workflow, then verify provider connectivity and Harness acceptance before claiming restoration. CI evidence: https://github.com/ywutian/study-abroad-platform/actions/runs/34013165991.

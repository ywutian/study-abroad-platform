# Application Analysis Gold Replay

- Dataset: `gold:deterministic:v1`
- Mode: `deterministic`
- Analysis version: `application-analysis-v2`
- Commit: `244268730009cded2ca3bcd31753dab7eadd1e43`
- Total cases: `50`
- Pass rate: `1`

## Metrics

- policyCorrectnessRate: `1`
- weakStateCorrectnessRate: `1`
- fabricatedInsightCount: `0`
- actionabilityMean: `1`
- contractParityPass: `true`
- webRenderPass: `null`
- mobileRenderPass: `null`
- journeyPassRate: `null`
- unknownPolicyRate: `0.2778`

## Cases

### 001-uc-berkeley-blind-en PASS

- UC Berkeley should remain test-blind in structured analysis output.
- durationMs: `2`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 002-no-target-schools-zh PASS

- When the applicant has not built a school list, the state must stay noTargetSchools.
- durationMs: `0`
- failures: `0`

### 003-columbia-optional-en PASS

- Columbia should surface as test-optional in the current policy contract.
- durationMs: `1`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 004-no-predictions-en PASS

- Focus schools without predictions should resolve to noPredictions instead of fabricating certainty.
- durationMs: `0`
- failures: `0`

### 005-insufficient-profile-en PASS

- Thin profiles should degrade to insufficientProfileData without pretending school-level confidence.
- durationMs: `1`
- failures: `0`

### 006-mit-required-en PASS

- MIT should stay test-required in ready-state analysis output.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 007-unknown-policy-zh PASS

- Unknown school policy should remain explicit instead of being inferred into a false optional/required label.
- durationMs: `1`
- failures: `0`

### 008-berkeley-columbia-balanced-en PASS

- A multi-school ready case should preserve ordering and policy labels across mixed blind/optional schools.
- durationMs: `1`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 009-stanford-required-zh PASS

- Stanford required-policy output should hold under zh locale render parity.
- durationMs: `1`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 010-brown-optional-aid-en PASS

- Aid-sensitive optional-policy schools should keep applicant-facing actions concise and policy-aware.
- durationMs: `1`
- failures: `0`

### 011-ucb-1 PASS

- UC blind policy should stay stable for repeat deterministic replays. Variant 1.
- durationMs: `0`
- failures: `0`

### 012-columbia-1 PASS

- Optional-policy output should remain stable for domestic applicants. Variant 1.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 013-mit-1 PASS

- Required-policy output should remain deterministic for engineering applicants. Variant 1.
- durationMs: `1`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 014-stanford-1 PASS

- Required-policy zh output should stay stable for replay. Variant 1.
- durationMs: `1`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 015-brown-1 PASS

- Optional-policy zh output should stay stable for aid-sensitive applicants. Variant 1.
- durationMs: `0`
- failures: `0`

### 016-unknown-tech-1 PASS

- Unknown-policy schools should stay explicitly unknown in deterministic replay. Variant 1.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 017-columbia-1 PASS

- Optional-policy zh output should remain deterministic for international applicants. Variant 1.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 018-ucb-2 PASS

- UC blind policy should stay stable for repeat deterministic replays. Variant 2.
- durationMs: `0`
- failures: `0`

### 019-columbia-2 PASS

- Optional-policy output should remain stable for domestic applicants. Variant 2.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 020-mit-2 PASS

- Required-policy output should remain deterministic for engineering applicants. Variant 2.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 021-stanford-2 PASS

- Required-policy zh output should stay stable for replay. Variant 2.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 022-brown-2 PASS

- Optional-policy zh output should stay stable for aid-sensitive applicants. Variant 2.
- durationMs: `0`
- failures: `0`

### 023-unknown-tech-2 PASS

- Unknown-policy schools should stay explicitly unknown in deterministic replay. Variant 2.
- durationMs: `0`
- failures: `0`

### 024-columbia-2 PASS

- Optional-policy zh output should remain deterministic for international applicants. Variant 2.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 025-ucb-3 PASS

- UC blind policy should stay stable for repeat deterministic replays. Variant 3.
- durationMs: `0`
- failures: `0`

### 026-columbia-3 PASS

- Optional-policy output should remain stable for domestic applicants. Variant 3.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 027-mit-3 PASS

- Required-policy output should remain deterministic for engineering applicants. Variant 3.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 028-stanford-3 PASS

- Required-policy zh output should stay stable for replay. Variant 3.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 029-brown-3 PASS

- Optional-policy zh output should stay stable for aid-sensitive applicants. Variant 3.
- durationMs: `0`
- failures: `0`

### 030-unknown-tech-3 PASS

- Unknown-policy schools should stay explicitly unknown in deterministic replay. Variant 3.
- durationMs: `1`
- failures: `0`

### 031-columbia-3 PASS

- Optional-policy zh output should remain deterministic for international applicants. Variant 3.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 032-ucb-4 PASS

- UC blind policy should stay stable for repeat deterministic replays. Variant 4.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 033-columbia-4 PASS

- Optional-policy output should remain stable for domestic applicants. Variant 4.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 034-mit-4 PASS

- Required-policy output should remain deterministic for engineering applicants. Variant 4.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 035-stanford-4 PASS

- Required-policy zh output should stay stable for replay. Variant 4.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 036-brown-4 PASS

- Optional-policy zh output should stay stable for aid-sensitive applicants. Variant 4.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 037-unknown-tech-4 PASS

- Unknown-policy schools should stay explicitly unknown in deterministic replay. Variant 4.
- durationMs: `0`
- failures: `0`

### 038-columbia-4 PASS

- Optional-policy zh output should remain deterministic for international applicants. Variant 4.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 039-no-target-1 PASS

- No target-school state should remain deterministic across replay variants.
- durationMs: `0`
- failures: `0`

### 040-no-target-2 PASS

- No target-school state should remain deterministic across replay variants.
- durationMs: `0`
- failures: `0`

### 041-no-target-3 PASS

- No target-school state should remain deterministic across replay variants.
- durationMs: `0`
- failures: `0`

### 042-no-target-4 PASS

- No target-school state should remain deterministic across replay variants.
- durationMs: `0`
- failures: `0`

### 043-no-predictions-mit PASS

- No-predictions state should remain explicit until prediction coverage exists.
- durationMs: `0`
- failures: `0`

### 044-no-predictions-stanford PASS

- No-predictions state should remain explicit until prediction coverage exists.
- durationMs: `0`
- failures: `0`

### 045-no-predictions-columbia PASS

- No-predictions state should remain explicit until prediction coverage exists.
- durationMs: `0`
- failures: `0`

### 046-no-predictions-ucb PASS

- No-predictions state should remain explicit until prediction coverage exists.
- durationMs: `0`
- failures: `0`

### 047-insufficient-ucb PASS

- Insufficient-profile state should never fabricate school-level certainty.
- durationMs: `0`
- failures: `0`

### 048-insufficient-columbia PASS

- Insufficient-profile state should never fabricate school-level certainty.
- durationMs: `0`
- failures: `0`

### 049-insufficient-mit PASS

- Insufficient-profile state should never fabricate school-level certainty.
- durationMs: `0`
- failures: `0`

### 050-insufficient-unknown-tech PASS

- Insufficient-profile state should never fabricate school-level certainty.
- durationMs: `0`
- failures: `0`

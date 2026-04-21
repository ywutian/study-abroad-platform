# Application Analysis Gold Replay

- Dataset: `gold:deterministic`
- Mode: `deterministic`
- Analysis version: `application-analysis-v2`
- Commit: `244268730009cded2ca3bcd31753dab7eadd1e43`
- Total cases: `5`
- Pass rate: `0.4`

## Metrics

- policyCorrectnessRate: `1`
- weakStateCorrectnessRate: `1`
- fabricatedInsightCount: `5`
- actionabilityMean: `1`
- contractParityPass: `true`
- webRenderPass: `true`
- mobileRenderPass: `true`
- journeyPassRate: `0.4`
- unknownPolicyRate: `0`

## Cases

### 001-uc-berkeley-blind-en FAIL

- UC Berkeley should remain test-blind in structured analysis output.
- durationMs: `2`
- failures: `3`
  - [block] forbiddenKeyword: Forbidden keyword "ACT" appeared for University of California, Berkeley.
  - [block] school_presence: Unexpected school 加州大学伯克利分校 appeared in the analysis output.
  - [warn] contract: Confidence label differs from the gold expectation.

### 002-no-target-schools-zh PASS

- No target schools should degrade to portfolio guidance instead of fabricated school analysis.
- durationMs: `0`
- failures: `0`

### 003-columbia-optional-en FAIL

- Columbia should surface as test-optional in the current policy contract.
- durationMs: `0`
- failures: `2`
  - [block] school_presence: Unexpected school 哥伦比亚大学 appeared in the analysis output.
  - [warn] contract: Confidence label differs from the gold expectation.

### 004-no-predictions-en FAIL

- Focus schools without predictions should resolve to noPredictions instead of fabricating certainty.
- durationMs: `1`
- failures: `1`
  - [block] school_presence: Unexpected school 康奈尔大学 appeared in the analysis output.

### 005-insufficient-profile-en PASS

- Thin profiles should degrade to insufficientProfileData without pretending school-level confidence.
- durationMs: `0`
- failures: `0`

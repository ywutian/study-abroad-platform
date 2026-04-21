# Application Analysis Gold Replay

- Dataset: `gold:deterministic:v1`
- Mode: `deterministic`
- Analysis version: `application-analysis-v2`
- Commit: `244268730009cded2ca3bcd31753dab7eadd1e43`
- Total cases: `5`
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
- unknownPolicyRate: `0`

## Cases

### 001-uc-berkeley-blind-en PASS

- UC Berkeley should remain test-blind in structured analysis output.
- durationMs: `2`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 002-no-target-schools-zh PASS

- No target schools should degrade to portfolio guidance instead of fabricated school analysis.
- durationMs: `1`
- failures: `0`

### 003-columbia-optional-en PASS

- Columbia should surface as test-optional in the current policy contract.
- durationMs: `0`
- failures: `1`
  - [warn] contract: Confidence label differs from the gold expectation.

### 004-no-predictions-en PASS

- Focus schools without predictions should resolve to noPredictions instead of fabricating certainty.
- durationMs: `0`
- failures: `0`

### 005-insufficient-profile-en PASS

- Thin profiles should degrade to insufficientProfileData without pretending school-level confidence.
- durationMs: `0`
- failures: `0`

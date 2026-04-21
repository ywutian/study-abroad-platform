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
- fabricatedInsightCount: `3`
- actionabilityMean: `0.4`
- contractParityPass: `false`
- webRenderPass: `false`
- mobileRenderPass: `false`
- journeyPassRate: `0.4`
- unknownPolicyRate: `0`

## Cases

### 001-uc-berkeley-blind-en FAIL

- UC Berkeley should remain test-blind in structured analysis output.
- durationMs: `1`
- failures: `1`
  - [block] contract: (0 , import_utils.resolveSchoolTestingPolicyValue) is not a function

### 002-no-target-schools-zh PASS

- No target schools should degrade to portfolio guidance instead of fabricated school analysis.
- durationMs: `1`
- failures: `0`

### 003-columbia-optional-en FAIL

- Columbia should surface as test-optional in the current policy contract.
- durationMs: `0`
- failures: `1`
  - [block] contract: (0 , import_utils.resolveSchoolTestingPolicyValue) is not a function

### 004-no-predictions-en FAIL

- Focus schools without predictions should resolve to noPredictions instead of fabricating certainty.
- durationMs: `0`
- failures: `1`
  - [block] contract: (0 , import_utils.resolveSchoolTestingPolicyValue) is not a function

### 005-insufficient-profile-en PASS

- Thin profiles should degrade to insufficientProfileData without pretending school-level confidence.
- durationMs: `1`
- failures: `0`

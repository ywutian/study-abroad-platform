# Application Analysis Research

Date: 2026-04-09
Owner: Codex implementation batch

## Goal

Define the product bar for `GET /profiles/me/ai-analysis` using competitor patterns and primary-source research, then translate that bar into concrete platform rules.

## External Benchmarks

### CollegeVine

Source: [Is CollegeVine’s Chancing Engine Actually Accurate?](https://blog.collegevine.com/is-collegevine-chancing-accurate/)

What matters:

- CollegeVine positions its chancing product around calibrated probability and scenario-style personalization, not only GPA/SAT thresholds.
- The product explicitly explains which factors it does and does not consider.
- Its reach/target/safety framing makes the tool useful for portfolio strategy instead of raw scoring only.

Product implication:

- Our application analysis should keep probability in the product, but probability alone is not enough.
- We should explicitly show evidence quality, missing context, and portfolio balance so users do not over-read a single score.

### Empowerly

Sources:

- [Empowerly Score](https://empowerly.com/empowerly-score/)
- [Empowerly technology overview](https://empowerly.com/our-technology/)

What matters:

- Empowerly frames its score as a holistic readiness signal spanning academics, extracurriculars, essays, and planning.
- It emphasizes scenario discussion, strengths/weaknesses, and actionable next steps.
- It repeatedly clarifies that the score is not a guarantee.

Product implication:

- Our application analysis should read like consultant output, not a gamified readiness widget.
- We should preserve weak-state messaging and separate evidence completeness from competitiveness.

### IvyWise

Source: [Initial Consultation](https://www.ivywise.com/admissions-counseling/initial-consultation/)

What matters:

- IvyWise sells a detailed pre-screen, a 90-minute consultation, a strategic action plan, a testing plan, and tailored profile-building recommendations.
- Their consultation flow explicitly includes list building, summer plans, extracurricular direction, and timeline strategy.

Product implication:

- Our canonical analysis needs phased action plans and school-list diagnosis, not only four-dimension profile commentary.
- Recommendations should be tied to stated goals and profile context.

### Crimson Education

Sources:

- [Consultation page](https://www.crimsoneducation.org/ap/campaigns/idn-crimson-results)
- [Team structure page](https://www.crimsoneducation.org/sg/thank-you/crimson-education-ptc-typ-v2)

What matters:

- Crimson markets former admissions officer review, profile-gap diagnosis, and roadmap planning.
- The consultation is framed as clarifying strengths, gaps, and next steps rather than producing a single deterministic grade.

Product implication:

- Our analysis should surface candidacy judgment, top gaps, and next actions per school.

## Research Findings

### Avoid Naviance-style anchoring

Sources:

- [Tomkins et al., PNAS, 2023](https://pubmed.ncbi.nlm.nih.gov/37903250/)
- [Harvard Kennedy School summary](https://www.hks.harvard.edu/publications/showing-high-achieving-college-applicants-past-admissions-outcomes-increases)

Finding:

- The paper reports that exposing high-achieving students to historical admissions outcomes increased application undermatching by more than 50%.

Product implication:

- We should not present historical averages or scatterplot-style evidence as destiny.
- Historical evidence should be contextualized as directional support, not the main decision primitive.

### Learned models can help, but only as decision support

Source: [Lee et al., L@S 2023](https://arxiv.org/abs/2302.03610)

Finding:

- A learned model using broader application features outperformed an SAT-based heuristic on a selective-institution dataset, but the authors frame the system as support for human decision-making.

Product implication:

- Prediction should remain the probability layer.
- Application analysis should synthesize strategy around the prediction instead of inventing a second probability engine in the LLM layer.

### Text can restore signal and also reintroduce sensitive proxies

Sources:

- [Alvero et al., AIES 2020](https://arxiv.org/abs/1912.09318)
- [Lee et al., 2023 essay/recommendation NLP study](https://arxiv.org/abs/2306.17575)

Finding:

- Text features from essays and recommendation letters can improve prediction performance, but they can also carry protected-attribute signal and do not safely replace explicit fairness-aware design.

Product implication:

- Essays and recommendations may inform evidence-backed commentary, but they should not be silently collapsed into a black-box total score.
- The system should prefer transparent evidence fields and weak-state messaging when text evidence is absent.

### Testing strategy must remain explicit in test-optional contexts

Source: [Cornell Task Force Summary, April 2024](https://irp.dpb.cornell.edu/wp-content/uploads/2024/04/Test-Score-Task-Force-update-release.pdf)

Finding:

- Cornell reported that in its test-optional colleges, score submission had a substantial and statistically significant impact on admission chances, and framed score submission itself as a strategy choice.

Product implication:

- `testStrategy` belongs in the canonical application analysis response.
- School-aware next steps should distinguish between submit and test-optional paths where the evidence supports it.

## Product Decisions Implemented In This Batch

### Canonical contract

- `GET /profiles/me/ai-analysis` is the single structured application-analysis endpoint.
- Web Profile, web `uncommon-app`, mobile `/profile`, mobile `/profile/analysis`, and the mobile `/prediction` CTA all consume the same shared `AIAnalysisResult`.
- The old `uncommon-app` markdown/regex parsing path is removed for profile analysis.

### Evidence stack

- `SchoolListItem` is the sole target-school source.
- Prediction remains the sole probability/tier source.
- LLM output is restricted to synthesis: summary, school-level explanation, action plan, and recommendations.

### Strategy layer outputs

- `meta` exposes state, evidence quality, and generation metadata.
- `portfolioAnalysis` exposes list balance, missing rounds, and missing predictions.
- `targetSchoolInsights[]` exposes school-specific difficulty, strengths, gaps, next actions, historical signals, and `policyContext`.
- `actionPlan` is phased into `now`, `next90Days`, and `beforeSubmission`.

### Policy context implemented in v1

- `targetSchoolInsights[].policyContext.testingPolicy` is explicit: `REQUIRED | OPTIONAL | BLIND | UNKNOWN`.
- `targetSchoolInsights[].policyContext.intlAidPolicy` is explicit: `NEED_BLIND | NEED_AWARE | UNKNOWN`.
- `targetSchoolInsights[].policyContext.roundContext` is explicit: `ED | ED2 | EA | REA | RD | UC | UNKNOWN`.
- UC campuses are treated as first-class `BLIND` schools in the backend instead of being folded into generic `testOptional` behavior.

### Three-version closure status

- `V1 active`: canonical web + mobile consumer loop, structured `policyContext`, weak states, and school-aware strategy output are implemented.
- `V2 active governance`: evidence-review / candidate / shadow / activate / rollback governance for application analysis is now routed through `/admin/application-analysis-workflow`, and applicant runtime consumes only `ACTIVE` policy plus approved evidence.
- `V3 capability-gated runtime`: recourse, strategy uncertainty, and fairness disclosure now exist as additive applicant-facing fields behind capability-scoped experiment versions and feature flags; rollout still depends on `SHADOW -> CANARY -> ACTIVE` promotion and can be retired independently per capability.

### Guardrails

- No historical-average-as-destiny UI.
- No fabricated school insight when profile or prediction evidence is weak.
- No silent fallback to markdown parsing.
- Cache key includes locale and evidence freshness inputs.

## Source Index

- CollegeVine: [blog.collegevine.com/is-collegevine-chancing-accurate](https://blog.collegevine.com/is-collegevine-chancing-accurate/)
- Empowerly Score: [empowerly.com/empowerly-score](https://empowerly.com/empowerly-score/)
- Empowerly Technology: [empowerly.com/our-technology](https://empowerly.com/our-technology/)
- IvyWise Initial Consultation: [ivywise.com/admissions-counseling/initial-consultation](https://www.ivywise.com/admissions-counseling/initial-consultation/)
- Crimson consultation messaging: [crimsoneducation.org/ap/campaigns/idn-crimson-results](https://www.crimsoneducation.org/ap/campaigns/idn-crimson-results)
- Crimson team structure: [crimsoneducation.org/sg/thank-you/crimson-education-ptc-typ-v2](https://www.crimsoneducation.org/sg/thank-you/crimson-education-ptc-typ-v2)
- Tomkins et al. 2023: [pubmed.ncbi.nlm.nih.gov/37903250](https://pubmed.ncbi.nlm.nih.gov/37903250/)
- Lee et al. 2023 learned model: [arxiv.org/abs/2302.03610](https://arxiv.org/abs/2302.03610)
- Alvero et al. 2020: [arxiv.org/abs/1912.09318](https://arxiv.org/abs/1912.09318)
- Lee et al. 2023 NLP review: [arxiv.org/abs/2306.17575](https://arxiv.org/abs/2306.17575)
- Cornell testing summary: [irp.dpb.cornell.edu/wp-content/uploads/2024/04/Test-Score-Task-Force-update-release.pdf](https://irp.dpb.cornell.edu/wp-content/uploads/2024/04/Test-Score-Task-Force-update-release.pdf)

# Remediation Roadmap

1. Stop all outward-facing quantified accuracy claims until verified sample threshold and gate requirements are met.
2. Unify truth source policy so calibration, drift monitoring, training data, and dashboards all read the same verified canonical outcome set.
3. Split reporting by `source` and `modelVersion`, with quick-match reported independently from main prediction.
4. Recalibrate the final served probability after all deterministic modifiers, or refactor modifiers upstream into the calibrated model input.
5. Replace admin “overallAccuracy” proxy with verified-sample-aware Brier, ECE, and calibration visualizations.
6. Supply a read-only production CSV export and rerun this audit to populate real source/version/round/cohort accuracy tables.

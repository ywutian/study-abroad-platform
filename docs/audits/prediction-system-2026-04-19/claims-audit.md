# Claims Audit

| Severity | Disposition      | Summary                                                                      | File                                                                                 |
| -------- | ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| P1       | 需立即下线或替换 | 认证页直接宣称 95% 预测准确率                                                | apps/web/src/messages/zh.json:579                                                    |
| P1       | 需立即下线或替换 | Auth page claims 95% prediction accuracy                                     | apps/web/src/messages/en.json:579                                                    |
| P1       | 需立即下线或替换 | FAQ 将预测准确率表述为 95% 以上                                              | apps/web/src/messages/zh.json:3460                                                   |
| P1       | 需立即下线或替换 | FAQ says prediction accuracy is over 95%                                     | apps/web/src/messages/en.json:3465                                                   |
| P2       | 需降级表述       | Landing page markets calibrated probabilities as inherently more trustworthy | apps/web/src/messages/en.json:296                                                    |
| P2       | 需降级表述       | 落地页把“持续校准的模型”包装成更可信概率                                     | apps/web/src/messages/zh.json:296                                                    |
| P2       | 需降级表述       | Admin overallAccuracy 是 bucket 中点误差近似值，不是正式 accuracy metric     | apps/web/src/app/[locale]/(main)/admin/calibrations/\_components/overview-tab.tsx:94 |
| P3       | 可保留           | 推荐页已区分个人预估机会和学校整体录取率                                     | apps/web/src/messages/zh.json:4791                                                   |
| P3       | 可保留           | Recommendation copy distinguishes school-wide rate from personal chance      | apps/web/src/messages/en.json:4796                                                   |

## Notes

- auth-accuracy-zh: 当前仓库 verified outcome 样本数为 0，且 SOP 规定 verified < 200 不得对外宣称已验证准确率。 (apps/web/src/messages/zh.json:579)
- auth-accuracy-en: The claim is unsupported by current verified-outcome inventory and contradicts the closed-loop SOP threshold. (apps/web/src/messages/en.json:579)
- faq-accuracy-zh: FAQ answer overstates verified accuracy and should be replaced with a capability description or a gated statement tied to verified sample thresholds. (apps/web/src/messages/zh.json:3460)
- faq-accuracy-en: This is outward-facing marketing copy that currently has no verified sample support in the repo baseline. (apps/web/src/messages/en.json:3465)
- landing-calibration-en: This quality framing should be downgraded until calibration quality is backed by verified-sample evidence. (apps/web/src/messages/en.json:296)
- landing-calibration-zh: 在 verified gate 未通过前，这类文案应保持能力描述，而不是可信度承诺。 (apps/web/src/messages/zh.json:296)
- admin-overall-accuracy: This should stay internal and be labeled as an approximate calibration proxy, not “accuracy”. (apps/web/src/app/[locale]/(main)/admin/calibrations/\_components/overview-tab.tsx:94)
- recommendation-disclaimer-zh: This disclaimer is directionally correct and should remain visible because recommendation is not the formal prediction-accuracy surface. (apps/web/src/messages/zh.json:4791)
- recommendation-disclaimer-en: This is the right boundary for recommendation and should remain part of the product narrative. (apps/web/src/messages/en.json:4796)

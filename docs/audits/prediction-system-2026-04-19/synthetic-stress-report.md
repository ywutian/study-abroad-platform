# Synthetic Stress Report

| Check                                                 | Passed | Detail                                                  |
| ----------------------------------------------------- | ------ | ------------------------------------------------------- |
| 单调性 / Elite private                                | PASS   | 概率序列: 5% -> 5% -> 5% -> 6.1%                        |
| 单调性 / Highly selective                             | PASS   | 概率序列: 5% -> 5% -> 5% -> 12.1%                       |
| 单调性 / Selective                                    | CHECK  | 概率序列: 5.7% -> 5% -> 13.9% -> 24.2%                  |
| 单调性 / Broad access                                 | CHECK  | 概率序列: 22.2% -> 22% -> 45.6% -> 54.9%                |
| 选择性方向 / Sparse profile / missing critical inputs | PASS   | 从最难到最易的概率序列: 5% -> 5% -> 5.7% -> 22.2%       |
| 选择性方向 / Baseline applicant                       | PASS   | 从最难到最易的概率序列: 5% -> 5% -> 5% -> 22%           |
| 选择性方向 / Competitive applicant                    | PASS   | 从最难到最易的概率序列: 5% -> 5% -> 13.9% -> 45.6%      |
| 选择性方向 / Elite applicant                          | PASS   | 从最难到最易的概率序列: 6.1% -> 12.1% -> 24.2% -> 54.9% |
| 轮次敏感性 / RD EA ED                                 | PASS   | RD 5%, EA 5.5%, ED 6.8%                                 |
| 缺失数据韧性 / confidence 降级                        | CHECK  | sparse=medium, rich=high                                |
| 稳定性 / 重复运行一致                                 | PASS   | 重复 5 次输出: 5, 5, 5, 5, 5                            |

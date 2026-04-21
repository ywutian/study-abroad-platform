# External Baseline

## Official Sources

| Source                    | Use                                                                                                                          | URL                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| College Scorecard API     | Official admissions-rate and test-score baseline for school-level spot checks.                                               | [link](https://collegescorecard.ed.gov/data/api/)   |
| IPEDS                     | Official federal postsecondary data system; validates institution-level data provenance and coverage.                        | [link](https://nces.ed.gov/ipeds/Home)              |
| Common Data Set           | Common schema for institution-published admissions and enrollment details, often needed for fields not exposed in Scorecard. | [link](https://commondataset.org/)                  |
| Stanford CDS / IR example | Example school-operated institutional research page for manual round/intl-context checks.                                    | [link](https://irds.stanford.edu/data-findings/cds) |

## Scorecard Spot Check

| School                                | Internal match                        | Official acceptance | Internal acceptance | Delta  |
| ------------------------------------- | ------------------------------------- | ------------------- | ------------------- | ------ |
| Stanford University                   | Stanford University                   | 3.61%               | 3.7%                | 0.09%  |
| Harvard University                    | Harvard University                    | 3.65%               | 3.4%                | -0.25% |
| Massachusetts Institute of Technology | Massachusetts Institute of Technology | 4.55%               | 4%                  | -0.55% |
| University of California-Los Angeles  | University of California, Los Angeles | 8.97%               | 8.6%                | -0.37% |
| University of Michigan-Ann Arbor      | University of Michigan, Ann Arbor     | 15.64%              | 17.7%               | 2.06%  |

## Coverage Notes

- College Scorecard gives an official, automatable school-level baseline for overall admission rates and test-score ranges.
- IPEDS and school-run CDS/IR pages remain necessary for fields the repo tracks but Scorecard does not expose well, such as round-specific or international-only context.
- This baseline is for metadata sanity checking, not for prediction truth labels.

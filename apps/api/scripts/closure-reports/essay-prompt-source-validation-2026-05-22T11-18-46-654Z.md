# Essay Prompt Source Validation Packet

Status: SOURCE_VALIDATION_PACKET_READY
Generated at: 2026-05-22T11:19:06.029Z
Source recovery: scripts/closure-reports/essay-prompt-source-recovery-2026-05-22T11-18-13-836Z.json

## Summary

- School offset: 0
- Eligible schools: 77
- Checked schools: 10
- Checked candidates: 30
- Reachable HTML candidates: 17
- Validated candidates for review: 0
- Prompt-match candidates: 0
- Linked source candidates: 20
- Blocked/failed candidates: 13

## Review Contract

- Fetched prompt matches are review candidates, not accepted facts.
- Do not write `EssayPromptSource` rows or expose prompts publicly from this packet alone.
- Accepted evidence still needs source family, raw snapshot, cycle year, confidence, and review status.

## Validated Candidate Rows

| School | Matches | Source | Action |
| --- | ---: | --- | --- |
| None | 0 | n/a | refine-source-search |

## Linked Source Candidate Rows

| School | Link Score | Linked Source | Reasons |
| --- | ---: | --- | --- |
| Emory University | 61 | https://apply.emory.edu/apply/faq.html | prompt-or-question\|apply |
| Princeton University | 61 | https://admission.princeton.edu/apply/princeton-specific-questions | prompt-or-question\|apply |
| Princeton University | 61 | https://admission.princeton.edu/apply/princeton-specific-questions | prompt-or-question\|apply |
| Emory University | 46 | https://www.commonapp.org/explore/emory-university#Common%20Application | common-app\|apply |
| Pennsylvania State University | 46 | https://www.commonapp.org/explore/penn-state | common-app\|apply |
| Carleton College | 45 | https://www.carleton.edu/admissions/connect/ | prompt-or-question |
| Emory University | 45 | https://www.youvisit.com/tour/oxford/139900?pl=v&m_prompt=1 | prompt-or-question |
| Williams College | 45 | https://catalog.williams.edu/thea/detail/?strm=1261&cn=266&crsid=021721&req_year=26 | writing |
| Princeton University | 36 | https://admission.princeton.edu/apply/princeton-specific-questions/transfer-essay-questions | essay\|supplement\|prompt-or-question\|apply\|transfer-lower-priority |
| Princeton University | 36 | https://admission.princeton.edu/apply/princeton-specific-questions/transfer-essay-questions | essay\|supplement\|prompt-or-question\|apply\|transfer-lower-priority |
| Emory University | 34 | https://apply.emory.edu/apply/first-year/application-status.html | first-year-admission\|apply |
| Emory University | 34 | https://apply.emory.edu/apply/first-year/index.html | first-year-admission\|apply |
| Emory University | 34 | https://apply.emory.edu/apply/first-year/plans-deadlines/index.html | first-year-admission\|apply |
| Emory University | 34 | https://apply.emory.edu/apply/first-year/tips/index.html | first-year-admission\|apply |
| Emory University | 34 | https://apply.emory.edu/apply/first-year/tips/standardized-exam-policies.html#Emory%20Test%20Optional%20Policy | first-year-admission\|apply |
| Emory University | 34 | https://apply.emory.edu/apply/first-year/tips/standardized-exam-policies.html#standardized%20tests%20here. | first-year-admission\|apply |
| Princeton University | 34 | https://admission.princeton.edu/apply/first-year-application-dates-deadlines | first-year-admission\|apply |
| Princeton University | 34 | https://admission.princeton.edu/apply/first-year-application-dates-deadlines | first-year-admission\|apply |
| Williams College | 34 | https://www.williams.edu/admission-aid/apply/first-year/ | first-year-admission\|apply |
| Emory University | 30 | https://www.commonapp.org/explore/emory-university | common-app |

## Checked Candidate Rows

| School | Fetch | Evidence | Matches | Source |
| --- | --- | --- | ---: | --- |
| University of California, Los Angeles | fetch_failed | blocked_or_fetch_failed | 0 | https://www.ucla.edu/admissions |
| University of California, Los Angeles | reachable_html | reachable_context_only | 0 | https://www.ucla.edu/admission |
| University of California, Los Angeles | reachable_html | reachable_context_only | 0 | https://www.ucla.edu/apply |
| Princeton University | reachable_html | reachable_context_only | 0 | https://www.princeton.edu/admissions |
| Princeton University | reachable_html | reachable_context_only | 0 | https://www.princeton.edu/admission |
| Princeton University | fetch_failed | blocked_or_fetch_failed | 0 | https://www.princeton.edu/apply |
| Emory University | fetch_failed | blocked_or_fetch_failed | 0 | https://www.emory.edu/admissions |
| Emory University | fetch_failed | blocked_or_fetch_failed | 0 | https://www.emory.edu/admission |
| Emory University | reachable_html | reachable_context_only | 0 | https://www.emory.edu/apply |
| Williams College | blocked | blocked_or_fetch_failed | 0 | https://www.williams.edu/admissions |
| Williams College | reachable_html | reachable_context_only | 0 | https://www.williams.edu/admission |
| Williams College | reachable_html | reachable_context_only | 0 | https://www.williams.edu/apply |
| Lehigh University | reachable_html | reachable_context_only | 0 | https://www1.lehigh.edu/admissions |
| Lehigh University | reachable_html | reachable_context_only | 0 | https://www1.lehigh.edu/admission |
| Lehigh University | reachable_html | reachable_context_only | 0 | https://www1.lehigh.edu/apply |
| Pennsylvania State University | reachable_html | reachable_context_only | 0 | https://www.psu.edu/admissions |
| Pennsylvania State University | reachable_html | reachable_context_only | 0 | https://www.psu.edu/admission |
| Pennsylvania State University | reachable_html | reachable_context_only | 0 | https://www.psu.edu/apply |
| University of Pittsburgh | reachable_html | reachable_no_prompt_match | 0 | https://www.pitt.edu/admissions |
| University of Pittsburgh | fetch_failed | blocked_or_fetch_failed | 0 | https://www.pitt.edu/admission |
| University of Pittsburgh | fetch_failed | blocked_or_fetch_failed | 0 | https://www.pitt.edu/apply |
| Stanford University | fetch_failed | blocked_or_fetch_failed | 0 | https://www.stanford.edu/admissions |
| Stanford University | reachable_html | reachable_context_only | 0 | https://www.stanford.edu/admission |
| Stanford University | fetch_failed | blocked_or_fetch_failed | 0 | https://www.stanford.edu/apply |
| Carleton College | reachable_html | reachable_context_only | 0 | https://www.carleton.edu/admissions |
| Carleton College | fetch_failed | blocked_or_fetch_failed | 0 | https://www.carleton.edu/admission |
| Carleton College | fetch_failed | blocked_or_fetch_failed | 0 | https://www.carleton.edu/apply |
| University of Notre Dame | reachable_html | reachable_context_only | 0 | https://www.nd.edu/admissions |
| University of Notre Dame | fetch_failed | blocked_or_fetch_failed | 0 | https://www.nd.edu/admission |
| University of Notre Dame | fetch_failed | blocked_or_fetch_failed | 0 | https://www.nd.edu/apply |


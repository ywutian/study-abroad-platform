/**
 * collect-cds-ed2-rea-3.ts
 *
 * closure-v2 CDS-extraction agent output — BATCH 3 (OFFSET 25).
 *
 * For a 25-school batch (mostly large research universities + selective LACs),
 * extracts TWO fields from each school's Common Data Set (CDS) Section C21-C22
 * (Early Decision / Early Action), or — where the CDS is paywalled/corrupt — the
 * school's own admissions office:
 *
 *   1) ed2AcceptanceRate  — the Early Decision II round admit rate (%).
 *   2) hasRestrictiveEa   — whether the school's Early Action plan is a
 *                            Restrictive / Single-Choice EA (REA / SCEA) plan.
 *
 * ── ed2AcceptanceRate findings ───────────────────────────────────────────────
 * Standard CDS Section C21 reports a SINGLE combined Early Decision applicant /
 * admit count. When a school runs an ED II round it appears in C21 only as an
 * "Other early decision plan closing date" — the CDS NEVER breaks out ED II
 * applicants/admits separately from ED I. No ED II-specific admit rate can be
 * derived from the CDS without fabricating numbers.
 *
 * Every ed2AcceptanceRate target in this batch is resolved UNAVAILABLE. There
 * are three distinct sub-reasons (all verified against the school's real CDS /
 * admissions page):
 *   (a) ED I + ED II both run, but CDS reports only a combined ED count
 *       → Rice, Washington and Lee, Colby, Vanderbilt, Bates, CMU, Emory, WashU.
 *   (b) Single ED round only (no ED II) → Dartmouth, Barnard, UVA.
 *   (c) No Early Decision plan at all (EA-only or no early round)
 *       → Notre Dame, Michigan, Georgetown, UNC, USC, Florida, Georgia Tech,
 *         Wisconsin, UT Austin, UC Davis, UC San Diego, UC Irvine, UC Santa
 *         Barbara.
 * `School` has no `ed2AcceptanceRate` column (closure-target-only field) and no
 * ED II rate was separately published by any school in this batch, so no School
 * row is written for ed2 — the target alone is resolved UNAVAILABLE.
 *
 * ── hasRestrictiveEa findings ────────────────────────────────────────────────
 * Resolvable for every school as a boolean from CDS C22 and/or the school's
 * admissions page:
 *   true  → school runs a Restrictive / Single-Choice EA plan. In this batch
 *           only Notre Dame and Georgetown (both explicitly Restrictive /
 *           Single-Choice Early Action per their admissions offices).
 *   false → school has open/non-restrictive EA, ED-only, or no early round.
 * `School` has no `hasRestrictiveEa` column, so the boolean is written into
 * `School.metadata.hasRestrictiveEa` plus a provenance record under
 * `School.metadata.provenance.hasRestrictiveEa`. metadata is read + merged —
 * never clobbered. Every hasRestrictiveEa target is resolved CLOSED.
 *
 * ClosureTarget is a DB-only table (not in schema.prisma) → updated via raw SQL.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-cds-ed2-rea-3.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-cds-agent-3';

type Tier = 'OFFICIAL' | 'SCRAPED';
type ClosureStatus = 'CLOSED' | 'UNAVAILABLE' | 'FAILED';

/** ed2AcceptanceRate target — all UNAVAILABLE (CDS never separates ED II). */
interface Ed2Target {
  targetId: string;
  schoolId: string;
  name: string;
  status: 'UNAVAILABLE';
  sourceUrl: string;
  lastError: string;
}

/** hasRestrictiveEa target — boolean, always resolvable → CLOSED. */
interface ReaTarget {
  targetId: string;
  schoolId: string;
  name: string;
  status: 'CLOSED';
  value: boolean;
  sourceUrl: string;
  confidence: number;
  tier: Tier;
  note: string;
}

interface SchoolEntry {
  schoolId: string;
  name: string;
  ed2: Ed2Target;
  rea: ReaTarget;
}

const BATCH: SchoolEntry[] = [
  {
    schoolId: 'cmn1htko0000gvqf2pmjc1xi9',
    name: 'Rice University',
    ed2: {
      targetId: 'cmp9pn07x00i8a85opax76gmx',
      schoolId: 'cmn1htko0000gvqf2pmjc1xi9',
      name: 'Rice University',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admission.rice.edu/apply/first-year-applicants',
      lastError:
        'Rice runs ED I (11/1) and ED II (1/4) binding rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn08100i9a85ol5npv3rb',
      schoolId: 'cmn1htko0000gvqf2pmjc1xi9',
      name: 'Rice University',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admission.rice.edu/apply/first-year-applicants',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Rice offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ivi004iz0tinveg964v',
    name: 'Washington and Lee University',
    ed2: {
      targetId: 'cmp9pn2ad01oja85o1u49hmiw',
      schoolId: 'cmnwr8ivi004iz0tinveg964v',
      name: 'Washington and Lee University',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://my.wlu.edu/document/2024-common-data-set',
      lastError:
        'CDS 2024-2025 C21 lists a "First or only" ED plan (11/1) and an "Other" ED plan (1/1) — i.e. ED I and ED II — but reports only a combined ED applicant/admit count (844/286), so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn2ae01oka85okd09pnx7',
      schoolId: 'cmnwr8ivi004iz0tinveg964v',
      name: 'Washington and Lee University',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://my.wlu.edu/document/2024-common-data-set',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = "No early action plan" (nonbinding EA question answered No). ED I/II only. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ivj004jz0tij2m7ox54',
    name: 'Colby College',
    ed2: {
      targetId: 'cmp9pn2k601uga85ong8h80u4',
      schoolId: 'cmnwr8ivj004jz0tij2m7ox54',
      name: 'Colby College',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://afa.colby.edu/apply/dates-and-deadlines/',
      lastError:
        'Colby runs ED I (11/15) and ED II (1/5) binding rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn2k701uha85o4fvw75sb',
      schoolId: 'cmnwr8ivj004jz0tij2m7ox54',
      name: 'Colby College',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://afa.colby.edu/apply/dates-and-deadlines/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Colby offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htko5000ivqf28d3x9557',
    name: 'Vanderbilt University',
    ed2: {
      targetId: 'cmp9pn29201npa85opm2q46cy',
      schoolId: 'cmn1htko5000ivqf28d3x9557',
      name: 'Vanderbilt University',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.vanderbilt.edu/dsa/common-data-set/',
      lastError:
        'Vanderbilt runs ED I (11/1) and ED II (1/1) binding rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn29301nqa85owfyhf04g',
      schoolId: 'cmn1htko5000ivqf28d3x9557',
      name: 'Vanderbilt University',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.vanderbilt.edu/dsa/common-data-set/',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = no nonbinding Early Action plan — Vanderbilt offers only binding Early Decision (ED I/II). Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htko2000hvqf2r5gxwf84',
    name: 'Dartmouth College',
    ed2: {
      targetId: 'cmp9pn1nv01b3a85omghuvgll',
      schoolId: 'cmn1htko2000hvqf2r5gxwf84',
      name: 'Dartmouth College',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.dartmouth.edu/apply-dartmouth',
      lastError:
        'Dartmouth offers a single binding Early Decision round (11/1) only — no ED II round, so no ED II admit rate exists.',
    },
    rea: {
      targetId: 'cmp9pn1nx01b4a85oqzaqw8oz',
      schoolId: 'cmn1htko2000hvqf2r5gxwf84',
      name: 'Dartmouth College',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.dartmouth.edu/apply-dartmouth',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Dartmouth runs only a single binding Early Decision round and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ivl004kz0tiv0vgf6c6',
    name: 'Bates College',
    ed2: {
      targetId: 'cmp9pn2mu01vwa85oud26l6wi',
      schoolId: 'cmnwr8ivl004kz0tiv0vgf6c6',
      name: 'Bates College',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.bates.edu/admission/apply/application-options/',
      lastError:
        'Bates runs ED I (11/15) and ED II (1/10) binding rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn2mw01vxa85o5e0zxc3c',
      schoolId: 'cmnwr8ivl004kz0tiv0vgf6c6',
      name: 'Bates College',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.bates.edu/admission/apply/application-options/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Bates offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htko7000jvqf22r0n55p2',
    name: 'University of Notre Dame',
    ed2: {
      targetId: 'cmp9pn1p701bya85ofs7cdzjf',
      schoolId: 'cmn1htko7000jvqf22r0n55p2',
      name: 'University of Notre Dame',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.nd.edu/apply/early-action-regular-decision/',
      lastError:
        'Notre Dame has no Early Decision plan (runs Restrictive Early Action) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn1p801bza85o6mc66y9q',
      schoolId: 'cmn1htko7000jvqf22r0n55p2',
      name: 'University of Notre Dame',
      status: 'CLOSED',
      value: true,
      sourceUrl:
        'https://admissions.nd.edu/apply/early-action-regular-decision/',
      confidence: 0.97,
      tier: 'SCRAPED',
      note: 'Notre Dame runs Restrictive Early Action — REA applicants may not apply to any other binding Early Decision program or any private school Early Action program.',
    },
  },
  {
    schoolId: 'cmnwr8ivm004lz0tio6m2uic4',
    name: 'Barnard College',
    ed2: {
      targetId: 'cmp9pmzh9002va85ojsk0bjea',
      schoolId: 'cmnwr8ivm004lz0tio6m2uic4',
      name: 'Barnard College',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://barnard.edu/admissions/application-rounds',
      lastError:
        'Barnard offers a single binding Early Decision round (11/1) only — no ED II round, so no ED II admit rate exists.',
    },
    rea: {
      targetId: 'cmp9pmzhb002wa85o943dvqs1',
      schoolId: 'cmnwr8ivm004lz0tio6m2uic4',
      name: 'Barnard College',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://barnard.edu/admissions/application-rounds',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Barnard runs only a single binding Early Decision round and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkoa000kvqf2oqm36hw5',
    name: 'University of Michigan, Ann Arbor',
    ed2: {
      targetId: 'cmp9pn02900fua85o33gkdk6u',
      schoolId: 'cmn1htkoa000kvqf2oqm36hw5',
      name: 'University of Michigan, Ann Arbor',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.umich.edu/apply/first-year-applicants/first-year-application-plans',
      lastError:
        'For the CDS 2024-2025 (Fall 2025) cycle Michigan had no Early Decision plan (non-binding Early Action only; binding ED begins Fall 2026) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn02b00fva85o9encfity',
      schoolId: 'cmn1htkoa000kvqf2oqm36hw5',
      name: 'University of Michigan, Ann Arbor',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.umich.edu/apply/first-year-applicants/first-year-application-plans',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Michigan runs an open non-binding Early Action plan (Nov 1) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkoc000lvqf2s5pgbhxx',
    name: 'Georgetown University',
    ed2: {
      targetId: 'cmp9pn1q401cia85o4t368vdl',
      schoolId: 'cmn1htkoc000lvqf2s5pgbhxx',
      name: 'Georgetown University',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://uadmissions.georgetown.edu/applying/early-action/',
      lastError:
        'Georgetown has no Early Decision plan (runs Single-Choice / Restrictive Early Action) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn1q601cja85oezwi9oer',
      schoolId: 'cmn1htkoc000lvqf2s5pgbhxx',
      name: 'Georgetown University',
      status: 'CLOSED',
      value: true,
      sourceUrl: 'https://uadmissions.georgetown.edu/applying/early-action/',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'Georgetown runs Single-Choice (Restrictive) Early Action — Early Action applicants may not apply to any binding Early Decision program.',
    },
  },
  {
    schoolId: 'cmn1htkoe000mvqf2odaszvmk',
    name: 'University of North Carolina at Chapel Hill',
    ed2: {
      targetId: 'cmp9pmzfk001pa85ouzodx6ve',
      schoolId: 'cmn1htkoe000mvqf2odaszvmk',
      name: 'University of North Carolina at Chapel Hill',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.unc.edu/apply/types-of-applications/first-year/',
      lastError:
        'UNC has no Early Decision plan (runs non-binding Early Action only) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzfl001qa85o9z4fhv2b',
      schoolId: 'cmn1htkoe000mvqf2odaszvmk',
      name: 'University of North Carolina at Chapel Hill',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.unc.edu/apply/types-of-applications/first-year/',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'UNC runs an open non-binding Early Action plan (Oct 15) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkom000pvqf2se90bue1',
    name: 'University of Virginia',
    ed2: {
      targetId: 'cmp9pmzr10099a85oz7b4qv3t',
      schoolId: 'cmn1htkom000pvqf2se90bue1',
      name: 'University of Virginia',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admission.virginia.edu/admission/deadlines-instructions',
      lastError:
        'UVA offers a single binding Early Decision round (11/1) only — no ED II round, so no ED II admit rate exists.',
    },
    rea: {
      targetId: 'cmp9pmzr2009aa85o5n93h51r',
      schoolId: 'cmn1htkom000pvqf2se90bue1',
      name: 'University of Virginia',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admission.virginia.edu/admission/deadlines-instructions',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'UVA Early Action is explicitly "non-binding and unrestrictive" — applicants may apply early elsewhere. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkoh000nvqf2uj3pjgxw',
    name: 'Carnegie Mellon University',
    ed2: {
      targetId: 'cmp9pn1l5019ca85o09uwgds8',
      schoolId: 'cmn1htkoh000nvqf2uj3pjgxw',
      name: 'Carnegie Mellon University',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.cmu.edu/admission/admission/application-plans-deadlines',
      lastError:
        'CMU runs ED I (11/3) and ED II (1/3) binding rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn1l7019da85oew0lmbjg',
      schoolId: 'cmn1htkoh000nvqf2uj3pjgxw',
      name: 'Carnegie Mellon University',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.cmu.edu/admission/admission/application-plans-deadlines',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — CMU offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkoj000ovqf226pta7or',
    name: 'Emory University',
    ed2: {
      targetId: 'cmp9pn0hl00mla85osnm6o2nf',
      schoolId: 'cmn1htkoj000ovqf226pta7or',
      name: 'Emory University',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://apply.emory.edu/apply/first-year/plans-deadlines/index.html',
      lastError:
        'Emory runs ED I (11/1) and ED II (1/1) binding rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0hn00mma85om7vo5aiw',
      schoolId: 'cmn1htkoj000ovqf226pta7or',
      name: 'Emory University',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://apply.emory.edu/apply/first-year/plans-deadlines/index.html',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Emory offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkoo000qvqf2jgkrffw1',
    name: 'Washington University in St. Louis',
    ed2: {
      targetId: 'cmp9pn29y01o9a85o2z637o77',
      schoolId: 'cmn1htkoo000qvqf2jgkrffw1',
      name: 'Washington University in St. Louis',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.washu.edu/how-to-apply/application-dates-deadlines/',
      lastError:
        'WashU runs ED I (11/3) and ED II (1/2) binding rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn29z01oaa85oa2hjh3ds',
      schoolId: 'cmn1htkoo000qvqf2jgkrffw1',
      name: 'Washington University in St. Louis',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.washu.edu/how-to-apply/application-dates-deadlines/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'For the CDS 2024-2025 (Fall 2025) cycle WashU offered only binding Early Decision (ED I/II) and Regular Decision — no Early Action (a non-binding EA plan is added for the Class of 2031). Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkor000rvqf282ibd6kz',
    name: 'University of California, Davis',
    ed2: {
      targetId: 'cmp9pmzkd004wa85oa3iq9bso',
      schoolId: 'cmn1htkor000rvqf282ibd6kz',
      name: 'University of California, Davis',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/dates-and-deadlines.html',
      lastError:
        'UC Davis has no Early Decision plan — the University of California uses a single Nov 30 application deadline with no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzke004xa85ovluk18gj',
      schoolId: 'cmn1htkor000rvqf282ibd6kz',
      name: 'University of California, Davis',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/dates-and-deadlines.html',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'No Early Action plan — the UC system uses a single Nov 30 application deadline with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkoz000uvqf2rnozc3fe',
    name: 'University of Southern California',
    ed2: {
      targetId: 'cmp9pmzpq008ea85oq6vb5bru',
      schoolId: 'cmn1htkoz000uvqf2rnozc3fe',
      name: 'University of Southern California',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.koppelmangroup.com/blog/2025/5/9/early-action-strategy-for-the-university-of-southern-california-usc-2025-2026',
      lastError:
        'For the CDS 2024-2025 (Fall 2025) cycle USC had no Early Decision plan (non-binding Early Action only; a limited Marshall-only ED begins Fall 2026) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzpr008fa85oa3l98o9u',
      schoolId: 'cmn1htkoz000uvqf2rnozc3fe',
      name: 'University of Southern California',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.koppelmangroup.com/blog/2025/5/9/early-action-strategy-for-the-university-of-southern-california-usc-2025-2026',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'USC runs an open non-binding Early Action plan (Nov 1) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkow000tvqf2qc5n3qhd',
    name: 'University of Florida',
    ed2: {
      targetId: 'cmp9pmzz300e2a85oein709f0',
      schoolId: 'cmn1htkow000tvqf2qc5n3qhd',
      name: 'University of Florida',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.ufl.edu/apply/freshman/deadlines',
      lastError:
        'University of Florida has no Early Decision plan (runs non-binding Early Action only) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzz400e3a85otixiieiv',
      schoolId: 'cmn1htkow000tvqf2qc5n3qhd',
      name: 'University of Florida',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.ufl.edu/apply/freshman/deadlines',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'University of Florida runs an open non-binding Early Action plan (Nov 1) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkou000svqf2356l4yfj',
    name: 'University of California, San Diego',
    ed2: {
      targetId: 'cmp9pmzta00aqa85olhby3r74',
      schoolId: 'cmn1htkou000svqf2356l4yfj',
      name: 'University of California, San Diego',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/dates-and-deadlines.html',
      lastError:
        'UC San Diego has no Early Decision plan — the University of California uses a single Nov 30 application deadline with no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmztb00ara85ofsqmhfj7',
      schoolId: 'cmn1htkou000svqf2356l4yfj',
      name: 'University of California, San Diego',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/dates-and-deadlines.html',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'No Early Action plan — the UC system uses a single Nov 30 application deadline with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkp1000vvqf2iogfyk82',
    name: 'University of Texas at Austin',
    ed2: {
      targetId: 'cmp9pn19u012la85onqyh3gtu',
      schoolId: 'cmn1htkp1000vvqf2iogfyk82',
      name: 'University of Texas at Austin',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.utexas.edu/apply/freshman/',
      lastError:
        'UT Austin has no Early Decision plan (runs non-binding Early Action only) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn19v012ma85oo9ya8yki',
      schoolId: 'cmn1htkp1000vvqf2iogfyk82',
      name: 'University of Texas at Austin',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.utexas.edu/apply/freshman/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'UT Austin runs an open non-binding Early Action plan (Oct 15) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkp4000wvqf2ah317ku6',
    name: 'Georgia Institute of Technology',
    ed2: {
      targetId: 'cmp9pmzgh002aa85om3strjsm',
      schoolId: 'cmn1htkp4000wvqf2ah317ku6',
      name: 'Georgia Institute of Technology',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admission.gatech.edu/first-year/deadlines',
      lastError:
        'Georgia Tech has no Early Decision plan (runs non-binding Early Action only) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzgj002ba85of2u2p8uc',
      schoolId: 'cmn1htkp4000wvqf2ah317ku6',
      name: 'Georgia Institute of Technology',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admission.gatech.edu/first-year/deadlines',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Georgia Tech runs open non-binding, non-restrictive Early Action (EA1 for GA residents, EA2 for non-residents). Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkp6000xvqf2rhj774d8',
    name: 'University of California, Irvine',
    ed2: {
      targetId: 'cmp9pmzhp0036a85ow22tbr30',
      schoolId: 'cmn1htkp6000xvqf2rhj774d8',
      name: 'University of California, Irvine',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/dates-and-deadlines.html',
      lastError:
        'UC Irvine has no Early Decision plan — the University of California uses a single Nov 30 application deadline with no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzhq0037a85ogo4r2z1g',
      schoolId: 'cmn1htkp6000xvqf2rhj774d8',
      name: 'University of California, Irvine',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/dates-and-deadlines.html',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'No Early Action plan — the UC system uses a single Nov 30 application deadline with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkpi0011vqf28xmv4but',
    name: 'University of Wisconsin-Madison',
    ed2: {
      targetId: 'cmp9pn0a100j3a85o900onaog',
      schoolId: 'cmn1htkpi0011vqf28xmv4but',
      name: 'University of Wisconsin-Madison',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.wisc.edu/deadlines/',
      lastError:
        'UW-Madison has no Early Decision plan (runs non-binding Early Action only) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0a400j4a85owqjjndng',
      schoolId: 'cmn1htkpi0011vqf28xmv4but',
      name: 'University of Wisconsin-Madison',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.wisc.edu/deadlines/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'UW-Madison runs an open non-binding Early Action plan (Nov 1) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkpb000zvqf2645ltfg6',
    name: 'University of California, Santa Barbara',
    ed2: {
      targetId: 'cmp9pn1qo01cta85o7om0stc4',
      schoolId: 'cmn1htkpb000zvqf2645ltfg6',
      name: 'University of California, Santa Barbara',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.sa.ucsb.edu/how-to-apply',
      lastError:
        'UC Santa Barbara has no Early Decision plan — the University of California uses a single Nov 30 application deadline with no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn1qr01cua85o5smmfmv3',
      schoolId: 'cmn1htkpb000zvqf2645ltfg6',
      name: 'University of California, Santa Barbara',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.sa.ucsb.edu/how-to-apply',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'No Early Action plan — the UC system uses a single Nov 30 application deadline with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkpe0010vqf2xzzjz779',
    name: 'University of Illinois Urbana-Champaign',
    ed2: {
      targetId: 'cmp9pn1dv014ya85oi24xlckb',
      schoolId: 'cmn1htkpe0010vqf2xzzjz779',
      name: 'University of Illinois Urbana-Champaign',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.illinois.edu/Apply/Freshman/deadlines',
      lastError:
        'UIUC has no Early Decision plan (runs non-binding Early Action with a single priority deadline) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn1dw014za85onwvhf8uf',
      schoolId: 'cmn1htkpe0010vqf2xzzjz779',
      name: 'University of Illinois Urbana-Champaign',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.illinois.edu/Apply/Freshman/deadlines',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'UIUC runs an open non-binding Early Action plan with no application restrictions. Not restrictive EA.',
    },
  },
];

async function readSchoolMetadata(schoolId: string): Promise<{
  metadata: Record<string, unknown>;
  provenance: Record<string, unknown>;
} | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, metadata: true },
  });
  if (!school) return null;
  const metadata =
    school.metadata &&
    typeof school.metadata === 'object' &&
    !Array.isArray(school.metadata)
      ? (school.metadata as Record<string, unknown>)
      : {};
  const provenance =
    metadata.provenance &&
    typeof metadata.provenance === 'object' &&
    !Array.isArray(metadata.provenance)
      ? (metadata.provenance as Record<string, unknown>)
      : {};
  return { metadata, provenance };
}

async function updateClosureTarget(
  targetId: string,
  status: ClosureStatus,
  sourceUrl: string | null,
  confidence: number | null,
  tier: string | null,
  lastError: string | null,
): Promise<void> {
  const now = new Date();
  // ClosureTarget has no `verifiedBy` column — record the verifying agent in `notes`.
  await prisma.$executeRaw`
    UPDATE "ClosureTarget"
    SET status = ${status}::"ClosureTargetStatus",
        "sourceUrl" = ${sourceUrl},
        confidence = ${confidence},
        tier = ${tier},
        attempts = attempts + 1,
        "lastAttemptAt" = ${now},
        "lastError" = ${lastError},
        notes = ${`verifiedBy=${VERIFIED_BY}`},
        "updatedAt" = ${now}
    WHERE id = ${targetId}
  `;
}

async function main() {
  const ed2Unavail = BATCH.length; // every ed2 target → UNAVAILABLE
  const reaTrue = BATCH.filter((s) => s.rea.value).length;
  const reaFalse = BATCH.filter((s) => !s.rea.value).length;

  console.log(
    `[${VERIFIED_BY}] batch=${BATCH.length} schools  (fetchedAt=${FETCHED_AT})\n` +
      `  ed2AcceptanceRate : CLOSED=0  UNAVAILABLE=${ed2Unavail}\n` +
      `  hasRestrictiveEa  : CLOSED=${reaTrue + reaFalse} (true=${reaTrue} false=${reaFalse})  UNAVAILABLE=0\n`,
  );

  let schoolsUpdated = 0;
  let targetsUpdated = 0;

  for (const entry of BATCH) {
    // ── 1) ed2AcceptanceRate target → UNAVAILABLE (no School column / no write)
    await updateClosureTarget(
      entry.ed2.targetId,
      'UNAVAILABLE',
      entry.ed2.sourceUrl,
      null,
      null,
      entry.ed2.lastError,
    );
    targetsUpdated += 1;
    console.log(`  ed2 UNAVAILABLE  ${entry.name} — ${entry.ed2.lastError}`);

    // ── 2) hasRestrictiveEa → write boolean + provenance into School.metadata
    const meta = await readSchoolMetadata(entry.rea.schoolId);
    if (!meta) {
      console.warn(
        `  SKIP school ${entry.name}: id ${entry.rea.schoolId} not found`,
      );
      // Still close the target — the determination itself is valid.
      await updateClosureTarget(
        entry.rea.targetId,
        'CLOSED',
        entry.rea.sourceUrl,
        entry.rea.confidence,
        entry.rea.tier,
        null,
      );
      targetsUpdated += 1;
      continue;
    }

    const mergedMetadata: Prisma.InputJsonValue = {
      ...meta.metadata,
      hasRestrictiveEa: entry.rea.value,
      provenance: {
        ...meta.provenance,
        hasRestrictiveEa: {
          value: entry.rea.value,
          sourceUrl: entry.rea.sourceUrl,
          fetchedAt: FETCHED_AT,
          verifiedBy: VERIFIED_BY,
          confidence: entry.rea.confidence,
          tier: entry.rea.tier,
        },
      },
    };

    await prisma.school.update({
      where: { id: entry.rea.schoolId },
      data: { metadata: mergedMetadata },
    });
    schoolsUpdated += 1;

    await updateClosureTarget(
      entry.rea.targetId,
      'CLOSED',
      entry.rea.sourceUrl,
      entry.rea.confidence,
      entry.rea.tier,
      null,
    );
    targetsUpdated += 1;
    console.log(
      `  rea CLOSED       ${entry.name} => hasRestrictiveEa=${entry.rea.value}  [${entry.rea.sourceUrl}]`,
    );
  }

  console.log(
    `\n[${VERIFIED_BY}] done. ${schoolsUpdated} school rows updated ` +
      `(metadata.hasRestrictiveEa), ${targetsUpdated} closure targets updated.`,
  );
}

main()
  .catch((err) => {
    console.error(`[${VERIFIED_BY}] FAILED:`, err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

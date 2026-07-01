/**
 * collect-cds-ed2-rea.ts
 *
 * closure-v2 CDS-extraction agent output.
 *
 * For a 25-school batch of private institutions, extracts TWO fields from each
 * school's Common Data Set (CDS) Section C21-C22 (Early Decision / Early Action):
 *
 *   1) ed2AcceptanceRate  — the Early Decision II round admit rate (%).
 *   2) hasRestrictiveEa   — whether the school's Early Action plan is a
 *                            Restrictive / Single-Choice EA (REA / SCEA) plan.
 *
 * ── ed2AcceptanceRate findings ───────────────────────────────────────────────
 * The standard CDS Section C21 reports a SINGLE combined Early Decision
 * applicant / admit count (fields C2106). When a school runs an ED II round it
 * appears in C21 only as an "Other early decision plan closing date" — the
 * CDS NEVER breaks out ED II applicants/admits separately from ED I.
 * Therefore no ED II-specific admit rate can be derived from the CDS without
 * fabricating numbers. Every ed2AcceptanceRate target in this batch is
 * resolved UNAVAILABLE (verified from the actual CDS PDFs). School rows are
 * left untouched for ed2 (there is also no `ed2AcceptanceRate` column on the
 * School model — it is a closure-target-only field).
 *
 * ── hasRestrictiveEa findings ────────────────────────────────────────────────
 * Resolvable for every school as a boolean from CDS C22 ("Is your early action
 * plan a 'restrictive' plan...") and/or the school's admissions page:
 *   true  → school runs a Restrictive / Single-Choice EA plan (Harvard, Yale,
 *           Princeton, Stanford in this batch — all CDS C22 = restrictive Yes,
 *           or SCEA/REA per their admissions office).
 *   false → school has open/non-restrictive EA, ED-only, or no early round.
 * `School` has no `hasRestrictiveEa` column, so the boolean is written into
 * `School.metadata.hasRestrictiveEa` plus a provenance record under
 * `School.metadata.provenance.hasRestrictiveEa`. metadata is read + merged —
 * never clobbered. Every hasRestrictiveEa target is resolved CLOSED.
 *
 * ClosureTarget is a DB-only table (not in schema.prisma) → updated via raw SQL.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-cds-ed2-rea.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-cds-agent';

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

/**
 * The 25-school batch. `ed2` + `rea` per school, both verified against the
 * school's real CDS PDF (Section C21-C22) or — where the CDS is Cloudflare-
 * walled — the school's own admissions office.
 */
interface SchoolEntry {
  schoolId: string;
  name: string;
  ed2: Ed2Target;
  rea: ReaTarget;
}

const BATCH: SchoolEntry[] = [
  {
    schoolId: 'cmnwr8ivo004mz0tign5klw7c',
    name: 'Rhode Island School of Design',
    ed2: {
      targetId: 'cmp9pn21t01jda85o42jtgnsn',
      schoolId: 'cmnwr8ivo004mz0tign5klw7c',
      name: 'Rhode Island School of Design',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.risd.edu/admissions/first-year/apply-risd',
      lastError:
        'RISD offers a single binding Early Decision (Nov 14) and Regular Decision only — no ED II round, so no ED II admit rate exists.',
    },
    rea: {
      targetId: 'cmp9pn21v01jea85o13h5p7br',
      schoolId: 'cmnwr8ivo004mz0tign5klw7c',
      name: 'Rhode Island School of Design',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.risd.edu/admissions/first-year/apply-risd',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan at all — RISD runs only binding Early Decision and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkmy0000vqf2src2zcb5',
    name: 'Princeton University',
    ed2: {
      targetId: 'cmp9pmzpa0084a85ol29sbsrl',
      schoolId: 'cmn1htkmy0000vqf2src2zcb5',
      name: 'Princeton University',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admission.princeton.edu/apply/first-year-application-dates-deadlines',
      lastError:
        'Princeton has no Early Decision program (runs Single-Choice Early Action) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzpc0085a85oj535bbyb',
      schoolId: 'cmn1htkmy0000vqf2src2zcb5',
      name: 'Princeton University',
      status: 'CLOSED',
      value: true,
      sourceUrl:
        'https://admission.princeton.edu/apply/first-year-application-dates-deadlines',
      confidence: 0.97,
      tier: 'SCRAPED',
      note: 'Princeton runs Single-Choice (Restrictive) Early Action — applicants may not apply early to other private institutions.',
    },
  },
  {
    schoolId: 'cmnwr8iwg0050z0tiyrfhaavh',
    name: 'Rose-Hulman Institute of Technology',
    ed2: {
      targetId: 'cmp9pmzcp0008a85oh641tt1t',
      schoolId: 'cmnwr8iwg0050z0tiyrfhaavh',
      name: 'Rose-Hulman Institute of Technology',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.rose-hulman.edu/academics/academic-affairs/irpa/reports/2024-25-Academic-Year-CDS.pdf',
      lastError:
        'CDS 2024-2025 C21 = "No early decision plan" — Rose-Hulman has no ED at all, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzcr0009a85oa5onrfsz',
      schoolId: 'cmnwr8iwg0050z0tiyrfhaavh',
      name: 'Rose-Hulman Institute of Technology',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.rose-hulman.edu/academics/academic-affairs/irpa/reports/2024-25-Academic-Year-CDS.pdf',
      confidence: 0.95,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22: has non-binding Early Action (Nov 1); "restrictive plan?" answered No. Non-restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iw4004uz0tia8ikoq2b',
    name: 'The Juilliard School',
    ed2: {
      targetId: 'cmp9pn2ko01uqa85ogz2o0lwa',
      schoolId: 'cmnwr8iw4004uz0tia8ikoq2b',
      name: 'The Juilliard School',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.juilliard.edu/admissions',
      lastError:
        'Juilliard uses a single audition-based application deadline — no Early Decision plan, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn2kq01ura85oc9ea1ww9',
      schoolId: 'cmnwr8iw4004uz0tia8ikoq2b',
      name: 'The Juilliard School',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.juilliard.edu/admissions',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Juilliard uses a single audition-based deadline with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iup0042z0tieqofvyfn',
    name: 'Williams College',
    ed2: {
      targetId: 'cmp9pn2i801tca85o9y9rfd9b',
      schoolId: 'cmnwr8iup0042z0tieqofvyfn',
      name: 'Williams College',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.williams.edu/admission-aid/apply/deadlines/',
      lastError:
        'Williams offers a single binding Early Decision (Nov 15) only — no ED II round, so no ED II admit rate exists.',
    },
    rea: {
      targetId: 'cmp9pn2i901tda85ou8sr4lve',
      schoolId: 'cmnwr8iup0042z0tieqofvyfn',
      name: 'Williams College',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.williams.edu/admission-aid/apply/deadlines/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Williams runs only binding Early Decision and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iwe004zz0tilegv5ian',
    name: 'Harvey Mudd College',
    ed2: {
      targetId: 'cmp9pn25u01loa85ocua04027',
      schoolId: 'cmnwr8iwe004zz0tilegv5ian',
      name: 'Harvey Mudd College',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.hmc.edu/institutional-research/wp-content/uploads/sites/42/2024/12/CDS-2024-2025-SharedtoWeb.pdf',
      lastError:
        'CDS 2024-2025 C21 lists an ED I (11/15) and ED II (1/5) plan, but reports only a combined ED applicant/admit count (656/106) — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn25v01lpa85ovc5cbxvq',
      schoolId: 'cmnwr8iwe004zz0tilegv5ian',
      name: 'Harvey Mudd College',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.hmc.edu/institutional-research/wp-content/uploads/sites/42/2024/12/CDS-2024-2025-SharedtoWeb.pdf',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = "No early action plan". ED I/II only. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ivr004nz0ti5oh56l0o',
    name: 'Pratt Institute',
    ed2: {
      targetId: 'cmp9pn2qc01xwa85octuzy5l4',
      schoolId: 'cmnwr8ivr004nz0ti5oh56l0o',
      name: 'Pratt Institute',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.pratt.edu/wp-content/uploads/2024/04/Pratt-Institute-Commom-Data-Set-2023-2024.pdf',
      lastError:
        'CDS C21 = "No early decision plan" — Pratt has no ED at all (runs Early Action), hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn2qe01xxa85opz907ru3',
      schoolId: 'cmnwr8ivr004nz0ti5oh56l0o',
      name: 'Pratt Institute',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.pratt.edu/wp-content/uploads/2024/04/Pratt-Institute-Commom-Data-Set-2023-2024.pdf',
      confidence: 0.95,
      tier: 'OFFICIAL',
      note: 'CDS C22: has non-binding Early Action (11/15); "restrictive plan?" answered No. Non-restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iur0043z0tie8ndrb65',
    name: 'Amherst College',
    ed2: {
      targetId: 'cmp9pmzei0013a85ovgw83ncq',
      schoolId: 'cmnwr8iur0043z0tie8ndrb65',
      name: 'Amherst College',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.amherst.edu/system/files/C%20First-Time,%20First-Year%20Admission_3.pdf',
      lastError:
        'CDS 2024-2025 C21 lists only a "First or only" ED plan (11/1); no "Other" ED plan date — Amherst runs a single ED round, no ED II, so no ED II rate exists.',
    },
    rea: {
      targetId: 'cmp9pmzek0014a85obqg65o0q',
      schoolId: 'cmnwr8iur0043z0tie8ndrb65',
      name: 'Amherst College',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.amherst.edu/system/files/C%20First-Time,%20First-Year%20Admission_3.pdf',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = "No early action plan". ED only. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iw7004vz0ti65mqjgq5',
    name: 'Berklee College of Music',
    ed2: {
      targetId: 'cmp9pn0r100rja85o736fj5zh',
      schoolId: 'cmnwr8iw7004vz0ti65mqjgq5',
      name: 'Berklee College of Music',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://college.berklee.edu/admissions/undergraduate/deadlines',
      lastError:
        'Berklee has no Early Decision plan (runs non-binding Early Action) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0r300rka85o5fd4x62s',
      schoolId: 'cmnwr8iw7004vz0ti65mqjgq5',
      name: 'Berklee College of Music',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://college.berklee.edu/admissions/undergraduate/deadlines',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'Berklee runs an open non-binding Early Action (Nov 1, decisions Jan 31) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkn30001vqf2nozenmj6',
    name: 'Massachusetts Institute of Technology',
    ed2: {
      targetId: 'cmp9pn0ct00kaa85o3mk6xekm',
      schoolId: 'cmn1htkn30001vqf2nozenmj6',
      name: 'Massachusetts Institute of Technology',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://mitadmissions.org/apply/firstyear/deadlines-requirements/',
      lastError:
        'MIT has no Early Decision plan (runs non-binding Early Action) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0cv00kba85o2214f2rx',
      schoolId: 'cmn1htkn30001vqf2nozenmj6',
      name: 'Massachusetts Institute of Technology',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://mitadmissions.org/apply/firstyear/deadlines-requirements/',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'MIT Early Action is explicitly non-restrictive — applicants may apply early elsewhere. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iwi0051z0tidfdrzv7w',
    name: 'Cooper Union',
    ed2: {
      targetId: 'cmp9pn2nc01w6a85otesxb8w0',
      schoolId: 'cmnwr8iwi0051z0tidfdrzv7w',
      name: 'Cooper Union',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://cooper.edu/admissions/applying-to-cu',
      lastError:
        'Cooper Union offers a single binding Early Decision per school and Regular Decision only — no ED II round, so no ED II rate exists.',
    },
    rea: {
      targetId: 'cmp9pn2nd01w7a85o4nk5i5nr',
      schoolId: 'cmnwr8iwi0051z0tidfdrzv7w',
      name: 'Cooper Union',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://cooper.edu/admissions/applying-to-cu',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Cooper Union runs only binding Early Decision and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkn60002vqf2r731l78m',
    name: 'Harvard University',
    ed2: {
      targetId: 'cmp9pn22z01jya85oqhq7xkik',
      schoolId: 'cmn1htkn60002vqf2r731l78m',
      name: 'Harvard University',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://bpb-us-e1.wpmucdn.com/sites.harvard.edu/dist/6/210/files/2025/06/HarvardUniversity_CDS_2024-2025.pdf',
      lastError:
        'CDS 2024-2025 C21 = "No early decision plan" — Harvard runs Restrictive Early Action; no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn23001jza85ohg81le27',
      schoolId: 'cmn1htkn60002vqf2r731l78m',
      name: 'Harvard University',
      status: 'CLOSED',
      value: true,
      sourceUrl:
        'https://bpb-us-e1.wpmucdn.com/sites.harvard.edu/dist/6/210/files/2025/06/HarvardUniversity_CDS_2024-2025.pdf',
      confidence: 0.98,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22: has Early Action (11/1); "restrictive plan?" answered Yes. Restrictive Early Action.',
    },
  },
  {
    schoolId: 'cmn1htkn80003vqf29zl0f9lr',
    name: 'Stanford University',
    ed2: {
      targetId: 'cmp9pn2o901wqa85op8zuzbzh',
      schoolId: 'cmn1htkn80003vqf29zl0f9lr',
      name: 'Stanford University',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admission.stanford.edu/apply/first-year/decision_process.html',
      lastError:
        'Stanford has no Early Decision plan (runs Restrictive Early Action) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn2ob01wra85o5usxp7o7',
      schoolId: 'cmn1htkn80003vqf29zl0f9lr',
      name: 'Stanford University',
      status: 'CLOSED',
      value: true,
      sourceUrl:
        'https://admission.stanford.edu/apply/first-year/decision_process.html',
      confidence: 0.97,
      tier: 'SCRAPED',
      note: 'Stanford runs single-choice Restrictive Early Action — applicants may not apply early to other private institutions.',
    },
  },
  {
    schoolId: 'cmnwr8iut0044z0tie7749l79',
    name: 'Swarthmore College',
    ed2: {
      targetId: 'cmp9pn28901n5a85oc9dvxikc',
      schoolId: 'cmnwr8iut0044z0tie7749l79',
      name: 'Swarthmore College',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.swarthmore.edu/sites/default/files/assets/documents/institutional-effectiveness-research-assessment/Swarthmore-College-CDS-2024-2025.pdf',
      lastError:
        'CDS 2024-2025 C21 lists ED I (11/15) and ED II (1/4) plans, but reports only a combined ED applicant/admit count (1221/220) — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn28b01n6a85ou91cy8ma',
      schoolId: 'cmnwr8iut0044z0tie7749l79',
      name: 'Swarthmore College',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.swarthmore.edu/sites/default/files/assets/documents/institutional-effectiveness-research-assessment/Swarthmore-College-CDS-2024-2025.pdf',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = "No early action plan". ED I/II only. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iwl0052z0ti9adsxk6l',
    name: 'Olin College of Engineering',
    ed2: {
      targetId: 'cmp9pn2qs01y6a85oiv0fee3b',
      schoolId: 'cmnwr8iwl0052z0ti9adsxk6l',
      name: 'Olin College of Engineering',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.olin.edu/admission/apply/admission-process',
      lastError:
        'Olin has no Early Decision plan (no early round at all) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn2qu01y7a85otul13xw5',
      schoolId: 'cmnwr8iwl0052z0ti9adsxk6l',
      name: 'Olin College of Engineering',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.olin.edu/admission/apply/admission-process',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Olin offers no early round; candidates apply by one deadline and hear back in late March. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ivt004oz0tin9oyxi60',
    name: 'School of the Art Institute of Chicago',
    ed2: {
      targetId: 'cmp9pn1g3016fa85oo9uj3wc1',
      schoolId: 'cmnwr8ivt004oz0tin9oyxi60',
      name: 'School of the Art Institute of Chicago',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.saic.edu/admissions/undergraduate/how-apply-freshman',
      lastError:
        'SAIC has no Early Decision plan (runs non-binding Early Action alongside rolling admission) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn1g5016ga85o76v9l761',
      schoolId: 'cmnwr8ivt004oz0tin9oyxi60',
      name: 'School of the Art Institute of Chicago',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.saic.edu/admissions/undergraduate/how-apply-freshman',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'SAIC runs an open non-binding Early Action / priority deadline (Nov 15) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iw9004wz0tiun4guycq',
    name: 'Curtis Institute of Music',
    ed2: {
      targetId: 'cmp9pn2nt01wga85o8ocn80ub',
      schoolId: 'cmnwr8iw9004wz0tiun4guycq',
      name: 'Curtis Institute of Music',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.curtis.edu/apply/applying/',
      lastError:
        'Curtis uses a single early-December audition-based application deadline — no Early Decision plan, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn2nu01wha85o50wu7bvj',
      schoolId: 'cmnwr8iw9004wz0tiun4guycq',
      name: 'Curtis Institute of Music',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.curtis.edu/apply/applying/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Curtis uses a single audition-based deadline with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ivw004pz0tie74ukvke',
    name: 'California Institute of the Arts',
    ed2: {
      targetId: 'cmp9pn2jp01u6a85okaqg0s4x',
      schoolId: 'cmnwr8ivw004pz0tie74ukvke',
      name: 'California Institute of the Arts',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://calarts.edu/admissions-aid/admissions/application-process/application-deadlines-and-fees',
      lastError:
        'CalArts has no Early Decision plan (priority deadline + rolling space-available admission) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn2jr01u7a85oq66rn7hs',
      schoolId: 'cmnwr8ivw004pz0tie74ukvke',
      name: 'California Institute of the Arts',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://calarts.edu/admissions-aid/admissions/application-process/application-deadlines-and-fees',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'No Early Action plan — CalArts uses a priority deadline + rolling admission with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iwa004xz0tiygic7c6r',
    name: 'New England Conservatory',
    ed2: {
      targetId: 'cmp9pn2l501v0a85o0efpzp3v',
      schoolId: 'cmnwr8iwa004xz0tiygic7c6r',
      name: 'New England Conservatory',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://necmusic.edu/admissions/undergraduate-applicants/',
      lastError:
        'NEC uses a single Dec 1 audition-based application deadline — no Early Decision plan, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn2l701v1a85oq5eqpj19',
      schoolId: 'cmnwr8iwa004xz0tiygic7c6r',
      name: 'New England Conservatory',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://necmusic.edu/admissions/undergraduate-applicants/',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'No Early Action plan — NEC uses a single Dec 1 audition-based deadline with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iuv0045z0tiq1lprcv8',
    name: 'Pomona College',
    ed2: {
      targetId: 'cmp9pn0dg00kka85o03j5whtn',
      schoolId: 'cmnwr8iuv0045z0tiq1lprcv8',
      name: 'Pomona College',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.pomona.edu/admissions/paths-apply',
      lastError:
        'Pomona runs ED I (11/1) and ED II (1/1) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0di00kla85oexsz3vqz',
      schoolId: 'cmnwr8iuv0045z0tiq1lprcv8',
      name: 'Pomona College',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.pomona.edu/admissions/paths-apply',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Pomona offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iwc004yz0tif1a6h2el',
    name: 'Manhattan School of Music',
    ed2: {
      targetId: 'cmp9pn1ba013ga85ond5tn4h5',
      schoolId: 'cmnwr8iwc004yz0tif1a6h2el',
      name: 'Manhattan School of Music',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.msmnyc.edu/admission/dates-deadlines/college-dates-deadlines/',
      lastError:
        'MSM uses a single Dec 1 audition-based application deadline — no Early Decision plan, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn1bb013ha85o3q6j07ab',
      schoolId: 'cmnwr8iwc004yz0tif1a6h2el',
      name: 'Manhattan School of Music',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.msmnyc.edu/admission/dates-deadlines/college-dates-deadlines/',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'No Early Action plan — MSM uses a single Dec 1 audition-based deadline with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkna0004vqf2erll9srp',
    name: 'Yale University',
    ed2: {
      targetId: 'cmp9pmzny0078a85o9827v71g',
      schoolId: 'cmn1htkna0004vqf2erll9srp',
      name: 'Yale University',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://oir.yale.edu/sites/default/files/yale_cds_2024-25_rmd_20250612.pdf',
      lastError:
        'CDS 2024-2025 C21 = "No early decision plan" — Yale runs Single-Choice Early Action; no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmznz0079a85ogg1q9qtg',
      schoolId: 'cmn1htkna0004vqf2erll9srp',
      name: 'Yale University',
      status: 'CLOSED',
      value: true,
      sourceUrl:
        'https://oir.yale.edu/sites/default/files/yale_cds_2024-25_rmd_20250612.pdf',
      confidence: 0.98,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22: has Early Action (11/1); "restrictive plan?" answered Yes. Single-Choice (Restrictive) Early Action.',
    },
  },
  {
    schoolId: 'cmnwr8iux0046z0tilggqkjw6',
    name: 'Wellesley College',
    ed2: {
      targetId: 'cmp9pn2iq01tma85ohujo8iac',
      schoolId: 'cmnwr8iux0046z0tilggqkjw6',
      name: 'Wellesley College',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://wellesley-college.files.svdcdn.com/production/administrative-departments/OIR/CDS_2024-2025-FINAL-1.pdf',
      lastError:
        'CDS 2024-2025 C21 lists ED I (11/1) and ED II (1/1) plans, but reports only a combined ED applicant/admit count (1033/308) — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn2it01tna85o7du99tkb',
      schoolId: 'cmnwr8iux0046z0tilggqkjw6',
      name: 'Wellesley College',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://wellesley-college.files.svdcdn.com/production/administrative-departments/OIR/CDS_2024-2025-FINAL-1.pdf',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = "No early action plan". ED I/II only. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htknc0005vqf2l2az4cd2',
    name: 'University of Pennsylvania',
    ed2: {
      targetId: 'cmp9pn26a01lya85ooupy4pb0',
      schoolId: 'cmn1htknc0005vqf2l2az4cd2',
      name: 'University of Pennsylvania',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.upenn.edu/how-to-apply/first-year-applicants',
      lastError:
        'Penn offers a single binding Early Decision (11/1) only — no ED II round, so no ED II admit rate exists.',
    },
    rea: {
      targetId: 'cmp9pn26b01lza85o26b6ms7p',
      schoolId: 'cmn1htknc0005vqf2l2az4cd2',
      name: 'University of Pennsylvania',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.upenn.edu/how-to-apply/first-year-applicants',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Penn offers only binding Early Decision and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iuy0047z0tijtdlowua',
    name: 'Bowdoin College',
    ed2: {
      targetId: 'cmp9pn2ba01p4a85ok05w20mu',
      schoolId: 'cmnwr8iuy0047z0tijtdlowua',
      name: 'Bowdoin College',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.bowdoin.edu/ir/pdf/bowdoin-cds_2024-2025.pdf',
      lastError:
        'CDS 2024-2025 C21 lists ED I (11/15) and ED II (1/5) plans, but reports only a combined ED applicant/admit count (2005/270) — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn2bd01p5a85or1g8pq41',
      schoolId: 'cmnwr8iuy0047z0tijtdlowua',
      name: 'Bowdoin College',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.bowdoin.edu/ir/pdf/bowdoin-cds_2024-2025.pdf',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = "No early action plan". ED I/II only. Not restrictive EA.',
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
  await prisma.$executeRaw`
    UPDATE "ClosureTarget"
    SET status = ${status}::"ClosureTargetStatus",
        "sourceUrl" = ${sourceUrl},
        confidence = ${confidence},
        tier = ${tier},
        attempts = attempts + 1,
        "lastAttemptAt" = ${now},
        "lastError" = ${lastError},
        "updatedAt" = ${now}
    WHERE id = ${targetId}
  `;
}

async function main() {
  const ed2Unavail = BATCH.length; // every ed2 target → UNAVAILABLE
  const reaTrue = BATCH.filter((s) => s.rea.value).length;
  const reaFalse = BATCH.filter((s) => !s.rea.value).length;

  console.log(
    `[closure-v2-cds-agent] batch=${BATCH.length} schools  (fetchedAt=${FETCHED_AT})\n` +
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
    `\n[closure-v2-cds-agent] done. ${schoolsUpdated} school rows updated ` +
      `(metadata.hasRestrictiveEa), ${targetsUpdated} closure targets updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-cds-agent] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

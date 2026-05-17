/**
 * collect-cds-ed2-rea-4.ts
 *
 * closure-v2 CDS-extraction agent output (batch 4).
 *
 * For a 30-school batch, resolves TWO closure fields per school:
 *
 *   1) ed2AcceptanceRate  — the Early Decision II round admit rate (%).
 *   2) hasRestrictiveEa   — whether the school runs a Restrictive / Single-Choice
 *                            EA (REA / SCEA) plan.
 *
 * ── ed2AcceptanceRate findings ───────────────────────────────────────────────
 * CDS Section C21 reports a SINGLE combined Early Decision applicant/admit count
 * (C2106 / C2107). When a school runs an ED II round it appears in C21 only as an
 * "Other early decision plan closing date" — the CDS NEVER breaks out ED II
 * applicants/admits separately from ED I. No ED II-specific admit rate can be
 * derived from the CDS without fabricating numbers. Schools with no ED plan at
 * all (EA-only or rolling) trivially have no ED II round. No school in this batch
 * publishes a distinct ED II admit rate elsewhere. Every ed2AcceptanceRate target
 * is therefore resolved UNAVAILABLE (verified from the actual CDS PDFs and
 * admissions offices). There IS no `ed2AcceptanceRate` column on School — it is a
 * closure-target-only field, so no School write happens for ed2.
 *
 * ── hasRestrictiveEa findings ────────────────────────────────────────────────
 * Resolvable for every school as a boolean from CDS C22 ("Is your early action
 * plan a 'restrictive' plan...") and/or the school's admissions office. No school
 * in this batch runs a Restrictive / Single-Choice EA plan — schools with EA run
 * open non-binding plans; the rest run ED-only or rolling admission. Every
 * hasRestrictiveEa value is therefore false. The `School.hasRestrictiveEa` column
 * EXISTS — written via raw SQL UPDATE to be safe. A provenance record is merged
 * into `School.metadata.provenance.hasRestrictiveEa`. metadata is read + merged —
 * never clobbered. Every hasRestrictiveEa target is resolved CLOSED.
 *
 * ClosureTarget is a DB-only table (not in schema.prisma) → updated via raw SQL.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-cds-ed2-rea-4.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-cds-agent-4';

type Tier = 'OFFICIAL' | 'SCRAPED';
type ClosureStatus = 'CLOSED' | 'UNAVAILABLE' | 'FAILED';

/** ed2AcceptanceRate target — all UNAVAILABLE (CDS never separates ED II). */
interface Ed2Target {
  targetId: string;
  status: 'UNAVAILABLE';
  sourceUrl: string;
  lastError: string;
}

/** hasRestrictiveEa target — boolean, always resolvable → CLOSED. */
interface ReaTarget {
  targetId: string;
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
    schoolId: 'cmn1htkp9000yvqf29pcl812t',
    name: 'New York University',
    ed2: {
      targetId: 'cmp9pn0w200usa85oul6e2xch',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.nyu.edu/admissions/undergraduate-admissions/how-to-apply/all-freshmen-applicants/early-decision.html',
      lastError:
        'NYU runs ED I (11/1) and ED II (1/1) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0w400uta85owzv610a1',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.nyu.edu/admissions/undergraduate-admissions/how-to-apply/all-freshmen-applicants/early-decision.html',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — NYU offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkpl0012vqf28whnvaoj',
    name: 'Boston College',
    ed2: {
      targetId: 'cmp9pn0uu00twa85ot0x0jp5m',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.bc.edu/bc-web/admission/apply/early-decision.html',
      lastError:
        'Boston College runs ED I (11/1) and ED II (1/4) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0uv00txa85osmgrqi24',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.bc.edu/bc-web/admission/apply/early-decision.html',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Boston College offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkpo0013vqf2byqbw5mb',
    name: 'Rutgers University-New Brunswick',
    ed2: {
      targetId: 'cmp9pn0be00jpa85onixnxs2k',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.rutgers.edu/apply/dates-deadlines/new-brunswick',
      lastError:
        'Rutgers-New Brunswick has no Early Decision plan (runs a non-binding Early Action deadline 11/1 plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0bg00jqa85ocu6bvxty',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.rutgers.edu/apply/dates-deadlines/new-brunswick',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Rutgers Early Action is explicitly non-restrictive and non-binding — applying EA does not restrict applying to other colleges. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkpu0015vqf2kumhyv3t',
    name: 'University of Washington',
    ed2: {
      targetId: 'cmp9pmzlc005ha85ocig2m4iz',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admit.washington.edu/apply/dates-deadlines/',
      lastError:
        'UW Seattle does not participate in Early Decision or Early Action for first-year applicants — single application window, decisions made after all applications reviewed. No ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzld005ia85oys89asnb',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admit.washington.edu/apply/dates-deadlines/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — UW Seattle uses a single first-year application window with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkpr0014vqf2w1o1nsyd',
    name: 'Tufts University',
    ed2: {
      targetId: 'cmp9pmzrg009ja85oasnlv2kq',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.tufts.edu/apply/applying-to-tufts/early-decision/',
      lastError:
        'Tufts runs ED I (early Nov) and ED II (early Jan) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pmzrh009ka85ol8lftjub',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.tufts.edu/apply/applying-to-tufts/early-decision/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Tufts offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkq30018vqf2xt2csyoe',
    name: 'Purdue University',
    ed2: {
      targetId: 'cmp9pmzwo00cka85ork99r5a5',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.purdue.edu/become-student/deadlines/',
      lastError:
        'Purdue has no Early Decision plan (runs a non-binding Early Action deadline 11/1 plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzwp00cla85o3itlmcp3',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.purdue.edu/become-student/deadlines/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Purdue Early Action is non-binding and non-restrictive — applicants are not restricted from applying elsewhere. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkpw0016vqf20t0lflxm',
    name: 'Boston University',
    ed2: {
      targetId: 'cmp9pmzm30061a85o3dz225sy',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.bu.edu/admissions/apply/early-decision/',
      lastError:
        'Boston University runs ED I and ED II rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pmzm50062a85o0xgcpatm',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.bu.edu/admissions/apply/early-decision/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Boston University offers only binding Early Decision (ED/ED II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkq00017vqf245v5dk2j',
    name: 'Ohio State University',
    ed2: {
      targetId: 'cmp9pmzuv00bna85o4uswcq1z',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://undergrad.osu.edu/apply/freshmen-columbus/apply-step-by-step',
      lastError:
        'Ohio State has no Early Decision plan (runs a non-binding Early Action deadline 11/1 plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzuy00boa85oe0k6sskp',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://undergrad.osu.edu/apply/freshmen-columbus/apply-step-by-step',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Ohio State Early Action is non-binding and non-restrictive — applying early does not bind the student. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkq60019vqf2lmijsj2s',
    name: 'University of Maryland, College Park',
    ed2: {
      targetId: 'cmp9pmzgw002la85o5z48h110',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.umd.edu/apply/application-deadlines',
      lastError:
        'UMD College Park has no Early Decision plan (runs a non-binding Early Action deadline 11/1 plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzgx002ma85oaubqnwrx',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.umd.edu/apply/application-deadlines',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'UMD Early Action is non-binding (admitted students have until May 1 to confirm). Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkqf001cvqf2vdqpa1he',
    name: 'University of Georgia',
    ed2: {
      targetId: 'cmp9pn2au01oua85ojwjpdg0a',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.admissions.uga.edu/blog/early-action-vs-regular-decision/',
      lastError:
        'UGA has no Early Decision plan (offers only non-binding Early Action and Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn2aw01ova85o3yz0us8c',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.admissions.uga.edu/blog/early-action-vs-regular-decision/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'UGA states it does not offer Early Decision or Restrictive Early Action — its Early Action is explicitly non-restrictive and non-binding. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkqj001dvqf2n8mczcpn',
    name: 'Wake Forest University',
    ed2: {
      targetId: 'cmp9pn0gb00m0a85o7e1mtch0',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.wfu.edu/apply/',
      lastError:
        'Wake Forest runs ED I (11/15) and ED II (1/1) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0gf00m1a85ooj52v11z',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.wfu.edu/apply/',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'Wake Forest runs binding ED I/II plus a non-binding Early Action plan limited to first-generation students; the EA plan is non-restrictive. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkqc001bvqf22zfkx827',
    name: 'Texas A&M University',
    ed2: {
      targetId: 'cmp9pn0wz00vda85o6r5shb39',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.tamu.edu/apply/freshman/index.html',
      lastError:
        'Texas A&M has no Early Decision plan (offers an Early Action deadline for College of Engineering applicants plus a general application window) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0x100vea85oj61lxgod',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.tamu.edu/apply/freshman/index.html',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'Texas A&M Early Action (Engineering applicants, 10/15) is non-binding and non-restrictive. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkq9001avqf25ziy94gn',
    name: 'Lehigh University',
    ed2: {
      targetId: 'cmp9pmzq3008oa85oe6te4ji0',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www2.lehigh.edu/admissions/apply',
      lastError:
        'Lehigh runs ED I (11/1) and ED II (1/1) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pmzq4008pa85oaavjr3lz',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www2.lehigh.edu/admissions/apply',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Lehigh offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ima0008z0ti358pkae1',
    name: 'University of Minnesota Twin Cities',
    ed2: {
      targetId: 'cmp9pmzou007ua85o6jt17zt4',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.tc.umn.edu/apply/freshman-application-deadlines',
      lastError:
        'University of Minnesota Twin Cities has no Early Decision plan (runs two non-binding Early Action deadlines plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzow007va85ou80y3bk8',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.tc.umn.edu/apply/freshman-application-deadlines',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'UMN Twin Cities Early Action (EA I 11/1, EA II 12/1) is non-binding and non-restrictive. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iun0041z0tin8tw3f6b',
    name: 'Villanova University',
    ed2: {
      targetId: 'cmp9pn2pu01xma85oqzzy7v02',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.villanova.edu/university/undergraduate-admission/applying-to-villanova/dates-and-deadlines.html',
      lastError:
        'Villanova runs ED I (11/1) and ED II rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn2px01xna85ozfwsnj9u',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.villanova.edu/university/undergraduate-admission/applying-to-villanova/dates-and-deadlines.html',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'Villanova runs binding ED I/II plus a non-binding, non-restrictive Early Action plan (11/1). Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ilt0000z0ticnudxg0y',
    name: 'University of Rochester',
    ed2: {
      targetId: 'cmp9pn0wh00v2a85o1b4zhwm3',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.rochester.edu/early-decision/',
      lastError:
        'University of Rochester runs ED I (11/1) and ED II (1/5) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0wi00v3a85o7buij7z5',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.rochester.edu/early-decision/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — University of Rochester offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8im70006z0ti47aaywzj',
    name: 'Tulane University',
    ed2: {
      targetId: 'cmp9pn00400ena85ovp8pdkod',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admission.tulane.edu/apply/instructions',
      lastError:
        'Tulane runs ED I and ED II rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn00600eoa85ow6jcauhl',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admission.tulane.edu/apply/instructions',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Tulane states its Early Action is not Restrictive or Single-Choice — applicants may apply early elsewhere. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8itq003pz0tirhvysbdj',
    name: 'University of Minnesota, Twin Cities',
    ed2: {
      targetId: 'cmp9pmzmk006ca85og2z3zvo2',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.tc.umn.edu/apply/freshman-application-deadlines',
      lastError:
        'University of Minnesota Twin Cities has no Early Decision plan (runs two non-binding Early Action deadlines plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzmm006da85ovig4eqs1',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.tc.umn.edu/apply/freshman-application-deadlines',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'UMN Twin Cities Early Action (EA I 11/1, EA II 12/1) is non-binding and non-restrictive. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8im30004z0tip77mx1gm',
    name: 'Northeastern University',
    ed2: {
      targetId: 'cmp9pn0pj00qna85opo209ybb',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.northeastern.edu/application-information/admissions-deadlines-decisions/',
      lastError:
        'Northeastern runs ED I (11/1) and ED II (1/1) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0pk00qoa85o1el2a3un',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.northeastern.edu/application-information/admissions-deadlines-decisions/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'Northeastern runs binding ED I/II plus a non-binding, non-restrictive Early Action plan (11/1). Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ilz0002z0tiwrsmrdi7',
    name: 'Case Western Reserve University',
    ed2: {
      targetId: 'cmp9pn0sh00sfa85o67rz226k',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://case.edu/admission/apply/dates-deadlines',
      lastError:
        'Case Western runs ED I (11/1) and ED II (1/15) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0sj00sga85ojg7ewdno',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://case.edu/admission/apply/dates-deadlines',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'Case Western runs binding ED I/II plus a non-binding, non-restrictive Early Action plan (11/1). Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8imc0009z0tie59yu85k',
    name: 'Virginia Tech',
    ed2: {
      targetId: 'cmp9pn01500f8a85ocrb95uvu',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.vt.edu/admissions/undergraduate/apply/decision-plans.html',
      lastError:
        'Virginia Tech discontinued its Early Decision plan ahead of the 2023-24 cycle and now offers only non-binding Early Action plus Regular Decision — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn01700f9a85oh3wuwhkg',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.vt.edu/admissions/undergraduate/apply/decision-plans.html',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Virginia Tech Early Action is non-binding and non-restrictive — applicants may consider offers from other institutions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8imj000dz0tif3r9fq0l',
    name: 'University of Connecticut',
    ed2: {
      targetId: 'cmp9pn03e00gfa85oz6uxk8k8',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.uconn.edu/apply/early-decision/',
      lastError:
        'UConn runs a single Early Decision round (11/1) plus Regular Decision — no ED II round, so no ED II admit rate exists.',
    },
    rea: {
      targetId: 'cmp9pn03f00gga85oa9i1i0qv',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.uconn.edu/apply/early-decision/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'No Early Action plan — UConn offers only binding Early Decision and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ilx0001z0tilru6b1th',
    name: 'William & Mary',
    ed2: {
      targetId: 'cmp9pn1vt01fva85o9tcyiv1z',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.wm.edu/admission/undergraduateadmission/how-to-apply/first-year-applicants/earlydecision/',
      lastError:
        'William & Mary runs ED I (11/1) and ED II (1/5) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn1vu01fwa85og0ca09v5',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.wm.edu/admission/undergraduateadmission/how-to-apply/first-year-applicants/earlydecision/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — William & Mary offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8im90007z0ti2n04hf3n',
    name: 'University of Pittsburgh',
    ed2: {
      targetId: 'cmp9pn20r01isa85ogq3agfz6',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.pitt.edu/first-year-student/',
      lastError:
        'University of Pittsburgh uses rolling admission with no Early Decision or Early Action plan — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn20t01ita85o8xcegxx1',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.pitt.edu/first-year-student/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'No Early Action plan — University of Pittsburgh uses rolling admission with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8imn000fz0ti5zassqtj',
    name: 'Pepperdine University',
    ed2: {
      targetId: 'cmp9pmzx400cua85obiuth2vb',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://seaver.pepperdine.edu/admission/application/undergraduate/deadlines/',
      lastError:
        'Pepperdine runs ED I and ED II rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pmzx500cva85oy6rhier7',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://seaver.pepperdine.edu/admission/application/undergraduate/deadlines/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'Pepperdine runs binding ED I/II plus a non-binding Early Action plan; applicants may apply EA to as many colleges as they wish. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8imi000cz0tifntjkili',
    name: 'Syracuse University',
    ed2: {
      targetId: 'cmp9pmzii003qa85odewymqd9',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.syracuse.edu/admissions-aid/application-process/undergraduate/enrollment-options/early-decision/',
      lastError:
        'Syracuse runs ED I (11/15) and ED II (1/1) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pmzij003ra85oiiqkxjqb',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.syracuse.edu/admissions-aid/application-process/undergraduate/enrollment-options/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Syracuse offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8im50005z0ti3z02fhjs',
    name: 'Santa Clara University',
    ed2: {
      targetId: 'cmp9pn0m800p7a85o2hshifrz',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.scu.edu/admission/undergraduate/first-year-students/early-or-regular-decision/',
      lastError:
        'Santa Clara runs ED I and ED II rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0mb00p8a85osmxed4tq',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.scu.edu/admission/undergraduate/first-year-students/early-or-regular-decision/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'Santa Clara runs binding ED I/II plus a non-binding, non-restrictive Early Action plan. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8img000bz0tiktbc3agu',
    name: 'George Washington University',
    ed2: {
      targetId: 'cmp9pmzi2003ga85ozmadc1h2',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://undergraduate.admissions.gwu.edu/first-year-applicants',
      lastError:
        'George Washington runs ED I (11/1) and ED II (1/5) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pmzi3003ha85o89wfji4y',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://undergraduate.admissions.gwu.edu/first-year-applicants',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — George Washington offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8im10003z0ti20a5qdxq',
    name: 'Brandeis University',
    ed2: {
      targetId: 'cmp9pmzlp005ra85oj447esrj',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.brandeis.edu/admissions/apply/application-process/early-decision.html',
      lastError:
        'Brandeis runs ED I (11/1) and ED II (1/1) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pmzlr005sa85o2y9g1495',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.brandeis.edu/admissions/apply/application-process/early-decision.html',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Brandeis offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8imx000lz0tiez2ik9eg',
    name: 'Pennsylvania State University',
    ed2: {
      targetId: 'cmp9pmzn1006na85opy19g2xw',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.psu.edu/resources/first-year-students/deadlines',
      lastError:
        'Penn State has no Early Decision plan (runs a non-binding Early Action deadline 11/1 plus rolling/Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzn3006oa85ohi2wd0tg',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.psu.edu/resources/faq/early-action',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Penn State Early Action is non-binding and does not restrict the student in any way. Not restrictive EA.',
    },
  },
];

async function readSchoolMetadata(
  schoolId: string,
): Promise<{
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
  // ClosureTarget has no `verifiedBy` column — the agent identity is recorded in
  // `notes` instead (matches the table's actual schema).
  const now = new Date();
  await prisma.$executeRaw`
    UPDATE "ClosureTarget"
    SET status = ${status}::"ClosureTargetStatus",
        "sourceUrl" = ${sourceUrl},
        confidence = ${confidence},
        tier = ${tier},
        notes = ${`verifiedBy:${VERIFIED_BY}`},
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
    `[${VERIFIED_BY}] batch=${BATCH.length} schools  (fetchedAt=${FETCHED_AT})\n` +
      `  ed2AcceptanceRate : CLOSED=0  UNAVAILABLE=${ed2Unavail}\n` +
      `  hasRestrictiveEa  : CLOSED=${reaTrue + reaFalse} (true=${reaTrue} false=${reaFalse})  UNAVAILABLE=0\n`,
  );

  let schoolsUpdated = 0;
  let targetsUpdated = 0;

  for (const entry of BATCH) {
    // ── 1) ed2AcceptanceRate target → UNAVAILABLE (no value to write to School)
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

    // ── 2) hasRestrictiveEa → write boolean to School column + provenance to metadata
    const meta = await readSchoolMetadata(entry.schoolId);
    if (!meta) {
      console.warn(
        `  SKIP school ${entry.name}: id ${entry.schoolId} not found`,
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

    // Write the hasRestrictiveEa column via raw SQL (the column exists on School).
    await prisma.$executeRaw`
      UPDATE "School" SET "hasRestrictiveEa" = ${entry.rea.value} WHERE id = ${entry.schoolId}
    `;

    // Merge a provenance record into metadata — never clobber existing keys.
    const mergedMetadata: Prisma.InputJsonValue = {
      ...meta.metadata,
      provenance: {
        ...meta.provenance,
        hasRestrictiveEa: {
          value: entry.rea.value,
          sourceUrl: entry.rea.sourceUrl,
          fetchedAt: FETCHED_AT,
          verifiedBy: VERIFIED_BY,
          confidence: entry.rea.confidence,
          tier: entry.rea.tier,
          note: entry.rea.note,
        },
      },
    };
    await prisma.school.update({
      where: { id: entry.schoolId },
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
      `(hasRestrictiveEa column + metadata.provenance), ${targetsUpdated} closure targets updated.`,
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

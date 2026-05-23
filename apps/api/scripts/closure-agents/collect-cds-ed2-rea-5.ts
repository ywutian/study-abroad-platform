/**
 * collect-cds-ed2-rea-5.ts
 *
 * closure-v2 CDS-extraction agent output (batch 5).
 *
 * For a 30-school batch, resolves TWO closure targets per school from each
 * school's Common Data Set (CDS) Section C21-C22 (Early Decision / Early Action)
 * cross-checked against the school's official admissions office:
 *
 *   1) ed2AcceptanceRate  — the Early Decision II round admit rate (%).
 *   2) hasRestrictiveEa   — whether the school runs a Restrictive / Single-Choice
 *                            EA (REA / SCEA) plan.
 *
 * ── ed2AcceptanceRate findings ───────────────────────────────────────────────
 * CDS Section C21 reports a SINGLE combined Early Decision applicant/admit count
 * (C2106 / C2107). Even when a school runs an ED II round it appears in C21 only
 * as an "Other early decision plan closing date" — the CDS NEVER breaks out ED II
 * applicants/admits separately from ED I. No ED II-specific admit rate can be
 * derived from the CDS without fabricating numbers, and no school in this batch
 * publishes a distinct ED II admit rate elsewhere. Many schools in this batch
 * have no Early Decision plan at all (Early Action only, or — for the UC campus —
 * a single application window) so there is no ED II round to rate. Every
 * ed2AcceptanceRate target is therefore resolved UNAVAILABLE (verified from the
 * actual CDS PDFs / admissions offices). There IS no `ed2AcceptanceRate` column
 * on School — it is a closure-target-only field, so no School write happens for
 * ed2.
 *
 * ── hasRestrictiveEa findings ────────────────────────────────────────────────
 * Resolvable for every school as a boolean from CDS C22 ("Is your early action
 * plan a 'restrictive' plan...") and/or the school's admissions office. Every
 * school in this batch that offers Early Action runs an OPEN, non-restrictive EA
 * (applicants may apply early elsewhere); the remaining schools offer Early
 * Decision only or no early round. None runs a Restrictive / Single-Choice EA.
 * Every hasRestrictiveEa value is therefore `false` → CLOSED.
 * The `School.hasRestrictiveEa` column EXISTS — written via raw SQL UPDATE to be
 * safe. A provenance record is merged into `School.metadata.provenance
 * .hasRestrictiveEa`. metadata is read + merged — never clobbered.
 *
 * ClosureTarget is a DB-only table (not in schema.prisma) → updated via raw SQL.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-cds-ed2-rea-5.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-cds-agent-5';

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
    schoolId: 'cmnwr8itr003qz0tihoo9onta',
    name: 'Penn State University',
    ed2: {
      targetId: 'cmp9pn04200gqa85olxf2tqem',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.psu.edu/admission/undergraduate/how-to-apply/',
      lastError:
        'Penn State has no Early Decision plan (offers a non-binding Early Action Nov 1 deadline plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn04500gra85okrrrdhak',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.psu.edu/admission/undergraduate/how-to-apply/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Penn State runs an open non-binding Early Action (Nov 1, decision by Dec 24) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8in9000rz0ti2orsdpwi',
    name: 'University of Miami',
    ed2: {
      targetId: 'cmp9pn09800isa85olkxlvpkh',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.irsa.miami.edu/cds2425.pdf',
      lastError:
        'CDS 2024-2025 C21 lists ED I (11/1) and ED II (1/5) plans, but reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn09c00ita85oggl8p52n',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.miami.edu/undergraduate/application-process/options-and-deadlines/index.html',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'Miami runs an open non-binding Early Action (11/1) alongside binding ED I/II. The EA plan carries no restriction on applying early elsewhere. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8inf000uz0tic8a7s8is',
    name: 'Rensselaer Polytechnic Institute',
    ed2: {
      targetId: 'cmp9pn0lf00oxa85o23clipn1',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.rpi.edu/undergraduate/deadlines',
      lastError:
        'RPI runs ED I (11/15) and ED II (1/5) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0lh00oya85o2273kr4e',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://undergrad.admissions.rpi.edu/apply/applying-early',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'RPI runs an open non-binding Early Action (12/15) alongside ED I/II. Applicants may apply early elsewhere. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iml000ez0ti01wzdugn',
    name: 'Indiana University Bloomington',
    ed2: {
      targetId: 'cmp9pn0t000sqa85okc646ffg',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.indiana.edu/apply/deadlines.html',
      lastError:
        'IU Bloomington has no Early Decision plan (offers a single non-binding Early Action Nov 1 deadline plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0t200sra85oim5muf06',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.indiana.edu/apply/deadlines.html',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'IU Bloomington runs an open non-binding Early Action (Nov 1) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8in5000pz0tiefcdnmfi',
    name: 'Stevens Institute of Technology',
    ed2: {
      targetId: 'cmp9pn0tf00t0a85ohn2mkr8a',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.stevens.edu/admission-aid/undergraduate-admissions/first-year-application-plans',
      lastError:
        'Stevens runs ED I (11/15) and ED II (1/15) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0th00t1a85oiynawtkx',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.stevens.edu/admission-aid/undergraduate-admissions/first-year-application-plans',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'Stevens explicitly states Early Action (12/1) is non-binding and will not limit an applicant from applying to another college. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8imv000kz0ti6chk6fxq',
    name: 'Michigan State University',
    ed2: {
      targetId: 'cmp9pn1eb0159a85orr5yektp',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.msu.edu/apply/first-year/dates-and-deadlines',
      lastError:
        'MSU has no Early Decision plan (offers a non-binding Early Action Nov 1 deadline plus Regular Admission) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn1ed015aa85oumgnxhxs',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.msu.edu/apply/first-year/dates-and-deadlines',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'MSU runs an open non-binding Early Action (Nov 1, decision by Jan 15) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iqv002cz0ti57kn9m2m',
    name: 'SUNY Binghamton University',
    ed2: {
      targetId: 'cmp9pn2bt01pfa85o0f0fvd5d',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.binghamton.edu/admissions/undergraduate/apply/freshman/',
      lastError:
        'Binghamton offers a single binding Early Decision (11/1) plus a non-binding Early Action and Regular Admission — one ED round, no ED II, so no ED II rate exists.',
    },
    rea: {
      targetId: 'cmp9pn2bv01pga85o2ytc7fww',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.binghamton.edu/admissions/undergraduate/apply/freshman/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'Binghamton runs an open non-binding Early Action (Nov 1, decision by Jan 15) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8in7000qz0ti04kcrc1l',
    name: 'University of Delaware',
    ed2: {
      targetId: 'cmp9pmzni006ya85o2tq6ww2z',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.udel.edu/apply/undergraduate-admissions/apply-to-ud/freshman-admissions/',
      lastError:
        'University of Delaware has no Early Decision plan (offers a non-binding Early Action Nov 1 deadline plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmznj006za85oobh9hzoo',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.udel.edu/apply/undergraduate-admissions/apply-to-ud/freshman-admissions/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'University of Delaware runs an open non-binding Early Action (Nov 1) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8in0000mz0tiria7qm89',
    name: 'University of Iowa',
    ed2: {
      targetId: 'cmp9pn0n200pia85os7le24m0',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.uiowa.edu/apply/how-apply/first-year-admissions',
      lastError:
        'University of Iowa has no Early Decision plan (rolling admission with a non-binding Early Action Nov 1 priority deadline) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0n500pja85o9swimz6n',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.uiowa.edu/apply/how-apply/first-year-admissions',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'University of Iowa uses rolling admission with a non-binding Early Action priority deadline and no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ims000iz0timfd6oan8',
    name: 'Southern Methodist University',
    ed2: {
      targetId: 'cmp9pn0yw00wka85ogiu4a9ae',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.smu.edu/admission/apply/undergraduate-admission/early-decision',
      lastError:
        'SMU runs ED I (11/1) and ED II (1/15) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0yx00wla85oyakend1o',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.smu.edu/admission/apply/undergraduate-admission/process',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'SMU states Early Action (11/1) is non-binding and does not require withdrawing other applications. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ing000vz0tizgajtqeo',
    name: 'University of Colorado Boulder',
    ed2: {
      targetId: 'cmp9pn0zv00x6a85oplel3dhs',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.colorado.edu/admissions/process/first-year/apply',
      lastError:
        'CU Boulder has no Early Decision plan (offers a non-binding Early Action Nov 15 deadline plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0zx00x7a85oy8evdm30',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.colorado.edu/admissions/process/first-year/apply',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'CU Boulder runs an open non-binding Early Action (Nov 15); applicants may apply early to other schools. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8itt003rz0tizqmu1u5h',
    name: 'Yeshiva University',
    ed2: {
      targetId: 'cmp9pn1or01boa85odds7b75p',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.yu.edu/admissions/deadlines',
      lastError:
        'Yeshiva offers a single Early Decision (11/2) plus Regular Decision — one ED round, no ED II, so no ED II rate exists.',
    },
    rea: {
      targetId: 'cmp9pn1ot01bpa85osexah3sp',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.yu.edu/admissions/deadlines',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'Yeshiva has no Early Action plan — it offers Early Decision and Regular Decision only. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8in2000nz0tikk636e8p',
    name: 'Binghamton University',
    ed2: {
      targetId: 'cmp9pn01o00fja85o9fybvmdx',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.binghamton.edu/admissions/undergraduate/apply/freshman/',
      lastError:
        'Binghamton offers a single binding Early Decision (11/1) plus a non-binding Early Action and Regular Admission — one ED round, no ED II, so no ED II rate exists.',
    },
    rea: {
      targetId: 'cmp9pn01q00fka85o9xetx7je',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.binghamton.edu/admissions/undergraduate/apply/freshman/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'Binghamton runs an open non-binding Early Action (Nov 1, decision by Jan 15) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iuk0040z0ti7p8v604n',
    name: 'Gonzaga University',
    ed2: {
      targetId: 'cmp9pmzkv0056a85ooto1e8b6',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.gonzaga.edu/undergraduate-admission/apply/dates-deadlines',
      lastError:
        'Gonzaga has no Early Decision plan (adopted a non-binding Early Action Nov 15 deadline in the 2024-25 cycle, plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzkx0057a85oryo7axpn',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.gonzaga.edu/undergraduate-admission/apply/dates-deadlines',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'Gonzaga runs an open non-binding Early Action (Nov 15) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8io20018z0tizk1tsitd',
    name: 'North Carolina State University',
    ed2: {
      targetId: 'cmp9pmzoe007ja85og2azw73y',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.ncsu.edu/apply/deadlines/',
      lastError:
        'NC State has no Early Decision plan (offers a non-binding Early Action Nov 1 deadline plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzof007ka85ovije7obx',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.clemson.edu/admissions/undergraduate-admissions/apply/early-action.html',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'NC State runs an open non-binding Early Action (Nov 1) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8io00017z0ti5bju2vo7',
    name: 'University at Buffalo',
    ed2: {
      targetId: 'cmp9pn0ap00jea85ojd830zde',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.buffalo.edu/admissions/apply/deadlines.html',
      lastError:
        'University at Buffalo has no Early Decision plan (offers a non-binding Early Action Nov 1 deadline plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0ar00jfa85ownyz7pla',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.buffalo.edu/admissions/apply/deadlines.html',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'University at Buffalo runs an open non-binding Early Action (Nov 1) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8imu000jz0ti03zavqgf',
    name: 'University of Massachusetts Amherst',
    ed2: {
      targetId: 'cmp9pn0h100mba85odfw17xz9',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.umass.edu/admissions/undergraduate-admissions/apply/important-dates-deadlines',
      lastError:
        'UMass Amherst has no Early Decision plan (offers a non-binding Early Action Nov 5 deadline plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0h300mca85ok8ie3z4p',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.umass.edu/admissions/undergraduate-admissions/apply/admission-decision/early-action-faq',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'UMass Amherst states Early Action is non-binding and applicants may apply to and be considered by other colleges. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ins0012z0ti4o8njwhn',
    name: 'Stony Brook University',
    ed2: {
      targetId: 'cmp9pn0i200mwa85obwe4go6v',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.stonybrook.edu/undergraduate-admissions/apply/early-action.php',
      lastError:
        'Stony Brook has no Early Decision plan (offers a non-binding Early Action Nov 1 deadline plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0i400mxa85opgf2varr',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.stonybrook.edu/undergraduate-admissions/apply/early-action.php',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Stony Brook runs an open non-binding Early Action (Nov 1, decision by end of January) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8itw003sz0ti2fueoy2e',
    name: 'Baylor University',
    ed2: {
      targetId: 'cmp9pn0k600o3a85otm7l6x4p',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.web.baylor.edu/admission/incoming-freshman/application-process/admission-plans',
      lastError:
        'Baylor offers a single binding Early Decision (Nov 1) plus a non-binding Early Action and Regular Decision — one ED round, no ED II, so no ED II rate exists.',
    },
    rea: {
      targetId: 'cmp9pn0k700o4a85ojobewlu4',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.web.baylor.edu/admission/incoming-freshman/application-process/admission-plans',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Baylor states its Nov 1 Non-Binding (Early Action) plan does not require a contractual agreement and admitted students need not withdraw other applications. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ind000tz0timgwcy8hj',
    name: 'Loyola Marymount University',
    ed2: {
      targetId: 'cmp9pn0o400psa85ouvumal8p',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admission.lmu.edu/learnmore/prospectivestudents/first-yearapplicants/',
      lastError:
        'LMU runs ED I (11/1) and ED II (1/8) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0o600pta85o474f904r',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admission.lmu.edu/learnmore/prospectivestudents/first-yearapplicants/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: 'LMU runs an open non-binding Early Action (11/1) alongside ED I/II. The EA plan carries no restriction on applying early elsewhere. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8in3000oz0tih36u19xf',
    name: 'Clemson University',
    ed2: {
      targetId: 'cmp9pn0v900u7a85oh6sjwa8u',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.clemson.edu/admissions/undergraduate-admissions/apply/early-action.html',
      lastError:
        'Clemson has no Early Decision plan (offers a non-binding Early Action Oct 15 deadline plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn0vb00u8a85omx1ra3it',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.clemson.edu/admissions/undergraduate-admissions/apply/early-action.html',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Clemson runs an open non-binding Early Action (Oct 15) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8inl000yz0ti6wsiqcrv',
    name: 'Marquette University',
    ed2: {
      targetId: 'cmp9pn1ab012va85ouidu2jdp',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.marquette.edu/admissions/undergraduate/first-year-application.php',
      lastError:
        'Marquette has no Early Decision plan (offers a non-binding Early Action Nov 15 deadline plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn1ad012wa85o71dkag3n',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.marquette.edu/admissions/undergraduate/first-year-application.php',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Marquette runs an open non-binding Early Action (Nov 15) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8imr000hz0tik9lqym4i',
    name: 'Fordham University',
    ed2: {
      targetId: 'cmp9pn1gj016pa85oj6hxzoi4',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.fordham.edu/undergraduate-admission/apply/dates-and-deadlines/',
      lastError:
        'Fordham runs ED I (11/1) and ED II (1/10) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn1gl016qa85owx801guz',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.fordham.edu/undergraduate-admission/apply/dates-and-deadlines/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Fordham runs an open non-binding Early Action (11/1) alongside ED I/II; applicants are not required to enroll if admitted. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ity003tz0tie2nazej1',
    name: 'American University',
    ed2: {
      targetId: 'cmp9pn28n01nfa85ok704vod5',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.american.edu/admissions/first-year/decision-plans-and-deadlines.cfm',
      lastError:
        'American University runs ED I (11/1) and ED II (1/15) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn28o01nga85oilb1yd7o',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.american.edu/admissions/first-year/decision-plans-and-deadlines.cfm',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'American University runs an open non-binding Early Action (11/1) alongside ED I/II; EA applicants have until May 1 to decide. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8inp0010z0tivwogzepz',
    name: 'University of South Florida',
    ed2: {
      targetId: 'cmp9pn1h30170a85od3dgc9ca',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.usf.edu/admissions/freshmen/admission-information/dates-deadlines.aspx',
      lastError:
        'University of South Florida has no Early Decision plan (offers a non-binding Early Action Nov 1 deadline plus Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn1h80171a85o553bylrh',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.usf.edu/admissions/freshmen/admission-information/dates-deadlines.aspx',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'USF runs an open non-binding Early Action (Nov 1) priority plan with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8io40019z0ti0z11pe98',
    name: 'University of California, Riverside',
    ed2: {
      targetId: 'cmp9pn07b00hya85o3w01xoaq',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-transfer/dates-and-deadlines.html',
      lastError:
        'UC Riverside has no Early Decision plan (the entire UC system uses a single Oct 1–Dec 2 application window with no early action or early decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn07d00hza85oe6f6ig7l',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.ucr.edu/firstyear',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'No Early Action plan — the entire UC system uses one application window with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iud003yz0tinuqfaa54',
    name: 'University of Denver',
    ed2: {
      targetId: 'cmp9pn0dz00kua85omfcsh6vw',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.du.edu/forthedifference/apply-early',
      lastError:
        'University of Denver runs ED I (11/1) and ED II (1/15) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0e300kva85oqdib42vc',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.du.edu/forthedifference/apply-early',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'University of Denver runs an open non-binding Early Action (11/1) alongside ED I/II; EA applicants have until May 1 to decide. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ink000xz0tivm4enckb',
    name: 'Drexel University',
    ed2: {
      targetId: 'cmp9pn10a00xga85odgwcs2sx',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://drexel.edu/admissions/apply/undergrad-instructions/first-year-instructions/early-decision-early-action',
      lastError:
        'Drexel offers a single binding Early Decision (11/1) plus two non-binding Early Action rounds (EA I 11/1, EA II 12/1) and Regular Decision — one ED round, no ED II, so no ED II rate exists.',
    },
    rea: {
      targetId: 'cmp9pn10b00xha85or29glms5',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://drexel.edu/admissions/apply/undergrad-instructions/first-year-instructions/early-decision-early-action',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Drexel runs open non-binding Early Action (EA I 11/1, EA II 12/1) with no application restrictions; admitted students have until May 1. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8inq0011z0tims8lt244',
    name: 'Temple University',
    ed2: {
      targetId: 'cmp9pn10u00xra85oxoeyyqer',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.temple.edu/apply/first-year-students',
      lastError:
        'Temple has no Early Decision plan (offers a non-binding Early Action Nov 1 deadline plus rolling Regular Decision) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn10v00xsa85oqgj5panr',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.temple.edu/apply/first-year-students',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'Temple runs an open non-binding Early Action (Nov 1, decision by Jan 10) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iuf003zz0ti12pe3iq1',
    name: 'University of San Diego',
    ed2: {
      targetId: 'cmp9pn1if017ka85ove7imdf5',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.sandiego.edu/admission-and-aid/undergraduate/apply/admission-timeline.php',
      lastError:
        'University of San Diego offers a single binding Early Decision (11/1) plus a non-binding Early Action (11/1) and Regular Decision (1/15) — one ED round, no ED II, so no ED II rate exists.',
    },
    rea: {
      targetId: 'cmp9pn1ig017la85oczm70mgw',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.sandiego.edu/admission-and-aid/undergraduate/apply/admission-timeline.php',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'University of San Diego runs an open non-binding Early Action (11/1) alongside binding ED; the EA plan carries no restriction on applying early elsewhere. Not restrictive EA.',
    },
  },
];

async function readSchoolMetadata(
  schoolId: string,
): Promise<{ metadata: Record<string, unknown>; provenance: Record<string, unknown> } | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, metadata: true },
  });
  if (!school) return null;
  const metadata =
    school.metadata && typeof school.metadata === 'object' && !Array.isArray(school.metadata)
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
      console.warn(`  SKIP school ${entry.name}: id ${entry.schoolId} not found`);
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

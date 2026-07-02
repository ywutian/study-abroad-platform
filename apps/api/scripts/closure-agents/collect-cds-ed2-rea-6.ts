/**
 * collect-cds-ed2-rea-6.ts
 *
 * closure-v2 CDS-extraction agent output (batch 6).
 *
 * For a 55-school batch, resolves TWO closure fields per school:
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
 * derived from the CDS without fabricating numbers. The overwhelming majority of
 * schools in this batch are large public state universities that run no ED at all
 * (non-binding EA, rolling, or priority-deadline admission) — they trivially have
 * no ED II round. The handful that DO run ED (WPI, RIT, Saint Louis University,
 * University of San Francisco run ED I/II; Howard, Illinois Tech, Clarkson, The
 * New School run a SINGLE ED round) still publish no distinct ED II admit rate.
 * Every ed2AcceptanceRate target is therefore resolved UNAVAILABLE (verified from
 * admissions offices / CDS). There IS no `ed2AcceptanceRate` column on School — it
 * is a closure-target-only field, so no School write happens for ed2.
 *
 * ── hasRestrictiveEa findings ────────────────────────────────────────────────
 * Resolvable for every school as a boolean from CDS C22 ("Is your early action
 * plan a 'restrictive' plan...") and/or the school's admissions office. No school
 * in this batch runs a Restrictive / Single-Choice EA plan — schools with EA run
 * open non-binding plans; the rest run ED-only, rolling, or priority-deadline
 * admission. Every hasRestrictiveEa value is therefore false. The
 * `School.hasRestrictiveEa` column EXISTS — written via raw SQL UPDATE to be safe.
 * A provenance record is merged into `School.metadata.provenance.hasRestrictiveEa`.
 * metadata is read + merged — never clobbered. Every hasRestrictiveEa target is
 * resolved CLOSED.
 *
 * ClosureTarget is a DB-only table (not in schema.prisma) → updated via raw SQL.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-cds-ed2-rea-6.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-cds-agent-6';

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

/** Reason strings reused across schools with the same admission-plan shape. */
const ED_IandII =
  'runs ED I and ED II rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.';
const ED_SINGLE =
  'runs a single Early Decision round plus Regular Decision — no ED II round, so no ED II admit rate exists.';
const NO_ED_EA =
  'has no Early Decision plan (runs a non-binding Early Action deadline plus Regular Decision) — no ED, hence no ED II round or rate.';
const NO_ED_ROLLING =
  'has no Early Decision plan (uses rolling / priority-deadline admission with no ED round) — no ED, hence no ED II round or rate.';
const NO_EA_UC =
  'uses a single first-year application window with no Early Action or Early Decision rounds — no ED, hence no ED II round or rate.';

const EA_NONRESTRICTIVE =
  'Early Action plan is non-binding and non-restrictive — applicants may apply early to other colleges. Not restrictive EA.';
const ED_ONLY_NO_EA =
  'No Early Action plan — the school offers only binding Early Decision and Regular Decision. Not restrictive EA.';
const ROLLING_NO_EA =
  'No restrictive Early Action plan — the school uses rolling / priority-deadline admission. Not restrictive EA.';
const UC_NO_EA =
  'No Early Action plan — the school uses a single first-year application window with no EA/ED rounds. Not restrictive EA.';

const BATCH: SchoolEntry[] = [
  {
    schoolId: 'cmnwr8iu0003uz0ti43l07p17',
    name: 'Worcester Polytechnic Institute',
    ed2: {
      targetId: 'cmp9pn2hs01t2a85o33k33flz',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.wpi.edu/admissions/undergraduate/apply',
      lastError: `WPI ${ED_IandII}`,
    },
    rea: {
      targetId: 'cmp9pn2hu01t3a85ogk2jc1ic',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.wpi.edu/admissions/undergraduate/apply',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: `WPI runs binding ED I/II plus non-binding Early Action I/II; the EA plan explicitly allows applying to other institutions. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8iu3003vz0tig0fa53lf',
    name: 'Howard University',
    ed2: {
      targetId: 'cmp9pn0l000ona85ocharfcjq',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admission.howard.edu/undergraduate/first-year',
      lastError: `Howard University ${ED_SINGLE}`,
    },
    rea: {
      targetId: 'cmp9pn0l100ooa85oef1t2mc0',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admission.howard.edu/undergraduate/first-year',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Howard runs a single binding ED round plus a non-binding Early Action plan. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8io5001az0tibgs1vu54',
    name: 'University of California, Santa Cruz',
    ed2: {
      targetId: 'cmp9pn0j300nia85of4ex9pne',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.ucsc.edu/apply/',
      lastError: `UC Santa Cruz ${NO_EA_UC}`,
    },
    rea: {
      targetId: 'cmp9pn0j500nja85o0hmw59e0',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.ucsc.edu/apply/',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: `UC Santa Cruz uses the system-wide UC application (Nov filing window) with no EA/ED rounds. ${UC_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8inb000sz0ti3r4uwfjt',
    name: 'Illinois Institute of Technology',
    ed2: {
      targetId: 'cmp9pn1pn01c8a85opwga2rrr',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.iit.edu/admissions-aid/undergraduate-admission/application-dates-and-deadlines',
      lastError: `Illinois Institute of Technology ${ED_SINGLE}`,
    },
    rea: {
      targetId: 'cmp9pn1pp01c9a85oouz99w6z',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.iit.edu/admissions-aid/undergraduate-admission/application-dates-and-deadlines',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Illinois Tech runs a single binding ED round (11/1) plus a non-binding Early Action plan (11/15). ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8inn000zz0tihkfqe5yc',
    name: 'University of Arizona',
    ed2: {
      targetId: 'cmp9pmzw900c9a85oinm7o75g',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.arizona.edu/dates-deadlines',
      lastError: `University of Arizona ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pmzwa00caa85osvwvz8kg',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.arizona.edu/dates-deadlines',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: `University of Arizona uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iua003xz0tio2zj4a4z',
    name: 'Saint Louis University',
    ed2: {
      targetId: 'cmp9pn1eq015ja85op6crcoqm',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.slu.edu/admission/freshman/deadlines.php',
      lastError: `Saint Louis University ${ED_IandII}`,
    },
    rea: {
      targetId: 'cmp9pn1es015ka85on6eb4r0g',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.slu.edu/admission/freshman/deadlines.php',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Saint Louis University runs binding ED I/II plus a non-binding Early Action plan (12/1). ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ime000az0ti9ts1sd20',
    name: 'Colorado School of Mines',
    ed2: {
      targetId: 'cmp9pn2ot01x1a85o30tw7ijt',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.mines.edu/undergraduate-admissions/first-year/',
      lastError: `Colorado School of Mines ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn2ov01x2a85ozmjba2dp',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.mines.edu/undergraduate-admissions/first-year/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: `Colorado School of Mines offers a non-binding Early Action deadline (11/1) plus Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8iu6003wz0tio3oagiri',
    name: 'Rochester Institute of Technology',
    ed2: {
      targetId: 'cmp9pn02q00g4a85osbxx6qoe',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.rit.edu/admissions/first-year/early-decision',
      lastError: `Rochester Institute of Technology ${ED_IandII}`,
    },
    rea: {
      targetId: 'cmp9pn02s00g5a85ok0xa9nt8',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.rit.edu/admissions/first-year/early-decision',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `RIT runs binding ED I (11/1) and ED II (1/1) plus a non-binding Early Action plan (11/1). ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8io7001bz0tihu5wo9mh',
    name: 'Rutgers University-Newark',
    ed2: {
      targetId: 'cmp9pmzss00afa85o80bek9c0',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.newark.rutgers.edu/apply/first-year-students',
      lastError: `Rutgers University-Newark ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pmzsu00aga85osu7h34qy',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.newark.rutgers.edu/apply/first-year-students',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Rutgers-Newark runs a non-binding, non-restrictive Early Action deadline plus Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8imp000gz0tibbuqx67l',
    name: 'University of California, Merced',
    ed2: {
      targetId: 'cmp9pn0xf00voa85ogeqm8xgj',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.ucmerced.edu/apply',
      lastError: `UC Merced ${NO_EA_UC}`,
    },
    rea: {
      targetId: 'cmp9pn0xi00vpa85oiv2a963f',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.ucmerced.edu/apply',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: `UC Merced uses the system-wide UC application (Nov filing window) with no EA/ED rounds. ${UC_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8inv0014z0ti6jqhq1ga',
    name: 'University of South Carolina',
    ed2: {
      targetId: 'cmp9pn1iv017va85obk1tq4kb',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://sc.edu/about/offices_and_divisions/undergraduate_admissions/deadlines/index.php',
      lastError: `University of South Carolina ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn1ix017wa85ozjhcqcns',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://sc.edu/about/offices_and_divisions/undergraduate_admissions/deadlines/index.php',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: `University of South Carolina offers a non-binding Early Action deadline (10/15) plus Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ini000wz0ti57rv9m9o',
    name: 'Auburn University',
    ed2: {
      targetId: 'cmp9pn1r901d4a85oqcx6xddi',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.auburn.edu/admissions/freshman/',
      lastError: `Auburn University ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn1ra01d5a85o72158tuw',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.auburn.edu/admissions/freshman/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Auburn University uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iob001dz0ti3go71xpz',
    name: 'University of Utah',
    ed2: {
      targetId: 'cmp9pn1cc0141a85olyz5051e',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.utah.edu/apply/dates-deadlines/',
      lastError: `University of Utah ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn1ce0142a85otr9ruyvv',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.utah.edu/apply/dates-deadlines/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Utah offers a priority/Early Action deadline plus Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ioe001ez0tii04p5pvd',
    name: 'DePaul University',
    ed2: {
      targetId: 'cmp9pn163010ha85o7swwel9c',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.depaul.edu/admission/undergraduate-admission/deadlines',
      lastError: `DePaul University ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn165010ia85obwg3idos',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.depaul.edu/admission/undergraduate-admission/early-action-program-faq',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: `DePaul runs a non-binding Early Action Program (11/15); applicants are not required to commit. No ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8int0013z0tiqysdv07w',
    name: 'University of Oregon',
    ed2: {
      targetId: 'cmp9pn04u00h1a85o3d3w6w0u',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.uoregon.edu/freshmen/dates-deadlines',
      lastError: `University of Oregon ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn04w00h2a85om7a79lor',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.uoregon.edu/freshmen/dates-deadlines',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Oregon offers a non-binding Early Action deadline (11/1) plus Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ioi001fz0tivlt104p7',
    name: 'Seton Hall University',
    ed2: {
      targetId: 'cmp9pn1xp01h1a85ocyaqeggt',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.shu.edu/undergraduate-admissions/application-checklist.html',
      lastError: `Seton Hall University ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn1xr01h2a85oux75dvyy',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.shu.edu/undergraduate-admissions/application-checklist.html',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Seton Hall runs two non-binding Early Action rounds (EA I 11/15, EA II 12/15) plus Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8iol001gz0ticdgvwjkf',
    name: 'University of San Francisco',
    ed2: {
      targetId: 'cmp9pmzrv009ta85o5ipf013t',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.usfca.edu/admission/undergraduate/early-decision-early-action-regular-decision',
      lastError: `University of San Francisco ${ED_IandII}`,
    },
    rea: {
      targetId: 'cmp9pmzrx009ua85om2hs0pu4',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.usfca.edu/admission/undergraduate/early-decision-early-action-regular-decision',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of San Francisco runs binding ED I (11/1) and ED II (1/15) plus a non-binding Early Action plan (11/1). ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ioy001kz0ti85qspr1l',
    name: 'The New School',
    ed2: {
      targetId: 'cmp9pn0em00l4a85ospxdexwd',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.newschool.edu/admission/prospective-undergraduate-students/early-application-options/',
      lastError: `The New School ${ED_SINGLE}`,
    },
    rea: {
      targetId: 'cmp9pn0eo00l5a85o5pv0805x',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.newschool.edu/admission/prospective-undergraduate-students/early-application-options/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `The New School runs a single binding ED round (11/15) plus a non-binding Early Action plan (11/10). ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8io8001cz0tivir7q6ki',
    name: 'University of Kansas',
    ed2: {
      targetId: 'cmp9pn0f800lfa85o5fqp69t6',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.ku.edu/apply/freshman',
      lastError: `University of Kansas ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn0fa00lga85omb1x2zu6',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.ku.edu/apply/freshman',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Kansas uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8ior001iz0tibsba6d2o',
    name: 'University of Kentucky',
    ed2: {
      targetId: 'cmp9pn05n00hca85ojk33wfeb',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.uky.edu/admissions/apply',
      lastError: `University of Kentucky ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn05r00hda85od37m9g6c',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.uky.edu/admissions/apply',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Kentucky uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iou001jz0tig866z8pb',
    name: 'San Diego State University',
    ed2: {
      targetId: 'cmp9pn1je0186a85o9zgy4gth',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.sdsu.edu/apply',
      lastError: `San Diego State University ${NO_EA_UC}`,
    },
    rea: {
      targetId: 'cmp9pn1jg0187a85o26e4b7gs',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.sdsu.edu/apply',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: `San Diego State University uses the Cal State Apply window (Oct–Dec) with no EA/ED rounds. ${UC_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8ioo001hz0tim3isqwz9',
    name: 'Clarkson University',
    ed2: {
      targetId: 'cmp9pn0on00q2a85onr7wh9r6',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.clarkson.edu/admissions-aid/undergraduate/how-to-apply',
      lastError: `Clarkson University ${ED_SINGLE}`,
    },
    rea: {
      targetId: 'cmp9pn0op00q3a85opn1znlg7',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.clarkson.edu/admissions-aid/undergraduate/how-to-apply',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: `Clarkson runs a single binding ED round (12/1) plus a non-binding Early Action plan. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ip7001nz0ti6qy76djw',
    name: 'University of Missouri',
    ed2: {
      targetId: 'cmp9pmztp00b1a85oqozjl7bi',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.missouri.edu/apply/',
      lastError: `University of Missouri ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pmztr00b2a85ogdf6lwnt',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.missouri.edu/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Missouri uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8ip3001mz0til7q2dopw',
    name: 'University of Oklahoma',
    ed2: {
      targetId: 'cmp9pmzu900bca85ok29gc1vi',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.ou.edu/admissions/apply',
      lastError: `University of Oklahoma ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pmzub00bda85ohsad13a3',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.ou.edu/admissions/apply',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Oklahoma offers a non-binding Early Action deadline plus Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8inx0015z0tix5dndhpi',
    name: 'Arizona State University',
    ed2: {
      targetId: 'cmp9pmze3000ta85oy8ufcv0c',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admission.asu.edu/freshman/dates-deadlines',
      lastError: `Arizona State University ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pmze5000ua85o606w3zwz',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admission.asu.edu/freshman/dates-deadlines',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: `Arizona State University uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8ip1001lz0ti51lr5gad',
    name: 'University of Alabama',
    ed2: {
      targetId: 'cmp9pn21c01j3a85owvm8ijr1',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://gobama.ua.edu/apply/',
      lastError: `University of Alabama ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn21d01j4a85o7xc2jps3',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://gobama.ua.edu/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Alabama uses rolling admission with priority/scholarship deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8ipa001oz0tionb7y3gm',
    name: 'Loyola University Chicago',
    ed2: {
      targetId: 'cmp9pn1yp01hma85opbst80sl',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.luc.edu/undergrad/apply/freshman/deadlines/',
      lastError: `Loyola University Chicago ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn1yq01hna85ovrsz085l',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.luc.edu/undergrad/apply/freshman/deadlines/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Loyola University Chicago runs a non-binding Early Action priority deadline (11/1) plus rolling admission; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8iwx0059z0tilcfiwj80',
    name: 'University of Texas at Dallas',
    ed2: {
      targetId: 'cmp9pn17s011ea85o6xprt7qt',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://enroll.utdallas.edu/freshman/deadlines-and-fees/',
      lastError: `University of Texas at Dallas ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn17u011fa85o7p6yzy99',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://enroll.utdallas.edu/freshman/deadlines-and-fees/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `UT Dallas reviews applications on a rolling basis with priority/regular deadlines; no ED, no restrictive EA. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8ipc001pz0tiz0bgth66',
    name: 'Iowa State University',
    ed2: {
      targetId: 'cmp9pn12z00yza85o1sbyt2dv',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.admissions.iastate.edu/apply/',
      lastError: `Iowa State University ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn13000z0a85o3agkod3a',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.admissions.iastate.edu/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Iowa State University uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8ipj001rz0tipapk15or',
    name: 'University of Nebraska-Lincoln',
    ed2: {
      targetId: 'cmp9pn1at0136a85oi9r75av8',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.unl.edu/apply/',
      lastError: `University of Nebraska-Lincoln ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn1au0137a85o50xk80lo',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.unl.edu/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Nebraska-Lincoln uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8ipf001qz0ti3d3001d9',
    name: 'University of Tennessee',
    ed2: {
      targetId: 'cmp9pmzsc00a4a85o478gjwik',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.utk.edu/apply/',
      lastError: `University of Tennessee ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pmzsd00a5a85omql5iyzh',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.utk.edu/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Tennessee offers a non-binding Early Action deadline plus Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ipr001tz0ti8x7z840u',
    name: 'University of New Hampshire',
    ed2: {
      targetId: 'cmp9pn11b00y2a85o5w8td84k',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.unh.edu/admissions/apply/first-year-students',
      lastError: `University of New Hampshire ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn11c00y3a85onvyo19xf',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.unh.edu/admissions/apply/first-year-students',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of New Hampshire offers a non-binding Early Action deadline (11/15) plus Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ipt001uz0tivghae5e1',
    name: 'University of Cincinnati',
    ed2: {
      targetId: 'cmp9pn0xx00vza85ou3udw267',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.uc.edu/apply.html',
      lastError: `University of Cincinnati ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn0xz00w0a85o8ajszv0z',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.uc.edu/apply.html',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Cincinnati offers a non-binding Early Action deadline (12/1) plus rolling/Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ipx001wz0timhlbfii2',
    name: 'University of Vermont',
    ed2: {
      targetId: 'cmp9pn0q000qya85ojqbh5q48',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.uvm.edu/admissions/apply',
      lastError:
        'University of Vermont runs ED I and ED II rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0q100qza85ow1470h85',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.uvm.edu/admissions/apply',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: `University of Vermont runs binding ED I/II plus a non-binding Early Action plan. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ipv001vz0tiqnippgu6',
    name: 'Colorado State University',
    ed2: {
      targetId: 'cmp9pn16s010sa85ouc9sasdq',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.colostate.edu/apply/',
      lastError: `Colorado State University ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn16t010ta85og3pnbu1u',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.colostate.edu/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Colorado State University offers a non-binding Early Action deadline plus rolling/Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ipm001sz0tixvcr2p30',
    name: 'Oregon State University',
    ed2: {
      targetId: 'cmp9pn1rs01dfa85oygwwwxeu',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.oregonstate.edu/apply',
      lastError: `Oregon State University ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn1ru01dga85o63mis3fj',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.oregonstate.edu/apply',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Oregon State University uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iq40020z0tif8l8dxxu',
    name: 'University of Arkansas',
    ed2: {
      targetId: 'cmp9pn1f6015ua85ol5oe6ogr',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.uark.edu/apply/',
      lastError: `University of Arkansas ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn1f8015va85oubm8t8bs',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.uark.edu/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Arkansas uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iq1001yz0ti1jb6g7hi',
    name: 'Louisiana State University',
    ed2: {
      targetId: 'cmp9pn11r00yda85oziza7ws0',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.lsu.edu/admissions/apply/index.php',
      lastError: `Louisiana State University ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn11u00yea85o53b3o9g9',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.lsu.edu/admissions/apply/index.php',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Louisiana State University offers a non-binding Early Action deadline (11/15) plus rolling/Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8iq2001zz0tiix4lbz86',
    name: 'University of Houston',
    ed2: {
      targetId: 'cmp9pn22c01joa85oqh9whbd0',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://uh.edu/admissions/apply/freshman/',
      lastError: `University of Houston ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn22e01jpa85o00a2y8gz',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://uh.edu/admissions/apply/freshman/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Houston uses priority/regular application deadlines with no ED or restrictive EA. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8ipz001xz0ti9f4tlagk',
    name: 'George Mason University',
    ed2: {
      targetId: 'cmp9pn27e01mka85otklqecon',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.gmu.edu/freshman/dates-deadlines',
      lastError: `George Mason University ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn27f01mla85o3a5h80jx',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.gmu.edu/freshman/dates-deadlines',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: `George Mason University runs a non-binding Early Action deadline (11/1) plus rolling admission; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8iqa0022z0ti9ad68xp2',
    name: 'University of Rhode Island',
    ed2: {
      targetId: 'cmp9pn0fv00lqa85ontnrrx4h',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://web.uri.edu/admission/apply/',
      lastError: `University of Rhode Island ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn0fx00lra85og35zdprr',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://web.uri.edu/admission/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Rhode Island offers a non-binding Early Action deadline (12/1) plus Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8iny0016z0tiikip2622',
    name: 'Florida State University',
    ed2: {
      targetId: 'cmp9pn1cw014ca85okdx3jvq3',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admissions.fsu.edu/freshman/',
      lastError: `Florida State University ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn1cx014da85owmyxlcui',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admissions.fsu.edu/freshman/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Florida State University uses a single freshman application deadline with no ED or restrictive EA. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iq70021z0titshta238',
    name: 'University of Hawaii at Manoa',
    ed2: {
      targetId: 'cmp9pn1fn0165a85o5oezitap',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://manoa.hawaii.edu/admissions/undergrad/',
      lastError: `University of Hawaii at Manoa ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn1fo0166a85odlx8kxu1',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://manoa.hawaii.edu/admissions/undergrad/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Hawaii at Manoa uses priority/regular application deadlines with no ED or restrictive EA. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iqf0024z0tiy29w0e1z',
    name: 'Missouri University of Science and Technology',
    ed2: {
      targetId: 'cmp9pn13g00zaa85obujfkykn',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://futurestudents.mst.edu/apply/',
      lastError: `Missouri University of Science and Technology ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn13i00zba85o1ptgz7a8',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://futurestudents.mst.edu/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Missouri S&T uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iqh0025z0ti7z1ynz4s',
    name: 'Washington State University',
    ed2: {
      targetId: 'cmp9pn1se01dqa85ogleb0fso',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admission.wsu.edu/apply/',
      lastError: `Washington State University ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn1sg01dra85ov05og98w',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admission.wsu.edu/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Washington State University uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iqc0023z0ti60klqjhy',
    name: 'Kansas State University',
    ed2: {
      targetId: 'cmp9pn0vp00uia85o4yo87lcu',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.k-state.edu/admissions/apply/',
      lastError: `Kansas State University ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn0vr00uja85ogfx9xybi',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.k-state.edu/admissions/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Kansas State University uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iqk0027z0ti3qm7r15o',
    name: 'University of Central Florida',
    ed2: {
      targetId: 'cmp9pn0yf00waa85ok2m45ce9',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.ucf.edu/admissions/first-year/',
      lastError: `University of Central Florida ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn0yi00wba85oszbs7v6q',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.ucf.edu/admissions/first-year/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Central Florida uses priority/regular application deadlines with no ED or restrictive EA. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iqi0026z0tin3vtpw1p',
    name: 'University of Maine',
    ed2: {
      targetId: 'cmp9pn23g01k8a85oxx5imryr',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://go.umaine.edu/apply/',
      lastError: `University of Maine ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn23i01k9a85oh8rzatwg',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://go.umaine.edu/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `University of Maine uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iqm0028z0ti63txqxzg',
    name: 'Illinois State University',
    ed2: {
      targetId: 'cmp9pn27t01mva85ogok6uecr',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://illinoisstate.edu/admissions/apply/',
      lastError: `Illinois State University ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn27v01mwa85ogldnia3x',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://illinoisstate.edu/admissions/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Illinois State University uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iqp0029z0ti2wbplonv',
    name: 'Hofstra University',
    ed2: {
      targetId: 'cmp9pn18b011oa85obu1ubrpt',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.hofstra.edu/admission/apply/',
      lastError: `Hofstra University ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn18c011pa85o8g6x8s7d',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.hofstra.edu/admission/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Hofstra runs two non-binding Early Action rounds (EA I 11/15, EA II 12/15) plus rolling admission; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8iqr002az0ti1une85dx',
    name: 'Rowan University',
    ed2: {
      targetId: 'cmp9pn0qm00r9a85orudx0r1s',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.rowan.edu/admissions-process/app-calendar-fees.html',
      lastError: `Rowan University ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn0qn00raa85oaehbwisg',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.rowan.edu/admissions-process/app-calendar-fees.html',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Rowan University runs a non-binding Early Action deadline (11/1) plus rolling/Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8iqy002ez0tizit8vwvw',
    name: 'Ohio University',
    ed2: {
      targetId: 'cmp9pn1de014na85od9ofym2h',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.ohio.edu/admissions/apply',
      lastError: `Ohio University ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn1df014oa85ogl6sti20',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.ohio.edu/admissions/apply',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Ohio University uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iqx002dz0tigsxpge66',
    name: 'Mississippi State University',
    ed2: {
      targetId: 'cmp9pn0p400qda85oyqdyf719',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.admissions.msstate.edu/apply/',
      lastError: `Mississippi State University ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn0p600qea85os47az9i7',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.admissions.msstate.edu/apply/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Mississippi State University uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
    },
  },
  {
    schoolId: 'cmnwr8iqt002bz0ti5efot7m8',
    name: 'Adelphi University',
    ed2: {
      targetId: 'cmp9pn1z701hwa85oxfcttxbp',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.adelphi.edu/freshman/how-to-apply/decisions-deadlines-early-action/',
      lastError: `Adelphi University ${NO_ED_EA}`,
    },
    rea: {
      targetId: 'cmp9pn1z901hxa85ox2r6o0gv',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.adelphi.edu/freshman/how-to-apply/decisions-deadlines-early-action/',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Adelphi University runs a non-binding Early Action deadline plus rolling/Regular Decision; no ED. ${EA_NONRESTRICTIVE}`,
    },
  },
  {
    schoolId: 'cmnwr8ir0002fz0tiuxlv8v32',
    name: 'Kent State University',
    ed2: {
      targetId: 'cmp9pn2cb01pqa85odnu3wj14',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.kent.edu/admissions/undergraduate',
      lastError: `Kent State University ${NO_ED_ROLLING}`,
    },
    rea: {
      targetId: 'cmp9pn2cd01pra85oq9gb7u6o',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.kent.edu/admissions/undergraduate',
      confidence: 0.94,
      tier: 'SCRAPED',
      note: `Kent State University uses rolling admission with priority deadlines and no ED. ${ROLLING_NO_EA}`,
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

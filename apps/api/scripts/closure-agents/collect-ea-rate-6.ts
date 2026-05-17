/**
 * collect-ea-rate-6.ts
 *
 * closure-v2 data-collection agent output (batch 6 — FINAL eaAcceptanceRate sweep).
 *
 * Writes REAL, source-verified `School.eaAcceptanceRate` values for the final
 * 70-school batch of `ClosureTarget` rows (field = 'eaAcceptanceRate',
 * status = PENDING). Clears ALL remaining PENDING rows for this field.
 *
 * Semantics of eaAcceptanceRate:
 *   number → an authoritative institution source explicitly publishes a single
 *            non-binding (EA / REA / SCEA) early-round admit rate. Range gate 1–90%.
 *   null   → school either has NO non-binding early round (rolling / priority-
 *            deadline / ED-only / CSU systems / no early round) OR has such a
 *            round but publishes no round-specific admit rate → row left NULL,
 *            target → UNAVAILABLE.
 *
 * Outcome of batch 6: 0 CLOSED, 70 UNAVAILABLE, 0 FAILED.
 *
 * This batch is dominated by large public universities. Every one falls into one
 * of two buckets, and NEITHER yields an authoritative round-specific EA rate:
 *
 *   (a) Has a non-binding Early Action (or EA I/II) round but publishes ONLY an
 *       overall acceptance rate — no EA/RD breakdown. Common Data Set C21/C22
 *       record EA as Yes/No and carry no EA applicant/admit counts. Third-party
 *       aggregators (Niche / US News / CollegeData) surface an "early acceptance
 *       rate" for some of these, but those are estimates, not institution-
 *       published EA-round rates, and are refused per the strict semantics.
 *
 *   (b) Has NO non-binding early round at all — rolling admission, a priority/
 *       scholarship deadline (not a true EA plan), an ED-only early option, or a
 *       CSU campus admitting solely through the single Cal State Apply cycle.
 *
 * Per the strict semantics, all 70 are UNAVAILABLE (eaAcceptanceRate left NULL).
 *
 * ClosureTarget is a DB-only table (not in schema.prisma → not on the Prisma
 * client), so its rows are updated via $executeRaw. School rows use the typed
 * client. metadata.provenance.eaAcceptanceRate is MERGED — other keys preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-ea-rate-6.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-ea-agent-6';

type Tier = 'OFFICIAL' | 'SCRAPED';

interface ClosedTarget {
  status: 'CLOSED';
  targetId: string;
  schoolId: string;
  name: string;
  value: number; // EA admit rate %
  sourceUrl: string;
  confidence: number;
  tier: Tier;
  note?: string;
}

interface NonClosedTarget {
  status: 'UNAVAILABLE' | 'FAILED';
  targetId: string;
  schoolId: string;
  name: string;
  sourceUrl?: string;
  confidence?: number;
  tier?: Tier;
  lastError: string;
}

type BatchTarget = ClosedTarget | NonClosedTarget;

/**
 * Full 70-school batch. Each entry's `lastError` records WHY no authoritative
 * round-specific EA rate exists. EA here = a general non-binding early round
 * (EA / REA / SCEA / EA I-II).
 */
const BATCH: BatchTarget[] = [
  // ── UNAVAILABLE: has non-binding EA but no published round-specific rate ────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0xt00vwa85opbm8qv7v',
    schoolId: 'cmnwr8ipt001uz0tivghae5e1',
    name: 'University of Cincinnati',
    sourceUrl: 'https://www.admissions.uc.edu/apply/deadlines.html',
    lastError:
      'Has non-binding Early Action (Nov 1 deadline, decisions on Cincinnati Decision Day) but does not publish a round-specific EA admit rate — only an overall acceptance rate is disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1rm01dca85oi7xd97pv',
    schoolId: 'cmnwr8ipm001sz0tixvcr2p30',
    name: 'Oregon State University',
    sourceUrl:
      'https://admissions.oregonstate.edu/undergraduate-admission-deadlines',
    lastError:
      'Has non-binding Early Action (Nov 3 deadline) but does not publish a round-specific EA admit rate — EA and Priority Round applicants are reviewed by the same holistic criteria with no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn16m010pa85o3clxfru5',
    schoolId: 'cmnwr8ipv001vz0tiqnippgu6',
    name: 'Colorado State University',
    sourceUrl: 'https://admissions.colostate.edu/apply/freshmen/',
    lastError:
      'Has non-binding Early Action (Nov 15 deadline) but does not publish a round-specific EA admit rate — only an overall acceptance rate is disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1f1015ra85owjrkr9ra',
    schoolId: 'cmnwr8iq40020z0tif8l8dxxu',
    name: 'University of Arkansas',
    sourceUrl: 'https://admissions.uark.edu/apply/new-freshman.php',
    lastError:
      'Has an early admission / priority deadline (Nov 1) within a rolling-style cycle but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn27901mha85osviskbfm',
    schoolId: 'cmnwr8ipz001xz0ti9f4tlagk',
    name: 'George Mason University',
    sourceUrl: 'https://www.gmu.edu/freshman/dates-deadlines',
    lastError:
      'Has non-binding Early Action (Nov 1 deadline, mid-December notification) but does not publish a round-specific EA admit rate — only an overall acceptance rate is disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn22701jla85omvt6mwyv',
    schoolId: 'cmnwr8iq2001zz0tiix4lbz86',
    name: 'University of Houston',
    sourceUrl:
      'https://www.uh.edu/undergraduate-admissions/apply/freshman/freshman-process/',
    lastError:
      'No general non-binding Early Action program — UH uses a Nov 1 priority application/scholarship deadline within a rolling-style review (final deadline in June), no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn11n00yaa85o74uz7383',
    schoolId: 'cmnwr8iq1001yz0ti1jb6g7hi',
    name: 'Louisiana State University',
    sourceUrl: 'https://www.lsu.edu/admissions/apply/freshman.php',
    lastError:
      'No non-binding Early Action program — LSU uses a Dec 15 scholarship priority deadline and a Feb 1 Regular Decision deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0fo00lna85oozinotms',
    schoolId: 'cmnwr8iqa0022z0ti9ad68xp2',
    name: 'University of Rhode Island',
    sourceUrl: 'https://web.uri.edu/admission/early-action/',
    lastError:
      'Has non-binding Early Action (Dec 1 deadline) but does not publish a round-specific EA admit rate — only an overall acceptance rate is disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1fi0162a85owbyxcoqv',
    schoolId: 'cmnwr8iq70021z0titshta238',
    name: 'University of Hawaii at Manoa',
    sourceUrl: 'https://manoa.hawaii.edu/admissions/freshman/',
    lastError:
      'Has an Early Action option but does not publish a round-specific EA admit rate — only an overall acceptance rate is disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1cp0149a85o2e05lb3d',
    schoolId: 'cmnwr8iny0016z0tiikip2622',
    name: 'Florida State University',
    sourceUrl: 'https://admissions.fsu.edu/deadlines',
    lastError:
      'Has a non-binding Early Action option (Oct 15 deadline, Florida residents only) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0vk00ufa85o0vu1iyyq',
    schoolId: 'cmnwr8iqc0023z0ti60klqjhy',
    name: 'Kansas State University',
    sourceUrl:
      'https://www.k-state.edu/admissions/undergrad/manhattan/apply/deadlines.html',
    lastError:
      'No non-binding Early Action program — K-State uses a Dec 1 scholarship priority date within a rolling-style cycle, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1s801dna85ohduyswvz',
    schoolId: 'cmnwr8iqh0025z0ti7z1ynz4s',
    name: 'Washington State University',
    sourceUrl: 'https://admission.wsu.edu/apply/admissions-dates-deadlines/',
    lastError:
      'No non-binding Early Action program — WSU uses a rolling-style cycle with a Nov 15 scholarship priority deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn13c00z7a85oz3ezxh9k',
    schoolId: 'cmnwr8iqf0024z0tiy29w0e1z',
    name: 'Missouri University of Science and Technology',
    sourceUrl: 'https://futurestudents.mst.edu/admissions/first-timefreshmen/',
    lastError:
      'No non-binding Early Action program — Missouri S&T uses rolling admission with a Dec 1 scholarship priority deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn23d01k6a85o6nqnkpsv',
    schoolId: 'cmnwr8iqi0026z0tin3vtpw1p',
    name: 'University of Maine',
    sourceUrl: 'https://go.umaine.edu/applyinfo/',
    lastError:
      'Has non-binding Early Action (Dec 1 deadline) but does not publish a round-specific EA admit rate — only an overall acceptance rate is disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0yb00w7a85ohag2ubwn',
    schoolId: 'cmnwr8iqk0027z0ti3qm7r15o',
    name: 'University of Central Florida',
    sourceUrl:
      'https://www.ucf.edu/admissions/undergraduate/question/what-is-early-action-at-ucf/',
    lastError:
      'Has non-binding Early Action (Oct 15 deadline, Dec 5 notification) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0qg00r6a85ojjwkehop',
    schoolId: 'cmnwr8iqr002az0ti1une85dx',
    name: 'Rowan University',
    sourceUrl:
      'https://admissions.rowan.edu/admissions-process/app-calendar-fees.html',
    lastError:
      'No non-binding Early Action program — Rowan uses rolling admission for first-year applicants, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn188011ma85ofu0ber8j',
    schoolId: 'cmnwr8iqp0029z0ti2wbplonv',
    name: 'Hofstra University',
    sourceUrl: 'https://www.hofstra.edu/admission/apply/',
    lastError:
      'Has non-binding Early Action (EA I Nov 15, EA II Dec 15) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn27p01msa85onml4xuud',
    schoolId: 'cmnwr8iqm0028z0ti63txqxzg',
    name: 'Illinois State University',
    sourceUrl: 'https://illinoisstate.edu/apply/deadlines/',
    lastError:
      'No named non-binding Early Action plan — Illinois State uses a Nov 1 priority deadline within a rolling-style cycle, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1d8014ka85offb9kflb',
    schoolId: 'cmnwr8iqy002ez0tizit8vwvw',
    name: 'Ohio University',
    sourceUrl: 'https://www.ohio.edu/admissions/freshman/dates-deadlines',
    lastError:
      'Has non-binding Early Action (Nov 15 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0oz00qaa85opofxlzpu',
    schoolId: 'cmnwr8iqx002dz0tigsxpge66',
    name: 'Mississippi State University',
    sourceUrl:
      'https://www.admissions.msstate.edu/apply/admission-process/freshman-admissions',
    lastError:
      'No non-binding Early Action program — Mississippi State uses rolling admission (applications open with an Aug 1 deadline), no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1z301hua85ofbevk3hg',
    schoolId: 'cmnwr8iqt002bz0ti5efot7m8',
    name: 'Adelphi University',
    sourceUrl:
      'https://admissions.adelphi.edu/freshman/how-to-apply/decisions-deadlines-early-action/',
    lastError:
      'Has non-binding Early Action (Nov 1 deadline, notification by Dec 31) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2c601pna85o1duee0b5',
    schoolId: 'cmnwr8ir0002fz0tiuxlv8v32',
    name: 'Kent State University',
    sourceUrl:
      'https://www.kent.edu/admissions/first-year-student-requirements',
    lastError:
      'Uses rolling admission with a May 1 merit-scholarship deadline; does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1zm01i4a85osrsip0hj',
    schoolId: 'cmnwr8ir7002iz0ti11f0voua',
    name: 'University of Wyoming',
    sourceUrl: 'https://www.uwyo.edu/admissions/freshman/index.html',
    lastError:
      'No non-binding Early Action program — University of Wyoming uses rolling admission with no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0ji00nqa85omnwn8kbv',
    schoolId: 'cmnwr8ir4002hz0tibdz0myoo',
    name: 'Ball State University',
    sourceUrl:
      'https://www.bsu.edu/admissions/undergraduate-admissions/apply-now/dates-and-deadlines',
    lastError:
      'Uses priority admission deadlines within a rolling-style cycle; does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1sr01dya85ov5ra3t20',
    schoolId: 'cmnwr8ir2002gz0tih2v6dubi',
    name: 'University of New Mexico',
    sourceUrl: 'https://admissions.unm.edu/future-students/freshmen/',
    lastError:
      'UNM uses a rolling admission cycle; does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2cp01pya85onk9cxywc',
    schoolId: 'cmnwr8ira002jz0tib0nkhdsx',
    name: 'West Virginia University',
    sourceUrl: 'https://admissions.wvu.edu/how-to-apply/first-time-freshmen',
    lastError:
      'No non-binding Early Action program — WVU uses rolling admission with an Aug 1 merit deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0u900tja85ovkbawrr0',
    schoolId: 'cmnwr8irf002lz0titpd5mufz',
    name: 'University of South Dakota',
    sourceUrl:
      'https://www.usd.edu/Admissions-and-Aid/Undergraduate-Admissions/Deadlines-and-Requirements',
    lastError:
      'No non-binding Early Action program — University of South Dakota uses rolling admission with no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0tq00t8a85on4jagpoi',
    schoolId: 'cmnwr8irh002mz0tik8qulubb',
    name: 'Montana State University',
    sourceUrl: 'https://www.montana.edu/admissions/apply/',
    lastError:
      'No non-binding Early Action program — Montana State uses rolling admission (its "Early Admission" is a dual-enrollment program for current high schoolers), no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0rd00rra85o94z2j9c3',
    schoolId: 'cmnwr8ird002kz0tifunyipf1',
    name: 'University of North Dakota',
    sourceUrl: 'https://und.edu/admissions/freshmen/apply.html',
    lastError:
      'No non-binding Early Action program — University of North Dakota uses rolling admission with a Feb 1 scholarship priority deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2d801q9a85o0lybyfj4',
    schoolId: 'cmnwr8irj002nz0tief4railh',
    name: 'University of Nevada, Reno',
    sourceUrl: 'https://www.unr.edu/admissions/freshman/deadlines',
    lastError:
      'Has non-binding Early Action (Nov 15 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn18p011wa85owzmb96wz',
    schoolId: 'cmnwr8irl002oz0tiyc5w37jx',
    name: 'Portland State University',
    sourceUrl: 'https://www.pdx.edu/admissions/deadlines',
    lastError:
      'No non-binding Early Action program — Portland State uses rolling admission with no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1v701fha85o1uajmrxi',
    schoolId: 'cmnwr8irn002pz0tihyw561a7',
    name: 'Texas Tech University',
    sourceUrl: 'https://www.depts.ttu.edu/admissions/apply/ImportantDates/',
    lastError:
      'No non-binding Early Action program — Texas Tech uses rolling admission with a Dec 1 priority/Early Decision deadline, no EA round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1lh019ka85o824tgh3q',
    schoolId: 'cmnwr8irt002tz0tiua8akwdq',
    name: 'San Jose State University',
    sourceUrl: 'https://www.sjsu.edu/admissions/freshman/index.php',
    lastError:
      'No Early Action program — SJSU is a CSU campus admitting via the single Cal State Apply cycle (Oct 1–Nov 30 filing period), no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1km018za85oyps2nj3r',
    schoolId: 'cmnwr8irs002sz0ti22brcgol',
    name: 'University of Nevada, Las Vegas',
    sourceUrl: 'https://www.unlv.edu/admissions/undergraduate/first-year',
    lastError:
      'No non-binding Early Action program — UNLV does not offer early action or early decision; first-year applicants apply by a July 1 fall deadline.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1y301h9a85oumr67dwh',
    schoolId: 'cmnwr8irq002rz0ti2ejl7chb',
    name: 'University of North Texas',
    sourceUrl: 'https://www.unt.edu/admissions/freshman/deadlines-fees.html',
    lastError:
      'No non-binding Early Action program — UNT uses rolling admission with a Mar 1 priority date, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2dq01qka85oc555ic8f',
    schoolId: 'cmnwr8iro002qz0tiayclu6c9',
    name: 'University of Idaho',
    sourceUrl: 'https://www.uidaho.edu/admissions-apply/first-year-students',
    lastError:
      'No non-binding Early Action program — University of Idaho uses rolling admission with no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn06a00hka85o6layk14g',
    schoolId: 'cmnwr8iry002wz0tiljzfdqu7',
    name: 'California State University, Long Beach',
    sourceUrl:
      'https://www.csulb.edu/admissions/first-time-first-year-student-application-process',
    lastError:
      'No Early Action program — CSULB is a CSU campus admitting via the single Cal State Apply cycle (Oct 1–Nov 30 filing period); CSULB does not offer Early Decision/Early Action.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn12700yla85onbr84jtj',
    schoolId: 'cmnwr8irv002uz0tic1bpn6g4',
    name: 'Bowling Green State University',
    sourceUrl:
      'https://www.bgsu.edu/admissions/apply-now/freshmen/application-instructions.html',
    lastError:
      'Uses rolling admission for first-year applicants; does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1990127a85oycfb9ie0',
    schoolId: 'cmnwr8irx002vz0ti8qpx4iws',
    name: 'California State University, Fullerton',
    sourceUrl: 'https://www.calstate.edu/apply/freshman',
    lastError:
      'No Early Action program — CSU Fullerton is a CSU campus admitting via the single Cal State Apply cycle (Oct 1–Nov 30 filing period), no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2er01r6a85o78zmfdi2',
    schoolId: 'cmnwr8is4002zz0ti7l7rukwt',
    name: 'South Dakota State University',
    sourceUrl: 'https://www.sdstate.edu/admissions/undergraduate-admissions',
    lastError:
      'No non-binding Early Action program — SDSU uses rolling admission with a Dec 1 academic-scholarship deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1t901e9a85oxv7715uj',
    schoolId: 'cmnwr8is3002yz0ti9qk8f21x',
    name: 'North Dakota State University',
    sourceUrl:
      'https://www.ndsu.edu/admission/how_to_apply/first_year/timeline',
    lastError:
      'No non-binding Early Action program — NDSU uses rolling admission with a Feb 1 scholarship priority deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0z800wsa85o5i064h4g',
    schoolId: 'cmnwr8isa0032z0tiytg48wsw',
    name: 'Wayne State University',
    sourceUrl: 'https://wayne.edu/admissions/freshman/deadlines',
    lastError:
      'No non-binding Early Action program — Wayne State uses rolling admission with a Dec 1 merit-scholarship priority deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1js018ea85odo7aptip',
    schoolId: 'cmnwr8is60030z0timvbtgjwa',
    name: 'University of Akron',
    sourceUrl: 'https://www.uakron.edu/admissions/undergraduate/deadlines.dot',
    lastError:
      'No non-binding Early Action program — University of Akron uses rolling admission with no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2p701x9a85ouh42131s',
    schoolId: 'cmnwr8isc0033z0tibp1hnmdi',
    name: 'University of Massachusetts Lowell',
    sourceUrl: 'https://www.uml.edu/admissions/apply/fees-deadlines.aspx',
    lastError:
      'Has non-binding Early Action (EA Nov 5, EA II Jan 5) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1tq01eka85ow1bksc5w',
    schoolId: 'cmnwr8isf0035z0tixudqprxr',
    name: 'New Mexico State University',
    sourceUrl: 'https://admissions.nmsu.edu/how-to-apply/first-time-freshmen/',
    lastError:
      'No non-binding Early Action program — NMSU uses a rolling/open-admission cycle, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn23u01kga85oufe7eysy',
    schoolId: 'cmnwr8ish0036z0tiy3l6tt76',
    name: 'California State University, Northridge',
    sourceUrl: 'https://www.calstate.edu/apply/freshman',
    lastError:
      'No Early Action program — CSU Northridge is a CSU campus admitting via the single Cal State Apply cycle (Oct 1–Nov 30 filing period), no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2f901rha85oapiwu9r5',
    schoolId: 'cmnwr8ise0034z0tiwz772kaw',
    name: 'Oklahoma State University',
    sourceUrl: 'https://go.okstate.edu/admissions/freshman/dates-deadlines',
    lastError:
      'No non-binding Early Action program — Oklahoma State uses rolling admission with a Nov 1 Early Opportunity Scholarship deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzxg00d2a85o85smbbio',
    schoolId: 'cmnwr8isj0037z0tihc4cw8ue',
    name: 'University of Southern Mississippi',
    sourceUrl: 'https://www.usm.edu/undergraduate-admissions/freshmen.php',
    lastError:
      'No non-binding Early Action program — Southern Miss uses rolling admission with a priority application deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2fq01rsa85olplcnsrk',
    schoolId: 'cmnwr8isl0038z0ti3vw64w98',
    name: 'Northern Illinois University',
    sourceUrl: 'https://www.niu.edu/admissions/apply/deadlines/index.shtml',
    lastError:
      'No non-binding Early Action program — NIU uses a rolling-style cycle (fall deadline May 1), no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1u701eva85otdlovi6z',
    schoolId: 'cmnwr8isn0039z0tik49prelk',
    name: 'Eastern Michigan University',
    sourceUrl: 'https://www.emich.edu/admissions/first-year/index.php',
    lastError:
      'No non-binding Early Action program — Eastern Michigan uses rolling admission with a Mar 1 priority deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1w501g3a85o4r6swqr5',
    schoolId: 'cmnwr8iso003az0tilgsdacqo',
    name: 'University of Wisconsin-Milwaukee',
    sourceUrl:
      'https://catalog.uwm.edu/admission-costs/undergraduate-admission/',
    lastError:
      'No non-binding Early Action program — UW-Milwaukee uses rolling admission with a Mar 1 priority deadline, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1570104a85ok9gcx8rs',
    schoolId: 'cmnwr8isz003fz0tisq77swxo',
    name: 'University of Texas at San Antonio',
    sourceUrl: 'https://future.utsa.edu/freshman/admissions/',
    lastError:
      'No general non-binding Early Action program — UTSA reviews first-year applicants by a Jan 15 fall deadline ("Early Admission" is a dual-enrollment program for current high schoolers), no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzxz00dda85odrmkbmhm',
    schoolId: 'cmnwr8isv003ez0timrhbjznd',
    name: 'University of Memphis',
    sourceUrl: 'https://www.memphis.edu/admissions/basics/deadlines.php',
    lastError:
      'No non-binding Early Action program — University of Memphis uses rolling, space-available admission with a Dec 1 scholarship priority date, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0if00n4a85o0bq9yp8t',
    schoolId: 'cmnwr8isu003dz0tijwn1m0s0',
    name: 'University of Texas at Arlington',
    sourceUrl: 'https://www.uta.edu/admissions/apply/when-to-apply',
    lastError:
      'Has a non-binding Early Action option (Feb 14 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn25a01lba85ovj1mlayc',
    schoolId: 'cmnwr8iss003cz0tia71q9qy1',
    name: 'Idaho State University',
    sourceUrl: 'https://www.isu.edu/admissions/freshman/',
    lastError:
      'No non-binding Early Action program — Idaho State uses rolling admission with no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmziv003ya85oxcw4fpyc',
    schoolId: 'cmnwr8it2003gz0tixy0e9ok2',
    name: 'Cleveland State University',
    sourceUrl: 'https://engagecsu.com/freshmen',
    lastError:
      'Uses rolling admission for first-year applicants (Aug 15 deadline, Mar 1 scholarship priority); does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2g501s3a85ov0smkt63',
    schoolId: 'cmnwr8it5003hz0tie38swawv',
    name: 'Florida International University',
    sourceUrl: 'https://admissions.fiu.edu/how-to-apply/freshman-applicant/',
    lastError:
      'Has non-binding Early Action (Nov 3 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2h701spa85or3x0ier6',
    schoolId: 'cmnwr8ite003jz0tijg7j0avf',
    name: 'University of Massachusetts Boston',
    sourceUrl: 'https://www.umb.edu/admissions/first-year-students/apply/',
    lastError:
      'Has non-binding Early Action (EA I Nov 1, EA II Jan 1) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1mw01aga85oovo67uj1',
    schoolId: 'cmnwr8ita003iz0ti7ezibmu3',
    name: 'Georgia State University',
    sourceUrl: 'https://admissions.gsu.edu/timeline/',
    lastError:
      'Has non-binding Early Action (Nov 15 deadline) but does not publish a round-specific EA admit rate — GSU admits on a rolling basis with no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2go01sea85oyjn36wkk',
    schoolId: 'cmnwr8iti003lz0ti0z9hwm3s',
    name: 'Wright State University',
    sourceUrl:
      'https://www.wright.edu/admissions/undergraduate/dates-and-deadlines',
    lastError:
      'No non-binding Early Action program — Wright State uses rolling admission and offers only a binding Early Decision (Dec 1), no EA round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1wm01gea85oksu6g3c1',
    schoolId: 'cmnwr8itg003kz0tikwvhzllw',
    name: 'Old Dominion University',
    sourceUrl: 'https://www.odu.edu/admission/undergraduate',
    lastError:
      'Has non-binding Early Action (Dec 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn14l00zta85ogidkrtnl',
    schoolId: 'cmnwr8itk003mz0tirfyu068c',
    name: 'Central Michigan University',
    sourceUrl:
      'https://www.cmich.edu/admissions-aid/undergraduate/freshmen/how-to-apply',
    lastError:
      'Uses rolling admission with a Nov 1 scholarship priority date and mid-December decision release; does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1up01f6a85ohh058ctk',
    schoolId: 'cmnwr8itm003nz0tiqazikwxi',
    name: 'Indiana University-Purdue University Indianapolis',
    sourceUrl: 'https://indianapolis.iu.edu/admissions/apply/dates/',
    lastError:
      'No non-binding Early Action program — IU Indianapolis uses rolling admission (Dec 15 Honors-consideration date), no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn26n01m6a85ozquh2ndl',
    schoolId: 'cmnwr8ito003oz0tiyojti719',
    name: 'Wichita State University',
    sourceUrl:
      'https://www.wichita.edu/admissions/undergraduate/blog/2022/09_20_Dates_and_Deadlines.php',
    lastError:
      'No non-binding Early Action program — Wichita State uses rolling admission with a Dec 1 scholarship priority date, no EA/ED round.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2lk01v8a85oictcmcde',
    schoolId: 'cmnwr8iwn0053z0tiokrlwt8f',
    name: 'Appalachian State University',
    sourceUrl: 'https://www.appstate.edu/undergrad-deadlines/',
    lastError:
      'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — App State reviews on a rolling basis with no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1730110a85o90440oow',
    schoolId: 'cmnwr8iwp0054z0tic1mh49ba',
    name: 'James Madison University',
    sourceUrl:
      'https://www.jmu.edu/admissions/apply/first-year/early-action.shtml',
    lastError:
      'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1o801bba85o752cr9oi',
    schoolId: 'cmnwr8iwq0055z0tivbkk0qbk',
    name: 'University of North Carolina Wilmington',
    sourceUrl: 'https://uncw.edu/admissions/undergraduate/first-year/deadlines',
    lastError:
      'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0by00jxa85oxuae3w09',
    schoolId: 'cmnwr8iws0056z0tial92bfrt',
    name: 'Grand Valley State University',
    sourceUrl:
      'https://www.gvsu.edu/admissions/undergraduate-admissions-requirements-30.htm',
    lastError:
      'No non-binding Early Action program — Grand Valley uses rolling admission and offers no early decision or early action.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzvp00bva85oox69sl38',
    schoolId: 'cmnwr8iwt0057z0ti6f0z2hsc',
    name: 'Towson University',
    sourceUrl:
      'https://www.towson.edu/admissions/undergrad/freshmen/deadlines.html',
    lastError:
      'Has non-binding Early Action (Nov 1 deadline) but does not publish a round-specific EA admit rate — no EA/RD breakdown disclosed.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0rt00s2a85og83ocj3l',
    schoolId: 'cmnwr8iwv0058z0tivh6huv4n',
    name: 'California State University, Sacramento',
    sourceUrl:
      'https://www.csus.edu/apply/admissions/application-process/freshman-process.html',
    lastError:
      'No Early Action program — Sacramento State is a CSU campus admitting via the single Cal State Apply cycle with a Nov 30 priority deadline, no EA/ED round.',
  },
];

function isClosed(t: BatchTarget): t is ClosedTarget {
  return t.status === 'CLOSED';
}

async function main() {
  const closed = BATCH.filter(isClosed);
  console.log(
    `[closure-v2-ea-agent-6] batch=${BATCH.length}  CLOSED=${closed.length}  ` +
      `UNAVAILABLE=${BATCH.filter((t) => t.status === 'UNAVAILABLE').length}  ` +
      `FAILED=${BATCH.filter((t) => t.status === 'FAILED').length}  (fetchedAt=${FETCHED_AT})\n`,
  );

  // Sanity: no duplicate target IDs.
  const ids = BATCH.map((t) => t.targetId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate targetId in batch');
  }

  // Range gate guard — fail loudly rather than write a bad number.
  for (const t of closed) {
    if (t.value < 1 || t.value > 90) {
      throw new Error(
        `Range gate violation: ${t.name} eaAcceptanceRate=${t.value} (must be 1–90)`,
      );
    }
  }

  let schoolsUpdated = 0;
  let targetsUpdated = 0;

  for (const t of BATCH) {
    // 1) For CLOSED: write School.eaAcceptanceRate + merge provenance.
    if (isClosed(t)) {
      const school = await prisma.school.findUnique({
        where: { id: t.schoolId },
        select: { id: true, name: true, metadata: true },
      });

      if (!school) {
        console.warn(`  SKIP school ${t.name}: id ${t.schoolId} not found`);
      } else {
        const existingMetadata =
          school.metadata &&
          typeof school.metadata === 'object' &&
          !Array.isArray(school.metadata)
            ? (school.metadata as Record<string, unknown>)
            : {};

        const existingProvenance =
          existingMetadata.provenance &&
          typeof existingMetadata.provenance === 'object' &&
          !Array.isArray(existingMetadata.provenance)
            ? (existingMetadata.provenance as Record<string, unknown>)
            : {};

        const mergedMetadata: Prisma.InputJsonValue = {
          ...existingMetadata,
          provenance: {
            ...existingProvenance,
            eaAcceptanceRate: {
              value: t.value,
              sourceUrl: t.sourceUrl,
              fetchedAt: FETCHED_AT,
              verifiedBy: VERIFIED_BY,
              confidence: t.confidence,
              tier: t.tier,
            },
          },
        };

        await prisma.school.update({
          where: { id: t.schoolId },
          data: {
            eaAcceptanceRate: new Prisma.Decimal(t.value),
            metadata: mergedMetadata,
          },
        });
        schoolsUpdated += 1;
        console.log(`  OK   ${t.name} => ${t.value}%  [${t.sourceUrl}]`);
      }
    } else {
      console.log(`  ${t.status.padEnd(11)} ${t.name} — ${t.lastError}`);
    }

    // 2) Every target: update its ClosureTarget row (DB-only table → raw SQL).
    const sourceUrl = isClosed(t) ? t.sourceUrl : (t.sourceUrl ?? null);
    const confidence = isClosed(t) ? t.confidence : (t.confidence ?? null);
    const tier = isClosed(t) ? t.tier : (t.tier ?? null);
    const lastError = isClosed(t) ? null : t.lastError;

    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = ${t.status}::"ClosureTargetStatus",
          "sourceUrl" = ${sourceUrl},
          confidence = ${confidence},
          tier = ${tier},
          attempts = attempts + 1,
          "lastAttemptAt" = ${new Date()},
          "lastError" = ${lastError},
          "updatedAt" = ${new Date()}
      WHERE id = ${t.targetId}
    `;
    targetsUpdated += 1;
  }

  console.log(
    `\n[closure-v2-ea-agent-6] done. ${schoolsUpdated} school rows updated, ` +
      `${targetsUpdated} closure targets updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-ea-agent-6] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

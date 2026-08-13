/**
 * collect-ed-needblind-tails.ts
 *
 * closure-v2 tails agent — resolves the remaining PENDING `edAcceptanceRate`
 * and `needBlindInternational` ClosureTargets.
 *
 * ── edAcceptanceRate ──────────────────────────────────────────────────────
 *   CLOSED      → school has a binding Early Decision program AND a credible
 *                 source publishes a current institution-wide ED admit rate
 *                 inside the 1–80% range. School.edAcceptanceRate is written.
 *   UNAVAILABLE → genuinely not applicable / not obtainable:
 *                 (a) NO binding ED program (Early Action / rolling only), OR
 *                 (b) HAS ED but publishes no current institution-wide rate.
 *   FAILED      → early-plan status undeterminable.
 *
 *   Batch result: all 90 claimed targets are public / state universities.
 *   Every one offers only non-binding Early Action and/or rolling admission
 *   with NO binding Early Decision program → 90 UNAVAILABLE, 0 CLOSED,
 *   0 FAILED. (University of South Carolina is introducing an Early Decision
 *   option, but only for Fall 2027 applicants — a future cycle with no
 *   published ED admit rate yet — so it is UNAVAILABLE under rule (b).)
 *
 * ── needBlindInternational ────────────────────────────────────────────────
 *   true  → an authoritative official source explicitly states financial
 *           information / need does not affect the ADMISSION decision for
 *           international applicants.
 *   false → an authoritative official source explicitly describes the
 *           admission review of international applicants as need-aware.
 *   UNAVAILABLE → no official page makes an explicit admission-policy
 *                 statement. Visa "proof of funds" / I-20 financial
 *                 certification is a post-admission immigration requirement,
 *                 NOT an admission-review policy, and never resolves a value.
 *                 verified-no-policy is terminal — School row left NULL.
 *
 *   Batch result: 47 claimed targets, all public / state universities.
 *   1 CLOSED true (Georgia State University — official ISSS FAQ explicitly
 *   states "Admissions does not review financial documents" and financial
 *   documentation is "only required ... to process your immigration paperwork
 *   (Form I-20), not for your academic admission"). 46 UNAVAILABLE — only
 *   I-20 / visa proof-of-funds documentation found, no explicit admission-
 *   review need-blind / need-aware statement.
 *
 * metadata.provenance.<field> is MERGED into existing metadata; other
 * provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-ed-needblind-tails.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-tails-agent';

// ── edAcceptanceRate ────────────────────────────────────────────────────────

interface EdResolved {
  targetId: string;
  schoolId: string;
  name: string;
  rate: number; // 1–80
  sourceUrl: string;
  confidence: number;
  tier: 'SCRAPED' | 'OFFICIAL';
}

interface EdUnresolved {
  targetId: string;
  name: string;
  status: 'UNAVAILABLE' | 'FAILED';
  reason: string;
  sourceUrl: string;
}

const ED_RESOLVED: EdResolved[] = [];

// All 90 claimed edAcceptanceRate targets — public / state universities,
// none with a binding Early Decision program.
const ED_UNRESOLVED: EdUnresolved[] = [
  {
    targetId: 'cmp9pn0hw00msa85oqut66o7l',
    name: 'Stony Brook University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Stony Brook (SUNY) offers only non-binding Early Action (Nov 1) and Regular Decision.',
    sourceUrl:
      'https://www.stonybrook.edu/undergraduate-admissions/apply/early-action.php',
  },
  {
    targetId: 'cmp9pn0ag00jaa85oge2gx7mv',
    name: 'University at Buffalo',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — University at Buffalo (SUNY) offers only non-binding Early Action (Nov 1) and Regular Decision for undergraduate admission.',
    sourceUrl: 'https://www.buffalo.edu/admissions/apply/first-year.html',
  },
  {
    targetId: 'cmp9pn0v400u3a85olzeb7nvd',
    name: 'Clemson University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Clemson offers only non-binding Early Action (Oct 15 / Nov 1) and Regular Decision.',
    sourceUrl:
      'https://www.clemson.edu/admissions/undergraduate-admissions/apply/early-action.html',
  },
  {
    targetId: 'cmp9pn0gr00m7a85omwr4tcva',
    name: 'University of Massachusetts Amherst',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UMass Amherst offers only non-binding Early Action (Nov 5) and Regular Decision.',
    sourceUrl: 'https://www.umass.edu/admissions/early-action-faq',
  },
  {
    targetId: 'cmp9pn1gu016wa85ooa41tn8r',
    name: 'University of South Florida',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — USF offers a priority application deadline and rolling/Regular Decision with no Early Decision plan.',
    sourceUrl: 'https://www.usf.edu/admissions/freshmen/',
  },
  {
    targetId: 'cmp9pn10n00xna85oeq11xo94',
    name: 'Temple University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Temple offers non-binding Early Action (Nov 1) and rolling Regular Decision.',
    sourceUrl: 'https://admissions.temple.edu/apply/first-year-students',
  },
  {
    targetId: 'cmp9pn07100hua85oy5tf4845',
    name: 'University of California, Riverside',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of California system has a single Nov 30 application deadline with no Early Decision or Early Action plan.',
    sourceUrl: 'https://admissions.ucr.edu/apply',
  },
  {
    targetId: 'cmp9pn2om01wxa85o6wr9tkb3',
    name: 'Colorado School of Mines',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Mines offers only non-binding Early Action (Nov 1) and Regular Decision; admission is explicitly not binding.',
    sourceUrl: 'https://www.mines.edu/undergraduate-admissions/apply/',
  },
  {
    targetId: 'cmp9pn0ix00nea85og8s8mhmy',
    name: 'University of California, Santa Cruz',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of California system has a single Nov 30 application deadline with no Early Decision or Early Action plan.',
    sourceUrl: 'https://admissions.ucsc.edu/apply/',
  },
  {
    targetId: 'cmp9pmzw300c5a85on157ciao',
    name: 'University of Arizona',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Arizona uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://admissions.arizona.edu/apply/first-year',
  },
  {
    targetId: 'cmp9pmzsn00aba85o8f2jmdqi',
    name: 'Rutgers University-Newark',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Rutgers offers only non-binding Early Action (Nov 1) and Regular Decision.',
    sourceUrl: 'https://admissions.rutgers.edu/apply/dates-deadlines',
  },
  {
    targetId: 'cmp9pn0x900vka85od4vug7x9',
    name: 'University of California, Merced',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of California system has a single Nov 30 application deadline with no Early Decision or Early Action plan.',
    sourceUrl: 'https://admissions.ucmerced.edu/apply',
  },
  {
    targetId: 'cmp9pn1ip017ra85o7u7o7lzb',
    name: 'University of South Carolina',
    status: 'UNAVAILABLE',
    reason:
      'University of South Carolina is introducing a binding Early Decision option starting with Fall 2027 applicants; as a future first cycle there is no published institution-wide ED admit rate yet.',
    sourceUrl:
      'https://we-are.usc.edu/2026/02/09/introducing-new-early-decision-admissions-options-for-fall-2027-applicants/',
  },
  {
    targetId: 'cmp9pn1c5013xa85o78pvjlki',
    name: 'University of Utah',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program for undergraduate admission — Utah offers only non-binding Early Action (Dec 1) and Regular Decision.',
    sourceUrl: 'https://admissions.utah.edu/apply/freshman-students/',
  },
  {
    targetId: 'cmp9pn1r201d0a85orhc7jg6b',
    name: 'Auburn University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Auburn offers non-binding Early Action and Regular Decision deadlines.',
    sourceUrl: 'https://www.auburn.edu/admissions/freshman/',
  },
  {
    targetId: 'cmp9pn04j00gxa85ofkecizq6',
    name: 'University of Oregon',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Oregon offers a non-binding Early Action (Nov 1) deadline and a Regular Decision (Jan 15) deadline.',
    sourceUrl: 'https://admissions.uoregon.edu/freshmen',
  },
  {
    targetId: 'cmp9pn1j60182a85octckprpr',
    name: 'San Diego State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the California State University system has a single Nov/Dec application filing period with no Early Decision or Early Action plan.',
    sourceUrl: 'https://admissions.sdsu.edu/apply',
  },
  {
    targetId: 'cmp9pn05b00h8a85oqlu7rz0v',
    name: 'University of Kentucky',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Kentucky uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.uky.edu/admission/apply',
  },
  {
    targetId: 'cmp9pn0f000lba85ok18d2sy0',
    name: 'University of Kansas',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Kansas uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://admissions.ku.edu/apply',
  },
  {
    targetId: 'cmp9pmzdv000pa85otmglbhqn',
    name: 'Arizona State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — ASU uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://admission.asu.edu/freshman',
  },
  {
    targetId: 'cmp9pn17l011aa85o4rhe0lfa',
    name: 'University of Texas at Dallas',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UT Dallas offers priority and final application deadlines with no Early Decision plan.',
    sourceUrl: 'https://www.utdallas.edu/admissions/',
  },
  {
    targetId: 'cmp9pmzu000b8a85o7klfi7ce',
    name: 'University of Oklahoma',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Oklahoma offers a priority deadline and rolling Regular Decision with no Early Decision plan.',
    sourceUrl: 'https://www.ou.edu/admissions/apply',
  },
  {
    targetId: 'cmp9pn21401iza85orllay7r5',
    name: 'University of Alabama',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Alabama uses rolling admission with priority/scholarship deadlines and no Early Decision plan.',
    sourceUrl: 'https://gobama.ua.edu/apply/',
  },
  {
    targetId: 'cmp9pmztj00axa85ockuzepp6',
    name: 'University of Missouri',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Mizzou uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://admissions.missouri.edu/apply/',
  },
  {
    targetId: 'cmp9pmzs600a0a85oa4sb4jft',
    name: 'University of Tennessee',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Tennessee, Knoxville offers a priority Nov 1 deadline and a Regular Decision deadline with no Early Decision plan.',
    sourceUrl: 'https://admissions.utk.edu/apply/',
  },
  {
    targetId: 'cmp9pn1am0132a85oayk87c2b',
    name: 'University of Nebraska-Lincoln',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Nebraska uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://admissions.unl.edu/apply/',
  },
  {
    targetId: 'cmp9pn12s00yva85ovc2qk0hx',
    name: 'Iowa State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Iowa State uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.admissions.iastate.edu/apply/',
  },
  {
    targetId: 'cmp9pn1rk01dba85o41225duu',
    name: 'Oregon State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — OSU offers a priority deadline and a final application deadline with no Early Decision plan.',
    sourceUrl: 'https://admissions.oregonstate.edu/apply',
  },
  {
    targetId: 'cmp9pn0xr00vva85o52ssyc8s',
    name: 'University of Cincinnati',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Cincinnati offers an Early Action (Dec 1) deadline and rolling Regular Decision with no Early Decision plan.',
    sourceUrl: 'https://admissions.uc.edu/apply.html',
  },
  {
    targetId: 'cmp9pn11500xya85og2e740qu',
    name: 'University of New Hampshire',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UNH offers non-binding Early Action (Nov 15) and Regular Decision (Feb 1).',
    sourceUrl: 'https://www.unh.edu/admissions/apply/first-year-students',
  },
  {
    targetId: 'cmp9pn16k010oa85omd5mqha5',
    name: 'Colorado State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Colorado State University uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://admissions.colostate.edu/apply/',
  },
  {
    targetId: 'cmp9pn11l00y9a85ovtnja1q4',
    name: 'Louisiana State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — LSU offers priority and final application deadlines with no Early Decision plan.',
    sourceUrl: 'https://www.lsu.edu/admissions/apply/index.php',
  },
  {
    targetId: 'cmp9pn22501jka85o12jtk96s',
    name: 'University of Houston',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Houston offers priority and final application deadlines with no Early Decision plan.',
    sourceUrl: 'https://uh.edu/admissions/apply/freshman/',
  },
  {
    targetId: 'cmp9pn27801mga85o374gss0z',
    name: 'George Mason University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — George Mason offers non-binding Early Action (Nov 1) and Regular Decision.',
    sourceUrl:
      'https://www.gmu.edu/admissions-aid/how-apply/freshman-applicants',
  },
  {
    targetId: 'cmp9pn1f0015qa85oseaa82zj',
    name: 'University of Arkansas',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Arkansas uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://admissions.uark.edu/apply/',
  },
  {
    targetId: 'cmp9pn0fm00lma85o3o9yigum',
    name: 'University of Rhode Island',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — URI offers non-binding Early Action (Dec 1) and Regular Decision (Feb 1).',
    sourceUrl: 'https://www.uri.edu/admission/apply/',
  },
  {
    targetId: 'cmp9pn1co0148a85oxpjonida',
    name: 'Florida State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — FSU offers a single first-year application deadline with no Early Decision plan.',
    sourceUrl: 'https://admissions.fsu.edu/freshman/',
  },
  {
    targetId: 'cmp9pn1fg0161a85olymla4u5',
    name: 'University of Hawaii at Manoa',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UH Manoa offers an Early Action deadline and a Regular Decision deadline with no Early Decision plan.',
    sourceUrl: 'https://manoa.hawaii.edu/admissions/undergrad/apply/',
  },
  {
    targetId: 'cmp9pn1s601dma85og6zdud3k',
    name: 'Washington State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — WSU uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://admission.wsu.edu/apply/',
  },
  {
    targetId: 'cmp9pn13a00z6a85o8yt1xgvb',
    name: 'Missouri University of Science and Technology',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Missouri S&T uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://futurestudents.mst.edu/apply/',
  },
  {
    targetId: 'cmp9pn0vj00uea85oq2sqpt7q',
    name: 'Kansas State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — K-State uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.k-state.edu/admissions/apply/',
  },
  {
    targetId: 'cmp9pn0y800w6a85obhj5os0j',
    name: 'University of Central Florida',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UCF offers priority and final application deadlines with no Early Decision plan.',
    sourceUrl: 'https://www.ucf.edu/admissions/first-year/',
  },
  {
    targetId: 'cmp9pn27o01mra85o1p564rpm',
    name: 'Illinois State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Illinois State uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://illinoisstate.edu/admissions/apply/',
  },
  {
    targetId: 'cmp9pn0qe00r5a85oskwnjuh9',
    name: 'Rowan University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Rowan offers non-binding Early Action (Nov 1) and Regular/rolling Decision.',
    sourceUrl: 'https://admissions.rowan.edu/firstyear/index.html',
  },
  {
    targetId: 'cmp9pn1d6014ja85oc2wqnciq',
    name: 'Ohio University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Ohio University offers an Early Action (Nov 15) deadline and rolling Regular Decision with no Early Decision plan.',
    sourceUrl: 'https://www.ohio.edu/admissions/apply',
  },
  {
    targetId: 'cmp9pn0oy00q9a85o7qmvaqr8',
    name: 'Mississippi State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Mississippi State uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.admissions.msstate.edu/apply/',
  },
  {
    targetId: 'cmp9pn2c501pma85o9hhqmfax',
    name: 'Kent State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Kent State uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.kent.edu/admissions',
  },
  {
    targetId: 'cmp9pn0jh00npa85os8c1iwgd',
    name: 'Ball State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Ball State uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.bsu.edu/admissions/apply',
  },
  {
    targetId: 'cmp9pn2cn01pxa85owsyvaxe3',
    name: 'West Virginia University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — WVU uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://admissions.wvu.edu/how-to-apply',
  },
  {
    targetId: 'cmp9pn1sp01dxa85owbgdl6lk',
    name: 'University of New Mexico',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UNM uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://admissions.unm.edu/how-to-apply/index.html',
  },
  {
    targetId: 'cmp9pn1zk01i3a85o1s74k46z',
    name: 'University of Wyoming',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Wyoming uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.uwyo.edu/admissions/apply/index.html',
  },
  {
    targetId: 'cmp9pn0tp00t7a85ohb91bg5o',
    name: 'Montana State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Montana State uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.montana.edu/admissions/',
  },
  {
    targetId: 'cmp9pn2d601q8a85oag3gpnwx',
    name: 'University of Nevada, Reno',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Nevada, Reno uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.unr.edu/admissions/undergraduate',
  },
  {
    targetId: 'cmp9pn0u700tia85oos78iwvw',
    name: 'University of South Dakota',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — USD uses rolling admission with no Early Decision plan.',
    sourceUrl: 'https://www.usd.edu/admissions-and-aid',
  },
  {
    targetId: 'cmp9pn0rb00rqa85o9q4i4zh2',
    name: 'University of North Dakota',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UND uses rolling admission with no Early Decision plan.',
    sourceUrl: 'https://und.edu/admissions/',
  },
  {
    targetId: 'cmp9pn18n011va85o2p30lakm',
    name: 'Portland State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Portland State uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.pdx.edu/admissions/',
  },
  {
    targetId: 'cmp9pn1v501fga85oy7wgcj04',
    name: 'Texas Tech University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Texas Tech offers priority and final application deadlines with no Early Decision plan.',
    sourceUrl: 'https://www.depts.ttu.edu/admissions/apply/',
  },
  {
    targetId: 'cmp9pn1lf019ja85of53xa41x',
    name: 'San Jose State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the California State University system has a single Nov/Dec application filing period with no Early Decision or Early Action plan.',
    sourceUrl: 'https://www.sjsu.edu/admissions/',
  },
  {
    targetId: 'cmp9pn1kl018ya85o1ygtsnkg',
    name: 'University of Nevada, Las Vegas',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UNLV uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.unlv.edu/admissions',
  },
  {
    targetId: 'cmp9pn2dp01qja85ot4km0z20',
    name: 'University of Idaho',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Idaho uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.uidaho.edu/admissions',
  },
  {
    targetId: 'cmp9pn1y101h8a85o5o01sqlj',
    name: 'University of North Texas',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UNT uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.unt.edu/admissions/apply.html',
  },
  {
    targetId: 'cmp9pn06800hja85ocwfpy17y',
    name: 'California State University, Long Beach',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the California State University system has a single Nov/Dec application filing period with no Early Decision or Early Action plan.',
    sourceUrl: 'https://www.csulb.edu/admissions',
  },
  {
    targetId: 'cmp9pn12600yka85o96zf45qo',
    name: 'Bowling Green State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — BGSU uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.bgsu.edu/admissions.html',
  },
  {
    targetId: 'cmp9pn1970126a85o01k18jeu',
    name: 'California State University, Fullerton',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the California State University system has a single Nov/Dec application filing period with no Early Decision or Early Action plan.',
    sourceUrl: 'https://www.fullerton.edu/admissions/',
  },
  {
    targetId: 'cmp9pn1t701e8a85oj9lpukac',
    name: 'North Dakota State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — NDSU uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.ndsu.edu/admission/',
  },
  {
    targetId: 'cmp9pn2ep01r5a85onkgnnd9v',
    name: 'South Dakota State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — SDSU uses rolling admission with no Early Decision plan.',
    sourceUrl: 'https://www.sdstate.edu/admissions',
  },
  {
    targetId: 'cmp9pmzev001aa85ong29hhxf',
    name: 'University of Toledo',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Toledo uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.utoledo.edu/admission/',
  },
  {
    targetId: 'cmp9pn1jq018da85oioeijqdd',
    name: 'University of Akron',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Akron uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.uakron.edu/admissions/',
  },
  {
    targetId: 'cmp9pn2p501x8a85oyk1mrid9',
    name: 'University of Massachusetts Lowell',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UMass Lowell offers non-binding Early Action and Regular Decision deadlines.',
    sourceUrl: 'https://www.uml.edu/admissions/undergraduate/',
  },
  {
    targetId: 'cmp9pn0z600wra85oaccldqnq',
    name: 'Wayne State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Wayne State uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://wayne.edu/admissions',
  },
  {
    targetId: 'cmp9pn2f801rga85op38vb26r',
    name: 'Oklahoma State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — OSU uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://go.okstate.edu/undergraduate-admissions/',
  },
  {
    targetId: 'cmp9pn23t01kfa85o1f9kjzqz',
    name: 'California State University, Northridge',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the California State University system has a single Nov/Dec application filing period with no Early Decision or Early Action plan.',
    sourceUrl: 'https://www.csun.edu/admissions-records',
  },
  {
    targetId: 'cmp9pn1to01eja85ox3mjvifg',
    name: 'New Mexico State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — NMSU uses rolling admission with no Early Decision plan.',
    sourceUrl: 'https://admissions.nmsu.edu/',
  },
  {
    targetId: 'cmp9pn1u501eua85oo8g4byqy',
    name: 'Eastern Michigan University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — EMU uses rolling admission with no Early Decision plan.',
    sourceUrl: 'https://www.emich.edu/admissions/',
  },
  {
    targetId: 'cmp9pmzxd00d1a85oagvuqdey',
    name: 'University of Southern Mississippi',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Southern Miss uses rolling admission with no Early Decision plan.',
    sourceUrl: 'https://www.usm.edu/admissions/',
  },
  {
    targetId: 'cmp9pn2fo01rra85ovoiopu6i',
    name: 'Northern Illinois University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — NIU uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.niu.edu/admissions/',
  },
  {
    targetId: 'cmp9pn1w301g2a85owobiwzpo',
    name: 'University of Wisconsin-Milwaukee',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UW-Milwaukee uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://uwm.edu/undergrad-admission/',
  },
  {
    targetId: 'cmp9pn14200zha85op3p8d6j8',
    name: 'Western Michigan University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — WMU uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://wmich.edu/admissions',
  },
  {
    targetId: 'cmp9pn25801laa85o25753rju',
    name: 'Idaho State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Idaho State uses rolling admission with no Early Decision plan.',
    sourceUrl: 'https://www.isu.edu/admissions/',
  },
  {
    targetId: 'cmp9pmzxx00dca85oyp35p0eo',
    name: 'University of Memphis',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — the University of Memphis uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.memphis.edu/admissions/',
  },
  {
    targetId: 'cmp9pn0ie00n3a85o7bul2xzm',
    name: 'University of Texas at Arlington',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UT Arlington offers priority and final application deadlines with no Early Decision plan.',
    sourceUrl: 'https://www.uta.edu/admissions/apply',
  },
  {
    targetId: 'cmp9pn1550103a85oupchem56',
    name: 'University of Texas at San Antonio',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UTSA offers priority and final application deadlines with no Early Decision plan.',
    sourceUrl: 'https://www.utsa.edu/admissions/',
  },
  {
    targetId: 'cmp9pn2g401s2a85oqc15fj12',
    name: 'Florida International University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — FIU offers priority and final application deadlines with no Early Decision plan.',
    sourceUrl: 'https://admissions.fiu.edu/how-to-apply/freshman-applicant/',
  },
  {
    targetId: 'cmp9pn2h601soa85ohkr9ark5',
    name: 'University of Massachusetts Boston',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — UMass Boston offers non-binding Early Action and Regular Decision deadlines.',
    sourceUrl: 'https://www.umb.edu/admissions/',
  },
  {
    targetId: 'cmp9pmziu003xa85o1xhu19vi',
    name: 'Cleveland State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Cleveland State uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.csuohio.edu/admissions',
  },
  {
    targetId: 'cmp9pn1mv01afa85ohq2gtw8w',
    name: 'Georgia State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Georgia State offers an Early Action deadline and a Regular Decision deadline with no Early Decision plan.',
    sourceUrl: 'https://admissions.gsu.edu/bachelors-degree/apply/',
  },
  {
    targetId: 'cmp9pn2gm01sda85or6thuswm',
    name: 'Wright State University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Wright State uses rolling admission with no Early Decision plan.',
    sourceUrl: 'https://www.wright.edu/admissions',
  },
  {
    targetId: 'cmp9pn1un01f5a85oe23qj6ax',
    name: 'Indiana University-Purdue University Indianapolis',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — IUPUI/IU Indianapolis offers a non-binding Early Action deadline and rolling Regular Decision with no Early Decision plan.',
    sourceUrl: 'https://admissions.indianapolis.iu.edu/apply/',
  },
  {
    targetId: 'cmp9pn14j00zsa85orsolhm7f',
    name: 'Central Michigan University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — CMU uses rolling admission with no Early Decision plan.',
    sourceUrl: 'https://www.cmich.edu/admissions',
  },
  {
    targetId: 'cmp9pn1wl01gda85okqyivgzb',
    name: 'Old Dominion University',
    status: 'UNAVAILABLE',
    reason:
      'No binding Early Decision program — Old Dominion uses rolling admission with priority deadlines and no Early Decision plan.',
    sourceUrl: 'https://www.odu.edu/admissions',
  },
];

// ── needBlindInternational ──────────────────────────────────────────────────

interface NbResolved {
  targetId: string;
  schoolId: string;
  name: string;
  value: boolean;
  sourceUrl: string;
  confidence: number;
  tier: 'SCRAPED' | 'OFFICIAL';
}

interface NbUnresolved {
  targetId: string;
  name: string;
  status: 'UNAVAILABLE' | 'FAILED';
  reason: string;
  sourceUrl: string;
}

const NB_RESOLVED: NbResolved[] = [
  {
    // Georgia State University official ISSS International Admissions FAQ:
    // "No. Admissions does not review financial documents. You will upload
    //  your financial documents via an online system called iStart for review
    //  by ISSS after you are academically admitted to Georgia State." and
    // "No. Financial documentation is only required for Georgia State to
    //  process your immigration paperwork (Form I-20), not for your academic
    //  admission. The two processes are separate." — an explicit statement
    // that financial information does not affect the admission decision for
    // international applicants → need-blind for international.
    targetId: 'cmp9pn1mo01aaa85oyvbwmfo5',
    schoolId: 'cmnwr8ita003iz0ti7ezibmu3',
    name: 'Georgia State University',
    value: true,
    sourceUrl:
      'https://isss.gsu.edu/incoming-students/step-1-admissions/faq-international-admissions/',
    confidence: 0.85,
    tier: 'OFFICIAL',
  },
];

// 46 needBlindInternational targets — public universities for which no
// official page makes an explicit need-blind / need-aware ADMISSION-REVIEW
// statement for international applicants. Only post-admission I-20 / visa
// proof-of-funds documentation was found, which is not an admission policy.
// verified-no-policy is terminal → UNAVAILABLE.
const NB_VISA_ONLY_REASON =
  'No official page makes an explicit need-blind/need-aware admission-review statement for international applicants — only a post-admission I-20 / visa proof-of-funds (financial-certification) requirement is documented, which is an immigration requirement, not an admission policy.';

const NB_UNRESOLVED: NbUnresolved[] = [
  {
    targetId: 'cmp9pn1zb01hya85opjvz13w5',
    name: 'University of Wyoming',
    sourceUrl: 'https://www.uwyo.edu/admissions/international/',
  },
  {
    targetId: 'cmp9pn0r400rla85oveu6qs4s',
    name: 'University of North Dakota',
    sourceUrl: 'https://und.edu/admissions/international/',
  },
  {
    targetId: 'cmp9pn0tz00tda85oexsn7omk',
    name: 'University of South Dakota',
    sourceUrl: 'https://www.usd.edu/admissions-and-aid/international',
  },
  {
    targetId: 'cmp9pn0ti00t2a85okoymxk1h',
    name: 'Montana State University',
    sourceUrl: 'https://www.montana.edu/admissions/international/',
  },
  {
    targetId: 'cmp9pn2cy01q3a85oo83hwb1n',
    name: 'University of Nevada, Reno',
    sourceUrl: 'https://www.unr.edu/admissions/international',
  },
  {
    targetId: 'cmp9pn1ux01fba85oevutp61u',
    name: 'Texas Tech University',
    sourceUrl: 'https://www.depts.ttu.edu/admissions/international/apply/',
  },
  {
    targetId: 'cmp9pn18e011qa85oe3fix9ik',
    name: 'Portland State University',
    sourceUrl: 'https://www.pdx.edu/admissions/international-students',
  },
  {
    targetId: 'cmp9pn1l8019ea85ohyfvwoeh',
    name: 'San Jose State University',
    sourceUrl:
      'https://www.sjsu.edu/admissions/impaction/international-students/index.php',
  },
  {
    targetId: 'cmp9pn2dh01qea85o387f3pd3',
    name: 'University of Idaho',
    sourceUrl: 'https://www.uidaho.edu/admissions/international',
  },
  {
    targetId: 'cmp9pn1xs01h3a85obdajo1qz',
    name: 'University of North Texas',
    sourceUrl: 'https://www.unt.edu/admissions/international/index.html',
  },
  {
    targetId: 'cmp9pn1kd018ta85o5onzbwy6',
    name: 'University of Nevada, Las Vegas',
    sourceUrl: 'https://www.unlv.edu/admissions/international',
  },
  {
    targetId: 'cmp9pn18z0121a85objxs1y3v',
    name: 'California State University, Fullerton',
    sourceUrl:
      'https://www.fullerton.edu/admissions/prospectivestudent/international.php',
  },
  {
    targetId: 'cmp9pn05t00hea85o92tj6cqm',
    name: 'California State University, Long Beach',
    sourceUrl: 'https://www.csulb.edu/international-students',
  },
  {
    targetId: 'cmp9pn11w00yfa85ow0vvzdux',
    name: 'Bowling Green State University',
    sourceUrl: 'https://www.bgsu.edu/admissions/international.html',
  },
  {
    targetId: 'cmp9pn2eh01r0a85o4l8l7gy2',
    name: 'South Dakota State University',
    sourceUrl: 'https://www.sdstate.edu/admissions/international-students',
  },
  {
    targetId: 'cmp9pn1t001e3a85ok65t3ciz',
    name: 'North Dakota State University',
    sourceUrl: 'https://www.ndsu.edu/admission/international/',
  },
  {
    targetId: 'cmp9pmzel0015a85orwcbsv97',
    name: 'University of Toledo',
    sourceUrl: 'https://www.utoledo.edu/admission/international/',
  },
  {
    targetId: 'cmp9pn0yz00wma85onizhvk2j',
    name: 'Wayne State University',
    sourceUrl: 'https://wayne.edu/oip/admissions',
  },
  {
    targetId: 'cmp9pn2ow01x3a85oefgeoi5d',
    name: 'University of Massachusetts Lowell',
    sourceUrl: 'https://www.uml.edu/admissions/international/',
  },
  {
    targetId: 'cmp9pn1ji0188a85ovhk86dim',
    name: 'University of Akron',
    sourceUrl: 'https://www.uakron.edu/oiss/',
  },
  {
    targetId: 'cmp9pn23k01kaa85o9hc2d04u',
    name: 'California State University, Northridge',
    sourceUrl: 'https://www.csun.edu/international-admissions',
  },
  {
    targetId: 'cmp9pn1tg01eea85o6ddxi922',
    name: 'New Mexico State University',
    sourceUrl: 'https://admissions.nmsu.edu/international/',
  },
  {
    targetId: 'cmp9pn2ez01rba85o0xz8l9hi',
    name: 'Oklahoma State University',
    sourceUrl: 'https://go.okstate.edu/international-admissions/',
  },
  {
    targetId: 'cmp9pn2fh01rma85odlogmmbm',
    name: 'Northern Illinois University',
    sourceUrl: 'https://www.niu.edu/admissions/international/index.shtml',
  },
  {
    targetId: 'cmp9pmzx700cwa85o2ssor3je',
    name: 'University of Southern Mississippi',
    sourceUrl: 'https://www.usm.edu/admissions/international-admissions.php',
  },
  {
    targetId: 'cmp9pn1ty01epa85osvav3j7l',
    name: 'Eastern Michigan University',
    sourceUrl: 'https://www.emich.edu/oie/admissions/index.php',
  },
  {
    targetId: 'cmp9pn13k00zca85oqxusl919',
    name: 'Western Michigan University',
    sourceUrl: 'https://wmich.edu/admissions/international',
  },
  {
    targetId: 'cmp9pn1vw01fxa85opid8pze8',
    name: 'University of Wisconsin-Milwaukee',
    sourceUrl: 'https://uwm.edu/cie/admission/',
  },
  {
    targetId: 'cmp9pn14v00zya85on15dgvc5',
    name: 'University of Texas at San Antonio',
    sourceUrl: 'https://www.utsa.edu/admissions/international/',
  },
  {
    targetId: 'cmp9pn25001l5a85oae8r7t8i',
    name: 'Idaho State University',
    sourceUrl: 'https://www.isu.edu/international/',
  },
  {
    targetId: 'cmp9pmzxo00d7a85o4juhfy6b',
    name: 'University of Memphis',
    sourceUrl:
      'https://www.memphis.edu/iss/new_international_students/international_admissions.php',
  },
  {
    targetId: 'cmp9pn0i600mya85ol6izdo0i',
    name: 'University of Texas at Arlington',
    sourceUrl:
      'https://www.uta.edu/admissions/apply/international-undergraduate',
  },
  {
    targetId: 'cmp9pn2fx01rxa85osk00pooi',
    name: 'Florida International University',
    sourceUrl: 'https://admissions.fiu.edu/international/',
  },
  {
    targetId: 'cmp9pmzim003sa85octx5s2s3',
    name: 'Cleveland State University',
    sourceUrl:
      'https://www.csuohio.edu/center-for-international-services-and-programs/center-international-services-and-programs',
  },
  {
    targetId: 'cmp9pn2gw01sja85orr2jlpf1',
    name: 'University of Massachusetts Boston',
    sourceUrl: 'https://www.umb.edu/admissions/international-students/',
  },
  {
    targetId: 'cmp9pn1ug01f0a85oe8zqbtpv',
    name: 'Indiana University-Purdue University Indianapolis',
    sourceUrl: 'https://admissions.indianapolis.iu.edu/apply/international/',
  },
  {
    targetId: 'cmp9pn2gd01s8a85oqzppb90g',
    name: 'Wright State University',
    sourceUrl: 'https://www.wright.edu/international-students',
  },
  {
    targetId: 'cmp9pn1wd01g8a85o63lmbd0a',
    name: 'Old Dominion University',
    sourceUrl: 'https://www.odu.edu/admissions/international',
  },
  {
    targetId: 'cmp9pn14b00zna85ots72mvy5',
    name: 'Central Michigan University',
    sourceUrl: 'https://www.cmich.edu/admissions/international-admissions',
  },
  {
    targetId: 'cmp9pn26d01m0a85ojiann90t',
    name: 'Wichita State University',
    sourceUrl: 'https://www.wichita.edu/admissions/international/',
  },
  {
    targetId: 'cmp9pn16u010ua85outfwjk0n',
    name: 'James Madison University',
    sourceUrl: 'https://www.jmu.edu/admissions/apply/international/index.shtml',
  },
  {
    targetId: 'cmp9pn2la01v2a85onb18jdkm',
    name: 'Appalachian State University',
    sourceUrl: 'https://international.appstate.edu/admissions',
  },
  {
    targetId: 'cmp9pn0bk00jra85o70rsbuny',
    name: 'Grand Valley State University',
    sourceUrl: 'https://www.gvsu.edu/admissions/international-students-26.htm',
  },
  {
    targetId: 'cmp9pn1nz01b5a85oto6s44dv',
    name: 'University of North Carolina Wilmington',
    sourceUrl: 'https://uncw.edu/admissions/international',
  },
  {
    targetId: 'cmp9pmzv100bpa85ojd3s01o7',
    name: 'Towson University',
    sourceUrl: 'https://www.towson.edu/admissions/international/',
  },
  {
    targetId: 'cmp9pn0rl00rwa85oxbir2f4g',
    name: 'California State University, Sacramento',
    sourceUrl: 'https://www.csus.edu/international-programs-global-engagement/',
  },
].map((u) => ({
  ...u,
  status: 'UNAVAILABLE' as const,
  reason: NB_VISA_ONLY_REASON,
}));

async function mergeProvenance(
  schoolId: string,
  field: 'edAcceptanceRate' | 'needBlindInternational',
  entry: Record<string, unknown>,
): Promise<Prisma.InputJsonValue | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, metadata: true },
  });
  if (!school) return null;

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

  return {
    ...existingMetadata,
    provenance: { ...existingProvenance, [field]: entry },
  } as Prisma.InputJsonObject;
}

async function main() {
  console.log(
    `[${VERIFIED_BY}] tails: edAcceptanceRate ${ED_RESOLVED.length} CLOSED / ${
      ED_UNRESOLVED.filter((u) => u.status === 'UNAVAILABLE').length
    } UNAVAILABLE / ${
      ED_UNRESOLVED.filter((u) => u.status === 'FAILED').length
    } FAILED  |  needBlindInternational ${NB_RESOLVED.length} CLOSED / ${
      NB_UNRESOLVED.filter((u) => u.status === 'UNAVAILABLE').length
    } UNAVAILABLE / ${
      NB_UNRESOLVED.filter((u) => u.status === 'FAILED').length
    } FAILED  (fetchedAt=${FETCHED_AT})\n`,
  );

  let schoolUpdated = 0;
  let targetUpdated = 0;

  // --- edAcceptanceRate CLOSED ---
  for (const r of ED_RESOLVED) {
    if (r.rate < 1 || r.rate > 80) {
      console.warn(
        `  SKIP ${r.name}: ED rate ${r.rate} outside 1–80 range gate`,
      );
      continue;
    }
    const merged = await mergeProvenance(r.schoolId, 'edAcceptanceRate', {
      value: r.rate,
      sourceUrl: r.sourceUrl,
      fetchedAt: FETCHED_AT,
      verifiedBy: VERIFIED_BY,
      confidence: r.confidence,
      tier: r.tier,
    });
    if (!merged) {
      console.warn(`  SKIP ${r.name}: school id ${r.schoolId} not found`);
      continue;
    }
    await prisma.school.update({
      where: { id: r.schoolId },
      data: { edAcceptanceRate: r.rate, metadata: merged },
    });
    schoolUpdated += 1;
    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = 'CLOSED'::"ClosureTargetStatus",
          "sourceUrl" = ${r.sourceUrl}, confidence = ${r.confidence}, tier = ${r.tier},
          attempts = attempts + 1, "lastAttemptAt" = NOW(), "lastError" = NULL, "updatedAt" = NOW()
      WHERE id = ${r.targetId}`;
    targetUpdated += 1;
    console.log(`  ED  CLOSED       ${r.name} => ${r.rate}%`);
  }

  // --- edAcceptanceRate UNAVAILABLE / FAILED ---
  for (const u of ED_UNRESOLVED) {
    const lastError = u.status === 'FAILED' ? u.reason : null;
    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = ${u.status}::"ClosureTargetStatus",
          "sourceUrl" = ${u.sourceUrl}, attempts = attempts + 1, "lastAttemptAt" = NOW(),
          "lastError" = ${lastError}, notes = ${u.reason}, "updatedAt" = NOW()
      WHERE id = ${u.targetId}`;
    targetUpdated += 1;
    console.log(`  ED  ${u.status.padEnd(12)} ${u.name}`);
  }

  // --- needBlindInternational CLOSED ---
  for (const r of NB_RESOLVED) {
    const merged = await mergeProvenance(r.schoolId, 'needBlindInternational', {
      value: r.value,
      sourceUrl: r.sourceUrl,
      fetchedAt: FETCHED_AT,
      verifiedBy: VERIFIED_BY,
      confidence: r.confidence,
      tier: r.tier,
    });
    if (!merged) {
      console.warn(`  SKIP ${r.name}: school id ${r.schoolId} not found`);
      continue;
    }
    await prisma.school.update({
      where: { id: r.schoolId },
      data: { needBlindInternational: r.value, metadata: merged },
    });
    schoolUpdated += 1;
    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = 'CLOSED'::"ClosureTargetStatus",
          "sourceUrl" = ${r.sourceUrl}, confidence = ${r.confidence}, tier = ${r.tier},
          attempts = attempts + 1, "lastAttemptAt" = NOW(), "lastError" = NULL, "updatedAt" = NOW()
      WHERE id = ${r.targetId}`;
    targetUpdated += 1;
    console.log(`  NB  CLOSED       ${r.name} => ${r.value}`);
  }

  // --- needBlindInternational UNAVAILABLE / FAILED ---
  for (const u of NB_UNRESOLVED) {
    const lastError = u.status === 'FAILED' ? u.reason : null;
    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = ${u.status}::"ClosureTargetStatus",
          "sourceUrl" = ${u.sourceUrl}, attempts = attempts + 1, "lastAttemptAt" = NOW(),
          "lastError" = ${lastError}, notes = ${u.reason}, "updatedAt" = NOW()
      WHERE id = ${u.targetId}`;
    targetUpdated += 1;
    console.log(`  NB  ${u.status.padEnd(12)} ${u.name}`);
  }

  console.log(
    `\n[${VERIFIED_BY}] done. ${schoolUpdated} School rows updated, ${targetUpdated} ClosureTarget rows updated.`,
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

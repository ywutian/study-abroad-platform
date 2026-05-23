/**
 * collect-cds-ed2-rea-7.ts
 *
 * closure-v2 CDS-extraction agent output (batch 7).
 *
 * For a 50-school batch, resolves TWO closure fields per school:
 *
 *   1) ed2AcceptanceRate  — the Early Decision II round admit rate (%).
 *   2) hasRestrictiveEa   — whether the school runs a Restrictive / Single-Choice
 *                            EA (REA / SCEA) plan.
 *
 * ── ed2AcceptanceRate findings ───────────────────────────────────────────────
 * Every school in this batch is a large public flagship / regional public
 * university. None of them run an Early Decision plan at all — they admit on
 * rolling admission or via a non-binding open Early Action deadline plus Regular
 * Decision. With no ED plan there is no ED II round, hence no ED II-specific
 * admit rate. (Even where a school did run ED, CDS Section C21 reports a single
 * combined ED applicant/admit count — C2106/C2107 — and never breaks out ED II,
 * so no ED II rate can be derived without fabricating numbers.) No school in this
 * batch publishes a distinct ED II admit rate anywhere. Every ed2AcceptanceRate
 * target is therefore resolved UNAVAILABLE (verified from admissions offices and
 * CDS records). There IS no `ed2AcceptanceRate` column on School — it is a
 * closure-target-only field, so no School write happens for ed2.
 *
 * ── hasRestrictiveEa findings ────────────────────────────────────────────────
 * Resolvable for every school as a boolean from CDS C22 ("Is your early action
 * plan a 'restrictive' plan...") and/or the school's admissions office. No school
 * in this batch runs a Restrictive / Single-Choice EA plan. Restrictive /
 * Single-Choice EA is a feature exclusive to a small set of highly selective
 * private universities (Harvard, Yale, Princeton, Stanford, Notre Dame,
 * Georgetown, etc.) — none of which are in this batch. The public universities
 * here either use rolling admission with no EA round at all, or run an open
 * non-binding Early Action plan that places no restriction on applying early
 * elsewhere. Every hasRestrictiveEa value is therefore false. The
 * `School.hasRestrictiveEa` column EXISTS — written via raw SQL UPDATE to be
 * safe. A provenance record is merged into
 * `School.metadata.provenance.hasRestrictiveEa`. metadata is read + merged —
 * never clobbered. Every hasRestrictiveEa target is resolved CLOSED.
 *
 * ClosureTarget is a DB-only table (not in schema.prisma) → updated via raw SQL.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-cds-ed2-rea-7.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-cds-agent-7';

type Tier = 'OFFICIAL' | 'SCRAPED';
type ClosureStatus = 'CLOSED' | 'UNAVAILABLE' | 'FAILED';

/** ed2AcceptanceRate target — all UNAVAILABLE (no ED plan / CDS never separates ED II). */
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

/** Most schools in this batch share the same shape: rolling/EA-only public
 *  university, no ED → ed2 UNAVAILABLE; non-restrictive EA → hasRestrictiveEa
 *  false. The helper keeps the BATCH array compact and consistent. */
function publicNoEd(args: {
  schoolId: string;
  name: string;
  ed2TargetId: string;
  reaTargetId: string;
  sourceUrl: string;
  /** 'rolling' = rolling admission, no EA round; 'ea' = non-binding open EA. */
  plan: 'rolling' | 'ea';
  confidence?: number;
}): SchoolEntry {
  const { schoolId, name, ed2TargetId, reaTargetId, sourceUrl, plan } = args;
  const confidence = args.confidence ?? 0.95;
  const ed2Error =
    plan === 'rolling'
      ? `${name} has no Early Decision plan — it admits first-year applicants on rolling admission. No ED, hence no ED II round or rate.`
      : `${name} has no Early Decision plan — it offers only a non-binding Early Action deadline plus Regular Decision. No ED, hence no ED II round or rate.`;
  const reaNote =
    plan === 'rolling'
      ? `No Early Action plan — ${name} uses rolling admission with no EA/ED rounds. Not restrictive EA.`
      : `${name} Early Action is a non-binding, open (non-restrictive) plan — applicants are not restricted from applying early to other colleges. Not restrictive EA.`;
  return {
    schoolId,
    name,
    ed2: { targetId: ed2TargetId, status: 'UNAVAILABLE', sourceUrl, lastError: ed2Error },
    rea: {
      targetId: reaTargetId,
      status: 'CLOSED',
      value: false,
      sourceUrl,
      confidence,
      tier: 'SCRAPED',
      note: reaNote,
    },
  };
}

const BATCH: SchoolEntry[] = [
  publicNoEd({
    schoolId: 'cmnwr8ir4002hz0tibdz0myoo',
    name: 'Ball State University',
    ed2TargetId: 'cmp9pn0jo00nta85ozki6hlra',
    reaTargetId: 'cmp9pn0jr00nua85o8h3maain',
    sourceUrl: 'https://www.bsu.edu/admissions/apply/freshman',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8ir2002gz0tih2v6dubi',
    name: 'University of New Mexico',
    ed2TargetId: 'cmp9pn1sw01e1a85o7eoouxo4',
    reaTargetId: 'cmp9pn1sy01e2a85ob85lrmrm',
    sourceUrl: 'https://admissions.unm.edu/apply/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8ira002jz0tib0nkhdsx',
    name: 'West Virginia University',
    ed2TargetId: 'cmp9pn2cu01q1a85o546yenxx',
    reaTargetId: 'cmp9pn2cw01q2a85ou12voee9',
    sourceUrl: 'https://admissions.wvu.edu/how-to-apply/first-time-freshmen',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8ir7002iz0ti11f0voua',
    name: 'University of Wyoming',
    ed2TargetId: 'cmp9pn1zs01i7a85o53twzky9',
    reaTargetId: 'cmp9pn1zt01i8a85ojf46gmme',
    sourceUrl: 'https://www.uwyo.edu/admissions/apply/index.html',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8irj002nz0tief4railh',
    name: 'University of Nevada, Reno',
    ed2TargetId: 'cmp9pn2dd01qca85om0o0zpu4',
    reaTargetId: 'cmp9pn2df01qda85o6nzrpefb',
    sourceUrl: 'https://www.unr.edu/admissions/undergraduate',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8ird002kz0tifunyipf1',
    name: 'University of North Dakota',
    ed2TargetId: 'cmp9pn0ri00rua85onov4d6cx',
    reaTargetId: 'cmp9pn0rj00rva85o9p9dts7u',
    sourceUrl: 'https://und.edu/admissions/index.html',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8irh002mz0tik8qulubb',
    name: 'Montana State University',
    ed2TargetId: 'cmp9pn0tw00tba85on9xbut5z',
    reaTargetId: 'cmp9pn0tx00tca85okv36h1tr',
    sourceUrl: 'https://www.montana.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8irf002lz0titpd5mufz',
    name: 'University of South Dakota',
    ed2TargetId: 'cmp9pn0ue00tma85oq4ry7yei',
    reaTargetId: 'cmp9pn0uf00tna85o510wn25k',
    sourceUrl: 'https://www.usd.edu/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8irn002pz0tihyw561a7',
    name: 'Texas Tech University',
    ed2TargetId: 'cmp9pn1vb01fka85osz2i6go4',
    reaTargetId: 'cmp9pn1vd01fla85okra65fhh',
    sourceUrl: 'https://www.depts.ttu.edu/admissions/apply/ImportantDates/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8irl002oz0tiyc5w37jx',
    name: 'Portland State University',
    ed2TargetId: 'cmp9pn18v011za85oreg1jwx7',
    reaTargetId: 'cmp9pn18x0120a85ojkun8zfm',
    sourceUrl: 'https://www.pdx.edu/admissions/freshman',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8irq002rz0ti2ejl7chb',
    name: 'University of North Texas',
    ed2TargetId: 'cmp9pn1y801hca85otxa7wouo',
    reaTargetId: 'cmp9pn1ya01hda85olocg9srw',
    sourceUrl: 'https://admissions.unt.edu/apply',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8iro002qz0tiayclu6c9',
    name: 'University of Idaho',
    ed2TargetId: 'cmp9pn2dw01qna85ohlcc4mib',
    reaTargetId: 'cmp9pn2dy01qoa85obksbpm38',
    sourceUrl: 'https://www.uidaho.edu/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8irs002sz0ti22brcgol',
    name: 'University of Nevada, Las Vegas',
    ed2TargetId: 'cmp9pn1kr0192a85ocioyd3x8',
    reaTargetId: 'cmp9pn1ks0193a85ohii59dbf',
    sourceUrl: 'https://www.unlv.edu/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8irt002tz0tiua8akwdq',
    name: 'San Jose State University',
    ed2TargetId: 'cmp9pn1lm019na85op3ovdmvs',
    reaTargetId: 'cmp9pn1ln019oa85od3dyg714',
    sourceUrl: 'https://www.sjsu.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8irx002vz0ti8qpx4iws',
    name: 'California State University, Fullerton',
    ed2TargetId: 'cmp9pn19e012aa85ooyvqw5ue',
    reaTargetId: 'cmp9pn19f012ba85ouduptmbi',
    sourceUrl: 'https://www.fullerton.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8irv002uz0tic1bpn6g4',
    name: 'Bowling Green State University',
    ed2TargetId: 'cmp9pn12c00yoa85o8lxajjt9',
    reaTargetId: 'cmp9pn12g00ypa85on1fdi7e8',
    sourceUrl: 'https://www.bgsu.edu/admissions.html',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8iry002wz0tiljzfdqu7',
    name: 'California State University, Long Beach',
    ed2TargetId: 'cmp9pn06h00hna85olksag1x1',
    reaTargetId: 'cmp9pn06j00hoa85owbh53lql',
    sourceUrl: 'https://www.csulb.edu/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8is3002yz0ti9qk8f21x',
    name: 'North Dakota State University',
    ed2TargetId: 'cmp9pn1td01eca85oahhb84wx',
    reaTargetId: 'cmp9pn1te01eda85opnm4fn44',
    sourceUrl: 'https://www.ndsu.edu/admission/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8is4002zz0ti7l7rukwt',
    name: 'South Dakota State University',
    ed2TargetId: 'cmp9pn2ew01r9a85ojmiffm82',
    reaTargetId: 'cmp9pn2ey01raa85oganibb9m',
    sourceUrl: 'https://www.sdstate.edu/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8isa0032z0tiytg48wsw',
    name: 'Wayne State University',
    ed2TargetId: 'cmp9pn0zc00wva85oa6gek2k2',
    reaTargetId: 'cmp9pn0ze00wwa85ojd0g4lv0',
    sourceUrl: 'https://wayne.edu/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8is60030z0timvbtgjwa',
    name: 'University of Akron',
    ed2TargetId: 'cmp9pn1jw018ha85omcaxa5ir',
    reaTargetId: 'cmp9pn1jx018ia85on45tx1cb',
    sourceUrl: 'https://www.uakron.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8is80031z0tizosa0sa8',
    name: 'University of Toledo',
    ed2TargetId: 'cmp9pmzf2001ea85o8qg3ujaz',
    reaTargetId: 'cmp9pmzf3001fa85o4feip3oo',
    sourceUrl: 'https://www.utoledo.edu/admission/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8isc0033z0tibp1hnmdi',
    name: 'University of Massachusetts Lowell',
    ed2TargetId: 'cmp9pn2pc01xca85of1hayejt',
    reaTargetId: 'cmp9pn2pf01xda85ogz80i3o0',
    sourceUrl: 'https://www.uml.edu/admissions/',
    plan: 'ea',
  }),
  publicNoEd({
    schoolId: 'cmnwr8ish0036z0tiy3l6tt76',
    name: 'California State University, Northridge',
    ed2TargetId: 'cmp9pn24001kja85ocueqzmi4',
    reaTargetId: 'cmp9pn24201kka85onocyth94',
    sourceUrl: 'https://www.csun.edu/admissions-records',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8isf0035z0tixudqprxr',
    name: 'New Mexico State University',
    ed2TargetId: 'cmp9pn1tu01ena85o2um7pow1',
    reaTargetId: 'cmp9pn1tw01eoa85o6iwn8vsf',
    sourceUrl: 'https://admissions.nmsu.edu/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8ise0034z0tiwz772kaw',
    name: 'Oklahoma State University',
    ed2TargetId: 'cmp9pn2fe01rka85ow8gimn2f',
    reaTargetId: 'cmp9pn2ff01rla85otv4oz6z9',
    sourceUrl: 'https://go.okstate.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8isl0038z0ti3vw64w98',
    name: 'Northern Illinois University',
    ed2TargetId: 'cmp9pn2fu01rva85o96ixd9wu',
    reaTargetId: 'cmp9pn2fv01rwa85ovtjbmlmh',
    sourceUrl: 'https://www.niu.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8isn0039z0tik49prelk',
    name: 'Eastern Michigan University',
    ed2TargetId: 'cmp9pn1uc01eya85oxrkm6k74',
    reaTargetId: 'cmp9pn1ue01eza85o2xgl4851',
    sourceUrl: 'https://www.emich.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8isj0037z0tihc4cw8ue',
    name: 'University of Southern Mississippi',
    ed2TargetId: 'cmp9pmzxl00d5a85oxlcmowrv',
    reaTargetId: 'cmp9pmzxm00d6a85ogpl4wcdo',
    sourceUrl: 'https://www.usm.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8iso003az0tilgsdacqo',
    name: 'University of Wisconsin-Milwaukee',
    ed2TargetId: 'cmp9pn1wa01g6a85oizu81fjn',
    reaTargetId: 'cmp9pn1wc01g7a85omuxpzr4a',
    sourceUrl: 'https://uwm.edu/undergrad-admission/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8isr003bz0ti1h6j1c5s',
    name: 'Western Michigan University',
    ed2TargetId: 'cmp9pn14800zla85ogexvg7ts',
    reaTargetId: 'cmp9pn14a00zma85ot19uxniv',
    sourceUrl: 'https://wmich.edu/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8isu003dz0tijwn1m0s0',
    name: 'University of Texas at Arlington',
    ed2TargetId: 'cmp9pn0ik00n7a85otfnwv551',
    reaTargetId: 'cmp9pn0im00n8a85o9a7mg9hk',
    sourceUrl: 'https://www.uta.edu/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8iss003cz0tia71q9qy1',
    name: 'Idaho State University',
    ed2TargetId: 'cmp9pn25e01lea85ojrsllt9j',
    reaTargetId: 'cmp9pn25g01lfa85onyvy8jub',
    sourceUrl: 'https://www.isu.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8isz003fz0tisq77swxo',
    name: 'University of Texas at San Antonio',
    ed2TargetId: 'cmp9pn15c0107a85otfofmz2m',
    reaTargetId: 'cmp9pn15f0108a85oweehi4sp',
    sourceUrl: 'https://www.utsa.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8isv003ez0timrhbjznd',
    name: 'University of Memphis',
    ed2TargetId: 'cmp9pmzy300dga85o5cs6btm5',
    reaTargetId: 'cmp9pmzy400dha85oispqbq7y',
    sourceUrl: 'https://www.memphis.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8ita003iz0ti7ezibmu3',
    name: 'Georgia State University',
    ed2TargetId: 'cmp9pn1n101aja85op51r0q67',
    reaTargetId: 'cmp9pn1n301aka85ouoi5xx6k',
    sourceUrl: 'https://admissions.gsu.edu/timeline/',
    plan: 'ea',
  }),
  publicNoEd({
    schoolId: 'cmnwr8it5003hz0tie38swawv',
    name: 'Florida International University',
    ed2TargetId: 'cmp9pn2ga01s6a85ozdj1d78y',
    reaTargetId: 'cmp9pn2gc01s7a85owdsqp75c',
    sourceUrl: 'https://admissions.fiu.edu/how-to-apply/freshman-applicant/',
    plan: 'ea',
  }),
  publicNoEd({
    schoolId: 'cmnwr8ite003jz0tijg7j0avf',
    name: 'University of Massachusetts Boston',
    ed2TargetId: 'cmp9pn2hd01ssa85offsw0d62',
    reaTargetId: 'cmp9pn2hf01sta85o2s75moft',
    sourceUrl: 'https://www.umb.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8it2003gz0tixy0e9ok2',
    name: 'Cleveland State University',
    ed2TargetId: 'cmp9pmziz0041a85oz0kpjjy5',
    reaTargetId: 'cmp9pmzj10042a85oa082acla',
    sourceUrl: 'https://www.csuohio.edu/admissions/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8iti003lz0ti0z9hwm3s',
    name: 'Wright State University',
    ed2TargetId: 'cmp9pn2gt01sha85o7meft5h6',
    reaTargetId: 'cmp9pn2gv01sia85ohd4ucn22',
    sourceUrl: 'https://www.wright.edu/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8itk003mz0tirfyu068c',
    name: 'Central Michigan University',
    ed2TargetId: 'cmp9pn14r00zwa85or9if5e9i',
    reaTargetId: 'cmp9pn14t00zxa85oniv76zm8',
    sourceUrl: 'https://www.cmich.edu/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8itm003nz0tiqazikwxi',
    name: 'Indiana University-Purdue University Indianapolis',
    ed2TargetId: 'cmp9pn1ut01f9a85o8ozgnoae',
    reaTargetId: 'cmp9pn1uv01faa85o1ftcew1j',
    sourceUrl: 'https://www.iu.edu/admissions/index.html',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8itg003kz0tikwvhzllw',
    name: 'Old Dominion University',
    ed2TargetId: 'cmp9pn1wr01gha85ooticra1w',
    reaTargetId: 'cmp9pn1wt01gia85oh3hpxfpp',
    sourceUrl: 'https://www.odu.edu/admissions',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8ito003oz0tiyojti719',
    name: 'Wichita State University',
    ed2TargetId: 'cmp9pn26r01m9a85okpyic6x7',
    reaTargetId: 'cmp9pn26t01maa85okjvpasym',
    sourceUrl: 'https://www.wichita.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8iwn0053z0tiokrlwt8f',
    name: 'Appalachian State University',
    ed2TargetId: 'cmp9pn2lq01vba85ot6xobvtq',
    reaTargetId: 'cmp9pn2lr01vca85ohvfnofov',
    sourceUrl: 'https://www.appstate.edu/undergrad-deadlines/',
    plan: 'ea',
  }),
  publicNoEd({
    schoolId: 'cmnwr8iwp0054z0tic1mh49ba',
    name: 'James Madison University',
    ed2TargetId: 'cmp9pn17a0113a85o6r1ya88u',
    reaTargetId: 'cmp9pn17b0114a85ohv4f787y',
    sourceUrl: 'https://www.jmu.edu/admissions/apply/dates-and-deadlines.shtml',
    plan: 'ea',
  }),
  publicNoEd({
    schoolId: 'cmnwr8iws0056z0tial92bfrt',
    name: 'Grand Valley State University',
    ed2TargetId: 'cmp9pn0c800k0a85olcuksmd7',
    reaTargetId: 'cmp9pn0ca00k1a85orulp5dhf',
    sourceUrl: 'https://www.gvsu.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8iwq0055z0tivbkk0qbk',
    name: 'University of North Carolina Wilmington',
    ed2TargetId: 'cmp9pn1od01bea85o3n3zpckb',
    reaTargetId: 'cmp9pn1oe01bfa85oyaqwh88t',
    sourceUrl: 'https://uncw.edu/admissions/undergraduate/first-year/deadlines',
    plan: 'ea',
  }),
  publicNoEd({
    schoolId: 'cmnwr8iwt0057z0ti6f0z2hsc',
    name: 'Towson University',
    ed2TargetId: 'cmp9pmzvt00bya85ogfsa89dm',
    reaTargetId: 'cmp9pmzvv00bza85o9loltbg6',
    sourceUrl: 'https://www.towson.edu/admissions/',
    plan: 'rolling',
  }),
  publicNoEd({
    schoolId: 'cmnwr8iwv0058z0tivh6huv4n',
    name: 'California State University, Sacramento',
    ed2TargetId: 'cmp9pn0rz00s5a85ofm4ugssr',
    reaTargetId: 'cmp9pn0s100s6a85o2vip01qs',
    sourceUrl: 'https://www.csus.edu/admissions/',
    plan: 'rolling',
  }),
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

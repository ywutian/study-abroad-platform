/**
 * collect-cds-ed2-rea-2.ts
 *
 * closure-v2 CDS-extraction agent output (batch 2).
 *
 * For a 25-school batch, extracts TWO fields from each school's Common Data Set
 * (CDS) Section C21-C22 (Early Decision / Early Action):
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
 * derived from the CDS without fabricating numbers. No school in this batch
 * publishes a distinct ED II admit rate elsewhere. Every ed2AcceptanceRate target
 * is therefore resolved UNAVAILABLE (verified from the actual CDS PDFs and
 * admissions offices). There IS no `ed2AcceptanceRate` column on School — it is a
 * closure-target-only field, so no School write happens for ed2.
 *
 * ── hasRestrictiveEa findings ────────────────────────────────────────────────
 * Resolvable for every school as a boolean from CDS C22 ("Is your early action
 * plan a 'restrictive' plan...") and/or the school's admissions office:
 *   true  → Restrictive / Single-Choice EA plan (Caltech REA in this batch).
 *   false → open/non-restrictive EA, ED-only, or no early round.
 * The `School.hasRestrictiveEa` column EXISTS — written via raw SQL UPDATE to be
 * safe. A provenance record is merged into `School.metadata.provenance
 * .hasRestrictiveEa`. metadata is read + merged — never clobbered. Every
 * hasRestrictiveEa target is resolved CLOSED.
 *
 * ClosureTarget is a DB-only table (not in schema.prisma) → updated via raw SQL.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-cds-ed2-rea-2.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-cds-agent-2';

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
    schoolId: 'cmnwr8is1002xz0ti23uxhu2j',
    name: 'California Polytechnic State University, San Luis Obispo',
    ed2: {
      targetId: 'cmp9pn2ee01qya85oov9wcxij',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://content-calpoly-edu.s3.amazonaws.com/ir/1/images/CDS-2024-2025_final.pdf',
      lastError:
        'CDS 2024-2025 C21 = no early decision plan (Cal Poly suspended ED in 2022; single Oct 1–Dec 1 application window) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn2eg01qza85ovhgrt33v',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://content-calpoly-edu.s3.amazonaws.com/ir/1/images/CDS-2024-2025_final.pdf',
      confidence: 0.95,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = no early action plan. Cal Poly runs a single application window with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ivx004qz0ti7xo8qk4m',
    name: 'ArtCenter College of Design',
    ed2: {
      targetId: 'cmp9pn2mc01vma85o7yp6phxa',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.artcenter.edu/admissions/undergraduate-admissions/important-dates.html',
      lastError:
        'ArtCenter has no Early Decision plan (runs non-binding Early Action plus rolling admission) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn2md01vna85ovubsyeq1',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.artcenter.edu/admissions/undergraduate-admissions/important-dates.html',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'ArtCenter runs an open non-binding Early Action (Nov 15, decisions by January) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ivz004rz0tik286u7ol',
    name: 'Savannah College of Art and Design',
    ed2: {
      targetId: 'cmp9pn2r801yga85ocfucy10r',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.scad.edu/content/when-should-i-apply-and-when-are-application-deadlines',
      lastError:
        'SCAD uses year-round rolling admission with no firm deadlines — no Early Decision plan, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn2ra01yha85o1olz2uvi',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.scad.edu/content/when-should-i-apply-and-when-are-application-deadlines',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'No Early Action plan — SCAD uses year-round rolling admission with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkne0006vqf2quzi0v6h',
    name: 'California Institute of Technology',
    ed2: {
      targetId: 'cmp9pmzqi008ya85owe61bgr2',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://iro.caltech.edu/documents/31491/Caltech_CDS_2024-2025_May_2025.pdf',
      lastError:
        'CDS 2024-2025 C21 = no early decision plan — Caltech runs Restrictive Early Action only (no ED since the Fall 2022 cycle), hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzqj008za85o36hmos6e',
      status: 'CLOSED',
      value: true,
      sourceUrl:
        'https://iro.caltech.edu/documents/31491/Caltech_CDS_2024-2025_May_2025.pdf',
      confidence: 0.97,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22: has Early Action (11/1); restrictive plan answered Yes. Caltech runs Restrictive Early Action (REA) — no early apps to other private institutions.',
    },
  },
  {
    schoolId: 'cmnwr8iv00048z0tityzi3zx8',
    name: 'Middlebury College',
    ed2: {
      targetId: 'cmp9pn0kl00oda85ohpyr5umr',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.middlebury.edu/sites/default/files/2025-04/Middlebury%20CDS%202024_2025.pdf',
      lastError:
        'CDS 2024-2025 C21 lists ED I (11/1) and ED II (1/1) plans, but reports only a combined ED applicant/admit count (1341/409) — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn0km00oea85o3qof9fhc',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.middlebury.edu/sites/default/files/2025-04/Middlebury%20CDS%202024_2025.pdf',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = no early action plan. ED I/II only. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iw1004sz0ti04r9dj3i',
    name: 'Maryland Institute College of Art',
    ed2: {
      targetId: 'cmp9pn1hz017aa85ov45w22u2',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.mica.edu/applying-to-mica/apply/first-year-admission/',
      lastError:
        'MICA offers a single binding Early Decision (Nov 1) and Regular Decision — no ED II round, so no ED II admit rate exists.',
    },
    rea: {
      targetId: 'cmp9pn1i1017ba85oo0ceekb7',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.mica.edu/applying-to-mica/apply/first-year-admission/',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'MICA runs an open non-binding Early Action (Dec 1) with no application restrictions, plus a single binding ED. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkng0007vqf224oeyvgq',
    name: 'Duke University',
    ed2: {
      targetId: 'cmp9pn24h01kta85ovpsls8wi',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://ir.provost.duke.edu/sites/default/files/CDS-2024-25-Final-2.pdf',
      lastError:
        'CDS 2024-2025 C21 lists only a single "First or only" ED plan (11/1) with no "Other" ED plan date — Duke runs one ED round, no ED II, so no ED II rate exists.',
    },
    rea: {
      targetId: 'cmp9pn24j01kua85oyiywf0vn',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://ir.provost.duke.edu/sites/default/files/CDS-2024-25-Final-2.pdf',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = no early action plan. Duke runs binding Early Decision only. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iw3004tz0ti9nqf8ivd',
    name: 'California College of the Arts',
    ed2: {
      targetId: 'cmp9pn1x801gra85odc9e5p0y',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.cca.edu/admissions/apply/',
      lastError:
        'CCA has no Early Decision plan (runs a non-binding Early Action priority deadline plus rolling admission) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn1xa01gsa85ohb3ou8jf',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.cca.edu/admissions/apply/',
      confidence: 0.93,
      tier: 'SCRAPED',
      note: 'CCA runs an open non-binding Early Action (Nov 15) with no application restrictions. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iv20049z0ti4tahvum5',
    name: 'Carleton College',
    ed2: {
      targetId: 'cmp9pn29i01nza85oytfbvkt7',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://carleton-wp-production.s3.amazonaws.com/uploads/sites/292/2025/07/2024-2025-CDS_06032025.pdf',
      lastError:
        'CDS 2024-2025 C21 lists ED I (11/15) and ED II (1/15) plans, but reports only a combined ED applicant/admit count (667/244) — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn29k01o0a85o7mldof7h',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://carleton-wp-production.s3.amazonaws.com/uploads/sites/292/2025/07/2024-2025-CDS_06032025.pdf',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 (C2201) = No early action plan. ED I/II only. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htknm000avqf2g8h3sbdp',
    name: 'Northwestern University',
    ed2: {
      targetId: 'cmp9pmzjf004ba85onym69ayj',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://enrollment.northwestern.edu/data/2024-2025.pdf',
      lastError:
        'CDS 2024-2025 C21 lists only a single "First or only" ED plan (11/1) with no "Other" ED plan date — Northwestern runs one ED round, no ED II, so no ED II rate exists.',
    },
    rea: {
      targetId: 'cmp9pmzjg004ca85or9ypi1p7',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://enrollment.northwestern.edu/data/2024-2025.pdf',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = No early action plan (box checked No). Northwestern runs binding Early Decision only. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htknh0008vqf2i053h8rm',
    name: 'Brown University',
    ed2: {
      targetId: 'cmp9pn1kb018ra85orpp1kqxx',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admission.brown.edu/first-year/early-decision',
      lastError:
        'Brown offers a single binding Early Decision (11/1) and Regular Decision only — no ED II round, so no ED II admit rate exists.',
    },
    rea: {
      targetId: 'cmp9pn1kc018sa85o6rpukiru',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admission.brown.edu/first-year/early-decision',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Brown runs only binding Early Decision and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htknl0009vqf255v6mh7y',
    name: 'Johns Hopkins University',
    ed2: {
      targetId: 'cmp9pn24w01l3a85o7nw9dz26',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://apply.jhu.edu/how-to-apply/application-deadlines-requirements/early-decision/',
      lastError:
        'JHU runs ED I (11/1) and ED II (1/3) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn24y01l4a85og3ub27sn',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://apply.jhu.edu/how-to-apply/application-deadlines-requirements/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — JHU runs only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iv4004az0tioxjsp148',
    name: 'Claremont McKenna College',
    ed2: {
      targetId: 'cmp9pn2j801twa85o3gr56we4',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.cmc.edu/admission/first-year-application-instructions',
      lastError:
        'CMC runs ED I (11/1) and ED II (1/10) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn2ja01txa85o4nisoztt',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.cmc.edu/admission/first-year-application-instructions',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — CMC offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iv5004bz0ti94b7ow5h',
    name: 'Hamilton College',
    ed2: {
      targetId: 'cmp9pn1bs013qa85opbqcwi7d',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.hamilton.edu/admission/apply/early-decision',
      lastError:
        'Hamilton runs ED I (Plan I) and ED II (Plan II) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn1bv013ra85odgg9a3l1',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.hamilton.edu/admission/apply/early-decision',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Hamilton offers only binding Early Decision (Plan I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iv7004cz0tiy7lyda2g',
    name: 'Haverford College',
    ed2: {
      targetId: 'cmp9pn20901iha85ogs6js0se',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.haverford.edu/admission/applying/application-instructions',
      lastError:
        'Haverford runs ED I (11/15) and ED II (1/5) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn20b01iia85oxwv7gbl8',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.haverford.edu/admission/applying/application-instructions',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Haverford offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkno000bvqf209819ok4',
    name: 'Columbia University',
    ed2: {
      targetId: 'cmp9pmzdi000ia85ot5nnvs4m',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://opir.columbia.edu/sites/opir.columbia.edu/files/content/Common%20Data%20Set/2024-25_Columbia_College_and_Columbia_Engineering_CDS.pdf',
      lastError:
        'CDS 2024-2025 C21 lists only a single "First or only" ED plan (11/1) with no "Other" ED plan date — Columbia runs one ED round, no ED II, so no ED II rate exists.',
    },
    rea: {
      targetId: 'cmp9pmzdl000ja85oh07ellcn',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://opir.columbia.edu/sites/opir.columbia.edu/files/content/Common%20Data%20Set/2024-25_Columbia_College_and_Columbia_Engineering_CDS.pdf',
      confidence: 0.96,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22 = No early action plan (box checked No). Columbia runs binding Early Decision only. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htknq000cvqf2sogobdg1',
    name: 'Cornell University',
    ed2: {
      targetId: 'cmp9pmzg0001za85o6f89x0ki',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.cornell.edu/how-to-apply/first-year-applicants',
      lastError:
        'Cornell offers a single binding Early Decision (11/1) and Regular Decision only — no ED II round, so no ED II admit rate exists.',
    },
    rea: {
      targetId: 'cmp9pmzg10020a85o3leeyk75',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.cornell.edu/how-to-apply/first-year-applicants',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Cornell offers only binding Early Decision and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkns000dvqf2a150rn2s',
    name: 'University of Chicago',
    ed2: {
      targetId: 'cmp9pn00l00exa85ovd3j4im2',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://bpb-us-w2.wpmucdn.com/voices.uchicago.edu/dist/8/2077/files/2025/08/CDS_2024-2025_to_publish.pdf',
      lastError:
        'UChicago runs ED I and ED II rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn00n00eya85oah1msgu1',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://bpb-us-w2.wpmucdn.com/voices.uchicago.edu/dist/8/2077/files/2025/08/CDS_2024-2025_to_publish.pdf',
      confidence: 0.95,
      tier: 'OFFICIAL',
      note: 'CDS 2024-2025 C22: UChicago Early Action is explicitly non-restrictive — applicants may apply early elsewhere. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8iv9004dz0tirpo4zq16',
    name: 'Vassar College',
    ed2: {
      targetId: 'cmp9pn1m2019xa85ovxtdhe4f',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.vassar.edu/admission/apply/requirements/',
      lastError:
        'Vassar runs ED I and ED II (1/1) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn1m4019ya85o38blrjeh',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.vassar.edu/admission/apply/requirements/',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Vassar offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ivb004ez0tiduer8l0n',
    name: 'Grinnell College',
    ed2: {
      targetId: 'cmp9pmzzk00eca85oo0nbbaex',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.grinnell.edu/admission/apply/first-year/early-decision',
      lastError:
        'Grinnell runs ED I and ED II rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pmzzl00eda85olb15jv2a',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.grinnell.edu/admission/apply/first-year/early-decision',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Grinnell offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ivd004fz0tiwbcr93y2',
    name: 'Colgate University',
    ed2: {
      targetId: 'cmp9pn08l00iia85o3vpw3miz',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://www.colgate.edu/admission-aid/apply/early-decision',
      lastError:
        'Colgate runs ED I (11/15) and ED II (2/1) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn08n00ija85oqiwgoglb',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://www.colgate.edu/admission-aid/apply/early-decision',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Colgate offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ive004gz0tihs1kxbek',
    name: 'Davidson College',
    ed2: {
      targetId: 'cmp9pmzjv004la85o1yki5opa',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.davidson.edu/admission-and-financial-aid/apply/early-decision',
      lastError:
        'Davidson runs ED I (Plan I, 11/15) and ED II (Plan II, 1/5) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pmzjz004ma85ojiukayb6',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.davidson.edu/admission-and-financial-aid/apply/early-decision',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Davidson offers only binding Early Decision (Plan I/II) and Regular Decision. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htknv000evqf29yjvrstt',
    name: 'University of California, Berkeley',
    ed2: {
      targetId: 'cmp9pmzym00dra85oq4tx1nv6',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://admissions.berkeley.edu/apply-to-berkeley/dates-deadlines/',
      lastError:
        'UC Berkeley has no Early Decision plan (the entire UC system uses a single Oct 1–Nov 30 application window) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pmzyo00dsa85ooh72izco',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://admissions.berkeley.edu/apply-to-berkeley/dates-deadlines/',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'No Early Action plan — the entire UC system uses one application window with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmn1htkny000fvqf2jlmz8ej1',
    name: 'University of California, Los Angeles',
    ed2: {
      targetId: 'cmp9pn1ml01a8a85ov8v6bz8a',
      status: 'UNAVAILABLE',
      sourceUrl: 'https://admission.ucla.edu/apply/first-year',
      lastError:
        'UCLA has no Early Decision plan (the entire UC system uses a single Oct 1–Nov 30 application window) — no ED, hence no ED II round or rate.',
    },
    rea: {
      targetId: 'cmp9pn1mm01a9a85o6eukcdxf',
      status: 'CLOSED',
      value: false,
      sourceUrl: 'https://admission.ucla.edu/apply/first-year',
      confidence: 0.96,
      tier: 'SCRAPED',
      note: 'No Early Action plan — the entire UC system uses one application window with no EA/ED rounds. Not restrictive EA.',
    },
  },
  {
    schoolId: 'cmnwr8ivg004hz0ti8c1ggiw8',
    name: 'Smith College',
    ed2: {
      targetId: 'cmp9pn1ni01ata85ob1xsensm',
      status: 'UNAVAILABLE',
      sourceUrl:
        'https://www.smith.edu/admission-aid/apply-smith/first-year-applicants',
      lastError:
        'Smith runs ED I (11/15) and ED II (1/1) rounds, but the CDS reports only a combined ED applicant/admit count — the CDS never separates ED II, so no ED II-specific rate can be derived.',
    },
    rea: {
      targetId: 'cmp9pn1nj01aua85onedbn6ks',
      status: 'CLOSED',
      value: false,
      sourceUrl:
        'https://www.smith.edu/admission-aid/apply-smith/first-year-applicants',
      confidence: 0.95,
      tier: 'SCRAPED',
      note: 'No Early Action plan — Smith offers only binding Early Decision (ED I/II) and Regular Decision. Not restrictive EA.',
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

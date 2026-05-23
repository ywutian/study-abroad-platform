/**
 * collect-gpa-dist-r.ts
 *
 * closure-v2 data-collection agent output (RESEARCH UNIVERSITY batch).
 *
 * Writes REAL, source-verified `School.gpaDistribution` values for a 30-school
 * batch of `ClosureTarget` rows (field = 'gpaDistribution', status = PENDING)
 * limited to research universities (institutionType = RESEARCH_UNIVERSITY or NULL).
 *
 * Semantics of gpaDistribution (CDS Section C11 — enrolled first-year HS GPA):
 *   JSON object → the school's Common Data Set section C11 publishes a populated
 *     percentage breakdown of enrolled first-year students by HS GPA band.
 *     Stored shape (fractions summing ~1.0):
 *       { "3.75-4.00", "3.50-3.74", "3.25-3.49", "3.00-3.24", "<3.00" }
 *     "3.75-4.00" combines the CDS "GPA of 4.0" + "3.75 and 3.99" rows.
 *     "<3.00" combines the CDS "2.50-2.99" + "2.0-2.49" + "1.0-1.99" + "below 1.0"
 *     rows. The CDS "All enrolled students" column is used.
 *   null → the school's CDS C11 table is genuinely blank (all bands empty /
 *     0.00% totals → UNAVAILABLE), OR no CDS / C11 distribution could be
 *     verifiably obtained (→ FAILED).
 *
 * BATCH RESULT — 30 schools: 6 CLOSED, 16 UNAVAILABLE, 8 FAILED.
 *
 *   CLOSED (C11 published with real per-band values, verified from the CDS
 *   document directly — PDF / XLSX / DOCX / Issuu reader layers):
 *     - Missouri University of Science and Technology (CDS 2024-2025 XLSX)
 *     - Kent State University (CDS 2025-2026 DOCX — latest available)
 *     - California State University, Fullerton (CDS 2024-2025 XLSX)
 *     - California State University, Northridge (CDS 2025-2026 PDF — latest)
 *     - University of Idaho (CDS 2024-2025 PDF)
 *     - Hofstra University (CDS 2024-2025, Issuu reader text layers)
 *
 *   UNAVAILABLE (CDS exists; section C11 inspected directly and is published
 *   blank — all GPA-band rows empty, totals 0.00%): Rice, Notre Dame,
 *   Georgetown, UT Austin, UC Irvine, Boston College, Rutgers-New Brunswick,
 *   Lehigh, Wake Forest, UMN Twin Cities, UConn, Pittsburgh, American
 *   University, UT San Antonio, Rutgers-Newark, UVM. (Rutgers' latest published
 *   CDS is 2023-2024; American University's 2024-25 PDF is access-blocked but
 *   the 2025-2026 CDS confirms AU omits section C11 entirely.)
 *
 *   FAILED (no CDS C11 distribution could be verifiably retrieved — no
 *   fabrication):
 *     - Texas A&M University — CDS published, but the only indexed URL
 *       (abpa.tamu.edu getattachment GUID) returns "Page Not Found" for all
 *       non-interactive access; C11 values not verifiable.
 *     - University of Missouri — CDS 2024-2025 published only on an
 *       authenticated SharePoint link; not publicly retrievable.
 *     - University of North Dakota — IR page states CDS reports "will be
 *       available soon"; no 2024-2025 CDS published.
 *     - New Mexico State University — publishes Quick Facts only; no Common
 *       Data Set with a section C11 is published.
 *     - The New School — only a 2008-2009 CDS exists in archives; no recent CDS.
 *     - Eastern Michigan University — CDS 2024-2025 PDF exists but is behind a
 *       Cloudflare bot challenge; could not be retrieved to verify C11.
 *     - University of Texas at Arlington — no Common Data Set published on the
 *       University Analytics CDS page.
 *     - University of Texas at San Antonio — see note below.
 *
 *   NOTE: UT San Antonio's CDS 2024-2025 XLSX WAS retrieved and section C11 is
 *   blank → it is classified UNAVAILABLE (not FAILED).
 *
 * ClosureTarget is a DB-only table (not in schema.prisma → not on the Prisma
 * client), so its rows are updated via $executeRaw. School rows (for any CLOSED
 * target) use the typed client; gpaDistribution is `Json?`. metadata.provenance
 * .gpaDistribution is MERGED — other provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-gpa-dist-r.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-gpadist-agent-r';

type Tier = 'OFFICIAL' | 'SCRAPED';

/** The 5-band GPA distribution stored on School.gpaDistribution. */
interface GpaBands {
  '3.75-4.00': number;
  '3.50-3.74': number;
  '3.25-3.49': number;
  '3.00-3.24': number;
  '<3.00': number;
}

interface ClosedTarget {
  status: 'CLOSED';
  targetId: string;
  schoolId: string;
  name: string;
  bands: GpaBands;
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

const BATCH: BatchTarget[] = [
  // ────────────────────────── CLOSED (6) ──────────────────────────
  {
    // CDS 2024-2025 XLSX, sheet CDS-C. All-enrolled column.
    // 4.0 .4803 + 3.75-3.99 .2197 = .7000 ; 3.50-3.74 .1377 ; 3.25-3.49 .0902 ;
    // 3.00-3.24 .0418 ; (<3.00) .0287 + .0016 + 0 + 0 = .0303. Sum 1.0000.
    status: 'CLOSED',
    targetId: 'cmp9pn13400z2a85o13t71xpb',
    schoolId: 'cmnwr8iqf0024z0tiy29w0e1z',
    name: 'Missouri University of Science and Technology',
    bands: { '3.75-4.00': 0.7, '3.50-3.74': 0.1377, '3.25-3.49': 0.0902, '3.00-3.24': 0.0418, '<3.00': 0.0303 },
    sourceUrl: 'https://data.mst.edu/media/administrative/data/documents/cds/CDS%202024-2025%20v1.2.xlsx',
    confidence: 0.98,
    tier: 'OFFICIAL',
  },
  {
    // CDS 2025-2026 DOCX (Kent campus) — latest published; 2024-2025 not posted.
    // All-enrolled column: 4.0 25.3% + 3.75-3.99 18.78% = 44.08% ;
    // 3.50-3.74 17.64% ; 3.25-3.49 15.15% ; 3.00-3.24 13.0% ;
    // (<3.00) 9.07% + 0.86% + 0.2% + 0% = 10.13%. Sum 100.00%.
    status: 'CLOSED',
    targetId: 'cmp9pn2bz01pia85oew7wusr9',
    schoolId: 'cmnwr8ir0002fz0tiuxlv8v32',
    name: 'Kent State University',
    bands: { '3.75-4.00': 0.4408, '3.50-3.74': 0.1764, '3.25-3.49': 0.1515, '3.00-3.24': 0.13, '<3.00': 0.1013 },
    sourceUrl: 'https://www-s3-live.kent.edu/s3fs-root/s3fs-public/file/KC%20CDS_2025-2026-Final_web_0.docx',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'CDS 2025-2026 (Kent campus) — latest published edition; 2024-2025 CDS not posted.',
  },
  {
    // CDS 2024-2025 XLSX, sheet CDS-C.
    // 4.0 .014 + 3.75-3.99 .166 = .180 ; 3.50-3.74 .230 ; 3.25-3.49 .248 ;
    // 3.00-3.24 .201 ; (<3.00) .135 + .006 + 0 + 0 = .141. Sum 1.000.
    status: 'CLOSED',
    targetId: 'cmp9pn1910122a85ofidd8d77',
    schoolId: 'cmnwr8irx002vz0ti8qpx4iws',
    name: 'California State University, Fullerton',
    bands: { '3.75-4.00': 0.18, '3.50-3.74': 0.23, '3.25-3.49': 0.248, '3.00-3.24': 0.201, '<3.00': 0.141 },
    sourceUrl: 'https://www.fullerton.edu/data/institutionalresearch/facts/CDS-Master-2024-2025.xlsx',
    confidence: 0.98,
    tier: 'OFFICIAL',
  },
  {
    // CDS 2025-2026 PDF — latest published; 2024-2025 file was the old 3-band
    // C11 format. All-enrolled column: 4.0 11.64 + 3.75-3.99 11.85 = 23.49% ;
    // 3.50-3.74 15.64% ; 3.25-3.49 16.38% ; 3.00-3.24 17.72% ;
    // (<3.00) 22.50 + 3.82 + 0.45 + 0.00 = 26.77%. Sum 100.00%.
    status: 'CLOSED',
    targetId: 'cmp9pn23l01kba85o4ilq9izc',
    schoolId: 'cmnwr8ish0036z0tiy3l6tt76',
    name: 'California State University, Northridge',
    bands: { '3.75-4.00': 0.2349, '3.50-3.74': 0.1564, '3.25-3.49': 0.1638, '3.00-3.24': 0.1772, '<3.00': 0.2677 },
    sourceUrl: 'https://www.csun.edu/sites/default/files/2026-04/CDS%202025%20v2.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'CDS 2025-2026 — latest published edition with the modern 9-band C11 table.',
  },
  {
    // CDS 2024-2025 PDF (uidaho content hub). All-enrolled column:
    // 4.0 7.4% + 3.75-3.99 25.7% = 33.1% ; 3.50-3.74 18.7% ; 3.25-3.49 16.6% ;
    // 3.00-3.24 13.6% ; (<3.00) 14.6% + 3.2% + 0.2% + 0 = 18.0%. Sum 100.0%.
    status: 'CLOSED',
    targetId: 'cmp9pn2di01qfa85oy27ntaio',
    schoolId: 'cmnwr8iro002qz0tiayclu6c9',
    name: 'University of Idaho',
    bands: { '3.75-4.00': 0.331, '3.50-3.74': 0.187, '3.25-3.49': 0.166, '3.00-3.24': 0.136, '<3.00': 0.18 },
    sourceUrl: 'https://content-hub.uidaho.edu/api/public/content/bf62e21cc0114b06bed65dc2a5e6c633?v=aee281dc',
    confidence: 0.97,
    tier: 'OFFICIAL',
  },
  {
    // CDS 2024-2025 (Issuu reader text layers). All-enrolled column:
    // 4.0 36% + 3.75-3.99 19% = 55% ; 3.50-3.74 19% ; 3.25-3.49 13% ;
    // 3.00-3.24 8% ; (<3.00) 5% + 0 + 0 + 0 = 5%. Sum 100%.
    status: 'CLOSED',
    targetId: 'cmp9pn17z011ha85os4eqnmly',
    schoolId: 'cmnwr8iqp0029z0ti2wbplonv',
    name: 'Hofstra University',
    bands: { '3.75-4.00': 0.55, '3.50-3.74': 0.19, '3.25-3.49': 0.13, '3.00-3.24': 0.08, '<3.00': 0.05 },
    sourceUrl: 'https://issuu.com/hofstra/docs/2024-2025_common_data_set_hofstra_university',
    confidence: 0.93,
    tier: 'OFFICIAL',
  },

  // ─────────────────── UNAVAILABLE (16): CDS C11 blank ───────────────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn07i00i1a85oal3y81mj',
    schoolId: 'cmn1htko0000gvqf2pmjc1xi9',
    name: 'Rice University',
    sourceUrl: 'https://ideas.rice.edu/wp-content/uploads/2025/10/CDS_2024-25_WEBSITE.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank — every GPA-band cell is "NA"; Rice does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1ox01bra85ogdhzeqql',
    schoolId: 'cmn1htko7000jvqf22r0n55p2',
    name: 'University of Notre Dame',
    sourceUrl: 'https://drive.google.com/uc?export=download&id=1L1IOSn19CxOwqRaDK8F_cZVzbsFD1EPg',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — Notre Dame does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1pt01cba85okc17b8ns',
    schoolId: 'cmn1htkoc000lvqf2s5pgbhxx',
    name: 'Georgetown University',
    sourceUrl: 'https://georgetown.box.com/s/rp4p2ly4ej2tsikv827pl48psmb68quv',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — Georgetown does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn19i012da85oqkyhd2bd',
    schoolId: 'cmn1htkp1000vvqf2iogfyk82',
    name: 'University of Texas at Austin',
    sourceUrl: 'https://utexas.box.com/s/d9izqb6s8dw2xxg5h5sunxyhrnef2ay6',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, no totals) — UT Austin does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzhe002ya85o65uayesv',
    schoolId: 'cmn1htkp6000xvqf2rhj774d8',
    name: 'University of California, Irvine',
    sourceUrl: 'https://bpb-us-e2.wpmucdn.com/sites.uci.edu/dist/2/5478/files/2025/09/CDS-2024-25.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — UC Irvine does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0ui00tpa85omzq514xn',
    schoolId: 'cmn1htkpl0012vqf28whnvaoj',
    name: 'Boston College',
    sourceUrl: 'https://www.bc.edu/content/dam/bc1/offices/irp/ir/cds/Boston_College_CDS_2024-2025_Final.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.0%) — Boston College does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0av00jha85ot9t5iwrh',
    schoolId: 'cmn1htkpo0013vqf2byqbw5mb',
    name: 'Rutgers University-New Brunswick',
    sourceUrl: 'https://oirap.rutgers.edu/CDS/2023/New%20Brunswick%20CDS_2023-2024_final_V1.pdf',
    lastError:
      'CDS 2023-2024 (latest published) section C11 is blank — all GPA-band rows empty; Rutgers-New Brunswick does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzpu008ha85ozri4bnxl',
    schoolId: 'cmn1htkq9001avqf25ziy94gn',
    name: 'Lehigh University',
    sourceUrl: 'https://data.lehigh.edu/sites/data.lehigh.edu/files/6.20.2025_CDS-2024-2025_FINAL_REVISED.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00) — Lehigh does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0g000lta85oe0am9cti',
    schoolId: 'cmn1htkqj001dvqf2n8mczcpn',
    name: 'Wake Forest University',
    sourceUrl: 'https://prod.wp.cdn.aws.wfu.edu/sites/202/2025/07/CDS-2024-2025-fillable-WFU.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00) — Wake Forest does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzoj007ma85oaxa0ymlt',
    schoolId: 'cmnwr8ima0008z0ti358pkae1',
    name: 'University of Minnesota Twin Cities',
    sourceUrl: 'https://idr.umn.edu/sites/idr.umn.edu/files/cds_2024_2025_tc_1.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00) — UMN Twin Cities does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn02u00g7a85ou1vq350t',
    schoolId: 'cmnwr8imj000dz0tif3r9fq0l',
    name: 'University of Connecticut',
    sourceUrl: 'https://bpir.media.uconn.edu/wp-content/uploads/sites/3452/2025/07/UConn_CDS_2024_2025.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — UConn does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn20f01ika85oezk6qtqu',
    schoolId: 'cmnwr8im90007z0ti2n04hf3n',
    name: 'University of Pittsburgh',
    sourceUrl: 'https://ir.pitt.edu/sites/default/files/assets/2024-2025%20CDS%20Pittsburgh_2.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — Pittsburgh does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn28d01n8a85odlm78mz5',
    schoolId: 'cmnwr8ity003tz0tie2nazej1',
    name: 'American University',
    sourceUrl: 'https://www.american.edu/provost/oira/common-data-set.cfm',
    lastError:
      "American University's CDS omits section C11 entirely (the 2025-2026 CDS jumps from C9 test scores to C13; the 2024-2025 PDF is access-blocked) — no HS GPA distribution is reported.",
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn14x00zza85okgdb0are',
    schoolId: 'cmnwr8isz003fz0tisq77swxo',
    name: 'University of Texas at San Antonio',
    sourceUrl: 'https://www.utsa.edu/ir/docs/resources/commonDataSet/CDS_2024-2025.xlsx',
    lastError:
      'CDS 2024-2025 (XLSX) section C11 is published blank — all GPA-band cells empty; UT San Antonio does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzsh00a7a85obcmzimpw',
    schoolId: 'cmnwr8io7001bz0tihu5wo9mh',
    name: 'Rutgers University-Newark',
    sourceUrl: 'https://oirds.rutgers.edu/CDS/2023/Newark%20CDS_2023-2024_final_V1.pdf',
    lastError:
      'CDS 2023-2024 (latest published) section C11 is blank — all GPA-band rows empty; Rutgers-Newark does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0po00qqa85o92t7q5bf',
    schoolId: 'cmnwr8ipx001wz0timhlbfii2',
    name: 'University of Vermont',
    sourceUrl: 'https://www.uvm.edu/d10-files/documents/2025-04/2024-2025-Common-Data-Set_0.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — UVM does not report a HS GPA distribution.',
  },

  // ─────────────────── FAILED (8): no verifiable CDS C11 ───────────────────
  {
    status: 'FAILED',
    targetId: 'cmp9pn0wn00v5a85ogb3m211f',
    schoolId: 'cmn1htkqc001bvqf22zfkx827',
    name: 'Texas A&M University',
    sourceUrl: 'https://abpa.tamu.edu/getattachment/439f54fe-1105-48af-955a-405775f80872/CDS-2024-2025_TexasA-M.pdf',
    lastError:
      'CDS 2024-2025 is published, but the only indexed URL (abpa.tamu.edu getattachment GUID) returns "Page Not Found" for all non-interactive access — section C11 values could not be verifiably retrieved. No fabrication.',
  },
  {
    status: 'FAILED',
    targetId: 'cmp9pmzte00ata85o1ypiupyj',
    schoolId: 'cmnwr8ip7001nz0ti6qy76djw',
    name: 'University of Missouri',
    sourceUrl: 'https://udair.missouri.edu/mu-data/common-data-set/',
    lastError:
      'CDS 2024-2025 is published only as an authenticated SharePoint (mailmissouri.sharepoint.com) link — not publicly retrievable; section C11 values could not be verified. No fabrication.',
  },
  {
    status: 'FAILED',
    targetId: 'cmp9pn0r600rma85ovmdsk9kv',
    schoolId: 'cmnwr8ird002kz0tifunyipf1',
    name: 'University of North Dakota',
    sourceUrl: 'https://und.edu/analytics-and-planning/data-and-reports/common-data-set.html',
    lastError:
      'UND\'s Common Data Set page states reports "will be available soon" — no 2024-2025 CDS is published; section C11 unavailable.',
  },
  {
    status: 'FAILED',
    targetId: 'cmp9pn1ti01efa85ogm7vjh4k',
    schoolId: 'cmnwr8isf0035z0tixudqprxr',
    name: 'New Mexico State University',
    sourceUrl: 'https://oia.nmsu.edu/',
    lastError:
      'NMSU publishes only a Quick Facts report (no HS GPA distribution) and no Common Data Set with a section C11 — no verifiable source.',
  },
  {
    status: 'FAILED',
    targetId: 'cmp9pn0e600kxa85o9vwyh40i',
    schoolId: 'cmnwr8ioy001kz0ti85qspr1l',
    name: 'The New School',
    sourceUrl: 'https://www.newschool.edu/provost/institutional-research/',
    lastError:
      'The New School publishes no current Common Data Set (only a 2008-2009 CDS exists in archives) — no section C11 source available.',
  },
  {
    status: 'FAILED',
    targetId: 'cmp9pn1tz01eqa85oha6ki6s2',
    schoolId: 'cmnwr8isn0039z0tik49prelk',
    name: 'Eastern Michigan University',
    sourceUrl: 'https://www.emich.edu/irim/documents/common-data-sets/cds2024v3.pdf',
    lastError:
      'CDS 2024-2025 PDF exists but is served behind a Cloudflare bot challenge — could not be retrieved to verify section C11. No fabrication.',
  },
  {
    status: 'FAILED',
    targetId: 'cmp9pn0i800mza85o1b31w3v5',
    schoolId: 'cmnwr8isu003dz0tijwn1m0s0',
    name: 'University of Texas at Arlington',
    sourceUrl: 'https://uta.edu/analytics/Report/Common%20Data%20Set/index.php',
    lastError:
      "UT Arlington publishes no Common Data Set on its University Analytics CDS page — no section C11 source available.",
  },
  {
    status: 'FAILED',
    targetId: 'cmp9pn1xd01gua85oztck68ml',
    schoolId: 'cmnwr8ioi001fz0tivlt104p7',
    name: 'Seton Hall University',
    sourceUrl: 'https://www.shu.edu/institutional-research/reports.html',
    lastError:
      "Seton Hall's Institutional Research site publishes Common Data Sets only for 2002-2005 (2005-2006 listed as not yet available) — no recent CDS with a section C11 is published.",
  },
];

function isClosed(t: BatchTarget): t is ClosedTarget {
  return t.status === 'CLOSED';
}

/** Sanity gate: the 5 fractions must sum to 0.95–1.05. */
function assertBandsValid(t: ClosedTarget): void {
  const b = t.bands;
  const sum =
    b['3.75-4.00'] + b['3.50-3.74'] + b['3.25-3.49'] + b['3.00-3.24'] + b['<3.00'];
  if (sum < 0.95 || sum > 1.05) {
    throw new Error(
      `Sanity gate violation: ${t.name} gpaDistribution fractions sum to ${sum.toFixed(3)} (must be 0.95–1.05)`,
    );
  }
  for (const [band, frac] of Object.entries(b)) {
    if (frac < 0 || frac > 1) {
      throw new Error(`Sanity gate violation: ${t.name} band ${band}=${frac} (must be 0–1)`);
    }
  }
}

async function main() {
  const closed = BATCH.filter(isClosed);
  console.log(
    `[closure-v2-gpadist-agent-r] batch=${BATCH.length}  CLOSED=${closed.length}  ` +
      `UNAVAILABLE=${BATCH.filter((t) => t.status === 'UNAVAILABLE').length}  ` +
      `FAILED=${BATCH.filter((t) => t.status === 'FAILED').length}  (fetchedAt=${FETCHED_AT})\n`,
  );

  // Sanity gate guard — fail loudly rather than write a bad distribution.
  for (const t of closed) {
    assertBandsValid(t);
  }

  let schoolsUpdated = 0;
  let targetsUpdated = 0;

  for (const t of BATCH) {
    // 1) For CLOSED: write School.gpaDistribution + merge provenance.
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
            gpaDistribution: {
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
            gpaDistribution: t.bands as unknown as Prisma.InputJsonValue,
            metadata: mergedMetadata,
          },
        });
        schoolsUpdated += 1;
        console.log(`  OK   ${t.name} => ${JSON.stringify(t.bands)}  [${t.sourceUrl}]`);
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
    `\n[closure-v2-gpadist-agent-r] done. ${schoolsUpdated} school rows updated, ` +
      `${targetsUpdated} closure targets updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-gpadist-agent-r] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * collect-transfer-gpa.ts
 *
 * closure-v2 data-collection agent output (transferAcceptanceRate + gpaDistribution).
 *
 * Writes REAL, source-verified values for the remaining PENDING `ClosureTarget`
 * rows with field IN ('transferAcceptanceRate', 'gpaDistribution').
 *
 * ── transferAcceptanceRate ──────────────────────────────────────────────
 *   transfer acceptance % = (transfer students admitted / transfer applicants)
 *     * 100, taken from the school's Common Data Set Section D2 (Fall 2024
 *     unless noted). Range gate: 1–95%. A value outside the gate is rejected
 *     (status FAILED) — the raw figure is real but not stored.
 *
 * ── gpaDistribution ─────────────────────────────────────────────────────
 *   CDS Section C11 (enrolled first-year HS GPA), "All enrolled students"
 *     column, stored as 5 fractions summing ~1.0:
 *       { "3.75-4.00", "3.50-3.74", "3.25-3.49", "3.00-3.24", "<3.00" }
 *     "3.75-4.00" = CDS "4.0" + "3.75-3.99"; "<3.00" = "2.50-2.99" +
 *     "2.0-2.49" + "1.0-1.99" + "below 1.0".
 *
 * `School.transferAcceptanceRate` / `School.gpaDistribution` and
 * `ClosureTarget` are present in the live DB. `ClosureTarget` is a DB-only
 * table (not in schema.prisma) so its rows are updated via $executeRaw.
 * metadata.provenance.<field> is MERGED into existing metadata — other
 * provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-transfer-gpa.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-transfer-gpa-agent';

type Status = 'CLOSED' | 'UNAVAILABLE' | 'FAILED';
type Tier = 'OFFICIAL' | 'SCRAPED';

interface TransferTarget {
  kind: 'transferAcceptanceRate';
  targetId: string;
  schoolId: string;
  name: string;
  status: Status;
  /** Transfer acceptance % — required when status='CLOSED'. */
  value: number | null;
  sourceUrl: string | null;
  confidence: number | null;
  tier: Tier | null;
  note: string;
}

interface GpaBands {
  '3.75-4.00': number;
  '3.50-3.74': number;
  '3.25-3.49': number;
  '3.00-3.24': number;
  '<3.00': number;
}

interface GpaTarget {
  kind: 'gpaDistribution';
  targetId: string;
  schoolId: string;
  name: string;
  status: Status;
  /** 5-band distribution — required when status='CLOSED'. */
  bands: GpaBands | null;
  sourceUrl: string | null;
  confidence: number | null;
  tier: Tier | null;
  note: string;
}

type Target = TransferTarget | GpaTarget;

const MIN_RATE = 1;
const MAX_RATE = 95;

// ──────────────────────── gpaDistribution (10) ────────────────────────
const GPA_TARGETS: GpaTarget[] = [
  {
    // CDS app (iuapps.iu.edu) C11, All-enrolled column.
    // 4.0 17.28 + 3.75-3.99 15.27 = 32.55 ; 3.50-3.74 17.21 ; 3.25-3.49 17.74 ;
    // 3.00-3.24 17.78 ; (<3.00) 12.68 + 2.01 + 0.04 + 0.00 = 14.73. Sum 100.01.
    kind: 'gpaDistribution',
    targetId: 'cmp9pn1uh01f1a85oaraumwvc',
    schoolId: 'cmnwr8itm003nz0tiqazikwxi',
    name: 'Indiana University-Purdue University Indianapolis',
    status: 'CLOSED',
    bands: { '3.75-4.00': 0.3255, '3.50-3.74': 0.1721, '3.25-3.49': 0.1774, '3.00-3.24': 0.1778, '<3.00': 0.1473 },
    sourceUrl: 'https://iuapps.iu.edu/cds/?p=index&i=home&section=C.+First-Time,+(Freshman)+Admission&year=2024&campus=IU-Indianapolis',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'IU official CDS app — IU-Indianapolis (formerly IUPUI) CDS 2024-2025 Section C11, "All enrolled students" column.',
  },
  {
    kind: 'gpaDistribution',
    targetId: 'cmp9pn1zx01iaa85o6d5rcgk3',
    schoolId: 'cmnwr8iv7004cz0tiy7lyda2g',
    name: 'Haverford College',
    status: 'UNAVAILABLE',
    bands: null,
    sourceUrl: 'https://www.haverford.edu/sites/default/files/Office/President/CDS_2024-2025.pdf',
    confidence: null,
    tier: null,
    note: 'CDS 2024-2025 Section C11 is published with every GPA-band cell "N/A" — Haverford does not report a HS GPA distribution.',
  },
  {
    kind: 'gpaDistribution',
    targetId: 'cmp9pmzz700e5a85o6j80n94l',
    schoolId: 'cmnwr8ivb004ez0tiduer8l0n',
    name: 'Grinnell College',
    status: 'UNAVAILABLE',
    bands: null,
    sourceUrl: 'https://www.grinnell.edu/doc/grinnell-college-common-data-set-2024-2025',
    confidence: null,
    tier: null,
    note: 'CDS 2024-2025 Section C11 is published blank — all GPA-band rows empty, all three column totals 0.00%.',
  },
  {
    kind: 'gpaDistribution',
    targetId: 'cmp9pn2a201oca85oniy632v7',
    schoolId: 'cmnwr8ivi004iz0tinveg964v',
    name: 'Washington and Lee University',
    status: 'UNAVAILABLE',
    bands: null,
    sourceUrl: 'https://my.wlu.edu/document/2024-common-data-set',
    confidence: null,
    tier: null,
    note: 'CDS 2024-2025 Section C11 is published blank — all GPA-band rows empty; W&L does not report a HS GPA distribution.',
  },
  {
    kind: 'gpaDistribution',
    targetId: 'cmp9pn2jv01u9a85out1ri2lu',
    schoolId: 'cmnwr8ivj004jz0tij2m7ox54',
    name: 'Colby College',
    status: 'FAILED',
    bands: null,
    sourceUrl: 'https://www.colby.edu/institutionalresearch/dataset/',
    confidence: null,
    tier: null,
    note: "Colby's Institutional Research CDS page is bot-access-blocked (HTTP 403); only CDS editions through 2015-2016 are publicly indexed. No recent CDS Section C11 could be verifiably retrieved. No fabrication.",
  },
  {
    kind: 'gpaDistribution',
    targetId: 'cmp9pn2mi01vpa85o9y14pmt3',
    schoolId: 'cmnwr8ivl004kz0tiv0vgf6c6',
    name: 'Bates College',
    status: 'UNAVAILABLE',
    bands: null,
    sourceUrl: 'https://www.bates.edu/research/files/2026/03/CDS_2024-2025.pdf',
    confidence: null,
    tier: null,
    note: 'CDS 2024-2025 Section C11 is published blank — all GPA-band rows empty, all three column totals 0.00.',
  },
  {
    kind: 'gpaDistribution',
    targetId: 'cmp9pn0oa00pva85o28ln77x7',
    schoolId: 'cmnwr8ioo001hz0tim3isqwz9',
    name: 'Clarkson University',
    status: 'UNAVAILABLE',
    bands: null,
    sourceUrl: 'https://drive.google.com/file/d/1DTu9an407XQ3jc412TNYGutC8qfmdpeI/view',
    confidence: null,
    tier: null,
    note: "Clarkson's CDS 2024-2025 omits Section C11 entirely — the document jumps from C8 directly to Section D; no enrolled first-year HS GPA distribution is reported.",
  },
  {
    kind: 'gpaDistribution',
    targetId: 'cmp9pn23401k1a85o34gqu4oz',
    schoolId: 'cmnwr8iqi0026z0tin3vtpw1p',
    name: 'University of Maine',
    status: 'FAILED',
    bands: null,
    sourceUrl: 'https://umaine.edu/oira/common-data-set/',
    confidence: null,
    tier: null,
    note: 'UMaine\'s CDS 2024-2025 is published only behind an authenticated University of Maine System SharePoint link (HTTP 403); DigitalCommons archives stop at 2020-2021. Section C11 not verifiably retrievable. No fabrication.',
  },
  {
    kind: 'gpaDistribution',
    targetId: 'cmp9pn11y00yga85otebn6a6c',
    schoolId: 'cmnwr8irv002uz0tic1bpn6g4',
    name: 'Bowling Green State University',
    status: 'UNAVAILABLE',
    bands: null,
    sourceUrl: 'https://www.bgsu.edu/institutional-research/CDS.html',
    confidence: null,
    tier: null,
    note: 'BGSU publishes its Common Data Set only as an interactive Tableau visualization — no downloadable CDS document with a Section C11 GPA-band table is available.',
  },
  {
    kind: 'gpaDistribution',
    targetId: 'cmp9pn16w010va85o1lnrvwn1',
    schoolId: 'cmnwr8iwp0054z0tic1mh49ba',
    name: 'James Madison University',
    status: 'UNAVAILABLE',
    bands: null,
    sourceUrl: 'https://www.jmu.edu/pair/ir/common-data-set/cds-2024-2025.docx',
    confidence: null,
    tier: null,
    note: 'CDS 2024-2025 Section C11 is published blank — all GPA-band rows empty, all three column totals 0.00%.',
  },
];

// ─────────────────── transferAcceptanceRate (34) ───────────────────
const TRANSFER_TARGETS: TransferTarget[] = [
  // ── CLOSED (17) — CDS Section D2 verified ──
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pmzyw00dxa85oujpgp33p',
    schoolId: 'cmn1htkow000tvqf2qc5n3qhd',
    name: 'University of Florida',
    status: 'CLOSED',
    value: 44.86,
    sourceUrl: 'https://data-apps.ir.aa.ufl.edu/public/cds/CDS_2024-2025_UFMAIN_Post_v1.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'UF CDS 2024-2025 Section D2: 2,633 admitted / 5,870 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pmzr9009fa85oiphk5cf7',
    schoolId: 'cmn1htkpr0014vqf2w1o1nsyd',
    name: 'Tufts University',
    status: 'CLOSED',
    value: 21.24,
    sourceUrl: 'https://provost.tufts.edu/institutionalresearch/wp-content/uploads/sites/5/CDS_2024-2025-1.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'Tufts CDS 2024-2025 Section D2: 342 admitted / 1,610 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn2pm01xia85o993kc3xm',
    schoolId: 'cmnwr8iun0041z0tin8tw3f6b',
    name: 'Villanova University',
    status: 'CLOSED',
    value: 43.3,
    sourceUrl: 'https://www1.villanova.edu/content/dam/villanova/provost/decision_support/2024-2025-CDS_v2.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'Villanova CDS 2024-2025 Section D2: 239 admitted / 552 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn0sq00sla85o4mkc22eq',
    schoolId: 'cmnwr8iml000ez0ti01wzdugn',
    name: 'Indiana University Bloomington',
    status: 'CLOSED',
    value: 65.09,
    sourceUrl: 'https://iuapps.iu.edu/cds/?p=index&i=home&section=D.+Transfer+Admission&year=2024&campus=Bloomington',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'IU official CDS app — Bloomington CDS 2024-2025 Section D2: 1,352 admitted / 2,077 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1gs016va85ork5skff7',
    schoolId: 'cmnwr8inp0010z0tivwogzepz',
    name: 'University of South Florida',
    status: 'CLOSED',
    value: 57.32,
    sourceUrl: 'https://www.usf.edu/ods/documents/cds/cds-2024-2025-final.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'USF CDS 2024-2025 Section D2: 6,306 admitted / 11,002 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn04g00gwa85ovnpyl7db',
    schoolId: 'cmnwr8int0013z0tiqysdv07w',
    name: 'University of Oregon',
    status: 'CLOSED',
    value: 63.41,
    sourceUrl: 'https://ir.uoregon.edu/uo-overview/common-data-set',
    confidence: 0.93,
    tier: 'OFFICIAL',
    note: 'UO CDS 2024-2025 Section D2: 1,650 admitted / 2,602 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn05900h7a85ouz99pyup',
    schoolId: 'cmnwr8ior001iz0tibsba6d2o',
    name: 'University of Kentucky',
    status: 'CLOSED',
    value: 84.9,
    sourceUrl: 'https://irads.uky.edu/sites/default/files/2025-07/cds-2024-2025_0.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'UK CDS 2024-2025 Section D2: 1,866 admitted / 2,198 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn11300xxa85or0af1bmz',
    schoolId: 'cmnwr8ipr001tz0ti8x7z840u',
    name: 'University of New Hampshire',
    status: 'CLOSED',
    value: 87.6,
    sourceUrl: 'https://www.unh.edu/institutional-research/sites/default/files/media/2025-07/CDS-2024-2025_7.18.25.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'UNH CDS 2024-2025 Section D2: 954 admitted / 1,089 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn0jf00noa85o4bf7u212',
    schoolId: 'cmnwr8ir4002hz0tibdz0myoo',
    name: 'Ball State University',
    status: 'CLOSED',
    value: 88.57,
    sourceUrl: 'https://www.bsu.edu/-/media/www/departmentalcontent/oirds/files/common-data-set/2024-2025-cds.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'Ball State CDS 2024-2025 Section D2: 1,278 admitted / 1,443 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1so01dwa85oe0mm5jg6',
    schoolId: 'cmnwr8ir2002gz0tih2v6dubi',
    name: 'University of New Mexico',
    status: 'CLOSED',
    value: 71.53,
    sourceUrl: 'https://oia.unm.edu/resources/cds_24-25_pdf.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'UNM CDS 2024-2025 Section D2: 1,874 admitted / 2,620 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn18l011ua85o3u0hbnan',
    schoolId: 'cmnwr8irl002oz0tiyc5w37jx',
    name: 'Portland State University',
    status: 'CLOSED',
    value: 94.62,
    sourceUrl: 'https://www.pdx.edu/research-planning/sites/researchplanning.web.wdt.pdx.edu/files/2024-05/CDS_2023-2024%20(Updated%205-8-24%20AM).pdf',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'PSU CDS 2023-2024 Section D2 (latest published edition): 3,168 admitted / 3,348 transfer applicants.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1le019ia85ovsqaewti',
    schoolId: 'cmnwr8irt002tz0tiua8akwdq',
    name: 'San Jose State University',
    status: 'CLOSED',
    value: 69.85,
    sourceUrl: 'https://www.sjsu.edu/irsa/docs/cds/20250411_CDS_2024-2025%20FINAL.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'SJSU CDS 2024-2025 Section D2: 8,036 admitted / 11,504 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1950125a85oggfwyj1h',
    schoolId: 'cmnwr8irx002vz0ti8qpx4iws',
    name: 'California State University, Fullerton',
    status: 'CLOSED',
    value: 77.88,
    sourceUrl: 'https://www.fullerton.edu/data/institutionalresearch/facts/CDS-Master-2024-2025.xlsx',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'CSUF CDS 2024-2025 (XLSX) Section D2: 17,163 admitted / 22,039 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1mt01aea85ooaj8plcl',
    schoolId: 'cmnwr8ita003iz0ti7ezibmu3',
    name: 'Georgia State University',
    status: 'CLOSED',
    value: 52.82,
    sourceUrl: 'https://oie.gsu.edu/data-reporting-systems/common-data-set/',
    confidence: 0.93,
    tier: 'OFFICIAL',
    note: 'GSU CDS 2024-2025 Section D2: 2,504 admitted / 4,741 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn14h00zra85ooguylso1',
    schoolId: 'cmnwr8itk003mz0tirfyu068c',
    name: 'Central Michigan University',
    status: 'CLOSED',
    value: 91.67,
    sourceUrl: 'https://www.cmich.edu/docs/default-source/academic-affairs-division/academic-administration/academic-planning-analysis/reports-(public)/common-data-sets/cds-2024-2025.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'CMU CDS 2024-2025 Section D2: 1,969 admitted / 2,148 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1ul01f4a85oi3q0dhba',
    schoolId: 'cmnwr8itm003nz0tiqazikwxi',
    name: 'Indiana University-Purdue University Indianapolis',
    status: 'CLOSED',
    value: 66.7,
    sourceUrl: 'https://iuapps.iu.edu/cds/?p=index&i=home&section=D.+Transfer+Admission&year=2024&campus=IU-Indianapolis',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'IU official CDS app — IU-Indianapolis (formerly IUPUI) CDS 2024-2025 Section D2: 1,753 admitted / 2,628 transfer applicants (Fall 2024).',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn2m101vha85obfx9bblf',
    schoolId: 'cmnwr8ivx004qz0ti7xo8qk4m',
    name: 'ArtCenter College of Design',
    status: 'CLOSED',
    value: 78.47,
    sourceUrl: 'https://cms.artcenter.edu/assets/24118/src/ArtCenter-CDS-2024-2025.pdf',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'ArtCenter CDS 2024-2025 Section D2: 226 admitted / 288 transfer applicants (Fall 2024).',
  },

  // ── FAILED (5) ──
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn22n01jua85odnk9sw0p',
    schoolId: 'cmn1htkn60002vqf2r731l78m',
    name: 'Harvard University',
    status: 'FAILED',
    value: null,
    sourceUrl: 'https://bpb-us-e1.wpmucdn.com/sites.harvard.edu/dist/6/210/files/2025/06/HarvardUniversity_CDS_2024-2025.pdf',
    confidence: null,
    tier: null,
    note: 'Harvard CDS 2024-2025 Section D2: 16 admitted / 2,256 transfer applicants = 0.71% — a real, verified figure but below the 1% range gate, so not stored.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pmzxc00d0a85o450pif2u',
    schoolId: 'cmnwr8isj0037z0tihc4cw8ue',
    name: 'University of Southern Mississippi',
    status: 'FAILED',
    value: null,
    sourceUrl: 'https://www.usm.edu/institutional-research/cds_2024_2025_final.pdf',
    confidence: null,
    tier: null,
    note: 'USM CDS 2024-2025 Section D2: 2,136 admitted / 2,240 transfer applicants = 95.36% — a real, verified figure but above the 95% range gate, so not stored.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn0ra00rpa85o0q7aj3gu',
    schoolId: 'cmnwr8ird002kz0tifunyipf1',
    name: 'University of North Dakota',
    status: 'FAILED',
    value: null,
    sourceUrl: 'https://und.edu/analytics-and-planning/data-and-reports/common-data-set.html',
    confidence: null,
    tier: null,
    note: 'UND\'s Common Data Set page states reports "will be available soon" — no 2024-2025 or 2023-2024 CDS is published; Section D2 unavailable. No fabrication.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn0ic00n2a85o0l1cb6nl',
    schoolId: 'cmnwr8isu003dz0tijwn1m0s0',
    name: 'University of Texas at Arlington',
    status: 'FAILED',
    value: null,
    sourceUrl: 'https://www.uta.edu/administration/analytics/reports',
    confidence: null,
    tier: null,
    note: 'UT Arlington publishes no Common Data Set on its University Analytics reports page — no verifiable Section D2 transfer source.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pmzit003wa85on7r7ilwv',
    schoolId: 'cmnwr8it2003gz0tixy0e9ok2',
    name: 'Cleveland State University',
    status: 'FAILED',
    value: null,
    sourceUrl: 'https://www.csuohio.edu/dair/csu-common-data-sets-cds',
    confidence: null,
    tier: null,
    note: 'Cleveland State publishes its recent CDS (2022-2025) only as access-restricted personal SharePoint XLSX links (HTTP auth-walled) — Section D2 not publicly retrievable. No fabrication.',
  },

  // ── FAILED (extra): University of Maine ──
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn23a01k4a85okyo8h9zt',
    schoolId: 'cmnwr8iqi0026z0tin3vtpw1p',
    name: 'University of Maine',
    status: 'FAILED',
    value: null,
    sourceUrl: 'https://umaine.edu/oira/common-data-set/',
    confidence: null,
    tier: null,
    note: 'UMaine\'s CDS 2024-2025 is published only behind an authenticated University of Maine System SharePoint link (HTTP 403); DigitalCommons archives stop at 2020-2021. Section D2 not verifiably retrievable. No fabrication.',
  },

  // ── UNAVAILABLE (12) ──
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1ej015fa85oen4ky940',
    schoolId: 'cmnwr8iua003xz0tio2zj4a4z',
    name: 'Saint Louis University',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://www.slu.edu/provost/office-of-institutional-research/institutional-data/index.php',
    confidence: null,
    tier: null,
    note: "Saint Louis University's latest publicly published Common Data Set is 2021-2022; no recent CDS Section D2 transfer figures are published.",
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1xi01gxa85o1qxduirm',
    schoolId: 'cmnwr8ioi001fz0tivlt104p7',
    name: 'Seton Hall University',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://www.shu.edu/institutional-research/reports.html',
    confidence: null,
    tier: null,
    note: "Seton Hall's Institutional Research site publishes Common Data Sets only for 2002-2005; no recent CDS with a Section D2 is published.",
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1yy01hsa85osmu74hvi',
    schoolId: 'cmnwr8iqt002bz0ti5efot7m8',
    name: 'Adelphi University',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://www.adelphi.edu/institutional-research/research/data/',
    confidence: null,
    tier: null,
    note: "Adelphi's publicly listed CDS editions stop at 2022-2023, and that file is served only on an access-restricted intranet link — no publicly retrievable CDS Section D2.",
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn2fm01rqa85oqi552eiq',
    schoolId: 'cmnwr8isl0038z0ti3vw64w98',
    name: 'Northern Illinois University',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://www.niu.edu/effectiveness/institutional-research/index.shtml',
    confidence: null,
    tier: null,
    note: 'NIU does not publish a Common Data Set — its institutional data is released only as Tableau dashboards; no CDS Section D2 transfer figures are available.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn2ki01uma85omhns6js0',
    schoolId: 'cmnwr8iw4004uz0tia8ikoq2b',
    name: 'The Juilliard School',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://www.juilliard.edu/apply-audition/admissions',
    confidence: null,
    tier: null,
    note: 'Juilliard does not publish a Common Data Set; NCES College Navigator reports transfer-in enrollment but no transfer applicant/admit counts. No verifiable transfer acceptance rate.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn2n401w2a85olibyixv1',
    schoolId: 'cmnwr8iwi0051z0tidfdrzv7w',
    name: 'Cooper Union',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://cooper.edu/admissions/facts',
    confidence: null,
    tier: null,
    note: 'Cooper Union does not publish a Common Data Set; no official transfer applicant/admit counts are published. No verifiable transfer acceptance rate.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1fx016ba85oowhv0lks',
    schoolId: 'cmnwr8ivt004oz0tin9oyxi60',
    name: 'School of the Art Institute of Chicago',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://www.saic.edu/consumer-information',
    confidence: null,
    tier: null,
    note: 'SAIC does not publish a Common Data Set; no official transfer applicant/admit counts are published. No verifiable transfer acceptance rate.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn2nm01wca85op8i5w2d8',
    schoolId: 'cmnwr8iw9004wz0tiun4guycq',
    name: 'Curtis Institute of Music',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://www.curtis.edu/apply/',
    confidence: null,
    tier: null,
    note: 'Curtis Institute of Music does not publish a Common Data Set; no official transfer applicant/admit counts are published. No verifiable transfer acceptance rate.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn2jj01u2a85oh3nr46x6',
    schoolId: 'cmnwr8ivw004pz0tie74ukvke',
    name: 'California Institute of the Arts',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://calarts.edu/admissions-aid/admissions/transfer-applicants',
    confidence: null,
    tier: null,
    note: 'CalArts does not publish a Common Data Set; no official transfer applicant/admit counts are published. No verifiable transfer acceptance rate.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1b4013ca85owdqke2dn',
    schoolId: 'cmnwr8iwc004yz0tif1a6h2el',
    name: 'Manhattan School of Music',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://www.msmnyc.edu/admission/transfer-students/',
    confidence: null,
    tier: null,
    note: 'Manhattan School of Music does not publish a Common Data Set; no official transfer applicant/admit counts are published. No verifiable transfer acceptance rate.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1hr0176a85oci7c60kp',
    schoolId: 'cmnwr8iw1004sz0ti04r9dj3i',
    name: 'Maryland Institute College of Art',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://www.mica.edu/admissions/undergraduate-admission/',
    confidence: null,
    tier: null,
    note: 'MICA does not publish a Common Data Set; no official transfer applicant/admit counts are published. No verifiable transfer acceptance rate.',
  },
  {
    kind: 'transferAcceptanceRate',
    targetId: 'cmp9pn1x101gna85ouxp2hf32',
    schoolId: 'cmnwr8iw3004tz0ti9nqf8ivd',
    name: 'California College of the Arts',
    status: 'UNAVAILABLE',
    value: null,
    sourceUrl: 'https://www.cca.edu/admissions/transfer/',
    confidence: null,
    tier: null,
    note: 'California College of the Arts does not publish a Common Data Set; no official transfer applicant/admit counts are published. No verifiable transfer acceptance rate.',
  },
];

const ALL_TARGETS: Target[] = [...GPA_TARGETS, ...TRANSFER_TARGETS];

/** Sanity gate for a CLOSED gpaDistribution: the 5 fractions must sum 0.95–1.05. */
function assertBandsValid(name: string, b: GpaBands): void {
  const sum =
    b['3.75-4.00'] + b['3.50-3.74'] + b['3.25-3.49'] + b['3.00-3.24'] + b['<3.00'];
  if (sum < 0.95 || sum > 1.05) {
    throw new Error(
      `Sanity gate violation: ${name} gpaDistribution fractions sum to ${sum.toFixed(3)} (must be 0.95–1.05)`,
    );
  }
  for (const [band, frac] of Object.entries(b)) {
    if (frac < 0 || frac > 1) {
      throw new Error(`Sanity gate violation: ${name} band ${band}=${frac} (must be 0–1)`);
    }
  }
}

async function main() {
  const closed = ALL_TARGETS.filter((t) => t.status === 'CLOSED');
  console.log(
    `[${VERIFIED_BY}] processing ${ALL_TARGETS.length} targets ` +
      `(${GPA_TARGETS.length} gpaDistribution + ${TRANSFER_TARGETS.length} transferAcceptanceRate). ` +
      `CLOSED=${closed.length} (fetchedAt=${FETCHED_AT})\n`,
  );

  let schoolsUpdated = 0;
  let targetsUpdated = 0;

  for (const t of ALL_TARGETS) {
    let effectiveStatus: Status = t.status;
    let lastError: string | null = t.status === 'CLOSED' ? null : t.note;

    // Defence-in-depth gates for CLOSED rows.
    if (effectiveStatus === 'CLOSED' && t.kind === 'transferAcceptanceRate') {
      if (t.value == null || t.value < MIN_RATE || t.value > MAX_RATE) {
        effectiveStatus = 'FAILED';
        lastError = `transfer rate ${t.value ?? 'null'}% outside valid range ${MIN_RATE}-${MAX_RATE}%`;
      }
    }
    if (effectiveStatus === 'CLOSED' && t.kind === 'gpaDistribution') {
      if (!t.bands) {
        effectiveStatus = 'FAILED';
        lastError = 'gpaDistribution bands missing for CLOSED target';
      } else {
        assertBandsValid(t.name, t.bands);
      }
    }

    // Write the School field + merge provenance for CLOSED rows.
    if (effectiveStatus === 'CLOSED') {
      const school = await prisma.school.findUnique({
        where: { id: t.schoolId },
        select: { id: true, metadata: true },
      });

      if (!school) {
        effectiveStatus = 'FAILED';
        lastError = `school id ${t.schoolId} not found`;
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

        const provenanceEntry =
          t.kind === 'transferAcceptanceRate'
            ? {
                value: (t as TransferTarget).value,
                sourceUrl: t.sourceUrl,
                fetchedAt: FETCHED_AT,
                verifiedBy: VERIFIED_BY,
                confidence: t.confidence,
                tier: t.tier,
                note: t.note,
              }
            : {
                sourceUrl: t.sourceUrl,
                fetchedAt: FETCHED_AT,
                verifiedBy: VERIFIED_BY,
                confidence: t.confidence,
                tier: t.tier,
                note: t.note,
              };

        const mergedMetadata: Prisma.InputJsonValue = {
          ...existingMetadata,
          provenance: {
            ...existingProvenance,
            [t.kind]: provenanceEntry,
          },
        };

        if (t.kind === 'transferAcceptanceRate') {
          await prisma.$executeRaw`
            UPDATE "School"
            SET "transferAcceptanceRate" = ${(t as TransferTarget).value},
                metadata = ${JSON.stringify(mergedMetadata)}::jsonb
            WHERE id = ${t.schoolId}`;
        } else {
          await prisma.$executeRaw`
            UPDATE "School"
            SET "gpaDistribution" = ${JSON.stringify((t as GpaTarget).bands)}::jsonb,
                metadata = ${JSON.stringify(mergedMetadata)}::jsonb
            WHERE id = ${t.schoolId}`;
        }
        schoolsUpdated += 1;
      }
    }

    // Update the ClosureTarget row (DB-only table → raw SQL).
    const status: Status = effectiveStatus;
    const sourceUrl = t.sourceUrl;
    const confidence = status === 'CLOSED' ? t.confidence : null;
    const tier = status === 'CLOSED' ? t.tier : null;
    const errText = status === 'CLOSED' ? null : lastError;

    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = ${status}::"ClosureTargetStatus",
          "sourceUrl" = ${sourceUrl},
          confidence = ${confidence},
          tier = ${tier},
          attempts = attempts + 1,
          "lastAttemptAt" = now(),
          "lastError" = ${errText},
          "updatedAt" = now()
      WHERE id = ${t.targetId}`;
    targetsUpdated += 1;

    if (status === 'CLOSED') {
      const display =
        t.kind === 'transferAcceptanceRate'
          ? `${(t as TransferTarget).value}%`
          : JSON.stringify((t as GpaTarget).bands);
      console.log(`  CLOSED       [${t.kind}] ${t.name} => ${display}`);
    } else if (status === 'UNAVAILABLE') {
      console.log(`  UNAVAILABLE  [${t.kind}] ${t.name}`);
    } else {
      console.log(`  FAILED       [${t.kind}] ${t.name}  (${lastError})`);
    }
  }

  const summary = (kind: Target['kind']) => {
    const rows = ALL_TARGETS.filter((t) => t.kind === kind);
    return {
      closed: rows.filter((t) => t.status === 'CLOSED').length,
      unavailable: rows.filter((t) => t.status === 'UNAVAILABLE').length,
      failed: rows.filter((t) => t.status === 'FAILED').length,
    };
  };
  const ta = summary('transferAcceptanceRate');
  const gd = summary('gpaDistribution');

  console.log(
    `\n[${VERIFIED_BY}] done. ${schoolsUpdated} school rows updated, ` +
      `${targetsUpdated} closure targets updated.\n` +
      `  transferAcceptanceRate: CLOSED=${ta.closed} UNAVAILABLE=${ta.unavailable} FAILED=${ta.failed}\n` +
      `  gpaDistribution:        CLOSED=${gd.closed} UNAVAILABLE=${gd.unavailable} FAILED=${gd.failed}`,
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

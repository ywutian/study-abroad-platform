/**
 * collect-gpa-dist.ts
 *
 * closure-v2 data-collection agent output.
 *
 * Writes REAL, source-verified `School.gpaDistribution` values for a 25-school
 * batch of `ClosureTarget` rows (field = 'gpaDistribution', status = PENDING).
 *
 * Semantics of gpaDistribution:
 *   JSON object → an authoritative source (the school's Common Data Set,
 *     section C11) publishes the percentage breakdown of enrolled first-year
 *     students by high-school GPA band. Stored shape (fractions summing ~1.0):
 *       { "3.75-4.00", "3.50-3.74", "3.25-3.49", "3.00-3.24", "<3.00" }
 *   null → the school's CDS C11 GPA-distribution table is genuinely blank
 *     (the school does not collect / does not report HS GPA), OR the school
 *     publishes no Common Data Set at all → row left NULL, target → UNAVAILABLE.
 *
 * BATCH RESULT — all 25 schools are UNAVAILABLE.
 *
 *   Every CDS that exists for these schools (Northwestern, Williams, Amherst,
 *   Swarthmore, Wellesley, Carleton, Bowdoin, Middlebury, Hamilton, Claremont
 *   McKenna, Harvey Mudd, Cal Poly SLO, Berklee, ArtCenter) was inspected
 *   directly: section C11 is entirely blank (all rows empty, totals 0.00%) —
 *   or, for Northwestern, every cell is the suppression marker "C or t".
 *   These are highly-selective liberal-arts colleges that do not collect /
 *   report a high-school-GPA distribution.
 *
 *   The remaining schools are arts / music conservatories that admit on
 *   portfolio or audition and publish NO Common Data Set with a populated C11
 *   (RISD, Juilliard, Cooper Union, SAIC, CalArts, New England Conservatory,
 *   Curtis Institute, SCAD, MICA, CCA) — or, when a CDS exists (Berklee,
 *   ArtCenter), C11 is blank.
 *
 *   Pomona's CDS is published only as a Tableau dashboard and authoritative
 *   secondary reporting confirms it carries no GPA section.
 *
 *   No fabrication: where there is no real C11 source, gpaDistribution is left
 *   NULL and the target is marked UNAVAILABLE. Nothing is FAILED — every
 *   school's status was positively determined.
 *
 * ClosureTarget is a DB-only table (not in schema.prisma → not on the Prisma
 * client), so its rows are updated via $executeRaw. School rows (for any CLOSED
 * target) use the typed client; gpaDistribution is `Json?`. metadata.provenance
 * .gpaDistribution is MERGED — other provenance keys are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-gpa-dist.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-gpadist-agent';

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

/**
 * Full 25-school batch. Each `lastError` records WHY no C11 GPA distribution
 * exists: either the school's CDS C11 table is genuinely blank, or the school
 * publishes no Common Data Set at all.
 */
const BATCH: BatchTarget[] = [
  // ── UNAVAILABLE: CDS exists, but section C11 GPA table is genuinely blank ──
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2hx01t5a85oxj7zvgg3',
    schoolId: 'cmnwr8iup0042z0tieqofvyfn',
    name: 'Williams College',
    sourceUrl:
      'https://www.williams.edu/institutional-research/files/2025/05/CDS_2024_2025_Williams_V4.pdf',
    lastError:
      'CDS 2024-2025 section C11 (high-school GPA distribution) is published blank — Williams does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmze7000wa85oxx7lgqk4',
    schoolId: 'cmnwr8iur0043z0tie8ndrb65',
    name: 'Amherst College',
    sourceUrl: 'https://www.amherst.edu/system/files/C%20First-Time,%20First-Year%20Admission_3.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — Amherst does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn27y01mya85o4ulzch32',
    schoolId: 'cmnwr8iut0044z0tie7749l79',
    name: 'Swarthmore College',
    sourceUrl:
      'https://www.swarthmore.edu/sites/default/files/assets/documents/institutional-effectiveness-research-assessment/Swarthmore-College-CDS-2024-2025.pdf',
    lastError:
      'CDS 2024-2025 section C11 explicitly states "High School GPA data is not available" (all GPA-band rows blank, totals 0.00%).',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0d000kda85oujd3qum7',
    schoolId: 'cmnwr8iuv0045z0tiq1lprcv8',
    name: 'Pomona College',
    sourceUrl:
      'https://www.pomona.edu/administration/institutional-research/information-center/common-data-set',
    lastError:
      "Pomona's CDS is published only as a Tableau dashboard and carries no GPA section — section C11 (HS GPA distribution) is not reported.",
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2ic01tfa85ocmfkuqx9',
    schoolId: 'cmnwr8iux0046z0tilggqkjw6',
    name: 'Wellesley College',
    sourceUrl:
      'https://wellesley-college.files.svdcdn.com/production/administrative-departments/OIR/CDS_2024-2025-FINAL-1.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — Wellesley does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2az01oxa85odxfmtmvt',
    schoolId: 'cmnwr8iuy0047z0tijtdlowua',
    name: 'Bowdoin College',
    sourceUrl: 'https://www.bowdoin.edu/ir/pdf/bowdoin-cds_2024-2025.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00) — Bowdoin does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0ka00o6a85odh59nblh',
    schoolId: 'cmnwr8iv00048z0tityzi3zx8',
    name: 'Middlebury College',
    sourceUrl:
      'https://www.middlebury.edu/sites/default/files/2025-04/Middlebury%20CDS%202024_2025.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — Middlebury does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn29601nsa85owlg6qc7c',
    schoolId: 'cmnwr8iv20049z0ti4tahvum5',
    name: 'Carleton College',
    sourceUrl:
      'https://carleton-wp-production.s3.amazonaws.com/uploads/sites/292/2025/07/2024-2025-CDS_06032025.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — Carleton does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pmzj40044a85okh78wzrg',
    schoolId: 'cmn1htknm000avqf2g8h3sbdp',
    name: 'Northwestern University',
    sourceUrl: 'https://enrollment.northwestern.edu/data/2024-2025.pdf',
    lastError:
      'CDS 2024-2025 section C11 reports every GPA-band cell as the suppression marker "C or t" — Northwestern does not disclose a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2iw01tpa85oa832dhfj',
    schoolId: 'cmnwr8iv4004az0tioxjsp148',
    name: 'Claremont McKenna College',
    sourceUrl: 'https://www.cmc.edu/sites/default/files/CDS_2024-2025.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — CMC does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1bf013ja85ok0nueuc6',
    schoolId: 'cmnwr8iv5004bz0ti94b7ow5h',
    name: 'Hamilton College',
    sourceUrl: 'https://www.hamilton.edu/documents/CDS_2024-2025.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — Hamilton does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn25j01lha85oaswex42h',
    schoolId: 'cmnwr8iwe004zz0tilegv5ian',
    name: 'Harvey Mudd College',
    sourceUrl:
      'https://www.hmc.edu/institutional-research/wp-content/uploads/sites/42/2024/12/CDS-2024-2025-SharedtoWeb.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00) — Harvey Mudd does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2e101qqa85o2kjgz868',
    schoolId: 'cmnwr8is1002xz0ti23uxhu2j',
    name: 'California Polytechnic State University, San Luis Obispo',
    sourceUrl:
      'https://content-calpoly-edu.s3.amazonaws.com/ir/1/images/CDS-2024-2025_final.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published with no GPA-band rows populated — Cal Poly SLO does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn0qq00rca85ogiku92vm',
    schoolId: 'cmnwr8iw7004vz0ti65mqjgq5',
    name: 'Berklee College of Music',
    sourceUrl: 'https://www.berklee.edu/sites/default/files/2025-02/CDS_2024-2025%20for%20print.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00%) — Berklee admits on audition and does not report a HS GPA distribution.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2lv01vea85ofkqrklar',
    schoolId: 'cmnwr8ivx004qz0ti7xo8qk4m',
    name: 'ArtCenter College of Design',
    sourceUrl: 'https://cms.artcenter.edu/assets/24118/src/ArtCenter-CDS-2024-2025.pdf',
    lastError:
      'CDS 2024-2025 section C11 is published blank (all GPA-band rows empty, totals 0.00) — ArtCenter admits on portfolio and does not report a HS GPA distribution.',
  },

  // ── UNAVAILABLE: arts / music conservatory — no published CDS with a
  //    populated C11; admission is by portfolio or audition ──────────────────
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn21h01j6a85ostp1gldu',
    schoolId: 'cmnwr8ivo004mz0tign5klw7c',
    name: 'Rhode Island School of Design',
    sourceUrl: 'https://info.risd.edu/institutional-effectiveness/',
    lastError:
      'RISD publishes no Common Data Set with a populated section C11 — admission is portfolio-based; no HS GPA distribution is reported.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2kc01uja85o08hk99g4',
    schoolId: 'cmnwr8iw4004uz0tia8ikoq2b',
    name: 'The Juilliard School',
    sourceUrl: 'https://www.juilliard.edu/admissions',
    lastError:
      'Juilliard publishes no Common Data Set with a populated section C11 — admission is audition-based; no HS GPA distribution is reported.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2mz01vza85oq51ij2sf',
    schoolId: 'cmnwr8iwi0051z0tidfdrzv7w',
    name: 'Cooper Union',
    sourceUrl: 'https://cooper.edu/admissions/facts',
    lastError:
      'Cooper Union publishes no Common Data Set with a populated section C11 — no HS GPA distribution is reported.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1fs0168a85ozz8u95nh',
    schoolId: 'cmnwr8ivt004oz0tin9oyxi60',
    name: 'School of the Art Institute of Chicago',
    sourceUrl: 'https://www.saic.edu/about/institutional-research',
    lastError:
      'SAIC publishes no Common Data Set with a populated section C11 — admission is portfolio-based; no HS GPA distribution is reported.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2ng01w9a85ovr6hemct',
    schoolId: 'cmnwr8iw9004wz0tiun4guycq',
    name: 'Curtis Institute of Music',
    sourceUrl: 'https://www.curtis.edu/apply/applying/',
    lastError:
      'Curtis Institute publishes no Common Data Set with a populated section C11 — admission is audition-based; no HS GPA distribution is reported.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2je01tza85ofk3fjjas',
    schoolId: 'cmnwr8ivw004pz0tie74ukvke',
    name: 'California Institute of the Arts',
    sourceUrl: 'https://calarts.edu/admissions-aid',
    lastError:
      'CalArts publishes no Common Data Set with a populated section C11 — admission is portfolio/audition-based; no HS GPA distribution is reported.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2kv01uta85om8hpev95',
    schoolId: 'cmnwr8iwa004xz0tiygic7c6r',
    name: 'New England Conservatory',
    sourceUrl: 'https://necmusic.edu/admissions',
    lastError:
      'New England Conservatory publishes no Common Data Set with a populated section C11 — admission is audition-based; no HS GPA distribution is reported.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn2qx01y9a85on0vluplj',
    schoolId: 'cmnwr8ivz004rz0tik286u7ol',
    name: 'Savannah College of Art and Design',
    sourceUrl: 'https://www.scad.edu/about/institutional-effectiveness/office-institutional-research',
    lastError:
      'SCAD publishes no Common Data Set with a populated section C11 — no HS GPA distribution is reported.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1hk0173a85o4h7tmxg3',
    schoolId: 'cmnwr8iw1004sz0ti04r9dj3i',
    name: 'Maryland Institute College of Art',
    sourceUrl: 'https://www.mica.edu/about-mica/mica-at-a-glance/',
    lastError:
      'MICA publishes no Common Data Set with a populated section C11 — admission is portfolio-based; no HS GPA distribution is reported.',
  },
  {
    status: 'UNAVAILABLE',
    targetId: 'cmp9pn1ww01gka85opcvf70qd',
    schoolId: 'cmnwr8iw3004tz0ti9nqf8ivd',
    name: 'California College of the Arts',
    sourceUrl: 'https://www.cca.edu/about/',
    lastError:
      'CCA publishes no Common Data Set with a populated section C11 — admission is portfolio-based; no HS GPA distribution is reported.',
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
    `[closure-v2-gpadist-agent] batch=${BATCH.length}  CLOSED=${closed.length}  ` +
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
    `\n[closure-v2-gpadist-agent] done. ${schoolsUpdated} school rows updated, ` +
      `${targetsUpdated} closure targets updated.`,
  );
}

main()
  .catch((err) => {
    console.error('[closure-v2-gpadist-agent] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

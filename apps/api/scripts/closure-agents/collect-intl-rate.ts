/**
 * collect-intl-rate.ts
 *
 * closure-v2 data-collection agent output — field `intlAcceptanceRate`
 * (international / non-US-citizen freshman admit rate, %).
 *
 * Batch of 55 ClosureTarget rows with field='intlAcceptanceRate' and
 * status='PENDING' (priority DESC, LIMIT 60 → 55 pending).
 *
 * FINDING — all 55 → UNAVAILABLE:
 *   US universities do NOT publish an admit rate broken out by applicant
 *   citizenship. The Common Data Set (Section C — Admission) reports a single
 *   admit rate for the whole first-year pool; there is no citizenship split.
 *   No school in this batch publishes the number of international applicants
 *   vs international admits in any official institutional source (admissions
 *   office page, Institutional Research / Fact Book, CDS, or credible news).
 *
 *   Third-party college-counseling blogs publish "approximately X%" guesses
 *   for international admit rates, but these are (a) not sourced to any
 *   institutional data and (b) wildly inconsistent across sources for the
 *   same school (e.g. UMD "~45%" vs "~25-30%"). Using them would be
 *   fabrication, so every target is recorded UNAVAILABLE — no value written.
 *
 *   Exception class that COULD be CLOSED — schools that explicitly publish
 *   international applicant/admit counts (e.g. MIT) — none appear in this
 *   batch.
 *
 * `School.intlAcceptanceRate` and `ClosureTarget` exist in the live DB but
 * not in schema.prisma, so this script uses raw SQL.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-intl-rate.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-intl-agent';

type Status = 'CLOSED' | 'UNAVAILABLE' | 'FAILED';
type Tier = 'SCRAPED' | 'OFFICIAL';

interface Target {
  targetId: string;
  schoolId: string;
  name: string;
  status: Status;
  /** Intl admit % — required when status='CLOSED', else null. */
  value: number | null;
  sourceUrl: string | null;
  confidence: number | null;
  tier: Tier | null;
  note: string;
}

const NO_CITIZENSHIP_SPLIT =
  'No official source publishes admit rate split by citizenship — CDS Section C ' +
  'reports a single first-year admit rate. Checked admissions office, ' +
  'Institutional Research / Fact Book, CDS and news; no international ' +
  'applicant-vs-admit counts published. Third-party blog estimates are ' +
  'unsourced and mutually inconsistent — not used (no fabrication).';

const TARGETS: Target[] = [
  ['cmpa293si04dxhws5xluwo7iy', 'cmnwr8iup0042z0tieqofvyfn', 'Williams College'],
  ['cmpa293x004k8hws5l6kapy1p', 'cmnwr8iwi0051z0tidfdrzv7w', 'Cooper Union'],
  ['cmpa293y104lmhws50qiagdnk', 'cmn1htkn80003vqf29zl0f9lr', 'Stanford University'],
  ['cmpa290ty00tohws51ppi841e', 'cmnwr8iut0044z0tie7749l79', 'Swarthmore College'],
  ['cmpa290ov00o2hws5xz3vzcyp', 'cmnwr8iuv0045z0tiq1lprcv8', 'Pomona College'],
  ['cmpa290kl00j6hws5ug8e5754', 'cmn1htkna0004vqf2erll9srp', 'Yale University'],
  ['cmpa290g900e7hws5m3cm03te', 'cmnwr8iv00048z0tityzi3zx8', 'Middlebury College'],
  ['cmpa290cf009zhws5i0veeadf', 'cmn1htkne0006vqf2quzi0v6h', 'California Institute of Technology'],
  ['cmpa290hc00flhws5dxsfu4uh', 'cmn1htknm000avqf2g8h3sbdp', 'Northwestern University'],
  ['cmpa2914p0178hws5g2bvs556', 'cmnwr8ivb004ez0tiduer8l0n', 'Grinnell College'],
  ['cmpa293te04fbhws5l66cnp91', 'cmnwr8ivj004jz0tij2m7ox54', 'Colby College'],
  ['cmpa292t2038mhws5cijdld0y', 'cmn1htko2000hvqf2r5gxwf84', 'Dartmouth College'],
  ['cmpa2909c006ghws54qmyad4u', 'cmnwr8ivm004lz0tio6m2uic4', 'Barnard College'],
  ['cmpa2918701bhhws5qbni3fxn', 'cmn1htkoa000kvqf2oqm36hw5', 'University of Michigan, Ann Arbor'],
  ['cmpa292ns034dhws5rkvr5bie', 'cmn1htkoh000nvqf2uj3pjgxw', 'Carnegie Mellon University'],
  ['cmpa290lk00klhws5hnag3siz', 'cmn1htkoz000uvqf2rnozc3fe', 'University of Southern California'],
  ['cmpa2906x003lhws51dgjddgu', 'cmn1htkp9000yvqf29pcl812t', 'New York University'],
  ['cmpa290gs00ewhws5h8evmg58', 'cmn1htkpw0016vqf20t0lflxm', 'Boston University'],
  ['cmpa2908r005qhws5qjzx03nb', 'cmn1htkq60019vqf2lmijsj2s', 'University of Maryland, College Park'],
  ['cmpa291i601ochws5ojw00me1', 'cmn1htkqj001dvqf2n8mczcpn', 'Wake Forest University'],
  ['cmpa2918t01c7hws5hjuzognf', 'cmnwr8imj000dz0tif3r9fq0l', 'University of Connecticut'],
  ['cmpa2932903kshws5hj7ejzu2', 'cmnwr8ilx0001z0tilru6b1th', 'William & Mary'],
  ['cmpa2937f03ruhws5evw1151p', 'cmnwr8im90007z0ti2n04hf3n', 'University of Pittsburgh'],
  ['cmpa2912d014dhws59nf4ene0', 'cmnwr8imn000fz0ti5zassqtj', 'Pepperdine University'],
  ['cmpa29115012yhws58nzdginp', 'cmnwr8imi000cz0tifntjkili', 'Syracuse University'],
  ['cmpa292v403bfhws5nkpnq04g', 'cmnwr8itt003rz0tizqmu1u5h', 'Yeshiva University'],
  ['cmpa292ha02vuhws5jvy7coyn', 'cmnwr8iua003xz0tio2zj4a4z', 'Saint Louis University'],
  ['cmpa293yh04mbhws54q3vxkwv', 'cmnwr8ime000az0ti9ts1sd20', 'Colorado School of Mines'],
  ['cmpa291z40288hws57bx1lw7a', 'cmnwr8imp000gz0tibbuqx67l', 'University of California, Merced'],
  ['cmpa292vl03c4hws5xl8lcby4', 'cmnwr8ini000wz0ti57rv9m9o', 'Auburn University'],
  ['cmpa290rr00qvhws5g6fnxxyc', 'cmnwr8iol001gz0ticdgvwjkf', 'University of San Francisco'],
  ['cmpa2933a03m7hws5gn13t4ki', 'cmnwr8ioi001fz0tivlt104p7', 'Seton Hall University'],
  ['cmpa2928x02l5hws5ol9pyjzq', 'cmnwr8ioe001ez0tii04p5pvd', 'DePaul University'],
  ['cmpa2919f01cxhws5nekptdjq', 'cmnwr8int0013z0tiqysdv07w', 'University of Oregon'],
  ['cmpa291gh01m7hws5wj333bi6', 'cmnwr8ioy001kz0ti85qspr1l', 'The New School'],
  ['cmpa2936103pqhws5m4peev4z', 'cmnwr8ip1001lz0ti51lr5gad', 'University of Alabama'],
  ['cmpa290v600v3hws564090u3q', 'cmnwr8ip7001nz0ti6qy76djw', 'University of Missouri'],
  ['cmpa2929d02luhws5g6ok0do7', 'cmnwr8ipv001vz0tiqnippgu6', 'Colorado State University'],
  ['cmpa293cw03y8hws5waoe1pzn', 'cmnwr8ipz001xz0ti9f4tlagk', 'George Mason University'],
  ['cmpa292hv02wjhws50p32u03o', 'cmnwr8iq40020z0tif8l8dxxu', 'University of Arkansas'],
  ['cmpa2938003skhws55xb8iebc', 'cmnwr8iq2001zz0tiix4lbz86', 'University of Houston'],
  ['cmpa292id02x9hws5mfiegpwm', 'cmnwr8iq70021z0titshta238', 'University of Hawaii at Manoa'],
  ['cmpa2934y03obhws5ifrmyexy', 'cmnwr8iqt002bz0ti5efot7m8', 'Adelphi University'],
  ['cmpa291sb0213hws5ha9wyfws', 'cmnwr8ird002kz0tifunyipf1', 'University of North Dakota'],
  ['cmpa2925u02gthws5ir61m7m6', 'cmnwr8irv002uz0tic1bpn6g4', 'Bowling Green State University'],
  ['cmpa293o90486hws5x1q7pfg6', 'cmnwr8is4002zz0ti7l7rukwt', 'South Dakota State University'],
  ['cmpa2939x03uohws5pp434qjs', 'cmnwr8ish0036z0tiy3l6tt76', 'California State University, Northridge'],
  ['cmpa2911p013nhws5heb19d02', 'cmnwr8isj0037z0tihc4cw8ue', 'University of Southern Mississippi'],
  ['cmpa293b803w3hws58ha0kvvw', 'cmnwr8iss003cz0tia71q9qy1', 'Idaho State University'],
  ['cmpa2912w0152hws537ko4or4', 'cmnwr8isv003ez0timrhbjznd', 'University of Memphis'],
  ['cmpa291je01prhws5g4og428w', 'cmnwr8isu003dz0tijwn1m0s0', 'University of Texas at Arlington'],
  ['cmpa292zz03hwhws5m5o94ngx', 'cmnwr8itm003nz0tiqazikwxi', 'Indiana University-Purdue University Indianapolis'],
  ['cmpa2927h02izhws5jgjdozw2', 'cmnwr8itk003mz0tirfyu068c', 'Central Michigan University'],
  ['cmpa2929y02mkhws5s0pzluaf', 'cmnwr8iwp0054z0tic1mh49ba', 'James Madison University'],
  ['cmpa292tj039bhws5ufa0vor9', 'cmnwr8iwq0055z0tivbkk0qbk', 'University of North Carolina Wilmington'],
].map(([targetId, schoolId, name]) => ({
  targetId,
  schoolId,
  name,
  status: 'UNAVAILABLE' as Status,
  value: null,
  sourceUrl: null,
  confidence: null,
  tier: null,
  note: NO_CITIZENSHIP_SPLIT,
}));

const MIN_RATE = 1;
const MAX_RATE = 95;

async function main() {
  console.log(
    `[${VERIFIED_BY}] processing ${TARGETS.length} targets (fetchedAt=${FETCHED_AT})\n`,
  );

  let closed = 0;
  let unavailable = 0;
  let failed = 0;

  for (const t of TARGETS) {
    let effectiveStatus: Status = t.status;
    let lastError: string | null = null;

    // Range gate — defence in depth (only relevant for CLOSED rows).
    if (effectiveStatus === 'CLOSED') {
      if (t.value == null || t.value < MIN_RATE || t.value > MAX_RATE) {
        effectiveStatus = 'FAILED';
        lastError = `intl rate ${t.value ?? 'null'}% outside valid range ${MIN_RATE}-${MAX_RATE}%`;
      }
    }

    if (effectiveStatus === 'CLOSED' && t.value != null) {
      const rows = await prisma.$queryRaw<
        Array<{ id: string; metadata: unknown }>
      >`SELECT id, metadata FROM "School" WHERE id = ${t.schoolId}`;

      if (rows.length === 0) {
        effectiveStatus = 'FAILED';
        lastError = `school id ${t.schoolId} not found`;
      } else {
        const existingMetadata =
          rows[0].metadata &&
          typeof rows[0].metadata === 'object' &&
          !Array.isArray(rows[0].metadata)
            ? (rows[0].metadata as Record<string, unknown>)
            : {};

        const existingProvenance =
          existingMetadata.provenance &&
          typeof existingMetadata.provenance === 'object' &&
          !Array.isArray(existingMetadata.provenance)
            ? (existingMetadata.provenance as Record<string, unknown>)
            : {};

        const mergedMetadata = {
          ...existingMetadata,
          provenance: {
            ...existingProvenance,
            intlAcceptanceRate: {
              value: t.value,
              sourceUrl: t.sourceUrl,
              fetchedAt: FETCHED_AT,
              verifiedBy: VERIFIED_BY,
              confidence: t.confidence,
              tier: t.tier,
              note: t.note,
            },
          },
        };

        await prisma.$executeRaw`
          UPDATE "School"
          SET "intlAcceptanceRate" = ${t.value},
              metadata = ${JSON.stringify(mergedMetadata)}::jsonb
          WHERE id = ${t.schoolId}`;
      }
    }

    // ClosureTarget bookkeeping — parameterised UPDATE per the agent spec.
    await prisma.$executeRawUnsafe(
      `UPDATE "ClosureTarget"
       SET status=$1::"ClosureTargetStatus","sourceUrl"=$2,confidence=$3,
           tier=$4,attempts=attempts+1,
           "lastAttemptAt"=now(),"lastError"=$5,"updatedAt"=now()
       WHERE id=$6`,
      effectiveStatus,
      effectiveStatus === 'CLOSED' ? t.sourceUrl : null,
      effectiveStatus === 'CLOSED' ? t.confidence : null,
      effectiveStatus === 'CLOSED' ? t.tier : null,
      lastError,
      t.targetId,
    );

    if (effectiveStatus === 'CLOSED') {
      closed += 1;
      console.log(`  CLOSED       ${t.name} => ${t.value}%  [${t.sourceUrl}]`);
    } else if (effectiveStatus === 'UNAVAILABLE') {
      unavailable += 1;
      console.log(`  UNAVAILABLE  ${t.name}`);
    } else {
      failed += 1;
      console.log(`  FAILED       ${t.name}  (${lastError})`);
    }
  }

  console.log(
    `\n[${VERIFIED_BY}] done. CLOSED=${closed} UNAVAILABLE=${unavailable} FAILED=${failed} (total ${TARGETS.length}).`,
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

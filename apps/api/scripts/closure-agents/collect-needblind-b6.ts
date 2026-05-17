/**
 * collect-needblind-b6.ts
 *
 * closure-v2 data-collection agent output — batch B6.
 *
 * Writes REAL, source-verified `School.needBlindInternational` values for a
 * batch of 40 ClosureTargets (field=needBlindInternational).
 *
 * Semantics of needBlindInternational:
 *   true  → an authoritative source explicitly states need-blind for INTERNATIONAL
 *           applicants (financial information does not affect admission decision)
 *   false → an authoritative source explicitly describes the admission *review* of
 *           international applicants as need-aware / need-sensitive
 *   null  → no clear authoritative statement found → School row NOT touched, target
 *           marked FAILED
 *
 * Aid-ineligibility (no need-based aid for international students) and visa
 * "proof of funds" / I-20 financial-certification requirements are NOT admission
 * policies and never resolve a value — those targets are marked FAILED.
 *
 * Per resolved school:
 *   - prisma.school.update sets needBlindInternational + merges
 *     metadata.provenance.needBlindInternational (other provenance keys preserved).
 *   - ClosureTarget updated via raw SQL (no Prisma model in this checkout):
 *       status = CLOSED (resolved true/false) | FAILED (no authoritative source).
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-needblind-b6.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-needblind-agent-b6';

interface ResolvedTarget {
  targetId: string;
  schoolId: string;
  name: string;
  value: boolean;
  sourceUrl: string;
  confidence: number;
  tier: 'SCRAPED' | 'OFFICIAL';
  note?: string;
}

interface FailedTarget {
  targetId: string;
  schoolId: string;
  name: string;
  reason: string;
}

/**
 * RESOLVED — backed by an explicit, authoritative statement on an official
 * school page (admissions / financial-aid office). Each entry quotes a verbatim
 * statement that applies to the ADMISSION REVIEW of international applicants.
 */
const RESOLVED: ResolvedTarget[] = [
  {
    // "Admission to Curtis is based solely upon demonstration of exceptional
    //  musical promise in the audition process." + "Curtis Institute of Music
    //  is a tuition-free school, providing merit-based, full-tuition
    //  scholarships to all undergraduate and graduate students, regardless of
    //  their financial situation." + "All application and audition materials
    //  are the same for all students applying to Curtis." — curtis.edu official
    //  How to Apply page. Admission is explicitly based solely on musical
    //  promise; financial situation is not a factor, and the policy applies to
    //  all applicants including international → need-blind for international.
    targetId: 'cmp9pn2nf01w8a85oyfhqi1dc',
    schoolId: 'cmnwr8iw9004wz0tiun4guycq',
    name: 'Curtis Institute of Music',
    value: true,
    sourceUrl: 'https://www.curtis.edu/apply/applying/',
    confidence: 0.88,
    tier: 'OFFICIAL',
  },
  {
    // "International forms have no bearing on your competitiveness for admission
    //  or scholarship." — mica.edu official International Student FAQ page.
    //  Explicit statement that an international applicant's financial
    //  documentation does not affect the admission decision → need-blind for
    //  international applicants.
    targetId: 'cmp9pn1hd0172a85oedjxkuy8',
    schoolId: 'cmnwr8iw1004sz0ti04r9dj3i',
    name: 'Maryland Institute College of Art',
    value: true,
    sourceUrl:
      'https://www.mica.edu/applying-to-mica/apply/international-undergraduate/frequently-asked-questions-by-international-students/',
    confidence: 0.85,
    tier: 'OFFICIAL',
  },
];

/**
 * FAILED — no authoritative source making an explicit need-blind / need-aware
 * statement specifically for the ADMISSION REVIEW of INTERNATIONAL applicants.
 * Most institutions only document aid ineligibility or a visa-related "proof of
 * funds" / financial-certification requirement that applies AFTER admission for
 * the I-20 — neither is an admission-review policy. No value is inferred.
 * School row left NULL.
 */
const FAILED: FailedTarget[] = [
  {
    targetId: 'cmp9pn21f01j5a85oj44fxfsy',
    schoolId: 'cmnwr8ivo004mz0tign5klw7c',
    name: 'Rhode Island School of Design',
    reason:
      'Official RISD Student Financial Services international financial-aid page documents aid resources and cost of attendance but makes no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn2k901uia85okp1o01we',
    schoolId: 'cmnwr8iw4004uz0tia8ikoq2b',
    name: 'The Juilliard School',
    reason:
      "Juilliard's official financial-aid page states its need-blind admissions policy applies to U.S. citizens and permanent residents; it makes no explicit need-blind or need-aware admission-review statement for international applicants.",
  },
  {
    targetId: 'cmp9pn0qp00rba85omrcf7epg',
    schoolId: 'cmnwr8iw7004vz0ti65mqjgq5',
    name: 'Berklee College of Music',
    reason:
      'Official Berklee international student financial assistance page documents that entering international students are not considered for need-based institutional aid (aid ineligibility); no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn2pz01xoa85oj49ge3ah',
    schoolId: 'cmnwr8ivr004nz0ti5oh56l0o',
    name: 'Pratt Institute',
    reason:
      'Official Pratt Institute pages document that international students are ineligible for need-based aid and eligible for merit scholarships; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn2jc01tya85o0497wf4f',
    schoolId: 'cmnwr8ivw004pz0tie74ukvke',
    name: 'California Institute of the Arts',
    reason:
      'Official CalArts pages document merit-based international scholarships, aid ineligibility for federal/state funds, and a visa proof-of-funds expectation; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn2lt01vda85o1ati7fvf',
    schoolId: 'cmnwr8ivx004qz0ti7xo8qk4m',
    name: 'ArtCenter College of Design',
    reason:
      'Official ArtCenter pages document merit-only scholarships and an F-1 visa proof-of-funds requirement; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1ay0138a85odfxqu6um',
    schoolId: 'cmnwr8iwc004yz0tif1a6h2el',
    name: 'Manhattan School of Music',
    reason:
      'Official Manhattan School of Music pages state scholarships are based on performance and demonstrated financial need but make no explicit need-blind/need-aware statement for the admission review of international applicants.',
  },
  {
    targetId: 'cmp9pn2qv01y8a85of54226zl',
    schoolId: 'cmnwr8ivz004rz0tik286u7ol',
    name: 'Savannah College of Art and Design',
    reason:
      'No official SCAD page found making an explicit need-blind/need-aware admission-review statement for international applicants (international page documents merit scholarships and a visa Certificate of Financial Support).',
  },
  {
    targetId: 'cmp9pn1wv01gja85o4kfbid0s',
    schoolId: 'cmnwr8iw3004tz0ti9nqf8ivd',
    name: 'California College of the Arts',
    reason:
      'Official CCA pages document that international students are ineligible for need-based aid and eligible for merit scholarships; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pmzrz009va85oo7z01u1t',
    schoolId: 'cmnwr8ipf001qz0ti3d3001d9',
    name: 'University of Tennessee',
    reason:
      'No official University of Tennessee, Knoxville page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn167010ja85oja49g8oa',
    schoolId: 'cmnwr8ipv001vz0tiqnippgu6',
    name: 'Colorado State University',
    reason:
      'No official Colorado State University page found making an explicit need-blind/need-aware admission-review statement for international applicants (only limited scholarship aid documented).',
  },
  {
    targetId: 'cmp9pn1rc01d6a85onds976bq',
    schoolId: 'cmnwr8ipm001sz0tixvcr2p30',
    name: 'Oregon State University',
    reason:
      'Official OSU international admissions pages document an evidence-of-funding (visa) requirement; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn0pm00qpa85o5k9uyxdj',
    schoolId: 'cmnwr8ipx001wz0timhlbfii2',
    name: 'University of Vermont',
    reason:
      'Official UVM Student Financial Services pages state international students are not eligible for need-based aid and have limited merit scholarships; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn10x00xta85ovhn7dyd9',
    schoolId: 'cmnwr8ipr001tz0ti8x7z840u',
    name: 'University of New Hampshire',
    reason:
      'No official University of New Hampshire page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn0xj00vqa85orvxko0fw',
    schoolId: 'cmnwr8ipt001uz0tivghae5e1',
    name: 'University of Cincinnati',
    reason:
      'Official University of Cincinnati pages document merit-based international scholarships (International Outreach Award) and no need-based aid for undergraduate international students; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn26y01mba85o1193g7oi',
    schoolId: 'cmnwr8ipz001xz0ti9f4tlagk',
    name: 'George Mason University',
    reason:
      'Official George Mason pages document merit scholarships, federal-aid ineligibility, and a required Certificate of Financial Responsibility (visa); no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn11e00y4a85om8gtqedt',
    schoolId: 'cmnwr8iq1001yz0ti1jb6g7hi',
    name: 'Louisiana State University',
    reason:
      'No official LSU page found making an explicit need-blind/need-aware admission-review statement for international applicants (LSU documents aid ineligibility and limited scholarship access).',
  },
  {
    targetId: 'cmp9pn1et015la85obhwi1gdr',
    schoolId: 'cmnwr8iq40020z0tif8l8dxxu',
    name: 'University of Arkansas',
    reason:
      'No official University of Arkansas page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn21w01jfa85o4x5c1zog',
    schoolId: 'cmnwr8iq2001zz0tiix4lbz86',
    name: 'University of Houston',
    reason:
      'No official University of Houston page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1f9015wa85oen9u9fm1',
    schoolId: 'cmnwr8iq70021z0titshta238',
    name: 'University of Hawaii at Manoa',
    reason:
      'Official UH Manoa pages document a holistic academic review and an F-1 visa proof-of-funds requirement; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1cg0143a85o3q3wz0qp',
    schoolId: 'cmnwr8iny0016z0tiikip2622',
    name: 'Florida State University',
    reason:
      'Official FSU pages document a post-admission Certification of Financial Responsibility (visa) and merit tuition waivers; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn0fc00lha85o30y7pb7o',
    schoolId: 'cmnwr8iqa0022z0ti9ad68xp2',
    name: 'University of Rhode Island',
    reason:
      'No official University of Rhode Island page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn13200z1a85othqyz4vv',
    schoolId: 'cmnwr8iqf0024z0tiy29w0e1z',
    name: 'Missouri University of Science and Technology',
    reason:
      'Official Missouri S&T pages document merit scholarships and a visa bank-statement requirement; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1rw01dha85ogls4jrs3',
    schoolId: 'cmnwr8iqh0025z0ti7z1ynz4s',
    name: 'Washington State University',
    reason:
      'No official Washington State University page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn0vc00u9a85oplj68ooy',
    schoolId: 'cmnwr8iqc0023z0ti60klqjhy',
    name: 'Kansas State University',
    reason:
      'Official K-State international admissions cost page documents only post-admission visa financial documentation; no explicit need-blind/need-aware admission-review statement was verifiable on an official K-State page.',
  },
  {
    targetId: 'cmp9pn23201k0a85ony8rfobo',
    schoolId: 'cmnwr8iqi0026z0tin3vtpw1p',
    name: 'University of Maine',
    reason:
      'Official University of Maine pages document admissions-based merit scholarships and federal/state aid ineligibility; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn0y000w1a85o41idmsg3',
    schoolId: 'cmnwr8iqk0027z0ti3qm7r15o',
    name: 'University of Central Florida',
    reason:
      'Official UCF international applicants and financial-aid FAQ pages document federal-aid ineligibility and visa documentation requirements; no explicit, verbatim need-blind/need-aware admission-review statement was verifiable on an official UCF page.',
  },
  {
    targetId: 'cmp9pn0q400r0a85o9gyxljgb',
    schoolId: 'cmnwr8iqr002az0ti1une85dx',
    name: 'Rowan University',
    reason:
      'Official Rowan University pages document merit-based international scholarships and need-based aid ineligibility; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn27h01mma85oaru1saap',
    schoolId: 'cmnwr8iqm0028z0ti63txqxzg',
    name: 'Illinois State University',
    reason:
      'Official Illinois State University pages document merit-based partial tuition waivers and aid ineligibility; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn17x011ga85ogy5a8p7u',
    schoolId: 'cmnwr8iqp0029z0ti2wbplonv',
    name: 'Hofstra University',
    reason:
      'Official Hofstra pages document merit-only scholarships for international students and an I-20 financial documentation requirement; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0or00q4a85o8tlj7t3a',
    schoolId: 'cmnwr8iqx002dz0tigsxpge66',
    name: 'Mississippi State University',
    reason:
      'No official Mississippi State University page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1ys01hoa85ohytumoyf',
    schoolId: 'cmnwr8iqt002bz0ti5efot7m8',
    name: 'Adelphi University',
    reason:
      'Official Adelphi University pages document merit/talent/athletic scholarships and federal/state aid ineligibility; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1cz014ea85owe0do9ff',
    schoolId: 'cmnwr8iqy002ez0tizit8vwvw',
    name: 'Ohio University',
    reason:
      'Official Ohio University pages document automatic merit-scholarship consideration and a visa proof-of-funds requirement; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn2bx01pha85o5tf2hmge',
    schoolId: 'cmnwr8ir0002fz0tiuxlv8v32',
    name: 'Kent State University',
    reason:
      'Official Kent State University pages document scholarships and a post-acceptance financial-guarantee (visa) requirement; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1sh01dsa85o7lz82duc',
    schoolId: 'cmnwr8ir2002gz0tih2v6dubi',
    name: 'University of New Mexico',
    reason:
      'No official University of New Mexico page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn2ce01psa85o55t5ludp',
    schoolId: 'cmnwr8ira002jz0tib0nkhdsx',
    name: 'West Virginia University',
    reason:
      'Official West Virginia University pages document academic scholarships for international students; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0j700nka85osndhave2',
    schoolId: 'cmnwr8ir4002hz0tibdz0myoo',
    name: 'Ball State University',
    reason:
      'No official Ball State University page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn2kt01usa85oxuduh5np',
    schoolId: 'cmnwr8iwa004xz0tiygic7c6r',
    name: 'New England Conservatory',
    reason:
      'Official NEC tuition + aid pages document merit and federal need-based aid and a visa Certification of Finances requirement; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
];

async function main() {
  console.log(
    `[${VERIFIED_BY}] batch B6: ${RESOLVED.length} resolved + ${FAILED.length} failed = ${
      RESOLVED.length + FAILED.length
    } targets (fetchedAt=${FETCHED_AT})\n`,
  );

  let schoolUpdated = 0;
  let closed = 0;
  let failed = 0;

  // --- Resolved: update School + ClosureTarget(CLOSED) ---
  for (const r of RESOLVED) {
    const school = await prisma.school.findUnique({
      where: { id: r.schoolId },
      select: { id: true, name: true, metadata: true },
    });

    if (!school) {
      console.warn(`  SKIP ${r.name}: school id ${r.schoolId} not found in DB`);
      continue;
    }

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
        needBlindInternational: {
          value: r.value,
          sourceUrl: r.sourceUrl,
          fetchedAt: FETCHED_AT,
          verifiedBy: VERIFIED_BY,
          confidence: r.confidence,
          tier: r.tier,
        },
      },
    };

    await prisma.school.update({
      where: { id: r.schoolId },
      data: {
        needBlindInternational: r.value,
        metadata: mergedMetadata,
      },
    });
    schoolUpdated += 1;

    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = 'CLOSED',
          "sourceUrl" = ${r.sourceUrl},
          confidence = ${r.confidence},
          tier = ${r.tier},
          attempts = attempts + 1,
          "lastAttemptAt" = now(),
          "lastError" = ${null},
          "updatedAt" = now()
      WHERE id = ${r.targetId}
    `;
    closed += 1;

    console.log(`  OK   ${r.name} => ${r.value}  [${r.sourceUrl}]`);
  }

  // --- Failed: leave School NULL, mark ClosureTarget FAILED ---
  for (const f of FAILED) {
    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = 'FAILED',
          attempts = attempts + 1,
          "lastAttemptAt" = now(),
          "lastError" = ${f.reason},
          "updatedAt" = now()
      WHERE id = ${f.targetId}
    `;
    failed += 1;
    console.log(`  FAIL ${f.name} => null  (${f.reason})`);
  }

  console.log(
    `\n[${VERIFIED_BY}] done. schoolUpdated=${schoolUpdated}, closed=${closed}, failed=${failed}`,
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

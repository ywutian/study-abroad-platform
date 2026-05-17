/**
 * collect-needblind-b5.ts
 *
 * closure-v2 data-collection agent output — batch B5.
 *
 * Writes REAL, source-verified `School.needBlindInternational` values for a
 * batch of 30 ClosureTargets (field=needBlindInternational, art/music
 * conservatories excluded).
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
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-needblind-b5.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-needblind-agent-b5';

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
 * need-blind / need-aware statement that applies to the ADMISSION REVIEW of
 * international applicants.
 */
const RESOLVED: ResolvedTarget[] = [
  {
    // "WPI maintains a need-aware admissions process for international
    //  (non-immigrant) applicants." — wpi.edu official applying-for-aid
    //  international-students page. Explicit need-aware admission-review statement.
    targetId: 'cmp9pn2hg01sua85o9emjpidl',
    schoolId: 'cmnwr8iu0003uz0ti43l07p17',
    name: 'Worcester Polytechnic Institute',
    value: false,
    sourceUrl:
      'https://www.wpi.edu/admissions/tuition-aid/applying-for-aid/international-students',
    confidence: 0.95,
    tier: 'OFFICIAL',
  },
  {
    // "While SLU requires proof of your ability to financially support your
    //  attendance, it does not impact your admission decision." — slu.edu
    //  official international-admission FAQ page. Explicit statement that the
    //  applicant's financial situation does not affect the admission decision
    //  for international applicants → need-blind.
    targetId: 'cmp9pn1ee015ba85onisqonws',
    schoolId: 'cmnwr8iua003xz0tio2zj4a4z',
    name: 'Saint Louis University',
    value: true,
    sourceUrl:
      'https://www.slu.edu/admission/international/frequently-asked-questions.php',
    confidence: 0.92,
    tier: 'OFFICIAL',
  },
  {
    // "Only academic records and test scores will be used to assess your
    //  application." — iastate.edu official international-undergraduate
    //  application-information page. Explicit statement that international
    //  admission is assessed solely on academic factors → financial information
    //  is not a factor → need-blind.
    targetId: 'cmp9pn12j00yqa85o7vegruub',
    schoolId: 'cmnwr8ipc001pz0tiz0bgth66',
    name: 'Iowa State University',
    value: true,
    sourceUrl:
      'https://www.iastate.edu/admission-and-aid/admissions/international-students/international-undergraduate-application-information',
    confidence: 0.88,
    tier: 'OFFICIAL',
  },
];

/**
 * FAILED — no authoritative source making an explicit need-blind / need-aware
 * statement specifically for the ADMISSION REVIEW of INTERNATIONAL applicants.
 * Most public universities (and several privates) only document aid
 * ineligibility or a visa-related "proof of funds" / financial-certification
 * requirement that applies AFTER admission for the I-20 — neither is an
 * admission-review policy. No value is inferred. School row left NULL.
 */
const FAILED: FailedTarget[] = [
  {
    targetId: 'cmp9pn0in00n9a85ohyzqefcn',
    schoolId: 'cmnwr8io5001az0tibgs1vu54',
    name: 'University of California, Santa Cruz',
    reason:
      'Official UCSC admissions/financial-aid pages document only that international students are ineligible for federal/state need-based aid and list merit awards; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pmzvw00c0a85occajvd09',
    schoolId: 'cmnwr8inn000zz0tihkfqe5yc',
    name: 'University of Arizona',
    reason:
      'Official University of Arizona pages state the institution generally cannot administer need-based aid to international students; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0kn00ofa85ox2dlfox0',
    schoolId: 'cmnwr8iu3003vz0tig0fa53lf',
    name: 'Howard University',
    reason:
      'Official Howard University pages document that incoming international students are considered only for merit-based scholarships (ISFAA process); no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1pa01c0a85owr3u0231',
    schoolId: 'cmnwr8inb000sz0ti3r4uwfjt',
    name: 'Illinois Institute of Technology',
    reason:
      'No official Illinois Tech page found making an explicit need-blind/need-aware admission-review statement for international applicants (only proof-of-funds and merit-scholarship documentation).',
  },
  {
    targetId: 'cmp9pn02d00fwa85ofi7yjd6o',
    schoolId: 'cmnwr8iu6003wz0tio3oagiri',
    name: 'Rochester Institute of Technology',
    reason:
      'Official RIT pages document merit-based international scholarships and ineligibility for need-based aid; no explicit, authoritative need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn2oc01wsa85oqvw3qyz4',
    schoolId: 'cmnwr8ime000az0ti9ts1sd20',
    name: 'Colorado School of Mines',
    reason:
      'Official Colorado School of Mines pages document that international students are ineligible for need-based aid but eligible for merit awards; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmzsf00a6a85oriyixfd0',
    schoolId: 'cmnwr8io7001bz0tihu5wo9mh',
    name: 'Rutgers University-Newark',
    reason:
      'No official Rutgers University-Newark page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn0x200vfa85omkxglu5q',
    schoolId: 'cmnwr8imp000gz0tibbuqx67l',
    name: 'University of California, Merced',
    reason:
      'Official UC Merced pages document that international students are ineligible for U.S. federal/state aid; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1bx013sa85otm1c16z6',
    schoolId: 'cmnwr8iob001dz0ti3go71xpz',
    name: 'University of Utah',
    reason:
      'Official University of Utah pages state students on a visa are not considered for merit or need-based University scholarships; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn1qt01cva85ouzdr2053',
    schoolId: 'cmnwr8ini000wz0ti57rv9m9o',
    name: 'Auburn University',
    reason:
      'Official Auburn pages require an Affidavit of Financial Support / bank letter for the visa; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1ii017ma85oh08wyhti',
    schoolId: 'cmnwr8inv0014z0ti6jqhq1ga',
    name: 'University of South Carolina',
    reason:
      'No official University of South Carolina (sc.edu) page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn15g0109a85o656kt7gq',
    schoolId: 'cmnwr8ioe001ez0tii04p5pvd',
    name: 'DePaul University',
    reason:
      'Official DePaul pages document a required Financial Affidavit of Support and merit scholarships; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1xb01gta85ojqv6yp5n',
    schoolId: 'cmnwr8ioi001fz0tivlt104p7',
    name: 'Seton Hall University',
    reason:
      'Official Seton Hall pages document that international students qualify for the same merit scholarships as domestic students; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn04700gsa85omstrh63t',
    schoolId: 'cmnwr8int0013z0tiqysdv07w',
    name: 'University of Oregon',
    reason:
      'Official University of Oregon international scholarships and FAQ pages document scholarship/aid processes but make no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pmzrj009la85o1mc3mp75',
    schoolId: 'cmnwr8iol001gz0ticdgvwjkf',
    name: 'University of San Francisco',
    reason:
      'Official USF pages document that international students are ineligible for need-based aid and must complete a Certification of Finances for the visa; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0o800pua85oudiiqjmi',
    schoolId: 'cmnwr8ioo001hz0tim3isqwz9',
    name: 'Clarkson University',
    reason:
      'Official Clarkson pages state need-based assistance is not offered to international students and document merit scholarships; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn1iz017xa85obj9g831s',
    schoolId: 'cmnwr8iou001jz0tig866z8pb',
    name: 'San Diego State University',
    reason:
      'No official SDSU page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn04y00h3a85o5cseukiy',
    schoolId: 'cmnwr8ior001iz0tibsba6d2o',
    name: 'University of Kentucky',
    reason:
      'Official University of Kentucky pages document merit-based scholarships for international students; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0eq00l6a85oogeopfme',
    schoolId: 'cmnwr8io8001cz0tivir7q6ki',
    name: 'University of Kansas',
    reason:
      'No official University of Kansas page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn0e500kwa85o32px2gf3',
    schoolId: 'cmnwr8ioy001kz0ti85qspr1l',
    name: 'The New School',
    reason:
      'Official The New School pages document that most international students are ineligible for need-based aid but eligible for merit-based aid consideration; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn1yb01hea85oszlmnrbc',
    schoolId: 'cmnwr8ipa001oz0tionb7y3gm',
    name: 'Loyola University Chicago',
    reason:
      'Official Loyola University Chicago pages document that financial assistance for international students is extremely limited and merit scholarships are automatically considered; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmztc00asa85ohr2gln9q',
    schoolId: 'cmnwr8ip7001nz0ti6qy76djw',
    name: 'University of Missouri',
    reason:
      'No official University of Missouri page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn17d0115a85ogjhxcw6r',
    schoolId: 'cmnwr8iwx0059z0tilcfiwj80',
    name: 'University of Texas at Dallas',
    reason:
      'Official UT Dallas pages document that international students are ineligible for need-based aid and require proof of financial resources for the visa; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn20w01iua85o53vbgebw',
    schoolId: 'cmnwr8ip1001lz0ti51lr5gad',
    name: 'University of Alabama',
    reason:
      'Official University of Alabama pages document merit-based international scholarships; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmzdn000ka85ohnikwzyj',
    schoolId: 'cmnwr8inx0015z0tix5dndhpi',
    name: 'Arizona State University',
    reason:
      'Official ASU pages document that international students do not qualify for federal/state aid and have limited institutional need-based aid; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmztt00b3a85owpf3ppy1',
    schoolId: 'cmnwr8ip3001mz0til7q2dopw',
    name: 'University of Oklahoma',
    reason:
      'No official University of Oklahoma page found making an explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1af012xa85op2tszh1p',
    schoolId: 'cmnwr8ipj001rz0tipapk15or',
    name: 'University of Nebraska-Lincoln',
    reason:
      'Official University of Nebraska-Lincoln pages document merit-based scholarship evaluation after admission; no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
];

async function main() {
  console.log(
    `[${VERIFIED_BY}] batch B5: ${RESOLVED.length} resolved + ${FAILED.length} failed = ${
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

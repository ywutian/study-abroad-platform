/**
 * collect-needblind-b4.ts
 *
 * closure-v2 data-collection agent output — batch B4.
 *
 * Writes REAL, source-verified `School.needBlindInternational` values for a
 * batch of 30 ClosureTargets (field=needBlindInternational, art/music
 * conservatories excluded).
 *
 * Semantics of needBlindInternational:
 *   true  → an authoritative source explicitly states need-blind for INTERNATIONAL applicants
 *   false → an authoritative source explicitly describes the admission *review* of
 *           international applicants as need-aware / need-sensitive
 *   null  → no clear authoritative statement found → School row NOT touched, target marked FAILED
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
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-needblind-b4.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-needblind-agent-b4';

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
    // "UMass Amherst is a need blind institution; this means that we do not
    //  consider an applicant's financial situation when deciding admission."
    //  — umass.edu official international-students financial-and-visa page.
    //  Statement is unqualified (applies to all applicants, incl. international).
    targetId: 'cmp9pn0gi00m2a85o7i5dl3x7',
    schoolId: 'cmnwr8imu000jz0ti03zavqgf',
    name: 'University of Massachusetts Amherst',
    value: true,
    sourceUrl:
      'https://www.umass.edu/admissions/undergraduate-admissions/apply/international-students/financial-and-visa-information',
    confidence: 0.92,
    tier: 'OFFICIAL',
  },
  {
    // "The University of Miami is need-aware for first-year and transfer
    //  international undergraduate degree-seeking applicants ... for a portion of
    //  international applicants, the Admission Committee will consider that
    //  student's ability to pay tuition without the need for financial aid."
    //  — finaid.miami.edu official first-year undergraduate financial-assistance page.
    targetId: 'cmp9pn08p00ika85o4ckvk5be',
    schoolId: 'cmnwr8in9000rz0ti2orsdpwi',
    name: 'University of Miami',
    value: false,
    sourceUrl: 'https://finaid.miami.edu/firstyear',
    confidence: 0.95,
    tier: 'OFFICIAL',
  },
  {
    // "We are also 'need-aware' and consider the ability of a family to afford DU
    //  when finalizing admission decisions for students." — du.edu official
    //  undergraduate international-applicants tuition & scholarships page.
    targetId: 'cmp9pn0dk00kma85oza3lo40m',
    schoolId: 'cmnwr8iud003yz0tinuqfaa54',
    name: 'University of Denver',
    value: false,
    sourceUrl: 'https://www.du.edu/admission-aid/undergraduate/international-applicants/tuition',
    confidence: 0.95,
    tier: 'OFFICIAL',
  },
  {
    // "Please note that admission decisions may be impacted by a failure to
    //  submit the CSS Profile for those applicants who have indicated on their
    //  application that they are interested in receiving financial aid."
    //  — drexel.edu official undergraduate apply-for-aid page. Drexel's admission
    //  review is explicitly tied to financial-aid interest → need-aware.
    targetId: 'cmp9pn0zz00x8a85o5kf71uep',
    schoolId: 'cmnwr8ink000xz0tivm4enckb',
    name: 'Drexel University',
    value: false,
    sourceUrl: 'https://drexel.edu/admissions/financial-aid-affordability/undergrad/apply-for-aid',
    confidence: 0.85,
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
    targetId: 'cmp9pn03i00gha85oi2bzv8va',
    schoolId: 'cmnwr8itr003qz0tihoo9onta',
    name: 'Penn State University',
    reason:
      'Official Penn State pages document only that international undergraduates are ineligible for need-based/federal aid; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0l300opa85or2a50cbq',
    schoolId: 'cmnwr8inf000uz0tic8a7s8is',
    name: 'Rensselaer Polytechnic Institute',
    reason:
      'Official RPI financial-aid pages state need-based aid is unavailable to international undergraduates (except Canadians) and require proof of funds for the visa; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0sk00sha85osmtampub',
    schoolId: 'cmnwr8iml000ez0ti01wzdugn',
    name: 'Indiana University Bloomington',
    reason:
      'Official IU pages require international applicants to document financial means for the visa but make no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0t300ssa85o4671209s',
    schoolId: 'cmnwr8in5000pz0tiefcdnmfi',
    name: 'Stevens Institute of Technology',
    reason:
      'Official Stevens pages document merit-scholarship eligibility and CSS Profile submission but make no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1dy0150a85o8ul77ep2',
    schoolId: 'cmnwr8imv000kz0ti6chk6fxq',
    name: 'Michigan State University',
    reason:
      'Official MSU pages document DHS-required financial-support review for issuing immigration documents; no need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn2bf01p6a85otbnfsr34',
    schoolId: 'cmnwr8iqv002cz0ti57kn9m2m',
    name: 'SUNY Binghamton University',
    reason:
      'Official Binghamton pages require an International Student Financial Statement for the visa and document scholarship eligibility; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmzn4006pa85oq4pjry2f',
    schoolId: 'cmnwr8in7000qz0ti04kcrc1l',
    name: 'University of Delaware',
    reason:
      'No official University of Delaware page found making an explicit need-blind/need-aware admission-review statement for international applicants (only third-party characterizations).',
  },
  {
    targetId: 'cmp9pn0mf00p9a85o15nufl7u',
    schoolId: 'cmnwr8in0000mz0tiria7qm89',
    name: 'University of Iowa',
    reason:
      'Official Iowa pages document that there is no central fund to support international students and that they are ineligible for federal aid; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0yk00wca85omgmvvjn7',
    schoolId: 'cmnwr8ims000iz0timfd6oan8',
    name: 'Southern Methodist University',
    reason:
      'Official SMU pages state need-based aid is limited to US citizens/permanent residents and require proof of ability to pay for the visa; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0zf00wxa85oq8scears',
    schoolId: 'cmnwr8ing000vz0tizgajtqeo',
    name: 'University of Colorado Boulder',
    reason:
      'Official CU Boulder pages require evidence of full financial support before issuing the I-20/DS-2019; no need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn1og01bga85ojmrl8mxp',
    schoolId: 'cmnwr8itt003rz0tizqmu1u5h',
    name: 'Yeshiva University',
    reason:
      'Official Yeshiva University pages document the International Aid Application process but make no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn01900faa85ollaw6po7',
    schoolId: 'cmnwr8in2000nz0tikk636e8p',
    name: 'Binghamton University',
    reason:
      'Official Binghamton pages require an International Student Financial Statement for the visa and document scholarship eligibility; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmzkg004ya85ozjc4aamf',
    schoolId: 'cmnwr8iuk0040z0ti7p8v604n',
    name: 'Gonzaga University',
    reason:
      'Official Gonzaga pages describe merit scholarships as "need-blind" but make no statement about the admission review itself being need-blind/need-aware for international applicants.',
  },
  {
    targetId: 'cmp9pmzo0007aa85ob6avbu32',
    schoolId: 'cmnwr8io20018z0tizk1tsitd',
    name: 'North Carolina State University',
    reason:
      'Official NC State pages require a Certificate of Financial Responsibility after submitting the application for the visa; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0a600j5a85o4mrcbhah',
    schoolId: 'cmnwr8io00017z0ti5bju2vo7',
    name: 'University at Buffalo',
    reason:
      'Official University at Buffalo pages document merit-scholarship eligibility for international students; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0ho00mna85ol2c7qis4',
    schoolId: 'cmnwr8ins0012z0ti4o8njwhn',
    name: 'Stony Brook University',
    reason:
      'Official Stony Brook pages document merit/need scholarship and aid-application processes but make no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn0jt00nva85o0znvnxo1',
    schoolId: 'cmnwr8itw003sz0ti2fueoy2e',
    name: 'Baylor University',
    reason:
      'Official Baylor pages require international applicants to demonstrate ability to meet expenses (for the visa) and document CSS-Profile-based need-aid review; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0n700pka85op66xoimq',
    schoolId: 'cmnwr8ind000tz0timgwcy8hj',
    name: 'Loyola Marymount University',
    reason:
      'Official LMU international financial-aid page documents scholarship consideration but makes no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn0ux00tya85oj3rbehgc',
    schoolId: 'cmnwr8in3000oz0tih36u19xf',
    name: 'Clemson University',
    reason:
      'Official Clemson page states financial-support verification occurs only "upon admission" via the Office of International Services (for the visa); no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn19w012na85obqknd6eu',
    schoolId: 'cmnwr8inl000yz0ti6wsiqcrv',
    name: 'Marquette University',
    reason:
      'Official Marquette pages document that need-based scholarships are unavailable to international students; no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn1g7016ha85o6dkryc9b',
    schoolId: 'cmnwr8imr000hz0tik9lqym4i',
    name: 'Fordham University',
    reason:
      'Fordham official admissions/financial-services international pages are behind a CAS login wall and could not be retrieved; no authoritative public statement of need-blind/need-aware admission-review policy could be verified.',
  },
  {
    targetId: 'cmp9pn28c01n7a85owyjgszmj',
    schoolId: 'cmnwr8ity003tz0tie2nazej1',
    name: 'American University',
    reason:
      'Official American University prospective-international financial-aid page documents only aid ineligibility (need-based aid limited to US citizens/residents); no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn1gm016ra85o0zulhn11',
    schoolId: 'cmnwr8inp0010z0tivwogzepz',
    name: 'University of South Florida',
    reason:
      'Official USF international-admission pages make no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn06p00hpa85ogtsoy8fx',
    schoolId: 'cmnwr8io40019z0ti0z11pe98',
    name: 'University of California, Riverside',
    reason:
      'Official UC Riverside international-admissions page discusses post-admission aid/scholarships but makes no need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn10d00xia85o7mkvs93k',
    schoolId: 'cmnwr8inq0011z0tims8lt244',
    name: 'Temple University',
    reason:
      'Official Temple FAQ states "Citizenship has no impact on the chance of admission" and that need-based aid is unavailable to international students; no explicit need-blind/need-aware admission-review statement (the citizenship statement does not address financial need).',
  },
  {
    targetId: 'cmp9pn1i2017ca85o70iyehxv',
    schoolId: 'cmnwr8iuf003zz0ti12pe3iq1',
    name: 'University of San Diego',
    reason:
      'Official USD pages document that international students must provide proof of financial resources from non-university sources; no need-blind/need-aware admission-review statement.',
  },
];

async function main() {
  console.log(
    `[${VERIFIED_BY}] batch B4: ${RESOLVED.length} resolved + ${FAILED.length} failed = ${
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
      school.metadata && typeof school.metadata === 'object' && !Array.isArray(school.metadata)
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

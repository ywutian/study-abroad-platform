/**
 * collect-needblind-b2.ts
 *
 * closure-v2 data-collection agent output — batch B2.
 *
 * Writes REAL, source-verified `School.needBlindInternational` values for a
 * batch of 30 ClosureTargets (field=needBlindInternational, art/music
 * conservatories excluded).
 *
 * Semantics of needBlindInternational:
 *   true  → an authoritative source explicitly states need-blind for INTERNATIONAL applicants
 *   false → an authoritative source explicitly states need-aware/need-sensitive for INTERNATIONAL applicants
 *   null  → no clear authoritative statement found → School row NOT touched, target marked FAILED
 *
 * Per resolved school:
 *   - prisma.school.update sets needBlindInternational + merges
 *     metadata.provenance.needBlindInternational (other provenance keys preserved).
 *   - ClosureTarget updated via raw SQL (no Prisma model in this checkout):
 *       status = CLOSED (resolved true/false) | FAILED (no authoritative source).
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-needblind-b2.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-needblind-agent-b2';

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
 * RESOLVED — backed by an explicit, authoritative statement (official school
 * page / FAQ, or an authoritative news report for a documented policy change).
 */
const RESOLVED: ResolvedTarget[] = [
  {
    // "All candidates (including non-US citizens or non-permanent residents)
    //  are reviewed without consideration of a student's financial resources."
    //  / "our 'Need-Blind' admissions policy applies to everyone."
    //  — uadmissions.georgetown.edu official international-applicants page
    targetId: 'cmp9pn1pr01caa85ovh8u2fos',
    schoolId: 'cmn1htkoc000lvqf2s5pgbhxx',
    name: 'Georgetown University',
    value: true,
    sourceUrl: 'https://uadmissions.georgetown.edu/applying/international/',
    confidence: 0.95,
    tier: 'OFFICIAL',
    note: 'Admission is need-blind for all incl. international; aid availability is separately limited.',
  },
  {
    // "Our admission process is need-blind. Ability to pay, or interest in
    //  financial aid, does not affect admission decisions." — financialaid.usc.edu
    //  official prospective-students page (unqualified statement; international
    //  applicants are separately ineligible for need-based aid, not for
    //  need-blind review).
    targetId: 'cmp9pmzpd0086a85oivfw815h',
    schoolId: 'cmn1htkoz000uvqf2rnozc3fe',
    name: 'University of Southern California',
    value: true,
    sourceUrl:
      'https://financialaid.usc.edu/undergraduate-financial-aid/prospective-students/financial-aid-at-usc/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Need-blind statement is general (not international-specific carve-out); intl applicants ineligible for need-based aid but admission review is need-blind.',
  },
  {
    // "the University of Chicago is need-blind for domestic students, but is
    //  need-aware for international students." — financialaid.uchicago.edu
    //  official international financial-aid page.
    targetId: 'cmp9pn00800epa85ozeene0ki',
    schoolId: 'cmn1htkns000dvqf2a150rn2s',
    name: 'University of Chicago',
    value: false,
    sourceUrl:
      'https://financialaid.uchicago.edu/undergraduate/the-application-process/international/',
    confidence: 0.95,
    tier: 'OFFICIAL',
  },
  {
    // "Rice considers international applicants on a need-aware basis..."
    //  — admission.rice.edu official first-year-international-applicants page.
    targetId: 'cmp9pn07g00i0a85occbq3txo',
    schoolId: 'cmn1htko0000gvqf2pmjc1xi9',
    name: 'Rice University',
    value: false,
    sourceUrl: 'https://admission.rice.edu/apply/first-year-international-applicants',
    confidence: 0.97,
    tier: 'OFFICIAL',
  },
  {
    // International undergraduates on temporary visas are required to show
    //  proof of sufficient financial resources; U-M is need-aware for
    //  international admission. — finaid.umich.edu official international-students page.
    targetId: 'cmp9pn01s00fla85ob8taa87m',
    schoolId: 'cmn1htkoa000kvqf2oqm36hw5',
    name: 'University of Michigan, Ann Arbor',
    value: false,
    sourceUrl: 'https://finaid.umich.edu/apply-aid/international-students',
    confidence: 0.85,
    tier: 'OFFICIAL',
  },
  {
    // "For international students, Emory is need-aware, meaning that your
    //  financial situation may have an impact on your admission decision."
    //  — studentaid.emory.edu official undergraduate international aid page.
    targetId: 'cmp9pn0h600mda85oxw7jhw6k',
    schoolId: 'cmn1htkoj000ovqf226pta7or',
    name: 'Emory University',
    value: false,
    sourceUrl: 'https://studentaid.emory.edu/undergraduate/apply/new-students/international.html',
    confidence: 0.96,
    tier: 'OFFICIAL',
  },
  {
    // "Washington University's need-blind policy applies only to first-year
    //  applicants who are U.S. citizens or permanent residents" — i.e.
    //  international first-year admission is need-aware.
    //  — financialaid.washu.edu official international-applicant page.
    targetId: 'cmp9pn29l01o1a85o5dvqjnka',
    schoolId: 'cmn1htkoo000qvqf2jgkrffw1',
    name: 'Washington University in St. Louis',
    value: false,
    sourceUrl: 'https://financialaid.washu.edu/apply-for-aid/international-applicant-process/',
    confidence: 0.95,
    tier: 'OFFICIAL',
  },
  {
    // "Davidson College considers financial need during the admission process
    //  and is need-aware for applicants who are not citizens of the United
    //  States." — davidson.edu official international admission & aid FAQ.
    targetId: 'cmp9pmzji004da85o452jw8pl',
    schoolId: 'cmnwr8ive004gz0tihs1kxbek',
    name: 'Davidson College',
    value: false,
    sourceUrl:
      'https://www.davidson.edu/admission-and-financial-aid/admission-process-help/frequently-asked-questions/international-admission-aid-faqs',
    confidence: 0.96,
    tier: 'OFFICIAL',
  },
  {
    // "Colgate is need-aware in the application process for all students, both
    //  US and non-US citizens." — colgate.edu official international-applicants page.
    targetId: 'cmp9pn08400iaa85o7antr9na',
    schoolId: 'cmnwr8ivd004fz0tiwbcr93y2',
    name: 'Colgate University',
    value: false,
    sourceUrl: 'https://www.colgate.edu/admission-aid/apply/international-applicants',
    confidence: 0.97,
    tier: 'OFFICIAL',
  },
  {
    // "Barnard has limited funding for International first-year applicants and
    //  therefore is need-aware and does consider financial need as a factor
    //  when reviewing these applications." — barnard.edu official aid page.
    targetId: 'cmp9pmzgz002na85ore3bai8q',
    schoolId: 'cmnwr8ivm004lz0tio6m2uic4',
    name: 'Barnard College',
    value: false,
    sourceUrl: 'https://barnard.edu/finaid/apply-for-aid',
    confidence: 0.96,
    tier: 'OFFICIAL',
  },
  {
    // UVA does not award financial aid to international students and explicitly
    //  advises against applying if unable to self-finance; international
    //  admission is need-aware. — admission.virginia.edu official international page.
    targetId: 'cmp9pmzql0090a85o5c62cw5v',
    schoolId: 'cmn1htkom000pvqf2se90bue1',
    name: 'University of Virginia',
    value: false,
    sourceUrl: 'https://admission.virginia.edu/i-am/international',
    confidence: 0.82,
    tier: 'OFFICIAL',
  },
  {
    // "Colby is need-aware, not need-blind" for admission; meets full
    //  demonstrated need for admitted students incl. international.
    //  — afa.colby.edu official international-applicants page.
    targetId: 'cmp9pn2js01u8a85oaxh1st8h',
    schoolId: 'cmnwr8ivj004jz0tij2m7ox54',
    name: 'Colby College',
    value: false,
    sourceUrl: 'https://afa.colby.edu/apply/requirements/international-applicants/',
    confidence: 0.9,
    tier: 'OFFICIAL',
  },
  {
    // "Bates is need-aware for international students, meaning that on occasion,
    //  a student's financial need may impact their admission decision."
    //  — bates.edu official international financial-aid page.
    targetId: 'cmp9pn2mh01voa85ok3tockkx',
    schoolId: 'cmnwr8ivl004kz0tiv0vgf6c6',
    name: 'Bates College',
    value: false,
    sourceUrl: 'https://www.bates.edu/financial-services/financial-aid/international-undergraduates/',
    confidence: 0.95,
    tier: 'OFFICIAL',
  },
  {
    // "NYU campuses are need-aware schools, so your financial ability to pay
    //  will be taken into consideration" for international undergraduates.
    //  — nyu.edu financial-aid guidance for international applicants.
    targetId: 'cmp9pn0vs00uka85ofamt1p4q',
    schoolId: 'cmn1htkp9000yvqf29pcl812t',
    name: 'New York University',
    value: false,
    sourceUrl: 'https://www.nyu.edu/admissions/financial-aid-and-scholarships.html',
    confidence: 0.85,
    tier: 'SCRAPED',
  },
];

/**
 * FAILED — no authoritative source making an explicit need-blind / need-aware
 * statement specifically for INTERNATIONAL applicants. Most public universities
 * only state a visa-related "proof of funds" requirement (not an admission
 * policy), so no value is inferred. Left NULL.
 */
const FAILED: FailedTarget[] = [
  {
    targetId: 'cmp9pmzc10000a85ohtuxsno3',
    schoolId: 'cmnwr8iwg0050z0tiyrfhaavh',
    name: 'Rose-Hulman Institute of Technology',
    reason: 'No authoritative statement on need-blind/need-aware for international applicants.',
  },
  {
    targetId: 'cmp9pn2my01vya85oq2e3g2by',
    schoolId: 'cmnwr8iwi0051z0tidfdrzv7w',
    name: 'Cooper Union',
    reason:
      'Official intl page confirms only that immigration status is not considered; no explicit need-blind/need-aware statement for international financial need.',
  },
  {
    targetId: 'cmp9pn2qf01xya85o1h6dw4i8',
    schoolId: 'cmnwr8iwl0052z0ti9adsxk6l',
    name: 'Olin College of Engineering',
    reason:
      'Need-blind documented for domestic (FAFSA-based) applicants only; no international-specific need-blind/need-aware statement.',
  },
  {
    targetId: 'cmp9pn2dz01qpa85o1o8o8x9q',
    schoolId: 'cmnwr8is1002xz0ti23uxhu2j',
    name: 'California Polytechnic State University, San Luis Obispo',
    reason: 'No authoritative need-blind/need-aware admission statement for international applicants.',
  },
  {
    targetId: 'cmp9pmzy700dia85oxh6491dl',
    schoolId: 'cmn1htknv000evqf29yjvrstt',
    name: 'University of California, Berkeley',
    reason:
      'Only a visa-related proof-of-funding requirement found; no stated need-blind/need-aware international admission policy.',
  },
  {
    targetId: 'cmp9pn1m5019za85ogqdg8xgl',
    schoolId: 'cmn1htkny000fvqf2jlmz8ej1',
    name: 'University of California, Los Angeles',
    reason:
      'Only a visa-related proof-of-funding requirement found; no stated need-blind/need-aware international admission policy.',
  },
  {
    targetId: 'cmp9pn1n401ala85o0tl0rkow',
    schoolId: 'cmnwr8ivg004hz0ti8c1ggiw8',
    name: 'Smith College',
    reason:
      'No explicit international-specific need-blind statement; described as predominantly need-blind with a need-aware component for borderline cases (not cleanly classifiable).',
  },
  {
    targetId: 'cmp9pmzk0004na85ojuqanyut',
    schoolId: 'cmn1htkor000rvqf282ibd6kz',
    name: 'University of California, Davis',
    reason:
      'No authoritative need-blind/need-aware admission statement for international applicants.',
  },
  {
    targetId: 'cmp9pmzsv00aha85o66sh1b9t',
    schoolId: 'cmn1htkou000svqf2356l4yfj',
    name: 'University of California, San Diego',
    reason:
      'Only a visa-related proof-of-funding requirement found; no stated need-blind/need-aware international admission policy.',
  },
  {
    targetId: 'cmp9pmzyp00dta85o88trf6ee',
    schoolId: 'cmn1htkow000tvqf2qc5n3qhd',
    name: 'University of Florida',
    reason:
      'Only a visa-related proof-of-funding (I-20) requirement found; no stated need-blind/need-aware international admission policy.',
  },
  {
    targetId: 'cmp9pn19h012ca85o4ugrdyxu',
    schoolId: 'cmn1htkp1000vvqf2iogfyk82',
    name: 'University of Texas at Austin',
    reason:
      'No authoritative need-blind/need-aware admission statement for international applicants.',
  },
  {
    targetId: 'cmp9pmzg20021a85ojeu9rplq',
    schoolId: 'cmn1htkp4000wvqf2ah317ku6',
    name: 'Georgia Institute of Technology',
    reason:
      'No authoritative explicit need-blind/need-aware admission statement for international applicants.',
  },
  {
    targetId: 'cmp9pmzhd002xa85oow82pk4j',
    schoolId: 'cmn1htkp6000xvqf2rhj774d8',
    name: 'University of California, Irvine',
    reason:
      'Only a visa-related proof-of-funding requirement found; no stated need-blind/need-aware international admission policy.',
  },
  {
    targetId: 'cmp9pn09g00iua85o4elwnfn8',
    schoolId: 'cmn1htkpi0011vqf28xmv4but',
    name: 'University of Wisconsin-Madison',
    reason:
      'No authoritative need-blind/need-aware admission statement for international applicants.',
  },
  {
    targetId: 'cmp9pmzf5001ga85o17fcf2jt',
    schoolId: 'cmn1htkoe000mvqf2odaszvmk',
    name: 'University of North Carolina at Chapel Hill',
    reason:
      'No authoritative statement explicitly tying need-blind/need-aware admission to international applicants.',
  },
  {
    targetId: 'cmp9pn1kt0194a85oybtr45yo',
    schoolId: 'cmn1htkoh000nvqf2uj3pjgxw',
    name: 'Carnegie Mellon University',
    reason:
      'Official intl page confirms only that no institutional aid is offered to international students; no explicit need-blind/need-aware admission statement for international applicants.',
  },
];

async function main() {
  console.log(
    `[${VERIFIED_BY}] batch B2: ${RESOLVED.length} resolved + ${FAILED.length} failed = ${
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

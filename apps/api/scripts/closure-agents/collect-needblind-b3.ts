/**
 * collect-needblind-b3.ts
 *
 * closure-v2 data-collection agent output — batch B3.
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
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-needblind-b3.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-needblind-agent-b3';

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
 * school page (admissions / financial-aid office). Every entry below has a
 * verbatim need-aware statement for INTERNATIONAL applicants. No school in
 * this batch was found to be explicitly need-blind for international
 * applicants, so all resolved values are `false`.
 */
const RESOLVED: ResolvedTarget[] = [
  {
    // "Boston College is need-blind for domestic students, but need-aware for
    //  international students, which means your ability to pay can affect
    //  admissions decisions." — bc.edu official undergraduate admission pages.
    targetId: 'cmp9pn0uh00toa85omot566fa',
    schoolId: 'cmn1htkpl0012vqf28whnvaoj',
    name: 'Boston College',
    value: false,
    sourceUrl: 'https://www.bc.edu/bc-web/admission/apply/international.html',
    confidence: 0.95,
    tier: 'OFFICIAL',
  },
  {
    // "Admissions decisions for non-US citizens are, however, need-aware. This
    //  means that international citizens will be evaluated for admission with
    //  consideration of the ability of students, guardians, or sponsors to pay
    //  educational costs alongside our holistic admissions process."
    //  — lehigh.edu official international-students admission page.
    targetId: 'cmp9pmzps008ga85or5k9wart',
    schoolId: 'cmn1htkq9001avqf25ziy94gn',
    name: 'Lehigh University',
    value: false,
    sourceUrl: 'https://www2.lehigh.edu/admissions/international-students',
    confidence: 0.97,
    tier: 'OFFICIAL',
  },
  {
    // "Unless a foreign-national applicant is offered a merit scholarship, he or
    //  she must show sufficient support with the Confidential Financial
    //  Information for International Applicants Form before the University will
    //  consider an applicant for admission." — admissions.wfu.edu official
    //  international-students page (ability to pay gates admission review).
    targetId: 'cmp9pn0fy00lsa85ozprq5i52',
    schoolId: 'cmn1htkqj001dvqf2n8mczcpn',
    name: 'Wake Forest University',
    value: false,
    sourceUrl: 'https://admissions.wfu.edu/become-a-deacon/international/',
    confidence: 0.9,
    tier: 'OFFICIAL',
  },
  {
    // "Financial need is a contributing factor, however, for international
    //  applicants. As a result, admission is highly selective for students with
    //  financial need." / "Applicants unable to secure the needed funding ...
    //  cannot be admitted to the University." — admissions.rochester.edu official
    //  international-students page.
    targetId: 'cmp9pn0w600uua85ojyode331',
    schoolId: 'cmnwr8ilt0000z0ticnudxg0y',
    name: 'University of Rochester',
    value: false,
    sourceUrl: 'https://admissions.rochester.edu/applying/international-students/',
    confidence: 0.95,
    tier: 'OFFICIAL',
  },
  {
    // "Admission for first-year international students is need-aware, which
    //  means your family's ability to pay for your education may be a factor in
    //  your admission decision." — villanova.edu official Office of Financial
    //  Assistance international-students page.
    targetId: 'cmp9pn2ph01xea85o2pmsmucb',
    schoolId: 'cmnwr8iun0041z0tin8tw3f6b',
    name: 'Villanova University',
    value: false,
    sourceUrl:
      'https://www.villanova.edu/university/office-of-financial-assistance/financial-aid-process/international-students.html',
    confidence: 0.97,
    tier: 'OFFICIAL',
  },
  {
    // "Undergraduate admission to Northeastern is need-aware for all
    //  international students, which means the Admissions Committee will
    //  consider your ability to cover your Northeastern educational costs when
    //  your admissions decision is being made." — studentfinance.northeastern.edu
    //  official international-students aid page.
    targetId: 'cmp9pn0p800qfa85ofyyy1eep',
    schoolId: 'cmnwr8im30004z0tip77mx1gm',
    name: 'Northeastern University',
    value: false,
    sourceUrl: 'https://studentfinance.northeastern.edu/applying-for-aid/international-students/',
    confidence: 0.97,
    tier: 'OFFICIAL',
  },
];

/**
 * FAILED — no authoritative source making an explicit need-blind / need-aware
 * statement specifically for INTERNATIONAL applicants. Most public universities
 * (and several privates) only state aid ineligibility or a visa-related
 * "proof of funds" / financial-certification requirement that applies AFTER
 * admission for the I-20 — neither of which is an admission-review policy.
 * No value is inferred. School row left NULL.
 */
const FAILED: FailedTarget[] = [
  {
    targetId: 'cmp9pn1dg014pa85ob3ji5pa9',
    schoolId: 'cmn1htkpe0010vqf2xzzjz779',
    name: 'University of Illinois Urbana-Champaign',
    reason:
      'Official aid page states no need-based aid for international undergraduates but makes no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn1q801cka85obowufoi0',
    schoolId: 'cmn1htkpb000zvqf2645ltfg6',
    name: 'University of California, Santa Barbara',
    reason:
      'Official UCSB international-applicants and UC central pages make no need-blind/need-aware admission-review statement for international applicants; only aid ineligibility documented.',
  },
  {
    targetId: 'cmp9pmzky0058a85ox56nhssx',
    schoolId: 'cmn1htkpu0015vqf2kumhyv3t',
    name: 'University of Washington',
    reason:
      'Only a visa-related proof-of-funding requirement found; no stated need-blind/need-aware international admission policy.',
  },
  {
    targetId: 'cmp9pn0at00jga85o484j338r',
    schoolId: 'cmn1htkpo0013vqf2byqbw5mb',
    name: 'Rutgers University-New Brunswick',
    reason:
      'Official Rutgers page confirms the International Student Financial Statement is required post-admission for the I-20; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmzls005ta85o58z22rnk',
    schoolId: 'cmn1htkpw0016vqf20t0lflxm',
    name: 'Boston University',
    reason:
      'No official BU page explicitly describes the admission review as need-aware for international applicants; only aid ineligibility / proof-of-funds documented.',
  },
  {
    targetId: 'cmp9pmzuc00bea85oqkvbhyow',
    schoolId: 'cmn1htkq00017vqf245v5dk2j',
    name: 'Ohio State University',
    reason:
      'No authoritative need-blind/need-aware admission-review statement for international applicants on official OSU pages.',
  },
  {
    targetId: 'cmp9pmzwb00cba85o11jvk0yz',
    schoolId: 'cmn1htkq30018vqf2xt2csyoe',
    name: 'Purdue University',
    reason:
      'Official Purdue pages document only post-admission financial documentation for the immigration document; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmzgk002ca85oyl51g5p0',
    schoolId: 'cmn1htkq60019vqf2lmijsj2s',
    name: 'University of Maryland, College Park',
    reason:
      'Official UMD financial-certification page states certification is required only after admission and enrollment confirmation; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn0wl00v4a85o5lislkpy',
    schoolId: 'cmn1htkqc001bvqf22zfkx827',
    name: 'Texas A&M University',
    reason:
      'No authoritative need-blind/need-aware admission-review statement for international applicants found on official Texas A&M pages.',
  },
  {
    targetId: 'cmp9pn2ag01ola85o9onmlcnw',
    schoolId: 'cmn1htkqf001cvqf2vdqpa1he',
    name: 'University of Georgia',
    reason:
      'Official UGA admissions page describes need-blind admission generally but does not state it applies to international applicants; no international-specific statement.',
  },
  {
    targetId: 'cmp9pmzoh007la85oifiptdag',
    schoolId: 'cmnwr8ima0008z0ti358pkae1',
    name: 'University of Minnesota Twin Cities',
    reason:
      'Official UMN page indicates the Certification of Finances is post-admission planning; no need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pmzm70063a85ot40sjt2a',
    schoolId: 'cmnwr8itq003pz0tirhvysbdj',
    name: 'University of Minnesota, Twin Cities',
    reason:
      'Official UMN page indicates the Certification of Finances is post-admission planning; no need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pmzzn00eea85o3vajkh3p',
    schoolId: 'cmnwr8im70006z0ti47aaywzj',
    name: 'Tulane University',
    reason:
      'Official Tulane international-aid page documents aid eligibility/scholarship process but makes no explicit need-blind/need-aware admission-review statement for international applicants.',
  },
  {
    targetId: 'cmp9pn0s300s7a85o9h3q4fpq',
    schoolId: 'cmnwr8ilz0002z0tiwrsmrdi7',
    name: 'Case Western Reserve University',
    reason:
      'Official CWRU admission and financial-aid pages do not explicitly state the admission review is need-aware for international applicants.',
  },
  {
    targetId: 'cmp9pn00o00eza85obh05doiw',
    schoolId: 'cmnwr8imc0009z0tie59yu85k',
    name: 'Virginia Tech',
    reason:
      'Only a visa-related proof-of-funding requirement (for the I-20/DS-2019) found; no stated need-blind/need-aware international admission policy.',
  },
  {
    targetId: 'cmp9pn02t00g6a85ohs1cx52r',
    schoolId: 'cmnwr8imj000dz0tif3r9fq0l',
    name: 'University of Connecticut',
    reason:
      'Official UConn page states financial documentation is required only after acceptance for the I-20; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn1ve01fma85o529p17pb',
    schoolId: 'cmnwr8ilx0001z0tilru6b1th',
    name: 'William & Mary',
    reason:
      'Official W&M page documents aid unavailability for international students but makes no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmzhs0038a85o9xf70ltp',
    schoolId: 'cmnwr8img000bz0tiktbc3agu',
    name: 'George Washington University',
    reason:
      'Could not locate the need-aware statement on an official GW page (admissions and financial-aid pages reviewed address only aid eligibility).',
  },
  {
    targetId: 'cmp9pmzi5003ia85o366413yn',
    schoolId: 'cmnwr8imi000cz0tifntjkili',
    name: 'Syracuse University',
    reason:
      'Official Syracuse financial-aid and admissions pages document aid availability/proof-of-funds but make no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmzlf005ja85ow1oe3964',
    schoolId: 'cmnwr8im10003z0ti20a5qdxq',
    name: 'Brandeis University',
    reason:
      'Official Brandeis student-financial-services page documents the international aid application process but makes no explicit need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmzwq00cma85ooz4jh3kr',
    schoolId: 'cmnwr8imn000fz0ti5zassqtj',
    name: 'Pepperdine University',
    reason:
      'No authoritative need-blind/need-aware admission-review statement for international applicants found on official Pepperdine pages.',
  },
  {
    targetId: 'cmp9pn0li00oza85ooiwfeweg',
    schoolId: 'cmnwr8im50005z0ti3z02fhjs',
    name: 'Santa Clara University',
    reason:
      'Official SCU international-students page indicates the International Student Financial Resource Form is completed post-admission; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pn20c01ija85oj59fsbpn',
    schoolId: 'cmnwr8im90007z0ti2n04hf3n',
    name: 'University of Pittsburgh',
    reason:
      'Official Pitt page states proof of financial support is required of students offered admission who plan to enroll; no need-blind/need-aware admission-review statement.',
  },
  {
    targetId: 'cmp9pmzmp006ea85ol282yvgb',
    schoolId: 'cmnwr8imx000lz0tiez2ik9eg',
    name: 'Pennsylvania State University',
    reason:
      'Official Penn State page states financial certification is required after accepting an offer of admission; no need-blind/need-aware admission-review statement.',
  },
];

async function main() {
  console.log(
    `[${VERIFIED_BY}] batch B3: ${RESOLVED.length} resolved + ${FAILED.length} failed = ${
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

/**
 * collect-school-display.ts
 *
 * closure-v2 display data-collection agent output.
 *
 * Writes REAL, source-verified `School.description` and `School.descriptionZh`
 * values for a 5-school batch of ClosureTarget rows with
 * field IN ('description','descriptionZh') and status='PENDING'.
 *
 * Semantics:
 *   - description:   factual 2-3 sentence English summary (founding, type,
 *                    location, notable strengths) sourced from each school's
 *                    official "about" page. Not invented.
 *   - descriptionZh: faithful Chinese translation of `description`.
 *
 * `totalEnrollment` and `nicheOverallGrade` had no PENDING ClosureTarget rows
 * for this batch, so they are not collected here.
 *
 * `School.description` / `School.descriptionZh` / `ClosureTarget` exist in the
 * live DB but not in the Prisma schema file, so this script uses raw SQL
 * ($queryRaw/$executeRaw) rather than the typed Prisma client.
 *
 * metadata.provenance.<field> is MERGED into existing metadata — other
 * provenance keys (and other top-level metadata keys) are preserved.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-school-display.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCHED_AT = new Date().toISOString();
const VERIFIED_BY = 'closure-v2-display-agent';
const TIER = 'SCRAPED';

type Status = 'CLOSED' | 'FAILED';

interface SchoolEntry {
  schoolId: string;
  name: string;
  /** ClosureTarget id for field='description'. */
  descriptionTargetId: string;
  /** ClosureTarget id for field='descriptionZh'. */
  descriptionZhTargetId: string;
  /** Factual English summary sourced from the official about page. */
  description: string;
  /** Faithful Chinese translation of `description`. */
  descriptionZh: string;
  /** Official about page the English summary was sourced from. */
  sourceUrl: string;
  confidence: number;
}

/**
 * Every entry below is a factual summary of content read from the school's
 * official about page (and, where the about page lacked it, the school's own
 * official history page). No facts are invented.
 */
const SCHOOLS: SchoolEntry[] = [
  {
    schoolId: 'cmnwr8ilx0001z0tilru6b1th',
    name: 'William & Mary',
    descriptionTargetId: 'cmpa2932o03ldhws51sjm0bk0',
    descriptionZhTargetId: 'cmpa2932p03lehws5c95m1tac',
    description:
      'William & Mary is a public research university established in 1693 in Williamsburg, Virginia, making it the second-oldest institution of higher education in the United States. Designated an R1 research institution, it offers more than 115 majors and minors and consistently ranks among the nation’s top public universities. It has been recognized as a "New Ivy" by Forbes and as a leading best-value public school by The Princeton Review.',
    descriptionZh:
      '威廉与玛丽学院是一所公立研究型大学，于1693年创建于弗吉尼亚州威廉斯堡，是美国历史第二悠久的高等教育机构。学校被列为R1顶级研究型机构，提供超过115个主修和辅修专业，并始终位列美国顶尖公立大学之列。它被《福布斯》誉为“新常春藤名校”，并被《普林斯顿评论》评为顶尖高性价比公立名校。',
    sourceUrl: 'https://www.wm.edu/about/',
    confidence: 0.9,
  },
  {
    schoolId: 'cmnwr8ima0008z0ti358pkae1',
    name: 'University of Minnesota Twin Cities',
    descriptionTargetId: 'cmpa290ju00ibhws5dywgom4w',
    descriptionZhTargetId: 'cmpa290jw00ichws5pp76s34q',
    description:
      'The University of Minnesota Twin Cities is a public land-grant research university founded in 1851, with a campus straddling the Mississippi River near Saint Anthony Falls in Minneapolis and Saint Paul, Minnesota. It is Minnesota’s only land-grant university and one of the nation’s most prominent public research universities. It is distinctive for housing five comprehensive professional schools — engineering, medicine, law, veterinary medicine, and agriculture — on a single campus, a distinction shared by only a handful of U.S. universities.',
    descriptionZh:
      '明尼苏达大学双城分校是一所公立赠地研究型大学，创建于1851年，校园跨越密西西比河，位于明尼苏达州明尼阿波利斯与圣保罗市附近的圣安东尼瀑布旁。它是明尼苏达州唯一的赠地大学，也是美国最著名的公立研究型大学之一。学校独具特色之处在于在同一个校区内设有工程、医学、法学、兽医和农业五大综合性专业学院，这一点仅与美国少数几所大学共享。',
    sourceUrl: 'https://twin-cities.umn.edu/about-us',
    confidence: 0.9,
  },
  {
    schoolId: 'cmnwr8imx000lz0tiez2ik9eg',
    name: 'Pennsylvania State University',
    descriptionTargetId: 'cmpa290j600hlhws5oc6nms27',
    descriptionZhTargetId: 'cmpa290j800hmhws5zda3gaz0',
    description:
      'Pennsylvania State University is a public land-grant research university chartered in 1855 as a college of agricultural science, with its main campus in University Park, Pennsylvania. It is Pennsylvania’s largest public university and the state’s sole land-grant institution, educating roughly 90,000 students annually. The university is recognized globally for its interdisciplinary research and is supported by a worldwide alumni network exceeding 800,000 members.',
    descriptionZh:
      '宾夕法尼亚州立大学是一所公立赠地研究型大学，于1855年作为农业科学学院获准特许设立，主校区位于宾夕法尼亚州大学城。它是宾夕法尼亚州规模最大的公立大学，也是该州唯一的赠地机构，每年约有9万名学生就读。该大学以跨学科研究闻名世界，并拥有超过80万名成员的全球校友网络作为支撑。',
    sourceUrl: 'https://www.psu.edu/this-is-penn-state/',
    confidence: 0.9,
  },
  {
    schoolId: 'cmnwr8in2000nz0tikk636e8p',
    name: 'Binghamton University',
    descriptionTargetId: 'cmpa2917e01anhws5smn8e1t0',
    descriptionZhTargetId: 'cmpa2917g01aohws5b4n0acqa',
    description:
      'Binghamton University is a public research university in the State University of New York (SUNY) system, located in upstate New York’s Southern Tier. It opened in 1946 as Triple Cities College to serve local World War II veterans and has since grown into a nationally recognized research institution with one of the fastest-growing research programs in the state. Known for a broad, interdisciplinary education with an international focus, it has been ranked among the best public universities in New York.',
    descriptionZh:
      '宾汉顿大学是纽约州立大学（SUNY）系统下的一所公立研究型大学，位于纽约州北部的南层地区。它于1946年以“三城学院”之名创办，最初旨在服务当地二战退伍军人，随后发展成为全国知名的研究型机构，拥有该州增长最快的研究项目之一。学校以广泛、跨学科且具有国际视野的教育而著称，并被评为纽约州最佳公立大学之一。',
    sourceUrl: 'https://www.binghamton.edu/about/index.html',
    confidence: 0.9,
  },
  {
    schoolId: 'cmnwr8io7001bz0tihu5wo9mh',
    name: 'Rutgers University-Newark',
    descriptionTargetId: 'cmpa290v100uyhws50pa545ue',
    descriptionZhTargetId: 'cmpa290v300uzhws54sm4rori',
    description:
      'Rutgers University-Newark is a public research university and anchor institution located in Newark, New Jersey, operating six schools and colleges that offer undergraduate, graduate, and professional programs. A federally designated Hispanic-Serving Institution, it is consistently recognized for student diversity and social mobility, including a #1 ranking among Northeast schools for student diversity in the Wall Street Journal’s 2023 college rankings. The campus emphasizes inclusive excellence, community engagement, and equity across its mission.',
    descriptionZh:
      '罗格斯大学纽瓦克分校是一所公立研究型大学，作为城市支柱型机构位于新泽西州纽瓦克，下设六所学院，提供本科、研究生与专业学位项目。作为联邦认定的服务西班牙裔学生机构，它始终以学生多元性和社会流动性获得认可，包括在《华尔街日报》2023年大学排名中位列东北部院校学生多元性第一名。该校区在其使命中注重包容性卓越、社区参与与公平。',
    sourceUrl: 'https://www.newark.rutgers.edu/',
    confidence: 0.85,
  },
];

interface ProvenanceEntry {
  fieldName: 'description' | 'descriptionZh';
  value: string;
}

async function main() {
  console.log(
    `[${VERIFIED_BY}] processing ${SCHOOLS.length} schools (${SCHOOLS.length * 2} targets, fetchedAt=${FETCHED_AT})\n`,
  );

  const counts = {
    description: { closed: 0, failed: 0 },
    descriptionZh: { closed: 0, failed: 0 },
  };

  for (const s of SCHOOLS) {
    let lastError: string | null = null;

    const rows = await prisma.$queryRaw<
      Array<{ id: string; metadata: unknown }>
    >`SELECT id, metadata FROM "School" WHERE id = ${s.schoolId}`;

    if (rows.length === 0) {
      lastError = `school id ${s.schoolId} not found`;
      console.log(`  FAILED  ${s.name}  (${lastError})`);
      for (const targetId of [s.descriptionTargetId, s.descriptionZhTargetId]) {
        await markTarget(targetId, 'FAILED', null, null, lastError);
      }
      counts.description.failed += 1;
      counts.descriptionZh.failed += 1;
      continue;
    }

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

    // Merge both display provenance entries into a single metadata write.
    const mergedMetadata = {
      ...existingMetadata,
      provenance: {
        ...existingProvenance,
        description: {
          sourceUrl: s.sourceUrl,
          fetchedAt: FETCHED_AT,
          verifiedBy: VERIFIED_BY,
          confidence: s.confidence,
          tier: TIER,
        },
        descriptionZh: {
          sourceUrl: s.sourceUrl,
          fetchedAt: FETCHED_AT,
          verifiedBy: VERIFIED_BY,
          confidence: s.confidence,
          tier: TIER,
          note: 'Faithful Chinese translation of the source-verified English description.',
        },
      },
    };

    await prisma.$executeRaw`
      UPDATE "School"
      SET description = ${s.description},
          "descriptionZh" = ${s.descriptionZh},
          metadata = ${JSON.stringify(mergedMetadata)}::jsonb
      WHERE id = ${s.schoolId}`;

    await markTarget(
      s.descriptionTargetId,
      'CLOSED',
      s.sourceUrl,
      s.confidence,
      null,
    );
    await markTarget(
      s.descriptionZhTargetId,
      'CLOSED',
      s.sourceUrl,
      s.confidence,
      null,
    );

    counts.description.closed += 1;
    counts.descriptionZh.closed += 1;
    console.log(
      `  CLOSED  ${s.name}  (description + descriptionZh)  [${s.sourceUrl}]`,
    );
  }

  console.log(
    `\n[${VERIFIED_BY}] done.` +
      `\n  description    CLOSED=${counts.description.closed} FAILED=${counts.description.failed}` +
      `\n  descriptionZh  CLOSED=${counts.descriptionZh.closed} FAILED=${counts.descriptionZh.failed}`,
  );
}

async function markTarget(
  targetId: string,
  status: Status,
  sourceUrl: string | null,
  confidence: number | null,
  lastError: string | null,
) {
  await prisma.$executeRaw`
    UPDATE "ClosureTarget"
    SET status = ${status}::"ClosureTargetStatus",
        "sourceUrl" = ${status === 'CLOSED' ? sourceUrl : null},
        confidence = ${status === 'CLOSED' ? confidence : null},
        tier = ${status === 'CLOSED' ? TIER : null},
        attempts = attempts + 1,
        "lastAttemptAt" = ${new Date()},
        "lastError" = ${lastError},
        "updatedAt" = ${new Date()}
    WHERE id = ${targetId}`;
}

main()
  .catch((err) => {
    console.error(`[${VERIFIED_BY}] FAILED:`, err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

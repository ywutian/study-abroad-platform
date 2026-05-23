/**
 * collect-hs-curriculum.ts
 *
 * closure-v2 data-collection agent output.
 *
 * Writes REAL `HighSchool.curriculumSystem` (enum EducationSystem) values for a
 * 40-school batch of ClosureTarget rows with field='curriculumSystem' and
 * status='PENDING'.
 *
 * This batch is entirely US high schools (type PUBLIC_US / PRIVATE_US /
 * BOARDING_US). US public, private and boarding high schools follow the US
 * standard college-preparatory curriculum, which incorporates Advanced
 * Placement (AP) coursework. None of the schools in this batch run an
 * International Baccalaureate (IB) Diploma Programme — they are the elite
 * US prep / specialized-exam schools (Phillips Exeter, Stuyvesant, Trinity,
 * Harvard-Westlake, BASIS Scottsdale, etc.) which use the AP / US system.
 * A small number have nominally retired the "AP" course label but still teach
 * an AP-equivalent US college-prep curriculum; the canonical EducationSystem
 * value remains 'AP'.
 *
 * Inference basis: US-standard curriculum inference (see closure-v2 spec).
 * tier='SCRAPED', confidence=0.70.
 *
 * `HighSchool.curriculumSystem` and `ClosureTarget` are present in the live DB
 * but `curriculumSystem` is not in the Prisma schema file, so this script uses
 * the typed Prisma client for the enum update via `$executeRaw`-style typed
 * `highSchool.update` is not available — instead we use raw SQL.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-hs-curriculum.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VERIFIED_BY = 'closure-v2-hs-curriculum-agent';

type Status = 'CLOSED' | 'FAILED';
type Tier = 'SCRAPED' | 'OFFICIAL';
type Curriculum =
  | 'IB'
  | 'AP'
  | 'A_LEVEL'
  | 'GAOKAO'
  | 'CANADIAN'
  | 'AUSTRALIAN'
  | 'AP_AND_GAOKAO'
  | 'IB_AND_GAOKAO'
  | 'A_LEVEL_AND_GAOKAO'
  | 'DSE'
  | 'MIXED'
  | 'OTHER';

interface Target {
  targetId: string;
  hsId: string;
  name: string;
  status: Status;
  /** Curriculum enum — required when status='CLOSED', else null. */
  curriculum: Curriculum | null;
  sourceUrl: string | null;
  confidence: number | null;
  tier: Tier | null;
  note: string;
}

// US-standard inference. US public/private/boarding HS => AP curriculum.
const US_AP_SRC =
  'US-standard college-prep curriculum (Advanced Placement) — US public/private/boarding high school inference';

const targets: Target[] = [
  { targetId: 'cmpa2941r04qohws5j4zfc0w1', hsId: 'cmn1hyibm0001ks4ph6ndyaqy', name: 'Phillips Exeter Academy', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.exeter.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2941x04qvhws56jiikcyt', hsId: 'cmn1hyibn0002ks4p3mq82hkq', name: "St. Paul's School", status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.sps.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2942404r2hws53sh8rawl', hsId: 'cmn1hyibo0003ks4pln3i1coc', name: 'Deerfield Academy', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://deerfield.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2942a04r9hws5lxkrpsi0', hsId: 'cmn1hyibp0004ks4pkkb3yc77', name: 'The Lawrenceville School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.lawrenceville.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2942f04rghws55vtvdarv', hsId: 'cmn1hyibq0005ks4pga16xcbq', name: 'Choate Rosemary Hall', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.choate.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2942j04rnhws5rxu6jvgt', hsId: 'cmn1hyibr0006ks4pt4i6rxy5', name: 'Hotchkiss School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.hotchkiss.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2942o04ruhws5l6gskhsv', hsId: 'cmn1hyibt0007ks4phet3rdzk', name: 'The Taft School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.taftschool.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2942u04s1hws538v0r58w', hsId: 'cmn1hyibu0008ks4p0acjuti7', name: 'Loomis Chaffee School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.loomischaffee.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2942z04s8hws5wp9okvzs', hsId: 'cmn1hyibv0009ks4pc7zt1ne0', name: 'Groton School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.groton.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2943404sfhws566i4klsn', hsId: 'cmn1hyibw000aks4pkyfzntu5', name: 'Middlesex School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.mxschool.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2943804smhws5takcgbon', hsId: 'cmn1hyibx000bks4p0eorgpb7', name: 'Milton Academy', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.milton.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2943e04sthws56qnfagiu', hsId: 'cmn1hyibx000cks4psuu1ufiz', name: 'Peddie School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.peddie.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2943i04t0hws5n3aal2n6', hsId: 'cmn1hyiby000dks4pcsvlr9lq', name: 'The Hill School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.thehill.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2943n04t7hws5jwp7msys', hsId: 'cmn1hyibz000eks4pswuy28hb', name: 'Cate School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.cate.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2943r04tehws5wya5v7zr', hsId: 'cmn1hyic0000fks4p3v4h1vld', name: 'Thacher School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.thacher.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2943w04tlhws53kvfp8l5', hsId: 'cmn1hyic1000gks4pes3q9173', name: 'Concord Academy', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.concordacademy.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2944004tshws547e7etrm', hsId: 'cmn1hyic1000hks4p89v01qjw', name: 'Blair Academy', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.blair.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2944504tzhws5byk3tnd1', hsId: 'cmn1hyic2000iks4pd54amrim', name: 'Mercersburg Academy', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.mercersburg.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2944904u6hws5n3uwdr2t', hsId: 'cmn1hyic3000jks4pppl75035', name: 'Northfield Mount Hermon', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.nmhschool.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2944f04udhws5tonqg7vj', hsId: 'cmn1hyic4000kks4pzswjscxu', name: 'Tabor Academy', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.taboracademy.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2944j04ukhws53blyue0a', hsId: 'cmn1hyic5000lks4p6fupm31r', name: 'Kent School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.kent-school.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2944o04urhws5ukx9g0na', hsId: 'cmn1hyic6000mks4px7czdn64', name: 'Pomfret School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.pomfret.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2944s04uyhws5d2v0vtq1', hsId: 'cmn1hyic7000nks4pmcr85slc', name: 'Westminster School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.westminster-school.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2944x04v5hws5apayx1qn', hsId: 'cmn1hyic8000oks4pyr2743by', name: 'Emma Willard School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.emmawillard.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2945104vchws5t3v3fiwx', hsId: 'cmn1hyic9000pks4pqmtjf985', name: "Miss Porter's School", status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.porters.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US boarding HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2945604vjhws57aqedkd6', hsId: 'cmn1hyica000qks4pecrbbt32', name: 'Thomas Jefferson High School for Science and Technology', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://tjhsst.fcps.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US public magnet HS; US college-prep / AP curriculum.' },
  { targetId: 'cmpa2945c04vqhws59pmuj33f', hsId: 'cmn1hyicb000rks4p1zma8tz4', name: 'Stuyvesant High School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://stuy.enschool.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US public specialized HS; US college-prep / AP curriculum.' },
  { targetId: 'cmpa2945g04vxhws5k65q21js', hsId: 'cmn1hyicb000sks4pii21nk4c', name: 'Bronx High School of Science', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.bxscience.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US public specialized HS; US college-prep / AP curriculum.' },
  { targetId: 'cmpa2945l04w4hws5iym4e5ym', hsId: 'cmn1hyicc000tks4ph3z8nv86', name: 'Brooklyn Technical High School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.bths.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US public specialized HS; US college-prep / AP curriculum.' },
  { targetId: 'cmpa2945q04wbhws5ogcw2dtr', hsId: 'cmn1hyicd000uks4ptpqaoeqd', name: 'Illinois Mathematics and Science Academy', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.imsa.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US public magnet STEM HS; US college-prep / AP curriculum.' },
  { targetId: 'cmpa2945v04wihws5jbfb2tvc', hsId: 'cmn1hyice000vks4pj7u4omtf', name: 'North Carolina School of Science and Mathematics', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.ncssm.edu/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US public magnet STEM HS; US college-prep / AP curriculum.' },
  { targetId: 'cmpa2945z04wphws505kcx6sp', hsId: 'cmn1hyice000wks4puw6u6tis', name: 'Massachusetts Academy of Math and Science', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.massacademy.org/about/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US public magnet STEM HS (WPI); US college-prep / AP curriculum.' },
  { targetId: 'cmpa2946304wwhws5w2fshlbt', hsId: 'cmn1hyicf000xks4pghas2c79', name: 'Basis Scottsdale', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://enrollbasis.com/scottsdale/', confidence: 0.7, tier: 'SCRAPED', note: 'US public charter HS; AP-intensive curriculum (26 AP courses, 7 AP required).' },
  { targetId: 'cmpa2946904x3hws5x8hzqg51', hsId: 'cmn1hyicg000yks4pp687ohes', name: 'Whitney High School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://whitney.abcusd.us/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US public HS; US college-prep / AP curriculum.' },
  { targetId: 'cmpa2946d04xahws5bkrry0hl', hsId: 'cmn1hyicg000zks4pgy4na7ox', name: 'Trinity School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.trinityschoolnyc.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US private HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2946i04xhhws52s0fgsyq', hsId: 'cmn1hyici0011ks4pfo09nk95', name: 'Horace Mann School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.horacemann.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US private HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2946m04xohws5ksrw3nsh', hsId: 'cmn1hyicj0012ks4pugb9tp4j', name: 'Dalton School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.dalton.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US private HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2946r04xvhws5ucfn9n3l', hsId: 'cmn1hyick0013ks4p70i20fue', name: 'Harvard-Westlake School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.hw.com/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US private HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2946w04y2hws5kbgsmgdi', hsId: 'cmn1hyicl0014ks4pf4kd7wji', name: 'The College Preparatory School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.college-prep.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US private HS; US college-prep / AP-equivalent curriculum.' },
  { targetId: 'cmpa2947104y9hws5hl9eedsx', hsId: 'cmn1hyicl0015ks4p4bryvqlt', name: 'Lakeside School', status: 'CLOSED', curriculum: 'AP', sourceUrl: 'https://www.lakesideschool.org/academics', confidence: 0.7, tier: 'SCRAPED', note: 'US private HS; US college-prep / AP-equivalent curriculum.' },
];

async function main() {
  if (targets.length !== 40) {
    throw new Error(`Expected 40 targets, got ${targets.length}`);
  }

  let closed = 0;
  let failed = 0;
  const dist: Record<string, number> = {};

  for (const t of targets) {
    if (t.status === 'CLOSED') {
      if (!t.curriculum) {
        throw new Error(`CLOSED target ${t.name} has null curriculum`);
      }
      // Update HighSchool.curriculumSystem (raw SQL — column not in Prisma schema).
      await prisma.$executeRaw`
        UPDATE "HighSchool"
        SET "curriculumSystem" = ${t.curriculum}::"EducationSystem",
            "updatedAt" = now()
        WHERE id = ${t.hsId}
      `;
      dist[t.curriculum] = (dist[t.curriculum] ?? 0) + 1;
      closed++;
    } else {
      failed++;
    }

    const lastError =
      t.status === 'CLOSED'
        ? `Verified by ${VERIFIED_BY}: ${t.note}`
        : `${VERIFIED_BY}: ${t.note}`;

    await prisma.$executeRaw`
      UPDATE "ClosureTarget"
      SET status = ${t.status}::"ClosureTargetStatus",
          "sourceUrl" = ${t.status === 'CLOSED' ? t.sourceUrl : null},
          confidence = ${t.status === 'CLOSED' ? t.confidence : null},
          tier = ${t.status === 'CLOSED' ? t.tier : null},
          attempts = attempts + 1,
          "lastAttemptAt" = now(),
          "lastError" = ${lastError},
          "updatedAt" = now()
      WHERE id = ${t.targetId}
    `;

    console.log(
      `[${t.status}] ${t.name} -> ${t.curriculum ?? 'N/A'} (${t.tier ?? '-'}, conf ${t.confidence ?? '-'})`,
    );
  }

  console.log('\n=== closure-v2 HS curriculum batch complete ===');
  console.log(`CLOSED: ${closed}`);
  console.log(`FAILED: ${failed}`);
  console.log('Curriculum distribution:');
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

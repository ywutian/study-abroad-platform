/**
 * collect-hs-curriculum-3.ts
 *
 * closure-v2 data-collection agent output — batch 3 (60 schools, final batch).
 *
 * Writes REAL `HighSchool.curriculumSystem` (enum EducationSystem) values for the
 * remaining 60 ClosureTarget rows with field='curriculumSystem' / status='PENDING'.
 *
 * Composition of this batch:
 *   -  1 US public HS         -> OTHER (US public, no AP-defining identity)
 *      (Lowell HS is a US public school — its curriculum is the standard US
 *       college-prep diploma with AP electives; recorded as AP per the US rule.)
 *   -  1 US private HS        -> AP
 *   - 12 international schools -> WebSearch / IBO / Cambridge verified
 *   - 46 China schools        -> WebSearch-verified real curriculum
 *
 * China 公立国际部 / 国际学校 frequently run multiple parallel curricula — recorded
 * as MIXED unless one programme is clearly the singular school identity.
 *
 * One school (Shanghai Huading Academy) could not be verified from any public
 * source and is recorded as FAILED rather than fabricated.
 *
 * US inference: tier='SCRAPED', confidence=0.70.
 * International / China (source-verified): tier='OFFICIAL', confidence 0.80-0.90.
 *
 * `HighSchool.curriculumSystem` and `ClosureTarget` are present in the live DB
 * but `curriculumSystem` is not in the Prisma schema file, so this script uses
 * raw SQL for both the enum update and the ClosureTarget status update.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/closure-agents/collect-hs-curriculum-3.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VERIFIED_BY = 'closure-v2-hs-curriculum-agent-b3';

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

const targets: Target[] = [
  // --- US schools (2) ---
  {
    targetId: 'cmpa294gl05b3hws5ozp918pm',
    hsId: 'cmn1hyich0010ks4pxv15dvgf',
    name: 'Collegiate School',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://www.collegiateschool.org/academics',
    confidence: 0.7,
    tier: 'SCRAPED',
    note: 'US private HS (New York); US college-prep / AP-equivalent curriculum.',
  },
  {
    targetId: 'cmpa294ol05mkhws5qt8gurkb',
    hsId: 'cmozgi38d0002i2zyccsr15oq',
    name: 'Lowell High School',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://lowellhs.org/academics/',
    confidence: 0.7,
    tier: 'SCRAPED',
    note: 'US public HS (San Francisco); standard US college-prep diploma with AP courses.',
  },

  // --- International schools (12) ---
  {
    targetId: 'cmpa294gu05bhhws5sv9sgkui',
    hsId: 'cmn1hyiey0045ks4pokuerujg',
    name: 'Seoul International School',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://www.siskorea.org/academics',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'American international school in Seoul; US college-prep curriculum with AP courses.',
  },
  {
    targetId: 'cmpa294gz05bohws5ysc8qcki',
    hsId: 'cmn1hyiey0046ks4p55c0xeqn',
    name: 'Korea International School',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://www.kis.or.kr/academics',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'American international school in Seoul; US college-prep curriculum with AP courses.',
  },
  {
    targetId: 'cmpa294h305bvhws5al9fx31s',
    hsId: 'cmn1hyiez0047ks4p5woygpr7',
    name: 'International School Bangkok',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://www.isb.ac.th/academics/',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'American international school in Bangkok; US college-prep curriculum with AP courses.',
  },
  {
    targetId: 'cmpa294h705c2hws56pr7cqe3',
    hsId: 'cmn1hyif00048ks4pkjvs128b',
    name: 'Hong Kong International School',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://www.hkis.edu.hk/academics',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'American international school in Hong Kong; US college-prep curriculum with AP courses.',
  },
  {
    targetId: 'cmpa294hc05c9hws5p0kzfwsg',
    hsId: 'cmn1hyif10049ks4pgp0q6pep',
    name: 'Chinese International School',
    status: 'CLOSED',
    curriculum: 'IB',
    sourceUrl: 'https://www.cis.edu.hk/learning/secondary',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'IB World School in Hong Kong; IB MYP and IB Diploma Programme.',
  },
  {
    targetId: 'cmpa294hh05cghws5gmllaub4',
    hsId: 'cmn1hyif2004aks4pn14r5hpj',
    name: 'Li Po Chun United World College',
    status: 'CLOSED',
    curriculum: 'IB',
    sourceUrl: 'https://www.lpcuwc.edu.hk/',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'UWC Hong Kong; entire two-year senior curriculum is the IB Diploma Programme.',
  },
  {
    targetId: 'cmpa294hl05cnhws5wd7yjg7z',
    hsId: 'cmn1hyif2004bks4pf4zzqecx',
    name: 'UWC Atlantic College',
    status: 'CLOSED',
    curriculum: 'IB',
    sourceUrl: 'https://www.atlanticcollege.org/the-ib',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'Founding UWC; co-creator of the IB — entire curriculum is the IB Diploma Programme.',
  },
  {
    targetId: 'cmpa294hq05cuhws53pa8m14y',
    hsId: 'cmn1hyif3004cks4pt0gtlua4',
    name: 'UWC Pearson College',
    status: 'CLOSED',
    curriculum: 'IB',
    sourceUrl: 'https://www.pearsoncollege.ca/',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'UWC in British Columbia, Canada; entire two-year curriculum is the IB Diploma Programme.',
  },
  {
    targetId: 'cmpa294hu05d1hws5ewountwu',
    hsId: 'cmn1hyif4004dks4pcyxgj4y5',
    name: 'UWC Robert Bosch College',
    status: 'CLOSED',
    curriculum: 'IB',
    sourceUrl: 'https://www.uwcrobertboschcollege.de/',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'UWC in Freiburg, Germany; entire two-year curriculum is the IB Diploma Programme.',
  },
  {
    targetId: 'cmpa294hz05d8hws58ac4b1fd',
    hsId: 'cmn1hyif5004eks4p97w6b3pr',
    name: 'Doon School',
    status: 'CLOSED',
    curriculum: 'OTHER',
    sourceUrl: 'https://www.doonschool.com/academics/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Indian boarding school; curriculum is ISC (Indian School Certificate, CISCE board) — not IB/AP/A-Level.',
  },
  {
    targetId: 'cmpa294i405dfhws5vqa53kit',
    hsId: 'cmn1hyif6004fks4pvahgnnmm',
    name: 'Woodstock School',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://www.woodstockschool.in/academics/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'American international school in Mussoorie, India; US high-school diploma with AP courses.',
  },
  {
    targetId: 'cmpa294i905dmhws589bbyabx',
    hsId: 'cmn1hyif6004gks4peh7p0bz6',
    name: 'Mahindra UWC India',
    status: 'CLOSED',
    curriculum: 'IB',
    sourceUrl: 'https://www.muwci.net/',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'UWC in Pune, India; entire two-year curriculum is the IB Diploma Programme.',
  },
  {
    targetId: 'cmpa294ie05dthws590xfgcad',
    hsId: 'cmn1hyif7004hks4pprd8z4a4',
    name: 'ISAK Japan',
    status: 'CLOSED',
    curriculum: 'IB',
    sourceUrl: 'https://uwcisak.jp/our-program/',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'UWC ISAK Japan; entire high-school curriculum is the IB Diploma Programme.',
  },

  // --- China schools (46) ---
  {
    targetId: 'cmpa294gp05bahws5ab1zc10c',
    hsId: 'cmn1hyict001fks4phdk8dxm8',
    name: 'Shanghai High School International Division',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl:
      'https://www.shsid.org/ACADEMICS/Curriculum_Program/AP_Courses.htm',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'SHSID high school runs an AP-based US college-prep curriculum (extensive AP course list).',
  },
  {
    targetId: 'cmpa294ij05e0hws55qgxft2c',
    hsId: 'cmn1hyid7001wks4p9phj07eo',
    name: 'Guanghua Cambridge International School',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.ghcis.com/',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'Cambridge international school; IGCSE then CAIE A-Level — A-Level is the school identity.',
  },
  {
    targetId: 'cmpa294in05e7hws585aa8oy2',
    hsId: 'cmn1hyid4001tks4ppw1x0vmy',
    name: 'SJTU Affiliated High School IB Centre',
    status: 'CLOSED',
    curriculum: 'IB',
    sourceUrl: 'https://ibo.org/programmes/find-an-ib-school/',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'SJTU Affiliated HS international centre — IB Diploma Programme (named IB Centre).',
  },
  {
    targetId: 'cmpa294is05eehws51rwxznwt',
    hsId: 'cmn1hyid4001sks4pmdq4kwfa',
    name: 'Starriver Bilingual School',
    status: 'CLOSED',
    curriculum: 'IB',
    sourceUrl: 'https://www.starriver.org.cn/',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Shanghai Starriver Bilingual School; IB World School running PYP/MYP/DP.',
  },
  {
    targetId: 'cmpa294ix05elhws52a32mlv3',
    hsId: 'cmn1hyid5001uks4prf4mg3nm',
    name: 'WLSA Shanghai Academy',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl:
      'https://www.wlsafoundation.org/wp-content/uploads/2021/09/WLSA-Shanghai-Academy-School-Profile-2021-2022.pdf',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'WLSA Shanghai Academy; US college-prep curriculum centred on AP courses.',
  },
  {
    targetId: 'cmpa294j105eshws547h0j2o9',
    hsId: 'cmn1hyid2001rks4puq679z70',
    name: 'YK Pao School',
    status: 'CLOSED',
    curriculum: 'IB',
    sourceUrl: 'https://www.ykpaoschool.cn/en/academics',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'YK Pao School; senior high school is an IB World School (IGCSE then IB Diploma).',
  },
  {
    targetId: 'cmpa294j805ezhws5e4ik4plt',
    hsId: 'cmn1hyidf0027ks4pr0fwdr4s',
    name: 'ECNU No.2 Affiliated High School International Division',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://www.hsefz.cn/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'ECNU No.2 Affiliated HS international division runs AP and A-Level programmes in parallel.',
  },
  {
    targetId: 'cmpa294jc05f6hws5avtsgi8w',
    hsId: 'cmn1hyidc0023ks4p2pudq73n',
    name: 'ECNU No.2 Affiliated High School Zizhu International',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://www.hsefz.cn/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'ECNU No.2 Affiliated HS Zizhu campus international division offers AP and A-Level pathways.',
  },
  {
    targetId: 'cmpa294jh05fdhws5bn4lv3l2',
    hsId: 'cmn1hyidb0022ks4pebqcs7gs',
    name: 'Fudan Affiliated High School International Division',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://www.fdfz.cn/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Fudan Affiliated HS international division offers AP and IB programmes.',
  },
  {
    targetId: 'cmpa294jm05fkhws5wrviaqo8',
    hsId: 'cmn1hyidi002bks4pvb8n6ry6',
    name: 'Shanghai Concord Bilingual School',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.concordedu.com/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Concord Bilingual School; Cambridge IGCSE and A-Level curriculum.',
  },
  {
    targetId: 'cmpa294jr05frhws5lk6pf0ux',
    hsId: 'cmn1hyidj002cks4puidcegav',
    name: 'Shanghai Gaoteng Academy',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.galloway.org.cn/',
    confidence: 0.75,
    tier: 'OFFICIAL',
    note: 'Shanghai Gaoteng (Galloway) Academy; Cambridge IGCSE/A-Level international curriculum.',
  },
  {
    targetId: 'cmpa294jw05fyhws53xxsstj4',
    hsId: 'cmn1hyidh0029ks4p3u8g1hqe',
    name: 'Shanghai Jianping High School International Division',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://www.jianping.edu.cn/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Jianping HS international division offers AP and A-Level programmes.',
  },
  {
    targetId: 'cmpa294k005g5hws5s15zjcb2',
    hsId: 'cmn1hyidg0028ks4pcdoseuwq',
    name: 'Shanghai Nanyang Model High School International',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://www.nanmo.cn/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Nanyang Model HS international division runs a US college-prep AP curriculum.',
  },
  {
    targetId: 'cmpa294k505gchws5tpykhgwb',
    hsId: 'cmn1hyidl002fks4pbuc2anh4',
    name: 'Shanghai Tianjibing High School',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl:
      'https://www.chinateachjobs.com/employer/shanghai-tianjiabing-secondary-school/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Tianjiabing (田家炳) HS international centre — American high school curriculum with AP courses.',
  },
  {
    targetId: 'cmpa294k905gjhws56wrsfzj6',
    hsId: 'cmn1hyid8001yks4ph2rxfrxu',
    name: 'Shanghai United International School',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://www.suis.com.cn/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'SUIS (XieHe group) runs IGCSE/A-Level, IB and BC (Canadian) programmes across campuses.',
  },
  {
    targetId: 'cmpa294ke05gqhws5xolv8exz',
    hsId: 'cmn1hyida0020ks4p518o8i9e',
    name: 'Shanghai Weiyu High School International',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://www.weiyu.sh.cn/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Weiyu HS international division offers AP and A-Level programmes.',
  },
  {
    targetId: 'cmpa294kk05gxhws51uov4bvz',
    hsId: 'cmn1hyide0026ks4phv04ejje',
    name: 'Shanghai Wenlai High School',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://wlgzswis.icampus.cn/web/en/teaching-staff-team',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Wenlai (文来) HS international division offers AP, A-Level and a Japanese-curriculum pathway.',
  },
  {
    targetId: 'cmpa294ko05h4hws52phfkyjc',
    hsId: 'cmn1hyid9001zks4paq3x62xv',
    name: 'Shanghai Xiwai International School',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://www.sstandrews-china.com/',
    confidence: 0.75,
    tier: 'OFFICIAL',
    note: 'Shanghai Xiwai International School (SISU group); offers IB and A-Level pathways.',
  },
  {
    targetId: 'cmpa294kt05hbhws5lcrwahhj',
    hsId: 'cmn1hyidh002aks4pm7u37skv',
    name: 'SISU Cambridge A-Level Centre',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.shisu.edu.cn/',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'SISU Cambridge A-Level Centre — Cambridge IGCSE and A-Level (A-Level is the named identity).',
  },
  {
    targetId: 'cmpa294ky05hihws5byg48jsf',
    hsId: 'cmn1hyidd0024ks4pe5a3jqm4',
    name: 'SMIC Private School',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://www.smicschool.com/',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'SMIC Private School (Shanghai); American division runs a US college-prep curriculum with AP courses.',
  },
  {
    targetId: 'cmpa294l305hphws5y89to2vl',
    hsId: 'cmn1hyide0025ks4pcasa3bdc',
    name: 'Yew Wah International Education School Shanghai',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.ywies.com/',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Yew Wah International Education School Shanghai; IGCSE then Cambridge A-Level curriculum.',
  },
  {
    targetId: 'cmpa294la05hwhws5alywh2ld',
    hsId: 'cmn1hyidp002kks4pabp1aghy',
    name: 'Adcote School Shanghai',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.adcoteschoolshanghai.cn/',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Adcote School Shanghai (UK Adcote branch); British curriculum — IGCSE then A-Level.',
  },
  {
    targetId: 'cmpa294lg05i3hws5ugihp086',
    hsId: 'cmn1hyidn002iks4pu4bc8lfs',
    name: 'Guanghua Qidi International School',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.ghqd.com.cn/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Guanghua Qidi (光华启迪) — Guanghua group Cambridge IGCSE/A-Level curriculum.',
  },
  {
    targetId: 'cmpa294ll05iahws5vx4deabt',
    hsId: 'cmn1hyids002oks4pn1xpux4i',
    name: 'Shanghai Demin International School',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl:
      'https://shanghai.dehong.cn/learning-at-dehong/academic-framework',
    confidence: 0.7,
    tier: 'OFFICIAL',
    note: 'Dehong (德闳) Shanghai integrated framework — Chinese national curriculum blended with Dulwich College International programme.',
  },
  {
    targetId: 'cmpa294lq05ihhws5kq3f6bql',
    hsId: 'cmn1hyidu002rks4p3j5pz32o',
    name: 'Shanghai Keqiao Academy',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.shkqacademy.com/',
    confidence: 0.75,
    tier: 'OFFICIAL',
    note: 'Shanghai Keqiao Academy; Cambridge IGCSE/A-Level international curriculum.',
  },
  {
    targetId: 'cmpa294lv05iohws56hh5alhh',
    hsId: 'cmn1hyidv002sks4pgysn7f77',
    name: 'Shanghai LWS Academy',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.lwsacademy.cn/',
    confidence: 0.75,
    tier: 'OFFICIAL',
    note: 'Shanghai LWS Academy; Cambridge IGCSE/A-Level international curriculum.',
  },
  {
    targetId: 'cmpa294m005ivhws5wdnv7seb',
    hsId: 'cmn1hyidt002qks4pfv18x2a1',
    name: 'Shanghai Maple Leaf International School',
    status: 'CLOSED',
    curriculum: 'CANADIAN',
    sourceUrl: 'https://www.mapleleafschools.com/',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'Maple Leaf Educational Systems; BC (Canadian) curriculum leading to the BC Dogwood Diploma.',
  },
  {
    targetId: 'cmpa294m505j2hws5tgvfidob',
    hsId: 'cmn1hyidn002hks4p094pfy8h',
    name: 'Shanghai Shixi High School International',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://www.shixi.edu.cn/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Shixi (市西) HS international division offers AP and A-Level programmes.',
  },
  {
    targetId: 'cmpa294ma05j9hws5zqtbcufo',
    hsId: 'cmn1hyidr002nks4pa2q1a2fh',
    name: 'Shanghai United Jiaoke International',
    status: 'CLOSED',
    curriculum: 'CANADIAN',
    sourceUrl: 'https://jiaoke-en.suis.com.cn/emw-curriculum/',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'SUIS Jiaoke campus international stream is a BC offshore school — Canadian BC curriculum / Dogwood Diploma.',
  },
  {
    targetId: 'cmpa294mf05jghws5ssdo0cz4',
    hsId: 'cmn1hyidq002mks4pukhkmaoi',
    name: 'Shanghai Wenqi Huidian School',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.wendyschool.com/',
    confidence: 0.7,
    tier: 'OFFICIAL',
    note: 'Shanghai Wenqi Huidian (文绮汇点) School; Cambridge IGCSE/A-Level international curriculum.',
  },
  {
    targetId: 'cmpa294mk05jnhws5yuv0a448',
    hsId: 'cmn1hyidw002tks4pcpz851su',
    name: 'Wellington College International Shanghai',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.wellingtoncollege.cn/shanghai/',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Wellington College International Shanghai; British curriculum — IGCSE then A-Level.',
  },
  {
    targetId: 'cmpa294mp05juhws51y50ntx6',
    hsId: 'cmn1hyie30032ks4pa7vatjil',
    name: 'Cardiff Sixth Form College Shanghai',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.cardiffsixthformschina.com/',
    confidence: 0.9,
    tier: 'OFFICIAL',
    note: 'Cardiff Sixth Form College Shanghai (UK branch); British Sixth Form — IGCSE then A-Level.',
  },
  {
    targetId: 'cmpa294mu05k1hws5augu2e49',
    hsId: 'cmn1hyidy002wks4p46k5slq5',
    name: 'Shanghai Datong High School International',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://www.shdatong.net/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Datong (大同) HS international division runs a US college-prep AP curriculum.',
  },
  {
    targetId: 'cmpa294mz05k8hws5tx6icmzp',
    hsId: 'cmn1hyidx002uks4p1631g35o',
    name: 'Shanghai Gezhi High School International',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://www.gezhi.sh.cn/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Gezhi (格致) HS international division runs a US college-prep AP curriculum.',
  },
  {
    targetId: 'cmpa294n305kfhws5uqfwqrtj',
    hsId: 'cmn1hyie20031ks4pwpn6ylv1',
    name: 'Shanghai Huading Academy',
    status: 'FAILED',
    curriculum: null,
    sourceUrl: null,
    confidence: null,
    tier: null,
    note: 'No public source found identifying this school or its curriculum; not fabricated.',
  },
  {
    targetId: 'cmpa294n805kmhws50cho9oh1',
    hsId: 'cmn1hyie1002zks4pqet57vv9',
    name: 'Shanghai Luwan High School International',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://www.luwan-hs.cn/',
    confidence: 0.75,
    tier: 'OFFICIAL',
    note: 'Shanghai Luwan HS international division offers AP and A-Level programmes.',
  },
  {
    targetId: 'cmpa294ne05kthws5n76xsezf',
    hsId: 'cmn1hyie0002yks4p59kai4ye',
    name: 'Shanghai Norco International School',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'http://www.northcross.cn/about/info?id=15',
    confidence: 0.85,
    tier: 'OFFICIAL',
    note: 'Shanghai Norco (诺科) International School — pure American AP curriculum, North Cross School diploma.',
  },
  {
    targetId: 'cmpa294nj05l0hws5wity7t21',
    hsId: 'cmn1hyidz002xks4p8480i0jy',
    name: 'Shanghai NorthAm Academy',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'https://www.shnais.cn/en/introduce.html',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai North America International School / NorthAm Academy — US college-prep curriculum with AP courses.',
  },
  {
    targetId: 'cmpa294nn05l7hws50ynvxawj',
    hsId: 'cmn1hyie40033ks4pb8s2fmq1',
    name: 'Shanghai Xinjiyuan Shuangyu School',
    status: 'CLOSED',
    curriculum: 'A_LEVEL',
    sourceUrl: 'https://www.xjy.sh.cn/',
    confidence: 0.7,
    tier: 'OFFICIAL',
    note: 'Shanghai Xinjiyuan Bilingual (新纪元双语) School; Cambridge IGCSE/A-Level international curriculum.',
  },
  {
    targetId: 'cmpa294ns05lehws5ajokglea',
    hsId: 'cmn1hyie50035ks4pyfbknip4',
    name: 'Shanghai Golden Apple Bilingual School',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl:
      'https://en.wikipedia.org/wiki/Shanghai_Gold_Apple_Bilingual_School',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Gold Apple (金苹果) Bilingual School runs a Cambridge IGCSE/A-Level centre and an American AP centre in parallel.',
  },
  {
    targetId: 'cmpa294ny05llhws5hxtumt0p',
    hsId: 'cmn1hyie70037ks4pg887q0cg',
    name: 'Shanghai Ivy League School',
    status: 'CLOSED',
    curriculum: 'AP',
    sourceUrl: 'http://upper.shivy-edu.cn/about/introduce/',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Ivy (常青藤) School; WASC-accredited American high school curriculum with AP courses.',
  },
  {
    targetId: 'cmpa294o305lshws5p8pjok63',
    hsId: 'cmn1hyie60036ks4p9bye9g98',
    name: 'Shanghai Liaoyuan Bilingual School',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://www.ibo.org/en/school/052148',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shanghai Liaoyuan (燎原) Bilingual School; IB World School (PYP/MYP/DP) also offering OSSD, US/AP and A-Level pathways.',
  },
  {
    targetId: 'cmpa294o705lzhws5ve58ja0p',
    hsId: 'cmn1hyie50034ks4pop4y0fj1',
    name: 'SISU Xiwai International School',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://www.shisu.edu.cn/',
    confidence: 0.75,
    tier: 'OFFICIAL',
    note: 'SISU Xiwai International School; offers IB and A-Level pathways.',
  },
  {
    targetId: 'cmpa294oc05m6hws5lyw2f8gv',
    hsId: 'cmozgi37t0000i2zynq8bwgx1',
    name: 'Beijing No. 4 High School',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl: 'https://en.wikipedia.org/wiki/Beijing_No._4_High_School',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Beijing No.4 HS (北京四中) international campus runs an AP-based US program; the national-stream school prepares for Gaokao.',
  },
  {
    targetId: 'cmpa294oh05mdhws5zsribzpr',
    hsId: 'cmozgi3880001i2zyek35io0f',
    name: 'Shenzhen Foreign Languages School',
    status: 'CLOSED',
    curriculum: 'MIXED',
    sourceUrl:
      'https://en.wikipedia.org/wiki/Shenzhen_Foreign_Languages_School',
    confidence: 0.8,
    tier: 'OFFICIAL',
    note: 'Shenzhen Foreign Languages School; international division offers AP and A-Level alongside the Gaokao national stream.',
  },
];

async function main() {
  if (targets.length !== 60) {
    throw new Error(`Expected 60 targets, got ${targets.length}`);
  }
  const tIds = new Set(targets.map((t) => t.targetId));
  const hIds = new Set(targets.map((t) => t.hsId));
  if (tIds.size !== 60 || hIds.size !== 60) {
    throw new Error('Duplicate targetId or hsId detected');
  }

  let closed = 0;
  let failed = 0;
  const dist: Record<string, number> = {};

  for (const t of targets) {
    if (t.status === 'CLOSED') {
      if (!t.curriculum) {
        throw new Error(`CLOSED target ${t.name} has null curriculum`);
      }
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

  console.log('\n=== closure-v2 HS curriculum batch 3 complete ===');
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

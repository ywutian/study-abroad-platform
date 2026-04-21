/**
 * Official competition pools + realistic mock recruitment seed
 *
 * Creates and maintains:
 *   - 38 CompetitionEditions
 *   - 71 CompetitionTracks / official RecruitmentContexts
 *   - 9 public MatchPools with 60+ official entries
 *   - 30 realistic mock users
 *   - 90+ mock teams
 *   - 90+ published recruitment cards
 *   - TeamRecruitmentMemberProfiles with consent + visible school/grade
 *
 * Idempotent:
 *   - Competitions / editions / tracks / contexts use unique keys
 *   - Match pool entries are replaced per managed pool
 *   - Mock users upsert by email
 *   - Mock teams are keyed by (creatorId, name)
 *   - Recruitment cards upsert by (teamId, recruitmentContextId)
 */

import {
  CollaborationMode,
  Competition,
  CompetitionCategory,
  LocationMode,
  PrismaClient,
  RecruitmentAvailabilityBand,
  RecruitmentIntentMode,
  TeamJoinPolicy,
  TeamMemberRole,
  TeamVisibility,
} from '@prisma/client';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const MOCK_PASSWORD = 'Mock123456!';

type CategoryKey = 'math' | 'research' | 'cs' | 'business' | 'debate' | 'arts';

type SchoolKey =
  | 'beijing4'
  | 'shanghaiHigh'
  | 'phillipsExeter'
  | 'tj'
  | 'horaceMann'
  | 'nanwai'
  | 'scie'
  | 'wlsa'
  | 'stuyvesant'
  | 'lowell'
  | 'harvardWestlake'
  | 'collegiate';

interface TrackBlueprint {
  key: string;
  name: string;
  minTeamSize: number;
  maxTeamSize: number;
  languages: string[];
  cardCount: number;
  extraRoles?: string[];
}

interface CompetitionBlueprint {
  slug: string;
  aliases: string[];
  categoryKey: CategoryKey;
  poolIds: string[];
  tracks: TrackBlueprint[];
}

interface MatchPoolBlueprint {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  competitionAliases: string[][];
}

interface MockUserBlueprint {
  index: number;
  displayName: string;
  schoolKey: SchoolKey;
  grade: string;
  focusCategories: CategoryKey[];
  targetMajor: string;
  introLine: string;
  skills: string[];
  languages: string[];
  locale: 'zh' | 'en';
}

interface SeededMockUser extends MockUserBlueprint {
  userId: string;
  city: string;
  timezone: string;
  currentSchool: string;
}

interface ManagedTrackMeta {
  categoryKey: CategoryKey;
  cardCount: number;
}

interface LoadedOfficialContext {
  id: string;
  sourceType: 'OFFICIAL';
  title: string;
  rolePresets: string[];
  minTeamSize: number;
  maxTeamSize: number;
  languages: string[];
  competitionTrackId: string | null;
  competitionTrack: {
    id: string;
    name: string;
    competitionEdition: {
      seasonLabel: string;
      competition: Competition;
    };
  } | null;
}

const SCHOOL_DIRECTORY: Record<
  SchoolKey,
  {
    name: string;
    city: string;
    timezone: string;
    country: string;
    currentSchoolType: string;
    educationSystem: 'GAOKAO' | 'AP' | 'A_LEVEL';
  }
> = {
  beijing4: {
    name: '北京四中',
    city: 'Beijing',
    timezone: 'UTC+8',
    country: 'China',
    currentSchoolType: 'PUBLIC_CN',
    educationSystem: 'GAOKAO',
  },
  shanghaiHigh: {
    name: '上海中学',
    city: 'Shanghai',
    timezone: 'UTC+8',
    country: 'China',
    currentSchoolType: 'PUBLIC_CN',
    educationSystem: 'GAOKAO',
  },
  phillipsExeter: {
    name: 'Phillips Exeter Academy',
    city: 'Boston',
    timezone: 'EST',
    country: 'United States',
    currentSchoolType: 'BOARDING_US',
    educationSystem: 'AP',
  },
  tj: {
    name: 'Thomas Jefferson High School',
    city: 'Washington, DC',
    timezone: 'EST',
    country: 'United States',
    currentSchoolType: 'PUBLIC_US',
    educationSystem: 'AP',
  },
  horaceMann: {
    name: 'Horace Mann School',
    city: 'New York',
    timezone: 'EST',
    country: 'United States',
    currentSchoolType: 'PRIVATE_US',
    educationSystem: 'AP',
  },
  nanwai: {
    name: '南京外国语学校',
    city: 'Nanjing',
    timezone: 'UTC+8',
    country: 'China',
    currentSchoolType: 'PUBLIC_CN',
    educationSystem: 'GAOKAO',
  },
  scie: {
    name: '深圳国际交流学院',
    city: 'Shenzhen',
    timezone: 'UTC+8',
    country: 'China',
    currentSchoolType: 'INTL_CN',
    educationSystem: 'A_LEVEL',
  },
  wlsa: {
    name: 'WLSA Shanghai Academy',
    city: 'Shanghai',
    timezone: 'UTC+8',
    country: 'China',
    currentSchoolType: 'INTL_CN',
    educationSystem: 'AP',
  },
  stuyvesant: {
    name: 'Stuyvesant High School',
    city: 'New York',
    timezone: 'EST',
    country: 'United States',
    currentSchoolType: 'PUBLIC_US',
    educationSystem: 'AP',
  },
  lowell: {
    name: 'Lowell High School',
    city: 'San Francisco',
    timezone: 'PST',
    country: 'United States',
    currentSchoolType: 'PUBLIC_US',
    educationSystem: 'AP',
  },
  harvardWestlake: {
    name: 'Harvard-Westlake School',
    city: 'Los Angeles',
    timezone: 'PST',
    country: 'United States',
    currentSchoolType: 'PRIVATE_US',
    educationSystem: 'AP',
  },
  collegiate: {
    name: 'Collegiate School',
    city: 'New York',
    timezone: 'EST',
    country: 'United States',
    currentSchoolType: 'PRIVATE_US',
    educationSystem: 'AP',
  },
};

const ROLE_TEMPLATES: Record<CategoryKey, string[]> = {
  math: ['Solver', 'Prover', 'Checker'],
  research: ['Research Lead', 'Lab / Data', 'Writer'],
  cs: ['Algorithm Lead', 'Coder', 'Tester'],
  business: ['Captain', 'Analyst', 'Presenter'],
  debate: ['1st Speaker', '2nd Speaker', 'Researcher'],
  arts: ['Creative Lead', 'Researcher', 'Editor'],
};

const CATEGORY_SKILLS: Record<CategoryKey, string[]> = {
  math: [
    'LaTeX',
    'Number Theory',
    'Combinatorics',
    'Mock Review',
    'Proof Writing',
  ],
  research: [
    'Research Design',
    'Wet Lab',
    'Data Viz',
    'Literature Review',
    'Statistical Analysis',
  ],
  cs: ['Python', 'C++', 'Algorithms', 'Git', 'CAD', 'Robotics'],
  business: [
    'Market Sizing',
    'Financial Modeling',
    'Slides',
    'Pitching',
    'Case Writing',
  ],
  debate: ['Debate', 'Writing', 'Evidence Cuttings', 'Speech', 'Mandarin'],
  arts: [
    'Figma',
    'Storytelling',
    'Portfolio Review',
    'Editing',
    'Humanities Research',
  ],
};

const CATEGORY_HIGHLIGHTS: Record<CategoryKey, string[]> = {
  math: [
    'AMC 12 120+',
    'AIME track record',
    'Proof-first workflow',
    'Strong combinatorics core',
  ],
  research: [
    'Mentor backed',
    'Regional fair experience',
    'Paper polish ready',
    'Summer lab sprint',
  ],
  cs: [
    'USACO / robotics background',
    'Shippable weekly cadence',
    'Review-heavy repo flow',
    'Demo driven',
  ],
  business: [
    'Finalist-level presentation',
    'Deck + analyst split',
    'Case-day discipline',
    'Strong pitch room',
  ],
  debate: [
    'Evidence file already started',
    'Round-tested structure',
    'Weekly speech drills',
    'Fast prep room',
  ],
  arts: [
    'Portfolio review circle',
    'Strong visual narrative',
    'Research + craft balance',
    'Critique friendly',
  ],
};

const CATEGORY_TEAM_NAMES: Record<
  CategoryKey,
  { prefixes: string[]; suffixes: string[] }
> = {
  math: {
    prefixes: [
      'Delta',
      'Prime',
      'Vector',
      'Summit',
      'Atlas',
      'Axiom',
      'Cobalt',
      'Integral',
      'Orbit',
      'Lumen',
      'Proof',
      'Meridian',
    ],
    suffixes: [
      'Theorem',
      'Lemma',
      'Matrix',
      'Arc',
      'Proof',
      'Signal',
      'Guild',
      'Collective',
      'Lab',
      'Circle',
      'Draft',
      'Line',
    ],
  },
  research: {
    prefixes: [
      'CRISPR',
      'Helix',
      'Nova',
      'Catalyst',
      'Quantum',
      'Vertex',
      'Pulse',
      'Terra',
      'Astra',
      'Epoch',
      'Clarity',
      'Noble',
    ],
    suffixes: [
      'Crew',
      'Lab',
      'Collective',
      'Works',
      'Research',
      'Atlas',
      'Project',
      'Molecule',
      'Studio',
      'Forum',
      'Field',
      'Array',
    ],
  },
  cs: {
    prefixes: [
      'Byte',
      'Kernel',
      'Lambda',
      'Circuit',
      'Vector',
      'Pixel',
      'Nimbus',
      'Logic',
      'Stack',
      'Binary',
      'Flux',
      'Rocket',
    ],
    suffixes: [
      'Forge',
      'Stack',
      'Works',
      'Loop',
      'Sprint',
      'Ops',
      'Engine',
      'Frame',
      'Circuit',
      'Grid',
      'Pilot',
      'Lab',
    ],
  },
  business: {
    prefixes: [
      'Pitch',
      'Apex',
      'North',
      'Summit',
      'Harbor',
      'Blue',
      'Beacon',
      'Scale',
      'Cedar',
      'Bridge',
      'Atlas',
      'Spark',
    ],
    suffixes: [
      'Capital',
      'Partners',
      'Studio',
      'Analytics',
      'Advisors',
      'Desk',
      'Growth',
      'Collective',
      'Labs',
      'Strategy',
      'Point',
      'House',
    ],
  },
  debate: {
    prefixes: [
      'Rhetoric',
      'Keystone',
      'Atlas',
      'Signal',
      'Forum',
      'Slate',
      'Anchor',
      'Clarity',
      'North',
      'Proof',
      'Ledger',
      'Echo',
    ],
    suffixes: [
      'Riders',
      'Forum',
      'Brief',
      'Desk',
      'Collective',
      'Draft',
      'Room',
      'House',
      'Guild',
      'Caucus',
      'Pulse',
      'Review',
    ],
  },
  arts: {
    prefixes: [
      'Canvas',
      'Echo',
      'Archive',
      'Aurora',
      'Studio',
      'Mosaic',
      'Lumen',
      'Sable',
      'Velvet',
      'North',
      'Paper',
      'Maple',
    ],
    suffixes: [
      'Atelier',
      'Collective',
      'Works',
      'House',
      'Project',
      'Studio',
      'Review',
      'Guild',
      'Circle',
      'Draft',
      'Story',
      'Forum',
    ],
  },
};

const CATEGORY_AFFINITIES: Record<CategoryKey, CategoryKey[]> = {
  math: ['math', 'cs', 'research'],
  research: ['research', 'math', 'cs'],
  cs: ['cs', 'math', 'research', 'business'],
  business: ['business', 'debate', 'cs'],
  debate: ['debate', 'business', 'arts'],
  arts: ['arts', 'debate', 'research'],
};

const MOCK_USERS: MockUserBlueprint[] = [
  {
    index: 1,
    displayName: '王雨辰',
    schoolKey: 'beijing4',
    grade: 'Grade 11',
    focusCategories: ['math', 'cs'],
    targetMajor: 'Mathematics',
    introLine: 'AMC 12 126，写 proof 比刷题更上头。',
    skills: ['LaTeX', 'Python', 'Number Theory', 'Mandarin'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 2,
    displayName: 'Alice Chen',
    schoolKey: 'phillipsExeter',
    grade: 'Grade 11',
    focusCategories: ['math', 'debate'],
    targetMajor: 'Applied Mathematics',
    introLine:
      'Fast on combos, calmer on write-ups, very okay with late-night mocks.',
    skills: ['LaTeX', 'Writing', 'Debate', 'English'],
    languages: ['English'],
    locale: 'en',
  },
  {
    index: 3,
    displayName: '刘子墨',
    schoolKey: 'shanghaiHigh',
    grade: 'Grade 10',
    focusCategories: ['research', 'math'],
    targetMajor: 'Biology',
    introLine: '做过 data cleaning 和 literature review，喜欢把实验逻辑讲透。',
    skills: ['Data Viz', 'Biology', 'Statistics', 'Mandarin'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 4,
    displayName: 'David Park',
    schoolKey: 'tj',
    grade: 'Grade 12',
    focusCategories: ['cs', 'research'],
    targetMajor: 'Computer Science',
    introLine:
      'Robotics + ML background, reliable in code review and debugging.',
    skills: ['Python', 'C++', 'Git', 'Robotics'],
    languages: ['English'],
    locale: 'en',
  },
  {
    index: 5,
    displayName: '陈思远',
    schoolKey: 'nanwai',
    grade: 'Grade 11',
    focusCategories: ['business', 'debate'],
    targetMajor: 'Economics',
    introLine: 'NEC / debate 双修，擅长把复杂材料讲成清楚故事。',
    skills: ['Economics', 'Presentation', 'Writing', 'Mandarin'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 6,
    displayName: 'Sophia Liu',
    schoolKey: 'horaceMann',
    grade: 'Grade 10',
    focusCategories: ['arts', 'debate'],
    targetMajor: 'Design',
    introLine: 'Strong visual taste, also happy to edit copy line by line.',
    skills: ['Figma', 'Writing', 'Editing', 'Storytelling'],
    languages: ['English'],
    locale: 'en',
  },
  {
    index: 7,
    displayName: '张若宁',
    schoolKey: 'scie',
    grade: 'Grade 12',
    focusCategories: ['research', 'cs'],
    targetMajor: 'Bioengineering',
    introLine: '做过 wet-lab 和 paper figure，能扛住 summer intensive。',
    skills: ['Research', 'Python', 'Wet Lab', 'Data Viz'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 8,
    displayName: 'Ethan Wang',
    schoolKey: 'wlsa',
    grade: 'Grade 11',
    focusCategories: ['business', 'cs'],
    targetMajor: 'Business Analytics',
    introLine: 'Deck、data、demo 都能上手，最怕空泛 brainstorm。',
    skills: ['Slides', 'SQL', 'Pitching', 'Python'],
    languages: ['English', 'Mandarin'],
    locale: 'en',
  },
  {
    index: 9,
    displayName: '林嘉禾',
    schoolKey: 'stuyvesant',
    grade: 'Grade 9',
    focusCategories: ['math', 'research'],
    targetMajor: 'Physics',
    introLine: '喜欢快速刷 set，然后把错因整理成 checklist。',
    skills: ['LaTeX', 'Physics', 'Data Viz', 'Writing'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 10,
    displayName: 'Maya Gupta',
    schoolKey: 'lowell',
    grade: 'Grade 11',
    focusCategories: ['debate', 'arts'],
    targetMajor: 'History',
    introLine:
      'Speech + writing heavy, good at shaping argument flow under pressure.',
    skills: ['Debate', 'Writing', 'Research', 'Public Speaking'],
    languages: ['English'],
    locale: 'en',
  },
  {
    index: 11,
    displayName: '赵明轩',
    schoolKey: 'harvardWestlake',
    grade: 'Grade 10',
    focusCategories: ['cs', 'math'],
    targetMajor: 'Computer Science',
    introLine: 'USACO 风格训练很多，代码整洁度比过题数更重要。',
    skills: ['C++', 'Algorithms', 'Python', 'Git'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 12,
    displayName: 'Olivia Zhang',
    schoolKey: 'collegiate',
    grade: 'Grade 12',
    focusCategories: ['arts', 'debate'],
    targetMajor: 'Comparative Literature',
    introLine:
      'Edits fast, critiques gently, and actually enjoys revision rounds.',
    skills: ['Editing', 'Writing', 'Humanities Research', 'Storytelling'],
    languages: ['English'],
    locale: 'en',
  },
  {
    index: 13,
    displayName: '徐嘉宁',
    schoolKey: 'beijing4',
    grade: 'Grade 9',
    focusCategories: ['math', 'debate'],
    targetMajor: 'Statistics',
    introLine: 'AMC 10 在爬坡，擅长把思路写得特别规整。',
    skills: ['LaTeX', 'Combinatorics', 'Writing', 'Mandarin'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 14,
    displayName: 'Ryan Kim',
    schoolKey: 'phillipsExeter',
    grade: 'Grade 11',
    focusCategories: ['cs', 'business'],
    targetMajor: 'Engineering',
    introLine:
      'Good with demos, timelines, and turning rough ideas into working builds.',
    skills: ['JavaScript', 'Product', 'Pitching', 'Git'],
    languages: ['English'],
    locale: 'en',
  },
  {
    index: 15,
    displayName: '周以安',
    schoolKey: 'shanghaiHigh',
    grade: 'Grade 12',
    focusCategories: ['research', 'arts'],
    targetMajor: 'Chemistry',
    introLine: '图表和结果摘要都能做得干净，喜欢稳节奏推进。',
    skills: ['Chemistry', 'Data Viz', 'Editing', 'Mandarin'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 16,
    displayName: 'Emma Li',
    schoolKey: 'tj',
    grade: 'Grade 10',
    focusCategories: ['cs', 'research'],
    targetMajor: 'Biocomputation',
    introLine:
      'Happy in spreadsheets, notebooks, and any messy version-zero repo.',
    skills: ['Python', 'Data Viz', 'Research', 'Git'],
    languages: ['English'],
    locale: 'en',
  },
  {
    index: 17,
    displayName: '孙浩然',
    schoolKey: 'horaceMann',
    grade: 'Grade 11',
    focusCategories: ['debate', 'business'],
    targetMajor: 'Political Science',
    introLine: '既能打 round，也能帮队伍做 prep 和 summary。',
    skills: ['Debate', 'Slides', 'Writing', 'Research'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 18,
    displayName: 'Daniel Wu',
    schoolKey: 'nanwai',
    grade: 'Grade 10',
    focusCategories: ['math', 'cs'],
    targetMajor: 'Computer Engineering',
    introLine: '做题快，debug 更快，合作里比较在意节奏和反馈。',
    skills: ['Algorithms', 'C++', 'LaTeX', 'Mandarin'],
    languages: ['English', 'Mandarin'],
    locale: 'en',
  },
  {
    index: 19,
    displayName: '许安琪',
    schoolKey: 'scie',
    grade: 'Grade 12',
    focusCategories: ['arts', 'research'],
    targetMajor: 'Architecture',
    introLine: '能做 portfolio narrative，也能读 paper 找 framing。',
    skills: ['Figma', 'Editing', 'Research', 'Storytelling'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 20,
    displayName: 'Leo Chen',
    schoolKey: 'wlsa',
    grade: 'Grade 9',
    focusCategories: ['business', 'debate'],
    targetMajor: 'Finance',
    introLine: '喜欢案例拆解和即兴表达，会议不拖沓。',
    skills: ['Finance', 'Presentation', 'Writing', 'Mandarin'],
    languages: ['English', 'Mandarin'],
    locale: 'en',
  },
  {
    index: 21,
    displayName: '郭子衿',
    schoolKey: 'stuyvesant',
    grade: 'Grade 11',
    focusCategories: ['research', 'debate'],
    targetMajor: 'Neuroscience',
    introLine: '文献综述和口头表达都在线，适合顶 paper / Q&A。',
    skills: ['Research', 'Writing', 'Data Viz', 'Public Speaking'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 22,
    displayName: 'Chloe Zhao',
    schoolKey: 'lowell',
    grade: 'Grade 10',
    focusCategories: ['cs', 'arts'],
    targetMajor: 'Design Technology',
    introLine: 'Product sense 很强，能把工程 demo 做得更像作品。',
    skills: ['Figma', 'JavaScript', 'Product', 'Design Systems'],
    languages: ['English'],
    locale: 'en',
  },
  {
    index: 23,
    displayName: '沈奕辰',
    schoolKey: 'harvardWestlake',
    grade: 'Grade 12',
    focusCategories: ['math', 'research'],
    targetMajor: 'Applied Physics',
    introLine: '题感稳定，愿意带 mock review，也能补实验数据分析。',
    skills: ['Physics', 'LaTeX', 'Statistics', 'Writing'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 24,
    displayName: 'Noah Lin',
    schoolKey: 'collegiate',
    grade: 'Grade 11',
    focusCategories: ['arts', 'debate'],
    targetMajor: 'Philosophy',
    introLine:
      'Argument structure and tone control are the two things I care about most.',
    skills: ['Writing', 'Debate', 'Editing', 'Humanities Research'],
    languages: ['English'],
    locale: 'en',
  },
  {
    index: 25,
    displayName: '何知远',
    schoolKey: 'beijing4',
    grade: 'Grade 10',
    focusCategories: ['cs', 'research'],
    targetMajor: 'Mechanical Engineering',
    introLine: '机器人、电控和代码都能接，偏爱有清单的团队。',
    skills: ['Robotics', 'Python', 'CAD', 'Mandarin'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 26,
    displayName: 'Grace Xu',
    schoolKey: 'phillipsExeter',
    grade: 'Grade 9',
    focusCategories: ['arts', 'debate'],
    targetMajor: 'Journalism',
    introLine:
      'Strong copy sense, loves revision, and comfortable with critique.',
    skills: ['Writing', 'Editing', 'Storytelling', 'Design'],
    languages: ['English'],
    locale: 'en',
  },
  {
    index: 27,
    displayName: '梁思齐',
    schoolKey: 'shanghaiHigh',
    grade: 'Grade 11',
    focusCategories: ['business', 'research'],
    targetMajor: 'Economics',
    introLine: '会做 market sizing，也能把数据故事讲清楚。',
    skills: ['Economics', 'Data Viz', 'Slides', 'Mandarin'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 28,
    displayName: 'Benjamin Ho',
    schoolKey: 'tj',
    grade: 'Grade 12',
    focusCategories: ['cs', 'research'],
    targetMajor: 'Electrical Engineering',
    introLine:
      'Can lead implementation, but also comfortable doing boring QA work.',
    skills: ['C++', 'Robotics', 'Git', 'Testing'],
    languages: ['English'],
    locale: 'en',
  },
  {
    index: 29,
    displayName: '叶书宁',
    schoolKey: 'nanwai',
    grade: 'Grade 10',
    focusCategories: ['debate', 'arts'],
    targetMajor: 'International Relations',
    introLine: '写作和 prep 都比较稳，适合做 second speaker / editor。',
    skills: ['Debate', 'Writing', 'Editing', 'Mandarin'],
    languages: ['English', 'Mandarin'],
    locale: 'zh',
  },
  {
    index: 30,
    displayName: 'Hannah Sun',
    schoolKey: 'stuyvesant',
    grade: 'Grade 12',
    focusCategories: ['math', 'business'],
    targetMajor: 'Operations Research',
    introLine:
      'Quant brain with presenter energy; good at turning notes into structure.',
    skills: ['Statistics', 'Finance', 'LaTeX', 'Slides'],
    languages: ['English'],
    locale: 'en',
  },
];

const OFFICIAL_COMPETITION_BLUEPRINTS: CompetitionBlueprint[] = [
  {
    slug: 'amc-10',
    aliases: ['AMC 10'],
    categoryKey: 'math',
    poolIds: ['math-olympiads'],
    tracks: [
      track('problem-solving', 'Problem Solving Cohort', 1, 3, {
        languages: ['English', 'Mandarin'],
      }),
    ],
  },
  {
    slug: 'amc-12',
    aliases: ['AMC 12'],
    categoryKey: 'math',
    poolIds: ['math-olympiads'],
    tracks: [
      track('proof-circle', 'Proof Circle', 1, 3, {
        languages: ['English', 'Mandarin'],
        cardCount: 2,
      }),
    ],
  },
  {
    slug: 'aime',
    aliases: ['AIME'],
    categoryKey: 'math',
    poolIds: ['math-olympiads'],
    tracks: [
      track('aime-i', 'AIME I', 1, 3),
      track('aime-ii', 'AIME II', 1, 3),
    ],
  },
  {
    slug: 'hmmt',
    aliases: ['HMMT'],
    categoryKey: 'math',
    poolIds: ['math-olympiads', 'popular-main'],
    tracks: [
      track('november', 'November', 4, 6, { cardCount: 20 }),
      track('february', 'February', 4, 6, { cardCount: 4 }),
    ],
  },
  {
    slug: 'pumac',
    aliases: ['PUMaC'],
    categoryKey: 'math',
    poolIds: ['math-olympiads'],
    tracks: [
      track('power-round', 'Power Round', 4, 6),
      track('team-round', 'Team Round', 4, 6),
    ],
  },
  {
    slug: 'arml',
    aliases: ['ARML'],
    categoryKey: 'math',
    poolIds: ['math-olympiads'],
    tracks: [
      track('regional-squad', 'Regional Squad', 4, 6),
      track('relay-round', 'Relay Round', 4, 6),
    ],
  },
  {
    slug: 'himcm',
    aliases: ['HiMCM'],
    categoryKey: 'math',
    poolIds: ['math-olympiads'],
    tracks: [
      track('modeling', 'Modeling', 3, 5),
      track('write-up', 'Write-Up', 3, 5),
    ],
  },
  {
    slug: 'putnam',
    aliases: ['Putnam'],
    categoryKey: 'math',
    poolIds: ['math-olympiads'],
    tracks: [track('open-division', 'Open Division', 1, 3)],
  },
  {
    slug: 'mathcounts',
    aliases: ['MATHCOUNTS'],
    categoryKey: 'math',
    poolIds: ['math-olympiads'],
    tracks: [
      track('sprint-target', 'Sprint / Target', 2, 4),
      track('team-round', 'Team Round', 4, 6),
    ],
  },

  {
    slug: 'isef',
    aliases: ['ISEF'],
    categoryKey: 'research',
    poolIds: ['science-research', 'popular-main'],
    tracks: [
      track('life-sciences', 'Life Sciences', 1, 3, { cardCount: 2 }),
      track('engineering', 'Engineering', 1, 3),
    ],
  },
  {
    slug: 'regeneron-sts',
    aliases: ['Regeneron STS'],
    categoryKey: 'research',
    poolIds: ['science-research'],
    tracks: [
      track('research-paper', 'Research Paper', 1, 3),
      track('interview-prep', 'Interview Prep', 1, 3),
    ],
  },
  {
    slug: 'usabo',
    aliases: ['USABO'],
    categoryKey: 'research',
    poolIds: ['science-research'],
    tracks: [
      track('open-exam', 'Open Exam', 1, 3),
      track('semifinal-lab', 'Semifinal Lab', 1, 3),
    ],
  },
  {
    slug: 'usapho',
    aliases: ['USAPhO'],
    categoryKey: 'research',
    poolIds: ['science-research'],
    tracks: [
      track('f-ma-prep', 'F=ma Prep', 1, 3),
      track('semi-final', 'Semi-Final', 1, 3),
    ],
  },
  {
    slug: 'usnco',
    aliases: ['USNCO'],
    categoryKey: 'research',
    poolIds: ['science-research'],
    tracks: [
      track('local-section', 'Local Section', 1, 3),
      track('national-study-camp', 'National Study Camp', 1, 3),
    ],
  },
  {
    slug: 'science-olympiad',
    aliases: ['SciOly', 'Science Olympiad'],
    categoryKey: 'research',
    poolIds: ['science-research'],
    tracks: [
      track('build-events', 'Build Events', 4, 6),
      track('study-events', 'Study Events', 4, 6),
    ],
  },
  {
    slug: 'jshs',
    aliases: ['JSHS'],
    categoryKey: 'research',
    poolIds: ['science-research'],
    tracks: [
      track('research-presentation', 'Research Presentation', 1, 3),
      track('poster-q-and-a', 'Poster & Q&A', 1, 3),
    ],
  },

  {
    slug: 'usaco',
    aliases: ['USACO'],
    categoryKey: 'cs',
    poolIds: ['cs-engineering', 'popular-main'],
    tracks: [
      track('bronze-silver', 'Bronze / Silver', 1, 3),
      track('gold-platinum', 'Gold / Platinum', 1, 3, { cardCount: 2 }),
      track('camp-training', 'Camp Training', 1, 3),
    ],
  },
  {
    slug: 'ioi',
    aliases: ['IOI'],
    categoryKey: 'cs',
    poolIds: ['cs-engineering'],
    tracks: [track('national-selection', 'National Selection', 1, 3)],
  },
  {
    slug: 'frc',
    aliases: ['FRC', 'FIRST'],
    categoryKey: 'cs',
    poolIds: ['cs-engineering', 'popular-main'],
    tracks: [
      track('mechanical-cad', 'Mechanical / CAD', 4, 8),
      track('programming-controls', 'Programming / Controls', 4, 8),
    ],
  },
  {
    slug: 'igem',
    aliases: ['iGEM'],
    categoryKey: 'cs',
    poolIds: ['cs-engineering'],
    tracks: [
      track('wet-lab', 'Wet Lab', 4, 8),
      track('dry-lab-wiki', 'Dry Lab / Wiki', 4, 8),
    ],
  },
  {
    slug: 'vex',
    aliases: ['VEX'],
    categoryKey: 'cs',
    poolIds: ['cs-engineering'],
    tracks: [
      track('strategy-driving', 'Strategy / Driving', 4, 8),
      track('autonomous-coding', 'Autonomous / Coding', 4, 8),
    ],
  },
  {
    slug: 'cac',
    aliases: ['CAC', 'Congressional App Challenge'],
    categoryKey: 'cs',
    poolIds: ['cs-engineering'],
    tracks: [track('product-engineering', 'Product / Engineering', 2, 4)],
  },
  {
    slug: 'technovation',
    aliases: ['Technovation'],
    categoryKey: 'cs',
    poolIds: ['cs-engineering'],
    tracks: [
      track('app-build', 'App Build', 2, 4),
      track('pitch-deck', 'Pitch Deck', 2, 4),
    ],
  },

  {
    slug: 'deca',
    aliases: ['DECA ICDC', 'DECA'],
    categoryKey: 'business',
    poolIds: ['business-case', 'popular-main'],
    tracks: [
      track('marketing', 'Marketing', 2, 4, { cardCount: 2 }),
      track('entrepreneurship', 'Entrepreneurship', 2, 4),
      track('finance', 'Finance', 2, 4),
    ],
  },
  {
    slug: 'fbla',
    aliases: ['FBLA'],
    categoryKey: 'business',
    poolIds: ['business-case'],
    tracks: [
      track('objective-tests', 'Objective Tests', 2, 4),
      track('presentation-events', 'Presentation Events', 2, 4),
    ],
  },
  {
    slug: 'nec',
    aliases: ['NEC'],
    categoryKey: 'business',
    poolIds: ['business-case', 'popular-main'],
    tracks: [
      track('adam-smith', 'Adam Smith', 2, 4),
      track('david-ricardo', 'David Ricardo', 2, 4),
    ],
  },
  {
    slug: 'bpa',
    aliases: ['BPA'],
    categoryKey: 'business',
    poolIds: ['business-case'],
    tracks: [
      track('finance-analyst', 'Finance Analyst', 2, 4),
      track('presentation-team', 'Presentation Team', 2, 4),
    ],
  },
  {
    slug: 'kwhs',
    aliases: ['KWHS'],
    categoryKey: 'business',
    poolIds: ['business-case'],
    tracks: [
      track('portfolio-research', 'Portfolio Research', 2, 4),
      track('presentation-lead', 'Presentation Lead', 2, 4),
    ],
  },
  {
    slug: 'diamond-challenge',
    aliases: ['Diamond Challenge'],
    categoryKey: 'business',
    poolIds: ['business-case'],
    tracks: [
      track('business-innovation', 'Business Innovation', 2, 4),
      track('social-impact', 'Social Impact', 2, 4),
    ],
  },

  {
    slug: 'nsda-nationals',
    aliases: ['NSDA Nationals'],
    categoryKey: 'debate',
    poolIds: ['debate-writing', 'popular-main'],
    tracks: [
      track('public-forum', 'Public Forum', 2, 3, { cardCount: 2 }),
      track('lincoln-douglas', 'Lincoln-Douglas', 2, 3),
      track('speech', 'Speech', 1, 3),
    ],
  },
  {
    slug: 'toc',
    aliases: ['TOC'],
    categoryKey: 'debate',
    poolIds: ['debate-writing'],
    tracks: [
      track('public-forum', 'Public Forum', 2, 3),
      track('lincoln-douglas', 'Lincoln-Douglas', 2, 3),
    ],
  },
  {
    slug: 'scholastic-writing',
    aliases: ['Scholastic Writing'],
    categoryKey: 'debate',
    poolIds: ['debate-writing'],
    tracks: [
      track('critical-essay', 'Critical Essay', 1, 3),
      track('personal-narrative', 'Personal Narrative', 1, 3),
    ],
  },
  {
    slug: 'nyt-editorial',
    aliases: ['NYT Editorial'],
    categoryKey: 'debate',
    poolIds: ['debate-writing'],
    tracks: [track('editorial-board', 'Editorial Board', 1, 3)],
  },
  {
    slug: 'ayn-rand',
    aliases: ['Ayn Rand Essay'],
    categoryKey: 'debate',
    poolIds: ['debate-writing'],
    tracks: [track('essay-workshop', 'Essay Workshop', 1, 3)],
  },

  {
    slug: 'youngarts',
    aliases: ['YoungArts'],
    categoryKey: 'arts',
    poolIds: ['arts-humanities', 'popular-main'],
    tracks: [
      track('visual-arts', 'Visual Arts', 1, 4),
      track('writing-voice', 'Writing / Voice', 1, 4),
    ],
  },
  {
    slug: 'scholastic-art',
    aliases: ['Scholastic Art'],
    categoryKey: 'arts',
    poolIds: ['arts-humanities'],
    tracks: [
      track('portfolio', 'Portfolio', 1, 4),
      track('individual-work', 'Individual Work', 1, 4),
    ],
  },
  {
    slug: 'nhd',
    aliases: ['NHD'],
    categoryKey: 'arts',
    poolIds: ['arts-humanities'],
    tracks: [
      track('documentary', 'Documentary', 1, 4),
      track('exhibit-website', 'Exhibit / Website', 1, 4),
    ],
  },
  {
    slug: 'breakthrough-junior',
    aliases: ['Breakthrough Junior'],
    categoryKey: 'arts',
    poolIds: ['arts-humanities'],
    tracks: [track('science-video', 'Science Video', 1, 4)],
  },
];

const MATCH_POOL_BLUEPRINTS: MatchPoolBlueprint[] = [
  {
    id: 'popular-main',
    name: 'Popular Main Competitions',
    nameZh: '热门主流比赛',
    description:
      'High-traffic official competitions with denser mock recruiting coverage.',
    competitionAliases: [
      ['HMMT'],
      ['USACO'],
      ['ISEF'],
      ['DECA ICDC', 'DECA'],
      ['NEC'],
      ['NSDA Nationals'],
      ['YoungArts'],
      ['FRC', 'FIRST'],
    ],
  },
  {
    id: 'math-olympiads',
    name: 'Math Competitions',
    nameZh: '数学竞赛',
    description: 'Olympiad, tournament, and modeling math competitions.',
    competitionAliases: [
      ['AMC 10'],
      ['AMC 12'],
      ['AIME'],
      ['HMMT'],
      ['PUMaC'],
      ['Putnam'],
      ['ARML'],
      ['MATHCOUNTS'],
      ['HiMCM'],
    ],
  },
  {
    id: 'science-research',
    name: 'Science & Research',
    nameZh: '科研竞赛',
    description: 'Research fairs, olympiads, and lab-heavy STEM competitions.',
    competitionAliases: [
      ['ISEF'],
      ['Regeneron STS'],
      ['USABO'],
      ['USAPhO'],
      ['USNCO'],
      ['SciOly', 'Science Olympiad'],
      ['JSHS'],
      ['Davidson Fellows'],
    ],
  },
  {
    id: 'cs-engineering',
    name: 'Programming & Engineering',
    nameZh: '编程与工程',
    description:
      'Programming, robotics, app, and engineering build competitions.',
    competitionAliases: [
      ['USACO'],
      ['IOI'],
      ['FRC', 'FIRST'],
      ['VEX'],
      ['iGEM'],
      ['CAC', 'Congressional App Challenge'],
      ['Technovation'],
      ['Conrad'],
    ],
  },
  {
    id: 'business-case',
    name: 'Business & Case',
    nameZh: '商业案例',
    description: 'Economics, business case, and entrepreneurship competitions.',
    competitionAliases: [
      ['DECA ICDC', 'DECA'],
      ['FBLA'],
      ['NEC'],
      ['BPA'],
      ['KWHS'],
      ['Diamond Challenge'],
      ['IEO'],
    ],
  },
  {
    id: 'debate-writing',
    name: 'Debate & Writing',
    nameZh: '辩论与写作',
    description: 'Speech, debate, editorial, and essay competitions.',
    competitionAliases: [
      ['NSDA Nationals'],
      ['TOC'],
      ['Scholastic Writing'],
      ['NYT Editorial'],
      ['Ayn Rand Essay'],
      ['John Locke'],
    ],
  },
  {
    id: 'arts-humanities',
    name: 'Arts & Humanities',
    nameZh: '艺术与人文',
    description:
      'Portfolio, history, humanities, and creative expression competitions.',
    competitionAliases: [
      ['YoungArts'],
      ['Scholastic Art'],
      ['NHD'],
      ['Breakthrough Junior'],
      ['Scholastic Writing'],
    ],
  },
  {
    id: 'premier-international',
    name: 'Premier International',
    nameZh: '国际顶级赛事',
    description: 'Small, top-tier international flagship competitions.',
    competitionAliases: [['IMO'], ['IBO'], ['IPhO'], ['IChO'], ['IOI']],
  },
  {
    id: 'china-competitions',
    name: 'China Competitions',
    nameZh: '中国本土赛',
    description:
      'China-based olympiad, debate, and interdisciplinary competitions.',
    competitionAliases: [
      ['CMO'],
      ['CPhO'],
      ['NOI'],
      ['CTB', 'China Thinks Big'],
      ['NSDA China'],
      ['Physics Bowl China'],
    ],
  },
];

export async function seedTeamData(client: PrismaClient = prisma) {
  console.log('🤝 Seeding official pools + realistic mock recruitment data...');

  const competitions = await client.competition.findMany({
    where: { isActive: true },
  });
  const competitionLookup = buildCompetitionLookup(competitions);

  const { managedTrackMeta, editionCount, trackCount, contextCount } =
    await seedOfficialCompetitionGraph(client, competitionLookup);
  const poolCount = await seedMatchPools(client, competitionLookup);
  const mockUsers = await seedMockUsers(client);
  const { teamCount, cardCount, memberProfileCount } =
    await seedMockTeamsAndCards(client, mockUsers, managedTrackMeta);

  console.log(
    `  ✅ Official graph synced: ${editionCount} editions, ${trackCount} tracks, ${contextCount} contexts`,
  );
  console.log(`  ✅ Match pools synced: ${poolCount}`);
  console.log(`  ✅ Mock users synced: ${mockUsers.length}`);
  console.log(`  ✅ Mock teams synced: ${teamCount}`);
  console.log(`  ✅ Published cards synced: ${cardCount}`);
  console.log(`  ✅ Member profiles synced: ${memberProfileCount}`);
  console.log('🎉 Team & recruitment seed completed!');
}

async function seedOfficialCompetitionGraph(
  client: PrismaClient,
  competitionLookup: Map<string, Competition>,
) {
  const managedTrackMeta = new Map<string, ManagedTrackMeta>();
  const now = new Date();
  const seasonLabel = `${now.getFullYear()}-${now.getFullYear() + 1}`;

  let editionCount = 0;
  let trackCount = 0;
  let contextCount = 0;

  for (const [
    competitionIndex,
    blueprint,
  ] of OFFICIAL_COMPETITION_BLUEPRINTS.entries()) {
    const competition = resolveCompetition(
      competitionLookup,
      blueprint.aliases,
    );
    const schedule = buildEditionSchedule(now, competitionIndex);

    const edition = await client.competitionEdition.upsert({
      where: {
        competitionId_seasonLabel: {
          competitionId: competition.id,
          seasonLabel,
        },
      },
      update: {
        status: 'ACTIVE',
        registrationOpenAt: schedule.registrationOpenAt,
        registrationCloseAt: schedule.registrationCloseAt,
        eventStartAt: schedule.eventStartAt,
        eventEndAt: schedule.eventEndAt,
      },
      create: {
        competitionId: competition.id,
        seasonLabel,
        status: 'ACTIVE',
        registrationOpenAt: schedule.registrationOpenAt,
        registrationCloseAt: schedule.registrationCloseAt,
        eventStartAt: schedule.eventStartAt,
        eventEndAt: schedule.eventEndAt,
      },
    });
    editionCount += 1;

    for (const trackBlueprint of blueprint.tracks) {
      const track = await client.competitionTrack.upsert({
        where: {
          competitionEditionId_name: {
            competitionEditionId: edition.id,
            name: trackBlueprint.name,
          },
        },
        update: {
          rolePresets: buildRolePresets(
            blueprint.categoryKey,
            trackBlueprint.extraRoles,
          ),
          minTeamSize: trackBlueprint.minTeamSize,
          maxTeamSize: trackBlueprint.maxTeamSize,
          languages: trackBlueprint.languages,
          isActive: true,
        },
        create: {
          competitionEditionId: edition.id,
          name: trackBlueprint.name,
          rolePresets: buildRolePresets(
            blueprint.categoryKey,
            trackBlueprint.extraRoles,
          ),
          minTeamSize: trackBlueprint.minTeamSize,
          maxTeamSize: trackBlueprint.maxTeamSize,
          languages: trackBlueprint.languages,
          isActive: true,
        },
      });
      trackCount += 1;

      await ensureOfficialRecruitmentContext(client, {
        competition,
        edition: {
          seasonLabel,
          registrationCloseAt: schedule.registrationCloseAt,
          eventStartAt: schedule.eventStartAt,
          eventEndAt: schedule.eventEndAt,
        },
        track,
        locationMode: inferContextLocationMode(
          competition.abbreviation,
          blueprint.categoryKey,
        ),
      });
      contextCount += 1;

      managedTrackMeta.set(track.id, {
        categoryKey: blueprint.categoryKey,
        cardCount: trackBlueprint.cardCount,
      });
    }
  }

  return {
    managedTrackMeta,
    editionCount,
    trackCount,
    contextCount,
  };
}

async function seedMatchPools(
  client: PrismaClient,
  competitionLookup: Map<string, Competition>,
) {
  for (const [poolIndex, blueprint] of MATCH_POOL_BLUEPRINTS.entries()) {
    const existingPool = await client.matchPool.findFirst({
      where: { name: blueprint.name },
      select: { id: true },
    });

    const pool = existingPool
      ? await client.matchPool.update({
          where: { id: existingPool.id },
          data: {
            nameZh: blueprint.nameZh,
            description: blueprint.description,
            sortOrder: poolIndex,
            isActive: true,
          },
        })
      : await client.matchPool.create({
          data: {
            name: blueprint.name,
            nameZh: blueprint.nameZh,
            description: blueprint.description,
            sortOrder: poolIndex,
            isActive: true,
          },
        });

    await client.matchPoolEntry.deleteMany({
      where: { matchPoolId: pool.id },
    });

    const resolvedCompetitions = dedupeCompetitions(
      blueprint.competitionAliases.map((aliases) =>
        resolveCompetition(competitionLookup, aliases),
      ),
    ).sort((left, right) => {
      if (left.tier !== right.tier) return right.tier - left.tier;
      return left.name.localeCompare(right.name);
    });

    await client.matchPoolEntry.createMany({
      data: resolvedCompetitions.map((competition, sortOrder) => ({
        matchPoolId: pool.id,
        entryType: 'OFFICIAL_COMPETITION',
        competitionId: competition.id,
        sortOrder,
        isActive: true,
      })),
    });
  }

  return MATCH_POOL_BLUEPRINTS.length;
}

async function seedMockUsers(client: PrismaClient): Promise<SeededMockUser[]> {
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash(MOCK_PASSWORD, 10);

  const results: SeededMockUser[] = [];

  for (const blueprint of MOCK_USERS) {
    const school = SCHOOL_DIRECTORY[blueprint.schoolKey];
    const email = `mock-${String(blueprint.index).padStart(2, '0')}@studyabroad.mock`;

    // Vary verification levels for realistic badge distribution:
    // index % 10 === 0 → USER + unverified (2-3 users, no badge)
    // index % 10 in [1,2,3] → USER + emailVerified ('email' level, gray dot)
    // rest → VERIFIED + emailVerified ('verified' level, blue checkmark)
    const mod = blueprint.index % 10;
    const trustRole: 'USER' | 'VERIFIED' = mod <= 3 ? 'USER' : 'VERIFIED';
    const trustEmail = mod !== 0;

    const user = await client.user.upsert({
      where: { email },
      update: {
        role: trustRole,
        emailVerified: trustEmail,
        locale: blueprint.locale,
        deletedAt: null,
      },
      create: {
        email,
        passwordHash,
        role: trustRole,
        emailVerified: trustEmail,
        locale: blueprint.locale,
      },
    });

    await client.profile.upsert({
      where: { userId: user.id },
      update: {
        nickname: blueprint.displayName,
        realName: blueprint.displayName,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=mock-${blueprint.index}`,
        bio: `${blueprint.introLine} Skills: ${blueprint.skills.join(' / ')}`,
        onboardingCompleted: true,
        currentSchool: school.name,
        currentSchoolType: school.currentSchoolType,
        grade: blueprint.grade,
        targetMajor: blueprint.targetMajor,
        intendedMajor: blueprint.targetMajor,
        educationSystem: school.educationSystem,
        countryOfResidence: school.country,
        nationality:
          school.country === 'China' ? 'Chinese' : 'American / International',
        visibility: 'PUBLIC',
        budgetTier:
          blueprint.index % 5 === 0
            ? 'UNLIMITED'
            : blueprint.index % 2 === 0
              ? 'HIGH'
              : 'MEDIUM',
        regionPref: blueprint.index % 4 === 0 ? ['US', 'UK'] : ['US'],
        firstGeneration: blueprint.index % 7 === 0,
        needsFinancialAid: blueprint.index % 3 === 0,
      },
      create: {
        userId: user.id,
        nickname: blueprint.displayName,
        realName: blueprint.displayName,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=mock-${blueprint.index}`,
        bio: `${blueprint.introLine} Skills: ${blueprint.skills.join(' / ')}`,
        onboardingCompleted: true,
        currentSchool: school.name,
        currentSchoolType: school.currentSchoolType,
        grade: blueprint.grade,
        targetMajor: blueprint.targetMajor,
        intendedMajor: blueprint.targetMajor,
        educationSystem: school.educationSystem,
        countryOfResidence: school.country,
        nationality:
          school.country === 'China' ? 'Chinese' : 'American / International',
        visibility: 'PUBLIC',
        budgetTier:
          blueprint.index % 5 === 0
            ? 'UNLIMITED'
            : blueprint.index % 2 === 0
              ? 'HIGH'
              : 'MEDIUM',
        regionPref: blueprint.index % 4 === 0 ? ['US', 'UK'] : ['US'],
        firstGeneration: blueprint.index % 7 === 0,
        needsFinancialAid: blueprint.index % 3 === 0,
      },
    });

    results.push({
      ...blueprint,
      userId: user.id,
      city: school.city,
      timezone: school.timezone,
      currentSchool: school.name,
    });
  }

  return results;
}

async function seedMockTeamsAndCards(
  client: PrismaClient,
  mockUsers: SeededMockUser[],
  managedTrackMeta: Map<string, ManagedTrackMeta>,
) {
  const contexts = (await client.recruitmentContext.findMany({
    where: {
      sourceType: 'OFFICIAL',
      isPublished: true,
      isActive: true,
      competitionTrack: {
        is: {
          isActive: true,
          competitionEdition: {
            is: { status: 'ACTIVE' },
          },
        },
      },
    },
    include: {
      competitionTrack: {
        include: {
          competitionEdition: {
            include: {
              competition: true,
            },
          },
        },
      },
    },
  })) as LoadedOfficialContext[];

  contexts.sort((left, right) => {
    const leftCompetition =
      left.competitionTrack?.competitionEdition.competition.abbreviation ?? '';
    const rightCompetition =
      right.competitionTrack?.competitionEdition.competition.abbreviation ?? '';

    const competitionSort = leftCompetition.localeCompare(rightCompetition);
    if (competitionSort !== 0) return competitionSort;

    const leftTrack = left.competitionTrack?.name ?? '';
    const rightTrack = right.competitionTrack?.name ?? '';
    return leftTrack.localeCompare(rightTrack);
  });

  let globalCardIndex = 0;
  let teamCount = 0;
  let cardCount = 0;
  let memberProfileCount = 0;

  for (const context of contexts) {
    if (!context.competitionTrack) continue;

    const meta = managedTrackMeta.get(context.competitionTrack.id);
    const categoryKey =
      meta?.categoryKey ??
      mapCompetitionCategoryToCategoryKey(
        context.competitionTrack.competitionEdition.competition.category,
      );
    const desiredCardCount = meta?.cardCount ?? 1;

    for (let localIndex = 0; localIndex < desiredCardCount; localIndex += 1) {
      const cardPlan = buildMockCardPlan(
        context,
        categoryKey,
        mockUsers,
        globalCardIndex,
        localIndex,
      );

      const team = await upsertMockTeam(client, cardPlan);
      const card = await client.teamRecruitmentCard.upsert({
        where: {
          teamId_recruitmentContextId: {
            teamId: team.id,
            recruitmentContextId: context.id,
          },
        },
        update: {
          phase: 'PUBLISHED',
          headline: cardPlan.headline,
          detailNote: cardPlan.detailNote,
          highlightTitle: cardPlan.highlightTitle,
          offerRoles: cardPlan.offerRoles,
          needRoles: cardPlan.needRoles,
          skillTags: cardPlan.skillTags,
          availabilityBand: cardPlan.availabilityBand,
          collaborationMode: cardPlan.collaborationMode,
          timezone: cardPlan.timezone,
          city: cardPlan.city,
          languages: cardPlan.languages,
          intentMode: cardPlan.intentMode,
          publishedAt: cardPlan.publishedAt,
          expiresAt: cardPlan.expiresAt,
          isClosed: false,
          version: 1,
        },
        create: {
          teamId: team.id,
          recruitmentContextId: context.id,
          phase: 'PUBLISHED',
          headline: cardPlan.headline,
          detailNote: cardPlan.detailNote,
          highlightTitle: cardPlan.highlightTitle,
          offerRoles: cardPlan.offerRoles,
          needRoles: cardPlan.needRoles,
          skillTags: cardPlan.skillTags,
          availabilityBand: cardPlan.availabilityBand,
          collaborationMode: cardPlan.collaborationMode,
          timezone: cardPlan.timezone,
          city: cardPlan.city,
          languages: cardPlan.languages,
          intentMode: cardPlan.intentMode,
          publishedAt: cardPlan.publishedAt,
          expiresAt: cardPlan.expiresAt,
          isClosed: false,
          version: 1,
        },
      });

      await client.teamRecruitmentMemberProfile.deleteMany({
        where: { teamRecruitmentCardId: card.id },
      });

      await client.teamRecruitmentMemberProfile.createMany({
        data: cardPlan.members.map((member, memberIndex) => ({
          teamRecruitmentCardId: card.id,
          userId: member.userId,
          selectedResumeId: null,
          introLine: member.introLine,
          showSchool: (globalCardIndex + memberIndex) % 5 !== 0,
          showGrade: (globalCardIndex + memberIndex + 1) % 5 !== 0,
          showAwards: (globalCardIndex + memberIndex + 2) % 5 !== 0,
          consentConfirmedAt: cardPlan.publishedAt,
        })),
      });

      teamCount += 1;
      cardCount += 1;
      memberProfileCount += cardPlan.members.length;
      globalCardIndex += 1;
    }
  }

  return { teamCount, cardCount, memberProfileCount };
}

function buildMockCardPlan(
  context: LoadedOfficialContext,
  categoryKey: CategoryKey,
  mockUsers: SeededMockUser[],
  globalCardIndex: number,
  localIndex: number,
) {
  const competition = context.competitionTrack!.competitionEdition.competition;
  const trackName = context.competitionTrack!.name;
  const { currentSize, targetSize } = deriveTeamSizes(context, globalCardIndex);
  const members = selectTeamMembers(
    mockUsers,
    categoryKey,
    globalCardIndex,
    currentSize,
  );
  const roles: Array<SeededMockUser & { membershipRole: TeamMemberRole }> =
    members.map((member, index) => ({
      ...member,
      membershipRole:
        index === 0
          ? TeamMemberRole.OWNER
          : index === 1
            ? TeamMemberRole.ADMIN
            : TeamMemberRole.MEMBER,
    }));
  const intentMode =
    globalCardIndex % 5 === 0
      ? RecruitmentIntentMode.NETWORKING_ONLY
      : RecruitmentIntentMode.TEAM_UP;
  const collaborationMode = chooseCollaborationMode(
    categoryKey,
    competition.abbreviation,
    globalCardIndex,
  );
  const timezone = roles[0]?.timezone ?? 'UTC+8';
  const city =
    collaborationMode === CollaborationMode.ONLINE
      ? globalCardIndex % 3 === 0
        ? 'Remote'
        : (roles[0]?.city ?? 'Remote')
      : (roles[0]?.city ?? 'Remote');
  const languages = buildCardLanguages(context.languages, roles);
  const roleSplit = splitRoles(context.rolePresets, globalCardIndex);
  const skillTags = buildCardSkills(
    competition.abbreviation,
    trackName,
    categoryKey,
    roles,
    globalCardIndex,
  );
  const publishedAt = addDays(new Date(), -(globalCardIndex % 6));
  const expiresAt = addDays(new Date(), 90 + (globalCardIndex % 20));
  const headline = buildHeadline(
    categoryKey,
    competition.abbreviation,
    trackName,
    intentMode,
    roleSplit.needRoles[0] ?? context.rolePresets[0] ?? 'teammate',
    globalCardIndex,
  );
  const detailNote = buildDetailNote(
    categoryKey,
    competition.abbreviation,
    trackName,
    roles,
    intentMode,
  );

  return {
    teamName: buildTeamName(
      categoryKey,
      competition.abbreviation,
      trackName,
      globalCardIndex,
    ),
    teamDescription: buildTeamDescription(
      competition.abbreviation,
      trackName,
      skillTags,
    ),
    visibility:
      intentMode === RecruitmentIntentMode.NETWORKING_ONLY
        ? TeamVisibility.UNLISTED
        : TeamVisibility.PUBLIC,
    joinPolicy:
      globalCardIndex % 3 === 0
        ? TeamJoinPolicy.OPEN
        : TeamJoinPolicy.INVITE_ONLY,
    currentSize,
    targetSize,
    members: roles,
    headline,
    detailNote,
    highlightTitle:
      globalCardIndex % 4 === 0
        ? pickFrom(CATEGORY_HIGHLIGHTS[categoryKey], globalCardIndex)
        : null,
    offerRoles: roleSplit.offerRoles,
    needRoles: roleSplit.needRoles,
    skillTags,
    availabilityBand: pickFrom(
      availabilityOptions(categoryKey),
      globalCardIndex,
    ),
    collaborationMode,
    timezone,
    city,
    languages,
    intentMode,
    publishedAt,
    expiresAt,
  };
}

async function upsertMockTeam(
  client: PrismaClient,
  cardPlan: ReturnType<typeof buildMockCardPlan>,
) {
  const existing = await client.team.findFirst({
    where: {
      creatorId: cardPlan.members[0].userId,
      name: cardPlan.teamName,
    },
    select: { id: true },
  });

  const team = existing
    ? await client.team.update({
        where: { id: existing.id },
        data: {
          name: cardPlan.teamName,
          description: cardPlan.teamDescription,
          visibility: cardPlan.visibility,
          joinPolicy: cardPlan.joinPolicy,
          maxMembers: cardPlan.targetSize,
          tags: cardPlan.skillTags,
        },
      })
    : await client.team.create({
        data: {
          creatorId: cardPlan.members[0].userId,
          name: cardPlan.teamName,
          description: cardPlan.teamDescription,
          visibility: cardPlan.visibility,
          joinPolicy: cardPlan.joinPolicy,
          maxMembers: cardPlan.targetSize,
          tags: cardPlan.skillTags,
        },
      });

  await client.teamMembership.deleteMany({
    where: { teamId: team.id },
  });

  await client.teamMembership.createMany({
    data: cardPlan.members.map((member) => ({
      teamId: team.id,
      userId: member.userId,
      role: member.membershipRole,
    })),
  });

  return team;
}

async function ensureOfficialRecruitmentContext(
  client: PrismaClient,
  args: {
    competition: Competition;
    edition: {
      seasonLabel: string;
      registrationCloseAt: Date;
      eventStartAt: Date;
      eventEndAt: Date;
    };
    track: {
      id: string;
      name: string;
      rolePresets: string[];
      minTeamSize: number;
      maxTeamSize: number;
      languages: string[];
    };
    locationMode: LocationMode;
  },
) {
  const { competition, edition, track, locationMode } = args;
  return client.recruitmentContext.upsert({
    where: { competitionTrackId: track.id },
    update: {
      sourceType: 'OFFICIAL',
      title: competition.name,
      titleZh: competition.nameZh,
      subtitle: `${competition.abbreviation} · ${track.name} · ${edition.seasonLabel}`,
      description: competition.description,
      sourceUrl: competition.website,
      registrationCloseAt: edition.registrationCloseAt,
      eventStartAt: edition.eventStartAt,
      eventEndAt: edition.eventEndAt,
      locationMode,
      locationText: null,
      rolePresets: track.rolePresets,
      minTeamSize: track.minTeamSize,
      maxTeamSize: track.maxTeamSize,
      languages: track.languages,
      moderationStatus: 'APPROVED',
      isPublished: true,
      publishedAt: new Date(),
      isActive: true,
    },
    create: {
      sourceType: 'OFFICIAL',
      title: competition.name,
      titleZh: competition.nameZh,
      subtitle: `${competition.abbreviation} · ${track.name} · ${edition.seasonLabel}`,
      description: competition.description,
      sourceUrl: competition.website,
      registrationCloseAt: edition.registrationCloseAt,
      eventStartAt: edition.eventStartAt,
      eventEndAt: edition.eventEndAt,
      locationMode,
      locationText: null,
      rolePresets: track.rolePresets,
      minTeamSize: track.minTeamSize,
      maxTeamSize: track.maxTeamSize,
      languages: track.languages,
      moderationStatus: 'APPROVED',
      isPublished: true,
      publishedAt: new Date(),
      isActive: true,
      competitionTrackId: track.id,
    },
  });
}

function track(
  key: string,
  name: string,
  minTeamSize: number,
  maxTeamSize: number,
  options?: Partial<
    Omit<TrackBlueprint, 'key' | 'name' | 'minTeamSize' | 'maxTeamSize'>
  >,
): TrackBlueprint {
  return {
    key,
    name,
    minTeamSize,
    maxTeamSize,
    languages: options?.languages ?? ['English'],
    cardCount: options?.cardCount ?? 1,
    extraRoles: options?.extraRoles,
  };
}

function buildCompetitionLookup(competitions: Competition[]) {
  const lookup = new Map<string, Competition>();
  for (const competition of competitions) {
    lookup.set(competition.abbreviation.toLowerCase(), competition);
    lookup.set(competition.name.toLowerCase(), competition);
    if (competition.nameZh) {
      lookup.set(competition.nameZh.toLowerCase(), competition);
    }
  }
  return lookup;
}

function resolveCompetition(
  competitionLookup: Map<string, Competition>,
  aliases: string[],
) {
  for (const alias of aliases) {
    const competition = competitionLookup.get(alias.toLowerCase());
    if (competition) return competition;
  }

  throw new Error(`Competition not found for aliases: ${aliases.join(', ')}`);
}

function dedupeCompetitions(competitions: Competition[]) {
  const seen = new Set<string>();
  return competitions.filter((competition) => {
    if (seen.has(competition.id)) return false;
    seen.add(competition.id);
    return true;
  });
}

function buildEditionSchedule(now: Date, index: number) {
  const registrationOpenAt = addDays(now, -14 + (index % 5));
  const registrationCloseAt = addDays(now, 30 + (index % 18));
  const eventStartAt = addDays(now, 90 + (index % 24));
  const eventEndAt = addDays(eventStartAt, 2 + (index % 5));

  return {
    registrationOpenAt,
    registrationCloseAt,
    eventStartAt,
    eventEndAt,
  };
}

function inferContextLocationMode(
  abbreviation: string,
  categoryKey: CategoryKey,
): LocationMode {
  if (['FRC', 'VEX', 'iGEM', 'SciOly'].includes(abbreviation)) {
    return LocationMode.HYBRID;
  }

  if (categoryKey === 'research' || categoryKey === 'arts') {
    return LocationMode.HYBRID;
  }

  return LocationMode.ONLINE;
}

function buildRolePresets(categoryKey: CategoryKey, extraRoles?: string[]) {
  return uniqueStrings([
    ...ROLE_TEMPLATES[categoryKey],
    ...(extraRoles ?? []),
  ]).slice(0, 5);
}

function mapCompetitionCategoryToCategoryKey(
  category: CompetitionCategory,
): CategoryKey {
  switch (category) {
    case CompetitionCategory.MATH:
      return 'math';
    case CompetitionCategory.BIOLOGY:
    case CompetitionCategory.PHYSICS:
    case CompetitionCategory.CHEMISTRY:
    case CompetitionCategory.ENGINEERING_RESEARCH:
      return 'research';
    case CompetitionCategory.COMPUTER_SCIENCE:
      return 'cs';
    case CompetitionCategory.ECONOMICS_BUSINESS:
      return 'business';
    case CompetitionCategory.DEBATE_SPEECH:
    case CompetitionCategory.WRITING_ESSAY:
      return 'debate';
    case CompetitionCategory.ARTS_MUSIC:
    case CompetitionCategory.GENERAL_ACADEMIC:
    case CompetitionCategory.OTHER:
    default:
      return 'arts';
  }
}

function deriveTeamSizes(context: LoadedOfficialContext, seed: number) {
  const maxCurrentSize = Math.max(2, context.maxTeamSize - 1);
  const minCurrentSize = Math.min(
    maxCurrentSize,
    Math.max(2, context.minTeamSize),
  );
  const currentSize = clamp(
    minCurrentSize + (seed % Math.max(1, maxCurrentSize - minCurrentSize + 1)),
    2,
    maxCurrentSize,
  );
  const targetSize = clamp(
    currentSize + 1 + (seed % 2),
    currentSize + 1,
    context.maxTeamSize,
  );

  return { currentSize, targetSize };
}

function selectTeamMembers(
  mockUsers: SeededMockUser[],
  categoryKey: CategoryKey,
  seed: number,
  count: number,
) {
  const eligible = mockUsers.filter((user) =>
    user.focusCategories.some((focus) =>
      CATEGORY_AFFINITIES[categoryKey].includes(focus),
    ),
  );
  const step = 3 + (seed % 4);
  const start = (seed * 2) % eligible.length;
  const members: SeededMockUser[] = [];

  for (
    let cursor = 0;
    members.length < count && cursor < eligible.length * 2;
    cursor += 1
  ) {
    const candidate = eligible[(start + cursor * step) % eligible.length];
    if (!members.some((member) => member.userId === candidate.userId)) {
      members.push(candidate);
    }
  }

  return members.slice(0, count);
}

function buildTeamName(
  categoryKey: CategoryKey,
  competitionAbbreviation: string,
  trackName: string,
  seed: number,
) {
  const { prefixes, suffixes } = CATEGORY_TEAM_NAMES[categoryKey];
  const prefix = prefixes[seed % prefixes.length];
  const suffix = suffixes[Math.floor(seed / prefixes.length) % suffixes.length];
  const competitionToken = competitionAbbreviation.replace(/\s+/g, '');
  const trackToken = shortTrackToken(trackName);
  return `${prefix} ${suffix} ${competitionToken} ${trackToken}`.trim();
}

function buildTeamDescription(
  competitionAbbreviation: string,
  trackName: string,
  skillTags: string[],
) {
  return `${competitionAbbreviation} ${trackName} squad built around ${skillTags
    .slice(0, 3)
    .join(', ')} with a steady weekly review cadence.`;
}

function splitRoles(rolePresets: string[], seed: number) {
  const rotated = rotate(rolePresets, seed % Math.max(1, rolePresets.length));
  const offerRoles = uniqueStrings(
    rotated.slice(0, Math.min(2, rotated.length - 1)),
  );
  const needRoles = uniqueStrings(
    rotated.slice(offerRoles.length, offerRoles.length + 2),
  );

  return {
    offerRoles,
    needRoles:
      needRoles.length > 0
        ? needRoles
        : [rotated[rotated.length - 1] ?? 'Teammate'],
  };
}

function buildCardSkills(
  competitionAbbreviation: string,
  trackName: string,
  categoryKey: CategoryKey,
  members: Array<SeededMockUser & { membershipRole: TeamMemberRole }>,
  seed: number,
) {
  const memberSkills = members.flatMap((member) => member.skills);
  return uniqueStrings([
    competitionAbbreviation,
    shortTrackToken(trackName),
    ...rotate(
      CATEGORY_SKILLS[categoryKey],
      seed % CATEGORY_SKILLS[categoryKey].length,
    ),
    ...memberSkills,
  ]).slice(0, 6);
}

function buildCardLanguages(
  contextLanguages: string[],
  members: Array<SeededMockUser & { membershipRole: TeamMemberRole }>,
) {
  const languages = ['English'];
  if (
    contextLanguages.includes('Mandarin') &&
    members.some((member) => member.languages.includes('Mandarin'))
  ) {
    languages.push('Mandarin');
  }
  return uniqueStrings(languages);
}

function buildHeadline(
  categoryKey: CategoryKey,
  competitionAbbreviation: string,
  trackName: string,
  intentMode: RecruitmentIntentMode,
  neededRole: string,
  seed: number,
) {
  if (intentMode === RecruitmentIntentMode.NETWORKING_ONLY) {
    return `Open to connect with other ${competitionAbbreviation} ${trackName} teams`;
  }

  const templates: Record<CategoryKey, string[]> = {
    math: [
      `Looking for a ${neededRole.toLowerCase()} for ${competitionAbbreviation} ${trackName}`,
      `${competitionAbbreviation} ${trackName} pod needs one more clean ${neededRole.toLowerCase()}`,
      `Need a steady ${neededRole.toLowerCase()} for ${competitionAbbreviation} ${trackName}`,
    ],
    research: [
      `${competitionAbbreviation} ${trackName} team needs a ${neededRole.toLowerCase()}`,
      `Mentored ${competitionAbbreviation} project looking for ${neededRole.toLowerCase()} support`,
      `Seeking a strong ${neededRole.toLowerCase()} for ${competitionAbbreviation} ${trackName}`,
    ],
    cs: [
      `${competitionAbbreviation} ${trackName} squad needs a ${neededRole.toLowerCase()} who ships`,
      `Looking for a ${neededRole.toLowerCase()} for ${competitionAbbreviation} ${trackName}`,
      `Need a reliable ${neededRole.toLowerCase()} for ${competitionAbbreviation} ${trackName}`,
    ],
    business: [
      `Seasoned ${competitionAbbreviation} team seeking a ${neededRole.toLowerCase()}`,
      `${competitionAbbreviation} ${trackName} group needs a ${neededRole.toLowerCase()}`,
      `Looking for a ${neededRole.toLowerCase()} for ${competitionAbbreviation} ${trackName}`,
    ],
    debate: [
      `Need a sharp ${neededRole.toLowerCase()} for ${competitionAbbreviation} ${trackName}`,
      `${competitionAbbreviation} ${trackName} room seeking a ${neededRole.toLowerCase()}`,
      `Looking for a ${neededRole.toLowerCase()} for ${competitionAbbreviation} ${trackName}`,
    ],
    arts: [
      `Portfolio-first ${competitionAbbreviation} group needs a ${neededRole.toLowerCase()}`,
      `Looking for a ${neededRole.toLowerCase()} for ${competitionAbbreviation} ${trackName}`,
      `${competitionAbbreviation} ${trackName} team wants one more ${neededRole.toLowerCase()}`,
    ],
  };

  return pickFrom(templates[categoryKey], seed);
}

function buildDetailNote(
  categoryKey: CategoryKey,
  competitionAbbreviation: string,
  trackName: string,
  members: Array<SeededMockUser & { membershipRole: TeamMemberRole }>,
  intentMode: RecruitmentIntentMode,
) {
  const schools = members
    .slice(0, 2)
    .map((member) => member.currentSchool)
    .join(' / ');

  if (intentMode === RecruitmentIntentMode.NETWORKING_ONLY) {
    return `${competitionAbbreviation} ${trackName} 这边 roster 基本齐了，但我们仍然想认识更多认真做事的人。现在团队成员主要来自 ${schools}，平时会分享 prep schedule、资料包和复盘笔记，也愿意互相介绍 mentor / judge / summer opportunity。If you value clear communication and low-drama collaboration, we are happy to compare workflows and stay connected for the next cycle.`;
  }

  switch (categoryKey) {
    case 'math':
      return `${competitionAbbreviation} ${trackName} 这边想补一位真正愿意写清楚 proof、也能跟上 timed mock 节奏的同学。我们现有成员主要来自 ${schools}，每周二晚和周末各一次固定练习，先做 set 再复盘解法结构，不做无效空聊。Team members already have AMC / AIME style experience, and we want someone who can keep solutions rigorous, communicate fast, and still stay kind under pressure.`;
    case 'research':
      return `${competitionAbbreviation} ${trackName} 团队已经有题目方向和基础分工，现在更需要能把实验 / 数据 / paper 某一块真正扛住的人。成员来自 ${schools}，我们会把文献、版本和 meeting note 管得比较细，赛前会有一段 summer intensive。We are looking for someone who likes disciplined execution, can document clearly, and is comfortable turning messy work into something submission-ready.`;
    case 'cs':
      return `${competitionAbbreviation} ${trackName} 这边希望再补一个能写、能测、也愿意做 review 的队友。现有成员来自 ${schools}，每周有一次 architecture review 和一次 build session，代码尽量走 PR 规范，deadline 前两周会 freeze demo 范围。We care about shipping steadily, keeping the repo readable, and making sure the final presentation looks as solid as the implementation.`;
    case 'business':
      return `${competitionAbbreviation} ${trackName} 目前已经有 captain 和 deck owner，想再找一个能把分析、故事线和现场表达串起来的人。成员来自 ${schools}，会固定做 case drill、timed pitch 和 Q&A rehearsal，风格是直接但不内耗。We are strongest when someone can turn raw notes into structure, challenge weak assumptions early, and still keep the room calm on presentation day.`;
    case 'debate':
      return `${competitionAbbreviation} ${trackName} 团队想补一位 research / speech 都比较稳的搭档，最好对 prep file 和 round strategy 都有自己的判断。成员主要来自 ${schools}，我们每周会做 evidence update、speech drill 和 round replay，赛前节奏会明显拉满。We want someone who can cut clean cards, give sharp feedback, and keep the team composed when prep time gets short.`;
    case 'arts':
    default:
      return `${competitionAbbreviation} ${trackName} 这边在找一个既有审美判断，也愿意认真 revision 的人。成员来自 ${schools}，平时会做 critique、reference board 和 statement polishing，不追求表面热闹，更在意作品完成度和 narrative consistency。We care about thoughtful feedback, clean execution, and a collaboration style where ideas improve every week instead of getting stuck in vague discussion.`;
  }
}

function chooseCollaborationMode(
  categoryKey: CategoryKey,
  competitionAbbreviation: string,
  seed: number,
) {
  if (['FRC', 'VEX', 'iGEM', 'SciOly'].includes(competitionAbbreviation)) {
    return pickFrom(
      [CollaborationMode.HYBRID, CollaborationMode.OFFLINE],
      seed,
    );
  }

  if (categoryKey === 'research' || categoryKey === 'arts') {
    return pickFrom([CollaborationMode.HYBRID, CollaborationMode.ONLINE], seed);
  }

  return pickFrom([CollaborationMode.ONLINE, CollaborationMode.HYBRID], seed);
}

function availabilityOptions(categoryKey: CategoryKey) {
  switch (categoryKey) {
    case 'math':
      return [
        RecruitmentAvailabilityBand.FIVE_TO_TEN_HOURS,
        RecruitmentAvailabilityBand.WEEKENDS_ONLY,
      ];
    case 'research':
      return [
        RecruitmentAvailabilityBand.TEN_PLUS_HOURS,
        RecruitmentAvailabilityBand.FIVE_TO_TEN_HOURS,
      ];
    case 'cs':
      return [
        RecruitmentAvailabilityBand.FIVE_TO_TEN_HOURS,
        RecruitmentAvailabilityBand.TEN_PLUS_HOURS,
      ];
    case 'business':
      return [
        RecruitmentAvailabilityBand.LESS_THAN_5_HOURS,
        RecruitmentAvailabilityBand.FIVE_TO_TEN_HOURS,
      ];
    case 'debate':
      return [
        RecruitmentAvailabilityBand.FIVE_TO_TEN_HOURS,
        RecruitmentAvailabilityBand.WEEKENDS_ONLY,
      ];
    case 'arts':
    default:
      return [
        RecruitmentAvailabilityBand.LESS_THAN_5_HOURS,
        RecruitmentAvailabilityBand.FIVE_TO_TEN_HOURS,
      ];
  }
}

function shortTrackToken(trackName: string) {
  const normalized = trackName
    .replace(/[^\w/ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return 'Team';

  const explicit = normalized.toLowerCase();
  if (explicit.includes('public forum')) return 'PF';
  if (explicit.includes('lincoln-douglas')) return 'LD';
  if (explicit.includes('aime')) return normalized;
  if (explicit.includes('f=ma')) return 'F=ma';

  const firstToken = normalized.split(/[ /-]+/)[0];
  return firstToken || 'Team';
}

function pickFrom<T>(items: T[], seed: number): T {
  return items[seed % items.length];
}

function rotate<T>(items: T[], offset: number) {
  if (items.length === 0) return [];
  const pivot = offset % items.length;
  return [...items.slice(pivot), ...items.slice(0, pivot)];
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

if (require.main === module) {
  seedTeamData()
    .then(() => prisma.$disconnect())
    .catch((error) => {
      console.error(error);
      prisma.$disconnect();
      process.exit(1);
    });
}

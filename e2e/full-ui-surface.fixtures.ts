import type { Page, Route } from '@playwright/test';

import type { FullUiRole } from './full-ui-surface.registry';

const E2E_USER = {
  id: 'e2e-user',
  email: 'e2e@example.com',
  name: 'Amy Zhang',
  firstName: 'Amy',
  lastName: 'Zhang',
  role: 'USER',
  emailVerified: true,
  locale: 'en',
  points: 240,
  subscriptionTier: 'PRO',
  profileComplete: true,
};

const E2E_ADMIN = {
  ...E2E_USER,
  id: 'e2e-admin',
  email: 'admin-e2e@example.com',
  name: 'Admin User',
  role: 'ADMIN',
  isAdmin: true,
};

const E2E_SCHOOLS = [
  {
    id: 'e2e-mit',
    slug: 'mit',
    name: 'Massachusetts Institute of Technology',
    nameZh: '麻省理工学院',
    country: 'US',
    state: 'MA',
    city: 'Cambridge',
    usNewsRank: 2,
    acceptanceRate: 4,
    tuition: 60156,
    totalEnrollment: 11920,
    testingPolicy: 'REQUIRED',
    hasEarlyDecision: false,
    acceptsCommonApp: false,
    tags: ['Engineering', 'Research', 'STEM'],
  },
  {
    id: 'e2e-stanford',
    slug: 'stanford',
    name: 'Stanford University',
    nameZh: '斯坦福大学',
    country: 'US',
    state: 'CA',
    city: 'Stanford',
    usNewsRank: 3,
    acceptanceRate: 4,
    tuition: 62484,
    totalEnrollment: 18000,
    testingPolicy: 'OPTIONAL',
    hasEarlyDecision: true,
    acceptsCommonApp: true,
    tags: ['AI', 'Entrepreneurship', 'Research'],
  },
  {
    id: 'e2e-purdue',
    slug: 'purdue',
    name: 'Purdue University',
    nameZh: '普渡大学',
    country: 'US',
    state: 'IN',
    city: 'West Lafayette',
    usNewsRank: 46,
    acceptanceRate: 53,
    tuition: 28794,
    totalEnrollment: 52000,
    testingPolicy: 'OPTIONAL',
    hasEarlyDecision: false,
    acceptsCommonApp: true,
    tags: ['Engineering', 'Public', 'Value'],
  },
];

const E2E_CASES = [
  {
    id: 'e2e-case',
    slug: 'e2e-case',
    title: 'Engineering admit with focused research narrative',
    titleZh: '工程方向录取案例',
    studentName: 'Amy Z.',
    status: 'PUBLISHED',
    result: 'ADMITTED',
    schoolId: 'e2e-mit',
    schoolName: 'MIT',
    major: 'Computer Science',
    gpa: 3.92,
    sat: 1540,
    year: 2026,
    tags: ['CS', 'Research', 'International'],
    summary:
      'A calibrated admissions plan that balanced reach schools, safer targets, essays, and submission timing.',
    summaryZh: '通过校单、文书和时间线校准完成高效申请规划。',
  },
];

const E2E_ESSAYS = [
  {
    id: 'e2e-essay',
    title: 'Why Purdue Engineering',
    titleZh: '为什么选择普渡工程',
    type: 'WHY_SCHOOL',
    status: 'READY',
    year: 2026,
    round: 'RD',
    result: 'ADMITTED',
    prompt: 'Why are you drawn to Purdue Engineering?',
    content:
      'I learned to build by first learning to listen.\n\nPurdue gives that habit a rigorous engineering home.',
    wordCount: 482,
    gpaRange: '3.9-4.0',
    satRange: '1500-1550',
    school: E2E_SCHOOLS[2],
    tags: ['Engineering', 'Why School'],
    isVerified: true,
    isAnonymous: false,
    excerpt: 'I learned to build by first learning to listen.',
  },
];

const E2E_TEAMS = [
  {
    id: 'e2e-team',
    name: 'Lumni E2E Team',
    description: 'Counselor workspace for full UI coverage.',
    role: 'OWNER',
    visibility: 'PUBLIC',
    joinPolicy: 'OPEN',
    maxMembers: 8,
    schoolId: 'e2e-mit',
    school: E2E_SCHOOLS[0],
    creatorId: E2E_USER.id,
    memberCount: 3,
    membersCount: 3,
    isMember: true,
    myRole: 'OWNER',
    inviteCode: 'LUMNI-E2E',
    tags: ['CS', 'RD', 'Portfolio'],
    members: [
      {
        id: 'e2e-member-owner',
        role: 'OWNER',
        joinedAt: new Date('2026-04-01T12:00:00Z').toISOString(),
        user: {
          id: E2E_USER.id,
          email: E2E_USER.email,
          profile: { nickname: 'Amy Zhang', avatarUrl: null },
        },
      },
      {
        id: 'e2e-member-admin',
        role: 'ADMIN',
        joinedAt: new Date('2026-04-03T12:00:00Z').toISOString(),
        user: {
          id: 'e2e-peer',
          email: 'peer@example.com',
          profile: { nickname: 'Peer Mentor', avatarUrl: null },
        },
      },
      {
        id: 'e2e-member-member',
        role: 'MEMBER',
        joinedAt: new Date('2026-04-05T12:00:00Z').toISOString(),
        user: {
          id: 'e2e-counselor',
          email: 'counselor@example.com',
          profile: { nickname: 'Counselor Lin', avatarUrl: null },
        },
      },
    ],
  },
];

const E2E_RESUMES = [
  {
    id: 'e2e-resume',
    title: 'Amy Zhang Common App Resume',
    updatedAt: new Date('2026-04-15T12:00:00Z').toISOString(),
    createdAt: new Date('2026-04-01T12:00:00Z').toISOString(),
    status: 'DRAFT',
    type: 'COLLEGE_APPLICATION',
    templateId: 'classic',
    language: 'en',
    version: 1,
    sections: [
      {
        id: 'education',
        resumeId: 'e2e-resume',
        type: 'EDUCATION',
        title: 'Education',
        content: { items: [] },
        isVisible: true,
        order: 0,
        createdAt: new Date('2026-04-01T12:00:00Z').toISOString(),
        updatedAt: new Date('2026-04-15T12:00:00Z').toISOString(),
      },
    ],
    _count: { sections: 1 },
  },
];

const E2E_RECOMMENDED_USERS = [
  {
    id: 'e2e-peer',
    email: 'peer@example.com',
    role: 'VERIFIED',
    profile: {
      nickname: 'Peer Mentor',
      targetMajor: 'Computer Science',
      grade: 'Senior',
      visibility: 'PUBLIC',
      completeness: { testScores: 1, activities: 3, awards: 2 },
    },
    stats: { followers: 12, following: 7, cases: 1 },
    score: 0.91,
    reasons: ['verified', 'sameMajor'],
  },
];

const E2E_SOCIAL_RELATIONS = [
  {
    relationId: 'follow-1',
    relationType: 'followers',
    createdAt: new Date('2026-04-16T12:00:00Z').toISOString(),
    user: E2E_RECOMMENDED_USERS[0],
    relationship: 'mutual',
  },
];

const E2E_FOLLOWERS = [
  {
    id: 'follow-1',
    followerId: 'e2e-peer',
    followingId: E2E_USER.id,
    createdAt: new Date('2026-04-16T12:00:00Z').toISOString(),
    follower: E2E_RECOMMENDED_USERS[0],
  },
];

const E2E_FOLLOWING = [
  {
    id: 'follow-2',
    followerId: E2E_USER.id,
    followingId: 'e2e-peer',
    createdAt: new Date('2026-04-17T12:00:00Z').toISOString(),
    following: E2E_RECOMMENDED_USERS[0],
  },
];

const E2E_CONVERSATIONS = [
  {
    id: 'e2e-conversation',
    kind: 'DIRECT',
    title: 'Peer Mentor',
    createdBySystem: false,
    otherUser: E2E_RECOMMENDED_USERS[0],
    participantCount: 2,
    participantPreview: [E2E_USER, E2E_RECOMMENDED_USERS[0]],
    avatarSummary: [null, null],
    teamMatchId: null,
    participants: [
      { id: E2E_USER.id, email: E2E_USER.email },
      { id: 'e2e-peer', email: 'peer@example.com' },
    ],
    lastMessage: {
      id: 'e2e-message',
      content: 'Purdue looks ready to submit.',
      senderId: 'e2e-peer',
      createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
    },
    unreadCount: 1,
    isPinned: false,
    isArchived: false,
    mutedUntil: null,
    isMuted: false,
    createdAt: new Date('2026-04-18T12:00:00Z').toISOString(),
    updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  },
];

const E2E_MESSAGES = [
  {
    id: 'e2e-message',
    conversationId: 'e2e-conversation',
    senderId: 'e2e-peer',
    content: 'Purdue looks ready to submit.',
    createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
    isDeleted: false,
    isRecalled: false,
    attachments: [],
    replyTo: null,
  },
];

const E2E_CHAT_CONTEXT = {
  id: 'e2e-conversation',
  kind: 'DIRECT',
  title: 'Peer Mentor',
  createdBySystem: false,
  teamMatch: null,
  currentUserPreferences: {
    isPinned: false,
    isArchived: false,
    mutedUntil: null,
    lastReadAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  },
  participants: [
    {
      id: E2E_USER.id,
      email: E2E_USER.email,
      role: E2E_USER.role,
      profile: E2E_USER.profile,
      lastReadAt: new Date('2026-04-20T12:00:00Z').toISOString(),
      isPinned: false,
      isArchived: false,
      mutedUntil: null,
    },
    {
      ...E2E_RECOMMENDED_USERS[0],
      lastReadAt: new Date('2026-04-19T12:00:00Z').toISOString(),
      isPinned: false,
      isArchived: false,
      mutedUntil: null,
    },
  ],
  files: [],
};

const E2E_FORUM_CATEGORIES = [
  {
    id: 'e2e-forum-category-application',
    name: 'Application Experience',
    nameZh: '申请经验',
    description: 'Admissions planning and school list discussions',
    descriptionZh: '申请规划和选校讨论',
    postCount: 18,
  },
  {
    id: 'e2e-forum-category-essay',
    name: 'Essay Discussion',
    nameZh: '文书讨论',
    description: 'Essay ideas, drafts, and review questions',
    descriptionZh: '文书灵感、草稿和修改问题',
    postCount: 12,
  },
];

const E2E_FORUM_COMMUNITIES = [
  {
    id: 'e2e-community-apply',
    slug: 'apply',
    name: 'Apply',
    description: 'Application strategy, timelines, and school list feedback.',
    postCount: 128,
    followerCount: 4200,
    isOfficial: true,
    isFollowing: true,
    createdAt: new Date('2026-04-01T12:00:00Z').toISOString(),
  },
  {
    id: 'e2e-community-essays',
    slug: 'essays',
    name: 'Essays',
    description: 'Brainstorming, structure, and revision support for application essays.',
    postCount: 84,
    followerCount: 1800,
    isOfficial: true,
    isFollowing: false,
    createdAt: new Date('2026-04-02T12:00:00Z').toISOString(),
  },
  {
    id: 'e2e-community-campus',
    slug: 'campus-life',
    name: 'CampusLife',
    description: 'Student life, housing, and fit conversations.',
    postCount: 51,
    followerCount: 900,
    isOfficial: false,
    isFollowing: false,
    createdAt: new Date('2026-04-03T12:00:00Z').toISOString(),
  },
  {
    id: 'e2e-community-cs',
    slug: 'cs-majors',
    name: 'CSMajors',
    description: 'CS program selection, portfolios, and activities.',
    postCount: 112,
    followerCount: 3100,
    isOfficial: false,
    isFollowing: false,
    createdAt: new Date('2026-04-04T12:00:00Z').toISOString(),
  },
];

const E2E_FORUM_POSTS = Array.from({ length: 8 }, (_, index) => {
  const community = E2E_FORUM_COMMUNITIES[index % E2E_FORUM_COMMUNITIES.length];
  const category = E2E_FORUM_CATEGORIES[index % E2E_FORUM_CATEGORIES.length];
  return {
    id: `e2e-forum-post-${index + 1}`,
    title: [
      'How do I decide whether ED2 is worth the risk?',
      'Can someone review this UC activity framing?',
      'What makes a waitlist update letter useful?',
      'Should I retake TOEFL after 105?',
    ][index % 4],
    content:
      'I am comparing options and would love concrete advice from people who have recently been through the same application stage.',
    categoryId: category.id,
    category,
    communityId: community.id,
    community,
    author: {
      id: `e2e-forum-author-${index + 1}`,
      name: ['Amy', 'Mina', 'Chris', 'Yuki'][index % 4],
      avatar: '',
      isVerified: index % 3 === 0,
    },
    images: [],
    isTeamPost: false,
    tags: ['application', 'planning'],
    viewCount: 1200 + index * 137,
    likeCount: 18 + index * 6,
    commentCount: 4 + index * 3,
    isPinned: index === 0,
    isLocked: false,
    createdAt: new Date(`2026-04-${10 + index}T12:00:00Z`).toISOString(),
    updatedAt: new Date(`2026-04-${10 + index}T12:00:00Z`).toISOString(),
    isLiked: false,
  };
});

const E2E_NOTIFICATIONS = [
  {
    id: 'e2e-notification',
    title: 'Purdue is ready to submit',
    message: 'Tonight is the cleanest window to send it.',
    read: false,
    createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  },
];

const E2E_TASKS = [
  {
    id: 'e2e-task-1',
    title: 'Confirm Purdue submission window',
    status: 'TODO',
    dueDate: new Date('2026-05-15T12:00:00Z').toISOString(),
  },
  {
    id: 'e2e-task-2',
    title: 'Polish Georgia Tech essay',
    status: 'DONE',
    dueDate: new Date('2026-05-20T12:00:00Z').toISOString(),
  },
];

const E2E_SCHOOL_LIST_ITEMS = E2E_SCHOOLS.map((school, index) => ({
  id: `e2e-school-list-${school.id}`,
  schoolId: school.id,
  tier: index === 0 ? 'REACH' : index === 1 ? 'TARGET' : 'SAFETY',
  round: index === 1 ? 'EA' : 'RD',
  school,
}));

const E2E_TIMELINE_TASKS = [
  {
    id: 'e2e-timeline-task-1',
    timelineId: 'e2e-timeline-purdue',
    title: 'Finalize Purdue Why Major essay',
    type: 'ESSAY',
    description: 'Polish the last evidence paragraph and run one final read.',
    dueDate: new Date('2026-05-10T12:00:00Z').toISOString(),
    completed: false,
    sortOrder: 1,
  },
  {
    id: 'e2e-timeline-task-2',
    timelineId: 'e2e-timeline-purdue',
    title: 'Confirm recommender upload',
    type: 'RECOMMENDATION',
    dueDate: new Date('2026-05-12T12:00:00Z').toISOString(),
    completed: true,
    completedAt: new Date('2026-04-22T12:00:00Z').toISOString(),
    sortOrder: 2,
  },
];

const E2E_TIMELINES = [
  {
    id: 'e2e-timeline-purdue',
    schoolId: 'e2e-purdue',
    schoolName: 'Purdue University',
    round: 'RD',
    deadline: new Date('2026-05-20T12:00:00Z').toISOString(),
    status: 'IN_PROGRESS',
    progress: 62,
    priority: 1,
    notes: 'Ready after final essay pass.',
    tasksTotal: 3,
    tasksCompleted: 2,
    createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  },
];

const E2E_PERSONAL_EVENTS = [
  {
    id: 'e2e-personal-event',
    category: 'TEST',
    title: 'May SAT registration deadline',
    deadline: new Date('2026-05-08T12:00:00Z').toISOString(),
    eventDate: new Date('2026-06-06T12:00:00Z').toISOString(),
    status: 'IN_PROGRESS',
    progress: 50,
    priority: 2,
    description: 'Confirm test center and upload ID requirements.',
    tasksTotal: 2,
    tasksCompleted: 1,
    createdAt: new Date('2026-04-18T12:00:00Z').toISOString(),
  },
];

const E2E_GLOBAL_EVENTS = [
  {
    id: 'e2e-global-event',
    title: 'Common App rollover planning',
    titleZh: 'Common App 新周期规划',
    category: 'APPLICATION',
    eventDate: new Date('2026-06-01T12:00:00Z').toISOString(),
    registrationDeadline: new Date('2026-05-25T12:00:00Z').toISOString(),
    description: 'Review prompts and prepare reusable activity language.',
    descriptionZh: '检查题目并准备可复用活动描述。',
    url: 'https://www.commonapp.org/',
    year: 2026,
  },
];

const E2E_TIMELINE_OVERVIEW = {
  totalSchools: E2E_TIMELINES.length,
  submitted: 0,
  inProgress: E2E_TIMELINES.length,
  notStarted: 0,
  upcomingDeadlines: E2E_TIMELINES,
  overdueTasks: [],
  totalPersonalEvents: E2E_PERSONAL_EVENTS.length,
  personalInProgress: E2E_PERSONAL_EVENTS.length,
  personalCompleted: 0,
  upcomingPersonalEvents: E2E_PERSONAL_EVENTS,
};

const E2E_SYSTEM_SETTINGS = [
  { key: 'subscription_pro_price', value: '99', category: 'subscription' },
  { key: 'subscription_premium_price', value: '199', category: 'subscription' },
  { key: 'subscription_yearly_discount', value: '20', category: 'subscription' },
  { key: 'ai_quota_default_daily', value: '10', category: 'ai_quota' },
  { key: 'ai_quota_pro_daily', value: '100', category: 'ai_quota' },
  { key: 'ai_quota_premium_daily', value: '500', category: 'ai_quota' },
];

const E2E_DATA_SYNC_JOBS = [
  {
    id: 'COLLEGE_SCORECARD',
    name: 'College Scorecard',
    description: 'Refresh federal admissions and cost data.',
    lastRunAt: new Date('2026-04-20T12:00:00Z').toISOString(),
    lastRunStatus: 'success',
    lastRunMessage: 'Synced 50 schools',
    nextScheduledRun: new Date('2026-05-20T12:00:00Z').toISOString(),
  },
  {
    id: 'BIGFUTURE',
    name: 'BigFuture',
    description: 'Refresh school profile metadata.',
    lastRunAt: null,
    lastRunStatus: null,
    lastRunMessage: null,
    nextScheduledRun: null,
  },
];

const E2E_SCHOOL_QUALITY = {
  summary: {
    total: E2E_SCHOOLS.length,
    fullyComplete: 2,
    missingCritical: 1,
    averageCompleteness: 86,
  },
  fieldCoverage: {
    acceptanceRate: { filled: 3, missing: 0, percent: 100 },
    tuition: { filled: 3, missing: 0, percent: 100 },
    satAvg: { filled: 2, missing: 1, percent: 67 },
  },
  tierDistribution: {
    reach: { count: 1, percent: 33 },
    target: { count: 1, percent: 33 },
    safety: { count: 1, percent: 33 },
  },
  predictionEligibleCoverage: {
    cs: { eligible: 2, total: 3, percent: 67 },
  },
  top200OfficialCoverage: {
    schools: 3,
    covered: 2,
    totalSlots: 3,
    percent: 67,
    threshold: 80,
  },
  staleFields: [
    {
      schoolId: 'e2e-purdue',
      schoolName: 'Purdue University',
      schoolNameZh: '普渡大学',
      field: 'satAvg',
      tier: 'target',
      source: 'E2E fixture',
      fetchedAt: new Date('2025-08-01T12:00:00Z').toISOString(),
      staleness: 'old',
      usNewsRank: 46,
    },
  ],
  worstSchools: [
    {
      id: 'e2e-purdue',
      name: 'Purdue University',
      nameZh: '普渡大学',
      usNewsRank: 46,
      missingFields: ['satAvg'],
      completeness: 74,
    },
  ],
};

const E2E_ACTIVITY_TEMPLATES = [
  {
    id: 'e2e-activity-template',
    name: 'Research Assistantship',
    nameZh: '科研助理',
    aliases: ['lab assistant', 'research'],
    category: 'RESEARCH',
    tier: 2,
    description: 'Structured research work with a faculty mentor.',
    isActive: true,
  },
];

const E2E_HIGH_SCHOOLS = [
  {
    id: 'e2e-high-school',
    name: 'Shanghai Lumni International School',
    nameZh: '上海 Lumni 国际学校',
    country: 'CN',
    state: '上海',
    type: 'INTL_CN',
    tier: 4,
    recognition: 4,
    academicRigor: 4,
    qualityScore: 88,
    qualityGrade: 'A',
    description: 'IB and AP curriculum with a steady Top 30 admissions history.',
    evaluatedAt: new Date('2026-04-10T12:00:00Z').toISOString(),
  },
];

const E2E_CDS_COVERAGE = {
  generatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  totals: {
    schools: E2E_SCHOOLS.length,
    schoolsWithAnyCells: 2,
    schoolsReady: 1,
    prioritySchools: 2,
    priorityReady: 1,
    totalCells: 8,
  },
  items: E2E_SCHOOLS.map((school, index) => ({
    schoolId: school.id,
    schoolName: school.name,
    schoolNameZh: school.nameZh,
    schoolNameNorm: school.slug,
    usNewsRank: school.usNewsRank,
    acceptanceRate: school.acceptanceRate,
    priority: index < 2,
    cellCount: index === 0 ? 6 : 2,
    ready: index === 0,
    latestCycleYear: 2026,
    lastUpdatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  })),
};

const E2E_CDS_ROWS = [
  {
    id: 'e2e-cds-row',
    schoolId: E2E_SCHOOLS[0].id,
    school: {
      id: E2E_SCHOOLS[0].id,
      name: E2E_SCHOOLS[0].name,
      nameZh: E2E_SCHOOLS[0].nameZh,
      usNewsRank: E2E_SCHOOLS[0].usNewsRank,
    },
    gpaBand: '3.8-4.0',
    testType: 'SAT',
    testBand: '1500-1600',
    admitRate: 0.14,
    sampleCount: 32,
    cycleYear: 2026,
    source: 'CDS',
    sourceUrl: 'https://example.edu/cds',
    updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  },
];

const E2E_DATA_COVERAGE = {
  generatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  criticalFields: ['acceptanceRate', 'tuition', 'satAvg'],
  optionalFields: ['studentFacultyRatio'],
  totals: {
    schools: E2E_SCHOOLS.length,
    criticalComplete: 2,
    missingAnyCritical: 1,
    heuristicOnlySchools: 1,
    terminalStatusSchools: 0,
    staleCriticalSchools: 1,
    officialFields: 6,
    heuristicFields: 2,
    terminalFields: 0,
    staleFields: 1,
  },
  fieldTotals: {
    acceptanceRate: {
      total: 3,
      filled: 3,
      percent: 100,
      predictionEligible: 3,
      predictionEligiblePercent: 100,
      official: 2,
      heuristic: 1,
      terminal: 0,
      stale: 0,
    },
    satAvg: {
      total: 3,
      filled: 2,
      percent: 67,
      predictionEligible: 2,
      predictionEligiblePercent: 67,
      official: 1,
      heuristic: 1,
      terminal: 0,
      stale: 1,
    },
  },
  bucketCounts: { official: 6, heuristic: 2, stale: 1, missing: 1 },
  items: [
    {
      schoolId: E2E_SCHOOLS[2].id,
      schoolName: E2E_SCHOOLS[2].name,
      schoolNameZh: E2E_SCHOOLS[2].nameZh,
      usNewsRank: E2E_SCHOOLS[2].usNewsRank,
      criticalComplete: false,
      missingCritical: ['satAvg'],
      heuristicCritical: ['acceptanceRate'],
      terminalCritical: [],
      staleCritical: ['tuition'],
      fields: [
        {
          field: 'acceptanceRate',
          value: 53,
          filled: true,
          explicitUnknown: false,
          source: 'E2E fixture',
          tier: 'heuristic',
          confidence: 0.8,
          sourceUrl: 'https://example.edu/data',
          cycleYear: 2026,
          validatorCount: 2,
          originalFormula: null,
          realDataStatus: null,
          terminalStatus: null,
          reason: null,
          staleness: null,
          predictionEligible: true,
          isOfficial: false,
          isHeuristic: true,
          isTerminal: false,
          bucket: 'heuristic',
        },
      ],
    },
  ],
};

const E2E_CALIBRATION_STATS = {
  totalCalibrations: 3,
  averageMultiplier: 1.04,
  boostedCount: 1,
  reducedCount: 1,
  totalPredictions: 128,
  withActualResults: 42,
  verifiedSampleCount: 42,
  brierScore: 0.18,
  ece: 0.05,
  calibrationBuckets: [
    { predictedRange: '0-20%', actualAdmitRate: 0.16, count: 24 },
    { predictedRange: '40-60%', actualAdmitRate: 0.48, count: 18 },
  ],
};

const E2E_CALIBRATION_SUGGESTIONS = [
  {
    schoolId: E2E_SCHOOLS[2].id,
    schoolName: E2E_SCHOOLS[2].name,
    schoolNameZh: E2E_SCHOOLS[2].nameZh,
    usNewsRank: E2E_SCHOOLS[2].usNewsRank,
    predictionCount: 18,
    avgPredicted: 0.47,
    actualAdmitRate: 0.53,
    drift: 0.06,
    suggestedMultiplier: 1.08,
  },
];

const E2E_CALIBRATIONS = [
  {
    id: 'e2e-calibration',
    schoolId: E2E_SCHOOLS[2].id,
    school: E2E_SCHOOLS[2],
    multiplier: 1.08,
    reason: 'E2E calibrated target school sample.',
    createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
    updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  },
];

const E2E_APPLICATION_ANALYSIS_POLICY = {
  id: 'e2e-aa-policy',
  version: 'policy-e2e-v1',
  analysisVersion: 'application-analysis-v2',
  promptVersion: 'application-analysis-prompt-v2',
  ruleBundleVersion: 'application-analysis-rules-v2',
  status: 'ACTIVE',
  createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
};

const E2E_APPLICATION_ANALYSIS_EXPERIMENT = {
  id: 'e2e-aa-experiment',
  capability: 'RECOURSE',
  version: 'recourse-e2e-v1',
  methodVersion: 'method-v1',
  status: 'CANARY',
  policyVersionId: E2E_APPLICATION_ANALYSIS_POLICY.id,
  policyVersion: E2E_APPLICATION_ANALYSIS_POLICY,
  rolloutConfig: { rolloutPercentages: [5, 25, 100], currentPercentage: 5 },
  monitoringConfig: { latestSweepAt: new Date('2026-04-20T12:00:00Z').toISOString() },
  createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
};

const E2E_REVIEW_QUEUE_ITEM = {
  id: 'e2e-staging-review',
  dataType: 'CASE',
  source: 'manual',
  status: 'PENDING',
  rawData: {
    schoolName: 'Purdue University',
    result: 'ADMITTED',
    major: 'Computer Science',
    year: 2026,
  },
  createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
};

const E2E_VERIFICATION = {
  id: 'e2e-verification',
  userId: E2E_USER.id,
  caseId: E2E_CASES[0].id,
  proofType: 'offer_letter',
  proofUrl: '',
  status: 'PENDING',
  createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  user: {
    email: E2E_USER.email,
    profile: { nickname: E2E_USER.name, avatarUrl: null },
  },
  case: {
    school: { name: E2E_SCHOOLS[2].name, nameZh: E2E_SCHOOLS[2].nameZh },
    admissionResult: 'ADMITTED',
  },
};

const E2E_MEMORY_ITEM = {
  id: 'e2e-memory',
  userId: E2E_USER.id,
  type: 'FACT',
  category: 'school_list',
  content: 'Purdue is the cleanest near-term submission window.',
  importance: 0.82,
  accessCount: 3,
  lastAccessedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  metadata: { source: 'e2e' },
  createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
};

const E2E_RECOMMENDATION = {
  id: 'e2e-recommendation',
  summary:
    'Balanced list calibrated for Computer Science with one reach, one target, and one safety.',
  recommendations: E2E_SCHOOLS.map((school, index) => ({
    schoolId: school.id,
    schoolName: school.name,
    tier: index === 0 ? 'reach' : index === 1 ? 'match' : 'safety',
    fitScore: [88, 82, 76][index] ?? 72,
    estimatedProbability: [14, 47, 81][index] ?? 50,
    reasons: ['Strong program fit', 'Clear essay angle', 'Deadline fits the current timeline'],
    concerns: index === 0 ? ['Highly selective program'] : [],
    schoolMeta: {
      nameZh: school.nameZh,
      acceptanceRate: school.acceptanceRate,
      website: 'https://example.com',
    },
  })),
  analysis: {
    strengths: ['Strong academic profile', 'Focused CS activities'],
    weaknesses: ['Reach schools need sharper school-specific evidence'],
    improvementTips: ['Add one school-specific faculty or lab detail to each reach essay'],
    strategy: ['Submit Purdue first', 'Keep one safer engineering option'],
  },
  createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
};

const E2E_AI_ANALYSIS: any = {
  status: 'fresh',
  meta: {
    analysisVersion: 'application-analysis-v2',
    state: 'ready',
    dataQuality: 'high',
    targetSchoolCount: 3,
    focusSchoolCount: 3,
    schoolsWithPredictions: 3,
    generatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
    traceId: 'e2e-analysis-trace',
    runId: 'e2e-analysis-run',
  },
  profileSummary: {
    applicantType: 'international',
    intendedMajors: ['Computer Science'],
    testStrategy: 'submit',
    contextFlags: ['testSubmit'],
    constraints: ['International applicant with a STEM-heavy profile.'],
    grade: 'SENIOR',
    educationSystem: 'AP',
    nationality: 'China',
    citizenship: 'China',
    countryOfResidence: 'United States',
    highSchoolContext: 'Competitive international high school with AP curriculum.',
  },
  portfolioSummary: {
    verdict: 'The list is balanced with clear reach, target, and safety coverage.',
    balance: 'balanced',
    keyReasons: ['School tiers are distributed across the list.', 'Purdue is ready to submit.'],
    riskBoundaries: ['Reach schools need sharper evidence.'],
  },
  schools: E2E_SCHOOLS.map((school, index) => ({
    schoolId: school.id,
    schoolName: school.name,
    tier: index === 0 ? 'REACH' : index === 1 ? 'TARGET' : 'SAFETY',
    round: 'RD',
    prediction: {
      probability: [0.14, 0.47, 0.81][index] ?? 0.5,
      probabilityLow: [0.1, 0.4, 0.74][index] ?? 0.4,
      probabilityHigh: [0.2, 0.55, 0.88][index] ?? 0.6,
      tier: index === 0 ? 'reach' : index === 1 ? 'match' : 'safety',
      confidence: 'medium',
      updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
      roundContext: 'RD',
    },
    policyCard: {
      testingPolicy: school.testingPolicy,
      intlAidPolicy: 'NEED_AWARE',
      roundContext: 'RD',
      policySourceQuality: 'DERIVED',
      standardDeadline: 'January 1',
      evidenceIds: [],
      sources: [],
      unknowns: [],
    },
    assessment: {
      summary: `${school.name} is calibrated for the current list.`,
      whyThisIsHard: ['Selective applicant pool.'],
      compensatingStrengths: ['Strong academic profile.', 'Clear CS activity spine.'],
      topGaps: ['Add one school-specific detail.'],
      nextActions: ['Confirm submission window.'],
      historicalSignals: ['Similar profiles have been competitive.'],
      hardStopRisks: [],
    },
    evidenceIds: [],
    unknowns: [],
  })),
  schoolCards: [],
  topReasons: ['Balanced tier coverage', 'Submission timing is clear'],
  topRisks: ['Reach essays need specific evidence'],
  actionPlan: {
    now: ['Submit Purdue first', 'Polish Georgia Tech essay'],
    next90Days: ['Add one verifiable CS project update'],
    beforeSubmission: ['Re-check deadlines and recommendations'],
  },
  nextActions: ['Confirm the Purdue submission window', 'Review model evidence'],
  unknowns: [],
  evidenceSummary: [
    {
      type: 'DERIVED_JUDGMENT',
      label: 'Portfolio balance',
      detail: 'The school list spans reach, target, and safety tiers.',
    },
  ],
  confidenceSummary: {
    level: 'medium',
    summary: 'Enough structured data is available for a stable read.',
    signals: ['School list', 'Academic profile', 'Submission timeline'],
  },
  freshnessSummary: {
    status: 'fresh',
    summary: 'Generated from current E2E fixture data.',
    generatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  },
};

E2E_AI_ANALYSIS.schoolCards = E2E_AI_ANALYSIS.schools;

const E2E_ASSESSMENT = {
  id: 'e2e-assessment',
  type: 'MBTI',
  title: 'Jungian Type Personality Test',
  titleZh: '荣格类型性格测试',
  description: 'Discover your personality type.',
  descriptionZh: '发现你的性格类型。',
  questions: [
    {
      id: 'q1',
      text: 'I enjoy turning ambiguous goals into a concrete plan.',
      textZh: 'I enjoy turning ambiguous goals into a concrete plan.',
      options: [
        { value: '1', label: 'Strongly disagree', textZh: 'Strongly disagree' },
        { value: '3', label: 'Neutral', textZh: 'Neutral' },
        { value: '5', label: 'Strongly agree', textZh: 'Strongly agree' },
      ],
    },
  ],
};

const E2E_ASSESSMENT_RESULT_MBTI = {
  id: 'e2e-mbti-result',
  type: 'MBTI',
  mbtiResult: {
    type: 'INTJ',
    scores: { E: 35, I: 65, S: 42, N: 58, T: 68, F: 32, J: 61, P: 39 },
    title: 'Architect',
    titleZh: '战略规划者',
    description: 'Strategic, independent, and systems-oriented.',
    descriptionZh: '擅长长期规划、独立思考和系统化分析。',
    strengths: ['Strategic thinking', 'Independent learning'],
    careers: ['Product strategist', 'Research engineer'],
    majors: ['Computer Science', 'Data Science', 'Cognitive Science'],
  },
  completedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
};

const E2E_ASSESSMENT_RESULT_HOLLAND = {
  id: 'e2e-holland-result',
  type: 'HOLLAND',
  hollandResult: {
    codes: 'IAS',
    scores: { R: 9, I: 22, A: 16, S: 14, E: 10, C: 8 },
    types: ['Investigative', 'Artistic', 'Social'],
    typesZh: ['研究型', '艺术型', '社会型'],
    fields: ['Science', 'Design', 'Education'],
    fieldsZh: ['科学研究', '设计创意', '教育咨询'],
    majors: ['Computer Science', 'Human-Computer Interaction', 'Psychology'],
  },
  completedAt: new Date('2026-04-22T12:00:00Z').toISOString(),
};

const E2E_SWIPE_CASE = {
  id: 'e2e-swipe-case',
  schoolName: 'Purdue University',
  schoolNameZh: '普渡大学',
  year: 2026,
  round: 'RD',
  major: 'Computer Science',
  gpaRange: '3.9-4.0',
  satRange: '1500-1550',
  tags: ['CS', 'Engineering'],
  isVerified: true,
  usNewsRank: 46,
  acceptanceRate: 53,
  schoolState: 'IN',
  schoolCity: 'West Lafayette',
};

const E2E_HALL_CHALLENGE = {
  applicantProfile: {
    grade: 'Senior',
    schoolType: 'International',
    gpa: '3.92',
    sat: '1540',
    toefl: '112',
    activityCount: 7,
    activityHighlights: ['Research', 'Leadership', 'Community'],
    awardCount: 2,
    highestAwardLevel: 'National',
    apCount: 6,
    nationality: 'China',
    targetMajor: 'Computer Science',
  },
  schools: [
    {
      caseId: 'challenge-mit',
      schoolId: 'e2e-mit',
      schoolName: 'MIT',
      schoolNameZh: '麻省理工学院',
      usNewsRank: 2,
      acceptanceRate: 4,
      major: 'Computer Science',
      round: 'RD',
      rankings: [{ source: 'US News', list: 'National Universities', rank: 2, year: 2026 }],
    },
    {
      caseId: 'challenge-purdue',
      schoolId: 'e2e-purdue',
      schoolName: 'Purdue University',
      schoolNameZh: '普渡大学',
      usNewsRank: 46,
      acceptanceRate: 53,
      major: 'Computer Science',
      round: 'EA',
      rankings: [{ source: 'US News', list: 'National Universities', rank: 46, year: 2026 }],
    },
  ],
};

const E2E_HALL_CHALLENGE_RESULT = {
  results: [
    {
      caseId: 'challenge-mit',
      schoolName: 'MIT',
      guess: 'REJECTED',
      actual: 'REJECTED',
      isCorrect: true,
    },
    {
      caseId: 'challenge-purdue',
      schoolName: 'Purdue University',
      guess: 'ACCEPTED',
      actual: 'ACCEPTED',
      isCorrect: true,
    },
  ],
  correct: 2,
  total: 2,
  accuracy: 100,
};

function pageResult<T>(items: T[]) {
  return { items, total: items.length, page: 1, limit: 20, hasMore: false };
}

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

function responseData(data: unknown) {
  return { success: true, data };
}

function e2eThemeCertificationResult() {
  const certifiedAt = new Date('2026-04-20T12:00:00Z').toISOString();
  const modeResult = (mode: 'light' | 'dark') => ({
    mode,
    tokenCompleteness: 1,
    minimumContrastRatio: 4.8,
    requiredContrastPairs: {
      'foreground/background': 12.4,
      'primary/primary-foreground': 10.2,
    },
    issues: [],
  });

  return {
    palette: 'cobalt-saas',
    heroVisual: 'command-center',
    appearanceOverrides: {
      clarity: 0.9,
      frost: 0.18,
      glow: 0.32,
      contrast: 0.86,
    },
    status: 'passed',
    score: 96,
    tokenCompleteness: 1,
    contrastScore: 0.96,
    darkLightParity: 0.94,
    routeCoverage: 1,
    modes: {
      light: modeResult('light'),
      dark: modeResult('dark'),
    },
    buttonSurfaceAudit: [
      {
        variant: 'primary',
        mode: 'light',
        foreground: '#ffffff',
        background: '#1f5eff',
        adjacentSurface: '#f7f9fc',
        textContrast: 10.2,
        surfaceContrast: 4.8,
        status: 'passed',
      },
      {
        variant: 'primary',
        mode: 'dark',
        foreground: '#ffffff',
        background: '#6da2ff',
        adjacentSurface: '#0f172a',
        textContrast: 9.8,
        surfaceContrast: 4.6,
        status: 'passed',
      },
    ],
    componentStateAudit: [
      {
        component: 'button',
        requiredStates: ['hover', 'active', 'focus', 'disabled', 'loading'],
        supportedStates: ['hover', 'active', 'focus', 'disabled', 'loading'],
        missingStates: [],
        status: 'passed',
      },
    ],
    contrastSummary: {
      minimumTextContrast: 4.8,
      minimumSurfaceContrast: 4.6,
      buttonVariantCount: 8,
      riskCount: 0,
    },
    routeAuditSummary: [
      {
        route: '/',
        role: 'guest',
        status: 'passed',
        viewportCoverage: ['desktop', 'mobile', 'wide'],
        issueCount: 0,
        issues: [],
      },
    ],
    issues: [],
    certifiedAt,
  };
}

function e2eThemeCertificationResponse() {
  const certification = e2eThemeCertificationResult();
  return {
    generatedAt: certification.certifiedAt,
    defaultPalette: 'cobalt-saas',
    defaultHeroVisual: 'command-center',
    total: 1,
    passed: 1,
    warning: 0,
    failed: 0,
    matrix: [
      {
        id: 'cobalt-saas:command-center',
        palette: 'cobalt-saas',
        paletteLabelZh: '钴蓝 SaaS',
        paletteLabelEn: 'Cobalt SaaS',
        heroVisual: 'command-center',
        heroVisualLabelZh: '指挥中心',
        heroVisualLabelEn: 'Command Center',
        isDefault: true,
        isBrandVisual: false,
        certification,
      },
    ],
    diagnostics: {
      requiredRouteCount: 73,
      requiredTokenCount: 32,
      buttonVariantCount: 8,
      issueCount: 0,
    },
  };
}

function e2eThemeStyleDiagnostics() {
  return {
    parseStatus: 'ok',
    checksumStatus: 'ok',
    itemCount: 1,
    discardedItemCount: 0,
    duplicateSignatureCount: 0,
    unknownPaletteCount: 0,
    unknownHeroVisualCount: 0,
    issues: [],
  };
}

function currentUser(role: FullUiRole) {
  if (role === 'admin') return E2E_ADMIN;
  if (role === 'user') return E2E_USER;
  return null;
}

function matchId(path: string, prefix: string) {
  if (!path.startsWith(prefix)) return null;
  const id = path.slice(prefix.length).split('/')[0];
  return id || null;
}

function genericListFor(path: string) {
  if (path.includes('school')) return pageResult(E2E_SCHOOLS);
  if (path.includes('case')) return pageResult(E2E_CASES);
  if (path.includes('essay')) return pageResult(E2E_ESSAYS);
  if (path.includes('team')) return pageResult(E2E_TEAMS);
  if (path.includes('resume')) return pageResult(E2E_RESUMES);
  if (path.includes('notification')) return pageResult(E2E_NOTIFICATIONS);
  if (path.includes('task') || path.includes('timeline')) return pageResult(E2E_TASKS);
  if (path.includes('user')) return pageResult([E2E_USER, E2E_ADMIN]);
  if (path.includes('audit')) {
    return pageResult([
      {
        id: 'e2e-audit',
        actor: 'Admin User',
        action: 'VIEWED',
        resource: 'settings',
        createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
      },
    ]);
  }
  return pageResult([
    {
      id: 'e2e-item',
      name: 'E2E fixture item',
      title: 'E2E fixture item',
      status: 'READY',
      createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
    },
  ]);
}

function apiData(path: string, role: FullUiRole, method: string) {
  const user = currentUser(role);

  if (method !== 'GET') {
    if (path === '/auth/refresh') {
      if (!user)
        return { status: 401, data: { success: false, error: { message: 'Unauthenticated' } } };
      return { data: responseData({ accessToken: 'e2e-access-token' }) };
    }

    if (path.startsWith('/auth/')) {
      return {
        data: responseData({
          accessToken: 'e2e-access-token',
          user: user ?? E2E_USER,
          ok: true,
        }),
      };
    }

    if (path === '/recommendations') {
      return { data: responseData(E2E_RECOMMENDATION) };
    }

    if (path === '/assessments') {
      return { data: responseData(E2E_ASSESSMENT_RESULT_MBTI) };
    }

    if (path.endsWith('/draft') && path.startsWith('/assessments/')) {
      return {
        data: responseData({
          id: 'e2e-draft',
          type: path.includes('HOLLAND') ? 'HOLLAND' : 'MBTI',
          answers: [],
          currentQuestionIndex: 0,
          updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
        }),
      };
    }

    if (path === '/halls/swipe/challenge') {
      return { data: responseData(E2E_HALL_CHALLENGE_RESULT) };
    }

    if (/^\/resumes\/[^/]+\/ai\/suggest-content$/.test(path)) {
      return {
        data: responseData({
          suggestions: [
            {
              text: 'Describe one measurable academic or community outcome.',
              category: 'impact',
              priority: 'medium',
            },
          ],
          tips: ['Lead with a concrete action and quantify the result when possible.'],
          exampleBullets: [],
        }),
      };
    }

    if (/^\/resumes\/[^/]+\/ai\/optimize-bullets$/.test(path)) {
      return {
        data: responseData({
          optimized: [],
          newSuggestions: ['Add a quantified result to this section.'],
        }),
      };
    }

    if (path === '/admin/application-analysis-workflow/experiments/sweep') {
      return {
        data: responseData({
          activated: [],
          retired: [],
          promotedToCanary: [E2E_APPLICATION_ANALYSIS_EXPERIMENT.id],
          evaluated: [E2E_APPLICATION_ANALYSIS_EXPERIMENT.id],
          failures: [],
        }),
      };
    }

    if (path === '/admin/application-analysis-workflow/experiments/recourse-preview') {
      return {
        data: responseData({
          goal: 'Improve Purdue readiness without changing the school list.',
          recommendedChanges: [
            { action: 'Add evidence', rationale: 'One school-specific lab detail improves fit.' },
          ],
          constraints: ['No guarantee of admission'],
          whyNotGuaranteed: 'Admissions outcomes remain probabilistic.',
        }),
      };
    }

    if (path === '/admin/application-analysis-workflow/experiments/uncertainty-preview') {
      return {
        data: responseData({
          intervalLabel: 'Likely range',
          probabilityLow: 0.4,
          probabilityHigh: 0.55,
          reasons: ['Comparable historical outcomes are moderately dense.'],
        }),
      };
    }

    return { data: responseData({ id: 'e2e-result', ok: true, status: 'OK' }) };
  }

  if (path === '/users/me' || path === '/auth/me') {
    if (!user)
      return { status: 401, data: { success: false, error: { message: 'Unauthenticated' } } };
    return { data: responseData(user) };
  }

  if (path === '/admin/cache-health') {
    return {
      data: responseData({
        connection: {
          connected: true,
          status: 'ok',
          latencyMs: 4,
        },
        podStartedAt: new Date('2026-04-20T10:00:00Z').toISOString(),
        uptimeMs: 7_200_000,
        totals: {
          totalOps: 12,
          totalErrors: 0,
          totalHits: 8,
          totalMisses: 2,
          overallHitRatio: 0.8,
          errorRate: 0,
        },
        ops: [],
        hotKeys: [],
        errorsByKind: {},
        recentErrors: [],
      }),
    };
  }

  if (path === '/admin/essay-gallery-ai/metrics') {
    return {
      data: responseData({
        generatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
        totals: {
          interactions: 12,
          questions: 8,
          compares: 4,
          succeeded: 11,
          failed: 1,
          refunded: 1,
          feedback: 6,
          helpful: 5,
          notHelpful: 1,
        },
        rates: {
          helpfulRate: 5 / 6,
          failureRate: 1 / 12,
        },
        tokens: { average: 640 },
        learningNotes: {
          publicEssayCount: 10,
          readyCount: 8,
          missingCount: 2,
          missingRate: 0.2,
        },
        feedbackByCategory: [{ category: 'wrong_evidence', count: 1 }],
        recentNotHelpful: [
          {
            interactionId: 'e2e-gallery-interaction',
            essayId: E2E_ESSAYS[0].id,
            type: 'question',
            category: 'wrong_evidence',
            notes: 'The explanation needs a more specific reference to the essay.',
            createdAt: new Date('2026-04-19T12:00:00Z').toISOString(),
          },
        ],
        topFailingEssays: [{ essayId: E2E_ESSAYS[0].id, failed: 1, total: 4 }],
      }),
    };
  }

  if (path === '/admin/schools/data-health') {
    return {
      data: responseData({
        generatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
        focus: 'intl',
        totalSchoolsConsidered: E2E_SCHOOLS.length,
        rowsReturned: 1,
        rows: [
          {
            schoolId: E2E_SCHOOLS[0].id,
            schoolName: E2E_SCHOOLS[0].name,
            schoolNameZh: E2E_SCHOOLS[0].nameZh,
            usNewsRank: E2E_SCHOOLS[0].usNewsRank,
            country: E2E_SCHOOLS[0].country,
            state: E2E_SCHOOLS[0].state,
            gapFields: [{ field: 'intlAcceptanceRate', bucket: 'missing', weight: 1 }],
            importanceWeight: 1,
            gapWeight: 1,
            priorityScore: 1,
          },
        ],
        totalsByField: [
          {
            field: 'intlAcceptanceRate',
            missing: 1,
            heuristic: 0,
            stale: 0,
            terminal: 0,
            official: 2,
          },
        ],
      }),
    };
  }

  if (path === '/admin/predictions/outcomes/pending-verification') {
    return { data: responseData([]) };
  }

  if (path === '/users/me/dashboard') {
    return {
      data: responseData({
        user: {
          email: user?.email ?? E2E_USER.email,
          role: user?.role ?? 'USER',
          points: 240,
          createdAt: new Date('2026-01-15T12:00:00Z').toISOString(),
          nickname: 'Amy',
        },
        profile: {
          completeness: 82,
          hasTestScores: true,
          hasActivities: true,
          hasAwards: false,
          targetSchoolCount: 6,
          essayCount: 14,
          schoolTiers: { reach: 2, target: 3, safety: 1 },
        },
        stats: { followers: 18, following: 9, cases: 2, predictions: 6 },
        pendingTasks: {
          total: 3,
          byType: [{ type: 'essay', count: 2 }],
          profileGaps: ['Add awards', 'Confirm recommender'],
        },
        upcomingDeadlines: [
          {
            id: 'deadline-purdue',
            schoolName: 'Purdue University',
            round: 'Regular Decision',
            deadline: new Date('2026-05-15T12:00:00Z').toISOString(),
            daysLeft: 15,
          },
        ],
        upcomingPersonalEvents: [
          {
            id: 'event-rec',
            title: 'Recommendation letter follow-up',
            category: 'Recommendation',
            deadline: new Date('2026-05-10T12:00:00Z').toISOString(),
            eventDate: null,
            daysLeft: 10,
          },
        ],
        recentActivity: [
          {
            type: 'essay',
            title: 'Essay updated',
            description: 'CMU essay moved to rewriting v2.',
            createdAt: new Date('2026-04-28T12:00:00Z').toISOString(),
          },
        ],
        workbench: {
          readiness: {
            score: 86,
            status: 'attention',
            items: [
              {
                key: 'profile',
                label: 'Profile',
                value: '82%',
                status: 'attention',
                href: '/profile',
                description: '2 key signals still need attention',
              },
              {
                key: 'schools',
                label: 'School list',
                value: '6',
                status: 'ready',
                href: '/schools',
                description: 'Reach, target, and safety mix is in place',
              },
              {
                key: 'essays',
                label: 'Essays',
                value: '14',
                status: 'ready',
                href: '/essays',
                description: 'Essay drafts are ready to continue',
              },
              {
                key: 'timeline',
                label: 'Timeline',
                value: '3',
                status: 'attention',
                href: '/timeline',
                description: 'Application milestones are in one planning rhythm',
              },
            ],
          },
          metrics: {
            due7: 0,
            due30: 2,
            overdueTasks: 0,
            missingTimelineCount: 1,
            balancedSchoolList: true,
          },
          priorityQueue: [
            {
              id: 'task-e2e',
              kind: 'timeline-task',
              severity: 'warning',
              title: 'Finalize Purdue supplement',
              description: 'Purdue University · Regular Decision · 15 days left',
              href: '/timeline?task=task-e2e',
              dueAt: new Date('2026-05-15T12:00:00Z').toISOString(),
              daysLeft: 15,
              mutation: {
                type: 'timeline-task-toggle',
                endpoint: '/timelines/tasks/task-e2e/toggle',
              },
            },
            {
              id: 'profile-gaps',
              kind: 'profile',
              severity: 'warning',
              title: 'Complete applicant profile',
              description: 'Prioritize 2 signals that affect prediction and school strategy.',
              href: '/profile',
            },
          ],
          deadlineStream: [
            {
              id: 'event-rec',
              type: 'event',
              title: 'Recommendation letter follow-up',
              subtitle: 'Recommendation',
              dueAt: new Date('2026-05-10T12:00:00Z').toISOString(),
              daysLeft: 10,
              severity: 'warning',
              href: '/timeline?tab=personal',
            },
            {
              id: 'deadline-purdue',
              type: 'school',
              title: 'Purdue University',
              subtitle: 'Regular Decision',
              dueAt: new Date('2026-05-15T12:00:00Z').toISOString(),
              daysLeft: 15,
              severity: 'normal',
              href: '/timeline',
            },
          ],
        },
      }),
    };
  }

  if (path === '/users/me/referral') {
    return {
      data: responseData({
        referralCode: 'LUMNI-E2E',
        referralLink: 'https://example.com/register?ref=LUMNI-E2E',
        referralCount: 1,
        totalPointsEarned: 50,
      }),
    };
  }

  if (path === '/users/me/referrals') {
    return {
      data: responseData({
        referrals: [
          {
            id: 'e2e-referral',
            email: 'friend@example.com',
            joinedAt: new Date('2026-04-18T12:00:00Z').toISOString(),
            pointsEarned: 50,
          },
        ],
      }),
    };
  }

  if (path === '/schools/countries') {
    return {
      data: responseData([{ code: 'US', name: 'United States', count: E2E_SCHOOLS.length }]),
    };
  }

  if (path === '/schools/compare') {
    return { data: responseData(E2E_SCHOOLS.slice(0, 2)) };
  }

  if (path === '/schools') {
    return { data: responseData(pageResult(E2E_SCHOOLS)) };
  }

  if (path === '/schools/admin/logo-fill-status') {
    return { data: responseData({ configured: true }) };
  }

  if (path === '/schools/admin/data-quality') {
    return { data: responseData(E2E_SCHOOL_QUALITY) };
  }

  if (path === '/schools/admin/fill-logos-by-domain') {
    return { data: responseData({ filled: 2, failed: 0, skipped: 1 }) };
  }

  const schoolId = matchId(path, '/schools/');
  if (schoolId) {
    return {
      data: responseData(E2E_SCHOOLS.find((school) => school.id === schoolId) ?? E2E_SCHOOLS[0]),
    };
  }

  if (path === '/school-lists') {
    return { data: responseData(E2E_SCHOOL_LIST_ITEMS) };
  }

  if (path === '/cases/me') {
    return { data: responseData(E2E_CASES) };
  }

  if (path === '/cases' || path === '/cases/public') {
    return { data: responseData(pageResult(E2E_CASES)) };
  }

  const essayCaseId = matchId(path, '/cases/essays/');
  if (essayCaseId) {
    return {
      data: responseData(E2E_ESSAYS.find((essay) => essay.id === essayCaseId) ?? E2E_ESSAYS[0]),
    };
  }

  const caseId = matchId(path, '/cases/');
  if (caseId) {
    return {
      data: responseData(E2E_CASES.find((admitCase) => admitCase.id === caseId) ?? E2E_CASES[0]),
    };
  }

  if (path === '/essay-ai/gallery') {
    return { data: responseData(pageResult(E2E_ESSAYS)) };
  }

  if (path.startsWith('/essay-ai/gallery/')) {
    const essayId = matchId(path, '/essay-ai/gallery/');
    return {
      data: responseData(E2E_ESSAYS.find((essay) => essay.id === essayId) ?? E2E_ESSAYS[0]),
    };
  }

  if (path.startsWith('/essay-ai')) {
    return { data: responseData(E2E_ESSAYS) };
  }

  if (path === '/profiles/me/ai-analysis') {
    return { data: responseData(E2E_AI_ANALYSIS) };
  }

  if (path === '/profiles/me/essays') {
    return { data: responseData(E2E_ESSAYS) };
  }

  if (path.startsWith('/profiles/me/')) {
    return { data: responseData([]) };
  }

  if (path === '/profiles/me' || path === '/profile' || path.startsWith('/profile/')) {
    return {
      data: responseData({
        ...E2E_USER,
        gpa: 3.92,
        sat: 1540,
        intendedMajor: 'Computer Science',
        targetYear: 2026,
        activities: [{ id: 'research', name: 'AI research assistant' }],
      }),
    };
  }

  if (path.startsWith('/recommendations/preflight')) {
    return {
      data: responseData({
        canGenerate: true,
        points: 240,
        profileComplete: true,
        missingFields: [],
        profileSummary: { gpa: 3.92, testCount: 1, activityCount: 3 },
      }),
    };
  }

  if (path.startsWith('/recommendations/history')) {
    return { data: responseData([E2E_RECOMMENDATION]) };
  }

  if (path === '/predictions/outcomes/pending-decisions') {
    return {
      data: responseData([
        {
          predictionResultId: 'e2e-prediction-purdue',
          schoolId: E2E_SCHOOLS[2].id,
          schoolName: E2E_SCHOOLS[2].name,
          probability: 0.81,
          tier: 'safety',
          applicationRound: 'RD',
          predictedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
        },
      ]),
    };
  }

  if (path === '/predictions/outcomes/me') {
    return {
      data: responseData([
        {
          id: 'e2e-outcome',
          predictionResultId: 'e2e-prediction-purdue',
          result: 'ADMITTED',
          status: 'SELF_REPORTED',
          notes: 'E2E reported outcome',
          evidenceUrl: null,
          round: 'RD',
          isFinal: true,
          createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          schoolName: E2E_SCHOOLS[2].name,
          predictionProbability: 0.81,
        },
      ]),
    };
  }

  if (path === '/predictions/outcomes/me/stats') {
    return {
      data: responseData({ totalReported: 1, selfReported: 1, verified: 0 }),
    };
  }

  if (path.startsWith('/prediction')) {
    return {
      data: responseData({
        readiness: 82,
        schools: E2E_SCHOOLS.map((school, index) => ({
          schoolId: school.id,
          schoolName: school.name,
          probability: [14, 47, 81][index] ?? 50,
          band: index === 0 ? 'Reach' : index === 1 ? 'Target' : 'Safety',
        })),
      }),
    };
  }

  if (path === '/subscriptions/me') {
    return {
      data: responseData({
        plan: 'PRO',
        planDetails: { name: 'Pro' },
        startDate: new Date('2026-01-15T12:00:00Z').toISOString(),
        endDate: null,
        isActive: true,
      }),
    };
  }

  if (path === '/subscriptions/billing-history') {
    return {
      data: responseData([
        {
          id: 'e2e-invoice',
          plan: 'PRO',
          amount: 9900,
          currency: 'CNY',
          status: 'SUCCESS',
          description: 'Lumni Pro monthly plan',
          createdAt: new Date('2026-04-15T12:00:00Z').toISOString(),
        },
      ]),
    };
  }

  if (path === '/subscriptions/plans') {
    return { data: responseData([]) };
  }

  const settingsCategory = matchId(path, '/settings/category/');
  if (settingsCategory) {
    return {
      data: responseData(
        E2E_SYSTEM_SETTINGS.filter((setting) => setting.category === settingsCategory)
      ),
    };
  }

  if (path === '/settings') {
    return { data: responseData(E2E_SYSTEM_SETTINGS) };
  }

  const settingKey = matchId(path, '/settings/');
  if (settingKey) {
    return {
      data: responseData(E2E_SYSTEM_SETTINGS.find((setting) => setting.key === settingKey)),
    };
  }

  if (path === '/resumes') {
    return { data: responseData(E2E_RESUMES) };
  }

  // Resume workbench collection endpoints must remain arrays. Returning a generic
  // resume object here hides API-shape regressions and crashes array consumers.
  if (path === '/resume/targets') {
    return {
      data: responseData([
        {
          id: 'e2e-resume-target',
          userId: E2E_USER.id,
          type: 'STUDY_ABROAD',
          status: 'ACTIVE',
          title: 'Purdue Computer Science',
          school: 'Purdue University',
          program: 'Computer Science',
          major: 'Computer Science',
          applicationRound: 'RD',
          keywords: ['research', 'leadership'],
          requirements: {},
          metadata: {},
          createdAt: new Date('2026-04-01T12:00:00Z').toISOString(),
          updatedAt: new Date('2026-04-15T12:00:00Z').toISOString(),
        },
      ]),
    };
  }

  if (path === '/resume/evidence') {
    return { data: responseData([]) };
  }

  if (/^\/resumes\/[^/]+\/snapshots$/.test(path)) {
    return {
      data: responseData([
        {
          id: 'e2e-resume-snapshot',
          version: 1,
          description: 'Initial profile import',
          createdAt: new Date('2026-04-19T12:00:00Z').toISOString(),
        },
      ]),
    };
  }

  if (/^\/resumes\/[^/]+\/quality$/.test(path)) {
    return {
      data: responseData({
        score: 72,
        family: 'STUDY_ABROAD',
        rubricVersion: '2026-04',
        dimensions: [],
        gaps: [],
        updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
      }),
    };
  }

  if (
    /^\/resumes\/[^/]+\/(?:ai\/issues|comments|exports)$/.test(path) ||
    /^\/resumes\/[^/]+\/ai\/reviews$/.test(path)
  ) {
    return { data: responseData([]) };
  }

  if (/^\/resumes\/[^/]+\/ai\/reviews\/latest$/.test(path)) {
    return { data: responseData(null) };
  }

  const resumeId = matchId(path, '/resumes/') ?? matchId(path, '/resume/');
  if (resumeId) {
    return {
      data: responseData(E2E_RESUMES.find((resume) => resume.id === resumeId) ?? E2E_RESUMES[0]),
    };
  }

  const e2eVaultItem = {
    id: 'e2e-vault-item',
    type: 'CREDENTIAL',
    title: 'Application portal',
    category: 'Applications',
    tags: ['admissions'],
    icon: null,
    createdAt: new Date('2026-04-18T12:00:00Z').toISOString(),
    updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
  };

  if (path === '/vaults') {
    return { data: responseData([e2eVaultItem]) };
  }

  if (path === '/vaults/stats') {
    return {
      data: responseData({
        totalItems: 1,
        credentialCount: 1,
        documentCount: 0,
        noteCount: 0,
        certificateCount: 0,
        categories: ['Applications'],
      }),
    };
  }

  if (path === '/vaults/generate-password') {
    return { data: responseData({ password: 'E2E-secure-password-42!' }) };
  }

  if (path === `/vaults/${e2eVaultItem.id}`) {
    return {
      data: responseData({ ...e2eVaultItem, data: 'username=e2e@example.com' }),
    };
  }

  if (path === '/chats/unread-count') {
    return { data: responseData({ count: 1 }) };
  }

  if (path === '/chats/conversations') {
    return { data: responseData(E2E_CONVERSATIONS) };
  }

  if (path === '/chats/social/overview') {
    return {
      data: responseData({
        counts: { followers: 1, following: 1, mutual: 1, blocked: 0 },
        recommendations: E2E_RECOMMENDED_USERS,
      }),
    };
  }

  if (path === '/chats/social/relations') {
    return { data: responseData(pageResult(E2E_SOCIAL_RELATIONS)) };
  }

  if (path === '/chats/social/bulk') {
    return {
      data: responseData({
        action: 'follow',
        results: [{ userId: E2E_RECOMMENDED_USERS[0].id, success: true }],
      }),
    };
  }

  if (path.startsWith('/chats/conversations/') && path.endsWith('/context')) {
    return { data: responseData(E2E_CHAT_CONTEXT) };
  }

  if (path.startsWith('/chats/conversations/') && path.endsWith('/messages')) {
    return { data: responseData(E2E_MESSAGES) };
  }

  if (path === '/chats/followers') {
    return { data: responseData(E2E_FOLLOWERS) };
  }

  if (path === '/chats/following') {
    return { data: responseData(E2E_FOLLOWING) };
  }

  if (path === '/chats/blocked') {
    return { data: responseData([]) };
  }

  if (path === '/chats/recommendations') {
    return { data: responseData(E2E_RECOMMENDED_USERS) };
  }

  if (path === '/halls/swipe/challenge') {
    return { data: responseData(E2E_HALL_CHALLENGE) };
  }

  if (path === '/halls/swipe/batch') {
    return {
      data: responseData({
        cases: [E2E_SWIPE_CASE],
        meta: { totalAvailable: 1, totalSwiped: 0, hasMore: false },
      }),
    };
  }

  if (path === '/halls/swipe/stats') {
    return {
      data: responseData({
        totalSwipes: 12,
        correctCount: 9,
        accuracy: 75,
        currentStreak: 3,
        bestStreak: 5,
        badge: 'bronze',
        toNextBadge: 4,
        dailyChallengeCount: 1,
        dailyChallengeTarget: 5,
      }),
    };
  }

  if (path === '/halls/swipe/leaderboard') {
    return {
      data: responseData({
        entries: [
          {
            rank: 1,
            userId: E2E_USER.id,
            userName: 'Amy Zhang',
            accuracy: 75,
            totalSwipes: 12,
            correctCount: 9,
            badge: 'bronze',
            isCurrentUser: true,
          },
        ],
      }),
    };
  }

  if (path === '/halls/lists') {
    return { data: responseData({ items: [] }) };
  }

  if (path === '/halls/verified-ranking/years') {
    return { data: responseData([2026, 2025]) };
  }

  if (path === '/halls/verified-ranking') {
    return {
      data: responseData({
        users: [
          {
            rank: 1,
            caseId: 'verified-purdue',
            userId: E2E_USER.id,
            userName: 'Amy Zhang',
            gpaRange: '3.9-4.0',
            satRange: '1500-1550',
            toeflRange: '110-120',
            schoolName: 'Purdue University',
            schoolNameZh: '普渡大学',
            schoolRank: 46,
            result: 'ADMITTED',
            year: 2026,
            round: 'EA',
            major: 'Computer Science',
            isVerified: true,
            verifiedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          },
        ],
        stats: {
          totalVerified: 12,
          totalAdmitted: 9,
          topSchoolsCount: 4,
          ivyCount: 1,
        },
        total: 1,
        hasMore: false,
      }),
    };
  }

  if (path === '/halls/verified/china-admit-trend') {
    return {
      data: responseData({
        schools: [
          {
            schoolId: E2E_SCHOOLS[2].id,
            schoolName: E2E_SCHOOLS[2].name,
            schoolNameZh: E2E_SCHOOLS[2].nameZh,
            schoolRank: E2E_SCHOOLS[2].usNewsRank,
            yearly: [
              { year: 2025, admitted: 4, total: 9 },
              { year: 2026, admitted: 5, total: 11 },
            ],
            reliability: 'A',
            sampleSize: 11,
          },
        ],
        lastUpdated: new Date('2026-04-20T12:00:00Z').toISOString(),
      }),
    };
  }

  if (path === '/halls/verified/difficulty-signal') {
    return {
      data: responseData([
        {
          schoolId: E2E_SCHOOLS[2].id,
          schoolName: E2E_SCHOOLS[2].name,
          schoolNameZh: E2E_SCHOOLS[2].nameZh,
          signal: 'stable',
          changePct: 1.1,
          sampleSize: 11,
        },
      ]),
    };
  }

  if (path.startsWith('/halls')) {
    return { data: responseData({ items: [], rankings: [], totalTargetSchools: 0 }) };
  }

  if (path === '/assessments/MBTI' || path === '/assessments/HOLLAND') {
    return {
      data: responseData({
        ...E2E_ASSESSMENT,
        type: path.endsWith('HOLLAND') ? 'HOLLAND' : 'MBTI',
      }),
    };
  }

  if (path === '/assessments/summary/me') {
    return {
      data: responseData({
        latestMbti: E2E_ASSESSMENT_RESULT_MBTI,
        latestHolland: E2E_ASSESSMENT_RESULT_HOLLAND,
        drafts: [],
        historyCount: 2,
        completedTypes: ['MBTI', 'HOLLAND'],
        majorSuggestions: [
          { major: 'Computer Science', sources: ['MBTI', 'HOLLAND'] },
          { major: 'Human-Computer Interaction', sources: ['HOLLAND'] },
          { major: 'Data Science', sources: ['MBTI'] },
        ],
      }),
    };
  }

  if (path === '/assessments/MBTI/draft' || path === '/assessments/HOLLAND/draft') {
    return { data: responseData(null) };
  }

  if (path === '/assessments/history/me' || path === '/assessments/results') {
    return { data: responseData([E2E_ASSESSMENT_RESULT_HOLLAND, E2E_ASSESSMENT_RESULT_MBTI]) };
  }

  if (path === '/teams/match-pools') {
    return { data: responseData({ items: [] }) };
  }

  if (path.startsWith('/teams/match-pools/')) {
    return { data: responseData({ id: 'e2e-pool', name: 'E2E Pool', entries: [] }) };
  }

  if (path === '/teams/recruitment-contexts' || path === '/teams/community-contexts') {
    return { data: responseData({ items: [] }) };
  }

  if (path === '/teams/recruitments/me') {
    return { data: responseData({ items: [] }) };
  }

  if (path === '/teams/recruitments/deck' || path === '/teams/recruitments/deck/preview') {
    return { data: responseData({ sourceCard: null, items: [] }) };
  }

  if (path === '/teams/matches') {
    return { data: responseData({ items: [] }) };
  }

  if (path === '/teams') {
    return { data: responseData(pageResult(E2E_TEAMS)) };
  }

  const teamId = matchId(path, '/teams/');
  if (teamId) {
    return { data: responseData(E2E_TEAMS.find((team) => team.id === teamId) ?? E2E_TEAMS[0]) };
  }

  if (path === '/notifications/unread-count') {
    return {
      data: responseData({
        count: E2E_NOTIFICATIONS.filter((notification) => !notification.read).length,
      }),
    };
  }

  if (path === '/notifications') {
    return { data: responseData(E2E_NOTIFICATIONS) };
  }

  const notificationId = matchId(path, '/notifications/');
  if (notificationId) {
    return {
      data: responseData(
        E2E_NOTIFICATIONS.find((notification) => notification.id === notificationId) ??
          E2E_NOTIFICATIONS[0]
      ),
    };
  }

  if (path === '/timelines/overview') {
    return { data: responseData(E2E_TIMELINE_OVERVIEW) };
  }

  if (path === '/timelines/global-events') {
    return { data: responseData(E2E_GLOBAL_EVENTS) };
  }

  if (path === '/timelines/personal-events') {
    return { data: responseData(E2E_PERSONAL_EVENTS) };
  }

  const personalEventId = matchId(path, '/timelines/personal-events/');
  if (personalEventId) {
    const event =
      E2E_PERSONAL_EVENTS.find((item) => item.id === personalEventId) ?? E2E_PERSONAL_EVENTS[0];
    return {
      data: responseData({
        ...event,
        tasks: [
          {
            id: 'e2e-personal-task',
            eventId: event.id,
            title: 'Confirm calendar reminder',
            dueDate: event.deadline,
            completed: false,
            sortOrder: 1,
          },
        ],
      }),
    };
  }

  if (path === '/timelines') {
    return { data: responseData(E2E_TIMELINES) };
  }

  const timelineId = matchId(path, '/timelines/');
  if (timelineId) {
    const timeline = E2E_TIMELINES.find((item) => item.id === timelineId) ?? E2E_TIMELINES[0];
    return { data: responseData({ ...timeline, tasks: E2E_TIMELINE_TASKS }) };
  }

  if (path.startsWith('/timeline') || path.startsWith('/tasks')) {
    return { data: responseData(pageResult(E2E_TASKS)) };
  }

  if (path.startsWith('/application-analysis') || path.startsWith('/qa/application-analysis')) {
    return {
      data: responseData({
        id: 'e2e-analysis',
        caseId: 'e2e-case',
        status: 'READY',
        score: 86,
        summary: 'Strong academic fit with clear execution risks.',
        recommendations: ['Move Purdue to ready-to-submit', 'Confirm one recommender upload'],
      }),
    };
  }

  if (path === '/admin/users') {
    return {
      data: responseData({
        data: [
          {
            ...E2E_USER,
            displayName: E2E_USER.name,
            isBanned: false,
            bannedUntil: null,
            banReason: null,
            createdAt: new Date('2026-01-10T12:00:00Z').toISOString(),
            lastLoginAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          },
        ],
        total: 1,
        totalPages: 1,
      }),
    };
  }

  if (path === '/admin/activity-templates') {
    return {
      data: responseData({
        items: E2E_ACTIVITY_TEMPLATES,
        total: E2E_ACTIVITY_TEMPLATES.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    };
  }

  if (path === '/admin/school-deadlines') {
    return {
      data: responseData({
        data: [
          {
            id: 'e2e-deadline',
            schoolId: E2E_SCHOOLS[2].id,
            school: E2E_SCHOOLS[2],
            year: 2026,
            round: 'RD',
            applicationDeadline: new Date('2026-05-15T12:00:00Z').toISOString(),
            financialAidDeadline: new Date('2026-05-16T12:00:00Z').toISOString(),
            decisionDate: new Date('2026-06-01T12:00:00Z').toISOString(),
            essayCount: 2,
            interviewRequired: false,
            interviewFormat: null,
            interviewDeadline: null,
            applicationFee: 75,
            priority: 'HIGH',
            source: 'manual',
            notes: 'E2E deadline fixture.',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    };
  }

  if (path === '/admin/global-events') {
    return {
      data: responseData({
        data: E2E_GLOBAL_EVENTS.map((event) => ({
          ...event,
          lateDeadline: new Date('2026-05-30T12:00:00Z').toISOString(),
          resultDate: new Date('2026-06-20T12:00:00Z').toISOString(),
          isRecurring: false,
          isActive: true,
        })),
        total: E2E_GLOBAL_EVENTS.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    };
  }

  if (path === '/admin/calibrations/stats') {
    return { data: responseData(E2E_CALIBRATION_STATS) };
  }

  if (path === '/admin/calibrations/suggestions') {
    return { data: responseData(E2E_CALIBRATION_SUGGESTIONS) };
  }

  if (path === '/admin/calibrations/platt-status') {
    return {
      data: responseData({
        ready: true,
        trainedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
        sampleCount: 128,
        brierScore: 0.18,
      }),
    };
  }

  if (path === '/admin/calibrations') {
    return { data: responseData(E2E_CALIBRATIONS) };
  }

  if (path === '/admin/prediction-workflow/policies') {
    return {
      data: responseData({
        items: [
          {
            id: 'e2e-prediction-policy',
            policyKey: 'default',
            version: 'prediction-policy-e2e-v1',
            name: 'E2E prediction policy',
            description: 'Fixture policy for UI coverage.',
            status: 'ACTIVE',
            priorSetVersion: 'priors-v1',
            driftSetVersion: 'drift-v1',
            relationshipSetVersion: 'relationships-v1',
            calibrationVersion: 'calibration-v1',
            numericCoreVersion: 'core-v1',
            explanationSchemaVersion: 'explanation-v1',
            thresholds: { minSamples: 25 },
            monitoringConfig: { shadowMetrics: { brierServed: 0.18 } },
            shadowStartedAt: null,
            activatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            retiredAt: null,
            createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    };
  }

  if (path === '/admin/prediction-workflow/observations') {
    return {
      data: responseData({
        items: [
          {
            id: 'e2e-observation',
            schoolId: E2E_SCHOOLS[2].id,
            school: E2E_SCHOOLS[2],
            highSchoolId: E2E_HIGH_SCHOOLS[0].id,
            highSchool: E2E_HIGH_SCHOOLS[0],
            cohortKey: 'intl-cs',
            round: 'RD',
            metricType: 'ADMIT_RATE',
            sourceType: 'INTERNAL_CASES',
            sourceName: 'Verified outcomes',
            qualityScore: 0.88,
            observationStage: 'TRAINING',
            status: 'UNDER_REVIEW',
            reviewAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            expiresAt: null,
            observedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            year: 2026,
            notes: 'E2E observation fixture.',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    };
  }

  if (path === '/admin/prediction-workflow/signals') {
    return {
      data: responseData({
        priors: [
          {
            id: 'e2e-prior',
            school: E2E_SCHOOLS[2],
            cohortKey: 'intl-cs',
            round: 'RD',
            priorRate: '0.47',
            confidence: 'MEDIUM',
            sampleCount: 18,
          },
        ],
        drifts: [],
        relationships: [],
        counts: { priors: 1, drifts: 0, relationships: 0 },
      }),
    };
  }

  if (/^\/admin\/prediction-workflow\/policies\/[^/]+\/gates$/.test(path)) {
    return {
      data: responseData({
        ready: true,
        thresholds: { minSamples: 25 },
        counts: { shadowPredictions: 42, resolvedLabels: 18, cohorts: { 'intl-cs': 18 } },
        shadowMetrics: { brierServed: 0.18 },
        failures: [],
      }),
    };
  }

  if (path === '/admin/prediction-workflow/outcomes') {
    return {
      data: responseData({
        items: [
          {
            id: 'e2e-outcome',
            result: 'ADMITTED',
            status: 'VERIFIED',
            notes: 'Verified E2E outcome.',
            evidenceUrl: 'https://example.edu/outcome',
            round: 'RD',
            isFinal: true,
            reportedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            resolvedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            predictionResultId: 'e2e-prediction-result',
            schoolId: E2E_SCHOOLS[2].id,
            school: E2E_SCHOOLS[2],
            profileId: E2E_USER.id,
            policyVersionId: 'e2e-prediction-policy',
            applicationRound: 'RD',
            applicationYear: 2026,
            cohortKey: 'intl-cs',
            latestOutcomeLabel: null,
            canonicalOutcomeLabel: 'ADMITTED',
            calibrationEligible: true,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    };
  }

  if (path === '/admin/predictions/distillation/overview') {
    return {
      data: responseData({
        latestDate: '2026-04-20',
        teacherStats: [
          {
            id: 'e2e-teacher-stat',
            date: '2026-04-20',
            stage: 'served',
            teacherKey: 'counselor',
            cohortKey: 'intl-cs',
            predictionCount: 42,
            activeSignalCount: 3,
            resolvedOutcomeCount: 18,
            avgTeacherProbability: 0.47,
            avgObservedWeight: 0.53,
            brierTeacher: 0.18,
            brierBlended: 0.17,
            brierServed: 0.16,
            distinctSchoolCount: 3,
          },
        ],
        schoolCoverage: [
          { stage: 'served', coverageTier: 'target', predictionCount: 18, schoolCount: 3 },
        ],
        chinaGates: [
          {
            cohortKey: 'intl-cs',
            eligible: true,
            resolvedOutcomeCount: 18,
            top100CoverageRate: 0.82,
            brierBlended: 0.17,
            brierServed: 0.16,
            reasons: [],
          },
        ],
      }),
    };
  }

  if (path === '/admin/predictions/distillation/schools') {
    return {
      data: responseData([
        {
          id: 'e2e-distillation-school',
          schoolId: E2E_SCHOOLS[2].id,
          cohortKey: 'intl-cs',
          stage: 'served',
          coverageTier: 'target',
          predictionCount: 18,
          resolvedOutcomeCount: 8,
          avgBlendDelta: 0.02,
          avgAbsBlendDelta: 0.04,
          brierBlended: 0.17,
          brierServed: 0.16,
          school: E2E_SCHOOLS[2],
        },
      ]),
    };
  }

  if (path === '/admin/predictions/benchmark/profiles') {
    return { data: responseData([]) };
  }

  if (path === '/admin/predictions/benchmark/sources') {
    return { data: responseData([]) };
  }

  if (path === '/admin/predictions/benchmark/runs') {
    return { data: responseData([]) };
  }

  if (path === '/admin/predictions/distillation/cds-bands/coverage') {
    return { data: responseData(E2E_CDS_COVERAGE) };
  }

  if (path === '/admin/predictions/distillation/cds-bands/rows') {
    return { data: responseData({ items: E2E_CDS_ROWS }) };
  }

  if (path === '/admin/schools/data-coverage') {
    return { data: responseData(E2E_DATA_COVERAGE) };
  }

  if (path === '/admin/schools/data-quality') {
    return { data: responseData(E2E_SCHOOL_QUALITY) };
  }

  if (path === '/admin/high-schools') {
    return {
      data: responseData({
        data: E2E_HIGH_SCHOOLS,
        total: E2E_HIGH_SCHOOLS.length,
      }),
    };
  }

  if (path === '/admin/high-schools/suggestions') {
    return {
      data: responseData([
        {
          id: 'e2e-high-school-suggestion',
          name: 'Lumni Academy',
          country: 'CN',
          submittedByCount: 3,
          createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
        },
      ]),
    };
  }

  if (path === '/admin/high-schools/review-needed') {
    return { data: responseData(E2E_HIGH_SCHOOLS) };
  }

  if (path === '/admin/theme-styles/diagnostics') {
    return {
      data: responseData({
        revision: 1,
        checksum: 'e2e-theme-style-checksum',
        diagnostics: e2eThemeStyleDiagnostics(),
      }),
    };
  }

  if (path === '/admin/theme-styles/certification') {
    return {
      data: responseData(e2eThemeCertificationResponse()),
    };
  }

  if (path === '/admin/theme-styles') {
    const certificationResult = e2eThemeCertificationResult();
    return {
      data: responseData({
        schemaVersion: 2,
        revision: 1,
        checksum: 'e2e-theme-style-checksum',
        items: [
          {
            id: 'e2e-theme-style',
            signature: 'cobalt-saas:command-center:e2e',
            palette: 'cobalt-saas',
            paletteLabelZh: '钴蓝 SaaS',
            paletteLabelEn: 'Cobalt SaaS',
            paletteDescriptionZh: '清晰克制的企业级蓝色 SaaS 方案，适合高密度申请工作台。',
            paletteDescriptionEn:
              'A restrained enterprise blue SaaS system for dense application workflows.',
            heroVisual: 'command-center',
            heroVisualLabelZh: '指挥中心',
            heroVisualLabelEn: 'Command Center',
            heroVisualDescriptionZh: '以任务、截止日期和申请进度为中心的企业级主页视觉。',
            heroVisualDescriptionEn:
              'An enterprise homepage visual centered on tasks, deadlines, and application progress.',
            appearanceOverrides: {
              clarity: 0.9,
              frost: 0.18,
              glow: 0.32,
              contrast: 0.86,
            },
            status: 'verified',
            validationStatus: 'passed',
            validationErrors: [],
            certificationStatus: 'passed',
            certificationResult,
            routeAuditSummary: certificationResult.routeAuditSummary,
            styleMeta: {
              radiusPreset: 'standard',
              densityPreset: 'standard',
              buttonPreset: 'solid',
              cardPreset: 'bordered',
              shadowPreset: 'subtle',
              motionPreset: 'quiet',
            },
            sourcePath: 'apps/web/src/app/[locale]/page.tsx',
            voteCount: 18,
            debugTags: ['e2e', 'featured'],
            createdBy: {
              userId: E2E_ADMIN.id,
              email: E2E_ADMIN.email,
            },
            updatedBy: {
              userId: E2E_ADMIN.id,
              email: E2E_ADMIN.email,
            },
            lastAction: 'verified',
            revisionCreated: 1,
            revisionUpdated: 1,
            savedBy: [
              {
                userId: E2E_USER.id,
                email: E2E_USER.email,
                savedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
              },
            ],
            createdAt: new Date('2026-04-10T12:00:00Z').toISOString(),
            updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          },
        ],
        total: 1,
        diagnostics: e2eThemeStyleDiagnostics(),
        updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
        updatedBy: {
          userId: E2E_ADMIN.id,
          email: E2E_ADMIN.email,
        },
      }),
    };
  }

  if (path === '/admin/application-analysis-workflow/policies') {
    return { data: responseData(pageResult([E2E_APPLICATION_ANALYSIS_POLICY])) };
  }

  if (path === '/admin/application-analysis-workflow/evidence') {
    return {
      data: responseData(
        pageResult([
          {
            id: 'e2e-aa-evidence',
            schoolId: E2E_SCHOOLS[2].id,
            school: E2E_SCHOOLS[2],
            policyDimension: 'TESTING',
            policyValue: 'OPTIONAL',
            sourceName: 'Official admissions page',
            sourceUrl: 'https://example.edu/admissions',
            status: 'UNDER_REVIEW',
            evidenceMode: 'fixture',
            notes: 'E2E evidence fixture.',
            updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            reviewedAt: null,
          },
        ])
      ),
    };
  }

  if (path === '/admin/application-analysis-workflow/evaluations') {
    return {
      data: responseData(
        pageResult([
          {
            id: 'e2e-aa-evaluation',
            policyVersionId: E2E_APPLICATION_ANALYSIS_POLICY.id,
            policyVersion: E2E_APPLICATION_ANALYSIS_POLICY,
            mode: 'SHADOW',
            status: 'COMPLETED',
            metrics: {
              policyCorrectnessRate: 0.91,
              weakStateCorrectnessRate: 0.86,
              actionabilityMean: 0.82,
              webVisualPass: 1,
              liveGoldPassRate: 0.9,
              journeyPassRate: 0.88,
            },
            scopeSummary: { totalCases: 12, dataset: 'e2e', mode: 'fixture' },
            counts: { workflowMode: 'fixture', evidenceMode: 'fixture' },
            failures: [],
            createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            finishedAt: new Date('2026-04-20T12:01:00Z').toISOString(),
          },
        ])
      ),
    };
  }

  if (path === '/admin/application-analysis-workflow/replays') {
    return {
      data: responseData(
        pageResult([
          {
            id: 'e2e-aa-replay',
            dataset: 'e2e-gold',
            analysisVersion: 'application-analysis-v2',
            status: 'COMPLETED',
            metrics: {
              goldPassRate: 0.92,
              webRenderPass: 1,
              mobileRenderPass: 1,
              liveGoldPassRate: 0.9,
            },
            summary: { totalCases: 12, workflowMode: 'fixture', commitSha: 'e2e' },
            failures: [],
            caseResults: [],
            createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            finishedAt: new Date('2026-04-20T12:01:00Z').toISOString(),
          },
        ])
      ),
    };
  }

  if (path === '/admin/application-analysis-workflow/experiments') {
    return { data: responseData(pageResult([E2E_APPLICATION_ANALYSIS_EXPERIMENT])) };
  }

  if (path === '/admin/application-analysis-workflow/experiment-evaluations') {
    return {
      data: responseData(
        pageResult([
          {
            id: 'e2e-aa-experiment-eval',
            experimentVersionId: E2E_APPLICATION_ANALYSIS_EXPERIMENT.id,
            experimentVersion: E2E_APPLICATION_ANALYSIS_EXPERIMENT,
            status: 'COMPLETED',
            metrics: { actionabilityMean: 0.84, policyCorrectnessRate: 0.9 },
            failures: [],
            createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            finishedAt: new Date('2026-04-20T12:01:00Z').toISOString(),
          },
        ])
      ),
    };
  }

  if (path === '/admin/application-analysis-workflow/experiment-sweeps') {
    return {
      data: responseData(
        pageResult([
          {
            id: 'e2e-aa-sweep',
            mode: 'SCHEDULED',
            status: 'COMPLETED',
            actorId: 'system',
            startedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            finishedAt: new Date('2026-04-20T12:01:00Z').toISOString(),
          },
        ])
      ),
    };
  }

  if (path === '/admin/application-analysis-workflow/experiment-incidents') {
    return { data: responseData(pageResult([])) };
  }

  if (path === '/admin/application-analysis-workflow/experiment-feedback') {
    return { data: responseData(pageResult([])) };
  }

  if (/^\/admin\/application-analysis-workflow\/policies\/[^/]+\/gates$/.test(path)) {
    return {
      data: responseData({
        ready: true,
        failures: [],
        metrics: {
          policyCorrectnessRate: 0.91,
          weakStateCorrectnessRate: 0.86,
          actionabilityMean: 0.82,
        },
      }),
    };
  }

  if (/^\/admin\/application-analysis-workflow\/experiments\/[^/]+\/gates$/.test(path)) {
    return {
      data: responseData({
        ready: true,
        failures: [],
        metrics: { actionabilityMean: 0.84, policyCorrectnessRate: 0.9 },
      }),
    };
  }

  if (path === '/admin/application-analysis-workflow/experiments/fairness-report') {
    return {
      data: responseData({
        status: 'pass',
        notes: ['No material group drift in the E2E fixture sample.'],
        appliesTo: ['international', 'domestic'],
      }),
    };
  }

  if (path === '/admin/review/stats') {
    return {
      data: responseData({
        pendingStaging: 1,
        pendingCases: 1,
        approvedToday: 3,
        rejectedToday: 0,
        totalStaging: 8,
        totalPending: 2,
      }),
    };
  }

  if (path === '/admin/review/queue') {
    return {
      data: responseData({
        items: [E2E_REVIEW_QUEUE_ITEM],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    };
  }

  if (path === '/admin/review/pending-cases') {
    return {
      data: responseData({
        items: E2E_CASES.map((admitCase) => ({
          ...admitCase,
          school: E2E_SCHOOLS[2],
          creator: { email: E2E_USER.email, profile: { nickname: E2E_USER.name } },
          createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
        })),
        total: E2E_CASES.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    };
  }

  if (path === '/admin/review/batches') {
    return {
      data: responseData({
        items: [
          {
            id: 'e2e-import-batch',
            itemCount: 3,
            source: 'manual',
            dataType: 'CASE',
            createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    };
  }

  if (path === '/admin/moderation/statistics') {
    return {
      data: responseData({
        overall: {
          queueDepth: 2,
          pendingReports: 1,
          pendingStaging: 1,
          throughputToday: 4,
          throughputTrend: [
            { date: '2026-04-19', count: 2 },
            { date: '2026-04-20', count: 4 },
          ],
        },
        perReviewer: [
          {
            userId: E2E_ADMIN.id,
            email: E2E_ADMIN.email,
            itemsReviewed: { today: 4, week: 18, month: 61 },
          },
        ],
      }),
    };
  }

  if (path === '/admin/ai-agent/memory/stats') {
    return {
      data: responseData({
        totalMemories: 1,
        totalConversations: 1,
        totalMessages: 2,
        totalEntities: 1,
        memoryByType: { FACT: 1 },
        entityByType: { SCHOOL: 1 },
        recentActivity: {
          memoriesLast7Days: 1,
          conversationsLast7Days: 1,
          messagesLast7Days: 2,
        },
        compaction: { totalCompactions: 0, averageCompressionRatio: 0 },
        decay: {
          totalMemories: 1,
          byTier: { HOT: 1 },
          averageImportance: 0.82,
          averageFreshness: 0.94,
          scheduledForArchive: 0,
          scheduledForDelete: 0,
        },
      }),
    };
  }

  if (path === '/admin/ai-agent/memory/browse') {
    return { data: responseData({ data: [E2E_MEMORY_ITEM], total: 1, page: 1, pageSize: 20 }) };
  }

  if (path === '/admin/ai-agent/memory/entities') {
    return {
      data: responseData({
        data: [
          {
            id: 'e2e-memory-entity',
            userId: E2E_USER.id,
            type: 'SCHOOL',
            name: 'Purdue University',
            description: 'Target school',
            attributes: { schoolId: E2E_SCHOOLS[2].id },
            relations: [],
            createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    };
  }

  if (path === '/admin/ai-agent/memory/conversations') {
    return {
      data: responseData({
        data: [
          {
            id: 'e2e-memory-conversation',
            userId: E2E_USER.id,
            title: 'Application planning',
            summary: 'Discussed Purdue submission readiness.',
            agentType: 'orchestrator',
            messageCount: 2,
            createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    };
  }

  if (path === '/admin/ai-agent/memory/decay/config') {
    return {
      data: responseData({
        enabled: true,
        decayRate: 0.02,
        minImportance: 0.1,
        accessBoost: 0.05,
        maxAccessBoost: 0.25,
        archiveThreshold: 0.2,
        archiveAfterDays: 90,
        deleteAfterDays: 365,
        batchSize: 100,
      }),
    };
  }

  if (path === '/admin/ai-agent/memory/decay/stats') {
    return {
      data: responseData({
        totalMemories: 1,
        byTier: { HOT: 1 },
        averageImportance: 0.82,
        averageFreshness: 0.94,
        scheduledForArchive: 0,
        scheduledForDelete: 0,
      }),
    };
  }

  if (/^\/admin\/ai-agent\/memory\/conversations\/[^/]+\/messages$/.test(path)) {
    return {
      data: responseData({
        data: [
          {
            id: 'e2e-memory-message',
            conversationId: 'e2e-memory-conversation',
            role: 'assistant',
            content: 'Purdue is ready to submit.',
            agentType: 'orchestrator',
            tokensUsed: 128,
            latencyMs: 420,
            createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          },
        ],
        total: 1,
      }),
    };
  }

  if (/^\/admin\/ai-agent\/memory\/users\/[^/]+\/stats$/.test(path)) {
    return { data: responseData({ totalMemories: 1, memoryByType: { FACT: 1 } }) };
  }

  if (path === '/verifications/stats') {
    return { data: responseData({ pending: 1, approved: 2, rejected: 0, total: 3 }) };
  }

  if (path === '/verifications/pending') {
    return {
      data: responseData({
        items: [E2E_VERIFICATION],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    };
  }

  if (path === '/verifications/e2e-verification') {
    return { data: responseData({ ...E2E_VERIFICATION, proofData: null }) };
  }

  if (path === '/admin/prediction-feedback') {
    return {
      data: responseData({
        items: [
          {
            id: 'e2e-prediction-feedback',
            predictionResultId: 'e2e-prediction-result',
            userId: E2E_USER.id,
            userEmail: E2E_USER.email,
            sentiment: 'POSITIVE',
            category: 'TOO_LOW',
            notes: 'The estimate feels useful, but Purdue may be a little conservative.',
            engineSnapshot: 'counselor',
            probabilitySnapshot: 0.47,
            createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            school: {
              id: E2E_SCHOOLS[2].id,
              name: E2E_SCHOOLS[2].name,
              nameZh: E2E_SCHOOLS[2].nameZh,
            },
            prediction: {
              probability: 0.47,
              factors: [],
              servedTrace: {},
              updatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            },
          },
        ],
        total: 1,
        nextCursor: null,
      }),
    };
  }

  if (path === '/admin/prediction-workflow/authority-stats') {
    return {
      data: responseData({
        result: {
          total: 12,
          AUTHORITATIVE: 10,
          PREVIEW: 2,
          NULL: 0,
        },
        snapshot: {
          total: 18,
          AUTHORITATIVE: 14,
          PREVIEW: 4,
          NULL: 0,
        },
        invariantChecks: {
          resultNullCount: 0,
          snapshotNullCount: 0,
          previewRowsWithOutcomeLabel: 0,
        },
        generatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
      }),
    };
  }

  if (path === '/admin/prediction-workflow/data-inventory') {
    return {
      data: responseData({
        schools: {
          total: E2E_SCHOOLS.length,
          withSat: 2,
          withAdmitRate: 3,
          withBoth: 2,
          scorecardReady: 2,
        },
        schoolPrograms: { total: 9, withAcceptanceRateEstimate: 5 },
        schoolCalibrations: { total: 3 },
        teacherSignalTables: {
          cohortRoundPriors: 12,
          cohortRegimeSignals: 5,
          relationshipSignals: 4,
        },
        admissionCases: {
          total: E2E_CASES.length,
          verified: 1,
          approvedForTeacher: 1,
          byResult: { ADMITTED: 1 },
          withGpa11: 1,
          withTestScores: 1,
        },
        schoolMetrics: { total: 24, distinctKeys: ['admitRateTrend', 'satMidpoint'] },
        generatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
      }),
    };
  }

  if (path === '/admin/prediction-workflow/training-readiness') {
    return {
      data: responseData({
        totalLabeled: 128,
        breakdown: {
          verifiedOutcomeLabels: 42,
          approvedAdmissionCases: 86,
          casesWithStructuredTestScores: 73,
        },
        tier: {
          current: 2,
          currentLabel: 'Teacher-ready sample',
          next: { tier: 3, label: 'Model training ready', samplesNeeded: 72 },
          thresholds: [
            { tier: 1, min: 25, label: 'Diagnostic' },
            { tier: 2, min: 100, label: 'Teacher-ready sample' },
            { tier: 3, min: 200, label: 'Model training ready' },
          ],
        },
        perSchoolCoverage: {
          schoolsWithAtLeast10Samples: 8,
          schoolsWithAtLeast20Samples: 4,
          schoolsWithAtLeast50Samples: 1,
          schoolsWithAtLeast100Samples: 0,
          totalSchoolsWithAnySample: 32,
        },
        yearBreakdown: { '2026': 58, '2025': 70 },
        recommendedNextAction:
          'Prioritize verified outcomes for target schools with sparse samples.',
        generatedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
      }),
    };
  }

  if (path === '/admin/essay-scraper/dashboard/coverage') {
    return {
      data: responseData({
        year: 2026,
        totalSchools: E2E_SCHOOLS.length,
        schoolsWithPrompts: 3,
        schoolsWithVerified: 2,
        coveragePercent: 67,
        totalPrompts: E2E_ESSAYS.length,
        pendingReview: 1,
      }),
    };
  }

  if (path === '/admin/essay-scraper/dashboard/freshness') {
    return {
      data: responseData(
        E2E_SCHOOLS.map((school, index) => ({
          id: `freshness-${school.id}`,
          sourceType: index === 0 ? 'OFFICIAL' : 'CURATED',
          url: school.website ?? `https://example.edu/${school.id}`,
          scrapeGroup: index === 1 ? 'UC' : 'COMMON_APP',
          lastScrapedAt: index === 2 ? null : new Date('2026-04-20T12:00:00Z').toISOString(),
          lastStatus: index === 2 ? null : 'SUCCESS',
          lastError: null,
          school: {
            id: school.id,
            name: school.name,
            nameZh: school.nameZh,
            usNewsRank: school.usNewsRank,
          },
        }))
      ),
    };
  }

  if (path === '/admin/essay-scraper/pipeline/runs') {
    return {
      data: responseData([
        {
          id: 'pipeline-run-e2e',
          trigger: 'MANUAL',
          year: 2026,
          status: 'COMPLETED',
          totalSchools: E2E_SCHOOLS.length,
          successCount: 2,
          failedCount: 0,
          newPrompts: 3,
          changedPrompts: 1,
          startedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          completedAt: new Date('2026-04-20T12:03:00Z').toISOString(),
        },
      ]),
    };
  }

  if (path === '/admin/roles/my-permissions') {
    return {
      data: responseData({
        role: 'SUPER_ADMIN',
        permissions: ['ai:config', 'audit:view', 'users:view', 'schools:write'],
      }),
    };
  }

  if (path === '/admin/roles/permissions') {
    return {
      data: responseData([
        { role: 'OPERATOR', permission: 'case:review', granted: true },
        { role: 'OPERATOR', permission: 'audit:view', granted: true },
        { role: 'ADMIN', permission: 'user:view', granted: true },
        { role: 'ADMIN', permission: 'ai:config', granted: true },
      ]),
    };
  }

  if (path === '/admin/roles/operators') {
    return {
      data: responseData([
        {
          id: 'e2e-operator',
          email: 'operator@example.com',
          role: 'OPERATOR',
          createdAt: new Date('2026-03-01T12:00:00Z').toISOString(),
          lastLoginAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          _count: { admissionCases: 8, reviewsGiven: 14 },
          stats: {
            casesReviewed: 14,
            importsProcessed: 3,
            lastActive: new Date('2026-04-20T12:00:00Z').toISOString(),
          },
        },
      ]),
    };
  }

  if (path.startsWith('/admin/roles/operators/') && path.endsWith('/stats')) {
    return {
      data: responseData({
        casesReviewed: 14,
        casesApproved: 11,
        casesRejected: 3,
        importsProcessed: 3,
        lastActive: new Date('2026-04-20T12:00:00Z').toISOString(),
      }),
    };
  }

  if (path === '/admin/users/e2e-user') {
    return {
      data: responseData({
        ...E2E_USER,
        displayName: E2E_USER.name,
        isBanned: false,
        bannedUntil: null,
        banReason: null,
        createdAt: new Date('2026-01-10T12:00:00Z').toISOString(),
        _count: { admissionCases: 2, reviewsGiven: 5 },
      }),
    };
  }

  if (path === '/admin/stats') {
    return {
      data: responseData({
        totalUsers: 42,
        verifiedUsers: 31,
        totalCases: E2E_CASES.length,
        pendingReports: 1,
        totalReviews: 12,
        newUsersToday: 3,
        activeUsersToday: 18,
        totalPosts: 9,
        pendingVerifications: 2,
        subscriptionDistribution: { free: 20, pro: 18, premium: 4 },
      }),
    };
  }

  if (path === '/admin/stats/trends') {
    return {
      data: responseData([
        { date: '2026-04-01', newUsers: 4, payments: 2, revenue: 19800, posts: 7 },
        { date: '2026-04-15', newUsers: 7, payments: 3, revenue: 29700, posts: 11 },
      ]),
    };
  }

  if (path === '/admin/ai-agent/health') {
    return {
      data: responseData({
        status: 'healthy',
        components: {
          modelGateway: { status: 'healthy' },
          queue: { status: 'healthy' },
        },
      }),
    };
  }

  if (path === '/admin/ai-agent/llm-calls') {
    return {
      data: responseData({
        data: [
          {
            id: 'e2e-llm-call',
            userId: E2E_USER.id,
            model: 'gpt-4o-mini',
            agentType: 'orchestrator',
            promptTokens: 1420,
            completionTokens: 380,
            totalTokens: 1800,
            cost: 0.0062,
            metadata: {
              latencyMs: 820,
              finishReason: 'stop',
              messageCount: 3,
              inputPreview: 'User asked for a balanced school list.',
              outputPreview: 'Generated a reach/target/safety plan.',
            },
            createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    };
  }

  if (/^\/admin\/ai-agent\/users\/[^/]+\/usage$/.test(path)) {
    return {
      data: responseData({
        today: { tokens: 1800, cost: 0.0062, calls: 4 },
        month: { tokens: 42800, cost: 0.142, calls: 91 },
        quota: { daily: 100000, monthly: 2000000 },
        remaining: { daily: 98200, monthly: 1957200 },
      }),
    };
  }

  if (/^\/admin\/ai-agent\/users\/[^/]+\/rate-limit$/.test(path)) {
    return {
      data: responseData({
        isLimited: false,
        remaining: 120,
        resetAt: null,
      }),
    };
  }

  if (path === '/health/detailed') {
    return {
      data: responseData({
        status: 'ok',
        version: 'e2e',
        timestamp: new Date('2026-04-20T12:00:00Z').toISOString(),
        uptime: 86400,
        memory: { used: 512 * 1024 * 1024, total: 2048 * 1024 * 1024, percentage: 25 },
        checks: {
          database: { status: 'ok', latencyMs: 12 },
          redis: { status: 'ok', latencyMs: 7 },
        },
        env: 'test',
        nodeVersion: 'v22',
        build: { commitSha: 'e2e', buildTime: '2026-04-20T12:00:00Z', nodeVersion: 'v22' },
      }),
    };
  }

  if (path === '/admin/audit-logs') {
    return {
      data: responseData({
        data: [
          {
            id: 'e2e-audit',
            actor: 'Admin User',
            action: 'VIEWED',
            resource: 'settings',
            createdAt: new Date('2026-04-20T12:00:00Z').toISOString(),
            admin: { displayName: 'Admin User' },
          },
        ],
      }),
    };
  }

  if (path === '/admin/data-sync/jobs') {
    return { data: responseData(E2E_DATA_SYNC_JOBS) };
  }

  if (path.startsWith('/admin')) {
    return {
      data: responseData({
        stats: { users: 42, schools: E2E_SCHOOLS.length, cases: E2E_CASES.length },
        items: genericListFor(path).items,
        total: genericListFor(path).total,
        health: 'OK',
      }),
    };
  }

  if (path === '/forums/categories') {
    return { data: responseData(E2E_FORUM_CATEGORIES) };
  }

  if (path === '/forums/communities') {
    return { data: responseData(E2E_FORUM_COMMUNITIES) };
  }

  if (path === '/forums/posts') {
    return {
      data: responseData({
        posts: E2E_FORUM_POSTS,
        total: E2E_FORUM_POSTS.length,
        hasMore: false,
      }),
    };
  }

  if (
    path.startsWith('/followers') ||
    path.startsWith('/following') ||
    path.startsWith('/forum') ||
    path.startsWith('/hall') ||
    path.startsWith('/chat') ||
    path.startsWith('/conversations') ||
    path.startsWith('/vault') ||
    path.startsWith('/ai')
  ) {
    return { data: responseData(genericListFor(path)) };
  }

  return { data: responseData(genericListFor(path)) };
}

export async function installFullUiApiFixtures(page: Page, role: FullUiRole) {
  if (role !== 'guest') {
    const webOrigin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4100';
    await page.context().addCookies([
      {
        name: 'access_token',
        value: role === 'admin' ? 'e2e-admin-token' : 'e2e-user-token',
        url: webOrigin,
        httpOnly: true,
        sameSite: 'Lax',
      },
      {
        name: 'refresh_token',
        value: role === 'admin' ? 'e2e-admin-refresh-token' : 'e2e-user-refresh-token',
        url: webOrigin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  }

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const normalizedPath = url.pathname.replace(/^\/api(?:\/v1)?(?=\/|$)/, '') || '/';
    const result = apiData(normalizedPath, role, request.method());
    await fulfillJson(route, result.data, result.status ?? 200);
  });

  await page.route('**/health**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const result = apiData(url.pathname, role, request.method());
    await fulfillJson(route, result.data, result.status ?? 200);
  });
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Top 50 US Universities seed data
const schools = [
  {
    name: 'Princeton University',
    nameZh: '普林斯顿大学',
    state: 'NJ',
    usNewsRank: 1,
    acceptanceRate: 5.8,
    tuition: 59710,
    avgSalary: 95000,
  },
  {
    name: 'Massachusetts Institute of Technology',
    nameZh: '麻省理工学院',
    state: 'MA',
    usNewsRank: 2,
    acceptanceRate: 4.0,
    tuition: 60156,
    avgSalary: 115000,
  },
  {
    name: 'Harvard University',
    nameZh: '哈佛大学',
    state: 'MA',
    usNewsRank: 3,
    acceptanceRate: 3.4,
    tuition: 59076,
    avgSalary: 95000,
  },
  {
    name: 'Stanford University',
    nameZh: '斯坦福大学',
    state: 'CA',
    usNewsRank: 3,
    acceptanceRate: 3.7,
    tuition: 62484,
    avgSalary: 105000,
  },
  {
    name: 'Yale University',
    nameZh: '耶鲁大学',
    state: 'CT',
    usNewsRank: 5,
    acceptanceRate: 4.6,
    tuition: 64700,
    avgSalary: 90000,
  },
  {
    name: 'University of Pennsylvania',
    nameZh: '宾夕法尼亚大学',
    state: 'PA',
    usNewsRank: 6,
    acceptanceRate: 5.9,
    tuition: 66104,
    avgSalary: 95000,
  },
  {
    name: 'California Institute of Technology',
    nameZh: '加州理工学院',
    state: 'CA',
    usNewsRank: 7,
    acceptanceRate: 2.7,
    tuition: 63471,
    avgSalary: 110000,
  },
  {
    name: 'Duke University',
    nameZh: '杜克大学',
    state: 'NC',
    usNewsRank: 7,
    acceptanceRate: 6.0,
    tuition: 66172,
    avgSalary: 88000,
  },
  {
    name: 'Brown University',
    nameZh: '布朗大学',
    state: 'RI',
    usNewsRank: 9,
    acceptanceRate: 5.1,
    tuition: 67458,
    avgSalary: 80000,
  },
  {
    name: 'Johns Hopkins University',
    nameZh: '约翰霍普金斯大学',
    state: 'MD',
    usNewsRank: 9,
    acceptanceRate: 6.5,
    tuition: 63340,
    avgSalary: 85000,
  },
  {
    name: 'Northwestern University',
    nameZh: '西北大学',
    state: 'IL',
    usNewsRank: 9,
    acceptanceRate: 7.0,
    tuition: 65997,
    avgSalary: 82000,
  },
  {
    name: 'Columbia University',
    nameZh: '哥伦比亚大学',
    state: 'NY',
    usNewsRank: 12,
    acceptanceRate: 3.9,
    tuition: 68400,
    avgSalary: 90000,
  },
  {
    name: 'Cornell University',
    nameZh: '康奈尔大学',
    state: 'NY',
    usNewsRank: 12,
    acceptanceRate: 7.3,
    tuition: 66014,
    avgSalary: 85000,
  },
  {
    name: 'University of Chicago',
    nameZh: '芝加哥大学',
    state: 'IL',
    usNewsRank: 12,
    acceptanceRate: 5.4,
    tuition: 66939,
    avgSalary: 88000,
  },
  {
    name: 'University of California, Berkeley',
    nameZh: '加州大学伯克利分校',
    state: 'CA',
    usNewsRank: 15,
    acceptanceRate: 11.6,
    tuition: 44066,
    avgSalary: 95000,
  },
  {
    name: 'University of California, Los Angeles',
    nameZh: '加州大学洛杉矶分校',
    state: 'CA',
    usNewsRank: 15,
    acceptanceRate: 8.6,
    tuition: 44830,
    avgSalary: 80000,
  },
  {
    name: 'Rice University',
    nameZh: '莱斯大学',
    state: 'TX',
    usNewsRank: 17,
    acceptanceRate: 7.7,
    tuition: 58128,
    avgSalary: 85000,
  },
  {
    name: 'Dartmouth College',
    nameZh: '达特茅斯学院',
    state: 'NH',
    usNewsRank: 18,
    acceptanceRate: 6.2,
    tuition: 65511,
    avgSalary: 85000,
  },
  {
    name: 'Vanderbilt University',
    nameZh: '范德堡大学',
    state: 'TN',
    usNewsRank: 18,
    acceptanceRate: 5.6,
    tuition: 63946,
    avgSalary: 78000,
  },
  {
    name: 'University of Notre Dame',
    nameZh: '圣母大学',
    state: 'IN',
    usNewsRank: 20,
    acceptanceRate: 12.9,
    tuition: 62693,
    avgSalary: 80000,
  },
  {
    name: 'University of Michigan, Ann Arbor',
    nameZh: '密歇根大学安娜堡分校',
    state: 'MI',
    usNewsRank: 21,
    acceptanceRate: 17.7,
    tuition: 57273,
    avgSalary: 82000,
  },
  {
    name: 'Georgetown University',
    nameZh: '乔治城大学',
    state: 'DC',
    usNewsRank: 22,
    acceptanceRate: 12.0,
    tuition: 65082,
    avgSalary: 80000,
  },
  {
    name: 'University of North Carolina at Chapel Hill',
    nameZh: '北卡罗来纳大学教堂山分校',
    state: 'NC',
    usNewsRank: 22,
    acceptanceRate: 16.8,
    tuition: 39338,
    avgSalary: 72000,
  },
  {
    name: 'Carnegie Mellon University',
    nameZh: '卡内基梅隆大学',
    state: 'PA',
    usNewsRank: 24,
    acceptanceRate: 11.0,
    tuition: 63829,
    avgSalary: 105000,
  },
  {
    name: 'Emory University',
    nameZh: '埃默里大学',
    state: 'GA',
    usNewsRank: 24,
    acceptanceRate: 11.4,
    tuition: 60774,
    avgSalary: 75000,
  },
  {
    name: 'University of Virginia',
    nameZh: '弗吉尼亚大学',
    state: 'VA',
    usNewsRank: 24,
    acceptanceRate: 18.6,
    tuition: 58950,
    avgSalary: 78000,
  },
  {
    name: 'Washington University in St. Louis',
    nameZh: '圣路易斯华盛顿大学',
    state: 'MO',
    usNewsRank: 24,
    acceptanceRate: 11.0,
    tuition: 63373,
    avgSalary: 78000,
  },
  {
    name: 'University of California, Davis',
    nameZh: '加州大学戴维斯分校',
    state: 'CA',
    usNewsRank: 28,
    acceptanceRate: 37.3,
    tuition: 44408,
    avgSalary: 72000,
  },
  {
    name: 'University of California, San Diego',
    nameZh: '加州大学圣地亚哥分校',
    state: 'CA',
    usNewsRank: 28,
    acceptanceRate: 24.7,
    tuition: 44487,
    avgSalary: 78000,
  },
  {
    name: 'University of Florida',
    nameZh: '佛罗里达大学',
    state: 'FL',
    usNewsRank: 28,
    acceptanceRate: 23.1,
    tuition: 28658,
    avgSalary: 68000,
  },
  {
    name: 'University of Southern California',
    nameZh: '南加州大学',
    state: 'CA',
    usNewsRank: 28,
    acceptanceRate: 9.9,
    tuition: 67005,
    avgSalary: 82000,
  },
  {
    name: 'University of Texas at Austin',
    nameZh: '德克萨斯大学奥斯汀分校',
    state: 'TX',
    usNewsRank: 32,
    acceptanceRate: 31.2,
    tuition: 41070,
    avgSalary: 78000,
  },
  {
    name: 'Georgia Institute of Technology',
    nameZh: '佐治亚理工学院',
    state: 'GA',
    usNewsRank: 33,
    acceptanceRate: 17.1,
    tuition: 33794,
    avgSalary: 90000,
  },
  {
    name: 'University of California, Irvine',
    nameZh: '加州大学尔湾分校',
    state: 'CA',
    usNewsRank: 33,
    acceptanceRate: 21.0,
    tuition: 43709,
    avgSalary: 72000,
  },
  {
    name: 'New York University',
    nameZh: '纽约大学',
    state: 'NY',
    usNewsRank: 35,
    acceptanceRate: 12.2,
    tuition: 60438,
    avgSalary: 78000,
  },
  {
    name: 'University of California, Santa Barbara',
    nameZh: '加州大学圣塔芭芭拉分校',
    state: 'CA',
    usNewsRank: 35,
    acceptanceRate: 25.9,
    tuition: 44196,
    avgSalary: 70000,
  },
  {
    name: 'University of Illinois Urbana-Champaign',
    nameZh: '伊利诺伊大学厄巴纳-香槟分校',
    state: 'IL',
    usNewsRank: 35,
    acceptanceRate: 44.8,
    tuition: 36068,
    avgSalary: 80000,
  },
  {
    name: 'University of Wisconsin-Madison',
    nameZh: '威斯康星大学麦迪逊分校',
    state: 'WI',
    usNewsRank: 35,
    acceptanceRate: 49.2,
    tuition: 40603,
    avgSalary: 72000,
  },
  {
    name: 'Boston College',
    nameZh: '波士顿学院',
    state: 'MA',
    usNewsRank: 39,
    acceptanceRate: 16.4,
    tuition: 66884,
    avgSalary: 75000,
  },
  {
    name: 'Rutgers University-New Brunswick',
    nameZh: '罗格斯大学新布朗斯维克分校',
    state: 'NJ',
    usNewsRank: 40,
    acceptanceRate: 66.1,
    tuition: 35636,
    avgSalary: 72000,
  },
  {
    name: 'Tufts University',
    nameZh: '塔夫茨大学',
    state: 'MA',
    usNewsRank: 40,
    acceptanceRate: 9.5,
    tuition: 67844,
    avgSalary: 78000,
  },
  {
    name: 'University of Washington',
    nameZh: '华盛顿大学',
    state: 'WA',
    usNewsRank: 40,
    acceptanceRate: 47.8,
    tuition: 41997,
    avgSalary: 82000,
  },
  {
    name: 'Boston University',
    nameZh: '波士顿大学',
    state: 'MA',
    usNewsRank: 43,
    acceptanceRate: 14.4,
    tuition: 65168,
    avgSalary: 72000,
  },
  {
    name: 'Ohio State University',
    nameZh: '俄亥俄州立大学',
    state: 'OH',
    usNewsRank: 43,
    acceptanceRate: 52.6,
    tuition: 36722,
    avgSalary: 70000,
  },
  {
    name: 'Purdue University',
    nameZh: '普渡大学',
    state: 'IN',
    usNewsRank: 43,
    acceptanceRate: 53.4,
    tuition: 28794,
    avgSalary: 78000,
  },
  {
    name: 'University of Maryland, College Park',
    nameZh: '马里兰大学帕克分校',
    state: 'MD',
    usNewsRank: 46,
    acceptanceRate: 44.5,
    tuition: 41426,
    avgSalary: 78000,
  },
  {
    name: 'Lehigh University',
    nameZh: '里海大学',
    state: 'PA',
    usNewsRank: 47,
    acceptanceRate: 37.0,
    tuition: 64380,
    avgSalary: 80000,
  },
  {
    name: 'Texas A&M University',
    nameZh: '德州农工大学',
    state: 'TX',
    usNewsRank: 47,
    acceptanceRate: 63.0,
    tuition: 40607,
    avgSalary: 72000,
  },
  {
    name: 'University of Georgia',
    nameZh: '佐治亚大学',
    state: 'GA',
    usNewsRank: 47,
    acceptanceRate: 42.8,
    tuition: 33818,
    avgSalary: 65000,
  },
  {
    name: 'Wake Forest University',
    nameZh: '维克森林大学',
    state: 'NC',
    usNewsRank: 47,
    acceptanceRate: 21.4,
    tuition: 64758,
    avgSalary: 70000,
  },
];

async function main() {
  console.log('🌱 Starting database seed...');

  // Check if schools exist, only insert if empty
  const existingSchoolCount = await prisma.school.count();
  if (existingSchoolCount === 0) {
    console.log('🏫 Inserting school data...');
    for (const school of schools) {
      await prisma.school.create({
        data: {
          name: school.name,
          nameZh: school.nameZh,
          country: 'US',
          state: school.state,
          usNewsRank: school.usNewsRank,
          acceptanceRate: school.acceptanceRate,
          tuition: school.tuition,
          avgSalary: school.avgSalary,
        },
      });
    }
    console.log(`✅ Inserted ${schools.length} schools`);
  } else {
    console.log(
      `⏭️  Schools already exist (${existingSchoolCount}), skipping...`,
    );
  }

  // Create demo user (optional)
  const demoUserExists = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
  });

  if (!demoUserExists) {
    console.log('👤 Creating demo user...');
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash('Demo123!', 10);

    await prisma.user.create({
      data: {
        email: 'demo@example.com',
        passwordHash,
        emailVerified: true,
        locale: 'zh',
        profile: {
          create: {
            grade: 'JUNIOR',
            gpa: 3.85,
            gpaScale: 4.0,
            targetMajor: 'Computer Science',
            budgetTier: 'HIGH',
            visibility: 'ANONYMOUS',
          },
        },
      },
    });
    console.log(
      '✅ Demo user created (email: demo@example.com, password: Demo123!)',
    );
  }

  // Create admin user
  const adminUserExists = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });

  if (!adminUserExists) {
    console.log('👑 Creating admin user...');
    const bcrypt = await import('bcrypt');
    const adminPasswordHash = await bcrypt.hash('Admin123!', 10);

    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: adminPasswordHash,
        emailVerified: true,
        role: 'ADMIN',
        locale: 'zh',
      },
    });
    console.log(
      '✅ Admin user created (email: admin@example.com, password: Admin123!)',
    );
  }

  // ========== Chat Test Users & Data ==========
  await seedChatTestData();

  console.log('🎉 Seed completed!');
}

async function seedChatTestData() {
  // Check if already seeded
  const exists = await prisma.user.findUnique({
    where: { email: 'xiaoming@test.com' },
  });
  if (exists) {
    console.log('⏭️  Chat test users already exist, skipping...');
    return;
  }

  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('Test123!', 10);

  console.log('💬 Creating chat test users...');

  // Get demo user
  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
  });
  if (!demoUser) {
    console.log('⚠️  Demo user not found, skipping chat seed');
    return;
  }

  // Get/update admin user (add profile if missing)
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
    include: { profile: true },
  });
  if (adminUser && !adminUser.profile) {
    await prisma.profile.create({
      data: {
        userId: adminUser.id,
        nickname: '平台管理员',
        bio: '留学平台官方管理员',
        visibility: 'PUBLIC',
      },
    });
  }

  // --- 1. VERIFIED + mutual follow (can chat normally) ---
  const xiaoming = await prisma.user.create({
    data: {
      email: 'xiaoming@test.com',
      passwordHash,
      emailVerified: true,
      role: 'VERIFIED',
      locale: 'zh',
      profile: {
        create: {
          nickname: '小明同学',
          bio: '目标 Top 20，CS 方向',
          grade: 'JUNIOR',
          gpa: 3.92,
          gpaScale: 4.0,
          targetMajor: 'Computer Science',
          currentSchool: '北京四中',
          budgetTier: 'HIGH',
          visibility: 'PUBLIC',
          regionPref: ['US'],
        },
      },
    },
  });
  console.log('  ✅ 小明同学 (VERIFIED, mutual follow)');

  const lisa = await prisma.user.create({
    data: {
      email: 'lisa@test.com',
      passwordHash,
      emailVerified: true,
      role: 'VERIFIED',
      locale: 'zh',
      profile: {
        create: {
          nickname: '学姐Lisa',
          bio: '已拿到 Stanford offer，乐意分享经验',
          grade: 'SENIOR',
          gpa: 3.88,
          gpaScale: 4.0,
          targetMajor: 'Data Science',
          currentSchool: '上海中学',
          budgetTier: 'UNLIMITED',
          visibility: 'PUBLIC',
          regionPref: ['US', 'UK'],
        },
      },
    },
  });
  console.log('  ✅ 学姐Lisa (VERIFIED, mutual follow)');

  // --- 2. USER (unverified) + mutual follow (can reply but not initiate) ---
  const wenshu = await prisma.user.create({
    data: {
      email: 'wenshu@test.com',
      passwordHash,
      emailVerified: true,
      role: 'USER',
      locale: 'zh',
      profile: {
        create: {
          nickname: '文书达人',
          bio: 'Common App 文书写作达人',
          grade: 'JUNIOR',
          gpa: 3.75,
          gpaScale: 4.0,
          targetMajor: 'Economics',
          currentSchool: '深圳外国语学校',
          budgetTier: 'MEDIUM',
          visibility: 'PUBLIC',
          regionPref: ['US', 'CA'],
        },
      },
    },
  });
  console.log('  ✅ 文书达人 (USER, mutual follow - cannot initiate)');

  // --- 3. VERIFIED + one-way follow (demo → her, she didn't follow back) ---
  const toefl = await prisma.user.create({
    data: {
      email: 'toefl@test.com',
      passwordHash,
      emailVerified: true,
      role: 'VERIFIED',
      locale: 'zh',
      profile: {
        create: {
          nickname: '托福学霸',
          bio: '托福115 / SAT 1560，标化一把过',
          grade: 'SOPHOMORE',
          gpa: 3.95,
          gpaScale: 4.0,
          targetMajor: 'Biology',
          currentSchool: '南京外国语学校',
          budgetTier: 'HIGH',
          visibility: 'PUBLIC',
          regionPref: ['US'],
        },
      },
    },
  });
  console.log('  ✅ 托福学霸 (VERIFIED, one-way: demo→her)');

  // --- 4. VERIFIED + one-way follow (she → demo, demo didn't follow back) ---
  const planner = await prisma.user.create({
    data: {
      email: 'planner@test.com',
      passwordHash,
      emailVerified: true,
      role: 'VERIFIED',
      locale: 'zh',
      profile: {
        create: {
          nickname: '留学规划师',
          bio: '帮大家选校选专业',
          grade: 'GAP_YEAR',
          gpa: 3.6,
          gpaScale: 4.0,
          targetMajor: 'Psychology',
          currentSchool: '成都七中',
          budgetTier: 'LOW',
          visibility: 'PUBLIC',
          regionPref: ['US', 'UK', 'CA'],
        },
      },
    },
  });
  console.log('  ✅ 留学规划师 (VERIFIED, one-way: her→demo)');

  // --- 5. VERIFIED + mutual follow + blocked by demo ---
  const blocked = await prisma.user.create({
    data: {
      email: 'blocked@test.com',
      passwordHash,
      emailVerified: true,
      role: 'VERIFIED',
      locale: 'zh',
      profile: {
        create: {
          nickname: '被拉黑的人',
          bio: '测试拉黑场景',
          grade: 'JUNIOR',
          gpa: 3.5,
          gpaScale: 4.0,
          targetMajor: 'Business',
          currentSchool: '广州外国语学校',
          budgetTier: 'MEDIUM',
          visibility: 'PUBLIC',
          regionPref: ['US'],
        },
      },
    },
  });
  console.log('  ✅ 被拉黑的人 (VERIFIED, mutual follow + blocked)');

  // ========== Create Follow Relationships ==========
  console.log('🔗 Creating follow relationships...');

  // Mutual follows: demo ↔ xiaoming, lisa, wenshu, blocked, admin
  const mutualFollowTargets = [xiaoming.id, lisa.id, wenshu.id, blocked.id];
  if (adminUser) mutualFollowTargets.push(adminUser.id);

  for (const targetId of mutualFollowTargets) {
    await prisma.follow.createMany({
      data: [
        { followerId: demoUser.id, followingId: targetId },
        { followerId: targetId, followingId: demoUser.id },
      ],
      skipDuplicates: true,
    });
  }
  console.log('  ✅ Mutual follows created');

  // One-way: demo → toefl (demo follows her, she doesn't follow back)
  await prisma.follow.create({
    data: { followerId: demoUser.id, followingId: toefl.id },
  });
  console.log('  ✅ One-way follow: demo → 托福学霸');

  // One-way: planner → demo (she follows demo, demo doesn't follow back)
  await prisma.follow.create({
    data: { followerId: planner.id, followingId: demoUser.id },
  });
  console.log('  ✅ One-way follow: 留学规划师 → demo');

  // Block: demo blocks blocked user
  await prisma.block.create({
    data: { blockerId: demoUser.id, blockedId: blocked.id },
  });
  console.log('  ✅ Block: demo → 被拉黑的人');

  // ========== Create Conversations & Messages ==========
  console.log('💬 Creating conversations and messages...');

  const now = new Date();
  const hours = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const mins = (base: Date, m: number) =>
    new Date(base.getTime() + m * 60 * 1000);

  // --- Conversation 1: demo ↔ xiaoming (CS school selection, 3 days ago) ---
  const conv1Start = hours(72);
  const conv1 = await prisma.conversation.create({
    data: {
      createdAt: conv1Start,
      updatedAt: mins(conv1Start, 25),
      participants: {
        create: [{ userId: demoUser.id }, { userId: xiaoming.id }],
      },
    },
  });

  const conv1Messages = [
    {
      senderId: xiaoming.id,
      content: '你好！看到你也是申CS的，GPA多少呀？',
      offset: 0,
    },
    { senderId: demoUser.id, content: '3.85，你呢？', offset: 3 },
    {
      senderId: xiaoming.id,
      content: '我3.92，在纠结 CMU 和 Berkeley，你有什么看法吗？',
      offset: 5,
    },
    {
      senderId: demoUser.id,
      content:
        'CMU 的 SCS 很强，CS 专排第一。但 Berkeley 综合排名更高，地理位置也好',
      offset: 8,
    },
    {
      senderId: xiaoming.id,
      content: '对，我也在想这个问题。你标化怎么样？',
      offset: 15,
    },
    {
      senderId: demoUser.id,
      content: '托福110，SAT还在准备中，争取1550+',
      offset: 25,
    },
  ];
  for (const msg of conv1Messages) {
    await prisma.message.create({
      data: {
        conversationId: conv1.id,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: mins(conv1Start, msg.offset),
      },
    });
  }
  console.log('  ✅ Conversation 1: demo ↔ 小明同学 (6 messages)');

  // --- Conversation 2: demo ↔ lisa (Stanford experience, 2 days ago) ---
  const conv2Start = hours(48);
  const conv2 = await prisma.conversation.create({
    data: {
      createdAt: conv2Start,
      updatedAt: mins(conv2Start, 20),
      participants: {
        create: [{ userId: demoUser.id }, { userId: lisa.id }],
      },
    },
  });

  const conv2Messages = [
    {
      senderId: lisa.id,
      content:
        '学弟/学妹你好，我去年拿到 Stanford 的 offer 了！看到你也在申CS，有什么想问的吗？',
      offset: 0,
    },
    {
      senderId: demoUser.id,
      content: '太厉害了！可以分享一下经验吗？特别是文书方面',
      offset: 4,
    },
    {
      senderId: lisa.id,
      content:
        '当然可以。文书最重要，一定要有独特的个人故事。招生官每天看上千篇，要让人记住你',
      offset: 7,
    },
    {
      senderId: lisa.id,
      content: '我建议暑假就开始写初稿，反复修改。我前后改了大概15版',
      offset: 8,
    },
    {
      senderId: demoUser.id,
      content: '谢谢学姐！文书主题怎么选呢？我怕写得太普通',
      offset: 20,
    },
  ];
  for (const msg of conv2Messages) {
    await prisma.message.create({
      data: {
        conversationId: conv2.id,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: mins(conv2Start, msg.offset),
      },
    });
  }
  console.log('  ✅ Conversation 2: demo ↔ 学姐Lisa (5 messages)');

  // --- Conversation 3: demo ↔ wenshu (essay advice, 1 day ago) ---
  // Note: wenshu is USER role, conversation initiated "by demo" side
  const conv3Start = hours(24);
  const conv3 = await prisma.conversation.create({
    data: {
      createdAt: conv3Start,
      updatedAt: mins(conv3Start, 18),
      participants: {
        create: [{ userId: demoUser.id }, { userId: wenshu.id }],
      },
    },
  });

  const conv3Messages = [
    {
      senderId: demoUser.id,
      content: '你好，看到你的bio说文书写得不错？能交流一下吗',
      offset: 0,
    },
    {
      senderId: wenshu.id,
      content: '是的！我帮好几个同学改过 Common App 文书，你是要申哪个方向？',
      offset: 5,
    },
    {
      senderId: demoUser.id,
      content: 'CS方向，能给点建议吗？我还没确定主题',
      offset: 10,
    },
    {
      senderId: wenshu.id,
      content:
        '建议写一个具体的小故事，别写太大的主题。比如一个项目经历带给你的成长，比"我热爱科技"有说服力多了',
      offset: 18,
    },
  ];
  for (const msg of conv3Messages) {
    await prisma.message.create({
      data: {
        conversationId: conv3.id,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: mins(conv3Start, msg.offset),
      },
    });
  }
  console.log('  ✅ Conversation 3: demo ↔ 文书达人 (4 messages, USER role)');

  // --- Conversation 4: demo ↔ admin (platform welcome, 1 hour ago) ---
  if (adminUser) {
    const conv4Start = hours(1);
    const conv4 = await prisma.conversation.create({
      data: {
        createdAt: conv4Start,
        updatedAt: mins(conv4Start, 6),
        participants: {
          create: [{ userId: demoUser.id }, { userId: adminUser.id }],
        },
      },
    });

    const conv4Messages = [
      {
        senderId: adminUser.id,
        content: '欢迎使用留学平台！有任何问题可以随时联系我',
        offset: 0,
      },
      {
        senderId: demoUser.id,
        content: '谢谢！请问怎么进行身份认证？',
        offset: 3,
      },
      {
        senderId: adminUser.id,
        content:
          '在设置页面提交认证材料（学生证或在读证明），我们会在48小时内审核完成',
        offset: 6,
      },
    ];
    for (const msg of conv4Messages) {
      await prisma.message.create({
        data: {
          conversationId: conv4.id,
          senderId: msg.senderId,
          content: msg.content,
          createdAt: mins(conv4Start, msg.offset),
        },
      });
    }
    console.log('  ✅ Conversation 4: demo ↔ admin (3 messages)');
  }

  console.log('');
  console.log('📋 Chat test data summary:');
  console.log(
    '  Conversations with messages: demo ↔ 小明, Lisa, 文书达人, admin',
  );
  console.log(
    '  One-way follow (no chat):    demo → 托福学霸, 留学规划师 → demo',
  );
  console.log('  Blocked (no chat):           demo blocked 被拉黑的人');
  console.log('');
  console.log('  All test user password: Test123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

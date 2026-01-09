import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Top 50 US Universities seed data
const schools = [
  { name: 'Princeton University', nameZh: '普林斯顿大学', state: 'NJ', usNewsRank: 1, acceptanceRate: 5.8, tuition: 59710, avgSalary: 95000 },
  { name: 'Massachusetts Institute of Technology', nameZh: '麻省理工学院', state: 'MA', usNewsRank: 2, acceptanceRate: 4.0, tuition: 60156, avgSalary: 115000 },
  { name: 'Harvard University', nameZh: '哈佛大学', state: 'MA', usNewsRank: 3, acceptanceRate: 3.4, tuition: 59076, avgSalary: 95000 },
  { name: 'Stanford University', nameZh: '斯坦福大学', state: 'CA', usNewsRank: 3, acceptanceRate: 3.7, tuition: 62484, avgSalary: 105000 },
  { name: 'Yale University', nameZh: '耶鲁大学', state: 'CT', usNewsRank: 5, acceptanceRate: 4.6, tuition: 64700, avgSalary: 90000 },
  { name: 'University of Pennsylvania', nameZh: '宾夕法尼亚大学', state: 'PA', usNewsRank: 6, acceptanceRate: 5.9, tuition: 66104, avgSalary: 95000 },
  { name: 'California Institute of Technology', nameZh: '加州理工学院', state: 'CA', usNewsRank: 7, acceptanceRate: 2.7, tuition: 63471, avgSalary: 110000 },
  { name: 'Duke University', nameZh: '杜克大学', state: 'NC', usNewsRank: 7, acceptanceRate: 6.0, tuition: 66172, avgSalary: 88000 },
  { name: 'Brown University', nameZh: '布朗大学', state: 'RI', usNewsRank: 9, acceptanceRate: 5.1, tuition: 67458, avgSalary: 80000 },
  { name: 'Johns Hopkins University', nameZh: '约翰霍普金斯大学', state: 'MD', usNewsRank: 9, acceptanceRate: 6.5, tuition: 63340, avgSalary: 85000 },
  { name: 'Northwestern University', nameZh: '西北大学', state: 'IL', usNewsRank: 9, acceptanceRate: 7.0, tuition: 65997, avgSalary: 82000 },
  { name: 'Columbia University', nameZh: '哥伦比亚大学', state: 'NY', usNewsRank: 12, acceptanceRate: 3.9, tuition: 68400, avgSalary: 90000 },
  { name: 'Cornell University', nameZh: '康奈尔大学', state: 'NY', usNewsRank: 12, acceptanceRate: 7.3, tuition: 66014, avgSalary: 85000 },
  { name: 'University of Chicago', nameZh: '芝加哥大学', state: 'IL', usNewsRank: 12, acceptanceRate: 5.4, tuition: 66939, avgSalary: 88000 },
  { name: 'University of California, Berkeley', nameZh: '加州大学伯克利分校', state: 'CA', usNewsRank: 15, acceptanceRate: 11.6, tuition: 44066, avgSalary: 95000 },
  { name: 'University of California, Los Angeles', nameZh: '加州大学洛杉矶分校', state: 'CA', usNewsRank: 15, acceptanceRate: 8.6, tuition: 44830, avgSalary: 80000 },
  { name: 'Rice University', nameZh: '莱斯大学', state: 'TX', usNewsRank: 17, acceptanceRate: 7.7, tuition: 58128, avgSalary: 85000 },
  { name: 'Dartmouth College', nameZh: '达特茅斯学院', state: 'NH', usNewsRank: 18, acceptanceRate: 6.2, tuition: 65511, avgSalary: 85000 },
  { name: 'Vanderbilt University', nameZh: '范德堡大学', state: 'TN', usNewsRank: 18, acceptanceRate: 5.6, tuition: 63946, avgSalary: 78000 },
  { name: 'University of Notre Dame', nameZh: '圣母大学', state: 'IN', usNewsRank: 20, acceptanceRate: 12.9, tuition: 62693, avgSalary: 80000 },
  { name: 'University of Michigan, Ann Arbor', nameZh: '密歇根大学安娜堡分校', state: 'MI', usNewsRank: 21, acceptanceRate: 17.7, tuition: 57273, avgSalary: 82000 },
  { name: 'Georgetown University', nameZh: '乔治城大学', state: 'DC', usNewsRank: 22, acceptanceRate: 12.0, tuition: 65082, avgSalary: 80000 },
  { name: 'University of North Carolina at Chapel Hill', nameZh: '北卡罗来纳大学教堂山分校', state: 'NC', usNewsRank: 22, acceptanceRate: 16.8, tuition: 39338, avgSalary: 72000 },
  { name: 'Carnegie Mellon University', nameZh: '卡内基梅隆大学', state: 'PA', usNewsRank: 24, acceptanceRate: 11.0, tuition: 63829, avgSalary: 105000 },
  { name: 'Emory University', nameZh: '埃默里大学', state: 'GA', usNewsRank: 24, acceptanceRate: 11.4, tuition: 60774, avgSalary: 75000 },
  { name: 'University of Virginia', nameZh: '弗吉尼亚大学', state: 'VA', usNewsRank: 24, acceptanceRate: 18.6, tuition: 58950, avgSalary: 78000 },
  { name: 'Washington University in St. Louis', nameZh: '圣路易斯华盛顿大学', state: 'MO', usNewsRank: 24, acceptanceRate: 11.0, tuition: 63373, avgSalary: 78000 },
  { name: 'University of California, Davis', nameZh: '加州大学戴维斯分校', state: 'CA', usNewsRank: 28, acceptanceRate: 37.3, tuition: 44408, avgSalary: 72000 },
  { name: 'University of California, San Diego', nameZh: '加州大学圣地亚哥分校', state: 'CA', usNewsRank: 28, acceptanceRate: 24.7, tuition: 44487, avgSalary: 78000 },
  { name: 'University of Florida', nameZh: '佛罗里达大学', state: 'FL', usNewsRank: 28, acceptanceRate: 23.1, tuition: 28658, avgSalary: 68000 },
  { name: 'University of Southern California', nameZh: '南加州大学', state: 'CA', usNewsRank: 28, acceptanceRate: 9.9, tuition: 67005, avgSalary: 82000 },
  { name: 'University of Texas at Austin', nameZh: '德克萨斯大学奥斯汀分校', state: 'TX', usNewsRank: 32, acceptanceRate: 31.2, tuition: 41070, avgSalary: 78000 },
  { name: 'Georgia Institute of Technology', nameZh: '佐治亚理工学院', state: 'GA', usNewsRank: 33, acceptanceRate: 17.1, tuition: 33794, avgSalary: 90000 },
  { name: 'University of California, Irvine', nameZh: '加州大学尔湾分校', state: 'CA', usNewsRank: 33, acceptanceRate: 21.0, tuition: 43709, avgSalary: 72000 },
  { name: 'New York University', nameZh: '纽约大学', state: 'NY', usNewsRank: 35, acceptanceRate: 12.2, tuition: 60438, avgSalary: 78000 },
  { name: 'University of California, Santa Barbara', nameZh: '加州大学圣塔芭芭拉分校', state: 'CA', usNewsRank: 35, acceptanceRate: 25.9, tuition: 44196, avgSalary: 70000 },
  { name: 'University of Illinois Urbana-Champaign', nameZh: '伊利诺伊大学厄巴纳-香槟分校', state: 'IL', usNewsRank: 35, acceptanceRate: 44.8, tuition: 36068, avgSalary: 80000 },
  { name: 'University of Wisconsin-Madison', nameZh: '威斯康星大学麦迪逊分校', state: 'WI', usNewsRank: 35, acceptanceRate: 49.2, tuition: 40603, avgSalary: 72000 },
  { name: 'Boston College', nameZh: '波士顿学院', state: 'MA', usNewsRank: 39, acceptanceRate: 16.4, tuition: 66884, avgSalary: 75000 },
  { name: 'Rutgers University-New Brunswick', nameZh: '罗格斯大学新布朗斯维克分校', state: 'NJ', usNewsRank: 40, acceptanceRate: 66.1, tuition: 35636, avgSalary: 72000 },
  { name: 'Tufts University', nameZh: '塔夫茨大学', state: 'MA', usNewsRank: 40, acceptanceRate: 9.5, tuition: 67844, avgSalary: 78000 },
  { name: 'University of Washington', nameZh: '华盛顿大学', state: 'WA', usNewsRank: 40, acceptanceRate: 47.8, tuition: 41997, avgSalary: 82000 },
  { name: 'Boston University', nameZh: '波士顿大学', state: 'MA', usNewsRank: 43, acceptanceRate: 14.4, tuition: 65168, avgSalary: 72000 },
  { name: 'Ohio State University', nameZh: '俄亥俄州立大学', state: 'OH', usNewsRank: 43, acceptanceRate: 52.6, tuition: 36722, avgSalary: 70000 },
  { name: 'Purdue University', nameZh: '普渡大学', state: 'IN', usNewsRank: 43, acceptanceRate: 53.4, tuition: 28794, avgSalary: 78000 },
  { name: 'University of Maryland, College Park', nameZh: '马里兰大学帕克分校', state: 'MD', usNewsRank: 46, acceptanceRate: 44.5, tuition: 41426, avgSalary: 78000 },
  { name: 'Lehigh University', nameZh: '里海大学', state: 'PA', usNewsRank: 47, acceptanceRate: 37.0, tuition: 64380, avgSalary: 80000 },
  { name: 'Texas A&M University', nameZh: '德州农工大学', state: 'TX', usNewsRank: 47, acceptanceRate: 63.0, tuition: 40607, avgSalary: 72000 },
  { name: 'University of Georgia', nameZh: '佐治亚大学', state: 'GA', usNewsRank: 47, acceptanceRate: 42.8, tuition: 33818, avgSalary: 65000 },
  { name: 'Wake Forest University', nameZh: '维克森林大学', state: 'NC', usNewsRank: 47, acceptanceRate: 21.4, tuition: 64758, avgSalary: 70000 },
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
    console.log(`⏭️  Schools already exist (${existingSchoolCount}), skipping...`);
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
    console.log('✅ Demo user created (email: demo@example.com, password: Demo123!)');
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
    console.log('✅ Admin user created (email: admin@example.com, password: Admin123!)');
  }

  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });








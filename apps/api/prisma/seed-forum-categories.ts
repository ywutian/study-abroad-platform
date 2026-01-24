/**
 * 论坛分类种子数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FORUM_CATEGORIES = [
  {
    name: 'Application Experience',
    nameZh: '申请经验',
    description: 'Share your application journey, tips and lessons learned',
    descriptionZh: '分享申请历程、经验技巧和心得体会',
    icon: 'GraduationCap',
    color: '#6366f1', // indigo
    sortOrder: 1,
  },
  {
    name: 'Essay Discussion',
    nameZh: '文书讨论',
    description: 'Discuss essay topics, get feedback and share writing tips',
    descriptionZh: '讨论文书选题、互相反馈、分享写作技巧',
    icon: 'FileText',
    color: '#8b5cf6', // violet
    sortOrder: 2,
  },
  {
    name: 'School Selection',
    nameZh: '选校建议',
    description:
      'Get advice on school selection, compare programs and rankings',
    descriptionZh: '选校咨询、项目对比、排名讨论',
    icon: 'Building2',
    color: '#3b82f6', // blue
    sortOrder: 3,
  },
  {
    name: 'Team Up',
    nameZh: '组队找伴',
    description: 'Find study buddies, application partners and roommates',
    descriptionZh: '寻找学习伙伴、申请搭子、室友匹配',
    icon: 'Users',
    color: '#10b981', // emerald
    sortOrder: 4,
  },
  {
    name: 'Student Life',
    nameZh: '留学生活',
    description: 'Share campus life, visa tips, housing and more',
    descriptionZh: '校园生活、签证攻略、住宿交通等',
    icon: 'Globe',
    color: '#f59e0b', // amber
    sortOrder: 5,
  },
  {
    name: 'Q&A',
    nameZh: '问答互助',
    description: 'Ask questions and help others with their queries',
    descriptionZh: '提问求助、答疑解惑',
    icon: 'HelpCircle',
    color: '#ec4899', // pink
    sortOrder: 6,
  },
];

async function main() {
  console.log('📁 创建/更新论坛分类...\n');

  let created = 0;
  let updated = 0;

  for (const category of FORUM_CATEGORIES) {
    const result = await prisma.forumCategory.upsert({
      where: { nameZh: category.nameZh },
      update: {
        name: category.name,
        description: category.description,
        descriptionZh: category.descriptionZh,
        icon: category.icon,
        color: category.color,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: {
        ...category,
        isActive: true,
      },
    });

    const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
    if (isNew) {
      console.log(`✅ ${category.nameZh} (${category.name}) - 新建`);
      created++;
    } else {
      console.log(`🔄 ${category.nameZh} (${category.name}) - 已更新`);
      updated++;
    }
  }

  // Deactivate categories not in the seed list
  const seedNameZhs = FORUM_CATEGORIES.map((c) => c.nameZh);
  const { count: deactivated } = await prisma.forumCategory.updateMany({
    where: {
      nameZh: { notIn: seedNameZhs },
      isActive: true,
    },
    data: { isActive: false },
  });

  console.log('\n' + '='.repeat(50));
  console.log(`📊 完成: 新建 ${created}, 更新 ${updated}, 停用 ${deactivated}`);
}

main()
  .catch((e) => {
    console.error('❌ 失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

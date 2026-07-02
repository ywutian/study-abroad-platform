/**
 * 文书题目数据
 *
 * 来源: 学校官网公开信息
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SchoolEssay {
  prompt: string;
  promptZh: string;
  wordLimit: number;
  year: number;
}

// 学校补充文书
const SCHOOL_SUPPLEMENTS: Record<string, SchoolEssay[]> = {
  'Stanford University': [
    {
      prompt:
        'Reflect on an idea or experience that makes you genuinely excited about learning.',
      promptZh: '反思一个让你真正对学习感到兴奋的想法或经历。',
      wordLimit: 250,
      year: 2025,
    },
    {
      prompt:
        'Write a note to your future roommate that reveals something about you.',
      promptZh: '给你未来的室友写一封便条，透露一些关于你的事情。',
      wordLimit: 250,
      year: 2025,
    },
    {
      prompt: 'Tell us about something that is meaningful to you and why.',
      promptZh: '告诉我们对你有意义的事物及其原因。',
      wordLimit: 250,
      year: 2025,
    },
  ],
  'Harvard University': [
    {
      prompt:
        'How will your life experiences enable you to contribute to Harvard?',
      promptZh: '你的生活经历将如何使你为哈佛做出贡献？',
      wordLimit: 200,
      year: 2025,
    },
  ],
  'Massachusetts Institute of Technology': [
    {
      prompt: 'Tell us about something you do simply for the pleasure of it.',
      promptZh: '告诉我们一些你纯粹为了乐趣而做的事情。',
      wordLimit: 200,
      year: 2025,
    },
    {
      prompt: 'How has the world you come from shaped who you are today?',
      promptZh: '你来自的世界如何塑造了今天的你？',
      wordLimit: 200,
      year: 2025,
    },
  ],
  'Yale University': [
    {
      prompt: 'What is it about Yale that has led you to apply?',
      promptZh: '是什么让你申请耶鲁？',
      wordLimit: 125,
      year: 2025,
    },
  ],
  'Princeton University': [
    {
      prompt:
        'What song represents the soundtrack of your life at this moment?',
      promptZh: '什么歌曲代表了你目前人生的配乐？',
      wordLimit: 250,
      year: 2025,
    },
  ],
};

async function seedEssayPrompts() {
  console.log('📝 导入文书题目数据...\n');

  for (const [schoolName, essays] of Object.entries(SCHOOL_SUPPLEMENTS)) {
    const school = await prisma.school.findFirst({
      where: { name: schoolName },
    });

    if (school) {
      const currentMetadata =
        (school.metadata as Record<string, unknown>) || {};

      await prisma.school.update({
        where: { id: school.id },
        data: {
          metadata: {
            ...currentMetadata,
            essayPrompts: JSON.parse(JSON.stringify(essays)),
            essayYear: 2025,
          },
        },
      });
      console.log(`✅ ${schoolName}: ${essays.length} 篇补充文书`);
    } else {
      console.log(`⚠️ ${schoolName}: 学校未找到`);
    }
  }

  console.log('\n🎉 文书题目导入完成!');
}

seedEssayPrompts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

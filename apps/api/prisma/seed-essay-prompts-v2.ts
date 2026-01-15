/**
 * 文书题目种子数据 - Top 50 学校
 *
 * 数据来源: 学校官网公开信息 (2025-2026 申请季)
 */

import {
  PrismaClient,
  EssayType,
  EssayStatus,
  SourceType,
} from '@prisma/client';

const prisma = new PrismaClient();

interface EssayData {
  type: EssayType;
  prompt: string;
  promptZh: string;
  wordLimit: number;
  isRequired: boolean;
  aiTips?: string;
  aiCategory?: string;
}

// Top 50 学校文书数据
const SCHOOL_ESSAYS: Record<string, EssayData[]> = {
  'Stanford University': [
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'The Stanford community is deeply curious and driven to learn in and out of the classroom. Reflect on an idea or experience that makes you genuinely excited about learning.',
      promptZh:
        '斯坦福社区对学习充满好奇和热情。请反思一个让你真正对学习感到兴奋的想法或经历。',
      wordLimit: 250,
      isRequired: true,
      aiTips: '展示你对知识的真正热爱，可以是课堂内外的任何学习经历',
      aiCategory: '学术',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        "Virtually all of Stanford's undergraduates live on campus. Write a note to your future roommate that reveals something about you or that will help your roommate—and us—get to know you better.",
      promptZh:
        '几乎所有斯坦福本科生都住在校园里。给你未来的室友写一封便条，透露一些关于你的事情。',
      wordLimit: 250,
      isRequired: true,
      aiTips: '展示你真实的个性，可以幽默、温暖，让招生官看到生活中的你',
      aiCategory: '个人成长',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt: 'Tell us about something that is meaningful to you and why.',
      promptZh: '告诉我们对你有意义的事物及其原因。',
      wordLimit: 250,
      isRequired: true,
      aiTips: '选择一个真正重要的事物，深入解释它对你的影响',
      aiCategory: '个人成长',
    },
  ],
  'Harvard University': [
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'Harvard has long recognized the importance of enrolling a diverse student body. How will the life experiences that shape who you are today enable you to contribute to Harvard?',
      promptZh:
        '哈佛长期以来认识到招收多元化学生群体的重要性。你的生活经历如何塑造了今天的你，并使你能够为哈佛做出贡献？',
      wordLimit: 200,
      isRequired: false,
      aiTips: '强调你独特的背景和视角，以及你能为校园带来什么',
      aiCategory: '个人成长',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'Describe a time when you strongly disagreed with someone about an idea or issue. How did you communicate or engage with this person? What did you learn from this experience?',
      promptZh:
        '描述一次你与某人在某个想法或问题上强烈不同意的经历。你是如何与这个人沟通或交流的？你从这次经历中学到了什么？',
      wordLimit: 200,
      isRequired: false,
      aiTips: '展示你的沟通能力和开放心态，重点在于学习和成长',
      aiCategory: '社会责任',
    },
  ],
  'Massachusetts Institute of Technology': [
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'We know you lead a busy life, full of activities, many of which are required of you. Tell us about something you do simply for the pleasure of it.',
      promptZh:
        '我们知道你的生活很忙碌，充满了各种活动。告诉我们一些你纯粹为了乐趣而做的事情。',
      wordLimit: 200,
      isRequired: true,
      aiTips: '展示你的热情和个性，不需要是"有意义"的活动',
      aiCategory: '个人成长',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt: 'How has the world you come from shaped who you are today?',
      promptZh: '你来自的世界如何塑造了今天的你？',
      wordLimit: 200,
      isRequired: true,
      aiTips: '描述你的背景、社区或环境对你的影响',
      aiCategory: '个人成长',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        "Tell us about a significant challenge you've faced or something that didn't go according to plan. How did you manage the situation?",
      promptZh:
        '告诉我们你面临的一个重大挑战或一件没有按计划进行的事情。你是如何处理这种情况的？',
      wordLimit: 200,
      isRequired: true,
      aiTips: '重点展示你的问题解决能力和韧性',
      aiCategory: '个人成长',
    },
  ],
  'Yale University': [
    {
      type: EssayType.WHY_US,
      prompt: 'What is it about Yale that has led you to apply?',
      promptZh: '是什么让你申请耶鲁？',
      wordLimit: 125,
      isRequired: true,
      aiTips: '具体说明耶鲁的哪些方面吸引你，展示你对学校的了解',
      aiCategory: '学术',
    },
    {
      type: EssayType.SHORT_ANSWER,
      prompt: 'What inspires you?',
      promptZh: '什么激励着你？',
      wordLimit: 35,
      isRequired: true,
      aiTips: '简洁有力，展示你的核心价值观',
      aiCategory: '个人成长',
    },
    {
      type: EssayType.SHORT_ANSWER,
      prompt:
        "Yale's residential colleges regularly host conversations with guests representing a wide range of experiences and perspectives. What person, past or present, would you invite to speak? What question would you ask?",
      promptZh:
        '耶鲁的住宿学院定期邀请各种背景的嘉宾进行对话。你会邀请谁来演讲？你会问什么问题？',
      wordLimit: 35,
      isRequired: true,
      aiTips: '选择一个能反映你兴趣和价值观的人物',
      aiCategory: '创意思维',
    },
  ],
  'Princeton University': [
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'Princeton has a longstanding commitment to service and civic engagement. Tell us how your story intersects with these ideals.',
      promptZh:
        '普林斯顿长期致力于服务和公民参与。告诉我们你的故事如何与这些理念相交。',
      wordLimit: 250,
      isRequired: true,
      aiTips: '展示你的服务经历和对社区的贡献',
      aiCategory: '社会责任',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'Princeton values intellectual curiosity. Tell us about an idea, question, or topic that excites you.',
      promptZh: '普林斯顿重视求知欲。告诉我们一个让你兴奋的想法、问题或话题。',
      wordLimit: 250,
      isRequired: true,
      aiTips: '深入探讨一个你真正感兴趣的学术话题',
      aiCategory: '学术',
    },
    {
      type: EssayType.SHORT_ANSWER,
      prompt:
        'What song represents the soundtrack of your life at this moment?',
      promptZh: '什么歌曲代表了你目前人生的配乐？',
      wordLimit: 50,
      isRequired: true,
      aiTips: '选择一首有意义的歌曲，简要解释原因',
      aiCategory: '创意思维',
    },
  ],
  'Columbia University': [
    {
      type: EssayType.WHY_US,
      prompt: 'Why are you interested in attending Columbia University?',
      promptZh: '你为什么有兴趣就读哥伦比亚大学？',
      wordLimit: 200,
      isRequired: true,
      aiTips: '具体提及哥大的课程、资源或纽约的优势',
      aiCategory: '学术',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        "Columbia students take an active role in improving their community, whether in their residence hall, move-in neighborhood, or the world. Share one way you've contributed to your community.",
      promptZh: '哥大学生积极参与改善社区。分享你为社区做出贡献的一种方式。',
      wordLimit: 200,
      isRequired: true,
      aiTips: '展示你的领导力和对社区的影响',
      aiCategory: '社会责任',
    },
    {
      type: EssayType.SHORT_ANSWER,
      prompt:
        'List a few words or phrases that describe your ideal college community.',
      promptZh: '列出几个描述你理想大学社区的词或短语。',
      wordLimit: 35,
      isRequired: true,
      aiTips: '选择能反映你价值观的词汇',
      aiCategory: '个人成长',
    },
  ],
  'University of Pennsylvania': [
    {
      type: EssayType.WHY_US,
      prompt:
        'How will you explore your intellectual and academic interests at the University of Pennsylvania?',
      promptZh: '你将如何在宾夕法尼亚大学探索你的学术兴趣？',
      wordLimit: 200,
      isRequired: true,
      aiTips: '具体提及宾大的课程、研究机会或跨学科项目',
      aiCategory: '学术',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'At Penn, learning and growth happen outside of the classroom, too. How will you explore the community at Penn?',
      promptZh: '在宾大，学习和成长也发生在课堂之外。你将如何探索宾大的社区？',
      wordLimit: 200,
      isRequired: true,
      aiTips: '提及具体的社团、活动或社区项目',
      aiCategory: '课外',
    },
  ],
  'Duke University': [
    {
      type: EssayType.WHY_US,
      prompt:
        'What is your sense of Duke as a university and a community, and why do you consider it a good match for you?',
      promptZh:
        '你对杜克大学作为一所大学和社区的印象是什么？为什么你认为它适合你？',
      wordLimit: 250,
      isRequired: true,
      aiTips: '展示你对杜克文化的了解，以及你能如何融入',
      aiCategory: '学术',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        "Duke's commitment to diversity and inclusion includes sexual orientation, gender identity, and gender expression. If you would like to share with us more about your identity, you can do so here.",
      promptZh:
        '杜克对多元化和包容性的承诺包括性取向、性别认同和性别表达。如果你想与我们分享更多关于你身份的信息，可以在这里分享。',
      wordLimit: 250,
      isRequired: false,
      aiTips: '这是可选的，只有在你觉得舒适的情况下才分享',
      aiCategory: '个人成长',
    },
  ],
  'Northwestern University': [
    {
      type: EssayType.WHY_US,
      prompt: 'Why Northwestern?',
      promptZh: '为什么选择西北大学？',
      wordLimit: 300,
      isRequired: true,
      aiTips: '具体说明西北的哪些方面吸引你，展示你的研究',
      aiCategory: '学术',
    },
  ],
  'California Institute of Technology': [
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        "Caltech's mission is to expand human knowledge and benefit society through research integrated with education. How do you hope to contribute to this mission?",
      promptZh:
        '加州理工的使命是通过与教育相结合的研究来扩展人类知识并造福社会。你希望如何为这一使命做出贡献？',
      wordLimit: 200,
      isRequired: true,
      aiTips: '展示你对科学研究的热情和具体计划',
      aiCategory: '学术',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'Describe three experiences and/or activities that have helped develop your passion for a possible career in a STEM field.',
      promptZh: '描述三个帮助你培养对STEM领域可能职业热情的经历和/或活动。',
      wordLimit: 200,
      isRequired: true,
      aiTips: '选择最能展示你STEM能力和热情的经历',
      aiCategory: '学术',
    },
  ],
  'Brown University': [
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        "Brown's Open Curriculum allows students to explore broadly while also diving deep into their academic pursuits. Tell us about any academic interests that excite you.",
      promptZh:
        '布朗的开放课程允许学生广泛探索，同时深入学术追求。告诉我们任何让你兴奋的学术兴趣。',
      wordLimit: 200,
      isRequired: true,
      aiTips: '展示你如何利用开放课程探索多个领域',
      aiCategory: '学术',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'Brown students care deeply about their community. What kind of community do you hope to find at Brown?',
      promptZh: '布朗学生非常关心他们的社区。你希望在布朗找到什么样的社区？',
      wordLimit: 200,
      isRequired: true,
      aiTips: '描述你理想的大学社区，以及你能贡献什么',
      aiCategory: '社会责任',
    },
  ],
  'Cornell University': [
    {
      type: EssayType.WHY_US,
      prompt:
        'Students in Arts and Sciences embrace the opportunity to delve into multifaceted academic interests. Tell us about the areas of study you are excited to explore.',
      promptZh:
        '文理学院的学生拥抱深入探索多方面学术兴趣的机会。告诉我们你期待探索的学习领域。',
      wordLimit: 650,
      isRequired: true,
      aiTips: '展示你的学术好奇心和跨学科兴趣',
      aiCategory: '学术',
    },
  ],
  'University of Chicago': [
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'How does the University of Chicago, as you know it now, satisfy your desire for a particular kind of learning, community, and future?',
      promptZh:
        '就你目前所了解的，芝加哥大学如何满足你对特定学习、社区和未来的渴望？',
      wordLimit: 500,
      isRequired: true,
      aiTips: '展示你对芝大独特学术文化的了解',
      aiCategory: '学术',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'Extended Essay: Choose one of the six essay prompts. (Essay prompts change annually and are known for being creative and unconventional.)',
      promptZh:
        '扩展文书：从六个文书题目中选择一个。（题目每年更换，以创意和非传统著称。）',
      wordLimit: 650,
      isRequired: true,
      aiTips: '芝大的扩展文书鼓励创意和深度思考',
      aiCategory: '创意思维',
    },
  ],
  'Johns Hopkins University': [
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'Tell us about an aspect of your identity (e.g., race, gender, sexuality, religion, community) or a life experience that has shaped you as an individual.',
      promptZh:
        '告诉我们你身份的某个方面（如种族、性别、性取向、宗教、社区）或塑造你的生活经历。',
      wordLimit: 350,
      isRequired: true,
      aiTips: '选择一个真正定义你的方面，深入探讨其影响',
      aiCategory: '个人成长',
    },
  ],
  'Rice University': [
    {
      type: EssayType.WHY_US,
      prompt:
        'Please explain why you wish to study in the academic areas you selected.',
      promptZh: '请解释你为什么希望学习你选择的学术领域。',
      wordLimit: 150,
      isRequired: true,
      aiTips: '展示你对所选专业的热情和了解',
      aiCategory: '学术',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'The Rice/Baylor Medical Scholars program provides a unique opportunity for students interested in medicine. Please share why you are interested in this program.',
      promptZh:
        '莱斯/贝勒医学学者项目为对医学感兴趣的学生提供独特机会。请分享你为什么对这个项目感兴趣。',
      wordLimit: 500,
      isRequired: false,
      aiTips: '仅适用于申请医学学者项目的学生',
      aiCategory: '学术',
    },
  ],
  'Vanderbilt University': [
    {
      type: EssayType.WHY_US,
      prompt:
        'Vanderbilt offers a community where students find balance between their academic and social experiences. Please briefly elaborate on how one of your extracurricular activities or work experiences has influenced you.',
      promptZh:
        '范德堡提供一个学生在学术和社交经历之间找到平衡的社区。请简要阐述你的一项课外活动或工作经历如何影响了你。',
      wordLimit: 250,
      isRequired: true,
      aiTips: '选择最能展示你个性和成长的活动',
      aiCategory: '课外',
    },
  ],
  'University of Notre Dame': [
    {
      type: EssayType.WHY_US,
      prompt:
        'What excites you about the University of Notre Dame that makes it stand out from other institutions?',
      promptZh: '圣母大学有什么让你兴奋的地方，使它与其他学校不同？',
      wordLimit: 200,
      isRequired: true,
      aiTips: '展示你对圣母大学独特文化和价值观的了解',
      aiCategory: '学术',
    },
  ],
  'Georgetown University': [
    {
      type: EssayType.WHY_US,
      prompt:
        'Please elaborate on any special talents, experiences, achievements, or personal characteristics you bring to Georgetown.',
      promptZh:
        '请详细说明你为乔治城带来的任何特殊才能、经历、成就或个人特质。',
      wordLimit: 250,
      isRequired: true,
      aiTips: '选择最能展示你独特价值的方面',
      aiCategory: '个人成长',
    },
    {
      type: EssayType.SUPPLEMENT,
      prompt:
        'Georgetown is a diverse community. Discuss how your own background, identity, skills, or talents might contribute to our community.',
      promptZh:
        '乔治城是一个多元化的社区。讨论你的背景、身份、技能或才能如何为我们的社区做出贡献。',
      wordLimit: 250,
      isRequired: true,
      aiTips: '强调你能为校园多元化带来什么',
      aiCategory: '社会责任',
    },
  ],
  'Carnegie Mellon University': [
    {
      type: EssayType.WHY_US,
      prompt:
        "Most students choose their intended major or area of study based on a passion or inspiration that's Search for meaning. Describe your interest in your intended major.",
      promptZh:
        '大多数学生根据热情或灵感选择他们的预期专业。描述你对预期专业的兴趣。',
      wordLimit: 300,
      isRequired: true,
      aiTips: '展示你对所选专业的深入了解和热情',
      aiCategory: '学术',
    },
  ],
};

async function seedEssayPrompts() {
  console.log('📝 开始导入文书题目数据...\n');

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const [schoolName, essays] of Object.entries(SCHOOL_ESSAYS)) {
    const school = await prisma.school.findFirst({
      where: { name: schoolName },
    });

    if (!school) {
      console.log(`⚠️ ${schoolName}: 学校未找到，跳过`);
      continue;
    }

    for (let i = 0; i < essays.length; i++) {
      const essay = essays[i];

      // 检查是否已存在
      const existing = await prisma.essayPrompt.findFirst({
        where: {
          schoolId: school.id,
          year: 2025,
          prompt: essay.prompt,
        },
      });

      if (existing) {
        totalSkipped++;
        continue;
      }

      await prisma.essayPrompt.create({
        data: {
          schoolId: school.id,
          year: 2025,
          type: essay.type,
          prompt: essay.prompt,
          promptZh: essay.promptZh,
          wordLimit: essay.wordLimit,
          isRequired: essay.isRequired,
          sortOrder: i,
          status: EssayStatus.VERIFIED, // 手动数据直接标记为已验证
          aiTips: essay.aiTips,
          aiCategory: essay.aiCategory,
          sources: {
            create: {
              sourceType: SourceType.MANUAL,
              sourceUrl: 'seed-data',
              confidence: 1.0,
            },
          },
        },
      });

      totalCreated++;
    }

    console.log(`✅ ${schoolName}: ${essays.length} 篇文书`);
  }

  console.log(`\n🎉 文书题目导入完成!`);
  console.log(`   创建: ${totalCreated} 条`);
  console.log(`   跳过: ${totalSkipped} 条（已存在）`);
}

seedEssayPrompts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

/**
 * Seed script for agent_route_embeddings table.
 *
 * Generates embedding vectors for example queries and stores them in pgvector.
 * Re-running is safe: truncates the table before inserting.
 *
 * Usage:
 *   npx tsx prisma/seed-route-embeddings.ts
 *   npx tsx prisma/seed-route-embeddings.ts --dry-run  # Preview without inserting
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROUTE_EXAMPLES: Record<string, string[]> = {
  essay: [
    '帮我修改一下 Common App 的主文书',
    '我的 PS 写得怎么样',
    '文书开头怎么写才吸引人',
    '这篇 Why School 文书有什么问题',
    '帮我润色一下这段文书',
    '我的活动描述写得好不好',
    '续写一下我的个人陈述',
    '文书的结尾需要改进吗',
    '帮我写一篇补充文书大纲',
    '头脑风暴一下文书主题',
    'Can you review my supplemental essay for Stanford?',
    'How should I write my personal statement?',
    'Please polish my Common App essay',
    'What makes a good college essay opening?',
    'Help me brainstorm essay topics',
    'Review my Why Penn essay',
    'Is my essay too cliche?',
    'How can I make my essay more compelling?',
    'Edit my activity description for the Common App',
    'Generate an outline for my Columbia supplement',
  ],
  school: [
    '帮我看看这所大学怎么样',
    '我 SAT 1550 能申到什么学校',
    '对比一下 MIT 和 Stanford 的 CS 项目',
    '推荐几所保底校',
    '哪些学校的录取率比较高',
    '这所学校的排名怎么样',
    '帮我选几所冲刺校和匹配校',
    '公立和私立学校有什么区别',
    '藤校录取需要什么条件',
    '我的背景适合申请哪些学校',
    'Which schools should I apply to with a 3.8 GPA?',
    'Compare MIT and Caltech for CS',
    'Recommend some safety schools for me',
    'What is the acceptance rate for Stanford?',
    'Which Ivy League school is best for economics?',
    'Should I apply ED to Duke or Northwestern?',
    'How competitive is UC Berkeley for international students?',
    'What schools have strong CS programs?',
    'Is it worth applying to all Ivy League schools?',
    'Help me build a balanced school list',
  ],
  profile: [
    '帮我分析一下我的竞争力',
    '我的背景有什么短板',
    '怎么提升我的软实力',
    '我的 GPA 够不够',
    '科研经历对申请有多重要',
    '实习经历怎么在申请中展示',
    '我的课外活动够丰富吗',
    '帮我做一个背景评估',
    '我的标化成绩需要提高吗',
    '竞赛获奖对申请有帮助吗',
    'Analyze my profile for college admissions',
    'Is my GPA competitive enough for top schools?',
    'How important are extracurriculars?',
    'What are my strengths and weaknesses as an applicant?',
    'Should I retake the SAT?',
    'How can I improve my application profile?',
    'Is my research experience impressive enough?',
    'What activities should I focus on?',
    'Rate my profile for Ivy League admissions',
    'How do my test scores compare to admitted students?',
  ],
  timeline: [
    '申请的截止日期是什么时候',
    'ED 和 EA 有什么区别',
    '什么时候开始准备申请比较好',
    '帮我制定一个申请时间线',
    'RD 截止日期是哪天',
    '还来得及申请 EA 吗',
    '申请进度规划',
    '什么时候该考 SAT',
    '推荐信应该什么时候要',
    '暑假应该做什么准备',
    'When is the Early Decision deadline?',
    'Create a college application timeline for me',
    'Is it too late to apply EA?',
    'When should I start my college essays?',
    'What are the key deadlines for fall admission?',
    'Help me plan my application schedule',
    'When should I request recommendation letters?',
    'What should I do this summer to prepare?',
    'When do Regular Decision results come out?',
    'How should I plan my senior year timeline?',
  ],
  resume: [
    '帮我看看简历写得怎么样',
    '简历上的活动描述需要改进吗',
    '帮我优化简历的 bullet points',
    '我的简历格式合适吗',
    '简历应该包含哪些内容',
    '帮我生成简历内容建议',
    'Review my resume for college applications',
    'Optimize the bullet points on my resume',
    'What should I include in my activities resume?',
    'Help me write better resume descriptions',
    'Is my resume too long for college applications?',
    'Suggest content for my resume based on my profile',
  ],
};

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(
    isDryRun
      ? '🔍 Dry run — previewing without inserting'
      : '🚀 Seeding agent_route_embeddings...',
  );

  // Check if OpenAI API key is available
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is required to generate embeddings');
    process.exit(1);
  }

  let totalExamples = 0;
  for (const [agentType, examples] of Object.entries(ROUTE_EXAMPLES)) {
    console.log(`  ${agentType}: ${examples.length} examples`);
    totalExamples += examples.length;
  }
  console.log(`  Total: ${totalExamples} examples\n`);

  if (isDryRun) {
    console.log('✅ Dry run complete');
    return;
  }

  // Truncate existing data
  await prisma.$executeRaw`TRUNCATE TABLE agent_route_embeddings`;
  console.log('  Cleared existing embeddings');

  for (const [agentType, examples] of Object.entries(ROUTE_EXAMPLES)) {
    console.log(`  Embedding ${agentType} (${examples.length} queries)...`);

    // Batch embed via OpenAI
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: examples,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    // Insert each example with its embedding
    for (let i = 0; i < examples.length; i++) {
      const vectorStr = `[${data.data[i].embedding.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO agent_route_embeddings (id, agent_type, example, embedding, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3::vector, NOW(), NOW())`,
        agentType,
        examples[i],
        vectorStr,
      );
    }

    console.log(`    ✓ ${examples.length} embeddings stored`);
  }

  console.log(`\n✅ Seeded ${totalExamples} route embeddings`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

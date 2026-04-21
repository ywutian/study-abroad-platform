import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [
    competitionCount,
    activePoolRecords,
    officialContexts,
    mockUsersCount,
    mockTeams,
    publishedMockCards,
    publishedCardGroups,
  ] = await Promise.all([
    prisma.competition.count(),
    prisma.matchPool.findMany({
      where: { isActive: true },
      include: {
        entries: {
          where: { isActive: true },
          select: { id: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.recruitmentContext.findMany({
      where: {
        sourceType: 'OFFICIAL',
        isPublished: true,
        isActive: true,
      },
      select: {
        id: true,
        competitionTrack: {
          select: {
            name: true,
            competitionEdition: {
              select: {
                competition: {
                  select: {
                    abbreviation: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.user.count({
      where: {
        email: { endsWith: '@studyabroad.mock' },
      },
    }),
    prisma.team.findMany({
      where: {
        creator: {
          is: {
            email: { endsWith: '@studyabroad.mock' },
          },
        },
      },
      select: { id: true },
    }),
    prisma.teamRecruitmentCard.findMany({
      where: {
        phase: 'PUBLISHED',
        team: {
          is: {
            creator: {
              is: {
                email: { endsWith: '@studyabroad.mock' },
              },
            },
          },
        },
      },
      select: { id: true },
    }),
    prisma.teamRecruitmentCard.groupBy({
      by: ['recruitmentContextId'],
      where: {
        phase: 'PUBLISHED',
        isClosed: false,
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const activePoolCount = activePoolRecords.length;
  const officialContextCount = officialContexts.length;
  const mockTeamCount = mockTeams.length;
  const publishedMockCardCount = publishedMockCards.length;
  const cardCountByContext = new Map(
    publishedCardGroups.map((group) => [
      group.recruitmentContextId,
      group._count._all,
    ]),
  );

  const contextsWithoutCards = officialContexts.filter(
    (context) => (cardCountByContext.get(context.id) ?? 0) < 1,
  );
  const underfilledPools = activePoolRecords.filter(
    (pool) => pool.entries.length < 5,
  );
  const hmmtNovember = officialContexts.find(
    (context) =>
      context.competitionTrack?.competitionEdition.competition.abbreviation ===
        'HMMT' && context.competitionTrack?.name === 'November',
  );
  const hmmtNovemberCards = hmmtNovember
    ? (cardCountByContext.get(hmmtNovember.id) ?? 0)
    : 0;

  const checks = [
    {
      label: 'Competition',
      actual: competitionCount,
      expected: '>= 100',
      pass: competitionCount >= 100,
    },
    {
      label: 'Active MatchPool',
      actual: activePoolCount,
      expected: '>= 8',
      pass: activePoolCount >= 8,
    },
    {
      label: 'Official RecruitmentContext',
      actual: officialContextCount,
      expected: '>= 50',
      pass: officialContextCount >= 50,
    },
    {
      label: 'Mock User',
      actual: mockUsersCount,
      expected: '>= 30',
      pass: mockUsersCount >= 30,
    },
    {
      label: 'Mock Team',
      actual: mockTeamCount,
      expected: '>= 60',
      pass: mockTeamCount >= 60,
    },
    {
      label: 'Published Mock Card',
      actual: publishedMockCardCount,
      expected: '>= 80',
      pass: publishedMockCardCount >= 80,
    },
    {
      label: 'Pools With >=5 Entries',
      actual: `${activePoolCount - underfilledPools.length}/${activePoolCount}`,
      expected: `${activePoolCount}/${activePoolCount}`,
      pass: underfilledPools.length === 0,
    },
    {
      label: 'Official Contexts With Cards',
      actual: `${officialContextCount - contextsWithoutCards.length}/${officialContextCount}`,
      expected: `${officialContextCount}/${officialContextCount}`,
      pass: contextsWithoutCards.length === 0,
    },
    {
      label: 'HMMT November Cards',
      actual: hmmtNovemberCards,
      expected: '>= 20',
      pass: hmmtNovemberCards >= 20,
    },
  ];

  console.table(
    checks.map((check) => ({
      Check: check.label,
      Actual: check.actual,
      Expected: check.expected,
      Pass: check.pass ? 'yes' : 'no',
    })),
  );

  console.table(
    activePoolRecords.map((pool) => ({
      pool: pool.name,
      entries: pool.entries.length,
    })),
  );

  const failures = checks.filter((check) => !check.pass);
  if (failures.length > 0) {
    throw new Error(
      [
        'Seed verification failed.',
        ...failures.map(
          (check) =>
            `- ${check.label}: got ${check.actual}, expected ${check.expected}`,
        ),
        ...(underfilledPools.length > 0
          ? [
              `- Underfilled pools: ${underfilledPools
                .map((pool) => `${pool.name} (${pool.entries.length})`)
                .join(', ')}`,
            ]
          : []),
        ...(contextsWithoutCards.length > 0
          ? [
              `- Contexts without published cards: ${contextsWithoutCards
                .slice(0, 10)
                .map(
                  (context) =>
                    `${context.competitionTrack?.competitionEdition.competition.abbreviation ?? 'Unknown'} / ${context.competitionTrack?.name ?? 'Unknown'}`,
                )
                .join(', ')}`,
            ]
          : []),
      ].join('\n'),
    );
  }

  console.log('Seed verification passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

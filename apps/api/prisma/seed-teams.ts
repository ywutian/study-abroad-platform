/**
 * Team & Recruitment mock data seed
 *
 * Creates:
 *   - 3 CompetitionEditions + 5 CompetitionTracks (for existing competitions)
 *   - 6 Teams with memberships
 *   - 8 TeamRecruitmentCards (published + draft)
 *   - TeamRecruitmentMemberProfiles
 *   - Swipes + 2 Matches
 *
 * Idempotent — checks for existing data before creating.
 *
 * Usage:
 *   Called from seed.ts, or standalone:
 *   pnpm --filter api ts-node prisma/seed-teams.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedTeamData() {
  // ---------- idempotency check ----------
  const existingTeam = await prisma.team.findFirst();
  if (existingTeam) {
    console.log('⏭️  Team data already seeded, skipping...');
    return;
  }

  // ---------- fetch prerequisite users ----------
  const users = await Promise.all(
    [
      'demo@example.com',
      'xiaoming@test.com',
      'lisa@test.com',
      'wenshu@test.com',
      'toefl@test.com',
      'planner@test.com',
    ].map((email) => prisma.user.findUnique({ where: { email } })),
  );

  const [demo, xiaoming, lisa, wenshu, toefl, planner] = users;
  if (!demo || !xiaoming || !lisa || !wenshu) {
    console.log(
      '⚠️  Required test users not found — run main seed first. Skipping team seed.',
    );
    return;
  }

  // ---------- fetch or create competition tracks ----------
  // We need at least 3 competitions to create editions/tracks
  const competitions = await prisma.competition.findMany({
    take: 5,
    orderBy: { tier: 'desc' },
  });

  if (competitions.length < 3) {
    console.log(
      '⚠️  Need at least 3 competitions — run seed-competitions first. Skipping team seed.',
    );
    return;
  }

  console.log('🏫 Seeding team & recruitment data...');

  // Create CompetitionEditions + Tracks
  const trackData: {
    competitionIdx: number;
    seasonLabel: string;
    tracks: {
      name: string;
      rolePresets: string[];
      minTeamSize: number;
      maxTeamSize: number;
      languages: string[];
    }[];
  }[] = [
    {
      competitionIdx: 0, // highest-tier math competition
      seasonLabel: '2026-2027',
      tracks: [
        {
          name: 'Open Division',
          rolePresets: ['Team Lead', 'Problem Solver', 'Proof Writer'],
          minTeamSize: 2,
          maxTeamSize: 4,
          languages: ['English'],
        },
        {
          name: 'Junior Division',
          rolePresets: ['Team Lead', 'Problem Solver'],
          minTeamSize: 2,
          maxTeamSize: 3,
          languages: ['English', 'Mandarin'],
        },
      ],
    },
    {
      competitionIdx: 1,
      seasonLabel: '2026-2027',
      tracks: [
        {
          name: 'Research Track',
          rolePresets: ['Team Lead', 'Researcher', 'Data Analyst', 'Presenter'],
          minTeamSize: 2,
          maxTeamSize: 5,
          languages: ['English'],
        },
      ],
    },
    {
      competitionIdx: 2,
      seasonLabel: '2026-2027',
      tracks: [
        {
          name: 'Standard Track',
          rolePresets: ['Captain', 'Member'],
          minTeamSize: 3,
          maxTeamSize: 6,
          languages: ['English', 'Mandarin'],
        },
        {
          name: 'Innovation Track',
          rolePresets: ['Team Lead', 'Developer', 'Designer', 'Presenter'],
          minTeamSize: 2,
          maxTeamSize: 4,
          languages: ['English'],
        },
      ],
    },
  ];

  const createdTracks: string[] = []; // track IDs

  for (const ed of trackData) {
    const comp = competitions[ed.competitionIdx];
    const edition = await prisma.competitionEdition.create({
      data: {
        competitionId: comp.id,
        seasonLabel: ed.seasonLabel,
        status: 'ACTIVE',
        registrationOpenAt: new Date('2026-03-01'),
        registrationCloseAt: new Date('2026-09-01'),
        eventStartAt: new Date('2026-10-01'),
        eventEndAt: new Date('2026-12-15'),
      },
    });

    for (const t of ed.tracks) {
      const track = await prisma.competitionTrack.create({
        data: {
          competitionEditionId: edition.id,
          name: t.name,
          rolePresets: t.rolePresets,
          minTeamSize: t.minTeamSize,
          maxTeamSize: t.maxTeamSize,
          languages: t.languages,
          isActive: true,
        },
      });
      createdTracks.push(track.id);
    }
  }

  console.log(
    `  ✅ Created 3 competition editions with ${createdTracks.length} tracks`,
  );

  // ---------- create teams ----------
  const teamDefs = [
    {
      name: 'Alpha Math Squad',
      description:
        'Top-tier math competition team looking for passionate problem solvers. We meet weekly on Zoom to practice AMC/AIME problems.',
      creator: demo,
      visibility: 'PUBLIC' as const,
      joinPolicy: 'INVITE_ONLY' as const,
      maxMembers: 4,
      tags: ['Math', 'AMC', 'AIME', 'Olympiad'],
      members: [
        { user: xiaoming, role: 'MEMBER' as const },
        { user: lisa, role: 'MEMBER' as const },
      ],
    },
    {
      name: 'CS Research Lab',
      description:
        'Building an ML research project for science fair submission. Need someone strong in Python/PyTorch.',
      creator: xiaoming,
      visibility: 'PUBLIC' as const,
      joinPolicy: 'INVITE_ONLY' as const,
      maxMembers: 5,
      tags: ['CS', 'ML', 'Research', 'Python'],
      members: [{ user: demo, role: 'MEMBER' as const }],
    },
    {
      name: 'Debate Dream Team',
      description:
        'Preparing for national debate tournaments. Looking for experienced Lincoln-Douglas debaters.',
      creator: lisa,
      visibility: 'PUBLIC' as const,
      joinPolicy: 'OPEN' as const,
      maxMembers: 6,
      tags: ['Debate', 'LD', 'Public Forum'],
      members: [
        { user: wenshu, role: 'MEMBER' as const },
        ...(toefl ? [{ user: toefl, role: 'MEMBER' as const }] : []),
      ],
    },
    {
      name: 'Physics Olympiad Prep',
      description:
        'Study group for USAPhO preparation. We share problem sets and review solutions together.',
      creator: wenshu,
      visibility: 'UNLISTED' as const,
      joinPolicy: 'INVITE_ONLY' as const,
      maxMembers: 4,
      tags: ['Physics', 'USAPhO', 'Olympiad'],
      members: [],
    },
    {
      name: 'Startup Club',
      description:
        'Building a social impact startup for a business competition. Need a developer and a designer!',
      creator: demo,
      visibility: 'PUBLIC' as const,
      joinPolicy: 'OPEN' as const,
      maxMembers: 5,
      tags: ['Business', 'Startup', 'Social Impact'],
      members: [
        ...(planner ? [{ user: planner, role: 'MEMBER' as const }] : []),
      ],
    },
    {
      name: 'Solo Researcher',
      description:
        'Individual looking for teammates for upcoming science competitions.',
      creator: toefl || wenshu,
      visibility: 'PUBLIC' as const,
      joinPolicy: 'OPEN' as const,
      maxMembers: 3,
      tags: ['Science', 'Research'],
      members: [],
    },
  ];

  const createdTeams: { id: string; creatorId: string }[] = [];

  for (const def of teamDefs) {
    const team = await prisma.team.create({
      data: {
        name: def.name,
        description: def.description,
        creatorId: def.creator.id,
        visibility: def.visibility,
        joinPolicy: def.joinPolicy,
        maxMembers: def.maxMembers,
        tags: def.tags,
        members: {
          createMany: {
            data: [
              { userId: def.creator.id, role: 'OWNER' },
              ...def.members.map((m) => ({
                userId: m.user.id,
                role: m.role,
              })),
            ],
            skipDuplicates: true,
          },
        },
      },
    });
    createdTeams.push({ id: team.id, creatorId: def.creator.id });
  }

  console.log(`  ✅ Created ${createdTeams.length} teams with memberships`);

  // ---------- create recruitment cards ----------
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const cardDefs = [
    {
      teamIdx: 0, // Alpha Math Squad
      trackIdx: 0, // Open Division
      phase: 'PUBLISHED' as const,
      headline: 'AMC/AIME team seeking proof wizard',
      detailNote:
        'We practice 3x/week on Zoom. Looking for someone who has qualified for AIME at least once. We focus on Number Theory and Combinatorics.',
      highlightTitle: 'AIME Qualifiers',
      offerRoles: ['Team Lead', 'Problem Solver'],
      needRoles: ['Proof Writer'],
      skillTags: ['Number Theory', 'Combinatorics', 'Proof Writing', 'LaTeX'],
      availabilityBand: 'FIVE_TO_TEN_HOURS' as const,
      collaborationMode: 'ONLINE' as const,
      timezone: 'America/New_York',
      languages: ['English', 'Mandarin'],
      intentMode: 'TEAM_UP' as const,
    },
    {
      teamIdx: 1, // CS Research Lab
      trackIdx: 2, // Research Track
      phase: 'PUBLISHED' as const,
      headline: 'ML research team needs data pipeline expert',
      detailNote:
        'Working on a computer vision project for regenerative medicine image analysis. Paper submission target: November.',
      highlightTitle: 'Published Researchers',
      offerRoles: ['Team Lead', 'Researcher'],
      needRoles: ['Data Analyst', 'Presenter'],
      skillTags: ['Python', 'PyTorch', 'Computer Vision', 'Research'],
      availabilityBand: 'TEN_PLUS_HOURS' as const,
      collaborationMode: 'HYBRID' as const,
      timezone: 'America/Los_Angeles',
      city: 'San Francisco',
      languages: ['English'],
      intentMode: 'TEAM_UP' as const,
    },
    {
      teamIdx: 2, // Debate Dream Team
      trackIdx: 3, // Standard Track
      phase: 'PUBLISHED' as const,
      headline: 'National-level debate team recruiting!',
      detailNote:
        'We placed top 10 at state last year. Looking for someone passionate about policy debate with strong research skills.',
      highlightTitle: 'State Top 10',
      offerRoles: ['Captain'],
      needRoles: ['Member', 'Member'],
      skillTags: ['Policy Debate', 'Research', 'Public Speaking'],
      availabilityBand: 'FIVE_TO_TEN_HOURS' as const,
      collaborationMode: 'HYBRID' as const,
      timezone: 'America/Chicago',
      city: 'Chicago',
      languages: ['English'],
      intentMode: 'TEAM_UP' as const,
    },
    {
      teamIdx: 4, // Startup Club
      trackIdx: 4, // Innovation Track
      phase: 'PUBLISHED' as const,
      headline: 'Social impact startup needs full-stack dev',
      detailNote:
        'Building a platform to connect food banks with restaurants for surplus food redistribution. MVP due in 8 weeks.',
      highlightTitle: 'YC-inspired',
      offerRoles: ['Team Lead', 'Designer'],
      needRoles: ['Developer'],
      skillTags: [
        'React',
        'Node.js',
        'UI/UX',
        'Social Impact',
        'Business Plan',
      ],
      availabilityBand: 'TEN_PLUS_HOURS' as const,
      collaborationMode: 'ONLINE' as const,
      timezone: 'America/New_York',
      languages: ['English', 'Mandarin'],
      intentMode: 'TEAM_UP' as const,
    },
    {
      teamIdx: 5, // Solo Researcher
      trackIdx: 2, // Research Track
      phase: 'PUBLISHED' as const,
      headline: 'Looking for research partners in biology',
      detailNote:
        'Solo applicant interested in computational biology. Open to joining or forming a team.',
      highlightTitle: null,
      offerRoles: ['Researcher'],
      needRoles: ['Team Lead', 'Data Analyst'],
      skillTags: ['Biology', 'Bioinformatics', 'R', 'Statistics'],
      availabilityBand: 'LESS_THAN_5_HOURS' as const,
      collaborationMode: 'ONLINE' as const,
      timezone: 'Asia/Shanghai',
      languages: ['Mandarin', 'English'],
      intentMode: 'TEAM_UP' as const,
    },
    {
      teamIdx: 3, // Physics Olympiad Prep
      trackIdx: 1, // Junior Division
      phase: 'PUBLISHED' as const,
      headline: 'Physics study group open to juniors',
      detailNote:
        'Weekly problem-solving sessions focused on mechanics and thermodynamics. Chill vibe, serious practice.',
      highlightTitle: 'USAPhO Semifinalist',
      offerRoles: ['Team Lead'],
      needRoles: ['Problem Solver'],
      skillTags: ['Mechanics', 'Thermodynamics', 'Problem Solving'],
      availabilityBand: 'WEEKENDS_ONLY' as const,
      collaborationMode: 'ONLINE' as const,
      timezone: 'America/New_York',
      languages: ['English', 'Mandarin'],
      intentMode: 'NETWORKING_ONLY' as const,
    },
    // Draft cards
    {
      teamIdx: 0, // Alpha Math Squad — second card, draft
      trackIdx: 1, // Junior Division
      phase: 'DRAFT' as const,
      headline: 'Junior division team forming (draft)',
      detailNote: 'Work in progress — not yet published.',
      highlightTitle: null,
      offerRoles: ['Team Lead'],
      needRoles: ['Problem Solver'],
      skillTags: ['AMC 10', 'Math'],
      availabilityBand: null,
      collaborationMode: null,
      timezone: null,
      languages: ['English'],
      intentMode: 'TEAM_UP' as const,
    },
    {
      teamIdx: 4, // Startup Club — networking card
      trackIdx: 3, // Standard Track
      phase: 'PUBLISHED' as const,
      headline: 'Networking: meet other young entrepreneurs',
      detailNote:
        'Not looking for teammates right now, just want to connect with like-minded people in the business competition space.',
      highlightTitle: null,
      offerRoles: [],
      needRoles: [],
      skillTags: ['Networking', 'Entrepreneurship'],
      availabilityBand: 'LESS_THAN_5_HOURS' as const,
      collaborationMode: 'ONLINE' as const,
      timezone: 'America/New_York',
      languages: ['English'],
      intentMode: 'NETWORKING_ONLY' as const,
    },
  ];

  const createdCards: string[] = [];

  for (const def of cardDefs) {
    const team = createdTeams[def.teamIdx];
    const trackId = createdTracks[def.trackIdx];

    // Check unique constraint [teamId, competitionTrackId]
    const existing = await prisma.teamRecruitmentCard.findUnique({
      where: {
        teamId_competitionTrackId: {
          teamId: team.id,
          competitionTrackId: trackId,
        },
      },
    });
    if (existing) continue;

    const card = await prisma.teamRecruitmentCard.create({
      data: {
        teamId: team.id,
        competitionTrackId: trackId,
        phase: def.phase,
        headline: def.headline,
        detailNote: def.detailNote,
        highlightTitle: def.highlightTitle,
        offerRoles: def.offerRoles,
        needRoles: def.needRoles,
        skillTags: def.skillTags,
        availabilityBand: def.availabilityBand,
        collaborationMode: def.collaborationMode,
        timezone: def.timezone,
        city: def.city ?? null,
        languages: def.languages,
        intentMode: def.intentMode,
        publishedAt: def.phase === 'PUBLISHED' ? now : null,
        expiresAt: def.phase === 'PUBLISHED' ? in30Days : null,
        version: 1,
      },
    });
    createdCards.push(card.id);
  }

  console.log(`  ✅ Created ${createdCards.length} recruitment cards`);

  // ---------- member profiles on cards ----------
  // Add creator profiles to published cards
  const publishedCards = await prisma.teamRecruitmentCard.findMany({
    where: { phase: 'PUBLISHED' },
    include: { team: { include: { members: true } } },
  });

  let profileCount = 0;
  for (const card of publishedCards) {
    for (const member of card.team.members) {
      await prisma.teamRecruitmentMemberProfile.create({
        data: {
          teamRecruitmentCardId: card.id,
          userId: member.userId,
          introLine:
            member.role === 'OWNER'
              ? 'Team founder and lead organizer'
              : 'Team member ready to contribute',
          showSchool: true,
          showGrade: true,
          showAwards: member.role === 'OWNER',
          consentConfirmedAt: now,
        },
      });
      profileCount++;
    }
  }

  console.log(`  ✅ Created ${profileCount} recruitment member profiles`);

  // ---------- swipes ----------
  // Card 0 (Alpha Math) likes Card 1 (CS Research)
  // Card 1 (CS Research) likes Card 0 (Alpha Math) → mutual = match!
  // Card 2 (Debate) likes Card 3 (Startup)
  // Card 3 (Startup) likes Card 2 (Debate) → mutual = match!
  // Card 4 (Solo) likes Card 1 (CS Research) → one-sided
  // Card 0 (Alpha Math) passes Card 5 (Physics)

  if (createdCards.length >= 6) {
    const swipeDefs = [
      {
        sourceIdx: 0,
        targetIdx: 1,
        actedBy: demo,
        action: 'LIKE' as const,
      },
      {
        sourceIdx: 1,
        targetIdx: 0,
        actedBy: xiaoming,
        action: 'LIKE' as const,
      },
      {
        sourceIdx: 2,
        targetIdx: 3,
        actedBy: lisa,
        action: 'LIKE' as const,
      },
      {
        sourceIdx: 3,
        targetIdx: 2,
        actedBy: demo,
        action: 'LIKE' as const,
      },
      {
        sourceIdx: 4,
        targetIdx: 1,
        actedBy: toefl || wenshu,
        action: 'LIKE' as const,
      },
      {
        sourceIdx: 0,
        targetIdx: 5,
        actedBy: demo,
        action: 'PASS' as const,
      },
    ];

    for (const s of swipeDefs) {
      await prisma.teamRecruitmentSwipe.create({
        data: {
          sourceCardId: createdCards[s.sourceIdx],
          targetCardId: createdCards[s.targetIdx],
          actedById: s.actedBy.id,
          action: s.action,
          sourceVersion: 1,
          targetVersion: 1,
        },
      });
    }
    console.log(`  ✅ Created ${swipeDefs.length} swipes`);

    // ---------- matches (mutual likes) ----------
    await prisma.teamMatch.createMany({
      data: [
        {
          leftCardId: createdCards[0],
          rightCardId: createdCards[1],
          matchKind: 'TEAM_UP',
        },
        {
          leftCardId: createdCards[2],
          rightCardId: createdCards[3],
          matchKind: 'TEAM_UP',
        },
      ],
    });
    console.log('  ✅ Created 2 matches');
  }

  // ---------- invitation ----------
  if (toefl) {
    await prisma.teamInvitation.create({
      data: {
        teamId: createdTeams[0].id, // Alpha Math Squad
        inviterId: demo.id,
        inviteeId: toefl.id,
        status: 'PENDING',
        expiresAt: in30Days,
      },
    });
    console.log('  ✅ Created 1 pending invitation');
  }

  console.log('🎉 Team & recruitment seed completed!');
}

// Allow standalone execution
if (require.main === module) {
  seedTeamData()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  RecruitmentContextModerationStatus,
  RecruitmentContextSourceType,
  RecruitmentIntentMode,
  TeamMatchKind,
  TeamRecruitmentSwipeAction,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';
import { TeamRecruitmentService } from './team-recruitment.service';

describe('TeamRecruitmentService', () => {
  let service: TeamRecruitmentService;
  let prisma: PrismaService;
  let chatService: ChatService;
  let notificationService: NotificationService;

  const makeCard = (input: {
    id: string;
    teamId: string;
    teamName: string;
    memberIds: string[];
    offerRoles?: string[];
    recruitmentContextId?: string;
  }) =>
    ({
      id: input.id,
      teamId: input.teamId,
      recruitmentContextId: input.recruitmentContextId ?? 'rctx-1',
      phase: 'PUBLISHED',
      isClosed: false,
      version: 1,
      headline: `${input.teamName} headline`,
      detailNote: null,
      highlightTitle: null,
      offerRoles: input.offerRoles ?? ['Research'],
      needRoles: ['Design'],
      skillTags: ['Python'],
      availabilityBand: null,
      collaborationMode: null,
      timezone: null,
      city: null,
      languages: ['English'],
      intentMode: RecruitmentIntentMode.TEAM_UP,
      publishedAt: new Date(),
      expiresAt: null,
      updatedAt: new Date(),
      recruitmentContext: {
        id: input.recruitmentContextId ?? 'rctx-1',
        sourceType: RecruitmentContextSourceType.OFFICIAL,
        title: 'Math Modeling',
        titleZh: null,
        subtitle: 'IMMC · Math Modeling · 2026',
        description: null,
        sourceUrl: null,
        registrationCloseAt: null,
        eventStartAt: null,
        eventEndAt: null,
        locationMode: null,
        locationText: null,
        rolePresets: ['Research', 'Design'],
        minTeamSize: 2,
        maxTeamSize: 4,
        languages: ['English'],
        moderationStatus: RecruitmentContextModerationStatus.APPROVED,
        isPublished: true,
        publishedAt: new Date(),
        isActive: true,
        createdById: null,
        competitionTrackId: 'track-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        competitionTrack: {
          id: 'track-1',
          name: 'Math Modeling',
          rolePresets: ['Research', 'Design'],
          minTeamSize: 2,
          maxTeamSize: 4,
          languages: ['English'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          competitionEdition: {
            id: 'edition-1',
            seasonLabel: '2026',
            status: 'ACTIVE',
            registrationOpenAt: null,
            registrationCloseAt: null,
            eventStartAt: null,
            eventEndAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            competition: {
              id: 'comp-1',
              name: 'IMMC',
              abbreviation: 'IMMC',
              category: 'STEM',
              tier: 4,
            },
          },
        },
      },
      team: {
        id: input.teamId,
        name: input.teamName,
        description: null,
        visibility: 'PRIVATE',
        joinPolicy: 'INVITE_ONLY',
        maxMembers: 4,
        school: null,
        members: input.memberIds.map((memberId, index) => ({
          userId: memberId,
          role: index === 0 ? 'OWNER' : 'MEMBER',
          joinedAt: new Date(),
          user: {
            id: memberId,
            email: `${memberId}@example.com`,
            role: 'USER',
            profile: {
              nickname: memberId,
              avatarUrl: null,
              realName: memberId,
              currentSchool: 'Test High School',
              grade: '11',
              targetMajor: 'Economics',
            },
          },
        })),
      },
      memberProfiles: [],
    }) as any;

  const makeCommunityContext = (input: {
    id: string;
    createdById?: string;
    moderationStatus?: RecruitmentContextModerationStatus;
    isPublished?: boolean;
    isActive?: boolean;
    title?: string;
  }) =>
    ({
      id: input.id,
      sourceType: RecruitmentContextSourceType.COMMUNITY,
      title: input.title ?? 'Startup Weekend SF',
      titleZh: null,
      subtitle: 'Hybrid / San Francisco',
      description: 'Community-led hackathon',
      sourceUrl: 'https://example.com/event',
      registrationCloseAt: null,
      eventStartAt: null,
      eventEndAt: null,
      locationMode: 'HYBRID',
      locationText: 'San Francisco',
      rolePresets: ['Captain', 'Builder'],
      minTeamSize: 2,
      maxTeamSize: 4,
      languages: ['English'],
      moderationStatus:
        input.moderationStatus ??
        RecruitmentContextModerationStatus.PENDING_REVIEW,
      isPublished: input.isPublished ?? false,
      publishedAt: null,
      isActive: input.isActive ?? true,
      createdById: input.createdById ?? 'user-1',
      competitionTrackId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      competitionTrack: null,
    }) as any;

  beforeEach(async () => {
    const prismaMock: Record<string, any> = {
      matchPool: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      recruitmentContext: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      teamRecruitmentCard: {
        findUnique: jest.fn(),
      },
      teamRecruitmentSwipe: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      teamMatch: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      teamMembership: {
        findUnique: jest.fn(),
      },
      block: {
        findFirst: jest.fn(),
      },
      teamInvitation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (arg: any) => {
        if (typeof arg === 'function') {
          return arg(prismaMock);
        }
        return Promise.all(arg);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamRecruitmentService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: ChatService,
          useValue: {
            createMatchGroupConversation: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            createNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TeamRecruitmentService>(TeamRecruitmentService);
    prisma = module.get<PrismaService>(PrismaService);
    chatService = module.get<ChatService>(ChatService);
    notificationService = module.get<NotificationService>(NotificationService);
    jest.clearAllMocks();
  });

  it('lists active public match pools in a compact discovery payload', async () => {
    (prisma.matchPool.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'pool-1',
        name: 'Popular Main Competitions',
        description: 'Popular official competitions',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
      },
    ]);

    const result = await service.getMatchPools();

    expect(prisma.matchPool.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'pool-1',
          name: 'Popular Main Competitions',
          description: 'Popular official competitions',
        }),
      ],
    });
  });

  it('loads only the current user community contexts', async () => {
    (prisma.recruitmentContext.findMany as jest.Mock).mockResolvedValue([
      makeCommunityContext({
        id: 'ctx-1',
        createdById: 'user-1',
        moderationStatus: RecruitmentContextModerationStatus.PENDING_REVIEW,
      }),
    ]);

    const result = await service.getMyCommunityContexts('user-1');

    expect(prisma.recruitmentContext.findMany).toHaveBeenCalledWith({
      where: {
        sourceType: RecruitmentContextSourceType.COMMUNITY,
        createdById: 'user-1',
      },
      include: expect.any(Object),
      orderBy: [{ updatedAt: 'desc' }],
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'ctx-1',
        sourceType: RecruitmentContextSourceType.COMMUNITY,
        title: 'Startup Weekend SF',
        moderationStatus: RecruitmentContextModerationStatus.PENDING_REVIEW,
      }),
    ]);
  });

  it('filters official recruitment contexts by competition and keeps the context boundary canonical', async () => {
    (prisma.recruitmentContext.findMany as jest.Mock).mockResolvedValue([
      makeCard({
        id: 'card-context',
        teamId: 'team-a',
        teamName: 'Alpha',
        memberIds: ['owner-a'],
      }).recruitmentContext,
    ]);

    const result = await service.getRecruitmentContexts({
      sourceType: RecruitmentContextSourceType.OFFICIAL,
      competitionId: 'comp-1',
    });

    expect(prisma.recruitmentContext.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        sourceType: RecruitmentContextSourceType.OFFICIAL,
        isPublished: true,
        competitionTrack: {
          is: {
            isActive: true,
            competitionEdition: {
              is: {
                status: 'ACTIVE',
                competitionId: 'comp-1',
              },
            },
          },
        },
      },
      include: expect.any(Object),
      orderBy: [{ updatedAt: 'desc' }],
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'rctx-1',
        competitionId: 'comp-1',
        trackId: 'track-1',
      }),
    );
  });

  it('prevents rejected community contexts from being published', async () => {
    (prisma.recruitmentContext.findUnique as jest.Mock).mockResolvedValue(
      makeCommunityContext({
        id: 'ctx-1',
        createdById: 'user-1',
        moderationStatus: RecruitmentContextModerationStatus.REJECTED,
      }),
    );

    await expect(
      service.publishCommunityContext('ctx-1', 'user-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.recruitmentContext.update).not.toHaveBeenCalled();
  });

  it('creates one TEAM_UP match and one MATCH_GROUP conversation on reciprocal like', async () => {
    const sourceCard = makeCard({
      id: 'card-a',
      teamId: 'team-a',
      teamName: 'Alpha',
      memberIds: ['owner-a'],
      offerRoles: ['Pitch'],
    });
    const targetCard = makeCard({
      id: 'card-b',
      teamId: 'team-b',
      teamName: 'Beta',
      memberIds: ['owner-b'],
      offerRoles: ['Modeling'],
    });

    (prisma.teamRecruitmentCard.findUnique as jest.Mock)
      .mockResolvedValueOnce(sourceCard)
      .mockResolvedValueOnce(targetCard);
    (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue({
      role: 'OWNER',
    });
    (prisma.block.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.teamRecruitmentSwipe.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.teamRecruitmentSwipe.create as jest.Mock).mockResolvedValue({
      id: 'swipe-1',
      action: TeamRecruitmentSwipeAction.LIKE,
    });
    (prisma.teamRecruitmentSwipe.findFirst as jest.Mock).mockResolvedValue({
      id: 'reverse-like',
      action: TeamRecruitmentSwipeAction.LIKE,
    });
    (prisma.teamMatch.findFirst as jest.Mock).mockResolvedValue(null);
    (chatService.createMatchGroupConversation as jest.Mock).mockResolvedValue({
      id: 'conv-1',
    });
    (prisma.teamMatch.create as jest.Mock).mockResolvedValue({
      id: 'match-1',
      matchKind: TeamMatchKind.TEAM_UP,
    });

    const result = await service.swipe('card-a', 'owner-a', {
      targetCardId: 'card-b',
      action: TeamRecruitmentSwipeAction.LIKE,
    });

    expect(chatService.createMatchGroupConversation).toHaveBeenCalledTimes(1);
    expect(prisma.teamMatch.create).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      matched: true,
      match: {
        id: 'match-1',
        matchKind: TeamMatchKind.TEAM_UP,
        conversationId: 'conv-1',
      },
    });
  });

  it('rejects swipes across different recruitment contexts', async () => {
    const sourceCard = makeCard({
      id: 'card-a',
      teamId: 'team-a',
      teamName: 'Alpha',
      memberIds: ['owner-a'],
      recruitmentContextId: 'rctx-1',
    });
    const targetCard = makeCard({
      id: 'card-b',
      teamId: 'team-b',
      teamName: 'Beta',
      memberIds: ['owner-b'],
      recruitmentContextId: 'rctx-2',
    });

    (prisma.teamRecruitmentCard.findUnique as jest.Mock)
      .mockResolvedValueOnce(sourceCard)
      .mockResolvedValueOnce(targetCard);
    (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue({
      role: 'OWNER',
    });

    await expect(
      service.swipe('card-a', 'owner-a', {
        targetCardId: 'card-b',
        action: TeamRecruitmentSwipeAction.LIKE,
      }),
    ).rejects.toThrow('same recruitment context');
  });

  it('returns invite urls and sends notifications for matched members', async () => {
    (prisma.teamMatch.findUnique as jest.Mock).mockResolvedValue({
      id: 'match-1',
      closedAt: null,
      matchKind: TeamMatchKind.TEAM_UP,
      leftCard: {
        teamId: 'team-a',
        team: {
          id: 'team-a',
          name: 'Alpha',
          members: [{ userId: 'owner-a', role: 'OWNER' }],
        },
      },
      rightCard: {
        teamId: 'team-b',
        team: {
          id: 'team-b',
          name: 'Beta',
          members: [{ userId: 'invitee-1', role: 'MEMBER' }],
        },
      },
    });
    (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.teamInvitation.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.teamInvitation.create as jest.Mock).mockResolvedValue({
      id: 'inv-1',
    });
    (notificationService.createNotification as jest.Mock).mockResolvedValue({
      id: 'notif-1',
    });

    const result = await service.inviteMembers('match-1', 'owner-a', {
      sourceTeamId: 'team-a',
      inviteeIds: ['invitee-1'],
    });

    expect(result.invitations).toEqual([
      expect.objectContaining({
        inviteeId: 'invitee-1',
        status: 'SENT',
        invitationId: 'inv-1',
        token: expect.any(String),
        inviteUrl: expect.stringContaining('/teams/join?token='),
        notificationSent: true,
      }),
    ]);
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      'invitee-1',
      NotificationType.SYSTEM_BROADCAST,
      expect.objectContaining({
        actorId: 'owner-a',
        relatedType: 'team_invitation',
        relatedId: expect.any(String),
      }),
    );
  });
});

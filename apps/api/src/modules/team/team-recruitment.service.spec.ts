import { Test, TestingModule } from '@nestjs/testing';
import {
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
  }) =>
    ({
      id: input.id,
      teamId: input.teamId,
      competitionTrackId: 'track-1',
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
      competitionTrack: {
        id: 'track-1',
        name: 'Math Modeling',
        rolePresets: ['Research', 'Design'],
        minTeamSize: 2,
        maxTeamSize: 4,
        competitionEdition: {
          seasonLabel: '2026',
          competition: {
            id: 'comp-1',
            name: 'IMMC',
            abbreviation: 'IMMC',
            category: 'STEM',
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

  beforeEach(async () => {
    const prismaMock = {
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
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: typeof prismaMock) => Promise<unknown>)(
            prismaMock,
          );
        }
        return Promise.all(arg as Array<Promise<unknown>>);
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

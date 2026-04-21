import { Test, TestingModule } from '@nestjs/testing';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { TeamRecruitmentService } from './team-recruitment.service';

describe('TeamController', () => {
  let controller: TeamController;
  let teamService: jest.Mocked<TeamService>;
  let recruitmentService: jest.Mocked<TeamRecruitmentService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  const mockTeam = {
    id: 'team-1',
    name: 'Test Team',
    description: null,
    visibility: 'PUBLIC',
    joinPolicy: 'OPEN',
    maxMembers: 10,
    creatorId: 'user-1',
    schoolId: null,
    tags: null,
    memberCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamController],
      providers: [
        {
          provide: TeamService,
          useValue: {
            discover: jest.fn().mockResolvedValue({
              items: [mockTeam],
              total: 1,
              page: 1,
              pageSize: 20,
            }),
            findMy: jest.fn().mockResolvedValue([mockTeam]),
            create: jest.fn().mockResolvedValue(mockTeam),
            findById: jest
              .fn()
              .mockResolvedValue({ ...mockTeam, isMember: false, members: [] }),
            update: jest.fn().mockResolvedValue(mockTeam),
            join: jest.fn().mockResolvedValue(mockTeam),
            leave: jest.fn().mockResolvedValue({ success: true }),
            invite: jest.fn().mockResolvedValue({
              invitationId: 'inv-1',
              token: 't',
              expiresAt: new Date(),
            }),
            joinByToken: jest.fn().mockResolvedValue(mockTeam),
            disband: jest.fn().mockResolvedValue({ success: true }),
            transferOwner: jest.fn().mockResolvedValue({ success: true }),
            getMembers: jest.fn().mockResolvedValue([]),
            removeMember: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: TeamRecruitmentService,
          useValue: {
            getRecruitmentContexts: jest.fn().mockResolvedValue([]),
            getMyRecruitments: jest.fn().mockResolvedValue([]),
            getDeck: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({}),
            getById: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
            updateMemberProfile: jest.fn().mockResolvedValue({}),
            publish: jest.fn().mockResolvedValue({}),
            close: jest.fn().mockResolvedValue({}),
            swipe: jest.fn().mockResolvedValue({}),
            getMatches: jest.fn().mockResolvedValue([]),
            inviteMembers: jest.fn().mockResolvedValue({}),
            getMatchPools: jest.fn().mockResolvedValue({ items: [] }),
            getMatchPoolById: jest.fn().mockResolvedValue({ id: 'pool-1' }),
            getMyCommunityContexts: jest.fn().mockResolvedValue({ items: [] }),
            createCommunityContext: jest
              .fn()
              .mockResolvedValue({ id: 'ctx-1' }),
            updateCommunityContext: jest
              .fn()
              .mockResolvedValue({ id: 'ctx-1' }),
            publishCommunityContext: jest
              .fn()
              .mockResolvedValue({ id: 'ctx-1' }),
          },
        },
      ],
    }).compile();

    controller = module.get<TeamController>(TeamController);
    teamService = module.get(TeamService);
    recruitmentService = module.get(TeamRecruitmentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('discover', () => {
    it('should call teamService.discover with query', async () => {
      const query = { page: 1, pageSize: 20 };
      await controller.discover(query);
      expect(teamService.discover).toHaveBeenCalledWith(query);
    });
  });

  describe('findMy', () => {
    it('should call teamService.findMy with user id', async () => {
      await controller.findMy(mockUser);
      expect(teamService.findMy).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('findById', () => {
    it('should call teamService.findById with id and optional user id', async () => {
      await controller.findById('team-1');
      expect(teamService.findById).toHaveBeenCalledWith('team-1', undefined);
    });
    it('should pass user id when provided', async () => {
      await controller.findById('team-1', mockUser);
      expect(teamService.findById).toHaveBeenCalledWith('team-1', mockUser.id);
    });
  });

  describe('create', () => {
    it('should call teamService.create with user id and dto', async () => {
      const dto = {
        name: 'New Team',
        visibility: 'PUBLIC' as const,
        joinPolicy: 'OPEN' as const,
      };
      await controller.create(mockUser, dto as any);
      expect(teamService.create).toHaveBeenCalledWith(mockUser.id, dto);
    });
  });

  describe('transferOwner', () => {
    it('should call teamService.transferOwner with id, user id and newOwnerId', async () => {
      await controller.transferOwner('team-1', mockUser, {
        newOwnerId: 'user-2',
      });
      expect(teamService.transferOwner).toHaveBeenCalledWith(
        'team-1',
        mockUser.id,
        'user-2',
      );
    });
  });

  describe('getRecruitmentContexts', () => {
    it('should call recruitmentService.getRecruitmentContexts with the query', async () => {
      const query = { sourceType: 'OFFICIAL', competitionId: 'comp-1' };

      await controller.getRecruitmentContexts(query as any);

      expect(recruitmentService.getRecruitmentContexts).toHaveBeenCalledWith(
        query,
      );
    });
  });

  describe('getMatchPools', () => {
    it('should return active match pools from the recruitment service', async () => {
      await controller.getMatchPools();

      expect(recruitmentService.getMatchPools).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMatchPoolById', () => {
    it('should call recruitmentService.getMatchPoolById with the pool id', async () => {
      await controller.getMatchPoolById('pool-1');

      expect(recruitmentService.getMatchPoolById).toHaveBeenCalledWith(
        'pool-1',
      );
    });
  });

  describe('getCommunityContexts', () => {
    it('should only load the current user community contexts', async () => {
      await controller.getCommunityContexts(mockUser);

      expect(recruitmentService.getMyCommunityContexts).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe('createCommunityContext', () => {
    it('should call recruitmentService.createCommunityContext with the current user id', async () => {
      const dto = {
        title: 'Startup Weekend SF',
        minTeamSize: 2,
        maxTeamSize: 4,
        languages: ['English'],
      };

      await controller.createCommunityContext(mockUser, dto as any);

      expect(recruitmentService.createCommunityContext).toHaveBeenCalledWith(
        mockUser.id,
        dto,
      );
    });
  });

  describe('updateCommunityContext', () => {
    it('should call recruitmentService.updateCommunityContext with id, user id and dto', async () => {
      const dto = {
        title: 'Updated Startup Weekend SF',
      };

      await controller.updateCommunityContext('ctx-1', mockUser, dto as any);

      expect(recruitmentService.updateCommunityContext).toHaveBeenCalledWith(
        'ctx-1',
        mockUser.id,
        dto,
      );
    });
  });

  describe('publishCommunityContext', () => {
    it('should publish the selected community context for the current user', async () => {
      await controller.publishCommunityContext('ctx-1', mockUser);

      expect(recruitmentService.publishCommunityContext).toHaveBeenCalledWith(
        'ctx-1',
        mockUser.id,
      );
    });
  });

  describe('createRecruitment', () => {
    it('should forward recruitmentContextId-based card creation to the recruitment service', async () => {
      const dto = {
        teamId: 'team-1',
        recruitmentContextId: 'ctx-1',
        headline: 'Need a strong presenter',
      };

      await controller.createRecruitment(mockUser, dto as any);

      expect(recruitmentService.create).toHaveBeenCalledWith(mockUser.id, dto);
    });
  });

  describe('updateRecruitment', () => {
    it('should forward recruitment card updates with the current user id', async () => {
      const dto = {
        recruitmentContextId: 'ctx-2',
        headline: 'Updated headline',
      };

      await controller.updateRecruitment('card-1', mockUser, dto as any);

      expect(recruitmentService.update).toHaveBeenCalledWith(
        'card-1',
        mockUser.id,
        dto,
      );
    });
  });
});

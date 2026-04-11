import { Test, TestingModule } from '@nestjs/testing';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { TeamRecruitmentService } from './team-recruitment.service';

describe('TeamController', () => {
  let controller: TeamController;
  let teamService: TeamService;

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
          },
        },
      ],
    }).compile();

    controller = module.get<TeamController>(TeamController);
    teamService = module.get<TeamService>(TeamService);
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
});

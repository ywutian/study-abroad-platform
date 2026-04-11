import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuditLogService,
  AuditAction,
} from '../../common/services/audit-log.service';

describe('TeamService', () => {
  let service: TeamService;
  let prisma: PrismaService;
  let auditLog: AuditLogService;

  const userId = 'user-owner';
  const teamId = 'team-1';
  const otherUserId = 'user-other';

  const mockTeam = {
    id: teamId,
    name: 'Test Team',
    description: null,
    visibility: 'PUBLIC' as const,
    joinPolicy: 'OPEN' as const,
    maxMembers: 10,
    creatorId: userId,
    schoolId: null,
    tags: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { members: 2 },
    school: null,
    creator: null,
    members: [],
  };

  const mockMembership = {
    id: 'mem-1',
    teamId,
    userId,
    role: 'OWNER' as const,
    joinedAt: new Date(),
    team: { ...mockTeam, _count: { members: 2 } },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        {
          provide: PrismaService,
          useValue: {
            team: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            teamMembership: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn().mockResolvedValue({}),
              delete: jest.fn(),
              count: jest.fn(),
            },
            teamInvitation: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            teamRecruitmentCard: {
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            $transaction: jest.fn((ops) =>
              Promise.all(
                ops.map((op: () => unknown) =>
                  typeof op === 'function' ? op() : op,
                ),
              ),
            ),
          },
        },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    prisma = module.get<PrismaService>(PrismaService);
    auditLog = module.get<AuditLogService>(AuditLogService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create team and log TEAM_CREATE', async () => {
      const dto = {
        name: 'New Team',
        visibility: 'PUBLIC' as const,
        joinPolicy: 'OPEN' as const,
      };
      (prisma.team.create as jest.Mock).mockResolvedValue({
        ...mockTeam,
        id: 'team-new',
        name: dto.name,
        _count: { members: 1 },
      });
      await service.create(userId, dto);
      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creatorId: userId,
            name: dto.name,
            visibility: dto.visibility,
            joinPolicy: dto.joinPolicy,
            members: { create: { userId, role: 'OWNER' } },
          }),
        }),
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          action: AuditAction.TEAM_CREATE,
          resource: 'teams',
          resourceId: 'team-new',
        }),
      );
    });
  });

  describe('join', () => {
    it('should add member when OPEN and not full', async () => {
      const teamForJoin = {
        ...mockTeam,
        joinPolicy: 'OPEN',
        _count: { members: 1 },
      };
      const teamForFindById = {
        ...mockTeam,
        members: [
          {
            userId: otherUserId,
            role: 'MEMBER',
            user: {},
            id: 'm1',
            joinedAt: new Date(),
          },
        ],
        _count: { members: 2 },
      };
      (prisma.team.findUnique as jest.Mock)
        .mockResolvedValueOnce(teamForJoin)
        .mockResolvedValueOnce(teamForFindById);
      (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.teamMembership.create as jest.Mock).mockResolvedValue({});
      await service.join(teamId, otherUserId);
      expect(prisma.teamMembership.create).toHaveBeenCalledWith({
        data: { teamId, userId: otherUserId, role: 'MEMBER' },
      });
    });

    it('should throw when team not found', async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.join(teamId, otherUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when invite-only', async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        ...mockTeam,
        joinPolicy: 'INVITE_ONLY',
        _count: { members: 1 },
      });
      await expect(service.join(teamId, otherUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('leave', () => {
    it('should disband when last member leaves', async () => {
      (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue({
        ...mockMembership,
        team: { ...mockTeam, _count: { members: 1 } },
      });
      (prisma.teamMembership.count as jest.Mock).mockResolvedValue(1);
      (prisma.team.delete as jest.Mock).mockResolvedValue({});
      const result = await service.leave(teamId, userId);
      expect(prisma.team.delete).toHaveBeenCalledWith({
        where: { id: teamId },
      });
      expect(prisma.teamMembership.delete).not.toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.TEAM_DISBAND,
          metadata: { action: 'disband_last_leave' },
        }),
      );
      expect(result).toEqual({ success: true });
    });

    it('should remove membership when not last member', async () => {
      (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue({
        ...mockMembership,
        userId: otherUserId,
        role: 'MEMBER',
        team: { ...mockTeam, _count: { members: 2 } },
      });
      (prisma.teamMembership.delete as jest.Mock).mockResolvedValue({});
      await service.leave(teamId, otherUserId);
      expect(prisma.teamMembership.delete).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId, userId: otherUserId } },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.TEAM_LEAVE }),
      );
    });
  });

  describe('disband', () => {
    it('should delete team and log when owner', async () => {
      (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue({
        role: 'OWNER',
      });
      (prisma.team.delete as jest.Mock).mockResolvedValue({});
      await service.disband(teamId, userId);
      expect(prisma.team.delete).toHaveBeenCalledWith({
        where: { id: teamId },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.TEAM_DISBAND }),
      );
    });

    it('should throw when not owner', async () => {
      (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue({
        role: 'MEMBER',
      });
      await expect(service.disband(teamId, otherUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('invite', () => {
    it('should create invitation when no duplicate PENDING', async () => {
      (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue({
        role: 'OWNER',
      });
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        ...mockTeam,
        _count: { members: 1 },
      });
      (prisma.teamMembership.findUnique as jest.Mock)
        .mockResolvedValueOnce({ role: 'OWNER' })
        .mockResolvedValueOnce(null);
      (prisma.teamInvitation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.teamInvitation.create as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        token: 'abc',
        expiresAt: new Date(),
      });
      const result = await service.invite(teamId, userId, {
        inviteeId: otherUserId,
      });
      expect(prisma.teamInvitation.create).toHaveBeenCalled();
      expect(result).toHaveProperty('token');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.TEAM_INVITE }),
      );
    });

    it('should throw Conflict when duplicate PENDING invite exists', async () => {
      (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue({
        role: 'OWNER',
      });
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        ...mockTeam,
        _count: { members: 1 },
      });
      (prisma.teamInvitation.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-existing',
        expiresAt: new Date(Date.now() + 86400000),
      });
      await expect(
        service.invite(teamId, userId, { inviteeId: otherUserId }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.teamInvitation.create).not.toHaveBeenCalled();
    });
  });

  describe('joinByToken', () => {
    it('should mark expired invitations and reject the join', async () => {
      (prisma.teamInvitation.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-expired',
        teamId,
        expiresAt: new Date(Date.now() - 60_000),
        team: { maxMembers: 4, _count: { members: 1 } },
      });

      await expect(
        service.joinByToken(otherUserId, 'expired-token'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.teamInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-expired' },
        data: { status: 'EXPIRED' },
      });
    });

    it('should reject when the invitee is already a member', async () => {
      (prisma.teamInvitation.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        teamId,
        expiresAt: new Date(Date.now() + 60_000),
        team: { maxMembers: 4, _count: { members: 1 } },
      });
      (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue({
        id: 'mem-existing',
      });

      await expect(
        service.joinByToken(otherUserId, 'valid-token'),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject when the team is already full', async () => {
      (prisma.teamInvitation.findFirst as jest.Mock).mockResolvedValue({
        id: 'inv-full',
        teamId,
        expiresAt: new Date(Date.now() + 60_000),
        team: { maxMembers: 2, _count: { members: 2 } },
      });
      (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.joinByToken(otherUserId, 'full-token'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transferOwner', () => {
    it('should update roles and log TEAM_TRANSFER_OWNER', async () => {
      (prisma.teamMembership.findUnique as jest.Mock)
        .mockResolvedValueOnce({ role: 'OWNER' })
        .mockResolvedValueOnce({ role: 'MEMBER' });
      (prisma.$transaction as jest.Mock).mockImplementation((ops) =>
        Promise.all(
          ops.map((op: () => unknown) =>
            typeof op === 'function' ? op() : op,
          ),
        ),
      );
      await service.transferOwner(teamId, userId, otherUserId);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.TEAM_TRANSFER_OWNER,
          metadata: expect.objectContaining({ newOwnerId: otherUserId }),
        }),
      );
    });

    it('should throw when transferring to self', async () => {
      (prisma.teamMembership.findUnique as jest.Mock).mockResolvedValue({
        role: 'OWNER',
      });
      await expect(
        service.transferOwner(teamId, userId, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should throw NotFound when team does not exist', async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.findById(teamId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

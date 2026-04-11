import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuditLogService,
  AuditAction,
} from '../../common/services/audit-log.service';
import type {
  TeamVisibility,
  TeamJoinPolicy,
  TeamMemberRole,
} from '@prisma/client';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { InviteDto } from './dto/invite.dto';
import { TeamQueryDto } from './dto/team-query.dto';
import { randomBytes } from 'crypto';
import { TEAM_USER_SELECT } from './team.constants';
import { SCHOOL_NAME_SELECT } from '../../common/constants/prisma-selects';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Discover: only PUBLIC teams (or UNLISTED if we add link-based discover later). */
  async discover(query: TeamQueryDto) {
    const {
      page = 1,
      pageSize = 20,
      schoolId,
      visibility,
      joinPolicy,
      sort,
    } = query;
    const where: {
      visibility: TeamVisibility;
      schoolId?: string;
      joinPolicy?: TeamJoinPolicy;
    } = {
      visibility: visibility ?? 'PUBLIC',
    };
    if (schoolId) where.schoolId = schoolId;
    if (joinPolicy) where.joinPolicy = joinPolicy;

    const orderBy =
      sort === 'members'
        ? { members: { _count: 'desc' as const } }
        : { createdAt: 'desc' as const };

    const [items, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        include: {
          creator: {
            select: TEAM_USER_SELECT,
          },
          school: { select: SCHOOL_NAME_SELECT },
          _count: { select: { members: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.team.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        visibility: t.visibility,
        joinPolicy: t.joinPolicy,
        maxMembers: t.maxMembers,
        schoolId: t.schoolId,
        school: t.school,
        tags: t.tags,
        creatorId: t.creatorId,
        creator: t.creator,
        memberCount: t._count.members,
        createdAt: t.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** My teams: teams where user is a member. */
  async findMy(userId: string) {
    const memberships = await this.prisma.teamMembership.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            school: { select: SCHOOL_NAME_SELECT },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => ({
      ...m.team,
      memberCount: m.team._count.members,
      myRole: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /** Create team and add creator as OWNER. */
  async create(userId: string, dto: CreateTeamDto) {
    const team = await this.prisma.team.create({
      data: {
        creatorId: userId,
        name: dto.name,
        description: dto.description,
        schoolId: dto.schoolId,
        tags: dto.tags ?? undefined,
        visibility: dto.visibility,
        joinPolicy: dto.joinPolicy,
        maxMembers: dto.maxMembers,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
      include: {
        school: { select: SCHOOL_NAME_SELECT },
        _count: { select: { members: true } },
      },
    });
    await this.auditLog.log({
      userId,
      action: AuditAction.TEAM_CREATE,
      resource: 'teams',
      resourceId: team.id,
      metadata: { action: 'create' },
    });
    return team;
  }

  /** Get team by id; enforce visibility (PUBLIC/UNLISTED anyone, PRIVATE only members). */
  async findById(id: string, userId?: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        creator: { select: TEAM_USER_SELECT },
        school: { select: SCHOOL_NAME_SELECT },
        members: {
          include: {
            user: { select: TEAM_USER_SELECT },
          },
        },
        _count: { select: { members: true } },
      },
    });
    if (!team) throw new NotFoundException('Team not found');

    const isMember = userId
      ? team.members.some((m) => m.userId === userId)
      : false;
    if (team.visibility === 'PRIVATE' && !isMember)
      throw new ForbiddenException('You do not have access to this team');

    return {
      ...team,
      memberCount: team._count.members,
      isMember,
      myRole: isMember
        ? team.members.find((m) => m.userId === userId)?.role
        : null,
    };
  }

  /** Update team; only OWNER or ADMIN. */
  async update(id: string, userId: string, dto: UpdateTeamDto) {
    await this.ensureMemberRole(id, userId, ['OWNER', 'ADMIN']);
    const before = await this.prisma.team.findUnique({
      where: { id },
      select: { maxMembers: true },
    });
    const team = await this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        schoolId: dto.schoolId,
        tags: dto.tags,
        visibility: dto.visibility,
        joinPolicy: dto.joinPolicy,
        maxMembers: dto.maxMembers,
      },
      include: {
        school: { select: SCHOOL_NAME_SELECT },
        _count: { select: { members: true } },
      },
    });
    if (before?.maxMembers !== team.maxMembers) {
      await this.invalidateRecruitmentCards(id);
    }
    return team;
  }

  /** Join (OPEN only); user must not already be member; team not full. */
  async join(teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { _count: { select: { members: true } } },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.joinPolicy !== 'OPEN')
      throw new ForbiddenException('This team is invite-only');
    const existing = await this.prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (existing) throw new ConflictException('Already a member');
    if (team.maxMembers != null && team._count.members >= team.maxMembers)
      throw new ConflictException('Team is full');

    await this.prisma.teamMembership.create({
      data: { teamId, userId, role: 'MEMBER' },
    });
    await this.invalidateRecruitmentCards(teamId);
    return this.findById(teamId, userId);
  }

  /** Leave; if last member, team is disbanded. If OWNER with other members, must transfer or disband first. */
  async leave(teamId: string, userId: string) {
    const membership = await this.prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: { team: { include: { _count: { select: { members: true } } } } },
    });
    if (!membership)
      throw new NotFoundException('Team or membership not found');
    if (membership.role === 'OWNER') {
      const ownerCount = await this.prisma.teamMembership.count({
        where: { teamId, role: 'OWNER' },
      });
      if (ownerCount <= 1 && membership.team._count.members > 1)
        throw new BadRequestException(
          'Transfer ownership or disband before leaving',
        );
    }
    const isLastMember = membership.team._count.members === 1;
    if (isLastMember) {
      await this.prisma.team.delete({ where: { id: teamId } });
      await this.auditLog.log({
        userId,
        action: AuditAction.TEAM_DISBAND,
        resource: 'teams',
        resourceId: teamId,
        metadata: { action: 'disband_last_leave' },
      });
      return { success: true };
    }
    await this.prisma.teamMembership.delete({
      where: { teamId_userId: { teamId, userId } },
    });
    await this.invalidateRecruitmentCards(teamId);
    await this.auditLog.log({
      userId,
      action: AuditAction.TEAM_LEAVE,
      resource: 'teams',
      resourceId: teamId,
      metadata: { action: 'leave' },
    });
    return { success: true };
  }

  /** Invite: create invitation; OWNER/ADMIN only; team not full; invitee not already member (or omit inviteeId for shareable link). */
  async invite(teamId: string, userId: string, dto: InviteDto) {
    await this.ensureMemberRole(teamId, userId, ['OWNER', 'ADMIN']);
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { _count: { select: { members: true } } },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.maxMembers != null && team._count.members >= team.maxMembers)
      throw new ConflictException('Team is full');
    if (dto.inviteeId) {
      const alreadyMember = await this.prisma.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId: dto.inviteeId } },
      });
      if (alreadyMember)
        throw new ConflictException('User is already a member');
      const existingPending = await this.prisma.teamInvitation.findFirst({
        where: { teamId, inviteeId: dto.inviteeId, status: 'PENDING' },
      });
      if (existingPending) {
        if (existingPending.expiresAt < new Date()) {
          await this.prisma.teamInvitation.update({
            where: { id: existingPending.id },
            data: { status: 'EXPIRED' },
          });
        } else {
          throw new ConflictException(
            'Pending invite already exists for this user',
          );
        }
      }
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.teamInvitation.create({
      data: {
        teamId,
        inviterId: userId,
        inviteeId: dto.inviteeId ?? null,
        token,
        status: 'PENDING',
        expiresAt,
      },
    });
    await this.auditLog.log({
      userId,
      action: AuditAction.TEAM_INVITE,
      resource: 'teams',
      resourceId: teamId,
      metadata: { action: 'invite_sent', invitationId: invitation.id },
    });
    return { invitationId: invitation.id, token, expiresAt };
  }

  /** Accept invite by token; add user as MEMBER; mark invitation ACCEPTED. */
  async joinByToken(userId: string, token: string) {
    const inv = await this.prisma.teamInvitation.findFirst({
      where: { token, status: 'PENDING' },
      include: { team: { include: { _count: { select: { members: true } } } } },
    });
    if (!inv) throw new NotFoundException('Invitation not found or expired');
    if (inv.expiresAt < new Date()) {
      await this.prisma.teamInvitation.update({
        where: { id: inv.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }
    const alreadyMember = await this.prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId: inv.teamId, userId } },
    });
    if (alreadyMember) throw new ConflictException('Already a member');
    if (
      inv.team.maxMembers != null &&
      inv.team._count.members >= inv.team.maxMembers
    )
      throw new ConflictException('Team is full');

    await this.prisma.$transaction([
      this.prisma.teamMembership.create({
        data: { teamId: inv.teamId, userId, role: 'MEMBER' },
      }),
      this.prisma.teamInvitation.update({
        where: { id: inv.id },
        data: { status: 'ACCEPTED' },
      }),
    ]);
    await this.invalidateRecruitmentCards(inv.teamId);
    await this.auditLog.log({
      userId,
      action: AuditAction.TEAM_ACCEPT_INVITE,
      resource: 'teams',
      resourceId: inv.teamId,
      metadata: { action: 'accept_invite', invitationId: inv.id },
    });
    return this.findById(inv.teamId, userId);
  }

  /** Transfer ownership to another member; current user must be OWNER, new owner must be existing member. */
  async transferOwner(teamId: string, userId: string, newOwnerId: string) {
    await this.ensureMemberRole(teamId, userId, ['OWNER']);
    if (newOwnerId === userId)
      throw new BadRequestException('Cannot transfer to yourself');
    const newOwnerMembership = await this.prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId: newOwnerId } },
    });
    if (!newOwnerMembership)
      throw new BadRequestException('New owner must be an existing member');
    await this.prisma.$transaction([
      this.prisma.teamMembership.update({
        where: { teamId_userId: { teamId, userId } },
        data: { role: 'ADMIN' },
      }),
      this.prisma.teamMembership.update({
        where: { teamId_userId: { teamId, userId: newOwnerId } },
        data: { role: 'OWNER' },
      }),
    ]);
    await this.auditLog.log({
      userId,
      action: AuditAction.TEAM_TRANSFER_OWNER,
      resource: 'teams',
      resourceId: teamId,
      metadata: { action: 'transfer_owner', newOwnerId },
    });
    return { success: true };
  }

  /** Disband: only OWNER. */
  async disband(teamId: string, userId: string) {
    await this.ensureMemberRole(teamId, userId, ['OWNER']);
    await this.prisma.team.delete({ where: { id: teamId } });
    await this.auditLog.log({
      userId,
      action: AuditAction.TEAM_DISBAND,
      resource: 'teams',
      resourceId: teamId,
      metadata: { action: 'disband' },
    });
    return { success: true };
  }

  /** List members; only members can see. */
  async getMembers(teamId: string, userId: string) {
    await this.ensureMember(teamId, userId);
    const members = await this.prisma.teamMembership.findMany({
      where: { teamId },
      include: {
        user: { select: TEAM_USER_SELECT },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return members;
  }

  /** Kick member; OWNER or ADMIN; cannot kick OWNER. */
  async removeMember(teamId: string, userId: string, targetUserId: string) {
    await this.ensureMemberRole(teamId, userId, ['OWNER', 'ADMIN']);
    const target = await this.prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'OWNER')
      throw new BadRequestException('Cannot remove the owner');
    await this.prisma.teamMembership.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    await this.invalidateRecruitmentCards(teamId);
    await this.auditLog.log({
      userId,
      action: AuditAction.TEAM_MEMBER_REMOVE,
      resource: 'teams',
      resourceId: teamId,
      metadata: { action: 'kick', targetUserId },
    });
    return { success: true };
  }

  private async ensureMember(teamId: string, userId: string) {
    const m = await this.prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!m) throw new ForbiddenException('You are not a member of this team');
  }

  private async ensureMemberRole(
    teamId: string,
    userId: string,
    roles: TeamMemberRole[],
  ) {
    const m = await this.prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!m) throw new ForbiddenException('Team not found or access denied');
    if (!roles.includes(m.role))
      throw new ForbiddenException('Insufficient permission');
  }

  private async invalidateRecruitmentCards(teamId: string) {
    await this.prisma.teamRecruitmentCard.updateMany({
      where: {
        teamId,
        phase: 'PUBLISHED',
      },
      data: {
        phase: 'DRAFT',
      },
    });
  }
}

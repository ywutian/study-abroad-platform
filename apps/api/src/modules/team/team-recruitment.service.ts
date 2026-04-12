import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  RecruitmentIntentMode,
  TeamMemberRole,
  TeamRecruitmentPhase,
  TeamRecruitmentSwipeAction,
  TeamVisibility,
  TeamJoinPolicy,
  TeamMatchKind,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';
import {
  CreateRecruitmentDto,
  CreateRecruitmentSwipeDto,
  InviteMatchMembersDto,
  MatchQueryDto,
  RecruitmentDeckQueryDto,
  UpdateRecruitmentDto,
  UpdateRecruitmentMemberProfileDto,
} from './dto/recruitment.dto';
import { TEAM_USER_SELECT } from './team.constants';
import { SCHOOL_NAME_SELECT } from '../../common/constants/prisma-selects';

const RECRUITMENT_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  profile: {
    select: {
      nickname: true,
      avatarUrl: true,
      realName: true,
      currentSchool: true,
      grade: true,
      targetMajor: true,
    },
  },
} as const;

const RECRUITMENT_CARD_INCLUDE =
  Prisma.validator<Prisma.TeamRecruitmentCardInclude>()({
    competitionTrack: {
      include: {
        competitionEdition: {
          include: {
            competition: true,
          },
        },
      },
    },
    team: {
      include: {
        school: { select: SCHOOL_NAME_SELECT },
        members: {
          include: {
            user: {
              select: RECRUITMENT_USER_SELECT,
            },
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
      },
    },
    memberProfiles: {
      include: {
        user: {
          select: RECRUITMENT_USER_SELECT,
        },
        selectedResume: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
            sections: {
              select: {
                id: true,
                title: true,
                type: true,
                content: true,
                isVisible: true,
                order: true,
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    },
  });

type LoadedRecruitmentCard = Prisma.TeamRecruitmentCardGetPayload<{
  include: typeof RECRUITMENT_CARD_INCLUDE;
}>;

@Injectable()
export class TeamRecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly notificationService: NotificationService,
  ) {}

  async getRecruitmentContexts() {
    const tracks = await this.prisma.competitionTrack.findMany({
      where: {
        isActive: true,
        competitionEdition: {
          is: {
            status: 'ACTIVE',
          },
        },
      },
      include: {
        competitionEdition: {
          include: {
            competition: true,
          },
        },
      },
      orderBy: [
        { competitionEdition: { competition: { tier: 'desc' } } },
        { competitionEdition: { seasonLabel: 'desc' } },
        { name: 'asc' },
      ],
    });

    return {
      items: tracks.map((track) => ({
        id: track.id,
        name: track.name,
        rolePresets: track.rolePresets,
        minTeamSize: track.minTeamSize,
        maxTeamSize: track.maxTeamSize,
        languages: track.languages,
        isActive: track.isActive,
        edition: {
          id: track.competitionEdition.id,
          seasonLabel: track.competitionEdition.seasonLabel,
          status: track.competitionEdition.status,
          registrationOpenAt: track.competitionEdition.registrationOpenAt,
          registrationCloseAt: track.competitionEdition.registrationCloseAt,
          eventStartAt: track.competitionEdition.eventStartAt,
          eventEndAt: track.competitionEdition.eventEndAt,
        },
        competition: {
          id: track.competitionEdition.competition.id,
          name: track.competitionEdition.competition.name,
          abbreviation: track.competitionEdition.competition.abbreviation,
          category: track.competitionEdition.competition.category,
        },
      })),
    };
  }

  async getMyRecruitments(userId: string) {
    const memberships = await this.prisma.teamMembership.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            school: { select: SCHOOL_NAME_SELECT },
            _count: { select: { members: true } },
            recruitmentCards: {
              include: RECRUITMENT_CARD_INCLUDE,
              orderBy: { updatedAt: 'desc' },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return {
      items: memberships.map((membership) => ({
        team: {
          id: membership.team.id,
          name: membership.team.name,
          description: membership.team.description,
          visibility: membership.team.visibility,
          joinPolicy: membership.team.joinPolicy,
          maxMembers: membership.team.maxMembers,
          school: membership.team.school,
          memberCount: membership.team._count.members,
          myRole: membership.role,
        },
        recruitmentCards: membership.team.recruitmentCards.map((card) =>
          this.serializeCard(card, true),
        ),
      })),
    };
  }

  async create(userId: string, dto: CreateRecruitmentDto) {
    const track = await this.prisma.competitionTrack.findUnique({
      where: { id: dto.competitionTrackId },
      include: {
        competitionEdition: {
          include: {
            competition: true,
          },
        },
      },
    });
    if (
      !track ||
      !track.isActive ||
      track.competitionEdition.status !== 'ACTIVE'
    ) {
      throw new NotFoundException('Competition track not found');
    }

    let teamId = dto.teamId;
    if (teamId) {
      await this.ensureTeamRole(teamId, userId, ['OWNER', 'ADMIN']);
    } else {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        select: { nickname: true },
      });
      const teamName =
        dto.teamName?.trim() ||
        profile?.nickname?.trim() ||
        `${track.competitionEdition.competition.abbreviation} Solo Team`;
      const createdTeam = await this.prisma.team.create({
        data: {
          creatorId: userId,
          name: teamName.slice(0, 100),
          description: dto.headline,
          visibility: TeamVisibility.PRIVATE,
          joinPolicy: TeamJoinPolicy.INVITE_ONLY,
          maxMembers: dto.targetTeamSize ?? track.maxTeamSize,
          members: {
            create: {
              userId,
              role: 'OWNER',
            },
          },
        },
      });
      teamId = createdTeam.id;
    }

    const existingActiveCard = await this.prisma.teamRecruitmentCard.findFirst({
      where: {
        teamId,
        phase: 'PUBLISHED',
      },
      select: { id: true },
    });
    if (existingActiveCard) {
      throw new ConflictException(
        'This team already has an active recruitment card',
      );
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
      },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const targetTeamSize =
      dto.targetTeamSize ?? team.maxMembers ?? track.maxTeamSize;
    this.assertTargetTeamSize(
      targetTeamSize,
      track.minTeamSize,
      track.maxTeamSize,
    );
    if (team.members.length > targetTeamSize) {
      throw new BadRequestException(
        'Current team already exceeds the requested team size',
      );
    }

    const existingCard = await this.prisma.teamRecruitmentCard.findUnique({
      where: {
        teamId_competitionTrackId: {
          teamId,
          competitionTrackId: dto.competitionTrackId,
        },
      },
    });
    if (existingCard) {
      throw new ConflictException(
        'Recruitment card already exists for this track',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      if (team.maxMembers !== targetTeamSize) {
        await tx.team.update({
          where: { id: teamId },
          data: { maxMembers: targetTeamSize },
        });
      }

      const card = await tx.teamRecruitmentCard.create({
        data: {
          teamId: teamId,
          competitionTrackId: dto.competitionTrackId,
          headline: dto.headline.trim(),
          detailNote: dto.detailNote?.trim() || null,
          highlightTitle: dto.highlightTitle?.trim() || null,
          offerRoles: dto.offerRoles ?? [],
          needRoles: dto.needRoles ?? [],
          skillTags: dto.skillTags ?? [],
          availabilityBand: dto.availabilityBand,
          collaborationMode: dto.collaborationMode,
          timezone: dto.timezone?.trim() || null,
          city: dto.city?.trim() || null,
          languages: dto.languages ?? [],
          intentMode: dto.intentMode ?? RecruitmentIntentMode.TEAM_UP,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });

      await tx.teamRecruitmentMemberProfile.upsert({
        where: {
          teamRecruitmentCardId_userId: {
            teamRecruitmentCardId: card.id,
            userId,
          },
        },
        update: {},
        create: {
          teamRecruitmentCardId: card.id,
          userId,
        },
      });

      return card;
    });

    return this.getById(created.id, userId);
  }

  async update(cardId: string, userId: string, dto: UpdateRecruitmentDto) {
    const card = await this.getCardOrThrow(cardId);
    await this.ensureTeamRole(card.teamId, userId, ['OWNER', 'ADMIN']);

    const updateData: Prisma.TeamRecruitmentCardUpdateInput = {};

    if (
      dto.competitionTrackId &&
      dto.competitionTrackId !== card.competitionTrackId
    ) {
      const nextTrack = await this.prisma.competitionTrack.findUnique({
        where: { id: dto.competitionTrackId },
      });
      if (!nextTrack || !nextTrack.isActive) {
        throw new NotFoundException('Competition track not found');
      }
      const targetTeamSize =
        dto.targetTeamSize ?? card.team.maxMembers ?? nextTrack.maxTeamSize;
      this.assertTargetTeamSize(
        targetTeamSize,
        nextTrack.minTeamSize,
        nextTrack.maxTeamSize,
      );
      updateData.competitionTrack = { connect: { id: dto.competitionTrackId } };
      updateData.phase = TeamRecruitmentPhase.DRAFT;
    }

    if (dto.headline !== undefined) updateData.headline = dto.headline.trim();
    if (dto.detailNote !== undefined)
      updateData.detailNote = dto.detailNote?.trim() || null;
    if (dto.highlightTitle !== undefined) {
      updateData.highlightTitle = dto.highlightTitle?.trim() || null;
    }
    if (dto.offerRoles !== undefined) updateData.offerRoles = dto.offerRoles;
    if (dto.needRoles !== undefined) updateData.needRoles = dto.needRoles;
    if (dto.skillTags !== undefined) updateData.skillTags = dto.skillTags;
    if (dto.availabilityBand !== undefined) {
      updateData.availabilityBand = dto.availabilityBand;
    }
    if (dto.collaborationMode !== undefined) {
      updateData.collaborationMode = dto.collaborationMode;
    }
    if (dto.timezone !== undefined)
      updateData.timezone = dto.timezone?.trim() || null;
    if (dto.city !== undefined) updateData.city = dto.city?.trim() || null;
    if (dto.languages !== undefined) updateData.languages = dto.languages;
    if (dto.intentMode !== undefined) updateData.intentMode = dto.intentMode;
    if (dto.expiresAt !== undefined) {
      updateData.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.isClosed !== undefined) updateData.isClosed = dto.isClosed;

    const nextTrack =
      dto.competitionTrackId &&
      dto.competitionTrackId !== card.competitionTrackId
        ? await this.prisma.competitionTrack.findUnique({
            where: { id: dto.competitionTrackId },
          })
        : card.competitionTrack;

    if (!nextTrack) {
      throw new NotFoundException('Competition track not found');
    }

    const targetTeamSize =
      dto.targetTeamSize ?? card.team.maxMembers ?? nextTrack.maxTeamSize;
    this.assertTargetTeamSize(
      targetTeamSize,
      nextTrack.minTeamSize,
      nextTrack.maxTeamSize,
    );
    if (card.team.members.length > targetTeamSize) {
      throw new BadRequestException(
        'Current team already exceeds the requested team size',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (targetTeamSize !== (card.team.maxMembers ?? nextTrack.maxTeamSize)) {
        await tx.team.update({
          where: { id: card.teamId },
          data: { maxMembers: targetTeamSize },
        });
        updateData.phase = TeamRecruitmentPhase.DRAFT;
      }

      await tx.teamRecruitmentCard.update({
        where: { id: cardId },
        data: updateData,
      });
    });

    return this.getById(cardId, userId);
  }

  async updateMemberProfile(
    cardId: string,
    userId: string,
    dto: UpdateRecruitmentMemberProfileDto,
  ) {
    const card = await this.getCardOrThrow(cardId);
    await this.ensureTeamMember(card.teamId, userId);

    let selectedResumeId: string | null | undefined = undefined;
    if (dto.selectedResumeId !== undefined) {
      selectedResumeId = dto.selectedResumeId || null;
      if (selectedResumeId) {
        const resume = await this.prisma.resume.findFirst({
          where: {
            id: selectedResumeId,
            userId,
          },
          select: { id: true },
        });
        if (!resume) {
          throw new ForbiddenException(
            'Resume does not belong to the current user',
          );
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.teamRecruitmentMemberProfile.findUnique({
        where: {
          teamRecruitmentCardId_userId: {
            teamRecruitmentCardId: cardId,
            userId,
          },
        },
      });

      await tx.teamRecruitmentMemberProfile.upsert({
        where: {
          teamRecruitmentCardId_userId: {
            teamRecruitmentCardId: cardId,
            userId,
          },
        },
        update: {
          selectedResumeId,
          introLine: dto.introLine?.trim(),
          showSchool: dto.showSchool,
          showGrade: dto.showGrade,
          showAwards: dto.showAwards,
          consentConfirmedAt:
            dto.consentConfirmed === true
              ? new Date()
              : dto.consentConfirmed === false
                ? null
                : undefined,
        },
        create: {
          teamRecruitmentCardId: cardId,
          userId,
          selectedResumeId,
          introLine: dto.introLine?.trim(),
          showSchool: dto.showSchool ?? false,
          showGrade: dto.showGrade ?? false,
          showAwards: dto.showAwards ?? false,
          consentConfirmedAt: dto.consentConfirmed ? new Date() : null,
        },
      });

      if (
        card.phase === 'PUBLISHED' &&
        existing?.selectedResumeId !== selectedResumeId
      ) {
        await tx.teamRecruitmentCard.update({
          where: { id: cardId },
          data: { phase: TeamRecruitmentPhase.DRAFT },
        });
      }
    });

    return this.getById(cardId, userId);
  }

  async publish(cardId: string, userId: string) {
    const card = await this.getCardOrThrow(cardId);
    await this.ensureTeamRole(card.teamId, userId, ['OWNER', 'ADMIN']);

    this.assertTargetTeamSize(
      card.team.maxMembers ?? card.competitionTrack.maxTeamSize,
      card.competitionTrack.minTeamSize,
      card.competitionTrack.maxTeamSize,
    );

    const currentMemberIds = new Set(
      card.team.members.map((member) => member.userId),
    );
    const consentedMembers = new Set(
      card.memberProfiles
        .filter(
          (profile) =>
            currentMemberIds.has(profile.userId) && profile.consentConfirmedAt,
        )
        .map((profile) => profile.userId),
    );
    if (consentedMembers.size !== currentMemberIds.size) {
      throw new BadRequestException(
        'Every current team member must confirm display settings',
      );
    }

    if (
      card.team.maxMembers != null &&
      card.team.members.length > card.team.maxMembers
    ) {
      throw new BadRequestException('Current team exceeds team size limit');
    }

    const existingActiveCard = await this.prisma.teamRecruitmentCard.findFirst({
      where: {
        teamId: card.teamId,
        phase: 'PUBLISHED',
        id: { not: cardId },
      },
      select: { id: true },
    });
    if (existingActiveCard) {
      throw new ConflictException(
        'This team already has another active recruitment card',
      );
    }

    await this.prisma.teamRecruitmentCard.update({
      where: { id: cardId },
      data: {
        phase: TeamRecruitmentPhase.PUBLISHED,
        publishedAt: new Date(),
        version: card.publishedAt ? { increment: 1 } : undefined,
      },
    });

    return this.getById(cardId, userId);
  }

  async close(cardId: string, userId: string) {
    const card = await this.getCardOrThrow(cardId);
    await this.ensureTeamRole(card.teamId, userId, ['OWNER', 'ADMIN']);

    await this.prisma.teamRecruitmentCard.update({
      where: { id: cardId },
      data: {
        isClosed: true,
      },
    });

    return this.getById(cardId, userId);
  }

  async getById(cardId: string, userId: string) {
    const card = await this.getCardOrThrow(cardId);
    const isOwnCard = card.team.members.some(
      (member) => member.userId === userId,
    );
    const match = isOwnCard
      ? null
      : await this.prisma.teamMatch.findFirst({
          where: {
            closedAt: null,
            OR: [
              {
                leftCardId: cardId,
                rightCard: {
                  is: {
                    team: {
                      members: {
                        some: { userId },
                      },
                    },
                  },
                },
              },
              {
                rightCardId: cardId,
                leftCard: {
                  is: {
                    team: {
                      members: {
                        some: { userId },
                      },
                    },
                  },
                },
              },
            ],
          },
          select: {
            id: true,
            matchKind: true,
            conversationId: true,
          },
        });

    return this.serializeCard(card, isOwnCard || !!match, match ?? undefined);
  }

  async getDeck(userId: string, query: RecruitmentDeckQueryDto) {
    const sourceCard = await this.resolveSourceCard(userId, query.teamId);
    if (!sourceCard) {
      return { sourceCard: null, items: [] };
    }
    if (sourceCard.phase !== 'PUBLISHED' || sourceCard.isClosed) {
      return {
        sourceCard: this.serializeCard(sourceCard, true),
        items: [],
      };
    }

    const swipes = await this.prisma.teamRecruitmentSwipe.findMany({
      where: {
        sourceCardId: sourceCard.id,
        sourceVersion: sourceCard.version,
      },
      select: {
        targetCardId: true,
        targetVersion: true,
      },
    });
    const seenVersionKeys = new Set(
      swipes.map((swipe) => `${swipe.targetCardId}:${swipe.targetVersion}`),
    );

    const candidates = await this.prisma.teamRecruitmentCard.findMany({
      where: {
        competitionTrackId: sourceCard.competitionTrackId,
        phase: 'PUBLISHED',
        isClosed: false,
        id: { not: sourceCard.id },
        teamId: { not: sourceCard.teamId },
      },
      include: RECRUITMENT_CARD_INCLUDE,
      take: 100,
      orderBy: { updatedAt: 'desc' },
    });

    const scored: Array<{ card: LoadedRecruitmentCard; score: number }> = [];
    for (const candidate of candidates) {
      if (seenVersionKeys.has(`${candidate.id}:${candidate.version}`)) {
        continue;
      }

      const blocked = await this.hasBlockingRelationship(sourceCard, candidate);
      if (blocked) {
        continue;
      }

      if (!this.isDeckCompatible(sourceCard, candidate)) {
        continue;
      }

      scored.push({
        card: candidate,
        score: this.scoreCard(sourceCard, candidate),
      });
    }

    const randomizedTop = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .sort(
        (a, b) => b.score + Math.random() * 5 - (a.score + Math.random() * 5),
      )
      .slice(0, query.limit ?? 20);

    return {
      sourceCard: this.serializeCard(sourceCard, true),
      items: randomizedTop.map((entry) => ({
        ...this.serializeCard(entry.card, false),
        score: Math.round(entry.score),
      })),
    };
  }

  async swipe(cardId: string, userId: string, dto: CreateRecruitmentSwipeDto) {
    const [sourceCard, targetCard] = await Promise.all([
      this.getCardOrThrow(cardId),
      this.getCardOrThrow(dto.targetCardId),
    ]);

    await this.ensureTeamMember(sourceCard.teamId, userId);
    if (sourceCard.phase !== 'PUBLISHED' || targetCard.phase !== 'PUBLISHED') {
      throw new BadRequestException(
        'Both cards must be published before swiping',
      );
    }
    if (sourceCard.isClosed || targetCard.isClosed) {
      throw new BadRequestException('Closed cards cannot be swiped');
    }
    if (
      sourceCard.id === targetCard.id ||
      sourceCard.teamId === targetCard.teamId
    ) {
      throw new BadRequestException('Cannot swipe your own card');
    }
    if (sourceCard.competitionTrackId !== targetCard.competitionTrackId) {
      throw new BadRequestException('Cards must belong to the same track');
    }
    if (!this.isDeckCompatible(sourceCard, targetCard)) {
      throw new BadRequestException(
        'Cards are no longer compatible for matching',
      );
    }

    const blocked = await this.hasBlockingRelationship(sourceCard, targetCard);
    if (blocked) {
      throw new ForbiddenException('Cannot match with this card');
    }

    const existingSwipe = await this.prisma.teamRecruitmentSwipe.findUnique({
      where: {
        sourceCardId_targetCardId_sourceVersion_targetVersion: {
          sourceCardId: sourceCard.id,
          targetCardId: targetCard.id,
          sourceVersion: sourceCard.version,
          targetVersion: targetCard.version,
        },
      },
    });
    if (existingSwipe) {
      return {
        matched: false,
        swipe: existingSwipe,
      };
    }

    const swipe = await this.prisma.teamRecruitmentSwipe.create({
      data: {
        sourceCardId: sourceCard.id,
        targetCardId: targetCard.id,
        actedById: userId,
        action: dto.action,
        sourceVersion: sourceCard.version,
        targetVersion: targetCard.version,
      },
    });

    if (dto.action !== TeamRecruitmentSwipeAction.LIKE) {
      return { matched: false, swipe };
    }

    const reverseSwipe = await this.prisma.teamRecruitmentSwipe.findFirst({
      where: {
        sourceCardId: targetCard.id,
        targetCardId: sourceCard.id,
        action: TeamRecruitmentSwipeAction.LIKE,
        sourceVersion: targetCard.version,
        targetVersion: sourceCard.version,
      },
    });
    if (!reverseSwipe) {
      return { matched: false, swipe };
    }

    const [leftCardId, rightCardId] =
      sourceCard.id < targetCard.id
        ? [sourceCard.id, targetCard.id]
        : [targetCard.id, sourceCard.id];

    const existingMatch = await this.prisma.teamMatch.findFirst({
      where: {
        leftCardId,
        rightCardId,
        closedAt: null,
      },
      include: {
        conversation: true,
      },
    });
    if (existingMatch) {
      return {
        matched: true,
        swipe,
        match: {
          id: existingMatch.id,
          matchKind: existingMatch.matchKind,
          conversationId: existingMatch.conversationId,
        },
      };
    }

    const matchKind =
      sourceCard.intentMode === RecruitmentIntentMode.NETWORKING_ONLY ||
      targetCard.intentMode === RecruitmentIntentMode.NETWORKING_ONLY
        ? TeamMatchKind.NETWORKING
        : TeamMatchKind.TEAM_UP;

    const participantIds = Array.from(
      new Set([
        ...sourceCard.team.members.map((member) => member.userId),
        ...targetCard.team.members.map((member) => member.userId),
      ]),
    );
    const conversationTitle = this.buildMatchConversationTitle(
      sourceCard,
      targetCard,
    );
    const conversation = await this.chatService.createMatchGroupConversation({
      title: conversationTitle,
      participantIds,
      systemSenderId: userId,
      initialMessage: this.buildInitialMatchMessage(sourceCard, targetCard),
    });

    const match = await this.prisma.teamMatch.create({
      data: {
        leftCardId,
        rightCardId,
        matchKind,
        conversationId: conversation.id,
      },
    });

    return {
      matched: true,
      swipe,
      match: {
        id: match.id,
        matchKind: match.matchKind,
        conversationId: conversation.id,
      },
    };
  }

  async getMatches(userId: string, query: MatchQueryDto) {
    const matches = await this.prisma.teamMatch.findMany({
      where: {
        closedAt: null,
        conversation: {
          is: {
            participants: {
              some: { userId },
            },
          },
        },
        ...(query.teamId
          ? {
              OR: [
                { leftCard: { is: { teamId: query.teamId } } },
                { rightCard: { is: { teamId: query.teamId } } },
              ],
            }
          : {}),
      },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: TEAM_USER_SELECT,
                },
              },
            },
            messages: {
              include: {
                sender: {
                  select: TEAM_USER_SELECT,
                },
              },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        leftCard: {
          include: RECRUITMENT_CARD_INCLUDE,
        },
        rightCard: {
          include: RECRUITMENT_CARD_INCLUDE,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: matches.map((match) => {
        const isLeft = match.leftCard.team.members.some(
          (member) => member.userId === userId,
        );
        const myCard = isLeft ? match.leftCard : match.rightCard;
        const otherCard = isLeft ? match.rightCard : match.leftCard;
        const myRole = myCard.team.members.find(
          (member) => member.userId === userId,
        )?.role;

        return {
          id: match.id,
          matchKind: match.matchKind,
          createdAt: match.createdAt,
          conversationId: match.conversationId,
          canInvite:
            match.matchKind === TeamMatchKind.TEAM_UP &&
            (myRole === TeamMemberRole.OWNER ||
              myRole === TeamMemberRole.ADMIN),
          myCard: this.serializeCard(myCard, true),
          otherCard: this.serializeCard(otherCard, true),
          conversation: match.conversation
            ? {
                id: match.conversation.id,
                kind: match.conversation.kind,
                title: match.conversation.title,
                createdBySystem: match.conversation.createdBySystem,
                participantPreview: match.conversation.participants
                  .filter((participant) => participant.userId !== userId)
                  .slice(0, 3)
                  .map((participant) => ({
                    id: participant.user.id,
                    email: participant.user.email,
                    profile: participant.user.profile,
                  })),
                lastMessage: match.conversation.messages[0] ?? null,
              }
            : null,
        };
      }),
    };
  }

  async inviteMembers(
    matchId: string,
    userId: string,
    dto: InviteMatchMembersDto,
  ) {
    const match = await this.prisma.teamMatch.findUnique({
      where: { id: matchId },
      include: {
        leftCard: {
          include: {
            team: {
              include: {
                members: true,
              },
            },
          },
        },
        rightCard: {
          include: {
            team: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    });
    if (!match || match.closedAt) {
      throw new NotFoundException('Match not found');
    }
    if (match.matchKind !== TeamMatchKind.TEAM_UP) {
      throw new BadRequestException(
        'Networking matches do not support team invitations',
      );
    }

    const leftRole = match.leftCard.team.members.find(
      (member) => member.userId === userId,
    )?.role;
    const rightRole = match.rightCard.team.members.find(
      (member) => member.userId === userId,
    )?.role;

    let inviterTeam = null as typeof match.leftCard.team | null;
    let targetTeam = null as typeof match.rightCard.team | null;
    if (
      dto.sourceTeamId === match.leftCard.teamId ||
      (dto.sourceTeamId == null &&
        (leftRole === TeamMemberRole.OWNER ||
          leftRole === TeamMemberRole.ADMIN))
    ) {
      inviterTeam = match.leftCard.team;
      targetTeam = match.rightCard.team;
    } else if (
      dto.sourceTeamId === match.rightCard.teamId ||
      (dto.sourceTeamId == null &&
        (rightRole === TeamMemberRole.OWNER ||
          rightRole === TeamMemberRole.ADMIN))
    ) {
      inviterTeam = match.rightCard.team;
      targetTeam = match.leftCard.team;
    }
    if (!inviterTeam || !targetTeam) {
      throw new ForbiddenException(
        'Only team owner/admin can invite matched members',
      );
    }

    const inviteeIdSet = new Set(dto.inviteeIds);
    const validInvitees = targetTeam.members
      .filter((member) => inviteeIdSet.has(member.userId))
      .map((member) => member.userId);
    if (validInvitees.length === 0) {
      throw new BadRequestException(
        'No matched members selected for invitation',
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitations = await this.prisma.$transaction(async (tx) => {
      const created = [] as Array<{
        inviteeId: string;
        status: 'SENT' | 'EXISTING_PENDING' | 'ALREADY_MEMBER';
        invitationId: string | null;
        token: string | null;
        inviteUrl: string | null;
      }>;
      for (const inviteeId of validInvitees) {
        const existingMembership = await tx.teamMembership.findUnique({
          where: {
            teamId_userId: {
              teamId: inviterTeam.id,
              userId: inviteeId,
            },
          },
        });
        if (existingMembership) {
          created.push({
            inviteeId,
            status: 'ALREADY_MEMBER',
            invitationId: null,
            token: null,
            inviteUrl: null,
          });
          continue;
        }

        const existingInvite = await tx.teamInvitation.findFirst({
          where: {
            teamId: inviterTeam.id,
            inviteeId,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
        });
        if (existingInvite) {
          const token = existingInvite.token ?? randomBytes(24).toString('hex');
          if (!existingInvite.token) {
            await tx.teamInvitation.update({
              where: { id: existingInvite.id },
              data: { token },
            });
          }
          created.push({
            inviteeId,
            status: 'EXISTING_PENDING',
            invitationId: existingInvite.id,
            token,
            inviteUrl: this.buildTeamInviteUrl(token),
          });
          continue;
        }

        const token = randomBytes(24).toString('hex');
        const invitation = await tx.teamInvitation.create({
          data: {
            teamId: inviterTeam.id,
            inviterId: userId,
            inviteeId,
            token,
            status: 'PENDING',
            expiresAt,
          },
        });
        created.push({
          inviteeId,
          status: 'SENT',
          invitationId: invitation.id,
          token,
          inviteUrl: this.buildTeamInviteUrl(token),
        });
      }
      return created;
    });

    const deliveredInvitations = await Promise.all(
      invitations.map(async (invitation) => {
        if (!invitation.token) {
          return {
            ...invitation,
            notificationSent: false,
          };
        }

        try {
          await this.notificationService.createNotification(
            invitation.inviteeId,
            NotificationType.SYSTEM_BROADCAST,
            {
              actorId: userId,
              relatedId: invitation.token,
              relatedType: 'team_invitation',
              customTitle: 'Team invitation',
              customContent: `${inviterTeam.name} invited you to join their team.`,
            },
          );
          return {
            ...invitation,
            notificationSent: true,
          };
        } catch {
          return {
            ...invitation,
            notificationSent: false,
          };
        }
      }),
    );

    return {
      invitations: deliveredInvitations,
    };
  }

  private async resolveSourceCard(userId: string, teamId?: string) {
    if (teamId) {
      await this.ensureTeamMember(teamId, userId);
      return this.prisma.teamRecruitmentCard.findFirst({
        where: { teamId },
        include: RECRUITMENT_CARD_INCLUDE,
        orderBy: [{ phase: 'desc' }, { updatedAt: 'desc' }],
      });
    }

    return this.prisma.teamRecruitmentCard.findFirst({
      where: {
        team: {
          members: {
            some: { userId },
          },
        },
      },
      include: RECRUITMENT_CARD_INCLUDE,
      orderBy: [{ phase: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  private async getCardOrThrow(cardId: string) {
    const card = await this.prisma.teamRecruitmentCard.findUnique({
      where: { id: cardId },
      include: RECRUITMENT_CARD_INCLUDE,
    });
    if (!card) {
      throw new NotFoundException('Recruitment card not found');
    }
    return card;
  }

  private async ensureTeamMember(teamId: string, userId: string) {
    const membership = await this.prisma.teamMembership.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      select: { role: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }
    return membership;
  }

  private async ensureTeamRole(
    teamId: string,
    userId: string,
    roles: TeamMemberRole[],
  ) {
    const membership = await this.ensureTeamMember(teamId, userId);
    if (!roles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient permission');
    }
    return membership;
  }

  private assertTargetTeamSize(
    targetTeamSize: number,
    minTeamSize: number,
    maxTeamSize: number,
  ) {
    if (targetTeamSize < minTeamSize || targetTeamSize > maxTeamSize) {
      throw new BadRequestException(
        `Team size must be between ${minTeamSize} and ${maxTeamSize}`,
      );
    }
  }

  private getEffectiveTeamSize(card: LoadedRecruitmentCard) {
    return card.team.maxMembers ?? card.competitionTrack.maxTeamSize;
  }

  private getCardStatus(card: LoadedRecruitmentCard) {
    if (card.intentMode === RecruitmentIntentMode.NETWORKING_ONLY) {
      return 'NETWORKING_ONLY';
    }
    const memberCount = card.team.members.length;
    const effectiveTeamSize = this.getEffectiveTeamSize(card);
    if (card.isClosed || memberCount >= effectiveTeamSize) {
      return 'CLOSED';
    }
    if (effectiveTeamSize - memberCount === 1) {
      return 'ALMOST_FULL';
    }
    return 'LOOKING';
  }

  private serializeCard(
    card: LoadedRecruitmentCard,
    fullAccess: boolean,
    match?: {
      id: string;
      matchKind: TeamMatchKind;
      conversationId: string | null;
    },
  ) {
    const memberProfiles = new Map(
      card.memberProfiles.map((profile) => [profile.userId, profile]),
    );

    return {
      id: card.id,
      phase: card.phase,
      status: this.getCardStatus(card),
      version: card.version,
      headline: card.headline,
      detailNote: card.detailNote,
      highlightTitle: card.highlightTitle,
      offerRoles: card.offerRoles,
      needRoles: card.needRoles,
      skillTags: card.skillTags,
      availabilityBand: card.availabilityBand,
      collaborationMode: card.collaborationMode,
      timezone: card.timezone,
      city: card.city,
      languages: card.languages,
      intentMode: card.intentMode,
      publishedAt: card.publishedAt,
      expiresAt: card.expiresAt,
      updatedAt: card.updatedAt,
      context: {
        trackId: card.competitionTrack.id,
        trackName: card.competitionTrack.name,
        rolePresets: card.competitionTrack.rolePresets,
        minTeamSize: card.competitionTrack.minTeamSize,
        maxTeamSize: card.competitionTrack.maxTeamSize,
        seasonLabel: card.competitionTrack.competitionEdition.seasonLabel,
        competition: {
          id: card.competitionTrack.competitionEdition.competition.id,
          name: card.competitionTrack.competitionEdition.competition.name,
          abbreviation:
            card.competitionTrack.competitionEdition.competition.abbreviation,
          category:
            card.competitionTrack.competitionEdition.competition.category,
        },
      },
      team: {
        id: card.team.id,
        name: card.team.name,
        description: card.team.description,
        school: card.team.school,
        currentSize: card.team.members.length,
        targetSize: this.getEffectiveTeamSize(card),
        visibility: card.team.visibility,
        joinPolicy: card.team.joinPolicy,
      },
      match: match ?? null,
      members: card.team.members.map((member, index) => {
        const memberProfile = memberProfiles.get(member.userId);
        const displayName =
          member.user.profile?.nickname ||
          (fullAccess
            ? member.user.profile?.realName || `Member ${index + 1}`
            : `Member ${index + 1}`);
        const school =
          memberProfile?.showSchool || fullAccess
            ? member.user.profile?.currentSchool
            : undefined;
        const grade =
          memberProfile?.showGrade || fullAccess
            ? member.user.profile?.grade
            : undefined;
        const resume = memberProfile?.selectedResume;

        return {
          userId: member.userId,
          role: member.role,
          displayName,
          avatarUrl: member.user.profile?.avatarUrl,
          verificationRole: member.user.role,
          introLine: memberProfile?.introLine ?? null,
          showSchool: memberProfile?.showSchool ?? false,
          showGrade: memberProfile?.showGrade ?? false,
          showAwards: memberProfile?.showAwards ?? false,
          school,
          grade,
          targetMajor: member.user.profile?.targetMajor,
          consentConfirmedAt: memberProfile?.consentConfirmedAt ?? null,
          resume: resume
            ? {
                id: resume.id,
                title: resume.title,
                updatedAt: resume.updatedAt,
                sections: fullAccess
                  ? resume.sections
                      .filter((section) => section.isVisible)
                      .map((section) => ({
                        id: section.id,
                        title: section.title,
                        type: section.type,
                        content: section.content,
                        order: section.order,
                      }))
                  : resume.sections
                      .filter((section) => section.isVisible)
                      .slice(0, 3)
                      .map((section) => ({
                        id: section.id,
                        title: section.title,
                        type: section.type,
                        order: section.order,
                      })),
              }
            : null,
        };
      }),
    };
  }

  private buildTeamInviteUrl(token: string) {
    return `/teams/join?token=${encodeURIComponent(token)}`;
  }

  private isDeckCompatible(
    sourceCard: LoadedRecruitmentCard,
    targetCard: LoadedRecruitmentCard,
  ) {
    if (
      sourceCard.intentMode === RecruitmentIntentMode.NETWORKING_ONLY ||
      targetCard.intentMode === RecruitmentIntentMode.NETWORKING_ONLY
    ) {
      return true;
    }
    const combinedMembers =
      sourceCard.team.members.length + targetCard.team.members.length;
    return (
      combinedMembers <= this.getEffectiveTeamSize(sourceCard) &&
      combinedMembers <= this.getEffectiveTeamSize(targetCard)
    );
  }

  private scoreCard(
    sourceCard: LoadedRecruitmentCard,
    targetCard: LoadedRecruitmentCard,
  ) {
    const roleComplement =
      this.overlapCount(sourceCard.needRoles, targetCard.offerRoles) * 20 +
      this.overlapCount(targetCard.needRoles, sourceCard.offerRoles) * 20;

    const sizeFit =
      sourceCard.intentMode === RecruitmentIntentMode.NETWORKING_ONLY ||
      targetCard.intentMode === RecruitmentIntentMode.NETWORKING_ONLY
        ? 20
        : Math.max(
            0,
            20 -
              Math.abs(
                this.getEffectiveTeamSize(sourceCard) -
                  (sourceCard.team.members.length +
                    targetCard.team.members.length),
              ) *
                5,
          );

    const collaborationFit = this.scoreCollaborationFit(sourceCard, targetCard);
    const completeness = this.scoreCompleteness(targetCard);
    const recentActivity = Math.max(
      0,
      10 -
        Math.floor(
          (Date.now() - targetCard.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
        ),
    );

    return (
      roleComplement +
      sizeFit +
      collaborationFit +
      completeness +
      recentActivity
    );
  }

  private scoreCollaborationFit(
    sourceCard: LoadedRecruitmentCard,
    targetCard: LoadedRecruitmentCard,
  ) {
    let score = 0;
    if (
      sourceCard.collaborationMode &&
      targetCard.collaborationMode &&
      sourceCard.collaborationMode === targetCard.collaborationMode
    ) {
      score += 7;
    }
    if (
      sourceCard.timezone &&
      targetCard.timezone &&
      sourceCard.timezone === targetCard.timezone
    ) {
      score += 4;
    }
    if (
      sourceCard.availabilityBand &&
      targetCard.availabilityBand &&
      sourceCard.availabilityBand === targetCard.availabilityBand
    ) {
      score += 4;
    }
    return Math.min(score, 15);
  }

  private scoreCompleteness(card: LoadedRecruitmentCard) {
    let score = 0;
    if (card.headline) score += 4;
    if (card.detailNote) score += 3;
    if (card.skillTags.length > 0) score += 2;
    if (card.offerRoles.length > 0 && card.needRoles.length > 0) score += 3;
    const consented = card.memberProfiles.filter(
      (profile) => profile.consentConfirmedAt,
    ).length;
    if (consented === card.team.members.length) score += 3;
    return Math.min(score, 15);
  }

  private overlapCount(left: string[], right: string[]) {
    const rightSet = new Set(right.map((item) => item.toLowerCase()));
    return left.filter((item) => rightSet.has(item.toLowerCase())).length;
  }

  private async hasBlockingRelationship(
    sourceCard: LoadedRecruitmentCard,
    targetCard: LoadedRecruitmentCard,
  ) {
    const sourceMemberIds = sourceCard.team.members.map(
      (member) => member.userId,
    );
    const targetMemberIds = targetCard.team.members.map(
      (member) => member.userId,
    );
    const relations = sourceMemberIds.flatMap((sourceId) =>
      targetMemberIds.flatMap((targetId) => [
        { blockerId: sourceId, blockedId: targetId },
        { blockerId: targetId, blockedId: sourceId },
      ]),
    );
    const block = await this.prisma.block.findFirst({
      where: {
        OR: relations,
      },
      select: { id: true },
    });
    return Boolean(block);
  }

  private buildMatchConversationTitle(
    sourceCard: LoadedRecruitmentCard,
    targetCard: LoadedRecruitmentCard,
  ) {
    return `${sourceCard.competitionTrack.competitionEdition.competition.abbreviation} · ${sourceCard.competitionTrack.name} · ${sourceCard.team.name} × ${targetCard.team.name}`;
  }

  private buildInitialMatchMessage(
    sourceCard: LoadedRecruitmentCard,
    targetCard: LoadedRecruitmentCard,
  ) {
    const sourceOffer = sourceCard.offerRoles.join(', ') || 'General support';
    const targetOffer = targetCard.offerRoles.join(', ') || 'General support';
    return [
      `Matched on ${sourceCard.competitionTrack.competitionEdition.competition.abbreviation} / ${sourceCard.competitionTrack.name}.`,
      `${sourceCard.team.name} offers: ${sourceOffer}.`,
      `${targetCard.team.name} offers: ${targetOffer}.`,
      'Icebreakers: What scope are you aiming for, what timeline are you working with, and who should own next steps?',
    ].join('\n');
  }
}

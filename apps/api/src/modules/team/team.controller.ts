import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TeamService } from './team.service';
import { TeamRecruitmentService } from './team-recruitment.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { InviteDto } from './dto/invite.dto';
import { JoinByTokenDto } from './dto/join-by-token.dto';
import { TransferOwnerDto } from './dto/transfer-owner.dto';
import { TeamQueryDto } from './dto/team-query.dto';
import {
  CreateCommunityContextDto,
  CreateRecruitmentDto,
  CreateRecruitmentSwipeDto,
  InviteMatchMembersDto,
  MatchQueryDto,
  RecruitmentContextQueryDto,
  RecruitmentDeckPreviewQueryDto,
  RecruitmentDeckQueryDto,
  UpdateCommunityContextDto,
  UpdateRecruitmentDto,
  UpdateRecruitmentMemberProfileDto,
} from './dto/recruitment.dto';
import { Public, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import {
  ThrottleSensitive,
  ThrottleRelaxed,
} from '../../common/decorators/throttle.decorator';

@ApiTags('teams')
@Controller('teams')
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly recruitmentService: TeamRecruitmentService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Discover public teams' })
  async discover(@Query() query: TeamQueryDto) {
    return this.teamService.discover(query);
  }

  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my teams' })
  async findMy(@CurrentUser() user: CurrentUserPayload) {
    return this.teamService.findMy(user.id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create team' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamService.create(user.id, dto);
  }

  @Post('join')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept invite by token' })
  async joinByToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: JoinByTokenDto,
  ) {
    return this.teamService.joinByToken(user.id, dto.token);
  }

  @Get('recruitment-contexts')
  @Public()
  @ThrottleRelaxed()
  @ApiOperation({ summary: 'Get published recruitment contexts' })
  async getRecruitmentContexts(@Query() query: RecruitmentContextQueryDto) {
    return this.recruitmentService.getRecruitmentContexts(query);
  }

  @Get('match-pools')
  @Public()
  @ThrottleRelaxed()
  @ApiOperation({ summary: 'Get active public match pools' })
  async getMatchPools() {
    return this.recruitmentService.getMatchPools();
  }

  @Get('match-pools/:id')
  @Public()
  @ThrottleRelaxed()
  @ApiOperation({ summary: 'Get a public match pool with entries' })
  async getMatchPoolById(@Param('id') id: string) {
    return this.recruitmentService.getMatchPoolById(id);
  }

  @Get('competition-editions')
  @Public()
  @ThrottleRelaxed()
  @ApiOperation({
    summary: 'List competition editions (schedules) for a season',
  })
  async getCompetitionEditions(@Query('season') season?: string) {
    return this.recruitmentService.getCompetitionEditions(season);
  }

  @Get('community-contexts')
  @ApiBearerAuth()
  @ThrottleRelaxed()
  @ApiOperation({ summary: 'Get my community recruitment contexts' })
  async getCommunityContexts(@CurrentUser() user: CurrentUserPayload) {
    return this.recruitmentService.getMyCommunityContexts(user.id);
  }

  @Post('community-contexts')
  @ApiBearerAuth()
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Create a private community recruitment context' })
  async createCommunityContext(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCommunityContextDto,
  ) {
    return this.recruitmentService.createCommunityContext(user.id, dto);
  }

  @Patch('community-contexts/:id')
  @ApiBearerAuth()
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Update my private community recruitment context' })
  async updateCommunityContext(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateCommunityContextDto,
  ) {
    return this.recruitmentService.updateCommunityContext(id, user.id, dto);
  }

  @Post('community-contexts/:id/publish')
  @ApiBearerAuth()
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Publish my private community recruitment context' })
  async publishCommunityContext(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.recruitmentService.publishCommunityContext(id, user.id);
  }

  @Get('recruitments/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my teams with recruitment cards' })
  async getMyRecruitments(@CurrentUser() user: CurrentUserPayload) {
    return this.recruitmentService.getMyRecruitments(user.id);
  }

  @Get('recruitments/deck/preview')
  @Public()
  @ThrottleRelaxed()
  @ApiOperation({
    summary:
      'Guest-preview swipe deck — returns published cards without requiring a source card. Used on first visit so users can browse before publishing their own card.',
  })
  async getRecruitmentDeckPreview(
    @Query() query: RecruitmentDeckPreviewQueryDto,
  ) {
    return this.recruitmentService.getDeckPreview(query);
  }

  @Get('recruitments/deck')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recruitment swipe deck' })
  async getRecruitmentDeck(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: RecruitmentDeckQueryDto,
  ) {
    return this.recruitmentService.getDeck(user.id, query);
  }

  @Post('recruitments')
  @ApiBearerAuth()
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Create a competition recruitment card' })
  async createRecruitment(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateRecruitmentDto,
  ) {
    return this.recruitmentService.create(user.id, dto);
  }

  @Get('recruitments/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recruitment card detail' })
  async getRecruitmentById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.recruitmentService.getById(id, user.id);
  }

  @Patch('recruitments/:id')
  @ApiBearerAuth()
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Update recruitment card public fields' })
  async updateRecruitment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateRecruitmentDto,
  ) {
    return this.recruitmentService.update(id, user.id, dto);
  }

  @Patch('recruitments/:id/members/me')
  @ApiBearerAuth()
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Update my recruitment card member profile' })
  async updateRecruitmentMemberProfile(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateRecruitmentMemberProfileDto,
  ) {
    return this.recruitmentService.updateMemberProfile(id, user.id, dto);
  }

  @Post('recruitments/:id/publish')
  @ApiBearerAuth()
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Publish recruitment card' })
  async publishRecruitment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.recruitmentService.publish(id, user.id);
  }

  @Post('recruitments/:id/close')
  @ApiBearerAuth()
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Close recruitment card' })
  async closeRecruitment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.recruitmentService.close(id, user.id);
  }

  @Post('recruitments/:id/swipes')
  @ApiBearerAuth()
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Create swipe against another recruitment card' })
  async swipeRecruitment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateRecruitmentSwipeDto,
  ) {
    return this.recruitmentService.swipe(id, user.id, dto);
  }

  @Get('matches')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my recruitment matches' })
  async getMatches(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: MatchQueryDto,
  ) {
    return this.recruitmentService.getMatches(user.id, query);
  }

  @Post('matches/:id/invite-members')
  @ApiBearerAuth()
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Invite matched members to my team' })
  async inviteMatchMembers(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: InviteMatchMembersDto,
  ) {
    return this.recruitmentService.inviteMembers(id, user.id, dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get team by id' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.teamService.findById(id, user?.id);
  }

  @Patch(':id/transfer-owner')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Transfer ownership to another member (owner only)',
  })
  async transferOwner(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: TransferOwnerDto,
  ) {
    return this.teamService.transferOwner(id, user.id, dto.newOwnerId);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update team (owner/admin)' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamService.update(id, user.id, dto);
  }

  @Post(':id/join')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join team (OPEN only)' })
  async join(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.teamService.join(id, user.id);
  }

  @Post(':id/leave')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave team' })
  async leave(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.teamService.leave(id, user.id);
  }

  @Post(':id/invite')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite user (owner/admin)' })
  async invite(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: InviteDto,
  ) {
    return this.teamService.invite(id, user.id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disband team (owner only)' })
  async disband(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.teamService.disband(id, user.id);
  }

  @Get(':id/members')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List members (members only)' })
  async getMembers(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.teamService.getMembers(id, user.id);
  }

  @Delete(':id/members/:userId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove member / kick (owner/admin)' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.teamService.removeMember(id, user.id, userId);
  }
}

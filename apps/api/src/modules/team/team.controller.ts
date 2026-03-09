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
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { InviteDto } from './dto/invite.dto';
import { JoinByTokenDto } from './dto/join-by-token.dto';
import { TransferOwnerDto } from './dto/transfer-owner.dto';
import { TeamQueryDto } from './dto/team-query.dto';
import { Public, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';

@ApiTags('teams')
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

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

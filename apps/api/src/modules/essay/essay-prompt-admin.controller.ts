import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EssayPromptService } from './essay-prompt.service';
import {
  CreateEssayPromptDto,
  UpdateEssayPromptDto,
  QueryEssayPromptDto,
  VerifyEssayPromptDto,
  BatchVerifyDto,
  BatchImportEssayPromptDto,
} from './dto';
import { Roles, CurrentUser, RequirePermission } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role } from '@prisma/client';
import { Permission } from '../../common/constants/permissions';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';

@ApiTags('admin/essay-prompts')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/essay-prompts')
@Roles(Role.OPERATOR)
@RequirePermission(Permission.ESSAY_MANAGE)
export class EssayPromptAdminController {
  constructor(private readonly essayPromptService: EssayPromptService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get review statistics' })
  async getStats(@Query('year') year?: number) {
    return this.essayPromptService.getStats(year);
  }

  @Get()
  @ApiOperation({ summary: 'Get all essay prompts (including pending review)' })
  async findAll(@Query() query: QueryEssayPromptDto) {
    return this.essayPromptService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single essay prompt details' })
  async findOne(@Param('id') id: string) {
    return this.essayPromptService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create essay prompt' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateEssayPromptDto,
  ) {
    return this.essayPromptService.create(dto, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update essay prompt' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEssayPromptDto,
  ) {
    return this.essayPromptService.update(id, dto, user.id);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Review essay prompt' })
  async verify(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: VerifyEssayPromptDto,
  ) {
    return this.essayPromptService.verify(id, dto, user.id);
  }

  @Post('batch-import')
  @ApiOperation({ summary: 'Batch import essay prompts' })
  async batchImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BatchImportEssayPromptDto,
  ) {
    return this.essayPromptService.batchImport(dto, user.id);
  }

  @Post('batch-verify')
  @ApiOperation({ summary: 'Batch review essay prompts' })
  async batchVerify(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BatchVerifyDto,
  ) {
    return this.essayPromptService.batchVerify(
      dto.ids,
      dto.status,
      user.id,
      dto.reason,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete essay prompt' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.essayPromptService.remove(id, user.id);
  }
}

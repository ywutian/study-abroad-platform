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
import { Roles, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role } from '@prisma/client';

@ApiTags('admin/essay-prompts')
@ApiBearerAuth()
@Controller('admin/essay-prompts')
@Roles(Role.ADMIN)
export class EssayPromptAdminController {
  constructor(private readonly essayPromptService: EssayPromptService) {}

  @Get('stats')
  @ApiOperation({ summary: '获取审核统计' })
  async getStats(@Query('year') year?: number) {
    return this.essayPromptService.getStats(year);
  }

  @Get()
  @ApiOperation({ summary: '获取所有文书题目（含待审核）' })
  async findAll(@Query() query: QueryEssayPromptDto) {
    return this.essayPromptService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个文书题目详情' })
  async findOne(@Param('id') id: string) {
    return this.essayPromptService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建文书题目' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateEssayPromptDto,
  ) {
    return this.essayPromptService.create(dto, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新文书题目' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEssayPromptDto,
  ) {
    return this.essayPromptService.update(id, dto, user.id);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: '审核文书题目' })
  async verify(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: VerifyEssayPromptDto,
  ) {
    return this.essayPromptService.verify(id, dto, user.id);
  }

  @Post('batch-import')
  @ApiOperation({ summary: '批量导入文书题目' })
  async batchImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BatchImportEssayPromptDto,
  ) {
    return this.essayPromptService.batchImport(dto, user.id);
  }

  @Post('batch-verify')
  @ApiOperation({ summary: '批量审核' })
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
  @ApiOperation({ summary: '删除文书题目' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.essayPromptService.remove(id, user.id);
  }
}

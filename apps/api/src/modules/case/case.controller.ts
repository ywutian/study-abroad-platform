import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CaseService } from './case.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Role, Visibility } from '@prisma/client';

@ApiTags('cases')
@ApiBearerAuth()
@Controller('cases')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Get()
  @ApiOperation({ summary: 'Get admission cases' })
  @ApiQuery({ name: 'schoolId', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'result', required: false })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() pagination: PaginationDto,
    @Query('schoolId') schoolId?: string,
    @Query('year') year?: number,
    @Query('result') result?: string
  ) {
    return this.caseService.findAll(pagination, { schoolId, year, result }, user.id, user.role as Role);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my cases' })
  async getMyCases(@CurrentUser() user: CurrentUserPayload) {
    return this.caseService.getMyCases(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get case by ID' })
  async findById(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.caseService.findById(id, user.id, user.role as Role);
  }

  @Post()
  @ApiOperation({ summary: 'Create admission case' })
  async create(@CurrentUser() user: CurrentUserPayload, @Body() data: Record<string, unknown>) {
    return this.caseService.create(user.id, data as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update my case' })
  async update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.caseService.update(id, user.id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete my case' })
  async delete(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    await this.caseService.delete(id, user.id);
    return { message: 'Case deleted successfully' };
  }
}


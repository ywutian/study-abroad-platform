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
import { CaseService } from './case.service';
import { CurrentUser, Public } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { CaseQueryDto } from './dto/case-query.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { Role } from '@prisma/client';

@ApiTags('cases')
@ApiBearerAuth()
@Controller('cases')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get public admission cases' })
  async findAll(
    @CurrentUser() user: CurrentUserPayload | null,
    @Query() query: CaseQueryDto,
  ) {
    const { page, pageSize, schoolId, year, result, search } = query;
    return this.caseService.findAll(
      { page, pageSize },
      { schoolId, year, result, search },
      user?.id,
      (user?.role as Role) || null,
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my cases' })
  async getMyCases(@CurrentUser() user: CurrentUserPayload) {
    return this.caseService.getMyCases(user.id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get case by ID' })
  async findById(
    @CurrentUser() user: CurrentUserPayload | null,
    @Param('id') id: string,
  ) {
    return this.caseService.findById(
      id,
      user?.id || null,
      (user?.role as Role) || null,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create admission case' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateCaseDto,
  ) {
    return this.caseService.create(user.id, data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update my case' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateCaseDto,
  ) {
    return this.caseService.update(id, user.id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete my case' })
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.caseService.delete(id, user.id);
    return { message: 'Case deleted successfully' };
  }
}

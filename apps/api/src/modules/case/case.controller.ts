import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CaseService } from './case.service';
import { CaseSimilarityService } from './case-similarity.service';
import { CurrentUser, Public } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { CaseQueryDto } from './dto/case-query.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { SimilarCasesQueryDto } from './dto/similar-cases-query.dto';
import { Role } from '@prisma/client';

@ApiTags('cases')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('cases')
export class CaseController {
  constructor(
    private readonly caseService: CaseService,
    private readonly caseSimilarityService: CaseSimilarityService,
  ) {}

  @Get()
  @Public()
  @Header(
    'Cache-Control',
    'public, max-age=30, s-maxage=120, stale-while-revalidate=30',
  )
  @ApiOperation({ summary: 'Get public admission cases' })
  async findAll(
    @CurrentUser() user: CurrentUserPayload | null,
    @Query() query: CaseQueryDto,
  ) {
    const {
      page,
      pageSize,
      schoolId,
      year,
      result,
      search,
      highSchoolId,
      round,
      major,
      nationality,
    } = query;
    return this.caseService.findAll(
      { page, pageSize },
      {
        schoolId,
        year,
        result,
        search,
        highSchoolId,
        round,
        major,
        nationality,
      },
      user?.id,
      (user?.role as Role) || null,
    );
  }

  @Get('prefill')
  @ApiOperation({ summary: 'Get prefilled case data from user profile' })
  async getPrefillFromProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.caseService.getPrefillFromProfile(user.id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my cases' })
  async getMyCases(@CurrentUser() user: CurrentUserPayload) {
    return this.caseService.getMyCases(user.id);
  }

  // NOTE: must stay declared before `@Get(':id')` or `/cases/similar` would
  // be captured by the `:id` route.
  @Get('similar')
  @ApiOperation({
    summary: "Find admission cases similar to the current user's profile",
  })
  async findSimilar(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SimilarCasesQueryDto,
  ) {
    return this.caseSimilarityService.findSimilar(
      user.id,
      { schoolId: query.schoolId, limit: query.limit },
      user.locale || 'zh',
    );
  }

  @Get(':id')
  @Public()
  @Header(
    'Cache-Control',
    'public, max-age=30, s-maxage=120, stale-while-revalidate=30',
  )
  @ApiOperation({ summary: 'Get case by ID' })
  async findById(
    @CurrentUser() user: CurrentUserPayload | null,
    @Param('id') id: string,
  ) {
    return this.caseService.findById(
      id,
      user?.id || null,
      (user?.role as Role) || null,
      user?.locale || 'zh',
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create admission case' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateCaseDto,
  ) {
    return this.caseService.create(
      user.id,
      data,
      user.locale,
      user.role as any,
    );
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

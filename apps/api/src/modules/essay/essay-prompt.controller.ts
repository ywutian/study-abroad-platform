import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EssayPromptService } from './essay-prompt.service';
import { QueryEssayPromptDto } from './dto';
import { Public } from '../../common/decorators';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';

@ApiTags('essay-prompts')
@ThrottleRelaxed()
@Controller('essay-prompts')
export class EssayPromptController {
  constructor(private readonly essayPromptService: EssayPromptService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get essay prompt list (public, verified only)' })
  async findAll(@Query() query: QueryEssayPromptDto) {
    // 公开接口只返回已验证且带来源证据的数据。
    return this.essayPromptService.findAllPublic(query);
  }

  @Get('by-school/:schoolId')
  @Public()
  @ApiOperation({ summary: 'Get essay prompts for a school' })
  async findBySchool(
    @Param('schoolId') schoolId: string,
    @Query('year') year?: number,
  ) {
    return this.essayPromptService.findBySchool(
      schoolId,
      year ? +year : undefined,
    );
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get single essay prompt' })
  async findOne(@Param('id') id: string) {
    return this.essayPromptService.findOnePublic(id);
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EssayPromptService } from './essay-prompt.service';
import { QueryEssayPromptDto } from './dto';
import { Public } from '../../common/decorators';

@ApiTags('essay-prompts')
@Controller('essay-prompts')
export class EssayPromptController {
  constructor(private readonly essayPromptService: EssayPromptService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '获取文书题目列表（公开，仅已验证）' })
  async findAll(@Query() query: QueryEssayPromptDto) {
    // 公开接口只返回已验证的数据
    return this.essayPromptService.findAll({
      ...query,
      status: 'VERIFIED' as any,
    });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '获取单个文书题目' })
  async findOne(@Param('id') id: string) {
    return this.essayPromptService.findOne(id);
  }
}

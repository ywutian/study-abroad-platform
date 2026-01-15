import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  AiService,
  ProfileAnalysisRequest,
  EssayReviewRequest,
} from './ai.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class TestScoreDto {
  @IsString()
  type: string;

  @IsNumber()
  score: number;
}

class ActivityDto {
  @IsString()
  name: string;

  @IsString()
  category: string;

  @IsString()
  role: string;
}

class AwardDto {
  @IsString()
  name: string;

  @IsString()
  level: string;
}

class ProfileAnalysisDto implements ProfileAnalysisRequest {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpa?: number;

  @IsOptional()
  @IsNumber()
  gpaScale?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestScoreDto)
  testScores?: TestScoreDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityDto)
  activities?: ActivityDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AwardDto)
  awards?: AwardDto[];

  @IsOptional()
  @IsString()
  targetMajor?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetSchools?: string[];
}

class EssayReviewDto implements EssayReviewRequest {
  @IsString()
  prompt: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(5000)
  wordLimit?: number;
}

class GenerateIdeasDto {
  @IsString()
  topic: string;

  @IsOptional()
  @IsString()
  background?: string;
}

class ChatMessageDto {
  @IsString()
  role: 'system' | 'user' | 'assistant';

  @IsString()
  content: string;
}

class ChatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}

class PolishEssayDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  style?: 'formal' | 'vivid' | 'concise';
}

class RewriteParagraphDto {
  @IsString()
  paragraph: string;

  @IsOptional()
  @IsString()
  instruction?: string;
}

class ContinueWritingDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  direction?: string;
}

class GenerateOpeningDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  background?: string;
}

class GenerateEndingDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  prompt?: string;
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze-profile')
  @ApiOperation({ summary: '分析学生档案' })
  async analyzeProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: ProfileAnalysisDto,
  ) {
    return this.aiService.analyzeProfile(data);
  }

  @Post('review-essay')
  @ApiOperation({ summary: '文书评估' })
  async reviewEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: EssayReviewDto,
  ) {
    return this.aiService.reviewEssay(data);
  }

  @Post('generate-ideas')
  @ApiOperation({ summary: '生成文书创意' })
  async generateIdeas(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: GenerateIdeasDto,
  ) {
    const ideas = await this.aiService.generateEssayIdeas(
      data.topic,
      data.background,
    );
    return { ideas };
  }

  @Post('school-match')
  @ApiOperation({ summary: '学校匹配推荐' })
  async schoolMatch(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: ProfileAnalysisDto,
  ) {
    const schools = await this.aiService.schoolMatch(data);
    return { schools };
  }

  @Post('chat')
  @ApiOperation({ summary: '自由对话' })
  async chat(@CurrentUser() user: CurrentUserPayload, @Body() data: ChatDto) {
    // Add system prompt for study abroad context
    const messagesWithContext = [
      {
        role: 'system' as const,
        content:
          '你是一位专业的留学申请顾问,专注于美国本科申请。请用中文回答问题,提供专业、友好的帮助。',
      },
      ...data.messages,
    ];

    const response = await this.aiService.chat(messagesWithContext);
    return { response };
  }

  @Post('polish-essay')
  @ApiOperation({ summary: '文书润色' })
  async polishEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: PolishEssayDto,
  ) {
    return this.aiService.polishEssay(data.content, data.style);
  }

  @Post('rewrite-paragraph')
  @ApiOperation({ summary: '段落改写' })
  async rewriteParagraph(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: RewriteParagraphDto,
  ) {
    return this.aiService.rewriteParagraph(data.paragraph, data.instruction);
  }

  @Post('continue-writing')
  @ApiOperation({ summary: '续写文书' })
  async continueWriting(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: ContinueWritingDto,
  ) {
    return this.aiService.continueWriting(
      data.content,
      data.prompt,
      data.direction,
    );
  }

  @Post('generate-opening')
  @ApiOperation({ summary: '生成文书开头' })
  async generateOpening(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: GenerateOpeningDto,
  ) {
    return this.aiService.generateOpening(data.prompt, data.background);
  }

  @Post('generate-ending')
  @ApiOperation({ summary: '生成文书结尾' })
  async generateEnding(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: GenerateEndingDto,
  ) {
    return this.aiService.generateEnding(data.content, data.prompt);
  }
}

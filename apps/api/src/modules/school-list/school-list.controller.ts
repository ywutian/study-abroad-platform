import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SchoolListService } from './school-list.service';
import {
  CreateSchoolListItemDto,
  UpdateSchoolListItemDto,
  SchoolListItemResponseDto,
  AIRecommendationsResponseDto,
} from './dto/school-list.dto';

@ApiTags('School Lists')
@Controller('school-lists')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SchoolListController {
  constructor(private readonly schoolListService: SchoolListService) {}

  @Get()
  @ApiOperation({ summary: "Get user's school list" })
  @ApiResponse({ status: 200, type: [SchoolListItemResponseDto] })
  async getMySchoolList(
    @CurrentUser('id') userId: string,
  ): Promise<SchoolListItemResponseDto[]> {
    return this.schoolListService.getUserSchoolList(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a school to list' })
  @ApiResponse({ status: 201, type: SchoolListItemResponseDto })
  async addSchool(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSchoolListItemDto,
  ): Promise<SchoolListItemResponseDto> {
    return this.schoolListService.addSchool(userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a school list item' })
  @ApiResponse({ status: 200, type: SchoolListItemResponseDto })
  async updateItem(
    @CurrentUser('id') userId: string,
    @Param('id') itemId: string,
    @Body() dto: UpdateSchoolListItemDto,
  ): Promise<SchoolListItemResponseDto> {
    return this.schoolListService.updateItem(userId, itemId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a school from list' })
  @ApiResponse({ status: 204 })
  async removeItem(
    @CurrentUser('id') userId: string,
    @Param('id') itemId: string,
  ): Promise<void> {
    return this.schoolListService.removeItem(userId, itemId);
  }

  @Get('ai-recommend')
  @ApiOperation({ summary: 'Get AI-recommended schools based on profile' })
  @ApiResponse({ status: 200, type: AIRecommendationsResponseDto })
  async getAIRecommendations(
    @CurrentUser('id') userId: string,
  ): Promise<AIRecommendationsResponseDto> {
    return this.schoolListService.getAIRecommendations(userId);
  }
}

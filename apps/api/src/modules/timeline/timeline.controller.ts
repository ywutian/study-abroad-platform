import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TimelineService } from './timeline.service';
import {
  CreateTimelineDto,
  UpdateTimelineDto,
  TimelineResponseDto,
  CreateTaskDto,
  UpdateTaskDto,
  TaskResponseDto,
  GenerateTimelineDto,
  TimelineOverviewDto,
} from './dto';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('timeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  // ============ Timeline Endpoints ============

  @Post()
  @ApiOperation({ summary: '创建申请时间线' })
  @ApiResponse({ status: 201, type: TimelineResponseDto })
  async createTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateTimelineDto,
  ): Promise<TimelineResponseDto> {
    return this.timelineService.createTimeline(user.id, dto);
  }

  @Post('generate')
  @ApiOperation({ summary: '批量生成时间线' })
  @ApiResponse({ status: 201, type: [TimelineResponseDto] })
  async generateTimelines(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: GenerateTimelineDto,
  ): Promise<TimelineResponseDto[]> {
    return this.timelineService.generateTimelines(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有时间线' })
  @ApiResponse({ status: 200, type: [TimelineResponseDto] })
  async getTimelines(@CurrentUser() user: CurrentUserPayload): Promise<TimelineResponseDto[]> {
    return this.timelineService.getTimelines(user.id);
  }

  @Get('overview')
  @ApiOperation({ summary: '获取概览统计' })
  @ApiResponse({ status: 200, type: TimelineOverviewDto })
  async getOverview(@CurrentUser() user: CurrentUserPayload): Promise<TimelineOverviewDto> {
    return this.timelineService.getOverview(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取时间线详情' })
  @ApiResponse({ status: 200, type: TimelineResponseDto })
  async getTimelineById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<TimelineResponseDto> {
    return this.timelineService.getTimelineById(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新时间线' })
  @ApiResponse({ status: 200, type: TimelineResponseDto })
  async updateTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTimelineDto,
  ): Promise<TimelineResponseDto> {
    return this.timelineService.updateTimeline(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除时间线' })
  async deleteTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.timelineService.deleteTimeline(user.id, id);
  }

  // ============ Task Endpoints ============

  @Post('tasks')
  @ApiOperation({ summary: '创建任务' })
  @ApiResponse({ status: 201, type: TaskResponseDto })
  async createTask(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.timelineService.createTask(user.id, dto);
  }

  @Put('tasks/:taskId')
  @ApiOperation({ summary: '更新任务' })
  @ApiResponse({ status: 200, type: TaskResponseDto })
  async updateTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.timelineService.updateTask(user.id, taskId, dto);
  }

  @Post('tasks/:taskId/toggle')
  @ApiOperation({ summary: '切换任务完成状态' })
  @ApiResponse({ status: 200, type: TaskResponseDto })
  async toggleTaskComplete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
  ): Promise<TaskResponseDto> {
    return this.timelineService.toggleTaskComplete(user.id, taskId);
  }

  @Delete('tasks/:taskId')
  @ApiOperation({ summary: '删除任务' })
  async deleteTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
  ): Promise<void> {
    return this.timelineService.deleteTask(user.id, taskId);
  }
}




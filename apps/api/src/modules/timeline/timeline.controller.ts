import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { TimelineService } from './timeline.service';
import {
  CreateTimelineDto,
  UpdateTimelineDto,
  TimelineResponseDto,
  CreateTaskDto,
  UpdateTaskDto,
  TaskResponseDto,
  GenerateTimelineDto,
  GenerateTimelinesResultDto,
  TimelineOverviewDto,
  CreatePersonalEventDto,
  UpdatePersonalEventDto,
  SubscribeGlobalEventDto,
  PersonalEventResponseDto,
  CreatePersonalTaskDto,
  PersonalTaskResponseDto,
} from './dto';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('timeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timelines')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  // ============ Timeline Endpoints ============

  @Post()
  @ApiOperation({ summary: 'Create application timeline' })
  @ApiResponse({ status: 201, type: TimelineResponseDto })
  async createTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateTimelineDto,
  ): Promise<TimelineResponseDto> {
    return this.timelineService.createTimeline(user.id, dto, user.locale);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Batch generate timelines' })
  @ApiResponse({ status: 201, type: GenerateTimelinesResultDto })
  async generateTimelines(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: GenerateTimelineDto,
  ): Promise<GenerateTimelinesResultDto> {
    return this.timelineService.generateTimelines(user.id, dto, user.locale);
  }

  @Get()
  @ApiOperation({ summary: 'Get all timelines' })
  @ApiResponse({ status: 200, type: [TimelineResponseDto] })
  async getTimelines(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<TimelineResponseDto[]> {
    return this.timelineService.getTimelines(user.id);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get overview statistics' })
  @ApiResponse({ status: 200, type: TimelineOverviewDto })
  async getOverview(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<TimelineOverviewDto> {
    return this.timelineService.getOverview(user.id);
  }

  @Get('global-events')
  @ApiOperation({
    summary: 'Get global events (exams/competitions/scholarships)',
  })
  async getGlobalEvents(@Query('year') year?: number) {
    return this.timelineService.getGlobalEvents(
      year ? Number(year) : undefined,
    );
  }

  // ============ Personal Event Endpoints ============

  @Post('personal-events')
  @ApiOperation({ summary: 'Create personal event' })
  @ApiResponse({ status: 201, type: PersonalEventResponseDto })
  async createPersonalEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePersonalEventDto,
  ): Promise<PersonalEventResponseDto> {
    return this.timelineService.createPersonalEvent(user.id, dto);
  }

  @Post('personal-events/subscribe')
  @ApiOperation({ summary: 'Subscribe to global event on personal timeline' })
  @ApiResponse({ status: 201, type: PersonalEventResponseDto })
  async subscribeGlobalEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubscribeGlobalEventDto,
  ): Promise<PersonalEventResponseDto> {
    return this.timelineService.subscribeGlobalEvent(user.id, dto);
  }

  @Get('personal-events')
  @ApiOperation({ summary: 'Get all personal events' })
  @ApiResponse({ status: 200, type: [PersonalEventResponseDto] })
  async getPersonalEvents(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<PersonalEventResponseDto[]> {
    return this.timelineService.getPersonalEvents(user.id);
  }

  @Get('personal-events/:id')
  @ApiOperation({ summary: 'Get personal event details' })
  async getPersonalEventById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.timelineService.getPersonalEventById(user.id, id);
  }

  @Put('personal-events/:id')
  @ApiOperation({ summary: 'Update personal event' })
  @ApiResponse({ status: 200, type: PersonalEventResponseDto })
  async updatePersonalEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePersonalEventDto,
  ): Promise<PersonalEventResponseDto> {
    return this.timelineService.updatePersonalEvent(user.id, id, dto);
  }

  @Delete('personal-events/:id')
  @ApiOperation({ summary: 'Delete personal event' })
  async deletePersonalEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.timelineService.deletePersonalEvent(user.id, id);
  }

  // ============ Personal Task Endpoints ============

  @Post('personal-tasks')
  @ApiOperation({ summary: 'Create personal task' })
  @ApiResponse({ status: 201, type: PersonalTaskResponseDto })
  async createPersonalTask(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePersonalTaskDto,
  ): Promise<PersonalTaskResponseDto> {
    return this.timelineService.createPersonalTask(user.id, dto);
  }

  @Post('personal-tasks/:taskId/toggle')
  @ApiOperation({ summary: 'Toggle personal task completion status' })
  @ApiResponse({ status: 200, type: PersonalTaskResponseDto })
  async togglePersonalTaskComplete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
  ): Promise<PersonalTaskResponseDto> {
    return this.timelineService.togglePersonalTaskComplete(user.id, taskId);
  }

  @Delete('personal-tasks/:taskId')
  @ApiOperation({ summary: 'Delete personal task' })
  async deletePersonalTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
  ): Promise<void> {
    return this.timelineService.deletePersonalTask(user.id, taskId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get timeline details' })
  @ApiResponse({ status: 200, type: TimelineResponseDto })
  async getTimelineById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<TimelineResponseDto> {
    return this.timelineService.getTimelineById(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update timeline' })
  @ApiResponse({ status: 200, type: TimelineResponseDto })
  async updateTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTimelineDto,
  ): Promise<TimelineResponseDto> {
    return this.timelineService.updateTimeline(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete timeline' })
  async deleteTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.timelineService.deleteTimeline(user.id, id);
  }

  // ============ Task Endpoints ============

  @Post('tasks')
  @ApiOperation({ summary: 'Create task' })
  @ApiResponse({ status: 201, type: TaskResponseDto })
  async createTask(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.timelineService.createTask(user.id, dto);
  }

  @Put('tasks/:taskId')
  @ApiOperation({ summary: 'Update task' })
  @ApiResponse({ status: 200, type: TaskResponseDto })
  async updateTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.timelineService.updateTask(user.id, taskId, dto);
  }

  @Post('tasks/:taskId/toggle')
  @ApiOperation({ summary: 'Toggle task completion status' })
  @ApiResponse({ status: 200, type: TaskResponseDto })
  async toggleTaskComplete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
  ): Promise<TaskResponseDto> {
    return this.timelineService.toggleTaskComplete(user.id, taskId);
  }

  @Delete('tasks/:taskId')
  @ApiOperation({ summary: 'Delete task' })
  async deleteTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
  ): Promise<void> {
    return this.timelineService.deleteTask(user.id, taskId);
  }
}

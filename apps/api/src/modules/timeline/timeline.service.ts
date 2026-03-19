import { Injectable } from '@nestjs/common';
import { TimelineApplicationService } from './timeline-application.service';
import { TimelinePersonalEventService } from './timeline-personal-event.service';
import {
  CreateTimelineDto,
  UpdateTimelineDto,
  TimelineResponseDto,
  CreateTaskDto,
  UpdateTaskDto,
  TaskResponseDto,
  GenerateTimelineDto,
  TimelineOverviewDto,
  CreatePersonalEventDto,
  UpdatePersonalEventDto,
  SubscribeGlobalEventDto,
  PersonalEventResponseDto,
  CreatePersonalTaskDto,
  PersonalTaskResponseDto,
} from './dto';

@Injectable()
export class TimelineService {
  constructor(
    private readonly application: TimelineApplicationService,
    private readonly personalEvent: TimelinePersonalEventService,
  ) {}

  // ============ Application Timelines ============

  createTimeline(
    userId: string,
    dto: CreateTimelineDto,
    locale?: string,
  ): Promise<TimelineResponseDto> {
    return this.application.createTimeline(userId, dto, locale);
  }

  generateTimelines(userId: string, dto: GenerateTimelineDto, locale?: string) {
    return this.application.generateTimelines(userId, dto, locale);
  }

  getTimelines(userId: string): Promise<TimelineResponseDto[]> {
    return this.application.getTimelines(userId);
  }

  getTimelineById(userId: string, id: string) {
    return this.application.getTimelineById(userId, id);
  }

  updateTimeline(
    userId: string,
    id: string,
    dto: UpdateTimelineDto,
  ): Promise<TimelineResponseDto> {
    return this.application.updateTimeline(userId, id, dto);
  }

  deleteTimeline(userId: string, id: string): Promise<void> {
    return this.application.deleteTimeline(userId, id);
  }

  async getOverview(userId: string): Promise<TimelineOverviewDto> {
    const [appOverview, personalEvents] = await Promise.all([
      this.application.getOverview(userId),
      this.personalEvent.getPersonalEvents(userId),
    ]);

    const now = new Date();
    const upcomingPersonalEvents = personalEvents
      .filter(
        (e) =>
          ((e.deadline && new Date(e.deadline) > now) ||
            (e.eventDate && new Date(e.eventDate) > now)) &&
          e.status !== 'COMPLETED',
      )
      .slice(0, 5);

    return {
      ...appOverview,
      totalPersonalEvents: personalEvents.length,
      personalInProgress: personalEvents.filter(
        (e) => e.status === 'IN_PROGRESS',
      ).length,
      personalCompleted: personalEvents.filter((e) => e.status === 'COMPLETED')
        .length,
      upcomingPersonalEvents,
    };
  }

  getGlobalEvents(year?: number) {
    return this.application.getGlobalEvents(year);
  }

  // ============ Tasks ============

  createTask(userId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
    return this.application.createTask(userId, dto);
  }

  updateTask(
    userId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.application.updateTask(userId, taskId, dto);
  }

  deleteTask(userId: string, taskId: string): Promise<void> {
    return this.application.deleteTask(userId, taskId);
  }

  toggleTaskComplete(userId: string, taskId: string): Promise<TaskResponseDto> {
    return this.application.toggleTaskComplete(userId, taskId);
  }

  // ============ Personal Events ============

  createPersonalEvent(
    userId: string,
    dto: CreatePersonalEventDto,
  ): Promise<PersonalEventResponseDto> {
    return this.personalEvent.createPersonalEvent(userId, dto);
  }

  subscribeGlobalEvent(
    userId: string,
    dto: SubscribeGlobalEventDto,
  ): Promise<PersonalEventResponseDto> {
    return this.personalEvent.subscribeGlobalEvent(userId, dto);
  }

  getPersonalEvents(userId: string): Promise<PersonalEventResponseDto[]> {
    return this.personalEvent.getPersonalEvents(userId);
  }

  getPersonalEventById(userId: string, id: string) {
    return this.personalEvent.getPersonalEventById(userId, id);
  }

  updatePersonalEvent(
    userId: string,
    id: string,
    dto: UpdatePersonalEventDto,
  ): Promise<PersonalEventResponseDto> {
    return this.personalEvent.updatePersonalEvent(userId, id, dto);
  }

  deletePersonalEvent(userId: string, id: string): Promise<void> {
    return this.personalEvent.deletePersonalEvent(userId, id);
  }

  // ============ Personal Tasks ============

  createPersonalTask(
    userId: string,
    dto: CreatePersonalTaskDto,
  ): Promise<PersonalTaskResponseDto> {
    return this.personalEvent.createPersonalTask(userId, dto);
  }

  togglePersonalTaskComplete(
    userId: string,
    taskId: string,
  ): Promise<PersonalTaskResponseDto> {
    return this.personalEvent.togglePersonalTaskComplete(userId, taskId);
  }

  deletePersonalTask(userId: string, taskId: string): Promise<void> {
    return this.personalEvent.deletePersonalTask(userId, taskId);
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('TimelineController', () => {
  let controller: TimelineController;
  let timelineService: TimelineService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  const mockTimeline = { id: 'tl-1', userId: 'user-1', name: 'Fall 2025' };
  const mockTask = { id: 'task-1', title: 'Submit TOEFL', completed: false };
  const mockEvent = { id: 'evt-1', title: 'TOEFL Deadline' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimelineController],
      providers: [
        {
          provide: TimelineService,
          useValue: {
            createTimeline: jest.fn().mockResolvedValue(mockTimeline),
            generateTimelines: jest
              .fn()
              .mockResolvedValue({ created: [mockTimeline], failed: [] }),
            getTimelines: jest.fn().mockResolvedValue([mockTimeline]),
            getOverview: jest.fn().mockResolvedValue({ total: 1, upcoming: 3 }),
            getGlobalEvents: jest.fn().mockResolvedValue([mockEvent]),
            createPersonalEvent: jest.fn().mockResolvedValue(mockEvent),
            subscribeGlobalEvent: jest.fn().mockResolvedValue(mockEvent),
            getPersonalEvents: jest.fn().mockResolvedValue([mockEvent]),
            getPersonalEventById: jest.fn().mockResolvedValue(mockEvent),
            updatePersonalEvent: jest
              .fn()
              .mockResolvedValue({ ...mockEvent, title: 'Updated' }),
            deletePersonalEvent: jest.fn().mockResolvedValue(undefined),
            createPersonalTask: jest.fn().mockResolvedValue(mockTask),
            togglePersonalTaskComplete: jest
              .fn()
              .mockResolvedValue({ ...mockTask, completed: true }),
            deletePersonalTask: jest.fn().mockResolvedValue(undefined),
            getTimelineById: jest.fn().mockResolvedValue(mockTimeline),
            updateTimeline: jest
              .fn()
              .mockResolvedValue({ ...mockTimeline, name: 'Updated' }),
            deleteTimeline: jest.fn().mockResolvedValue(undefined),
            createTask: jest.fn().mockResolvedValue(mockTask),
            updateTask: jest
              .fn()
              .mockResolvedValue({ ...mockTask, title: 'Updated' }),
            toggleTaskComplete: jest
              .fn()
              .mockResolvedValue({ ...mockTask, completed: true }),
            deleteTask: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TimelineController>(TimelineController);
    timelineService = module.get<TimelineService>(TimelineService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============ Timeline Endpoints ============

  describe('POST /timelines', () => {
    it('should create a timeline', async () => {
      const dto = { name: 'Fall 2025' };
      const result = await controller.createTimeline(
        mockUser as any,
        dto as any,
      );

      expect(timelineService.createTimeline).toHaveBeenCalledWith(
        'user-1',
        dto,
        'zh',
      );
      expect(result).toEqual(mockTimeline);
    });
  });

  describe('POST /timelines/generate', () => {
    it('should generate timelines', async () => {
      const dto = { schoolIds: ['s1', 's2'] };
      const result = await controller.generateTimelines(
        mockUser as any,
        dto as any,
      );

      expect(timelineService.generateTimelines).toHaveBeenCalledWith(
        'user-1',
        dto,
        'zh',
      );
      expect(result).toEqual({ created: [mockTimeline], failed: [] });
    });
  });

  describe('GET /timelines', () => {
    it('should return all timelines for the user', async () => {
      const result = await controller.getTimelines(mockUser as any);

      expect(timelineService.getTimelines).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockTimeline]);
    });
  });

  describe('GET /timelines/overview', () => {
    it('should return overview stats', async () => {
      const result = await controller.getOverview(mockUser as any);

      expect(timelineService.getOverview).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ total: 1, upcoming: 3 });
    });
  });

  describe('GET /timelines/global-events', () => {
    it('should return global events', async () => {
      const result = await controller.getGlobalEvents(2025);

      expect(timelineService.getGlobalEvents).toHaveBeenCalledWith(2025);
      expect(result).toEqual([mockEvent]);
    });
  });

  // ============ Personal Event Endpoints ============

  describe('POST /timelines/personal-events', () => {
    it('should create a personal event', async () => {
      const dto = { title: 'TOEFL Deadline' };
      const result = await controller.createPersonalEvent(
        mockUser as any,
        dto as any,
      );

      expect(timelineService.createPersonalEvent).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(mockEvent);
    });
  });

  describe('POST /timelines/personal-events/subscribe', () => {
    it('should subscribe to a global event', async () => {
      const dto = { globalEventId: 'ge-1' };
      const result = await controller.subscribeGlobalEvent(
        mockUser as any,
        dto as any,
      );

      expect(timelineService.subscribeGlobalEvent).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(mockEvent);
    });
  });

  describe('GET /timelines/personal-events', () => {
    it('should return all personal events', async () => {
      const result = await controller.getPersonalEvents(mockUser as any);

      expect(timelineService.getPersonalEvents).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockEvent]);
    });
  });

  describe('GET /timelines/personal-events/:id', () => {
    it('should return a personal event by id', async () => {
      const result = await controller.getPersonalEventById(
        mockUser as any,
        'evt-1',
      );

      expect(timelineService.getPersonalEventById).toHaveBeenCalledWith(
        'user-1',
        'evt-1',
      );
      expect(result).toEqual(mockEvent);
    });
  });

  describe('PUT /timelines/personal-events/:id', () => {
    it('should update a personal event', async () => {
      const dto = { title: 'Updated' };
      const result = await controller.updatePersonalEvent(
        mockUser as any,
        'evt-1',
        dto as any,
      );

      expect(timelineService.updatePersonalEvent).toHaveBeenCalledWith(
        'user-1',
        'evt-1',
        dto,
      );
      expect(result).toEqual({ ...mockEvent, title: 'Updated' });
    });
  });

  describe('DELETE /timelines/personal-events/:id', () => {
    it('should delete a personal event', async () => {
      await controller.deletePersonalEvent(mockUser as any, 'evt-1');

      expect(timelineService.deletePersonalEvent).toHaveBeenCalledWith(
        'user-1',
        'evt-1',
      );
    });
  });

  // ============ Personal Task Endpoints ============

  describe('POST /timelines/personal-tasks', () => {
    it('should create a personal task', async () => {
      const dto = { title: 'Submit TOEFL' };
      const result = await controller.createPersonalTask(
        mockUser as any,
        dto as any,
      );

      expect(timelineService.createPersonalTask).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(mockTask);
    });
  });

  describe('POST /timelines/personal-tasks/:taskId/toggle', () => {
    it('should toggle personal task completion', async () => {
      const result = await controller.togglePersonalTaskComplete(
        mockUser as any,
        'task-1',
      );

      expect(timelineService.togglePersonalTaskComplete).toHaveBeenCalledWith(
        'user-1',
        'task-1',
      );
      expect(result.completed).toBe(true);
    });
  });

  describe('DELETE /timelines/personal-tasks/:taskId', () => {
    it('should delete a personal task', async () => {
      await controller.deletePersonalTask(mockUser as any, 'task-1');

      expect(timelineService.deletePersonalTask).toHaveBeenCalledWith(
        'user-1',
        'task-1',
      );
    });
  });

  // ============ Timeline CRUD ============

  describe('GET /timelines/:id', () => {
    it('should return a timeline by id', async () => {
      const result = await controller.getTimelineById(mockUser as any, 'tl-1');

      expect(timelineService.getTimelineById).toHaveBeenCalledWith(
        'user-1',
        'tl-1',
      );
      expect(result).toEqual(mockTimeline);
    });
  });

  describe('PUT /timelines/:id', () => {
    it('should update a timeline', async () => {
      const dto = { name: 'Updated' };
      const result = await controller.updateTimeline(
        mockUser as any,
        'tl-1',
        dto as any,
      );

      expect(timelineService.updateTimeline).toHaveBeenCalledWith(
        'user-1',
        'tl-1',
        dto,
      );
      expect((result as any).name).toBe('Updated');
    });
  });

  describe('DELETE /timelines/:id', () => {
    it('should delete a timeline', async () => {
      await controller.deleteTimeline(mockUser as any, 'tl-1');

      expect(timelineService.deleteTimeline).toHaveBeenCalledWith(
        'user-1',
        'tl-1',
      );
    });
  });

  // ============ Task Endpoints ============

  describe('POST /timelines/tasks', () => {
    it('should create a task', async () => {
      const dto = { title: 'Submit TOEFL', timelineId: 'tl-1' };
      const result = await controller.createTask(mockUser as any, dto as any);

      expect(timelineService.createTask).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(mockTask);
    });
  });

  describe('PUT /timelines/tasks/:taskId', () => {
    it('should update a task', async () => {
      const dto = { title: 'Updated' };
      const result = await controller.updateTask(
        mockUser as any,
        'task-1',
        dto as any,
      );

      expect(timelineService.updateTask).toHaveBeenCalledWith(
        'user-1',
        'task-1',
        dto,
      );
      expect(result.title).toBe('Updated');
    });
  });

  describe('POST /timelines/tasks/:taskId/toggle', () => {
    it('should toggle task completion', async () => {
      const result = await controller.toggleTaskComplete(
        mockUser as any,
        'task-1',
      );

      expect(timelineService.toggleTaskComplete).toHaveBeenCalledWith(
        'user-1',
        'task-1',
      );
      expect(result.completed).toBe(true);
    });
  });

  describe('DELETE /timelines/tasks/:taskId', () => {
    it('should delete a task', async () => {
      await controller.deleteTask(mockUser as any, 'task-1');

      expect(timelineService.deleteTask).toHaveBeenCalledWith(
        'user-1',
        'task-1',
      );
    });
  });
});

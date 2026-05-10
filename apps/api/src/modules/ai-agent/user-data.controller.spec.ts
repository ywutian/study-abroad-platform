import { Test, TestingModule } from '@nestjs/testing';
import { UserDataController } from './user-data.controller';
import { UserDataService } from './memory/user-data.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('UserDataController', () => {
  let controller: UserDataController;
  let userDataService: UserDataService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  const mockMemory = { id: 'mem-1', content: 'User prefers MIT' };
  const mockConversation = { id: 'conv-1', title: 'School selection' };
  const mockEntity = { id: 'ent-1', name: 'MIT', type: 'SCHOOL' };
  const mockPreferences = {
    language: 'zh',
    essayPreferences: { tone: 'formal' },
  };
  const mockStats = {
    memoriesCount: 5,
    conversationsCount: 3,
    entitiesCount: 2,
  };

  const mockResponse = {
    setHeader: jest.fn(),
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserDataController],
      providers: [
        {
          provide: UserDataService,
          useValue: {
            getMemories: jest
              .fn()
              .mockResolvedValue({ items: [mockMemory], total: 1 }),
            getMemory: jest.fn().mockResolvedValue(mockMemory),
            deleteMemory: jest.fn().mockResolvedValue(undefined),
            deleteMemories: jest.fn().mockResolvedValue({ deleted: 2 }),
            clearAllMemories: jest.fn().mockResolvedValue(5),
            getConversations: jest
              .fn()
              .mockResolvedValue({ items: [mockConversation], total: 1 }),
            getConversation: jest.fn().mockResolvedValue(mockConversation),
            deleteConversation: jest.fn().mockResolvedValue(undefined),
            clearAllConversations: jest.fn().mockResolvedValue(3),
            getEntities: jest
              .fn()
              .mockResolvedValue({ items: [mockEntity], total: 1 }),
            deleteEntity: jest.fn().mockResolvedValue(undefined),
            clearAllEntities: jest.fn().mockResolvedValue(2),
            getPreferences: jest.fn().mockResolvedValue(mockPreferences),
            updatePreferences: jest.fn().mockResolvedValue({
              ...mockPreferences,
              essayPreferences: { tone: 'casual' },
            }),
            resetPreferences: jest.fn().mockResolvedValue(undefined),
            exportData: jest
              .fn()
              .mockResolvedValue({ memories: [], conversations: [] }),
            getStats: jest.fn().mockResolvedValue(mockStats),
            clearData: jest.fn().mockResolvedValue({
              memoriesDeleted: 5,
              conversationsDeleted: 3,
              entitiesDeleted: 2,
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserDataController>(UserDataController);
    userDataService = module.get<UserDataService>(UserDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Memory Management ====================

  describe('GET /memories', () => {
    it('should return paginated memories', async () => {
      const query = { page: 1, limit: 10 };
      const result = await controller.getMemories(mockUser, query);

      expect(userDataService.getMemories).toHaveBeenCalledWith('user-1', query);
      expect(result).toEqual({ items: [mockMemory], total: 1 });
    });
  });

  describe('GET /memories/:id', () => {
    it('should return a single memory', async () => {
      const result = await controller.getMemory(mockUser, 'mem-1');

      expect(userDataService.getMemory).toHaveBeenCalledWith('user-1', 'mem-1');
      expect(result).toEqual(mockMemory);
    });
  });

  describe('DELETE /memories/:id', () => {
    it('should delete a single memory', async () => {
      await controller.deleteMemory(mockUser, 'mem-1');

      expect(userDataService.deleteMemory).toHaveBeenCalledWith(
        'user-1',
        'mem-1',
      );
    });
  });

  describe('POST /memories/batch-delete', () => {
    it('should batch delete memories', async () => {
      const body = { ids: ['mem-1', 'mem-2'] };
      const result = await controller.batchDeleteMemories(mockUser, body);

      expect(userDataService.deleteMemories).toHaveBeenCalledWith('user-1', [
        'mem-1',
        'mem-2',
      ]);
      expect(result).toEqual({ deleted: 2 });
    });
  });

  describe('DELETE /memories', () => {
    it('should clear all memories', async () => {
      const result = await controller.clearAllMemories(mockUser);

      expect(userDataService.clearAllMemories).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ deleted: 5 });
    });
  });

  // ==================== Conversation Management ====================

  describe('GET /conversations', () => {
    it('should return paginated conversations', async () => {
      const query = { page: 1, limit: 10 };
      const result = await controller.getConversations(mockUser, query);

      expect(userDataService.getConversations).toHaveBeenCalledWith(
        'user-1',
        query,
      );
      expect(result).toEqual({ items: [mockConversation], total: 1 });
    });
  });

  describe('GET /conversations/:id', () => {
    it('should return conversation detail', async () => {
      const result = await controller.getConversation(mockUser, 'conv-1');

      expect(userDataService.getConversation).toHaveBeenCalledWith(
        'user-1',
        'conv-1',
      );
      expect(result).toEqual(mockConversation);
    });
  });

  describe('DELETE /conversations/:id', () => {
    it('should delete a conversation', async () => {
      await controller.deleteConversation(mockUser, 'conv-1');

      expect(userDataService.deleteConversation).toHaveBeenCalledWith(
        'user-1',
        'conv-1',
      );
    });
  });

  describe('DELETE /conversations', () => {
    it('should clear all conversations', async () => {
      const result = await controller.clearAllConversations(mockUser);

      expect(userDataService.clearAllConversations).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual({ deleted: 3 });
    });
  });

  // ==================== Entity Management ====================

  describe('GET /entities', () => {
    it('should return paginated entities', async () => {
      const query = { page: 1, limit: 10 };
      const result = await controller.getEntities(mockUser, query);

      expect(userDataService.getEntities).toHaveBeenCalledWith('user-1', query);
      expect(result).toEqual({ items: [mockEntity], total: 1 });
    });
  });

  describe('DELETE /entities/:id', () => {
    it('should delete an entity', async () => {
      await controller.deleteEntity(mockUser, 'ent-1');

      expect(userDataService.deleteEntity).toHaveBeenCalledWith(
        'user-1',
        'ent-1',
      );
    });
  });

  describe('DELETE /entities', () => {
    it('should clear all entities', async () => {
      const result = await controller.clearAllEntities(mockUser);

      expect(userDataService.clearAllEntities).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ deleted: 2 });
    });
  });

  // ==================== Preferences ====================

  describe('GET /preferences', () => {
    it('should return AI preferences', async () => {
      const result = await controller.getPreferences(mockUser);

      expect(userDataService.getPreferences).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('PUT /preferences', () => {
    it('should update AI preferences', async () => {
      const body = { essayPreferences: { tone: 'casual' } };
      const result = await controller.updatePreferences(mockUser, body);

      expect(userDataService.updatePreferences).toHaveBeenCalledWith(
        'user-1',
        body,
      );
      expect(result.essayPreferences?.tone).toBe('casual');
    });
  });

  describe('POST /preferences/reset', () => {
    it('should reset preferences and return defaults', async () => {
      const result = await controller.resetPreferences(mockUser);

      expect(userDataService.resetPreferences).toHaveBeenCalledWith('user-1');
      expect(userDataService.getPreferences).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockPreferences);
    });
  });

  // ==================== Data Export ====================

  describe('POST /export', () => {
    it('should export user data', async () => {
      const body = {
        includeMemories: true,
        includeConversations: true,
        includeEntities: false,
        includePreferences: false,
      };
      const result = await controller.exportData(mockUser, body);

      expect(userDataService.exportData).toHaveBeenCalledWith('user-1', body);
      expect(result).toEqual({ memories: [], conversations: [] });
    });
  });

  describe('GET /export/download', () => {
    it('should set Content-Disposition header and send JSON', async () => {
      await controller.downloadExport(mockUser, mockResponse as any);

      expect(userDataService.exportData).toHaveBeenCalledWith('user-1', {
        includeMemories: true,
        includeConversations: true,
        includeEntities: true,
        includePreferences: true,
      });
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename='),
      );
      expect(mockResponse.send).toHaveBeenCalled();
    });
  });

  // ==================== Stats ====================

  describe('GET /stats', () => {
    it('should return user data stats', async () => {
      const result = await controller.getStats(mockUser);

      expect(userDataService.getStats).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockStats);
    });
  });

  // ==================== Clear Data ====================

  describe('POST /clear', () => {
    it('should clear specified data categories', async () => {
      const body = {
        clearMemories: true,
        clearConversations: false,
        clearEntities: true,
      };
      const result = await controller.clearData(mockUser, body);

      expect(userDataService.clearData).toHaveBeenCalledWith('user-1', body);
      expect(result).toHaveProperty('memoriesDeleted');
    });
  });

  describe('DELETE /all', () => {
    it('should clear all AI data', async () => {
      const result = await controller.clearAllData(mockUser);

      expect(userDataService.clearData).toHaveBeenCalledWith('user-1', {
        clearMemories: true,
        clearConversations: true,
        clearEntities: true,
        resetPreferences: false,
      });
      expect(result).toHaveProperty('memoriesDeleted');
      expect(result).toHaveProperty('conversationsDeleted');
      expect(result).toHaveProperty('entitiesDeleted');
    });
  });
});

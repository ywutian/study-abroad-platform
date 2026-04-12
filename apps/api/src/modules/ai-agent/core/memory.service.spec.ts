import { Test, TestingModule } from '@nestjs/testing';
import { MemoryService } from './memory.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        {
          provide: PrismaService,
          useValue: {
            profile: {
              findFirst: jest.fn().mockResolvedValue(null),
              findUnique: jest.fn().mockResolvedValue(null),
            },
            schoolListItem: { findMany: jest.fn().mockResolvedValue([]) },
            deadline: { findMany: jest.fn().mockResolvedValue([]) },
            testScore: { findMany: jest.fn().mockResolvedValue([]) },
            activity: { findMany: jest.fn().mockResolvedValue([]) },
            award: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
      ],
    }).compile();

    service = module.get(MemoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a new conversation', async () => {
    const conv = await service.getOrCreateConversation('user-1');
    expect(conv).toHaveProperty('id');
    expect(conv.userId).toBe('user-1');
  });

  it('should return existing conversation by id', async () => {
    const conv1 = await service.getOrCreateConversation('user-1', 'conv-123');
    const conv2 = await service.getOrCreateConversation('user-1', 'conv-123');
    expect(conv1.id).toBe(conv2.id);
  });

  it('should add message to conversation', async () => {
    const conv = await service.getOrCreateConversation('user-1');
    service.addMessage(conv, { role: 'user', content: 'Hello' });
    const messages = service.getRecentMessages(conv);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].content).toBe('Hello');
  });

  it('should clear conversation', async () => {
    const conv = await service.getOrCreateConversation('user-1', 'conv-clear');
    service.addMessage(conv, { role: 'user', content: 'Hello' });
    service.clearConversation('user-1', 'conv-clear');
    // After clearing, a new getOrCreate creates fresh conversation
    const conv2 = await service.getOrCreateConversation('user-1', 'conv-clear');
    expect(conv2.messages.length).toBe(0);
  });

  it('should load user context', async () => {
    const context = await service.loadUserContext('user-1');
    expect(context).toHaveProperty('userId', 'user-1');
  });
});

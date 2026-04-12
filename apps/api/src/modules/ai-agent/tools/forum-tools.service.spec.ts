import { Test, TestingModule } from '@nestjs/testing';
import { ForumToolsService } from './forum-tools.service';
import { LLMService } from '../core/llm.service';
import { ForumService } from '../../forum/forum.service';

describe('ForumToolsService', () => {
  let service: ForumToolsService;
  let forumService: jest.Mocked<ForumService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumToolsService,
        {
          provide: LLMService,
          useValue: {
            chatSimple: jest.fn().mockResolvedValue('{"answer":"response"}'),
          },
        },
        {
          provide: ForumService,
          useValue: {
            getPosts: jest.fn().mockResolvedValue({ data: [], total: 0 }),
          },
        },
      ],
    }).compile();

    service = module.get(ForumToolsService);
    forumService = module.get(ForumService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('search_forum_posts')).toBe(true);
    expect(handlers.has('get_popular_discussions')).toBe(true);
    expect(handlers.has('answer_forum_question')).toBe(true);
  });

  it('should search forum posts', async () => {
    forumService.getPosts.mockResolvedValue({
      data: [{ id: 'p1', title: 'Test', content: 'body' }],
      total: 1,
    } as any);
    const result = await service.searchForumPosts('test', undefined, 5, 'en');
    expect(forumService.getPosts).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { FastRouterService } from './fast-router.service';

describe('FastRouterService', () => {
  let service: FastRouterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FastRouterService],
    }).compile();

    service = module.get(FastRouterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should route essay-related messages to ESSAY agent', () => {
    const result = service.route('帮我润色文书');
    expect(result.agent).toBe('essay');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.shouldUseLLM).toBe(false);
  });

  it('should return shouldUseLLM=true for ambiguous messages', () => {
    const result = service.route('你好');
    expect(result.shouldUseLLM).toBe(true);
  });

  it('should extract intent keywords', () => {
    const keywords = service.extractIntentKeywords('帮我选校和润色文书');
    expect(keywords.length).toBeGreaterThan(0);
  });

  it('should detect tool call needs', () => {
    expect(service.needsToolCall('搜索Stanford信息')).toBe(true);
  });

  it('should return simple response for greetings', () => {
    const response = service.getSimpleResponse('你好');
    expect(response).toBeDefined();
  });
});

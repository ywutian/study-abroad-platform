import { Test, TestingModule } from '@nestjs/testing';
import { SearchToolsService } from './search-tools.service';
import { WebSearchService } from '../services/web-search.service';

describe('SearchToolsService', () => {
  let service: SearchToolsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchToolsService,
        {
          provide: WebSearchService,
          useValue: {
            search: jest.fn().mockResolvedValue({ results: [] }),
            isAvailable: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get(SearchToolsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('web_search')).toBe(true);
    expect(handlers.has('search_school_website')).toBe(true);
  });

  it('should return error when search service unavailable', async () => {
    // Create service without WebSearchService
    const module = await Test.createTestingModule({
      providers: [SearchToolsService],
    }).compile();
    const svcNoSearch = module.get(SearchToolsService);

    const result = await svcNoSearch.webSearch('test query', undefined, 'en');
    expect(result).toHaveProperty('error');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { EssayPromptController } from './essay-prompt.controller';
import { EssayPromptService } from './essay-prompt.service';

describe('EssayPromptController', () => {
  let controller: EssayPromptController;
  let essayPromptService: EssayPromptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EssayPromptController],
      providers: [
        {
          provide: EssayPromptService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<EssayPromptController>(EssayPromptController);
    essayPromptService = module.get<EssayPromptService>(EssayPromptService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET / should call findAll with status forced to VERIFIED', async () => {
    const query = { page: 1, pageSize: 10, schoolId: 'school-1' } as any;
    const expected = { data: [], total: 0 };
    (essayPromptService.findAll as jest.Mock).mockResolvedValue(expected);

    const result = await controller.findAll(query);

    expect(essayPromptService.findAll).toHaveBeenCalledWith({
      ...query,
      status: 'VERIFIED',
    });
    expect(result).toEqual(expected);
  });

  it('GET /:id should call findOne with id', async () => {
    const expected = { id: 'prompt-1', title: 'Why this school?' };
    (essayPromptService.findOne as jest.Mock).mockResolvedValue(expected);

    const result = await controller.findOne('prompt-1');

    expect(essayPromptService.findOne).toHaveBeenCalledWith('prompt-1');
    expect(result).toEqual(expected);
  });
});

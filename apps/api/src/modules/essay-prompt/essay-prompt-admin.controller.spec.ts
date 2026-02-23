import { Test, TestingModule } from '@nestjs/testing';
import { EssayPromptAdminController } from './essay-prompt-admin.controller';
import { EssayPromptService } from './essay-prompt.service';

describe('EssayPromptAdminController', () => {
  let controller: EssayPromptAdminController;
  let essayPromptService: EssayPromptService;

  const mockAdmin = {
    id: 'admin-1',
    email: 'admin@test.com',
    role: 'ADMIN',
    locale: 'zh',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EssayPromptAdminController],
      providers: [
        {
          provide: EssayPromptService,
          useValue: {
            getStats: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            verify: jest.fn(),
            batchImport: jest.fn(),
            batchVerify: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<EssayPromptAdminController>(
      EssayPromptAdminController,
    );
    essayPromptService = module.get<EssayPromptService>(EssayPromptService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET /stats should call getStats with optional year', async () => {
    const expected = { total: 100, verified: 80 };
    (essayPromptService.getStats as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getStats(2025);

    expect(essayPromptService.getStats).toHaveBeenCalledWith(2025);
    expect(result).toEqual(expected);
  });

  it('GET / should call findAll with query (no forced status)', async () => {
    const query = { page: 1, pageSize: 20 } as any;
    const expected = { data: [], total: 0 };
    (essayPromptService.findAll as jest.Mock).mockResolvedValue(expected);

    const result = await controller.findAll(query);

    expect(essayPromptService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('GET /:id should call findOne with id', async () => {
    const expected = { id: 'prompt-1', title: 'Test' };
    (essayPromptService.findOne as jest.Mock).mockResolvedValue(expected);

    const result = await controller.findOne('prompt-1');

    expect(essayPromptService.findOne).toHaveBeenCalledWith('prompt-1');
    expect(result).toEqual(expected);
  });

  it('POST / should call create with dto and user.id', async () => {
    const dto = { title: 'New Prompt', schoolId: 'school-1' } as any;
    const expected = { id: 'prompt-2', ...dto };
    (essayPromptService.create as jest.Mock).mockResolvedValue(expected);

    const result = await controller.create(mockAdmin as any, dto);

    expect(essayPromptService.create).toHaveBeenCalledWith(dto, 'admin-1');
    expect(result).toEqual(expected);
  });

  it('PUT /:id should call update with id, dto, user.id', async () => {
    const dto = { title: 'Updated Prompt' } as any;
    const expected = { id: 'prompt-1', title: 'Updated Prompt' };
    (essayPromptService.update as jest.Mock).mockResolvedValue(expected);

    const result = await controller.update(mockAdmin as any, 'prompt-1', dto);

    expect(essayPromptService.update).toHaveBeenCalledWith(
      'prompt-1',
      dto,
      'admin-1',
    );
    expect(result).toEqual(expected);
  });

  it('POST /:id/verify should call verify with id, dto, user.id', async () => {
    const dto = { status: 'VERIFIED', reason: 'Looks good' } as any;
    const expected = { id: 'prompt-1', status: 'VERIFIED' };
    (essayPromptService.verify as jest.Mock).mockResolvedValue(expected);

    const result = await controller.verify(mockAdmin as any, 'prompt-1', dto);

    expect(essayPromptService.verify).toHaveBeenCalledWith(
      'prompt-1',
      dto,
      'admin-1',
    );
    expect(result).toEqual(expected);
  });

  it('POST /batch-import should call batchImport with dto and user.id', async () => {
    const dto = { prompts: [{ title: 'A' }, { title: 'B' }] } as any;
    const expected = { imported: 2 };
    (essayPromptService.batchImport as jest.Mock).mockResolvedValue(expected);

    const result = await controller.batchImport(mockAdmin as any, dto);

    expect(essayPromptService.batchImport).toHaveBeenCalledWith(dto, 'admin-1');
    expect(result).toEqual(expected);
  });

  it('POST /batch-verify should call batchVerify with ids, status, user.id, reason', async () => {
    const dto = {
      ids: ['p-1', 'p-2'],
      status: 'VERIFIED',
      reason: 'Batch approved',
    } as any;
    const expected = { updated: 2 };
    (essayPromptService.batchVerify as jest.Mock).mockResolvedValue(expected);

    const result = await controller.batchVerify(mockAdmin as any, dto);

    expect(essayPromptService.batchVerify).toHaveBeenCalledWith(
      ['p-1', 'p-2'],
      'VERIFIED',
      'admin-1',
      'Batch approved',
    );
    expect(result).toEqual(expected);
  });

  it('DELETE /:id should call remove with id and user.id', async () => {
    const expected = { deleted: true };
    (essayPromptService.remove as jest.Mock).mockResolvedValue(expected);

    const result = await controller.remove(mockAdmin as any, 'prompt-1');

    expect(essayPromptService.remove).toHaveBeenCalledWith(
      'prompt-1',
      'admin-1',
    );
    expect(result).toEqual(expected);
  });
});

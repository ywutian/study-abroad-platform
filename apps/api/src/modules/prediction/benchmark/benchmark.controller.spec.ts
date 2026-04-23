import { Test, TestingModule } from '@nestjs/testing';
import { BenchmarkController } from './benchmark.controller';
import { BenchmarkService } from './benchmark.service';

describe('BenchmarkController', () => {
  let controller: BenchmarkController;
  const benchmarkService = {
    listProfiles: jest.fn(),
    createProfile: jest.fn(),
    listSources: jest.fn(),
    saveSession: jest.fn(),
    listRuns: jest.fn(),
    startRun: jest.fn(),
    getRunDetail: jest.fn(),
    buildReport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BenchmarkController],
      providers: [
        {
          provide: BenchmarkService,
          useValue: benchmarkService,
        },
      ],
    }).compile();

    controller = module.get<BenchmarkController>(BenchmarkController);
    jest.clearAllMocks();
  });

  it('forwards startRun payload to the service', async () => {
    benchmarkService.startRun.mockResolvedValue({ id: 'run-1' });

    await controller.startRun({
      profileId: 'profile-1',
      sourceKey: 'mock',
      limit: 10,
      headed: true,
    });

    expect(benchmarkService.startRun).toHaveBeenCalledWith({
      profileId: 'profile-1',
      sourceKey: 'mock',
      limit: 10,
      headed: true,
    });
  });

  it('delegates report lookup', async () => {
    benchmarkService.buildReport.mockResolvedValue({
      runId: 'run-1',
      rows: [],
    });

    const result = await controller.getRunReport('run-1');

    expect(benchmarkService.buildReport).toHaveBeenCalledWith('run-1');
    expect(result).toEqual({ runId: 'run-1', rows: [] });
  });
});

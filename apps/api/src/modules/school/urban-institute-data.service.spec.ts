import { Test, TestingModule } from '@nestjs/testing';
import { UrbanInstituteDataService } from './urban-institute-data.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolDataMerger } from './school-data-merger';
import { AuditLogService } from '../../common/services/audit-log.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('UrbanInstituteDataService', () => {
  let service: UrbanInstituteDataService;

  const mockPrisma = {
    school: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    schoolMetric: {
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockMerger = {
    merge: jest.fn().mockResolvedValue({
      updatedFields: ['acceptanceRate'],
      skippedFields: [],
    }),
    mergeField: jest.fn(),
    mergeSchoolData: jest.fn().mockResolvedValue({ updated: true }),
  };

  const mockAuditLog = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    mockFetch.mockReset();
    mockPrisma.school.findMany.mockReset();
    mockPrisma.school.findUnique.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrbanInstituteDataService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SchoolDataMerger, useValue: mockMerger },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<UrbanInstituteDataService>(UrbanInstituteDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('targets requested schools by promoted IPEDS ids', async () => {
    mockPrisma.school.findMany.mockResolvedValue([
      { ipedsId: '166027' },
      { ipedsId: null },
      { ipedsId: '110635' },
    ]);
    mockPrisma.school.findUnique.mockResolvedValue({
      id: 'school-a',
      name: 'School A',
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [], next: null }),
    });

    await service.syncSchoolsByIds(['school-a', 'school-b', 'school-a'], 2023);

    expect(mockPrisma.school.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['school-a', 'school-b'] } },
      select: { ipedsId: true },
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    for (const [url] of mockFetch.mock.calls) {
      const requestedUrl = new URL(String(url));
      expect(requestedUrl.searchParams.get('unitid')).toBe('166027,110635');
      expect(requestedUrl.searchParams.has('page')).toBe(false);
    }
  });
});

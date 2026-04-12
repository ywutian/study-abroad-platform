import { Test, TestingModule } from '@nestjs/testing';
import { UrbanInstituteDataService } from './urban-institute-data.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolDataMerger } from './school-data-merger';
import { AuditLogService } from '../../common/services/audit-log.service';

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
    mergeField: jest.fn(),
    mergeSchoolData: jest.fn().mockResolvedValue({ updated: true }),
  };

  const mockAuditLog = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
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
});

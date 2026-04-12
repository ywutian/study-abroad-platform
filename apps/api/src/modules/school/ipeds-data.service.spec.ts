import { Test, TestingModule } from '@nestjs/testing';
import { IpedsDataService } from './ipeds-data.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('IpedsDataService', () => {
  let service: IpedsDataService;
  let prisma: PrismaService;

  const mockPrisma = {
    school: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    schoolMetric: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpedsDataService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<IpedsDataService>(IpedsDataService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('importInternationalStudentData', () => {
    it('should upsert metrics for found schools', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        name: 'MIT',
      });
      mockPrisma.schoolMetric.upsert.mockResolvedValue({});

      await service.importInternationalStudentData([
        {
          unitId: '166683',
          schoolName: 'MIT',
          year: 2024,
          internationalPct: 11.5,
        },
      ]);

      expect(mockPrisma.schoolMetric.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId_year_metricKey: {
              schoolId: 'school-1',
              year: 2024,
              metricKey: 'intl_student_pct',
            },
          }),
        }),
      );
    });

    it('should skip schools not found in DB', async () => {
      mockPrisma.school.findUnique.mockResolvedValue(null);

      await service.importInternationalStudentData([
        {
          unitId: '999999',
          schoolName: 'Unknown',
          year: 2024,
          internationalPct: 5,
        },
      ]);

      expect(mockPrisma.schoolMetric.upsert).not.toHaveBeenCalled();
    });
  });

  describe('parseIpedsCsv', () => {
    it('should parse CSV content into row objects', async () => {
      const csv = 'UNITID,INSTNM,VALUE\n123456,MIT,100\n789012,Harvard,200';

      const result = await service.parseIpedsCsv(csv, 'ADM');

      expect(result).toHaveLength(2);
      expect(result[0].UNITID).toBe('123456');
      expect(result[0].INSTNM).toBe('MIT');
    });

    it('should skip malformed rows', async () => {
      const csv = 'A,B,C\n1,2,3\n1,2';

      const result = await service.parseIpedsCsv(csv, 'ADM');

      expect(result).toHaveLength(1);
    });
  });
});

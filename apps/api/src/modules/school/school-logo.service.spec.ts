import { Test, TestingModule } from '@nestjs/testing';
import { SchoolLogoService, extractDomainForLogo } from './school-logo.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolService } from './school.service';
import { AuditLogService } from '../../common/services/audit-log.service';

describe('SchoolLogoService', () => {
  let service: SchoolLogoService;

  const mockConfig = {
    get: jest.fn().mockReturnValue('test-token'),
  };

  const mockPrisma = {
    school: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockSchoolService = {
    invalidateSchoolCache: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditLog = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolLogoService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SchoolService, useValue: mockSchoolService },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<SchoolLogoService>(SchoolLogoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractDomainForLogo', () => {
    it('should extract domain from full URL', () => {
      expect(extractDomainForLogo('https://www.mit.edu')).toBe('mit.edu');
    });

    it('should strip www prefix', () => {
      expect(extractDomainForLogo('https://www.harvard.edu')).toBe(
        'harvard.edu',
      );
    });

    it('should return null for null/empty input', () => {
      expect(extractDomainForLogo(null)).toBeNull();
      expect(extractDomainForLogo('')).toBeNull();
    });

    it('should return null for localhost', () => {
      expect(extractDomainForLogo('http://localhost:3000')).toBeNull();
    });

    it('should handle URLs without protocol', () => {
      expect(extractDomainForLogo('mit.edu')).toBe('mit.edu');
    });
  });

  describe('isConfigured', () => {
    it('should return true when token is set', () => {
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('getLogoUrlForDomain', () => {
    it('should build Logo.dev URL', () => {
      const url = service.getLogoUrlForDomain('mit.edu');

      expect(url).toContain('logo.dev');
      expect(url).toContain('mit.edu');
      expect(url).toContain('test-token');
    });
  });

  describe('getSuggestedLogoUrl', () => {
    it('should return URL for valid website', () => {
      const url = service.getSuggestedLogoUrl('https://www.mit.edu');

      expect(url).toContain('mit.edu');
    });

    it('should return null for invalid website', () => {
      expect(service.getSuggestedLogoUrl(null)).toBeNull();
    });
  });

  describe('fillLogosByDomain', () => {
    it('should update schools with logos', async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { id: 's1', name: 'MIT', website: 'https://www.mit.edu' },
      ]);
      mockPrisma.school.update.mockResolvedValue({});

      const result = await service.fillLogosByDomain(10, 'admin-1');

      expect(result.filled).toBe(1);
      expect(mockAuditLog.log).toHaveBeenCalled();
    });

    it('should handle no schools needing logos', async () => {
      mockPrisma.school.findMany.mockResolvedValue([]);

      const result = await service.fillLogosByDomain(10, 'admin-1');

      expect(result.filled).toBe(0);
      expect(result.message).toContain('No schools');
    });
  });
});

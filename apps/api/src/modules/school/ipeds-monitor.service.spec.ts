import { Test, TestingModule } from '@nestjs/testing';
import { IpedsMonitorService } from './ipeds-monitor.service';
import { EmailService } from '../../common/email/email.service';
import { SettingsService } from '../settings/settings.service';

describe('IpedsMonitorService', () => {
  let service: IpedsMonitorService;

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockSettingsService = {
    getTyped: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue('admin@example.com'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpedsMonitorService,
        { provide: EmailService, useValue: mockEmailService },
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    service = module.get<IpedsMonitorService>(IpedsMonitorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDownloadLinks', () => {
    it('should return IPEDS download URLs', () => {
      const links = service.getDownloadLinks();

      expect(links.dataCenter).toContain('nces.ed.gov');
      expect(links.directLinks.admissions).toContain('ADM');
      expect(links.directLinks.enrollment).toContain('EF');
      expect(links.directLinks.institutional).toContain('IC');
    });
  });
});

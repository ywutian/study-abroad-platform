import { Test, TestingModule } from '@nestjs/testing';
import { IpedsMonitorService } from './ipeds-monitor.service';
import { EmailService } from '../../common/email/email.service';
import { SettingsService } from '../settings/settings.service';
import { RedisService } from '../../common/redis/redis.service';

describe('IpedsMonitorService', () => {
  let service: IpedsMonitorService;

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockSettingsService = {
    getTyped: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue('admin@example.com'),
  };

  const mockRedis = {
    setNXStrict: jest.fn(),
    tryAcquireLock: jest.fn().mockResolvedValue({ acquired: true }),
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpedsMonitorService,
        { provide: EmailService, useValue: mockEmailService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: RedisService, useValue: mockRedis },
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

  describe('checkForUpdates (multi-instance + durable baseline)', () => {
    const FINGERPRINT_KEY = 'ipeds-monitor:last-fingerprint';
    const html = '<html>2026 Final Release IPEDS</html>';
    let store: Record<string, string>;

    beforeEach(() => {
      store = {};
      mockRedis.setNXStrict.mockResolvedValue(true);
      mockRedis.tryAcquireLock.mockResolvedValue({ acquired: true });
      mockRedis.get.mockImplementation((k: string) =>
        Promise.resolve(store[k] ?? null),
      );
      mockRedis.set.mockImplementation((k: string, v: string) => {
        store[k] = v;
        return Promise.resolve();
      });
      global.fetch = jest.fn().mockResolvedValue({
        text: () => Promise.resolve(html),
      });
    });

    it('skips the whole check when the single-flight lock is held', async () => {
      mockRedis.setNXStrict.mockResolvedValue(false);
      mockRedis.tryAcquireLock.mockResolvedValue({
        acquired: false,
        reason: 'held',
      });

      await service.checkForUpdates();

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('records the fingerprint on first run without emailing (no baseline)', async () => {
      await service.checkForUpdates();

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
      expect(store[FINGERPRINT_KEY]).toBeDefined();
    });

    it('does not email when the page fingerprint is unchanged across runs', async () => {
      await service.checkForUpdates(); // first run sets the baseline
      await service.checkForUpdates(); // same html -> unchanged

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('emails the admin when the durable fingerprint changed', async () => {
      store[FINGERPRINT_KEY] = 'stale-different-fingerprint';

      await service.checkForUpdates();

      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
    });
  });
});

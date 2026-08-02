import { Test, TestingModule } from '@nestjs/testing';
import { PointsConfigService, PointAction } from './points-config.service';
import { SettingsService } from '../settings/settings.service';
import { BadRequestException } from '@nestjs/common';

describe('PointsConfigService', () => {
  let service: PointsConfigService;
  let settingsService: SettingsService;

  const mockSettingsService = {
    getTyped: jest.fn(),
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsConfigService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    service = module.get<PointsConfigService>(PointsConfigService);
    settingsService = module.get<SettingsService>(SettingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isEnabled', () => {
    it('should stay disabled in free-access mode even when persisted settings say enabled', async () => {
      mockSettingsService.getTyped.mockResolvedValue(true);

      const result = await service.isEnabled();

      expect(result).toBe(false);
      expect(mockSettingsService.getTyped).not.toHaveBeenCalled();
    });

    it('should return false when disabled', async () => {
      mockSettingsService.getTyped.mockResolvedValue(false);

      const result = await service.isEnabled();

      expect(result).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('should reject attempts to re-enable the points economy', async () => {
      await expect(service.setEnabled(true)).rejects.toThrow(
        'Points economy is disabled; product features run without points',
      );
      expect(mockSettingsService.set).not.toHaveBeenCalled();
    });

    it('should still persist an explicit disabled setting', async () => {
      await service.setEnabled(false);
      expect(mockSettingsService.set).toHaveBeenCalledWith(
        'points_enabled',
        'false',
      );
    });
  });

  describe('getPointValue', () => {
    it('should return configured value for known action', async () => {
      mockSettingsService.getTyped.mockResolvedValue(75);

      const result = await service.getPointValue(PointAction.SUBMIT_CASE);

      expect(result).toBe(75);
    });
  });

  describe('setPointValue', () => {
    it('should update point value for known action', async () => {
      await service.setPointValue(PointAction.SUBMIT_CASE, 100);

      expect(mockSettingsService.set).toHaveBeenCalled();
    });

    it('should throw BadRequestException for unknown action', async () => {
      await expect(
        service.setPointValue('UNKNOWN_ACTION' as any, 100),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllRules', () => {
    it('should return all point rules', async () => {
      mockSettingsService.getTyped.mockResolvedValue(50);

      const rules = await service.getAllRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]).toHaveProperty('action');
      expect(rules[0]).toHaveProperty('points');
      expect(rules[0]).toHaveProperty('type');
    });
  });

  describe('resetToDefaults', () => {
    it('should delete all point settings', async () => {
      await service.resetToDefaults();

      expect(mockSettingsService.delete).toHaveBeenCalled();
    });
  });

  describe('getRegistry', () => {
    it('should return the static registry', () => {
      const registry = service.getRegistry();

      expect(registry).toBeDefined();
      expect(registry[PointAction.SUBMIT_CASE]).toBeDefined();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService, SETTING_KEYS } from './settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prismaService: PrismaService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: {
            systemSetting: {
              findUnique: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              upsert: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ====== get() ======

  describe('get', () => {
    it('should return cached value from Redis', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('cached_value');

      const result = await service.get('admin_email');

      expect(result).toBe('cached_value');
      expect(redisService.get).toHaveBeenCalledWith('setting:admin_email');
      expect(prismaService.systemSetting.findUnique).not.toHaveBeenCalled();
    });

    it('should query DB when cache miss and cache the result', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.systemSetting.findUnique as jest.Mock).mockResolvedValue({
        key: 'admin_email',
        value: 'admin@test.com',
        description: 'Admin email',
        category: 'notification',
      });

      const result = await service.get('admin_email');

      expect(result).toBe('admin@test.com');
      expect(redisService.get).toHaveBeenCalledWith('setting:admin_email');
      expect(prismaService.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'admin_email' },
      });
      expect(redisService.set).toHaveBeenCalledWith(
        'setting:admin_email',
        'admin@test.com',
        300,
      );
    });

    it('should return default value when not in cache or DB', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.systemSetting.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      // site_name has a default of 'Study Abroad Platform'
      const result = await service.get('site_name');

      expect(result).toBe('Study Abroad Platform');
    });

    it('should return null for unknown key with no default', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.systemSetting.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await service.get('completely_unknown_key');

      expect(result).toBeNull();
    });

    it('should normalize key aliases (ADMIN_EMAIL -> admin_email)', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('aliased@test.com');

      const result = await service.get('ADMIN_EMAIL');

      expect(result).toBe('aliased@test.com');
      expect(redisService.get).toHaveBeenCalledWith('setting:admin_email');
    });

    it('should normalize key aliases (NOTIFICATION_ENABLED -> notification_enabled)', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.systemSetting.findUnique as jest.Mock).mockResolvedValue({
        key: 'notification_enabled',
        value: 'false',
      });

      const result = await service.get('NOTIFICATION_ENABLED');

      expect(result).toBe('false');
      expect(prismaService.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'notification_enabled' },
      });
    });
  });

  // ====== getTyped() ======

  describe('getTyped', () => {
    it('should parse boolean true', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('true');

      const result = await service.getTyped('notification_enabled', false);

      expect(result).toBe(true);
    });

    it('should parse boolean false', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('false');

      const result = await service.getTyped('notification_enabled', true);

      expect(result).toBe(false);
    });

    it('should parse number', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('99');

      const result = await service.getTyped('subscription_pro_price', 0);

      expect(result).toBe(99);
    });

    it('should parse JSON object', async () => {
      const jsonObj = { theme: 'dark', lang: 'en' };
      (redisService.get as jest.Mock).mockResolvedValue(
        JSON.stringify(jsonObj),
      );

      const result = await service.getTyped('some_json_key', {});

      expect(result).toEqual(jsonObj);
    });

    it('should parse JSON array', async () => {
      const jsonArr = ['a', 'b', 'c'];
      (redisService.get as jest.Mock).mockResolvedValue(
        JSON.stringify(jsonArr),
      );

      const result = await service.getTyped<string[]>('some_array_key', []);

      expect(result).toEqual(jsonArr);
    });

    it('should return defaultValue when get returns null', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.systemSetting.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      // Use a key that has no default in DEFAULT_SETTINGS
      const result = await service.getTyped('nonexistent_key', 42);

      expect(result).toBe(42);
    });

    it('should return defaultValue on JSON parse error', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('not valid json {{{');

      const defaultObj = { fallback: true };
      const result = await service.getTyped('some_key', defaultObj);

      expect(result).toEqual(defaultObj);
    });

    it('should return string value when defaultValue is a string', async () => {
      (redisService.get as jest.Mock).mockResolvedValue('hello world');

      const result = await service.getTyped('some_key', 'default');

      expect(result).toBe('hello world');
    });
  });

  // ====== set() ======

  describe('set', () => {
    it('should upsert to DB and invalidate cache', async () => {
      (prismaService.systemSetting.upsert as jest.Mock).mockResolvedValue({
        key: 'admin_email',
        value: 'new@test.com',
      });

      await service.set('admin_email', 'new@test.com', 'Updated admin email');

      expect(prismaService.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'admin_email' },
        update: { value: 'new@test.com', description: 'Updated admin email' },
        create: {
          key: 'admin_email',
          value: 'new@test.com',
          description: 'Updated admin email',
          category: 'notification',
        },
      });
      expect(redisService.del).toHaveBeenCalledWith('setting:admin_email');
    });

    it('should use default description and category when not provided for known key', async () => {
      (prismaService.systemSetting.upsert as jest.Mock).mockResolvedValue({});

      await service.set('site_name', 'New Site Name');

      expect(prismaService.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'site_name' },
        update: { value: 'New Site Name', description: undefined },
        create: {
          key: 'site_name',
          value: 'New Site Name',
          description: 'Site name',
          category: 'general',
        },
      });
    });

    it('should use empty description and general category for unknown key', async () => {
      (prismaService.systemSetting.upsert as jest.Mock).mockResolvedValue({});

      await service.set('custom_key', 'custom_value');

      expect(prismaService.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'custom_key' },
        update: { value: 'custom_value', description: undefined },
        create: {
          key: 'custom_key',
          value: 'custom_value',
          description: '',
          category: 'general',
        },
      });
    });

    it('should normalize alias keys when setting', async () => {
      (prismaService.systemSetting.upsert as jest.Mock).mockResolvedValue({});

      await service.set('ADMIN_EMAIL', 'alias@test.com');

      expect(prismaService.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'admin_email' },
        }),
      );
      expect(redisService.del).toHaveBeenCalledWith('setting:admin_email');
    });
  });

  // ====== setMany() ======

  describe('setMany', () => {
    it('should call set for each item', async () => {
      (prismaService.systemSetting.upsert as jest.Mock).mockResolvedValue({});

      const settings = [
        { key: 'admin_email', value: 'a@test.com' },
        { key: 'site_name', value: 'My Site' },
        { key: 'notification_enabled', value: 'false' },
      ];

      await service.setMany(settings);

      expect(prismaService.systemSetting.upsert).toHaveBeenCalledTimes(3);
      expect(redisService.del).toHaveBeenCalledTimes(3);

      expect(prismaService.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'admin_email' },
          update: expect.objectContaining({ value: 'a@test.com' }),
        }),
      );
      expect(prismaService.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'site_name' },
          update: expect.objectContaining({ value: 'My Site' }),
        }),
      );
      expect(prismaService.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'notification_enabled' },
          update: expect.objectContaining({ value: 'false' }),
        }),
      );
    });

    it('should handle empty array', async () => {
      await service.setMany([]);

      expect(prismaService.systemSetting.upsert).not.toHaveBeenCalled();
    });
  });

  // ====== getAll() ======

  describe('getAll', () => {
    it('should merge defaults with DB values', async () => {
      (prismaService.systemSetting.findMany as jest.Mock).mockResolvedValue([
        {
          key: 'admin_email',
          value: 'db@test.com',
          description: 'From DB',
          category: 'notification',
        },
        {
          key: 'custom_setting',
          value: 'custom_val',
          description: 'Custom',
          category: 'custom',
        },
      ]);

      const result = await service.getAll();

      // Should contain all default keys plus custom_setting from DB
      const adminEntry = result.find((s) => s.key === 'admin_email');
      expect(adminEntry).toEqual({
        key: 'admin_email',
        value: 'db@test.com',
        description: 'From DB',
        category: 'notification',
      });

      // Custom DB-only setting should be present
      const customEntry = result.find((s) => s.key === 'custom_setting');
      expect(customEntry).toEqual({
        key: 'custom_setting',
        value: 'custom_val',
        description: 'Custom',
        category: 'custom',
      });

      // Default settings that are NOT in DB should still be present
      const siteNameEntry = result.find((s) => s.key === 'site_name');
      expect(siteNameEntry).toEqual({
        key: 'site_name',
        value: 'Study Abroad Platform',
        description: 'Site name',
        category: 'general',
      });
    });

    it('should return all defaults when DB is empty', async () => {
      (prismaService.systemSetting.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getAll();

      // Should have at least all the SETTING_KEYS entries
      const keys = result.map((s) => s.key);
      expect(keys).toContain('admin_email');
      expect(keys).toContain('site_name');
      expect(keys).toContain('support_email');
      expect(keys).toContain('notification_enabled');
      expect(keys).toContain('points_enabled');
      expect(keys).toContain('subscription_pro_price');
      expect(keys).toContain('ai_quota_default_daily');
    });

    it('should override default values with DB values', async () => {
      (prismaService.systemSetting.findMany as jest.Mock).mockResolvedValue([
        {
          key: 'site_name',
          value: 'Overridden Name',
          description: 'Overridden desc',
          category: 'general',
        },
      ]);

      const result = await service.getAll();

      const siteEntry = result.find((s) => s.key === 'site_name');
      expect(siteEntry!.value).toBe('Overridden Name');
      expect(siteEntry!.description).toBe('Overridden desc');
    });
  });

  // ====== getByCategory() ======

  describe('getByCategory', () => {
    it('should filter settings by category', async () => {
      (prismaService.systemSetting.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getByCategory('notification');

      // All items should be in the notification category
      expect(result.length).toBeGreaterThan(0);
      result.forEach((s) => {
        expect((s as any).category ?? 'notification').toBe('notification');
      });

      // Known notification keys should be present
      const keys = result.map((s) => s.key);
      expect(keys).toContain('admin_email');
      expect(keys).toContain('support_email');
      expect(keys).toContain('notification_enabled');
    });

    it('should return empty array for non-existent category', async () => {
      (prismaService.systemSetting.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getByCategory('nonexistent_category');

      expect(result).toEqual([]);
    });

    it('should filter points category correctly', async () => {
      (prismaService.systemSetting.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getByCategory('points');

      const keys = result.map((s) => s.key);
      expect(keys).toContain('points_enabled');
      expect(keys).toContain(SETTING_KEYS.POINTS_ACTION_SUBMIT_CASE);
      expect(keys).not.toContain('admin_email');
      expect(keys).not.toContain('site_name');
    });
  });

  // ====== delete() ======

  describe('delete', () => {
    it('should delete from DB and clear cache', async () => {
      (prismaService.systemSetting.delete as jest.Mock).mockResolvedValue({
        key: 'admin_email',
      });

      await service.delete('admin_email');

      expect(prismaService.systemSetting.delete).toHaveBeenCalledWith({
        where: { key: 'admin_email' },
      });
      expect(redisService.del).toHaveBeenCalledWith('setting:admin_email');
    });

    it('should handle missing key gracefully (no error thrown)', async () => {
      const prismaError = new Error('Record not found');
      (prismaError as unknown as { code: string }).code = 'P2025';
      (prismaService.systemSetting.delete as jest.Mock).mockRejectedValue(
        prismaError,
      );

      // Should not throw
      await expect(service.delete('nonexistent_key')).resolves.toBeUndefined();

      expect(prismaService.systemSetting.delete).toHaveBeenCalledWith({
        where: { key: 'nonexistent_key' },
      });
      // Cache should still be cleared
      expect(redisService.del).toHaveBeenCalledWith('setting:nonexistent_key');
    });

    it('should normalize alias keys when deleting', async () => {
      (prismaService.systemSetting.delete as jest.Mock).mockResolvedValue({});

      await service.delete('ADMIN_EMAIL');

      expect(prismaService.systemSetting.delete).toHaveBeenCalledWith({
        where: { key: 'admin_email' },
      });
      expect(redisService.del).toHaveBeenCalledWith('setting:admin_email');
    });
  });

  // ====== initializeDefaults() ======

  describe('initializeDefaults', () => {
    it('should create settings that do not exist in DB', async () => {
      (prismaService.systemSetting.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prismaService.systemSetting.create as jest.Mock).mockResolvedValue({});

      await service.initializeDefaults();

      // Should have checked each default setting
      const findUniqueCalls = (
        prismaService.systemSetting.findUnique as jest.Mock
      ).mock.calls;
      const checkedKeys = findUniqueCalls.map(
        (call: any[]) => call[0].where.key,
      );

      expect(checkedKeys).toContain('admin_email');
      expect(checkedKeys).toContain('site_name');
      expect(checkedKeys).toContain('notification_enabled');
      expect(checkedKeys).toContain('points_enabled');
      expect(checkedKeys).toContain('subscription_pro_price');
      expect(checkedKeys).toContain('ai_quota_default_daily');

      // Should have created all of them since none existed
      expect(prismaService.systemSetting.create).toHaveBeenCalledTimes(
        findUniqueCalls.length,
      );

      // Verify one specific create call
      expect(prismaService.systemSetting.create).toHaveBeenCalledWith({
        data: {
          key: 'site_name',
          value: 'Study Abroad Platform',
          description: 'Site name',
          category: 'general',
        },
      });
    });

    it('should skip settings that already exist in DB', async () => {
      // Simulate that admin_email already exists, others do not
      (prismaService.systemSetting.findUnique as jest.Mock).mockImplementation(
        (args: { where: { key: string } }) => {
          if (args.where.key === 'admin_email') {
            return Promise.resolve({
              key: 'admin_email',
              value: 'existing@test.com',
            });
          }
          return Promise.resolve(null);
        },
      );
      (prismaService.systemSetting.create as jest.Mock).mockResolvedValue({});

      await service.initializeDefaults();

      // create should NOT have been called with admin_email
      const createCalls = (prismaService.systemSetting.create as jest.Mock).mock
        .calls;
      const createdKeys = createCalls.map((call: any[]) => call[0].data.key);
      expect(createdKeys).not.toContain('admin_email');

      // But it should have been called for all others
      const findUniqueCalls = (
        prismaService.systemSetting.findUnique as jest.Mock
      ).mock.calls;
      // create count should be total defaults minus 1 (the existing one)
      expect(prismaService.systemSetting.create).toHaveBeenCalledTimes(
        findUniqueCalls.length - 1,
      );
    });

    it('should not create any settings if all already exist', async () => {
      (prismaService.systemSetting.findUnique as jest.Mock).mockResolvedValue({
        key: 'any',
        value: 'exists',
      });

      await service.initializeDefaults();

      expect(prismaService.systemSetting.create).not.toHaveBeenCalled();
    });
  });

  // ====== SETTING_KEYS constant ======

  describe('SETTING_KEYS', () => {
    it('should export all expected keys', () => {
      expect(SETTING_KEYS.ADMIN_EMAIL).toBe('admin_email');
      expect(SETTING_KEYS.SITE_NAME).toBe('site_name');
      expect(SETTING_KEYS.SUPPORT_EMAIL).toBe('support_email');
      expect(SETTING_KEYS.NOTIFICATION_ENABLED).toBe('notification_enabled');
      expect(SETTING_KEYS.POINTS_ENABLED).toBe('points_enabled');
      expect(SETTING_KEYS.SUBSCRIPTION_PRO_PRICE).toBe(
        'subscription_pro_price',
      );
      expect(SETTING_KEYS.AI_QUOTA_DEFAULT_DAILY).toBe(
        'ai_quota_default_daily',
      );
    });
  });
});

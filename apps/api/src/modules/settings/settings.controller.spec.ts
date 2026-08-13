import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  let settingsService: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: {
            getAll: jest.fn(),
            getByCategory: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
            setMany: jest.fn(),
            isProtectedPointSetting: jest
              .fn()
              .mockImplementation((key: string) =>
                [
                  'points_enabled',
                  'POINTS_ENABLED',
                  'points_action_SUBMIT_CASE',
                ].includes(key),
              ),
          },
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
    settingsService = module.get<SettingsService>(SettingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET / should call getAll and return all settings', async () => {
    const expected = [{ key: 'site_name', value: 'Test' }];
    (settingsService.getAll as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getAll();

    expect(settingsService.getAll).toHaveBeenCalled();
    expect(result).toEqual(expected);
  });

  it('GET /category/:category should call getByCategory', async () => {
    const expected = [{ key: 'smtp_host', value: 'localhost' }];
    (settingsService.getByCategory as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getByCategory('email');

    expect(settingsService.getByCategory).toHaveBeenCalledWith('email');
    expect(result).toEqual(expected);
  });

  it('GET /:key should call get and return { key, value }', async () => {
    (settingsService.get as jest.Mock).mockResolvedValue('TestSite');

    const result = await controller.get('site_name');

    expect(settingsService.get).toHaveBeenCalledWith('site_name');
    expect(result).toEqual({ key: 'site_name', value: 'TestSite' });
  });

  it('PUT /:key should call set with key, value, description and return { success: true }', async () => {
    (settingsService.set as jest.Mock).mockResolvedValue(undefined);

    const result = await controller.update('site_name', {
      value: 'NewName',
      description: 'Site display name',
    });

    expect(settingsService.set).toHaveBeenCalledWith(
      'site_name',
      'NewName',
      'Site display name',
    );
    expect(result).toEqual({ success: true });
  });

  it('PUT / should call setMany with array payload and return { success: true }', async () => {
    const settings = [
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ];
    (settingsService.setMany as jest.Mock).mockResolvedValue(undefined);

    const result = await controller.updateMany(settings);

    expect(settingsService.setMany).toHaveBeenCalledWith(settings);
    expect(result).toEqual({ success: true });
  });

  it('PUT /:key rejects direct writes to the points runtime toggle', async () => {
    await expect(
      controller.update('points_enabled', { value: 'true' }),
    ).rejects.toThrow(BadRequestException);
    expect(settingsService.set).not.toHaveBeenCalled();
  });

  it('PUT / rejects batches containing protected points settings atomically', async () => {
    await expect(
      controller.updateMany([
        { key: 'site_name', value: 'Safe' },
        { key: 'points_action_SUBMIT_CASE', value: '500' },
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(settingsService.setMany).not.toHaveBeenCalled();
  });

  it('PUT / should throw BadRequestException for invalid payload', async () => {
    const invalidPayload = { notSettings: 'bad' } as any;

    await expect(controller.updateMany(invalidPayload)).rejects.toThrow(
      BadRequestException,
    );
  });
});

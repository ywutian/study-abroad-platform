import { Test, TestingModule } from '@nestjs/testing';
import { ProfileToolsService } from './profile-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';

describe('ProfileToolsService', () => {
  let service: ProfileToolsService;
  let profileLoader: jest.Mocked<ProfileLoaderHelper>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileToolsService,
        {
          provide: PrismaService,
          useValue: {
            profile: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: ProfileLoaderHelper,
          useValue: {
            loadProfile: jest.fn().mockResolvedValue(null),
            getProfileId: jest.fn().mockResolvedValue('profile-1'),
          },
        },
      ],
    }).compile();

    service = module.get(ProfileToolsService);
    profileLoader = module.get(ProfileLoaderHelper);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('get_profile')).toBe(true);
    expect(handlers.has('update_profile')).toBe(true);
  });

  it('should return empty profile message when profile is null', async () => {
    profileLoader.loadProfile.mockResolvedValue(null);
    const result = await service.getProfile('user-1', 'en');
    expect(result).toHaveProperty('message');
    expect(result.message).toContain('empty');
  });

  it('should return profile data when it exists', async () => {
    profileLoader.loadProfile.mockResolvedValue({ gpa: '3.9', name: 'Test' });
    const result = await service.getProfile('user-1', 'en');
    expect(result).toEqual({ gpa: '3.9', name: 'Test' });
  });
});

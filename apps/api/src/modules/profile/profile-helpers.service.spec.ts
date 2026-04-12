import { Test, TestingModule } from '@nestjs/testing';
import { ProfileHelpersService } from './profile-helpers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ProfileHelpersService', () => {
  let service: ProfileHelpersService;
  let prisma: PrismaService;
  let auth: AuthorizationService;

  const mockPrisma = {
    profile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockAuth = {
    verifyNestedOwnership: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileHelpersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthorizationService, useValue: mockAuth },
      ],
    }).compile();

    service = module.get<ProfileHelpersService>(ProfileHelpersService);
    prisma = module.get<PrismaService>(PrismaService);
    auth = module.get<AuthorizationService>(AuthorizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfileId', () => {
    it('should return existing profile ID', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({ id: 'prof-1' });

      const result = await service.getProfileId('user-1');

      expect(result).toBe('prof-1');
      expect(mockPrisma.profile.create).not.toHaveBeenCalled();
    });

    it('should auto-create profile when not exists', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);
      mockPrisma.profile.create.mockResolvedValue({ id: 'new-prof' });

      const result = await service.getProfileId('user-1');

      expect(result).toBe('new-prof');
      expect(mockPrisma.profile.create).toHaveBeenCalled();
    });
  });

  describe('verifyProfileOwnership', () => {
    it('should delegate to AuthorizationService', () => {
      const entity = { profile: { userId: 'user-1' } };
      mockAuth.verifyNestedOwnership.mockReturnValue(entity);

      const result = service.verifyProfileOwnership(
        entity,
        'user-1',
        'Test score',
      );

      expect(result).toBe(entity);
      expect(mockAuth.verifyNestedOwnership).toHaveBeenCalledWith(
        entity,
        'user-1',
        expect.any(Function),
        { entityName: 'Test score' },
      );
    });

    it('should throw when entity is null', () => {
      mockAuth.verifyNestedOwnership.mockImplementation(() => {
        throw new NotFoundException('Test score not found');
      });

      expect(() =>
        service.verifyProfileOwnership(null, 'user-1', 'Test score'),
      ).toThrow(NotFoundException);
    });
  });
});

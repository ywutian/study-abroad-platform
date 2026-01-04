import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let prismaService: PrismaService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    role: 'USER',
    emailVerified: false,
    locale: 'zh',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findById('user-123');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123', deletedAt: null },
      });
    });

    it('should return null when user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when email not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return user when found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByIdOrThrow('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findByIdOrThrow('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createData = {
        email: 'new@example.com',
        passwordHash: 'hashed',
      };
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        ...createData,
      });

      const result = await service.create(createData);

      expect(result.email).toBe('new@example.com');
      expect(prismaService.user.create).toHaveBeenCalledWith({ data: createData });
    });
  });

  describe('update', () => {
    it('should update user data', async () => {
      const updateData = { locale: 'en' };
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        locale: 'en',
      });

      const result = await service.update('user-123', updateData);

      expect(result.locale).toBe('en');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: updateData,
      });
    });
  });

  describe('softDelete', () => {
    it('should soft delete user by setting deletedAt', async () => {
      const deletedUser = { ...mockUser, deletedAt: new Date() };
      (prismaService.user.update as jest.Mock).mockResolvedValue(deletedUser);

      const result = await service.softDelete('user-123');

      expect(result.deletedAt).toBeDefined();
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});





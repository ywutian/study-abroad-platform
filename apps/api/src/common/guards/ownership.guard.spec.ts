import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { OwnershipGuard } from './ownership.guard';
import { OWNER_KEY, OwnerMetadata } from '../decorators/owner-only.decorator';
import { PrismaService } from '../../prisma/prisma.service';

describe('OwnershipGuard', () => {
  let guard: OwnershipGuard;
  let reflector: Reflector;
  let prisma: Record<string, any>;

  beforeEach(() => {
    reflector = new Reflector();
    prisma = {};
    guard = new OwnershipGuard(reflector, prisma as unknown as PrismaService);
  });

  function createMockContext(options?: {
    user?: { id: string; role: Role } | null;
    params?: Record<string, string>;
  }): ExecutionContext {
    const { user, params = {} } = options ?? {};
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user, params }),
      }),
    } as unknown as ExecutionContext;
  }

  function setMetadata(metadata: OwnerMetadata | undefined): void {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(metadata);
  }

  // -----------------------------------------------------------------------
  // No metadata (decorator not applied)
  // -----------------------------------------------------------------------
  it('should allow access when no @OwnerOnly metadata is set', async () => {
    setMetadata(undefined);
    const context = createMockContext({
      user: { id: 'user-1', role: Role.USER },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Missing user
  // -----------------------------------------------------------------------
  it('should throw ForbiddenException when user is not on the request', async () => {
    setMetadata({ model: 'admissionCase' });
    const context = createMockContext({ user: undefined });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Authentication required',
    );
  });

  it('should throw ForbiddenException when user is null', async () => {
    setMetadata({ model: 'admissionCase' });
    const context = createMockContext({ user: null });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  // -----------------------------------------------------------------------
  // Admin bypass
  // -----------------------------------------------------------------------
  it('should allow ADMIN to bypass ownership check', async () => {
    setMetadata({ model: 'admissionCase' });
    const context = createMockContext({
      user: { id: 'admin-1', role: Role.ADMIN },
      params: { id: 'resource-1' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    // Prisma should NOT be called for admins
  });

  // -----------------------------------------------------------------------
  // Missing route param
  // -----------------------------------------------------------------------
  it('should return false when the resourceId param is missing', async () => {
    setMetadata({ model: 'admissionCase' });
    const context = createMockContext({
      user: { id: 'user-1', role: Role.USER },
      params: {}, // no 'id' param
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should return false when a custom idParam is missing', async () => {
    setMetadata({ model: 'admissionCase', idParam: 'caseId' });
    const context = createMockContext({
      user: { id: 'user-1', role: Role.USER },
      params: { id: 'resource-1' }, // has 'id' but not 'caseId'
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Prisma model not found
  // -----------------------------------------------------------------------
  it('should return false when the Prisma model does not exist', async () => {
    setMetadata({ model: 'nonExistentModel' });
    const context = createMockContext({
      user: { id: 'user-1', role: Role.USER },
      params: { id: 'resource-1' },
    });
    // prisma does not have 'nonExistentModel'

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should return false when the Prisma model exists but has no findUnique', async () => {
    setMetadata({ model: 'brokenModel' });
    prisma.brokenModel = { findMany: jest.fn() }; // no findUnique
    const context = createMockContext({
      user: { id: 'user-1', role: Role.USER },
      params: { id: 'resource-1' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Resource not found in DB
  // -----------------------------------------------------------------------
  it('should throw NotFoundException when the resource does not exist', async () => {
    setMetadata({ model: 'admissionCase' });
    prisma.admissionCase = {
      findUnique: jest.fn().mockResolvedValue(null),
    };
    const context = createMockContext({
      user: { id: 'user-1', role: Role.USER },
      params: { id: 'resource-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Resource not found',
    );
  });

  // -----------------------------------------------------------------------
  // Ownership mismatch
  // -----------------------------------------------------------------------
  it('should throw ForbiddenException when user does not own the resource', async () => {
    setMetadata({ model: 'admissionCase' });
    prisma.admissionCase = {
      findUnique: jest.fn().mockResolvedValue({ userId: 'other-user' }),
    };
    const context = createMockContext({
      user: { id: 'user-1', role: Role.USER },
      params: { id: 'resource-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'You do not have permission to access this resource',
    );
  });

  // -----------------------------------------------------------------------
  // Ownership match (happy path)
  // -----------------------------------------------------------------------
  it('should return true when user owns the resource (default userField)', async () => {
    setMetadata({ model: 'admissionCase' });
    prisma.admissionCase = {
      findUnique: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    };
    const context = createMockContext({
      user: { id: 'user-1', role: Role.USER },
      params: { id: 'resource-1' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(prisma.admissionCase.findUnique).toHaveBeenCalledWith({
      where: { id: 'resource-1' },
      select: { userId: true },
    });
  });

  it('should return true when user owns the resource (VERIFIED role)', async () => {
    setMetadata({ model: 'profile' });
    prisma.profile = {
      findUnique: jest.fn().mockResolvedValue({ userId: 'user-2' }),
    };
    const context = createMockContext({
      user: { id: 'user-2', role: Role.VERIFIED },
      params: { id: 'profile-1' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Custom idParam and userField
  // -----------------------------------------------------------------------
  it('should use custom idParam to extract resource ID', async () => {
    setMetadata({ model: 'admissionCase', idParam: 'caseId' });
    prisma.admissionCase = {
      findUnique: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    };
    const context = createMockContext({
      user: { id: 'user-1', role: Role.USER },
      params: { caseId: 'case-42' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(prisma.admissionCase.findUnique).toHaveBeenCalledWith({
      where: { id: 'case-42' },
      select: { userId: true },
    });
  });

  it('should use custom userField to check ownership', async () => {
    setMetadata({
      model: 'admissionCase',
      userField: 'authorId',
    });
    prisma.admissionCase = {
      findUnique: jest.fn().mockResolvedValue({ authorId: 'user-1' }),
    };
    const context = createMockContext({
      user: { id: 'user-1', role: Role.USER },
      params: { id: 'resource-1' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(prisma.admissionCase.findUnique).toHaveBeenCalledWith({
      where: { id: 'resource-1' },
      select: { authorId: true },
    });
  });

  it('should throw ForbiddenException when custom userField does not match', async () => {
    setMetadata({
      model: 'admissionCase',
      userField: 'authorId',
    });
    prisma.admissionCase = {
      findUnique: jest.fn().mockResolvedValue({ authorId: 'someone-else' }),
    };
    const context = createMockContext({
      user: { id: 'user-1', role: Role.USER },
      params: { id: 'resource-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  // -----------------------------------------------------------------------
  // Reflector called with correct keys
  // -----------------------------------------------------------------------
  it('should call reflector with OWNER_KEY, handler, and class', async () => {
    const spy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(undefined);

    const handler = jest.fn();
    const cls = jest.fn();
    const context = {
      getHandler: () => handler,
      getClass: () => cls,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'u1', role: Role.USER }, params: {} }),
      }),
    } as unknown as ExecutionContext;

    await guard.canActivate(context);

    expect(spy).toHaveBeenCalledWith(OWNER_KEY, [handler, cls]);
  });
});

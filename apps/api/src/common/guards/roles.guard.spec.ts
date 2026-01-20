import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(user?: { role: Role }): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ role: Role.USER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.USER]);
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow ADMIN access to any role requirement', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.VERIFIED]);
    const context = createMockContext({ role: Role.ADMIN });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow ADMIN access to ADMIN-only endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext({ role: Role.ADMIN });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow VERIFIED access to USER endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.USER]);
    const context = createMockContext({ role: Role.VERIFIED });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow VERIFIED access to VERIFIED endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.VERIFIED]);
    const context = createMockContext({ role: Role.VERIFIED });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny VERIFIED access to ADMIN-only endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext({ role: Role.VERIFIED });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should allow USER access to USER endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.USER]);
    const context = createMockContext({ role: Role.USER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny USER access to VERIFIED endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.VERIFIED]);
    const context = createMockContext({ role: Role.USER });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny USER access to ADMIN endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext({ role: Role.USER });
    expect(guard.canActivate(context)).toBe(false);
  });
});

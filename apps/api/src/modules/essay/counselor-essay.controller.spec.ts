import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CounselorEssayController } from './counselor-essay.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

/**
 * Smoke tests for the counselor pattern-search controller.
 *
 * Scope: the role-gate semantics + filter passthrough. The full
 * cross-essay search isn't exercised here — that's an integration
 * concern with a real DB.
 */
describe('CounselorEssayController', () => {
  let controller: CounselorEssayController;
  let rolesGuard: RolesGuard;

  const mockPrisma = {
    admissionCase: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CounselorEssayController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        RolesGuard,
        Reflector,
      ],
    }).compile();

    controller = module.get<CounselorEssayController>(CounselorEssayController);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findMany with the result filter when provided', async () => {
    await controller.searchPatterns(undefined, 'ADMITTED', undefined);
    expect(mockPrisma.admissionCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ result: 'ADMITTED' }),
      }),
    );
  });

  it('should not pass through an invalid result value', async () => {
    await controller.searchPatterns(undefined, 'NOT_A_RESULT', undefined);
    const call = mockPrisma.admissionCase.findMany.mock.calls[0][0];
    expect(call.where.result).toBeUndefined();
  });

  // ── Role gate semantics ────────────────────────────────────────────
  //
  // The controller is decorated `@Roles(COUNSELOR, ADMIN, SUPER_ADMIN)`
  // and the RolesGuard reads that via the Reflector. We construct a
  // fake ExecutionContext with each role and assert allow/deny.
  function makeContext(role: Role | undefined): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
      getHandler: () => controller.searchPatterns,
      getClass: () => CounselorEssayController,
    } as unknown as ExecutionContext;
  }

  // Patch the Reflector to return the @Roles metadata that the
  // decorator sets at class-level on `CounselorEssayController`.
  function patchReflector(reflector: Reflector) {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === ROLES_KEY
          ? [Role.COUNSELOR, Role.ADMIN, Role.SUPER_ADMIN]
          : undefined,
      );
  }

  it('admits COUNSELOR', () => {
    patchReflector(
      (rolesGuard as unknown as { reflector: Reflector }).reflector,
    );
    expect(rolesGuard.canActivate(makeContext(Role.COUNSELOR))).toBe(true);
  });

  it('admits ADMIN', () => {
    patchReflector(
      (rolesGuard as unknown as { reflector: Reflector }).reflector,
    );
    expect(rolesGuard.canActivate(makeContext(Role.ADMIN))).toBe(true);
  });

  it('admits SUPER_ADMIN via the short-circuit', () => {
    patchReflector(
      (rolesGuard as unknown as { reflector: Reflector }).reflector,
    );
    expect(rolesGuard.canActivate(makeContext(Role.SUPER_ADMIN))).toBe(true);
  });

  it('denies a plain USER', () => {
    patchReflector(
      (rolesGuard as unknown as { reflector: Reflector }).reflector,
    );
    expect(rolesGuard.canActivate(makeContext(Role.USER))).toBe(false);
  });

  it('denies VERIFIED — not enough', () => {
    patchReflector(
      (rolesGuard as unknown as { reflector: Reflector }).reflector,
    );
    expect(rolesGuard.canActivate(makeContext(Role.VERIFIED))).toBe(false);
  });

  it('denies OPERATOR — counselor route is editorial-sensitive', () => {
    // Verifies the 2.5 carve-out in ROLE_HIERARCHY: OPERATOR(2) must
    // NOT satisfy `@Roles(COUNSELOR)`. If this flips, data-entry
    // interns can read every essay — that's a leak.
    patchReflector(
      (rolesGuard as unknown as { reflector: Reflector }).reflector,
    );
    expect(rolesGuard.canActivate(makeContext(Role.OPERATOR))).toBe(false);
  });

  it('throws when no user is present (auth missing)', () => {
    patchReflector(
      (rolesGuard as unknown as { reflector: Reflector }).reflector,
    );
    expect(() => rolesGuard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});

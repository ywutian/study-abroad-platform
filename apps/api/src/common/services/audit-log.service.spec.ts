import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService, AuditAction } from './audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Basic logging
  // -----------------------------------------------------------------------
  it('should log the action and userId', async () => {
    await service.log({
      userId: 'user-1',
      action: AuditAction.LOGIN,
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('AUDIT: LOGIN by user user-1'),
    );
  });

  it('should include the resource in the log when provided', async () => {
    await service.log({
      userId: 'user-2',
      action: AuditAction.VAULT_ACCESS,
      resource: 'vault-item-42',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('on vault-item-42'),
    );
  });

  it('should not include resource text when resource is not provided', async () => {
    await service.log({
      userId: 'user-3',
      action: AuditAction.LOGOUT,
    });

    const logMessage = logSpy.mock.calls[0][0];
    expect(logMessage).not.toContain(' on ');
  });

  // -----------------------------------------------------------------------
  // All audit actions
  // -----------------------------------------------------------------------
  it.each([
    AuditAction.LOGIN,
    AuditAction.LOGOUT,
    AuditAction.PASSWORD_CHANGE,
    AuditAction.PASSWORD_RESET,
    AuditAction.VAULT_ACCESS,
    AuditAction.VAULT_EXPORT,
    AuditAction.ADMIN_ACTION,
    AuditAction.DATA_EXPORT,
    AuditAction.ACCOUNT_DELETE,
  ])('should log the %s action correctly', async (action) => {
    await service.log({
      userId: 'user-test',
      action,
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(`AUDIT: ${action} by user user-test`),
    );
  });

  // -----------------------------------------------------------------------
  // Optional fields
  // -----------------------------------------------------------------------
  it('should accept optional metadata without error', async () => {
    await expect(
      service.log({
        userId: 'user-4',
        action: AuditAction.ADMIN_ACTION,
        metadata: { detail: 'banned user', targetId: 'user-99' },
      }),
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('should accept optional ip and userAgent without error', async () => {
    await expect(
      service.log({
        userId: 'user-5',
        action: AuditAction.LOGIN,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      }),
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('should accept all optional fields together', async () => {
    await expect(
      service.log({
        userId: 'user-6',
        action: AuditAction.DATA_EXPORT,
        resource: 'profile-data',
        metadata: { format: 'csv' },
        ip: '10.0.0.1',
        userAgent: 'TestAgent/1.0',
      }),
    ).resolves.toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  it('should catch errors and log them without throwing', async () => {
    // Force an error inside the try block by making logger.log throw
    logSpy.mockImplementation(() => {
      throw new Error('Logging infrastructure down');
    });

    // The service should NOT throw even if the internal logger fails
    await expect(
      service.log({
        userId: 'user-7',
        action: AuditAction.ACCOUNT_DELETE,
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to write audit log',
      expect.any(Error),
    );
  });

  // -----------------------------------------------------------------------
  // Return value
  // -----------------------------------------------------------------------
  it('should return void (undefined)', async () => {
    const result = await service.log({
      userId: 'user-8',
      action: AuditAction.PASSWORD_CHANGE,
    });

    expect(result).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // AuditAction enum values
  // -----------------------------------------------------------------------
  it('should define the expected set of audit actions', () => {
    expect(Object.values(AuditAction)).toEqual(
      expect.arrayContaining([
        'LOGIN',
        'LOGOUT',
        'PASSWORD_CHANGE',
        'PASSWORD_RESET',
        'VAULT_ACCESS',
        'VAULT_EXPORT',
        'ADMIN_ACTION',
        'DATA_EXPORT',
        'ACCOUNT_DELETE',
      ]),
    );
    expect(Object.values(AuditAction)).toHaveLength(9);
  });
});

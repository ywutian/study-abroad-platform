import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminBootstrapService } from './admin-bootstrap.service';

describe('AdminBootstrapService', () => {
  it('reconciles a different credential and revokes refresh tokens', async () => {
    const existingHash = await bcrypt.hash('different-existing-password', 4);
    const managedHash = await bcrypt.hash('m'.repeat(40), 4);
    const prisma: Record<string, any> = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'admin-1',
          email: 'admin@example.com',
          passwordHash: existingHash,
        }),
        update: jest.fn(),
      },
      refreshToken: { deleteMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn((callback) => callback(prisma));
    const service = new AdminBootstrapService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn((key: string) => {
          if (key === 'NODE_ENV') return 'production';
          if (key === 'ADMIN_BOOTSTRAP_EMAIL') return 'admin@example.com';
          if (key === 'ADMIN_BOOTSTRAP_PASSWORD_HASH_B64')
            return Buffer.from(managedHash).toString('base64');
          return undefined;
        }),
      } as unknown as ConfigService,
    );

    await service.onModuleInit();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { passwordHash: managedHash },
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'admin-1' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ADMIN_BOOTSTRAP_CREDENTIAL_RECONCILED',
        }),
      }),
    );
  });

  it('preserves an administrator already using the managed credential', async () => {
    const managedPassword = 'm'.repeat(40);
    const passwordHash = await bcrypt.hash(managedPassword, 4);
    const prisma: Record<string, any> = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'admin-1',
          email: 'admin@example.com',
          passwordHash,
        }),
        update: jest.fn(),
      },
    };
    const service = new AdminBootstrapService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn((key: string) => {
          if (key === 'NODE_ENV') return 'production';
          if (key === 'ADMIN_BOOTSTRAP_EMAIL') return 'admin@example.com';
          if (key === 'ADMIN_BOOTSTRAP_PASSWORD_HASH_B64')
            return Buffer.from(passwordHash).toString('base64');
          return undefined;
        }),
      } as unknown as ConfigService,
    );

    await service.onModuleInit();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('fails closed when the managed value is not a bcrypt hash', async () => {
    const service = new AdminBootstrapService(
      {} as PrismaService,
      {
        get: jest.fn((key: string) => {
          if (key === 'NODE_ENV') return 'production';
          if (key === 'ADMIN_BOOTSTRAP_EMAIL') return 'admin@example.com';
          if (key === 'ADMIN_BOOTSTRAP_PASSWORD_HASH_B64')
            return Buffer.from('not-a-password-hash').toString('base64');
          return undefined;
        }),
      } as unknown as ConfigService,
    );

    await expect(service.onModuleInit()).rejects.toThrow(/not a bcrypt hash/);
  });
});

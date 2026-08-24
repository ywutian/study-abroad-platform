import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Production-only reconciliation for the managed administrator credential.
 * The secret is injected at runtime and is never logged or persisted outside
 * the password hash.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') !== 'production') return;
    const email = this.config.get<string>('ADMIN_BOOTSTRAP_EMAIL');
    const password = this.config.get<string>('ADMIN_BOOTSTRAP_PASSWORD');
    if (!email || !password) return;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 12);
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            emailVerified: true,
            role: Role.SUPER_ADMIN,
            locale: 'zh',
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'ADMIN_BOOTSTRAP_CREATED',
            resource: 'auth',
            resourceId: user.id,
            metadata: { source: 'secret_manager' },
          },
        });
      });
      this.logger.log(
        'Production administrator bootstrapped from managed secret',
      );
      return;
    }

    const alreadyUsesManagedCredential = await bcrypt.compare(
      password,
      existing.passwordHash,
    );
    if (alreadyUsesManagedCredential) return;

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
      await tx.refreshToken.deleteMany({ where: { userId: existing.id } });
      await tx.auditLog.create({
        data: {
          userId: existing.id,
          action: 'ADMIN_BOOTSTRAP_CREDENTIAL_RECONCILED',
          resource: 'auth',
          resourceId: existing.id,
          metadata: { refreshTokensRevoked: true, source: 'secret_manager' },
        },
      });
    });
    this.logger.warn(
      'Production administrator credential was reconciled with managed secret',
    );
  }
}
